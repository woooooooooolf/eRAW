# eRAW

eRAW 是一个面向 SoC 与图像传感器适配工作的 RAW 图像查看、诊断与格式转换工具。

它优先忠实呈现传感器输出，支持灰度、CFA 彩色点阵和可选 demosaic 预览；数据导出仅执行裁剪、去除填充、packing、字节序与对齐转换，不进行降噪、锐化或像素校正等图像质量处理。

## 当前版本

`V0.0.17`（开发中）

V0.0.17 明确连续缩放的交互语义，仅在发生小数舍入或边界调整时提示实际应用值，避免将可设置范围误解为离散倍率列表。

## 规划中的首版能力

- RAW8，以及 16-bit 容器中的 RAW10/12/14/16
- MIPI RAW10、MIPI RAW12
- Mono、RGGB、BGGR、GBRG、GRBG
- 文件头偏移、行步长/对齐、帧步长/对齐和多帧浏览
- 灰度、CFA 彩色点阵、可开关的双线性 demosaic
- 超大图像的分级分块渲染、缩放和平移
- 原始像素坐标、CFA 通道和 DN 值读取
- 裁剪、去 padding、packed/unpacked 与字节序转换
- 对异常和不完整数据尽可能显示并报告明确警告

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

## 许可证

eRAW 采用 [GNU General Public License v3.0 或更高版本](LICENSE) 发布。
