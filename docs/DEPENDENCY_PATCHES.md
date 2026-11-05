# 第三方依赖补丁

## glib 0.18.5：已回移字符串迭代器安全修复

- 对应缺陷：`RUSTSEC-2024-0429` / `GHSA-wrw7-89jp-8q8g`。
- 原始源码：crates.io 的 `glib 0.18.5`，压缩包 SHA-256 为 `233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`，原始 VCS 提交为 `42b9caf98e03ded086362d9653ca58fe94dc8658`。
- 修复来源：[gtk-rs-core PR #1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343)，合并提交 `05dff0ee696f9bcd8617cd48c4b812d046d440cb`。
- 接入方式：`src-tauri/Cargo.toml` 的 `[patch.crates-io]` 将依赖链统一指向 `src-tauri/vendor/glib`；保持原始 `0.18.5` 版本及 API，兼容 GTK 0.18，未伪装成上游 0.20。
- 许可证：保留原始 `LICENSE`、`COPYRIGHT` 和包内源码。完整性清单在 `src-tauri/vendor/glib-integrity.json`，原始文件逐一比对后，仅 `src/variant_iter.rs` 的下述两行发生变化；本机 `.cargo-ok` 缓存标记不随源码分发。

修复将 `VariantStrIter::impl_get` 中的输出指针声明为 `let mut p`，向 `g_variant_get_child` 传入 `&mut p`。原始代码通过不可变引用传递可写输出参数，违反 Rust 别名规则，优化后可能发生空指针访问。业务代码未直接调用该迭代器并不替代修复。

## 验证与维护

- `tests/repository-publication.test.mjs` 核验补丁配置、锁文件的本地来源、完整文件集合及每个文件的 SHA-256，防止静默退回注册表版本或引入未审核修改。
- Linux 集成测试 `src-tauri/tests/glib_variant_str_iter.rs` 覆盖 `next`、`next_back`、`nth`、`nth_back`、`last`、双向交错迭代、空数组及 UTF-8/空字符串，必须在 Debug 和 Release 两种构建中通过。
- `.github/workflows/ci.yml` 的 Linux job 持续执行源码校验、Linux Rust 测试及优化构建回归；这是安全补丁验证，不代表已提供官方 Linux 安装包或完成 Linux 桌面验收。

```sh
node --test --test-timeout=30000 tests/repository-publication.test.mjs
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --release --manifest-path src-tauri/Cargo.toml --test glib_variant_str_iter
```

该项在当前源码中按已修复维护，不再作为待解决缺陷或 Linux 发布阻碍。修复提交 [`178fc54`](https://github.com/woooooooooolf/eRAW/commit/178fc549ba345af8033019dc8fab84d0110cf16c) 推送后，GitHub 于 2026-11-05 自动将[告警 #2](https://github.com/woooooooooolf/eRAW/security/dependabot/2) 标记为 `fixed`，无需人工 dismiss。注册表原版 0.18.5 仍受影响；实际修复依据是回移代码及 Debug/Release 回归，不能仅凭告警状态证明安全。不配置全局审计忽略规则，不关闭后续漏洞提醒。

未来升级 GTK/Tauri 时复核补丁解析和安全公告；只有上游兼容版本包含同等修复且回归通过后，才移除本地副本、完整性清单和补丁配置。新发现的漏洞仍需单独评估，不能以本补丁覆盖。
