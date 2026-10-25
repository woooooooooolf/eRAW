//! The CLI is an English, human-readable launch contract. It does not read GUI preferences.
use crate::commands::{DocumentInfo, PreparedDocument, prepare_document};
use crate::raw::{
    BitAlignment, CfaPattern, DisplayMode, Endianness, Packing, ProcessingSettings, RawDescriptor,
    unsupported_reorder_edges,
};
use std::{collections::BTreeMap, ffi::OsString, path::PathBuf};

pub const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
pub const SKILL: &str = include_str!("../../skill/eraw-viewer/SKILL.md");

pub const HELP: &str = r#"eRAW - RAW sensor data viewer

Usage:
  eRAW [OPTIONS] <FILE> --width <N> --height <N> --packing <FORMAT> --cfa <PATTERN>
  eRAW --check [OPTIONS] <FILE> --width <N> --height <N> --packing <FORMAT> --cfa <PATTERN>
  eRAW --help
  eRAW --skill
  eRAW --version

Without arguments, open the normal graphical viewer.
Each launch opens an independent viewer. FILE is relative to the caller's directory.

Required image parameters:
  --width <N>               Active pixels per row, 1..25000
  --height <N>              Active rows per frame, 1..20000
  --packing <FORMAT>       unpacked8, unpacked16, mipiRaw10, mipiRaw12, mipiRaw14
  --cfa <PATTERN>          MONO, RGGB, BGGR, GBRG, GRBG,
                           QRGGB, QBGGR, QGBRG, QGRBG
  --bit-depth <N>          Required for unpacked16 (8..16).
                           Otherwise inferred from packing; an explicit value must match.

Optional layout parameters (all offsets, alignments and strides are in bytes):
  --endianness <ORDER>     little (default) or big; unpacked16 only
  --bit-alignment <SIDE>   lsb (default) or msb; unpacked16 only
  --cfa-phase-x <N>        Quad CFA phase, 0..3 (default: 0)
  --cfa-phase-y <N>        Quad CFA phase, 0..3 (default: 0)
  --header-offset <N>      Offset to the first frame (default: 0)
  --row-alignment <N>      Row alignment, at least 1 (default: 1)
  --row-stride <N>         Explicit row stride; 0 derives it from alignment (default: 0)
  --frame-alignment <N>    Frame alignment, at least 1 (default: 1)
  --frame-stride <N>       Explicit frame stride; 0 derives it from alignment (default: 0)
                           A nonzero stride overrides its corresponding alignment.

Optional initial view:
  --frame <N>              One-based frame number (default: 1)
  --mode <MODE>            raw (default), cfa, remosaic, demosaic, red, green, blue
                           MONO supports raw only; remosaic requires Quad CFA.
  --view <VIEW>            fit (default) or actual
  --same-color-reconstruction <BOOL>
                           true or false (default: false); Quad CFA only

Control:
  --check                  Run preflight without creating a window or saving settings
  --skill                  Print the bundled English SKILL.md and exit; use alone
  -h, --help               Print this help and exit
  -V, --version            Print the application version and exit
  --                       End options; use before a file name that starts with '-'

Use --name VALUE or --name=VALUE. Options must not be repeated.
Numbers are unsigned decimal integers, at most 9007199254740991.
Partial frames and overlapping strides remain viewable and produce warnings.
Only-reorder processing can require pixels beyond the image edges; warnings do
not fail preflight. Processed export requires a supported crop or explicit reconstruction.
CLI values initialize this window only. Later user edits follow normal save settings.
Finish writing the source file before launch; keep it unchanged while viewing.

Exit status:
  0  Preflight passed (--check), help/skill/version printed, or viewer closed normally
  1  Viewer startup failed
  2  Invalid command-line arguments
  3  File or layout preflight failed

Preflight checks parameters, file access, mapping and layout. It does not prove
WebView2/WebGL availability, pixel correctness, or completed rendering.
A normal viewer stays running until closed; its exit status is not a ready signal.

