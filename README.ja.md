<p align="center">
  <img src="src/assets/eraw-icon.svg" width="96" alt="eRAW アイコン">
</p>

<h1 align="center">eRAW</h1>

<p align="center">SoC およびイメージセンサーの立ち上げに向けた RAW 画像ビューアー、診断、形式変換ツール。</p>

<p align="center">
  <a href="https://github.com/woooooooooolf/eRAW/actions/workflows/ci.yml"><img src="https://github.com/woooooooooolf/eRAW/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-2ea44f?style=flat-square" alt="ライセンス"></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square&amp;logo=windows11&amp;logoColor=white" alt="Windows">
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Tauri 2"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.zh-TW.md">繁體中文</a> · 日本語 · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a>
</p>

## スクリーンショット

![eRAW 日本語メイン画面](docs/images/readme-main-ja.jpg)

## ダウンロード

最新の Windows x64 版とリリースノートは [GitHub Releases](https://github.com/woooooooooolf/eRAW/releases/latest) から入手できます。

Release EXE は Authenticode 署名されていないため、Windows が SmartScreen の警告を表示する場合があります。Latest Release からのみダウンロードし、同梱の SHA-256 一覧でファイルを検証してください。

## 主な機能

- RAW8、16-bit コンテナの RAW9–RAW16、および MIPI RAW10/12/14 に対応。
- Mono、4 種類の Bayer 配列、4 種類の Quad CFA 配列に対応。
- 有効サイズ、ファイルヘッダーオフセット、行/フレームのストライドとアラインメントを設定でき、複数フレームを閲覧可能。
- RAW 強度、CFA、Remosaic、Demosaic、R/G/B 単一チャンネル表示。
- 階層タイル、LOD、GPU タイルキャッシュによる大画像の表示。
- ズーム、パン、ピクセル位置、元の CFA チャンネル、DN 値の確認。
- 実行中に切り替え可能な 9 種類の UI テーマと 7 言語。

## 形式と表示

| 項目 | 現在の対応範囲 |
| --- | --- |
| ストレージ | Unpacked 8、Unpacked 16、MIPI RAW10、MIPI RAW12、MIPI RAW14 |
| ビット深度 | RAW8–RAW16。MIPI のビット深度はストレージ形式で決定 |
| CFA | Mono、RGGB、BGGR、GBRG、GRBG、および対応する 4 種類の Quad CFA |
| バイト配置 | Little/Big Endian、LSB/MSB 有効ビット、ヘッダーオフセット、行/フレームのストライドとアラインメント |
| 画像処理 | Quad CFA の再配列、同色双線形再構成、双線形 Demosaic |
| 検査 | 複数フレーム移動、ズーム/パン、ピクセルグリッド、座標、CFA チャンネル、DN |

表示処理は、可能な範囲で切り詰められたデータや不完全な入力を許容し、診断情報を明示します。エクスポート処理は厳密に検証し、不完全または曖昧な出力を防ぎます。

## エクスポートとキャプチャ

- クロップ、padding 除去、packed/unpacked 変換、バイト順変換を含む元の CFA データの変換とエクスポート。
- 現在のフレームを Remosaic Bayer または RGB48 Interleaved データとしてエクスポート。
- キャンバスウィンドウまたは完全なプレビューを PNG に保存、もしくはクリップボードへコピー。

## コマンドラインと AI 連携

端末、スクリプト、AI から RAW ファイル、寸法、格納形式、ビット深度、CFA、初期表示を指定できます。呼び出しごとに独立ウィンドウを開きます。以下の EXE 名と入力パスは実際の配布ファイルに置き換えてください。

```powershell
& '.\eRAW.exe' '.\result.raw' --width 1920 --height 1080 --packing unpacked16 --bit-depth 12 --cfa RGGB --mode demosaic
& '.\eRAW.exe' --check '.\result.raw' --width 1920 --height 1080 --packing unpacked16 --bit-depth 12 --cfa RGGB
& '.\eRAW.exe' --skill
```

現在の開発版は「バージョン情報」の左下に更新確認ボタンを備えます。クリック時だけ GitHub Latest のリダイレクトヘッダーをバックグラウンドで確認し、GitHub API やリリース HTML 解析は使いません。起動、RAW や画面を開く操作では自動確認しません。画面を閉じても確認は続き、開き直すと実行中または完了した状態を保持します。状態は現在のプロセスだけに保存します。ネットワークのタイムアウトでも画像操作を妨げません。対応 ZIP はユーザーがクリックしたときに既定ブラウザーでダウンロードします。

並べ替えの可逆性には、置換で閉じた画像全体の座標領域、読み取り可能な全サンプル、切り抜きや非可逆なビット深度変換がないことが必要です。元のファイルの全バイトは復元しません。サイズと Phase により画像外の画素が必要になります。プレビューと CLI 事前確認は処理境界の警告付きで利用でき、事前確認の終了コードは 0 のままです。該当する Remosaic/RGB48 出力は非対応範囲を拒否します。内側の切り抜きか同色再構成を明示的に選んでください。自動変更はしません。再構成は補間であり、必要な色のサンプルを要します。

`--check` を加えると、画面を開かずに引数、ファイルアクセス、配置を確認します。ヘルプと結果は人間と AI の修正に適した英語です。事前確認成功は描画完了を意味しません。

`--skill` は EXE に埋め込まれた英語の SKILL.md 全文を出力して終了します。skill のインストールや AI 設定の変更はしません。CLI 初期値は自動保存されず、以降の操作は通常の GUI 保存設定に従います。

パラメーターと終了コードは [CLI ガイド](docs/CLI.md)、AI 呼び出し手順は [skill ソース](skill/eraw-viewer/SKILL.md)をご覧ください。

## プラットフォームと技術スタック

eRAW は現在 Windows を主要ターゲットとし、Tauri 2 で構築されています。

- フロントエンド：TypeScript、WebGL2、Canvas 2D、ネイティブ HTML/CSS
- バックエンド：Rust、読み取り専用メモリマッピング、バイナリ Tauri IPC
- 実行時依存：Windows WebView2 Runtime

## ソースから実行

Node.js、安定版 Rust（最低 1.90）、Windows WebView2、および Tauri 2 が必要とするシステムビルド依存関係を準備してください。

```powershell
npm.cmd install
npm.cmd run tauri dev
```

## 検査、テスト、ビルド

```powershell
npm.cmd run check
npm.cmd run test:frontend
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
npm.cmd run release
```

`npm.cmd run release` は Tauri CLI を使用し、フロントエンド資産を組み込んだ Windows Release EXE を生成します。単独の `cargo build --release` ではフロントエンドのビルドと資産の埋め込みが行われないため、公開用コマンドの代わりには使用しないでください。

## 技術文書

製品上の判断、システム構成、RAW の意味論、レンダリング、テスト、開発フローについては、[技術文書の索引](docs/README.md)を参照してください。

## 現在の範囲

- eRAW はセンサーの生データを診断するツールです。ノイズ除去、シャープ化、色補正、欠陥画素補正などの写真品質向上は行いません。
- 現在の Demosaic アルゴリズムは双線形です。
- 矩形 ROI の選択、座標入力、および L0 の RAW CFA DN に基づく領域統計を利用できます。
- 汎用的なバッチ処理フローはありません。

## メンテナンスと貢献

現在は安定性、不具合修正、既存ワークフローの完成度を優先しています。再現可能な不具合、互換性、文書・テストの改善、既存の意味を変えない限定的な最適化を歓迎します。アーキテクチャ、処理フロー、利用者の操作を大きく変える新機能は通常優先しません。必要な場合は、まず問題の範囲と長期的な保守コストを説明してください。

範囲と手順は [CONTRIBUTING.md](CONTRIBUTING.md)、脆弱性の報告は [SECURITY.md](SECURITY.md) を参照してください。

## ライセンス

eRAW は [GNU General Public License v3.0 or later](LICENSE) の下で公開されています。
