<p align="center">
  <img src="src/assets/eraw-icon.svg" width="96" alt="eRAW 图标">
</p>

<h1 align="center">eRAW</h1>

<p align="center">面向 SoC 与图像传感器适配工作的 RAW 图像查看、诊断与格式转换工具。</p>

<p align="center">
  简体中文 · <a href="README.en.md">English</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center"><strong>当前版本：V0.2.12</strong></p>

## 界面预览

![eRAW 曜石紫深色主界面](docs/images/readme-main-dark.png)

![eRAW 极昼蓝浅色设置界面](docs/images/readme-settings-light.png)

## 核心特性

- 支持 RAW8、16-bit 容器 RAW9–RAW16，以及 MIPI RAW10/12/14。
- 支持 Mono、四种 Bayer 排列与四种 Quad CFA 排列。
- 可配置有效尺寸、文件头偏移、行/帧步长与对齐，并浏览多帧文件。
- 提供 RAW 强度、CFA、Remosaic、Demosaic 和 R/G/B 单通道显示。
- 使用分级分块、LOD 与 GPU 瓦片缓存流畅查看大尺寸图像。
- 支持缩放、平移、像素定位，以及原始 CFA 通道和 DN 值读取。
- 提供九套界面主题和七种界面语言，可在运行时即时切换。

## 格式与显示能力

| 类别 | 当前支持 |
| --- | --- |
| 存储方式 | Unpacked 8、Unpacked 16、MIPI RAW10、MIPI RAW12、MIPI RAW14 |
| 位深 | RAW8–RAW16；MIPI 模式的位深由存储方式确定 |
| CFA | Mono、RGGB、BGGR、GBRG、GRBG 及对应的四种 Quad CFA |
| 字节布局 | Little/Big Endian、LSB/MSB 有效位、文件头偏移、行/帧步长与对齐 |
| 图像处理 | Quad CFA 重排、同色双线性重建、双线性 Demosaic |
| 检查工具 | 多帧导航、缩放与平移、像素网格、坐标、CFA 通道和 DN |

查看路径会尽量容忍截断或不完整数据，并明确显示诊断信息；导出路径则采用严格校验，避免生成语义不完整的结果。

## 导出与抓拍

- 转换并导出原始 CFA 数据，可处理裁剪、padding、packed/unpacked 与字节序。
- 导出当前帧的 Remosaic Bayer 或 RGB48 Interleaved 数据。
- 将画布窗口或完整预览图保存为 PNG，或复制到剪贴板。

## 平台与技术栈

eRAW 当前以 Windows 为主要目标平台，基于 Tauri 2 构建：

- 前端：TypeScript、WebGL2、Canvas 2D、原生 HTML/CSS
- 后端：Rust、只读内存映射、二进制 Tauri IPC
- 运行依赖：Windows WebView2 Runtime

## 从源码运行

需要 Node.js、Rust stable、Windows WebView2 和 Tauri 2 的系统构建依赖。

```powershell
npm.cmd install
npm.cmd run tauri dev
```

## 检查、测试与构建

```powershell
npm.cmd run check
npm.cmd run test:frontend
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
npm.cmd run release
```

`npm.cmd run release` 会通过 Tauri CLI 构建包含前端资源的 Windows Release EXE。请勿以裸 `cargo build --release` 代替发布命令，因为它不会执行前端构建与资源嵌入流程。

## 工程文档

设计决策、系统架构、RAW 语义、渲染、测试和迭代流程见 [工程文档索引](docs/README.md)。

## 当前边界

- eRAW 面向传感器原始数据诊断，不进行降噪、锐化、颜色校正、坏点修复等照片质量优化。
- 当前 Demosaic 算法为双线性。
- 矩形区域选择模型已预留，但尚未接入区域统计。
- 当前不提供通用批处理流程。

## 许可证

eRAW 采用 [GNU General Public License v3.0 or later](LICENSE) 发布。
