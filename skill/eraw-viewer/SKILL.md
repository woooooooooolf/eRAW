---
name: eraw-viewer
description: Display MONO, Bayer, or Quad CFA sensor RAW files with eRAW from a script or AI workflow. Use for opening generated RAW results with explicit image parameters and correcting CLI errors; not for camera RAW containers or RGB-interleaved input.
---

# Display sensor RAW with eRAW

Use an existing eRAW executable to present a RAW result to the user. This skill is
self-contained and ships inside the executable; no repository files, plugins, or
network access are needed. It describes viewing, not automated image export.

## Choose the input contract

- Obtain the executable path from the user or the local deployment. Release
  filenames may include a version; `eRAW.exe` below is a placeholder. Query that
  executable with `--help` or `--version` when needed.
- Take width, height, packing, effective bit depth, CFA, offsets and strides from
  the producing pipeline or known capture metadata. Ask for missing essentials;
  do not guess a format from the filename, extension, file size, or a plausible image.
- Finish writing and close the input before viewing. Keep it unchanged while
  eRAW maps it. The user can release it with **Close file / Ctrl+W** or by closing
  the viewer before the pipeline replaces the source.

Required options are `--width`, `--height`, `--packing`, and `--cfa`.
`unpacked16` also requires `--bit-depth` (8..16). Other packings infer their fixed
bit depth; an explicit depth must match.

| Input | CLI values |
| --- | --- |
| Packing | `unpacked8`, `unpacked16`, `mipiRaw10`, `mipiRaw12`, `mipiRaw14` |
| CFA | `MONO`, `RGGB`, `BGGR`, `GBRG`, `GRBG`, `QRGGB`, `QBGGR`, `QGBRG`, `QGRBG` |
| Unpacked16 container | `--endianness little` or `--endianness big`; `--bit-alignment lsb` or `--bit-alignment msb`. Defaults: little, lsb. Omit both options for other packings |
| Quad CFA phase | `--cfa-phase-x 0..3`, `--cfa-phase-y 0..3`; default: 0 |
| Byte layout | `--header-offset`, `--row-alignment`, `--row-stride`, `--frame-alignment`, `--frame-stride` |
| Initial view | `--frame` is one-based, default 1; `--view fit` or `--view actual`, default fit |
| Display mode | `--mode` accepts `raw`, `cfa`, `remosaic`, `demosaic`, `red`, `green`, `blue`; default raw |

Dimensions are limited to width 1..25000 and height 1..20000. Layout values are
bytes: offsets/strides default to 0, alignments to 1. A zero stride is derived from
alignment; a nonzero stride overrides it. Numbers are unsigned decimal integers
within 9007199254740991. Values are case-sensitive and options cannot be repeated.
Relative paths use the caller's working directory. Use `--` before a positional
filename that starts with `-`.

MONO supports `raw` only. Use `cfa` for either Bayer or Quad CFA mosaics. Color
sources support `demosaic` and the reconstructed `red`, `green`, `blue` channels.
`remosaic` requires Quad CFA. For Quad CFA, optionally set
`--same-color-reconstruction true` (default false); it also affects Demosaic.
Only-reorder processing can require pixels outside the image for some dimensions
and phases. A processing-boundary warning is distinct from missing source bytes;
preflight can still exit 0. Related processed exports reject unsupported ranges.
Choose an interior export crop or explicitly enable same-color reconstruction
when appropriate; do not change parameters without a metadata-supported reason.
Reconstruction interpolates and is not a lossless permutation.

RGB-interleaved files and camera containers such as DNG/CR2 are not supported inputs.

## Check, correct, then open

1. Build one argument list with the known format and desired initial view. Run
   the executable with `--check` plus that list, capturing UTF-8 stdout/stderr and
   an exit status with a finite timeout. It creates no viewer and saves no settings.
2. Exit 0 means preflight passed. Read warnings: partial frames and overlapping
   strides are viewable but can reveal a pipeline/layout mismatch. Exit 2 means
   invalid arguments; exit 3 means file/layout failure. Use the English feedback
   to correct parameters supported by the metadata, then check again. If the
   metadata is missing or the error persists without a supported correction,
   report the issue or ask the user rather than repeatedly guessing.
3. Start the viewer with the same argument list, removing only `--check`. Use a
   process API argument array instead of constructing an unescaped shell string.
   Launch asynchronously; do not wait for the user to close the viewer. Redirect
   the long-running process's streams to a chosen log or `DEVNULL`, rather than
   leaving captured pipes that keep the calling tool waiting.

Example argument sets (replace the executable and input paths):

```text
eRAW.exe result.raw --width 1920 --height 1080 --packing unpacked16 --bit-depth 12 --cfa RGGB --mode demosaic
eRAW.exe capture.bin --width 640 --height 480 --packing mipiRaw10 --cfa MONO
eRAW.exe quad.raw --width 1920 --height 1080 --packing mipiRaw14 --cfa QRGGB --cfa-phase-x 1 --mode demosaic --same-color-reconstruction true
```

Example with Python (the displayed metadata must match the producer):

```python
import subprocess

exe = r"C:\Tools\eRAW.exe"  # Replace with the installed executable.
args = [r"C:\output\result.raw", "--width", "1920", "--height", "1080",
        "--packing", "unpacked16", "--bit-depth", "12", "--cfa", "RGGB",
        "--mode", "demosaic"]
check = subprocess.run([exe, "--check", *args], capture_output=True,
                       text=True, encoding="utf-8", timeout=15)
print(check.stdout, end="")
if check.returncode:
    print(check.stderr, end="")
    raise SystemExit(check.returncode)
viewer = subprocess.Popen([exe, *args], stdin=subprocess.DEVNULL,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(f"Preflight passed; viewer launch requested. PID: {viewer.pid}")
```

## Interpret the result accurately

Preflight validates arguments, file access, mapping and layout without scanning
pixels or initializing WebView2. It does not prove correct image interpretation,
WebView2/WebGL availability, completed rendering, or user acceptance. A normal
viewer prints preflight feedback and stays running until closed; exit 0 after
closure is not a ready signal. Exit 1 reports a native viewer startup failure.
Report only the stage actually observed: preflight passed, process started, or
display confirmed through a separate observation.

Each launch opens an independent viewer. CLI format/processing defaults are fixed,
not inherited from saved RAW settings. Initial CLI values are not saved, but later
user edits follow normal GUI settings, including **Remember RAW parameters**.
Existing windows keep their own documents and views; shared defaults affect future
launches. A second invocation of `--check`/open rechecks the source because it may
have changed between processes. The desktop viewer requires a working Windows
interactive session and WebView2; preflight alone does not establish desktop support.