Examples:
  eRAW result.raw --width 1920 --height 1080 --packing unpacked16 --bit-depth 12 --cfa RGGB --mode demosaic
  eRAW --check "capture 01.bin" --width 640 --height 480 --packing mipiRaw10 --cfa MONO
"#;

#[derive(Debug)]
pub struct CliError {
    pub exit_code: i32,
    pub message: String,
}

impl CliError {
    fn argument(message: impl Into<String>) -> Self {
        Self {
            exit_code: 2,
            message: message.into(),
        }
    }

    pub fn preflight(message: impl Into<String>) -> Self {
        Self {
            exit_code: 3,
            message: message.into(),
        }
    }

    pub fn report(&self) -> String {
        format!(
            "eRAW: {}\n\nRun 'eRAW --help' for supported formats and options.\n",
            self.message
        )
    }
}

#[derive(Debug)]
pub struct LaunchOptions {
    pub path: PathBuf,
    pub descriptor: RawDescriptor,
    /// Zero-based at the IPC boundary; the public CLI is one-based.
    pub frame: u64,
    pub mode: DisplayMode,
    pub view: String,
    pub processing: ProcessingSettings,
    pub check: bool,
}

#[derive(Debug)]
pub enum Action {
    Gui,
    Help,
    Skill,
    Version,
    Open(LaunchOptions),
}

const VALUE_OPTIONS: &[&str] = &[
    "width",
    "height",
    "packing",
    "cfa",
    "bit-depth",
    "endianness",
    "bit-alignment",
    "cfa-phase-x",
    "cfa-phase-y",
    "header-offset",
    "row-alignment",
    "row-stride",
    "frame-alignment",
    "frame-stride",
    "frame",
    "mode",
    "view",
    "same-color-reconstruction",
];

fn integer(name: &str, value: &str, min: u64, max: u64) -> Result<u64, CliError> {
    if value.is_empty() || !value.bytes().all(|c| c.is_ascii_digit()) {
        return Err(CliError::argument(format!(
            "invalid value '{value}' for '--{name}'.\n  Expected a decimal integer in {min}..{max}."
        )));
    }
    value
        .parse::<u64>()
        .ok()
        .filter(|n| (min..=max).contains(n))
        .ok_or_else(|| {
            CliError::argument(format!(
                "value '{value}' for '--{name}' is out of range.\n  Expected {min}..{max}."
            ))
        })
}

fn enum_value<T: serde::de::DeserializeOwned>(
    name: &str,
    value: &str,
    allowed: &str,
) -> Result<T, CliError> {
    serde_json::from_value(serde_json::Value::String(value.to_owned())).map_err(|_| {
        CliError::argument(format!(
            "invalid value '{value}' for '--{name}'.\n  Supported values: {allowed}."
        ))
    })
}

