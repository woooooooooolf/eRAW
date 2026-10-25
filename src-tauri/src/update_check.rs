//! Manual, header-only update discovery. No client or network work at startup.
use reqwest::{Client, Method, StatusCode, Url};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant, SystemTime},
};
use tauri::{State, WebviewWindow};

pub const LATEST_URL: &str = "https://github.com/woooooooooolf/eRAW/releases/latest";
const REPOSITORY_PATH: &str = "/woooooooooolf/eRAW/";
const TOTAL_TIMEOUT: Duration = Duration::from_secs(8);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_REDIRECTS: usize = 4;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FailureReason {
    Timeout,
    Network,
    RateLimited,
    NoRelease,
    InvalidResponse,
    Busy,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateResult {
    Current,
    Available {
        version: String,
        #[serde(rename = "downloadAvailable")]
        download_available: bool,
        #[serde(rename = "releaseUrl")]
        release_url: String,
        #[serde(rename = "downloadUrl")]
        download_url: Option<String>,
    },
    Failed {
        reason: FailureReason,
    },
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateLink {
    Download,
    Release,
}

#[derive(Clone, Debug)]
struct UpdateTarget {
    release: Url,
    download: Option<Url>,
}

#[derive(Default)]
pub struct UpdateCheckState {
    checking: AtomicBool,
    target: Mutex<Option<UpdateTarget>>,
    cooldown: Mutex<Option<Instant>>,
}

impl UpdateCheckState {
    /// URLs are produced and validated by this module, never supplied by JS.
    pub fn target_url(&self, link: UpdateLink) -> Option<String> {
        let target = self.target.lock().ok()?;
        match link {
            UpdateLink::Download => target.as_ref()?.download.as_ref().map(ToString::to_string),
            UpdateLink::Release => Some(
                target
                    .as_ref()
                    .map(|value| value.release.as_str())
                    .unwrap_or(LATEST_URL)
                    .into(),
            ),
        }
    }
}

struct ActiveCheck<'a>(&'a AtomicBool);
impl Drop for ActiveCheck<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Clone, Debug)]
struct Failure {
    reason: FailureReason,
    retry_after: Option<Duration>,
}
impl From<FailureReason> for Failure {
    fn from(reason: FailureReason) -> Self {
        Self {
            reason,
            retry_after: None,
        }
    }
}

struct Headers {
    status: StatusCode,
    location: Option<String>,
    content_type: Option<String>,
}

trait HeaderTransport {
    async fn headers(&self, method: Method, url: &Url) -> Result<Headers, Failure>;
}

struct HttpTransport(Client);
impl HeaderTransport for HttpTransport {
    async fn headers(&self, method: Method, url: &Url) -> Result<Headers, Failure> {
        let response = self
            .0
            .request(method, url.clone())
            .send()
            .await
            .map_err(|error| {
                Failure::from(if error.is_timeout() {
                    FailureReason::Timeout
                } else {
                    FailureReason::Network
                })
            })?;
        let status = response.status();
        if status == StatusCode::TOO_MANY_REQUESTS
            || (status == StatusCode::FORBIDDEN
                && response
                    .headers()
                    .contains_key(reqwest::header::RETRY_AFTER))
        {
            let retry_after = response
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| {
                    value
                        .parse::<u64>()
                        .ok()
                        .map(Duration::from_secs)
                        .or_else(|| {
                            httpdate::parse_http_date(value)
                                .ok()
                                .and_then(|time| time.duration_since(SystemTime::now()).ok())
                        })
                })
                .unwrap_or(Duration::from_secs(60));
            return Err(Failure {
                reason: FailureReason::RateLimited,
                retry_after: Some(retry_after),
            });
        }
        // Never consume HTML, release descriptions, or ZIP bytes.
        Ok(Headers {
            status,
            location: response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned),
            content_type: response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned),
        })
    }
}

fn build_client() -> Result<HttpTransport, Failure> {
    Client::builder()
        .tls_backend_native()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TOTAL_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .user_agent(concat!("eRAW/", env!("CARGO_PKG_VERSION")))
        .build()
        .map(HttpTransport)
        .map_err(|_| FailureReason::Network.into())
}

fn official_repository_url(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url.path().starts_with(REPOSITORY_PATH)
}

