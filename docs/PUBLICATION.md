# GitHub 公开准备与安全配置

本文档记录仓库从私有转为公开前后的配置责任。它不改变仓库可见性；可见性切换必须由仓库所有者明确执行。

## 公开前

- `master`、tag、Release 与 Actions 状态已核对，远端仅保留需要公开的分支。
- 当前源码与历史中不包含凭据、客户 RAW、专有样本或无权公开的资源。
- `LICENSE`、`THIRD_PARTY_NOTICES.md`、安全/贡献/支持说明及 Issue/PR 模板随源码提供。
- Release 工作流生成 EXE、SHA-256、SPDX SBOM 与第三方许可证文本；公开仓库额外生成 GitHub 构建来源证明。
- Dependabot 漏洞提醒和自动安全更新已启用；npm、Cargo 与 GitHub Actions 每周检查更新。
- 仓库保持维护优先：鼓励缺陷、兼容性、安全、测试和文档改进，不主动扩张架构、处理语义和用户行为。

### 已知依赖告警

- `glib 0.18.5` 的中危告警 `GHSA-wrw7-89jp-8q8g` 保持开启。该依赖由 Tauri 的 Linux GTK 运行时链路引入，不进入官方 Windows x64 Release；当前 Tauri 约束为 `gtk ^0.18`，无法单独升级到已修复的 `glib >= 0.20.0`。
- 不关闭或忽略该告警；持续跟踪 Tauri 上游依赖更新。在提供任何 Linux Release 前，必须重新评估并消除该风险。

## 切换为公开后立即执行

GitHub 免费私有仓库不开放以下配置；可见性切换后应在同一维护窗口完成：

1. 为 `master` 配置经典分支保护：
   - Pull Request 必须通过；
   - 至少 1 次批准；
   - 必须解决全部 review conversation；
   - 必须通过 `Verify Windows build`；
   - 要求线性历史；
   - 禁止 force push 和 branch deletion；
   - `enforce_admins=false`，允许单维护者在必要时绕过。
2. 开启 Secret scanning 和 Push protection。
3. 开启 Code scanning；先以默认 CodeQL 配置验证 TypeScript/JavaScript，Rust 支持情况按 GitHub 当时能力确认。
4. 开启 Private vulnerability reporting，使 `SECURITY.md` 的私密报告入口可用。
5. 确认 fork Pull Request 的工作流需要首次贡献者批准，且不会向 fork 暴露 secrets。
6. 检查 About 区域、Topics、Social preview、README 徽章和 Latest Release 的公开显示。
7. 从未登录会话检查 README、Releases、Issues、Security policy 与下载资产。

## 发布与供应链

- GitHub Actions 使用允许列表并固定到完整 commit SHA；Dependabot 负责跟踪 Action 更新。
- 默认 `GITHUB_TOKEN` 为只读；只有 Release job 获得 `contents: write`，公开时的 attestation step 另获 `id-token: write` 与 `attestations: write`。
- Release EXE 目前没有商业代码签名证书。SHA-256、SBOM 与构建来源证明用于完整性和来源核验，但不能替代 Windows Authenticode。
- 历史 Release 保留用于追溯；新用户应下载 Latest Release。

## 定期复核

- 每月检查 Dependabot 和 Code scanning 告警。
- 每次依赖更新后重新生成第三方依赖清单并运行安全审计。
- 每次发布后核验 tag、Actions、Release 状态、资产名称、SHA-256 和来源证明。
- 项目范围或维护策略发生变化时，同步更新 `CONTRIBUTING.md`、Issue Forms 和本文件。
