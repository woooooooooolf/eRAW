# Linux 平台支持

## 范围

首版面向 Ubuntu 24.04 LTS、x86_64（成果物命名为 x64）、GNOME。其他发行版、较旧 Ubuntu、ARM64 和其他桌面不属于本轮支持承诺。核心 RAW 语义、参数及 CLI 退出码与 Windows 一致。

同时提供两个原始分发文件：

- `eRAW-Vx.y.z-linux-x64.deb` 及 `eRAW-Vx.y.z-linux-x64.deb.sha256`。
- `eRAW-Vx.y.z-linux-x64.AppImage` 及 `eRAW-Vx.y.z-linux-x64.AppImage.sha256`。

不再外套压缩包，不附加独立 SBOM 或许可证下载资产；许可证原文由应用内提供，依赖清单和补丁来源在源码仓库维护。上述规则与 [发布流程](WORKFLOW.md#发布资产与说明约定) 一致。Windows EXE 的分发方式保持不变。

## 安装与运行

下载后先在文件所在目录验证对应的 SHA-256：

```sh
sha256sum -c eRAW-Vx.y.z-linux-x64.deb.sha256
sudo apt install ./eRAW-Vx.y.z-linux-x64.deb
eraw --version
eraw --check ./image.raw --width 640 --height 480 --packing unpacked8 --cfa MONO
```

DEB 由 Tauri 生成桌面入口和图标，声明 GTK/WebKitGTK 及本程序原生 TLS 所需的 `libssl3t64` 等运行依赖；使用 apt 安装以处理依赖。软件包名为 `e-raw`，可通过 `sudo apt remove e-raw` 卸载。

AppImage 无需系统安装，下载后设置执行权限：

```sh
sha256sum -c eRAW-Vx.y.z-linux-x64.AppImage.sha256
chmod +x eRAW-Vx.y.z-linux-x64.AppImage
./eRAW-Vx.y.z-linux-x64.AppImage --version
./eRAW-Vx.y.z-linux-x64.AppImage
```

AppImage 不等于所有 Linux 通用：本轮仍以 Ubuntu 24.04 x64 为基线。需要 FUSE 兼容支持时可安装 Ubuntu 的 `libfuse2t64`；在不能挂载 FUSE 的环境可使用 `APPIMAGE_EXTRACT_AND_RUN=1 ./eRAW-Vx.y.z-linux-x64.AppImage` 临时提取运行。它不会自动创建菜单入口，也不自动替换旧版本。

关于页手动更新检查默认指向 DEB；在 AppImage 运行时指向 AppImage。检查和状态语义与 Windows 一致，不自动下载、安装或在启动时联网。系统语言读取登录会话的 UI 语言配置；终端覆盖 `LANGUAGE` 等变量时会影响选择。界面和路径字体由系统提供；缺少 CJK 字形时可安装 `fonts-noto-cjk`，应用不打包字体。

## 从源码构建

使用 Node.js 22、稳定 Rust（至少 1.90）和 Ubuntu 24.04 系统依赖，在 Linux 文件系统中的独立源码目录执行，避免与 Windows 共用 `node_modules` 或 `target`：

```sh
bash scripts/setup-linux.sh deps
npm ci
npm run check
npm run test:frontend
cargo test --locked --manifest-path src-tauri/Cargo.toml
APPIMAGE_EXTRACT_AND_RUN=1 npm run release:linux
npm run test:cli
node scripts/verify-linux-packages.mjs
node scripts/release-assets.mjs --platform linux --output-dir artifacts/linux
```

`npm run release` 仍只构建裸可执行文件，用于程序开发和 CLI 测试；`npm run release:linux` 执行前端生产构建、嵌入资源并生成 DEB/AppImage。不能以裸 `cargo build --release` 代替正式打包。可设置 `CARGO_TARGET_DIR`；CLI 测试、安装包验证和成果物准备脚本均遵循该目录，也可通过 `ERAW_TEST_BINARY` 指定 CLI 测试文件。

## 验证

`verify-linux-packages.mjs` 验证 DEB 的版本、架构、运行依赖、桌面入口、提取后二进制和 AppImage 的运行时/AppRun；`release-assets.mjs` 只生成约定格式及对应校验文件，并拒绝不明确的输入或额外旧资产。发布先完成两平台构建，再统一核验六个资产并公开草稿，不覆盖历史公开版本。

原生 WebView 冒烟不需要新增应用插件、测试专用 IPC 或开发服务器：

```sh
bash scripts/setup-linux.sh deps
bash scripts/setup-linux.sh webdriver
xvfb-run -a node tests/linux-webdriver.mjs
```

测试启动真实 Release ELF，使用隔离的 XDG 用户目录和合成 RAW，覆盖两帧渲染、语言、最小窗口、独立手册及关闭文档，保存截图至 `artifacts/linux-smoke`，并在结束时关闭测试进程。WSLg 可直接运行 `node tests/linux-webdriver.mjs`。仅在 root 测试环境因 WebKit 沙箱限制无法启动时，为该次测试进程设置 `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`；正式程序与工作流不设置该变量。

WSL/WSLg 和 Xvfb 验证不能替代原生 GNOME 的 Wayland/X11、显卡驱动、系统文件对话框、图像剪贴板与多显示器验收。没有为未复现的问题全局关闭 GPU 加速或添加渲染兼容开关。正式发布前，应明确保留尚未覆盖的验收项，不能将本轮自动化结果宣传为所有 Linux 环境均已通过。
