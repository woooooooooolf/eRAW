## Summary / 变更摘要

<!-- Explain the defect or maintenance problem and the smallest change that addresses it. -->

## Scope / 范围

- Related Issue:
- Existing behavior preserved outside this scope: yes / no
- Architecture, processing semantics, workflow, or user behavior changed: yes / no

If the last answer is **yes**, explain why the change is necessary and why it was discussed before implementation.

## Verification / 验证

- [ ] `npm.cmd run check`
- [ ] `npm.cmd run test:frontend`
- [ ] `npm.cmd run build`
- [ ] `cargo test --locked --manifest-path src-tauri/Cargo.toml`
- [ ] Relevant documentation and translations are updated.
- [ ] No RAW sample, credential, generated build output, or confidential data is included.
- [ ] I have the right to contribute all code and assets in this Pull Request under GPL-3.0-or-later.
