# RAW 格式语义

## 尺寸与步长

- `width`、`height`：有效像素区域。
- `rowBytes`：仅存储一行有效像素所需的最小字节数。
- `rowStride`：下一行相对当前行的字节距离。显式值为 0 时，由 `align_up(rowBytes, rowAlignment)` 得到。
- `frameBytes`：`rowStride × height`。
- `frameStride`：下一帧相对当前帧的字节距离。显式值为 0 时，由 `align_up(frameBytes, frameAlignment)` 得到。
- `headerOffset`：第一帧相对文件起点的偏移。

对齐全部以字节为单位，避免“像素宽度对齐”和“存储字节对齐”的歧义。

## 支持的存储方式

- `unpacked8`：每像素 1 字节。
- `unpacked16`：每像素 2 字节，可选择大端或小端，有效位可位于容器低位或高位。
- `mipiRaw10`：4 像素 5 字节。
- `mipiRaw12`：2 像素 3 字节。

MIPI packing 与通用连续位流 packing 不等价；后者将作为独立格式扩展，不能仅用一个 `packed` 布尔值描述。

## 显示与导出

显示归一化、CFA 着色和 demosaic 只影响预览。RAW 导出默认保持数值语义；目标位深不足时必须使用显式的裁剪或全范围缩放策略，并报告被裁剪的像素数量。

从奇数 X/Y 坐标裁剪 Bayer 图像会改变 CFA 相位。导出不重排像素，但 UI 必须显示裁剪后的 CFA 排列。