fn release_version(url: &Url) -> Result<Option<(String, Version)>, Failure> {
    if !official_repository_url(url) {
        return Err(FailureReason::InvalidResponse.into());
    }
    let Some(tag) = url
        .path()
        .strip_prefix(&format!("{REPOSITORY_PATH}releases/tag/"))
    else {
        return Ok(None);
    };
    if tag.contains('/') {
        return Err(FailureReason::InvalidResponse.into());
    }
    let numeric = tag
        .strip_prefix('V')
        .or_else(|| tag.strip_prefix('v'))
        .unwrap_or(tag);
    let version =
        Version::parse(numeric).map_err(|_| Failure::from(FailureReason::InvalidResponse))?;
    if !version.pre.is_empty() || !version.build.is_empty() {
        return Err(FailureReason::InvalidResponse.into());
    }
    Ok(Some((tag.into(), version)))
}

async fn request_headers(transport: &impl HeaderTransport, url: &Url) -> Result<Headers, Failure> {
    let response = transport.headers(Method::HEAD, url).await?;
    if matches!(
        response.status,
        StatusCode::METHOD_NOT_ALLOWED | StatusCode::NOT_IMPLEMENTED
    ) {
        transport.headers(Method::GET, url).await
    } else {
        Ok(response)
    }
}

async fn latest_version(
    transport: &impl HeaderTransport,
) -> Result<(Url, String, Version), Failure> {
    let mut url = Url::parse(LATEST_URL).expect("fixed update URL");
    for _ in 0..MAX_REDIRECTS {
        let response = request_headers(transport, &url).await?;
        if response.status == StatusCode::NOT_FOUND {
            return Err(FailureReason::NoRelease.into());
        }
        if !matches!(response.status.as_u16(), 301 | 302 | 303 | 307 | 308) {
            return Err(if response.status.is_server_error()
                || response.status == StatusCode::FORBIDDEN
            {
                FailureReason::Network
            } else {
                FailureReason::InvalidResponse
            }
            .into());
        }
        let next = response
            .location
            .and_then(|location| url.join(&location).ok())
            .ok_or(FailureReason::InvalidResponse)?;
        if let Some((tag, version)) = release_version(&next)? {
            return Ok((next, tag, version));
        }
        url = next;
    }
    Err(FailureReason::InvalidResponse.into())
}

async fn zip_available(transport: &impl HeaderTransport, url: &Url) -> Result<bool, Failure> {
    let response = request_headers(transport, url).await?;
    if response.status == StatusCode::OK {
        return Ok(response.content_type.is_some_and(|value| {
            matches!(
                value.split(';').next().unwrap_or("").trim(),
                "application/zip" | "application/octet-stream"
            )
        }));
    }
    if matches!(response.status.as_u16(), 301 | 302 | 303 | 307 | 308) {
        let destination = response.location.and_then(|value| url.join(&value).ok());
        return Ok(destination.is_some_and(|value| {
            value.scheme() == "https"
                && value.username().is_empty()
                && value.password().is_none()
                && value.port_or_known_default() == Some(443)
                && matches!(
                    value.host_str(),
                    Some("release-assets.githubusercontent.com" | "objects.githubusercontent.com")
                )
        }));
    }
    Ok(false)
}

async fn discover(
    transport: &impl HeaderTransport,
    current: &Version,
    platform: Option<&str>,
    deadline: tokio::time::Instant,
) -> Result<(UpdateResult, Option<UpdateTarget>, Option<Duration>), Failure> {
    let (release, tag, version) = tokio::time::timeout_at(deadline, latest_version(transport))
        .await
        .map_err(|_| Failure::from(FailureReason::Timeout))??;
    if version <= *current {
        return Ok((UpdateResult::Current, None, None));
    }
    let candidate = platform.map(|platform| {
        Url::parse(&format!(
        "https://github.com/woooooooooolf/eRAW/releases/download/{tag}/eRAW-{tag}-{platform}.zip"
    )).expect("validated stable tag")
    });
    let (download, retry_after) = if let Some(ref url) = candidate {
        match tokio::time::timeout_at(deadline, zip_available(transport, url)).await {
            Ok(Ok(true)) => (candidate, None),
            Ok(Err(error)) => (None, error.retry_after),
            _ => (None, None),
        }
    } else {
        (None, None)
    };
    Ok((
        UpdateResult::Available {
            version: format!("V{version}"),
            download_available: download.is_some(),
            release_url: release.to_string(),
            download_url: download.as_ref().map(ToString::to_string),
        },
        Some(UpdateTarget { release, download }),
        retry_after,
    ))
}

