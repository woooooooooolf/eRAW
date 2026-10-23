# Command-line interface

eRAW can open a RAW sensor image from a terminal, script, or AI tool. Each invocation
starts an independent viewer. No background service or single-instance routing is
required. Launch without arguments to use the normal graphical workflow.

All CLI help, parameter descriptions, errors, and preflight feedback are English,
regardless of the interface language. Paths retain their original Unicode text.
Output is plain text, intended for both people and tools; no ANSI formatting or
JSON parsing is required. Run the actual executable from the release package;
its filename may include the release version.

## Examples

The examples use `eRAW.exe` as a placeholder for the executable filename.

```powershell
# Display a 12-bit Bayer image stored in 16-bit little-endian containers.
& 'D:\Tools\eRAW.exe' 'D:\output\result.raw' `
  --width 1920 --height 1080 --packing unpacked16 --bit-depth 12 `
  --cfa RGGB --endianness little --bit-alignment lsb --mode demosaic

# Check a packed MONO capture without opening a window.
& 'D:\Tools\eRAW.exe' --check 'D:\output\capture 01.bin' `
  --width 640 --height 480 --packing mipiRaw10 --cfa MONO

# Show the second frame of a Quad CFA file at actual pixel size.
& 'D:\Tools\eRAW.exe' 'D:\output\quad.raw' `
  --width 1920 --height 1080 --packing mipiRaw14 --cfa QRGGB `
  --cfa-phase-x 1 --cfa-phase-y 2 --frame 2 --mode demosaic `
  --same-color-reconstruction true --view actual
```

AI callers should pass an executable path and a list of arguments through their
process API (for example, Python `subprocess.Popen([...])`), rather than interpolate
an unescaped shell command. Finish writing and close the output file before launch;
keep its contents unchanged while eRAW holds a read-only mapping. Release the mapping
with **Close file / Ctrl+W**, or close the viewer, before replacing the source.

## Parameters

Pass exactly one file. Its extension is not used to guess its image format. Relative
paths are resolved against the caller's working directory, not the EXE directory.
Use `--name VALUE` or `--name=VALUE`; repeated options are errors. Values are
case-sensitive. Put `--` before a positional filename that starts with `-`.
Numbers must be unsigned decimal integers; byte counts must not exceed
`9007199254740991`, the exact integer limit shared by Rust and JavaScript.

| Option | Contract |
| --- | --- |
| `--width`, `--height` | Required active dimensions: width 1–25000, height 1–20000 |
| `--packing` | Required: `unpacked8`, `unpacked16`, `mipiRaw10`, `mipiRaw12`, `mipiRaw14` |
| `--bit-depth` | Required for `unpacked16`: 8–16. Other packings infer 8/10/12/14; an explicit value must match |
| `--cfa` | Required: `MONO`, `RGGB`, `BGGR`, `GBRG`, `GRBG`, `QRGGB`, `QBGGR`, `QGBRG`, `QGRBG` |
| `--endianness` | `little` (default), `big`; accepted for `unpacked16` only |
| `--bit-alignment` | `lsb` (default), `msb`; accepted for `unpacked16` only; equivalent at 16 bits |
| `--cfa-phase-x`, `--cfa-phase-y` | 0–3, default 0; nonzero offsets require Quad CFA |
| `--header-offset` | Byte offset to the first frame, default 0 |
| `--row-alignment`, `--frame-alignment` | Byte alignment, at least 1, default 1 |
| `--row-stride`, `--frame-stride` | Explicit byte strides, default 0; 0 derives the stride from alignment, nonzero overrides alignment |
| `--frame` | One-based initial frame, default 1; must be within the computed viewable frame count |
| `--mode` | `raw` (default), `cfa`, `remosaic`, `demosaic`, `red`, `green`, `blue`; MONO supports `raw` only; `remosaic` requires Quad CFA |
| `--view` | `fit` (default), `actual` |
| `--same-color-reconstruction` | `true` or `false` (default); accepted for Quad CFA only |
| `--check` | Run the same file/layout preflight, print its result, and exit without a window |
| `-h`, `--help` | Print help and exit; use alone |
| `-V`, `--version` | Print the application version and exit; use alone |

The internal display-mode name `bayer` is exposed as `cfa` in the CLI, including
Quad CFA. Supported input data is single-channel MONO/Bayer/Quad CFA sensor RAW.
RGB48 export support does not imply RGB-interleaved input support. See
[RAW_FORMAT.md](RAW_FORMAT.md) for decoding and layout semantics.

