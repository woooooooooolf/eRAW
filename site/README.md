# eRAW 项目站点

该目录是与 Tauri 应用分离的静态展示站点。站点迭代不修改 eRAW 软件版本；页面中的版本号在构建时读取根目录 `package.json`。

```powershell
npm.cmd run dev:site
npm.cmd run check:site
npm.cmd run build:site
```

开发服务器固定使用 `http://127.0.0.1:4174/eRAW/`，避免落入 Windows 可能保留的默认 Vite 端口范围。

- 本地开发入口由 `vite.pages.config.ts` 管理。
- 生产构建输出到被 Git 忽略的 `dist-site/`。
- GitHub Pages 发布暂未启用；等仓库公开且中英文页面均通过审阅后再增加部署工作流。