pub fn parse(args: impl IntoIterator<Item = OsString>) -> Result<Action, CliError> {
    let args: Vec<OsString> = args.into_iter().collect();
    if args.is_empty() {
        return Ok(Action::Gui);
    }
    if args.len() == 1 {
        match args[0].to_str() {
            Some("--help" | "-h") => return Ok(Action::Help),
            Some("--skill") => return Ok(Action::Skill),
            Some("--version" | "-V") => return Ok(Action::Version),
            _ => {}
        }
    }
    let mut values = BTreeMap::new();
    let mut path = None;
    let mut check = false;
    let mut end_options = false;
    let mut i = 0;
    while i < args.len() {
        let arg = &args[i];
        let text = arg.to_str().ok_or_else(|| {
            CliError::argument(
                "arguments must be valid Unicode; rename the file or use a Unicode path.",
            )
        })?;
        if !end_options && text == "--" {
            end_options = true;
            i += 1;
            continue;
        }
        if !end_options && matches!(text, "--skill" | "--help" | "-h" | "--version" | "-V") {
            return Err(CliError::argument(format!(
                "option '{text}' must be used alone.\n  Remove the input file and other options for this query."
            )));
        }
        if !end_options && text == "--check" {
            if check {
                return Err(CliError::argument("option '--check' must not be repeated."));
            }
            check = true;
        } else if !end_options && text.starts_with('-') {
            let (name, inline) = text
                .strip_prefix("--")
                .unwrap_or(text)
                .split_once('=')
                .map(|(a, b)| (a, Some(b)))
                .unwrap_or((text.strip_prefix("--").unwrap_or(text), None));
            if !VALUE_OPTIONS.contains(&name) {
                return Err(CliError::argument(format!(
                    "unknown option '{text}'.\n  Use '--help' alone for the full option list."
                )));
            }
            let value = match inline {
                Some(v) => v.to_owned(),
                None => {
                    i += 1;
                    let next = args
                        .get(i)
                        .and_then(|v| v.to_str())
                        .filter(|v| !v.starts_with("--"));
                    next.ok_or_else(|| {
                        CliError::argument(format!("missing value for '--{name}'."))
                    })?
                    .to_owned()
                }
            };
            if values.insert(name.to_owned(), value).is_some() {
                return Err(CliError::argument(format!(
                    "option '--{name}' must not be repeated."
                )));
            }
        } else if path.replace(PathBuf::from(arg)).is_some() {
            return Err(CliError::argument(
                "only one input file is supported per launch.",
            ));
        }
        i += 1;
    }
    let path = path.ok_or_else(|| {
        CliError::argument("missing input file.\n  Supply one RAW or binary file path.")
    })?;
    for required in ["width", "height", "packing", "cfa"] {
        if !values.contains_key(required) {
            return Err(CliError::argument(format!(
                "missing required option '--{required}'.\n  RAW files do not describe their own image format."
            )));
        }
    }
    let get = |name: &str, default: &str| {
        values
            .get(name)
            .cloned()
            .unwrap_or_else(|| default.to_owned())
    };
    let number = |name: &str, default: &str, min, max| integer(name, &get(name, default), min, max);
    let packing: Packing = enum_value(
        "packing",
        &values["packing"],
        "unpacked8, unpacked16, mipiRaw10, mipiRaw12, mipiRaw14",
    )?;
    let fixed_depth = match packing {
        Packing::Unpacked8 => Some(8),
        Packing::Unpacked16 => None,
        Packing::MipiRaw10 => Some(10),
        Packing::MipiRaw12 => Some(12),
        Packing::MipiRaw14 => Some(14),
    };
    if fixed_depth.is_none() && !values.contains_key("bit-depth") {
        return Err(CliError::argument(
            "missing '--bit-depth' for '--packing unpacked16'.\n  Supply the effective DN bit depth, from 8 to 16.",
        ));
    }
    let bit_depth = number("bit-depth", &fixed_depth.unwrap_or(10).to_string(), 8, 16)? as u8;
    if let Some(required) = fixed_depth {
        if bit_depth != required {
            return Err(CliError::argument(format!(
                "incompatible parameters.\n  --packing {} requires a bit depth of {required}.\n  Received: --bit-depth {bit_depth}\n\nFix:\n  Use --bit-depth {required}, or select a compatible packing.",
                values["packing"]
            )));
        }
        for name in ["endianness", "bit-alignment"] {
            if values.contains_key(name) {
                return Err(CliError::argument(format!(
                    "'--{name}' applies to unpacked16 only.\n  Remove this option for the selected packing."
                )));
            }
        }
    }
    let cfa: CfaPattern = enum_value(
        "cfa",
        &values["cfa"],
        "MONO, RGGB, BGGR, GBRG, GRBG, QRGGB, QBGGR, QGBRG, QGRBG",
    )?;
    let quad = matches!(
        cfa,
        CfaPattern::Qrggb | CfaPattern::Qbggr | CfaPattern::Qgbrg | CfaPattern::Qgrbg
    );
    let phase_x = number("cfa-phase-x", "0", 0, 3)? as u8;
    let phase_y = number("cfa-phase-y", "0", 0, 3)? as u8;
    if !quad && (phase_x != 0 || phase_y != 0 || values.contains_key("same-color-reconstruction")) {
        return Err(CliError::argument(
            "CFA phase offsets and '--same-color-reconstruction' require Quad CFA.",
        ));
    }
    let mode_text = get("mode", "raw");
    let mode: DisplayMode = enum_value(
        "mode",
        if mode_text == "cfa" {
            "bayer"
        } else {
            &mode_text
        },
        "raw, cfa, remosaic, demosaic, red, green, blue",
    )?;
    if mode_text == "bayer" {
        return Err(CliError::argument(
            "use '--mode cfa' for the CFA mosaic view.",
        ));
    }
    if matches!(cfa, CfaPattern::Mono) && !matches!(mode, DisplayMode::Raw) {
        return Err(CliError::argument("MONO supports '--mode raw' only."));
    }
    if matches!(mode, DisplayMode::Remosaic) && !quad {
        return Err(CliError::argument("'--mode remosaic' requires Quad CFA."));
    }
    let view = get("view", "fit");
    if view != "fit" && view != "actual" {
        return Err(CliError::argument(format!(
            "invalid value '{view}' for '--view'.\n  Supported values: fit, actual."
        )));
    }
    let reconstruct = get("same-color-reconstruction", "false");
    let mut processing = ProcessingSettings::default();
    processing.remosaic.same_color_reconstruction = match reconstruct.as_str() {
        "true" => true,
        "false" => false,
        _ => {
            return Err(CliError::argument(
                "'--same-color-reconstruction' requires true or false.",
            ));
        }
    };
    Ok(Action::Open(LaunchOptions {
        path,
        descriptor: RawDescriptor {
            width: number("width", "0", 1, 25_000)? as u32,
            height: number("height", "0", 1, 20_000)? as u32,
            packing,
            cfa,
            bit_depth,
            endianness: enum_value::<Endianness>(
                "endianness",
                &get("endianness", "little"),
                "little, big",
            )?,
            bit_alignment: enum_value::<BitAlignment>(
                "bit-alignment",
                &get("bit-alignment", "lsb"),
                "lsb, msb",
            )?,
            cfa_phase_x: phase_x,
            cfa_phase_y: phase_y,
            header_offset: number("header-offset", "0", 0, MAX_SAFE_INTEGER)?,
            row_alignment: number("row-alignment", "1", 1, MAX_SAFE_INTEGER)?,
            row_stride: number("row-stride", "0", 0, MAX_SAFE_INTEGER)?,
            frame_alignment: number("frame-alignment", "1", 1, MAX_SAFE_INTEGER)?,
            frame_stride: number("frame-stride", "0", 0, MAX_SAFE_INTEGER)?,
        },
        frame: number("frame", "1", 1, MAX_SAFE_INTEGER)? - 1,
        mode,
        view,
        processing,
        check,
    }))
}