## Preflight and feedback

Both a normal CLI launch and `--check` validate arguments, open the input, read file
metadata, establish a read-only mapping, and calculate the layout before creating
a window. They do not scan image pixels. A normal launch transfers the prepared
mapping to the existing document session and sends its descriptor, initial frame,
mode, processing configuration, and view to the main frontend once it is ready.
The file is not reopened for that transfer.

Explicit invalid parameters are rejected, rather than silently truncated, clamped,
or recovered from previously saved settings. Empty files, header offsets with no
remaining data, unsafe computed byte counts, and out-of-range initial frames fail
preflight. This is a CLI launch policy; the existing GUI retains its exploratory
viewing behavior.

Short data, an incomplete last frame, and overlapping row/frame strides remain
viewable, with English diagnostics in the preflight report and normal localized
diagnostics in the viewer. Frame count includes a partial last frame.

```text
eRAW: Preflight passed

  File:             D:\output\capture.bin
  File size:        7 bytes
  Image:            4 x 2 pixels
  Packing:          unpacked8
  Bit depth:        8
  CFA:              MONO
  Header offset:    0 bytes
  Row stride:       4 bytes
  Frame stride:     8 bytes
  Complete frames:  0
  Viewable frames:  1
  Initial frame:    1
  Initial mode:     raw
  Initial view:     fit

  Warning [partial_first_frame]: The first frame is incomplete; missing pixels remain marked.

Preflight does not validate pixel content or confirm completed rendering.
```

Argument errors name the problematic option and describe the accepted range or a
correction. File errors include a stable error code, an English I/O kind and, when
available, the numeric OS error code. Localized OS error prose is not printed.

| Exit status | Meaning |
| --- | --- |
| 0 | `--check` passed, help/version printed, or the viewer closed normally |
| 1 | Viewer startup or document-session initialization failed |
| 2 | Invalid arguments |
| 3 | File or layout preflight failed |

Help and successful reports go to stdout; errors go to stderr. On Windows, the
Release EXE preserves inherited redirected streams and attempts to attach to the
calling console. It does not create an extra console window when launched normally.
Callers that need reliable output capture and exit status should use a process API
with redirected streams. A shell may return immediately for a GUI executable.

Preflight success does not prove WebView2/WebGL availability, image correctness,
completed rendering, or user acceptance. A successful normal launch stays running
until the user closes it; its process exit is not a readiness signal. `--check`
does not initialize WebView2. If a caller runs `--check` and then starts the viewer,
the viewer checks the file again, since it may have changed between invocations.

## Settings and multiple instances

CLI decoding and processing defaults are fixed and independent of saved GUI
preferences. Initial CLI values apply to that window only and are not automatically
saved. Black/white points and exposure start at the normal full range and 0 EV.
Interface preferences such as language and theme still use the user's saved values.

After opening, user operations follow the normal GUI workflow. User edits to RAW
parameters save the complete descriptor when **Remember RAW parameters** is enabled;
changing an unrelated setting does not save the injected initial descriptor.
Explicitly enabling that switch saves the current descriptor, and disabling it
removes the remembered descriptor. User changes to processing options save normally.

Instances share defaults, but keep independent files, descriptors, frames and
viewports. The last user save of a complete RAW descriptor or processing group wins
for future launches; it never reconfigures another instance's open document.
Application preferences are saved per changed field, so a stale window changing
sidebar width does not overwrite another window's theme. The last save of the same
field wins. Statistics view state remains a related presentation group and uses the
last save of that group. Existing windows do not automatically adopt external saves.
Legacy whole-object preferences remain a read fallback without a destructive
migration. Older application versions do not read the new per-field preference keys.

## Validation

CLI parsing, semantic conflicts, preflight boundaries, partial frames and prepared
document installation are covered by Rust tests. `npm.cmd run test:cli` runs bounded
process tests against the already-built Release executable, including inherited
stdout/stderr, Unicode/space paths, relative paths and exit statuses. It does not
start a development server or open a GUI. Build the executable first:

```powershell
npm.cmd run release
npm.cmd run test:cli
```

Windows is the validated target. Portable parsing and non-Windows console handling
remain platform-neutral; this iteration does not establish Linux desktop support.
