mod analysis;
mod cli;
mod commands;
mod console;
mod raw;

use commands::{
    AppState, analyze_raw_image, calculate_raw_display_range, cancel_raw_analysis,
    cancel_raw_display_range, cancel_raw_export, close_document, export_document,
    inspect_raw_pixels, open_document, open_project_repository, render_raw_tile, sample_raw_pixel,
    save_png, update_descriptor,
};
use serde::Serialize;
use std::{
    io::{self, Write},
    sync::Mutex,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupDocument {
    document: commands::DocumentInfo,
    frame: u64,
    mode: raw::DisplayMode,
    view: String,
    processing: raw::ProcessingSettings,
}

#[derive(Default)]
struct StartupState(Mutex<Option<StartupDocument>>);

#[tauri::command]
fn take_startup_document(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, StartupState>,
) -> Result<Option<StartupDocument>, commands::CommandError> {
    if window.label() != "main" {
        return Ok(None);
    }
    state
        .0
        .lock()
        .map(|mut value| value.take())
        .map_err(|_| commands::CommandError::new("document_session_poisoned"))
}

fn print_output(message: &str, error: bool) {
    // A missing/broken caller pipe must not panic or prevent the viewer from opening.
    if error {
        let _ = io::stderr().lock().write_all(message.as_bytes());
    } else {
        let _ = io::stdout().lock().write_all(message.as_bytes());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if !args.is_empty() {
        console::attach();
    }
    let action = match cli::parse(args) {
        Ok(value) => value,
        Err(error) => {
            print_output(&error.report(), true);
            std::process::exit(error.exit_code);
        }
    };
    let app_state = AppState::default();
    let mut startup = None;
    match action {
        cli::Action::Help => {
            print_output(cli::HELP, false);
            return;
        }
        cli::Action::Skill => {
            print_output(cli::SKILL, false);
            return;
        }
        cli::Action::Version => {
            print_output(&format!("eRAW {}\n", env!("CARGO_PKG_VERSION")), false);
            return;
        }
        cli::Action::Gui => {}
        cli::Action::Open(options) => {
            let prepared = match cli::preflight(&options) {
                Ok(value) => value,
                Err(error) => {
                    print_output(&error.report(), true);
                    std::process::exit(error.exit_code);
                }
            };
            print_output(&cli::preflight_report(&prepared.info(), &options), false);
            if options.check {
                return;
            }
            let document = match app_state.install_prepared(prepared) {
                Ok(value) => value,
                Err(_) => {
                    print_output("eRAW: cannot initialize the document session.\n", true);
                    std::process::exit(1);
                }
            };
            startup = Some(StartupDocument {
                document,
                frame: options.frame,
                mode: options.mode,
                view: options.view,
                processing: options.processing,
            });
        }
    }
    tauri::Builder::default()
        .manage(app_state)
        .manage(StartupState(Mutex::new(startup)))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::Builder::new().open_js_links_on_click(false).build())
        .invoke_handler(tauri::generate_handler![
            take_startup_document,
            open_project_repository,
            open_document,
            update_descriptor,
            close_document,
            render_raw_tile,
            inspect_raw_pixels,
            analyze_raw_image,
            cancel_raw_analysis,
            calculate_raw_display_range,
            cancel_raw_display_range,
            cancel_raw_export,
            sample_raw_pixel,
            export_document,
            save_png,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|_| {
            print_output("eRAW: viewer startup failed.\n  Check WebView2, the desktop session, and graphics support.\n", true);
            std::process::exit(1);
        });
}