pub(crate) fn preflight(options: &LaunchOptions) -> Result<PreparedDocument, CliError> {
    let path = std::path::absolute(&options.path).map_err(|_| {
        CliError::preflight(
            "cannot resolve the input path.\n  Check the caller's working directory.",
        )
    })?;
    let path = path
        .to_str()
        .ok_or_else(|| CliError::preflight("the input path must be valid Unicode."))?;
    let prepared = prepare_document(path.to_owned(), options.descriptor.clone()).map_err(|error| {
        let reason = match error.code {
            "file_open_failed" => "cannot open the input file. Check the path, permissions, and whether it is a regular file.",
            "file_metadata_failed" => "cannot read input file metadata.",
            "file_map_failed" => "cannot map the input file. Check available address space and file access.",
            _ => "cannot prepare the input document.",
        };
        let mut detail = format!("{reason}\n  File: {path}\n  Code: {}", error.code);
        if let Some(kind) = error.arguments.get("ioKind").and_then(|v| v.as_str()) {
            detail.push_str(&format!("\n  I/O kind: {kind}"));
        }
        if let Some(code) = error.arguments.get("osCode") { detail.push_str(&format!("\n  OS code: {code}")); }
        CliError::preflight(detail)
    })?;
    validate_layout(&prepared.info(), options.frame)?;
    Ok(prepared)
}

