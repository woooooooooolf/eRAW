export interface HelpSection {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
}

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: "start",
    kicker: "从这里开始",
    title: "快速开始",
    summary: "用四步完成一次安全、可回溯的 RAW 查看与导出。",
    body: `
      <div class="help-steps">
        <article><b>1</b><div><h3>打开 RAW 文件</h3><p>按 <kbd>Ctrl</kbd><kbd>O</kbd> 选择文件。未打开文件时，画布中央会显示等待状态。</p></div></article>
        <article><b>2</b><div><h3>确认图像格式</h3><p>在参数栏填写有效尺寸、Packing、位深和 CFA；如果文件包含 padding、帧间间隔或头部，也设置相应字段。</p></div></article>
        <article><b>3</b><div><h3>查看与检查</h3><p>使用滚轮缩放、左键平移，并在高倍率下查看像素网格、坐标、CFA 类型与 DN。</p></div></article>
        <article><b>4</b><div><h3>导出确定性结果</h3><p>按 <kbd>Ctrl</kbd><kbd>E</kbd> 打开导出窗口；导出会冻结当前文件、帧和参数，避免误用过期配置。</p></div></article>
      </div>
      <aside class="help-callout"><strong>先查看，后导出</strong><p>预览会尽力显示可读取的内容并提示异常；导出则会严格检查参数，不能以预览效果代替导出校验。</p></aside>`,
  },
  {
    id: "interface",
    kicker: "日常操作",
    title: "界面、画布与快捷键",
    summary: "画布始终是主工作区；高频查看操作不应被低频设置打断。",
    body: `
      <div class="help-card-grid">
        <article><h3>画布导航</h3><p>滚轮以指针下的图像位置为锚点连续缩放；左键拖动平移；<kbd>Ctrl</kbd><kbd>0</kbd> 适应窗口，<kbd>Ctrl</kbd><kbd>1</kbd> 回到 100% 实际像素。</p></article>
        <article><h3>精确检查</h3><p>高倍率下可显示像素网格、十字准星和 DN。RAW、CFA、Remosaic 显示对应单点 DN；R/G/B 显示重建通道 DN。</p></article>
        <article><h3>显示模式</h3><p>标准 Bayer 可查看 RAW 强度、CFA、Demosaic 与 R/G/B；Quad CFA 额外支持 Remosaic；MONO 只提供 RAW 强度。</p></article>
        <article><h3>常用快捷键</h3><p><kbd>F1</kbd> 打开本手册；<kbd>F11</kbd> 切换全屏；<kbd>Ctrl</kbd><kbd>W</kbd> 关闭文件并释放文件映射。</p></article>
      </div>
      <aside class="help-note"><strong>提示</strong><p>关闭文件不会清除已保存的 RAW 参数、处理选项和应用设置，因此可以快速尝试另一个文件。</p></aside>`,
  },
  {
    id: "descriptor",
    kicker: "读懂文件",
    title: "RAW 参数与格式描述",
    summary: "描述符决定 eRAW 如何解释字节；错误参数可能产生可见但并不可信的预览。",
    body: `
      <div class="help-table-wrap"><table><thead><tr><th>字段</th><th>作用</th><th>使用提示</th></tr></thead><tbody>
        <tr><td>有效尺寸</td><td>每帧的宽度与高度</td><td>宽度范围为 1–25000，高度范围为 1–20000。</td></tr>
        <tr><td>Packing / 位深</td><td>定义像素在文件中的存储方式</td><td>支持 Unpacked8、Unpacked16 和 MIPI RAW10/12/14；MIPI 格式的位深固定。</td></tr>
        <tr><td>字节序 / 有效位</td><td>解释 Unpacked16 容器</td><td>只对 Unpacked16 有效；16-bit 时 LSB 与 MSB 没有差别。</td></tr>
        <tr><td>CFA / Phase</td><td>定义 MONO、Bayer 或 Quad CFA 阵列</td><td>Quad CFA 的相位 X/Y 范围为 0–3，会影响重排、预览与导出的站点语义。</td></tr>
        <tr><td>偏移、行/帧步长</td><td>跳过头部和 padding，并定位下一行/帧</td><td>显式步长为 0 时自动按最小有效字节数和对齐值计算。</td></tr>
      </tbody></table></div>
      <aside class="help-callout"><strong>不完整文件并不一定无法查看</strong><p>最后一帧不足完整尺寸时，eRAW 会将其视为可尝试的部分帧，并把不可读取的像素作为缺失数据呈现。请结合诊断信息判断结果。</p></aside>`,
  },
  {
    id: "processing",
    kicker: "从阵列到预览",
    title: "CFA、Remosaic 与 Demosaic",
    summary: "处理模式帮助观察传感器阵列，不执行照片级颜色校正或画质增强。",
    body: `
      <div class="help-flow" aria-label="RAW processing flow"><span>原始 DN</span><i>→</i><span>CFA 点阵</span><i>→</i><span>Remosaic Bayer</span><i>→</i><span>Demosaic RGB</span></div>
      <div class="help-card-grid">
        <article><h3>RAW 强度与 CFA</h3><p>两者保留原始 DN；CFA 只用颜色标识采样站点，不把原始数据变成彩色照片。</p></article>
        <article><h3>Quad CFA Remosaic</h3><p>“仅重排”将 4×4 同色块恢复为标准 Bayer 站点；“同色双线性重建”按同色采样重建目标站点，计算量更高。</p></article>
        <article><h3>Demosaic</h3><p>当前使用双线性插值。标准 Bayer 直接处理；Quad CFA 会先使用当前 Remosaic 设置，再进行 Demosaic。</p></article>
        <article><h3>RGB 通道</h3><p>R/G/B 是 Demosaic 的单通道视图。默认按通道颜色着色，也可以切换为仅强度的灰度显示；这不会改写 DN 或导出内容。</p></article>
      </div>
      <aside class="help-note"><strong>性能提示</strong><p>同色双线性 Remosaic 比仅重排占用更多 CPU。超大图像或频繁缩放时，瓦片完成时间可能增加。</p></aside>`,
  },
  {
    id: "roi-statistics",
    kicker: "量化检查",
    title: "ROI 与图像统计",
    summary: "统计读取当前帧的 L0 原始 CFA DN；它是单帧描述性分析，而非 EMVA 1288 合规测量。",
    body: `
      <div class="help-card-grid">
        <article><h3>选择 ROI</h3><p>按 <kbd>R</kbd> 启用持续右键框选，或按 <kbd>Shift</kbd><kbd>R</kbd> 输入坐标。坐标从左上角 (0, 0) 开始，起止端点均包含。</p></article>
        <article><h3>打开统计</h3><p>在已打开图像的画布中右键，选择“图像统计…”。没有 ROI 时统计整帧；新 ROI 会替换旧 ROI。</p></article>
        <article><h3>统计口径</h3><p>缺失样本会计入 expected/missing，但不参与均值、方差、直方图与 Profile。彩色 CFA 提供 All、R、Gr、Gb、B；MONO 使用 Y。</p></article>
        <article><h3>阅读图表</h3><p>Histogram 显示 DN 分布；Row/Column Profile 显示每行或每列的均值趋势。普通滚轮滚动页面，<kbd>Ctrl</kbd> 或 <kbd>Shift</kbd> 加滚轮缩放图表坐标轴。</p></article>
      </div>
      <aside class="help-callout"><strong>QCFA 分组</strong><p>Quad CFA 在内部按 4×4 周期的 16 个原子平面累加，再合并为 R/Gr/Gb/B 语义组。ROI 起点不会改变图像自身的 CFA 相位。</p></aside>`,
  },
  {
    id: "export",
    kicker: "生成输出",
    title: "导出与画面抓拍",
    summary: "RAW 导出保存确定性数据，PNG 抓拍保存当前预览；两者的用途不同。",
    body: `
      <div class="help-card-grid">
        <article><h3>原始 CFA 导出</h3><p>支持裁剪、去 padding、Packing、位深、字节序和对齐转换。裁剪后会同步更新 Bayer 排列或 Quad CFA 相位。</p></article>
        <article><h3>Remosaic / Demosaic</h3><p>Remosaic 只适用于 Quad CFA，输出标准 Bayer；Demosaic 输出 RGB48 Interleaved，每通道为 16-bit。</p></article>
        <article><h3>缺失像素</h3><p>导出缺失 DN 由导出窗口单独指定，不继承预览中的棋盘格或纯色外观。</p></article>
        <article><h3>PNG 抓拍</h3><p>“当前画面”保留视野、底色和叠加层；“完整预览图”输出完整图像，不包含画布 UI，并自动选择合适的 LOD。</p></article>
      </div>
      <aside class="help-note"><strong>安全写入</strong><p>导出不能覆盖当前打开的源文件。写入会先创建同目录临时文件；取消或失败时不会替换已有目标文件。</p></aside>`,
  },
  {
    id: "troubleshooting",
    kicker: "使用边界",
    title: "提示、限制与排错",
    summary: "当结果不符合预期时，优先检查格式描述、数据完整性和当前显示模式。",
    body: `
      <div class="help-faq">
        <details open><summary>为什么预览有棋盘格或纯色像素？</summary><p>这表示文件中对应像素无法读取。它与图像边界外的透明区域不同，仅影响预览外观，不决定导出的缺失填充值。</p></details>
        <details><summary>为什么参数修改后图像或统计会刷新？</summary><p>描述符决定字节解释方式。成功应用新的图像格式后，旧预览和统计结果会失效，并基于新参数重新生成；失败时保留最后一次有效配置。</p></details>
        <details><summary>为什么某些功能不可用？</summary><p>功能会随 CFA 类型变化：MONO 不提供 CFA/Remosaic/Demosaic；Remosaic 仅用于 Quad CFA；Demosaic 和 RGB 通道仅用于彩色 CFA。</p></details>
        <details><summary>为什么统计结果不能代表完整传感器性能？</summary><p>当前统计针对一帧、一个 ROI 的原始 DN 描述。它不包含多帧 temporal 指标、线性测量流程或 EMVA 1288 所要求的完整条件。</p></details>
      </div>
      <aside class="help-callout"><strong>获取可靠结果</strong><p>请记录源文件、描述符、frame、ROI、显示模式和导出参数。eRAW 的目标是协助你验证原始数据，而不是替你猜测未知文件格式。</p></aside>`,
  },
];
