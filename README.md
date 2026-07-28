# eRAW

eRAW 是一个面向 SoC 与图像传感器适配工作的 RAW 图像查看、诊断与格式转换工具。

它优先忠实呈现传感器输出，支持灰度、标准 Bayer、Quad CFA 点阵，以及可控的 remosaic 和 demosaic 预览。导出既可保持“只转换原始 CFA 数据”的定位，也可为当前 remosaic 或 demosaic 结果创建单帧快照；工具不进行降噪、锐化、颜色校正或像素校正等图像质量优化。

## 当前版本

`V0.2.1`（开发中）

V0.2.1 修复数值参数输入框在清空并提交后仍显示为空的问题。文件头偏移和显式步长会回写为 `0`，行/帧对齐会回写为 `1`，界面显示与实际生效参数保持一致。

## 规划中的首版能力

- RAW8，以及 16-bit 容器中的 RAW9–RAW16
- MIPI RAW10、MIPI RAW12、MIPI RAW14
- Mono、RGGB、BGGR、GBRG、GRBG 与四种对应 Quad CFA
- 文件头偏移、行步长/对齐、帧步长/对齐和多帧浏览
- 灰度、CFA 彩色点阵、Quad CFA remosaic 和双线性 demosaic
- 超大图像的分级分块渲染、缩放和平移
- 原始像素坐标、CFA 通道和 DN 值读取
- 原始 CFA 的裁剪、去 padding、packed/unpacked 与字节序转换
- Remosaic Bayer 与 RGB48 Interleaved 单帧快照导出
- 对异常和不完整数据尽可能显示并报告明确警告
- 七种界面语言、系统语言匹配和运行时即时切换

## 开发

需要 Node.js、Rust stable、Windows WebView2 和 Tauri 2 构建依赖。

```powershell
npm.cmd install
npm.cmd run tauri dev
```

前端静态检查：

```powershell
npm.cmd run check
```

生成包含前端资源、可独立运行的 Windows Release EXE：

```powershell
npm.cmd run release
```

请勿使用裸 `cargo build --release` 作为发布命令；它不会执行 Tauri CLI 的前端构建与资源嵌入流程。

Rust 测试：

```powershell
cd src-tauri
cargo test
```

## 工程文档

设计决策、系统架构、RAW 语义、渲染、测试和迭代流程参见 [docs/README.md](docs/README.md)。

## 许可证

eRAW 采用 [GNU General Public License v3.0 或更高版本](LICENSE) 发布。
