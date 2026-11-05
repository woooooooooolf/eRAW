#!/usr/bin/env bash
# Shared Ubuntu build/test prerequisites; called from CI, Release and local builds.
set -euo pipefail

case "${1:-}" in
  deps)
    apt=(apt-get)
    if [[ "$(id -u)" != 0 ]]; then apt=(sudo apt-get); fi
    "${apt[@]}" update
    "${apt[@]}" install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev build-essential pkg-config libdbus-1-dev \
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
      patchelf libfuse2t64 xvfb xauth webkit2gtk-driver
    ;;
  webdriver)
    cargo install tauri-driver --version 2.1.0 --locked
    ;;
  *)
    printf 'Usage: bash scripts/setup-linux.sh {deps|webdriver}\n' >&2
    exit 2
    ;;
esac