fn validate_layout(info: &DocumentInfo, frame: u64) -> Result<(), CliError> {
    let layout = &info.layout;
    if info.file_size == 0
        || info.descriptor.header_offset >= info.file_size
        || layout.frame_count == 0
    {
        return Err(CliError::preflight(
            "no image data is available at the requested header offset.\n  Check the file size, header offset, and frame layout.",
        ));
    }
    // Keep every byte count exact across the Rust/JavaScript IPC boundary.
    let frame_bytes = layout
        .row_stride
        .checked_mul(u64::from(info.descriptor.height));
    if frame_bytes.is_none_or(|value| value > MAX_SAFE_INTEGER)
        || [
            info.file_size,
            layout.row_bytes,
            layout.row_stride,
            layout.frame_bytes,
            layout.frame_stride,
            layout.frame_count,
        ]
        .iter()
        .any(|value| *value > MAX_SAFE_INTEGER)
    {
        return Err(CliError::preflight(
            "file or computed layout exceeds the exact integer range.\n  Reduce strides or alignments; byte counts must not exceed 9007199254740991.",
        ));
    }
    if frame >= layout.frame_count {
        return Err(CliError::preflight(format!(
            "requested frame {} is outside the available range 1..{}.\n  Use a valid '--frame' value or correct the layout parameters.",
            frame + 1,
            layout.frame_count
        )));
    }
    Ok(())
}

