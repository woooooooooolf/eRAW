# eRAW 工程文档

本文档集记录 eRAW V0.2.12 的当前共识与实现边界。源码是最终事实来源；设计发生变化时，应在同一迭代中更新相关文档。

| 文档 | 内容 |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | 产品定位、交互原则、能力边界与阶段规划 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统分层、模块职责、状态与并发模型 |
| [RAW_FORMAT.md](RAW_FORMAT.md) | RAW 描述符、存储、CFA、容错与导出语义 |
| [RENDERING.md](RENDERING.md) | 瓦片、LOD、WebGL、像素检查与区域选择 |
| [TESTING.md](TESTING.md) | 自动化覆盖、人工验证范围与已知空白 |
| [WORKFLOW.md](WORKFLOW.md) | 需求评审、分支、提交、版本、构建与发布流程 |

## 当前工程快照

- 当前开发版本：`V0.2.12`
- 目标平台：Windows 优先；不受平台约束的部分尽量保持 Linux 兼容
- 桌面框架：Tauri 2
- 前端：TypeScript、WebGL2、Canvas 2D、原生 HTML/CSS
- 后端：Rust、只读内存映射、二进制 Tauri IPC
- 许可证：GPL-3.0-or-later

## 文档维护原则

1. 记录已达成共识和已实现行为，不把设想写成现有能力。
2. 关键约束只在一份文档中完整定义，其他文档通过链接引用。
3. 算法或交互语义变化时，优先更新对应专题，而不是堆叠版本日志。
4. 测试数量只是快照；测试分类和验证责任比数字更重要。
