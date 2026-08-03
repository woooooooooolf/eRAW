# eRAW 项目站点

该目录是与 Tauri 应用分离的中英文静态展示站点。站点不显示或读取 eRAW 软件版本；下载入口在浏览器中解析 GitHub 最新 Release 的 Windows x64 EXE，因此站点迭代与软件版本更新彼此独立。

```powershell
npm.cmd run dev:site
npm.cmd run check:site
npm.cmd run build:site
```

开发服务器固定使用 `http://127.0.0.1:4174/eRAW/`，避免落入 Windows 可能保留的默认 Vite 端口范围。

- 本地开发入口由 `vite.pages.config.ts` 管理。
- 生产构建输出到被 Git 忽略的 `dist-site/`。
- GitHub Pages 发布暂未启用；等仓库公开且中英文页面通过最终审阅后再增加部署工作流。
