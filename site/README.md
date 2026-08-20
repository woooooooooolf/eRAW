# eRAW 项目站点

该目录是与 Tauri 应用分离的中英文静态展示站点。站点不显示或读取 eRAW 软件版本；下载入口在浏览器中解析 GitHub 最新 Release 的 Windows x64 EXE，因此站点迭代与软件版本更新彼此独立。

```powershell
npm.cmd run dev:site
npm.cmd run check:site
npm.cmd run test:site
npm.cmd run build:site
```

开发服务器默认使用 `http://127.0.0.1:44174/eRAW/`。如果该端口在本机被占用或保留，可以通过 `npm.cmd run dev:site -- --port <端口>` 临时覆盖。

- 本地开发入口由 `vite.pages.config.ts` 管理。
- 生产构建输出到被 Git 忽略的 `dist-site/`。
- GitHub Pages 由 `.github/workflows/pages.yml` 构建并部署；对站点相关文件的 `master` 推送会自动发布，也可以手动触发。
