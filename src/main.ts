import "./styles.css";
import { ErawApp } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("无法建立 eRAW 应用根节点");

try {
  new ErawApp(root);
} catch (error) {
  root.innerHTML = `<main class="fatal-error"><h1>eRAW 无法启动</h1><p>${String(error)}</p><small>请确认 WebView2 和显卡驱动支持 WebGL2。</small></main>`;
}