pub(crate) fn preflight_report(info: &DocumentInfo, options: &LaunchOptions) -> String {
    let d = &info.descriptor;
    let packing = serde_json::to_value(d.packing).expect("packing enum");
    let cfa = serde_json::to_value(d.cfa).expect("CFA enum");
    let mut report = format!(
        "eRAW: Preflight passed\n\n  File:             {}\n  File size:        {} bytes\n  Image:            {} x {} pixels\n  Packing:          {}\n  Bit depth:        {}\n  CFA:              {}\n  Header offset:    {} bytes\n  Row stride:       {} bytes\n  Frame stride:     {} bytes\n  Complete frames:  {}\n  Viewable frames:  {}\n  Initial frame:    {}\n",
        info.path,
        info.file_size,
        d.width,
        d.height,
        packing.as_str().unwrap_or(""),
        d.bit_depth,
        cfa.as_str().unwrap_or(""),
        d.header_offset,
        info.layout.row_stride,
        info.layout.frame_stride,
        info.layout.complete_frame_count,
        info.layout.frame_count,
        options.frame + 1,
    );
    if matches!(d.packing, Packing::Unpacked16) {
        report.push_str(&format!(
            "  Endianness:       {}\n  Bit alignment:    {}\n",
            if d.endianness == Endianness::Little {
                "little"
            } else {
                "big"
            },
            if d.bit_alignment == BitAlignment::Lsb {
                "lsb"
            } else {
                "msb"
            }
        ));
    }
    if matches!(
        d.cfa,
        CfaPattern::Qrggb | CfaPattern::Qbggr | CfaPattern::Qgbrg | CfaPattern::Qgrbg
    ) {
        report.push_str(&format!(
            "  CFA phase:        X {} / Y {}\n  Same-color reconstruction: {}\n",
            d.cfa_phase_x, d.cfa_phase_y, options.processing.remosaic.same_color_reconstruction
        ));
    }
    let mode = serde_json::to_value(options.mode).expect("display mode enum");
    let mode = if matches!(options.mode, DisplayMode::Bayer) {
        "cfa"
    } else {
        mode.as_str().unwrap_or("")
    };
    report.push_str(&format!(
        "  Initial mode:     {mode}\n  Initial view:     {}\n",
        options.view
    ));
    let edges = unsupported_reorder_edges(
        d,
        options.processing,
        options.mode,
        (0, 0, d.width, d.height),
    );
    if !edges.is_empty() {
        report.push_str(&format!("\n  Warning [remosaic_boundary]: Only-reorder processing needs pixels beyond the {} edge(s).\n    Viewing remains available. Processed export requires an interior crop or explicit same-color reconstruction.\n", edges.join(", ")));
    }
    for warning in &info.warnings {
        let explanation = match warning.code {
            "short_row_stride" => "Row stride is smaller than the active row size; rows overlap.",
            "short_frame_stride" => "Frame stride is smaller than the frame size; frames overlap.",
            "partial_first_frame" => "The first frame is incomplete; missing pixels remain marked.",
            "partial_last_frame" => "The last frame is incomplete; missing pixels remain marked.",
            "multiple_frames" => "The file contains multiple viewable frames.",
            _ => "The layout has a diagnostic; inspect it in the viewer.",
        };
        report.push_str(&format!(
            "\n  {} [{}]: {explanation}",
            if warning.code == "multiple_frames" {
                "Info"
            } else {
                "Warning"
            },
            warning.code
        ));
    }
    report.push_str(
        "\n\nPreflight does not validate pixel content or confirm completed rendering.\n",
    );
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    fn parse_text(args: &str) -> Result<Action, CliError> {
        parse(args.split_whitespace().map(OsString::from))
    }
    const BASE: &str = "capture.raw --width 4 --height 2 --packing mipiRaw10 --cfa RGGB";

    #[test]
    fn defaults_are_deterministic_and_frame_is_converted_once() {
        let Action::Open(value) = parse_text(&format!("{BASE} --frame 2 --mode cfa")).unwrap()
        else {
            panic!()
        };
        assert_eq!(value.descriptor.bit_depth, 10);
        assert_eq!(value.descriptor.row_alignment, 1);
        assert_eq!(value.frame, 1);
        assert!(matches!(value.mode, DisplayMode::Bayer));
        assert!(!value.processing.remosaic.same_color_reconstruction);
    }

    #[test]
    fn errors_explain_missing_conflicting_and_unknown_parameters() {
        for (suffix, text) in [
            ("--bit-depth 12", "requires a bit depth of 10"),
            ("--width 8", "must not be repeated"),
            ("--frame 0", "out of range"),
            ("--height=1.5", "must not be repeated"),
            ("--frame 9007199254740992", "out of range"),
            ("--endianness big", "unpacked16 only"),
            ("--unknown 4", "unknown option"),
            ("--mode", "missing value"),
        ] {
            let error = parse_text(&format!("{BASE} {suffix}")).unwrap_err();
            assert_eq!(error.exit_code, 2);
            assert!(error.report().contains(text), "{}", error.report());
        }
        assert!(parse_text("a.raw").unwrap_err().message.contains("--width"));
        assert!(
            parse_text("a.raw --width 4 --height 2 --packing unpacked16 --cfa MONO")
                .unwrap_err()
                .message
                .contains("--bit-depth")
        );
    }

    #[test]
    fn cfa_mode_and_phase_require_compatible_sources() {
        assert!(parse_text(&format!("{BASE} --mode remosaic")).is_err());
        assert!(parse_text(&format!("{BASE} --cfa-phase-x 1")).is_err());
        assert!(parse_text(&format!("{} --mode demosaic", BASE.replace("RGGB", "MONO"))).is_err());
        let Action::Open(value) = parse_text(&format!(
            "{} --cfa-phase-x 3 --same-color-reconstruction true --mode demosaic",
            BASE.replace("RGGB", "QRGGB")
        ))
        .unwrap() else {
            panic!()
        };
        assert!(value.processing.remosaic.same_color_reconstruction);
    }

    #[test]
    fn paths_accept_unicode_spaces_equals_and_option_termination() {
        let args = [
            "--width=4",
            "--height=2",
            "--packing=unpacked8",
            "--cfa=MONO",
            "--check",
            "--",
            "-图像 = 1.bin",
        ];
        let Action::Open(value) = parse(args.into_iter().map(OsString::from)).unwrap() else {
            panic!()
        };
        assert_eq!(value.path, PathBuf::from("-图像 = 1.bin"));
        assert!(value.check);
        assert_eq!(value.descriptor.bit_depth, 8);
    }

    #[test]
    fn control_actions_do_not_require_image_parameters() {
        assert!(matches!(parse_text("").unwrap(), Action::Gui));
        assert!(matches!(parse_text("--help").unwrap(), Action::Help));
        assert!(matches!(parse_text("--skill").unwrap(), Action::Skill));
        assert!(parse_text("--skill --check").is_err());
        assert!(matches!(parse_text("-V").unwrap(), Action::Version));
    }

    struct InputFile(PathBuf);
    impl InputFile {
        fn new(data: &[u8]) -> Self {
            use std::sync::atomic::{AtomicU64, Ordering};
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "eraw-cli-{}-{}.bin",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::write(&path, data).unwrap();
            Self(path)
        }
        fn options(&self) -> LaunchOptions {
            let Action::Open(mut options) =
                parse_text("input.bin --width 4 --height 2 --packing unpacked8 --cfa MONO")
                    .unwrap()
            else {
                panic!()
            };
            options.path = self.0.clone();
            options
        }
    }
    impl Drop for InputFile {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    #[test]
    fn preflight_preserves_partial_frames_and_english_diagnostics() {
        let input = InputFile::new(&[1, 2, 3, 4, 5, 6, 7]);
        let options = input.options();
        let prepared = preflight(&options).unwrap();
        let info = prepared.info();
        assert_eq!(info.layout.frame_count, 1);
        assert_eq!(info.layout.complete_frame_count, 0);
        let report = preflight_report(&info, &options);
        assert!(report.contains("Preflight passed"));
        assert!(report.contains("Warning [partial_first_frame]"));
        assert!(report.contains("Initial mode:     raw"));
        assert!(report.contains("Initial view:     fit"));
        assert!(!report.contains("文件"));
        let state = crate::commands::AppState::default();
        let installed = state.install_prepared(prepared).unwrap();
        assert_eq!(installed.path, info.path);
        assert_eq!(installed.file_size, 7);
    }

    #[test]
    fn preflight_rejects_empty_missing_files_frames_offsets_and_unsafe_layouts() {
        let input = InputFile::new(&[0; 8]);
        for change in ["frame", "offset", "stride", "missing", "directory"] {
            let mut options = input.options();
            match change {
                "frame" => options.frame = 1,
                "offset" => options.descriptor.header_offset = 8,
                "stride" => options.descriptor.row_stride = MAX_SAFE_INTEGER,
                "missing" => {
                    options.path.set_extension("missing");
                }
                "directory" => options.path = std::env::temp_dir(),
                _ => unreachable!(),
            }
            let Err(error) = preflight(&options) else {
                panic!("accepted {change}")
            };
            assert_eq!(error.exit_code, 3);
        }
        let empty = InputFile::new(&[]);
        assert!(preflight(&empty.options()).is_err());
    }

    #[test]
    fn all_packings_and_container_fields_respect_the_public_contract() {
        for (packing, depth) in [
            ("unpacked8", 8),
            ("mipiRaw10", 10),
            ("mipiRaw12", 12),
            ("mipiRaw14", 14),
        ] {
            let Action::Open(options) = parse_text(&BASE.replace("mipiRaw10", packing)).unwrap()
            else {
                panic!()
            };
            assert_eq!(options.descriptor.bit_depth, depth);
        }
        let Action::Open(options) = parse_text(&format!("{} --bit-depth 13 --endianness big --bit-alignment msb --row-stride 32 --frame-stride 80 --header-offset 4 --view actual", BASE.replace("mipiRaw10", "unpacked16"))).unwrap() else { panic!() };
        assert_eq!(options.descriptor.bit_depth, 13);
        assert_eq!(options.descriptor.endianness, Endianness::Big);
        assert_eq!(options.descriptor.bit_alignment, BitAlignment::Msb);
        assert_eq!(options.descriptor.row_stride, 32);
        assert_eq!(options.view, "actual");
        for value in ["-1", "1.5", "NaN", "0", "25001"] {
            assert!(parse_text(&BASE.replace("--width 4", &format!("--width {value}"))).is_err());
        }
    }
}