async fn perform_check(state: &UpdateCheckState) -> UpdateResult {
    if state.checking.swap(true, Ordering::AcqRel) {
        return UpdateResult::Failed {
            reason: FailureReason::Busy,
        };
    }
    let _active = ActiveCheck(&state.checking);
    if let Ok(mut target) = state.target.lock() {
        *target = None;
    }
    if state
        .cooldown
        .lock()
        .ok()
        .and_then(|value| *value)
        .is_some_and(|time| time > Instant::now())
    {
        return UpdateResult::Failed {
            reason: FailureReason::RateLimited,
        };
    }
    let deadline = tokio::time::Instant::now() + TOTAL_TIMEOUT;
    // Potential OS certificate/proxy initialization must not block a UI/runtime thread.
    let transport =
        tokio::time::timeout_at(deadline, tauri::async_runtime::spawn_blocking(build_client)).await;
    let result = match transport {
        Ok(Ok(Ok(transport))) => {
            let current = Version::parse(env!("CARGO_PKG_VERSION")).expect("application version");
            let platform =
                cfg!(all(target_os = "windows", target_arch = "x86_64")).then_some("windows-x64");
            discover(&transport, &current, platform, deadline).await
        }
        Err(_) => Err(FailureReason::Timeout.into()),
        _ => Err(FailureReason::Network.into()),
    };
    let (outcome, target, cooldown) = match result {
        Ok(value) => value,
        Err(error) => (
            UpdateResult::Failed {
                reason: error.reason,
            },
            None,
            error.retry_after,
        ),
    };
    if let Ok(mut stored) = state.target.lock() {
        *stored = target;
    }
    if let Ok(mut stored) = state.cooldown.lock() {
        *stored = cooldown.and_then(|duration| Instant::now().checked_add(duration));
    }
    outcome
}

