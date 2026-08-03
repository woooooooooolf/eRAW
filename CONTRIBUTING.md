# 贡献指南 / Contributing

## 维护方向

eRAW 的现有功能已经形成相对完整的 RAW 查看、诊断、统计与转换流程。项目开发高度依赖 AI 辅助；随着功能、状态和交互边界增长，验证成本与维护风险也会随之增加。因此，公开后的贡献策略以稳定性和可验证性为中心，而不是持续扩大功能范围。

欢迎以下贡献：

- 可复现的已知缺陷修复；
- Windows、WebView2、RAW 格式或硬件环境的兼容性修复；
- 不改变既有数据语义和用户行为的性能、可靠性与可访问性改进；
- 测试、翻译、文档和诊断信息改进；
- 依赖安全更新和构建维护。

会显著改变架构、处理流程、数据语义或用户行为的新功能通常不作为优先方向。确有必要时，请先提交 Maintenance proposal，说明真实问题、边界、长期维护成本和可验证方案；维护者可能因项目定位或维护成本不接受该提案。

## 提交缺陷

请使用 Bug report，并提供软件版本、Windows 版本、RAW 描述符、复现步骤、期望结果和实际结果。不要上传无权公开的传感器数据、客户数据或专有格式样本；如样本不可公开，请构造最小可再分发数据或仅提供结构化诊断信息。

## Pull Request

1. 保持变更小而聚焦；较大变更先关联 Issue。
2. 不提交 `dist/`、`target/`、RAW 样本、密钥或用户临时文件。
3. 同步更新直接相关的测试和文档。
4. 至少运行：

   ```powershell
   npm.cmd run check
   npm.cmd run test:frontend
   npm.cmd run build
   cargo test --locked --manifest-path src-tauri/Cargo.toml
   ```

5. 提交贡献即表示你有权提供相关代码和资源，并同意其按项目的 GPL-3.0-or-later 许可证发布。

维护者会尽力处理清晰、可复现且符合范围的贡献，但不承诺响应、评审、修复或合并时限。

---

## Maintenance direction

eRAW already provides a cohesive RAW viewing, diagnostic, statistics, and conversion workflow. Development has relied substantially on AI assistance; as features, state, and interaction boundaries grow, verification cost and maintenance risk grow with them. Public contributions therefore prioritize stability and verifiability over continual feature expansion.

Contributions are welcome when they address reproducible defects, compatibility, security, reliability, accessibility, performance without semantic changes, tests, translations, documentation, or diagnostics.

Features that materially change the architecture, processing workflow, data semantics, or user behavior are generally not prioritized. If such a change appears necessary, open a Maintenance proposal first and explain the concrete problem, boundaries, long-term maintenance cost, and verification plan. A proposal may be declined when it does not fit the project scope or maintenance budget.

Use the Bug report form for defects. Never upload sensor data, customer data, proprietary samples, or formats that you are not authorized to disclose. Keep pull requests small, link larger work to an Issue, update relevant tests and documentation, and run the commands listed above.

By contributing, you confirm that you may provide the contribution and agree that it is distributed under GPL-3.0-or-later. Clear and in-scope contributions are appreciated, but response, review, fix, and merge timelines are not guaranteed.
