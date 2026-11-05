export function settingsDialogTemplate(): string {
  return `<dialog id="settings-dialog" class="modal settings-modal"><form method="dialog">
    <header><div><small>APPLICATION PREFERENCES</small><h2>设置</h2></div><button value="cancel" class="dialog-close">×</button></header>
    <div class="settings-body">
      <section class="settings-group"><div class="settings-heading"><h3>外观</h3><p>调整界面文字与动态效果，不改变 RAW 图像的显示比例。</p></div>
        <label class="settings-row"><div><strong>界面字号</strong><span>高分辨率显示器推荐使用“大”或“特大”</span></div><select id="setting-font-size"><option value="standard">标准</option><option value="large">大</option><option value="extraLarge">特大</option></select></label>
        <label class="settings-row"><div><strong>参数栏位置</strong><span>将图像格式和布局参数放在窗口左侧或右侧</span></div><select id="setting-sidebar-position"><option value="left">左侧</option><option value="right">右侧</option></select></label>
        <label class="settings-row toggle-row"><div><strong>减少动态效果</strong><span>关闭面板、弹窗和提示的过渡动画</span></div><input id="setting-reduce-motion" type="checkbox"/></label>
      </section>
      <section class="settings-group"><div class="settings-heading"><h3>操作</h3><p>控制打开文件和画布交互的默认行为。</p></div>
        <label class="settings-row"><div><strong>打开图像时</strong><span>决定新文件的初始缩放方式</span></div><select id="setting-open-view"><option value="fit">适应窗口</option><option value="actual">100% 实际像素</option></select></label>
        <label class="settings-row"><div><strong>滚轮缩放速度</strong><span>缩放始终以鼠标指向的图像位置为中心</span></div><select id="setting-wheel-speed"><option value="gentle">柔和</option><option value="standard">标准</option><option value="fast">快速</option></select></label>
        <label class="settings-row toggle-row"><div><strong>记住 RAW 参数</strong><span>下次启动时恢复尺寸、packing、CFA 和对齐配置</span></div><input id="setting-remember-descriptor" type="checkbox"/></label>
      </section>
      <section class="settings-group"><div class="settings-heading"><h3>性能</h3><p>更大的 GPU 缓存可减少超大图像来回拖动时的瓦片重载。</p></div>
        <label class="settings-row"><div><strong>GPU 瓦片缓存</strong><span>只缓存预览纹理，不复制完整 RAW 文件</span></div><select id="setting-tile-cache"><option value="compact">32 MiB</option><option value="balanced">64 MiB（推荐）</option><option value="large">128 MiB</option></select></label>
      </section>
    </div>
    <footer><button id="reset-settings" type="button" class="text-button">恢复默认设置</button><span class="footer-spacer"></span><button value="cancel" class="secondary-button">取消</button><button id="confirm-settings" type="button" class="primary-button">应用</button></footer>
  </form></dialog>`;
}