#[tauri::command]
pub async fn check_for_updates(
    window: WebviewWindow,
    state: State<'_, UpdateCheckState>,
) -> Result<UpdateResult, ()> {
    if window.label() != "main" {
        return Ok(UpdateResult::Failed {
            reason: FailureReason::InvalidResponse,
        });
    }
    Ok(perform_check(state.inner()).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        collections::VecDeque,
        io::{Read, Write},
        net::TcpListener,
        sync::{Arc, mpsc},
        thread,
    };

    struct ScriptedTransport {
        responses: Mutex<VecDeque<Result<Headers, Failure>>>,
        requests: Mutex<Vec<(Method, String)>>,
        delay: Duration,
    }

    impl ScriptedTransport {
        fn new(responses: Vec<Headers>) -> Self {
            Self {
                responses: Mutex::new(responses.into_iter().map(Ok).collect()),
                requests: Mutex::new(Vec::new()),
                delay: Duration::ZERO,
            }
        }
    }

    impl HeaderTransport for ScriptedTransport {
        async fn headers(&self, method: Method, url: &Url) -> Result<Headers, Failure> {
            self.requests
                .lock()
                .unwrap()
                .push((method, url.to_string()));
            tokio::time::sleep(self.delay).await;
            self.responses
                .lock()
                .unwrap()
                .pop_front()
                .expect("unexpected extra HTTP request")
        }
    }

    fn redirect(location: &str) -> Headers {
        Headers {
            status: StatusCode::FOUND,
            location: Some(location.into()),
            content_type: None,
        }
    }

    fn status(code: u16) -> Headers {
        Headers {
            status: StatusCode::from_u16(code).unwrap(),
            location: None,
            content_type: None,
        }
    }

    fn discover_test(
        transport: &impl HeaderTransport,
        current: &str,
    ) -> Result<(UpdateResult, Option<UpdateTarget>, Option<Duration>), Failure> {
        tauri::async_runtime::block_on(discover(
            transport,
            &Version::parse(current).unwrap(),
            Some("windows-x64"),
            tokio::time::Instant::now() + Duration::from_secs(1),
        ))
    }

    #[test]
    fn current_or_older_latest_stops_after_one_header_request() {
        for tag in ["V0.8.0", "V0.7.9"] {
            let transport = ScriptedTransport::new(vec![redirect(&format!(
                "{REPOSITORY_PATH}releases/tag/{tag}"
            ))]);
            assert_eq!(
                discover_test(&transport, "0.8.0").unwrap().0,
                UpdateResult::Current
            );
            let requests = transport.requests.lock().unwrap();
            assert_eq!(requests.len(), 1);
            assert_eq!(requests[0], (Method::HEAD, LATEST_URL.into()));
        }
    }

    #[test]
    fn newer_numeric_version_checks_exact_zip_without_fetching_html_cdn_or_api() {
        let transport = ScriptedTransport::new(vec![
            redirect(&format!("{REPOSITORY_PATH}releases/tag/V0.10.0")),
            redirect(
                "https://release-assets.githubusercontent.com/example?temporary-signature=not-stored",
            ),
        ]);
        let (result, target, _) = discover_test(&transport, "0.9.9").unwrap();
        let target = target.unwrap();
        let expected = "https://github.com/woooooooooolf/eRAW/releases/download/V0.10.0/eRAW-V0.10.0-windows-x64.zip";
        assert_eq!(target.download.unwrap().as_str(), expected);
        assert!(matches!(
            result,
            UpdateResult::Available {
                download_available: true,
                ..
            }
        ));
        let requests = transport.requests.lock().unwrap();
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[1], (Method::HEAD, expected.into()));
        assert!(
            requests
                .iter()
                .all(|(_, url)| url.starts_with("https://github.com/woooooooooolf/eRAW/"))
        );
    }

    #[test]
    fn only_explicit_head_not_supported_uses_header_only_get() {
        let transport = ScriptedTransport::new(vec![
            status(405),
            redirect(&format!("{REPOSITORY_PATH}releases/tag/V0.8.0")),
        ]);
        assert_eq!(
            discover_test(&transport, "0.8.0").unwrap().0,
            UpdateResult::Current
        );
        assert_eq!(
            transport
                .requests
                .lock()
                .unwrap()
                .iter()
                .map(|(method, _)| method.clone())
                .collect::<Vec<_>>(),
            [Method::HEAD, Method::GET]
        );
        for code in [200, 403, 404, 429, 500] {
            let transport = ScriptedTransport::new(vec![status(code)]);
            assert!(discover_test(&transport, "0.8.0").is_err());
            assert_eq!(transport.requests.lock().unwrap().len(), 1);
        }
    }

    #[test]
    fn malformed_and_untrusted_locations_or_prereleases_are_rejected_without_following() {
        for location in [
            "https://api.github.com/repos/woooooooooolf/eRAW/releases/latest",
            "https://github.com.attacker.invalid/woooooooooolf/eRAW/releases/tag/V9.0.0",
            "http://github.com/woooooooooolf/eRAW/releases/tag/V9.0.0",
            "https://user:password@github.com/woooooooooolf/eRAW/releases/tag/V9.0.0",
            "https://github.com/other/repo/releases/tag/V9.0.0",
            "https://github.com/woooooooooolf/eRAW/releases/tag/V0.9.0-rc.1",
            "https://github.com/woooooooooolf/eRAW/releases/tag/V0.9.0?login=required",
            "https://github.com/woooooooooolf/eRAW/releases/tag/latest",
            "https://github.com/woooooooooolf/eRAW/releases/tag/V01.2.3",
        ] {
            let transport = ScriptedTransport::new(vec![redirect(location)]);
            assert_eq!(
                discover_test(&transport, "0.8.0").unwrap_err().reason,
                FailureReason::InvalidResponse
            );
            assert_eq!(transport.requests.lock().unwrap().len(), 1);
        }
    }

    #[test]
    fn redirects_are_bounded_and_only_the_supported_repository_is_followed() {
        let transport =
            ScriptedTransport::new((0..MAX_REDIRECTS).map(|_| redirect(LATEST_URL)).collect());
        assert_eq!(
            discover_test(&transport, "0.8.0").unwrap_err().reason,
            FailureReason::InvalidResponse
        );
        assert_eq!(transport.requests.lock().unwrap().len(), MAX_REDIRECTS);
        let transport = ScriptedTransport::new(vec![
            redirect(&format!("{REPOSITORY_PATH}releases/stable")),
            redirect(&format!("{REPOSITORY_PATH}releases/tag/V0.8.0")),
        ]);
        assert_eq!(
            discover_test(&transport, "0.8.0").unwrap().0,
            UpdateResult::Current
        );
    }

    #[test]
    fn unconfirmed_assets_offer_only_the_verified_release_page() {
        for asset in [
            status(404),
            Headers {
                content_type: Some("text/html".into()),
                ..status(200)
            },
            redirect("https://attacker.invalid/file.zip"),
        ] {
            let transport = ScriptedTransport::new(vec![
                redirect(&format!("{REPOSITORY_PATH}releases/tag/V0.9.0")),
                asset,
            ]);
            let (result, target, _) = discover_test(&transport, "0.8.0").unwrap();
            assert!(matches!(
                result,
                UpdateResult::Available {
                    download_available: false,
                    ..
                }
            ));
            let target = target.unwrap();
            assert!(target.download.is_none());
            assert!(target.release.path().ends_with("V0.9.0"));
        }
    }

    #[test]
    fn blocked_network_has_a_total_deadline_and_does_not_block_other_runtime_work() {
        tauri::async_runtime::block_on(async {
            let transport = ScriptedTransport {
                delay: Duration::from_secs(30),
                ..ScriptedTransport::new(vec![status(500)])
            };
            let ticked = Arc::new(AtomicBool::new(false));
            let tick = ticked.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(2)).await;
                tick.store(true, Ordering::Release);
            });
            let start = Instant::now();
            let result = discover(
                &transport,
                &Version::parse("0.8.0").unwrap(),
                Some("windows-x64"),
                tokio::time::Instant::now() + Duration::from_millis(30),
            )
            .await;
            assert_eq!(result.unwrap_err().reason, FailureReason::Timeout);
            assert!(start.elapsed() < Duration::from_secs(2));
            assert!(ticked.load(Ordering::Acquire));
        });
    }

    #[test]
    fn server_rate_limit_cooldown_and_targets_are_process_memory_only() {
        let state = UpdateCheckState::default();
        assert_eq!(
            state.target_url(UpdateLink::Release).as_deref(),
            Some(LATEST_URL)
        );
        assert!(state.target_url(UpdateLink::Download).is_none());
        *state.cooldown.lock().unwrap() = Some(Instant::now() + Duration::from_secs(60));
        assert_eq!(
            tauri::async_runtime::block_on(perform_check(&state)),
            UpdateResult::Failed {
                reason: FailureReason::RateLimited
            }
        );
        assert!(!state.checking.load(Ordering::Acquire));
        assert!(
            UpdateCheckState::default()
                .cooldown
                .lock()
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn stalled_header_response_times_out_without_blocking_the_runtime() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (done, finish) = mpsc::channel();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut request = [0; 4096];
            let _ = socket.read(&mut request);
            let _ = finish.recv_timeout(Duration::from_secs(2));
        });
        tauri::async_runtime::block_on(async {
            let client = Client::builder()
                .no_proxy()
                .timeout(Duration::from_millis(60))
                .build()
                .unwrap();
            let start = Instant::now();
            let result = HttpTransport(client)
                .headers(
                    Method::HEAD,
                    &Url::parse(&format!("http://{address}/stall")).unwrap(),
                )
                .await;
            assert_eq!(result.err().unwrap().reason, FailureReason::Timeout);
            assert!(start.elapsed() < Duration::from_secs(2));
        });
        let _ = done.send(());
        server.join().unwrap();
    }

    #[test]
    fn native_transport_returns_headers_without_waiting_for_html_or_zip_body() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (done, finish) = mpsc::channel();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut request = [0; 4096];
            let _ = socket.read(&mut request);
            socket.write_all(b"HTTP/1.1 302 Found\r\nLocation: https://github.com/woooooooooolf/eRAW/releases/tag/V0.8.0\r\nContent-Length: 10000000\r\nConnection: close\r\n\r\n").unwrap();
            let _ = finish.recv_timeout(Duration::from_secs(2));
        });
        tauri::async_runtime::block_on(async {
            let client = Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(1))
                .build()
                .unwrap();
            let response = HttpTransport(client)
                .headers(
                    Method::GET,
                    &Url::parse(&format!("http://{address}/headers")).unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status, StatusCode::FOUND);
        });
        let _ = done.send(());
        server.join().unwrap();
    }
}
