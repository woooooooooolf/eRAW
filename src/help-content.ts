export type HelpGroupId = "guide" | "data" | "processing" | "analysis" | "reference";

export interface HelpGroup {
  readonly id: HelpGroupId;
  readonly title: string;
}

export interface HelpSection {
  readonly id: string;
  readonly group: HelpGroupId;
  readonly kicker: string;
  readonly title: string;
  readonly summary: string;
  readonly level: "入门" | "进阶" | "参考";
  readonly readingTime: string;
  readonly body: string;
}

export const HELP_GROUPS: readonly HelpGroup[] = [
  { id: "guide", title: "使用基础" },
  { id: "data", title: "数据解释" },
  { id: "processing", title: "处理与呈现" },
  { id: "analysis", title: "分析与输出" },
  { id: "reference", title: "边界与速查" },
];

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: "start",
    group: "guide",
    kicker: "阅读入口",
    title: "如何使用这本技术手册",
    summary: "从一次可靠的 RAW 检查开始，并按任务进入数据、算法、统计或导出专题。",
    level: "入门",
    readingTime: "约 4 分钟",
    body: `
      <div class="help-lead"><p>eRAW 不尝试猜测未知文件格式。它把“字节如何成为像素”拆成可检查的描述符、处理过程和结果口径。本手册既说明按钮怎么用，也解释结果为什么成立、在哪些条件下不再成立。</p></div>
      <div class="help-steps">
        <article><b>1</b><div><h3>建立描述符</h3><p>按 <kbd>Ctrl</kbd><kbd>O</kbd> 打开文件，填写尺寸、Packing、位深和 CFA。存在文件头、行 padding 或帧 padding 时，再补充偏移和步长。</p></div></article>
        <article><b>2</b><div><h3>验证空间结构</h3><p>先用 RAW 强度判断读取连续性，再用 CFA 检查颜色站点、Phase 和周期。可见图像不等于参数正确；规律性的错行、错色通常来自布局错误。</p></div></article>
        <article><b>3</b><div><h3>检查 DN 与统计</h3><p>在高倍率下读取原始 DN，或以 ROI 对当前帧的 L0 数据执行 Histogram、Row Profile 与 Column Profile。记录缺失样本数量。</p></div></article>
        <article><b>4</b><div><h3>冻结并导出</h3><p>按 <kbd>Ctrl</kbd><kbd>E</kbd> 冻结当前文件、帧、描述符和处理参数。根据用途选择原始 CFA、Remosaic Bayer 或 Demosaic RGB48。</p></div></article>
      </div>
      <div class="help-page-map">
        <article><small>文件打不开或画面错行</small><strong>阅读“文件布局”和“Packing 解码”</strong></article>
        <article><small>颜色位置或 Quad CFA 不正确</small><strong>阅读“CFA 与 Phase”及“Remosaic”</strong></article>
        <article><small>想知道彩色像素如何得到</small><strong>阅读“双线性 Demosaic”</strong></article>
        <article><small>想解释统计图中的数字</small><strong>阅读“统计口径”和“图表呈现”</strong></article>
      </div>
      <aside class="help-callout"><strong>建议保留最小实验记录</strong><p>至少记录源文件校验值、宽高、Packing、位深、CFA/Phase、frame、ROI 和导出参数。只有输入条件可复现，输出结果才可比较。</p></aside>`,
  },
  {
    id: "workflow",
    group: "guide",
    kicker: "操作模型",
    title: "文件会话、画布与快捷操作",
    summary: "理解当前文档、当前帧和当前观察状态之间的关系，避免把旧结果带入新文件。",
    level: "入门",
    readingTime: "约 6 分钟",
    body: `
      <div class="help-card-grid">
        <article><h3>文档会话</h3><p>应用同一时间只维护一个当前 RAW 文件。重新打开文件或成功提交新描述符后，旧瓦片和旧统计会失效；<kbd>Ctrl</kbd><kbd>W</kbd> 关闭文件并释放只读映射。</p></article>
        <article><h3>帧与观察状态</h3><p>切换同尺寸帧时保留缩放和平移。尺寸变化会清除依赖旧坐标的 ROI。关闭文件不会清除已保存的描述符、处理选项和应用设置。</p></article>
        <article><h3>画布导航</h3><p>滚轮以指针下的图像点为锚连续缩放，左键拖动平移。<kbd>Ctrl</kbd><kbd>0</kbd> 适应窗口，<kbd>Ctrl</kbd><kbd>1</kbd> 回到 100% 实际像素。</p></article>
        <article><h3>诊断的含义</h3><p>诊断面板只描述当前状态，不是历史日志。修正参数、重新渲染或打开新文件后，不再成立的运行时错误会自动消失。</p></article>
      </div>
      <div class="help-table-wrap"><table><thead><tr><th>任务</th><th>快捷键</th><th>生效条件</th></tr></thead><tbody>
        <tr><td>打开 / 关闭文件</td><td><kbd>Ctrl</kbd><kbd>O</kbd> / <kbd>Ctrl</kbd><kbd>W</kbd></td><td>全局；关闭会释放源文件映射</td></tr>
        <tr><td>适应 / 100% / 全屏</td><td><kbd>Ctrl</kbd><kbd>0</kbd> / <kbd>Ctrl</kbd><kbd>1</kbd> / <kbd>F11</kbd></td><td>主窗口没有模态对话框时</td></tr>
        <tr><td>鼠标 ROI / 坐标 ROI</td><td><kbd>R</kbd> / <kbd>Shift</kbd><kbd>R</kbd></td><td>已打开文件；ROI 端点均包含</td></tr>
        <tr><td>定位像素 / 输入缩放</td><td><kbd>P</kbd> / <kbd>Z</kbd></td><td>已打开文件</td></tr>
        <tr><td>统计 / 导出</td><td><kbd>Ctrl</kbd><kbd>I</kbd> / <kbd>Ctrl</kbd><kbd>E</kbd></td><td>已打开文件</td></tr>
        <tr><td>保存 / 复制当前画面</td><td><kbd>Ctrl</kbd><kbd>S</kbd> / <kbd>Ctrl</kbd><kbd>C</kbd></td><td>保留当前视野与可见叠加层</td></tr>
        <tr><td>保存 / 复制完整预览</td><td><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>S</kbd> / <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>C</kbd></td><td>完整图像，不包含画布 UI</td></tr>
        <tr><td>帮助 / 取消</td><td><kbd>F1</kbd> / <kbd>Esc</kbd></td><td>F1 打开或聚焦本窗口</td></tr>
      </tbody></table></div>
      <aside class="help-note"><strong>设置与数据的边界</strong><p>主题、语言、字号、参数栏位置、滚轮速度、缓存档位和减少动态效果只改变交互或资源使用，不改变源字节、DN、CFA 语义和确定性导出。</p></aside>`,
  },
  {
    id: "layout",
    group: "data",
    kicker: "从文件到帧",
    title: "文件布局、步长与帧计数",
    summary: "用明确的字节公式定位每一帧、每一行和每一个像素组。",
    level: "进阶",
    readingTime: "约 9 分钟",
    body: `
      <div class="help-prose"><h3>1. 最小有效行大小</h3><p>设有效宽度为 <var>W</var>。Packing 决定一行至少需要多少字节；向上取整表示最后一个不完整像素组仍占用完整存储组。</p></div>
      <div class="help-equation"><span>Unpacked8</span><code>rowBytes = W</code></div>
      <div class="help-equation"><span>Unpacked16</span><code>rowBytes = 2W</code></div>
      <div class="help-equation"><span>MIPI RAW10</span><code>rowBytes = 5 · ceil(W / 4)</code></div>
      <div class="help-equation"><span>MIPI RAW12</span><code>rowBytes = 3 · ceil(W / 2)</code></div>
      <div class="help-equation"><span>MIPI RAW14</span><code>rowBytes = 7 · ceil(W / 4)</code></div>
      <div class="help-prose"><h3>2. 对齐、行步长与帧步长</h3><p>对齐值小于 1 时按 1 处理。显式步长为 0 才使用自动计算；非零步长按用户给定值解释，即使它短于有效数据并造成行或帧重叠，也会提示后继续尝试预览。</p></div>
      <div class="help-equation"><span>向上对齐</span><code>alignUp(v, a) = v + ((a − v mod a) mod a)</code></div>
      <div class="help-equation"><span>自动布局</span><code>rowStride = alignUp(rowBytes, rowAlignment)</code><code>frameBytes = rowStride · H</code><code>frameStride = alignUp(frameBytes, frameAlignment)</code></div>
      <div class="help-prose"><h3>3. 可用字节与部分帧</h3><p>文件头偏移先从文件大小中扣除。只要完整帧之后还有剩余字节，就把它作为一个可尝试的部分尾帧；读取不到的像素成为缺失样本，而不是凭空补齐。</p></div>
      <div class="help-equation"><span>帧计数</span><code>available = max(fileSize − headerOffset, 0)</code><code>complete = floor(available / frameStride)</code><code>trailing = available mod frameStride</code><code>frameCount = complete + I(trailing &gt; 0)</code></div>
      <div class="help-example"><small>示例 · 4032×3024 RAW10</small><p><code>rowBytes = 5 × ceil(4032/4) = 5040 B</code>。若行对齐为 64 B，则 <code>rowStride = 5056 B</code>；每帧有效布局占 <code>5056 × 3024 = 15,289,344 B</code>。这说明把文件大小直接除以“像素数 × 10/8”会漏掉行 padding。</p></div>
      <div class="help-impact"><strong>结果影响</strong><span>预览：决定读到哪一个字节</span><span>统计：决定有效与缺失样本</span><span>导出：来源读取沿用当前布局</span></div>
      <aside class="help-callout"><strong>优先排查顺序</strong><p>整幅图斜切或周期错位时，依次检查宽度、Packing、rowStride、headerOffset；帧之间串扰时再检查 frameStride。CFA 选错通常造成颜色站点错误，但不会造成每行字节位置持续漂移。</p></aside>`,
  },
  {
    id: "packing",
    group: "data",
    kicker: "从字节到 DN",
    title: "Unpacked 与 MIPI RAW 解码",
    summary: "理解位深、字节序、有效位对齐和 MIPI 像素组如何共同形成原始 DN。",
    level: "参考",
    readingTime: "约 10 分钟",
    body: `
      <div class="help-prose"><h3>Unpacked 容器</h3><p>Unpacked8 每像素读取 1 字节；Unpacked16 每像素读取 2 字节并先按 Little/Big Endian 组成 16-bit 容器。只有 Unpacked 格式应用 MSB 有效位右移，随后所有格式都按实际位深掩码。</p></div>
      <div class="help-equation"><span>有效位提取</span><code>depth = clamp(bitDepth, 1, containerBits)</code><code>shifted = MSB-aligned ? value &gt;&gt; (containerBits − depth) : value</code><code>DN = shifted &amp; (2^depth − 1)</code></div>
      <div class="help-prose"><h3>MIPI RAW10</h3><p>4 个像素占 5 字节。前 4 字节分别保存各像素高 8 bit，第 5 字节按像素顺序保存四组低 2 bit。</p></div>
      <div class="help-equation"><span>第 i 个像素，i∈[0,3]</span><code>DNᵢ = (Bᵢ &lt;&lt; 2) | ((B₄ &gt;&gt; 2i) &amp; 0x03)</code></div>
      <div class="help-prose"><h3>MIPI RAW12</h3><p>2 个像素占 3 字节。前 2 字节保存高 8 bit，第 3 字节的低、高清半字节分别属于第 0、1 个像素。</p></div>
      <div class="help-equation"><span>两像素组</span><code>DN₀ = (B₀ &lt;&lt; 4) | (B₂ &amp; 0x0F)</code><code>DN₁ = (B₁ &lt;&lt; 4) | ((B₂ &gt;&gt; 4) &amp; 0x0F)</code></div>
      <div class="help-prose"><h3>MIPI RAW14</h3><p>4 个像素占 7 字节。B0–B3 保存各像素高 8 bit；B4–B6 连续承载 24 个低位。低 6 bit 的拼接如下。</p></div>
      <div class="help-equation"><span>低位拼接</span><code>L₀ = B₄ &amp; 0x3F</code><code>L₁ = ((B₄ &gt;&gt; 6) &amp; 0x03) | ((B₅ &amp; 0x0F) &lt;&lt; 2)</code><code>L₂ = ((B₅ &gt;&gt; 4) &amp; 0x0F) | ((B₆ &amp; 0x03) &lt;&lt; 4)</code><code>L₃ = (B₆ &gt;&gt; 2) &amp; 0x3F</code><code>DNᵢ = (Bᵢ &lt;&lt; 6) | Lᵢ</code></div>
      <div class="help-example"><small>示例 · RAW10</small><p>若 <code>B0=0x80</code>，共享低位字节 <code>B4</code> 的最低两位为 <code>3</code>，则第一个像素为 <code>(128×4)+3=515 DN</code>。显示亮度随后还会归一化，但原始 DN 仍是 515。</p></div>
      <aside class="help-note"><strong>边界与错误信号</strong><p>MIPI RAW10/12/14 的位深固定。最后一组不足时，行最小字节公式仍按完整组计算；文件中缺少任一所需字节，该像素读取即返回缺失。字节序和有效位位置不会作用于 MIPI Packing。</p></aside>`,
  },
  {
    id: "cfa",
    group: "data",
    kicker: "空间采样语义",
    title: "Bayer、Quad CFA 与 Phase",
    summary: "CFA 不是颜色滤镜效果，而是每个坐标所代表的传感器采样站点。",
    level: "进阶",
    readingTime: "约 9 分钟",
    body: `
      <div class="help-prose"><h3>标准 Bayer 的 2×2 周期</h3><p>站点由坐标奇偶性决定。以 RGGB 为例，<code>(x mod 2, y mod 2)</code> 依次对应 R、Gr、Gb、B；Gr 表示位于红行的绿色，Gb 表示位于蓝行的绿色。</p></div>
      <div class="help-cfa-pair">
        <div><small>RGGB · 2×2</small><div class="help-cfa-grid size-2"><b class="r">R</b><b class="g">Gr</b><b class="g">Gb</b><b class="b">B</b></div></div>
        <div><small>Quad RGGB · 4×4</small><div class="help-cfa-grid size-4"><b class="r">R</b><b class="r">R</b><b class="g">Gr</b><b class="g">Gr</b><b class="r">R</b><b class="r">R</b><b class="g">Gr</b><b class="g">Gr</b><b class="g">Gb</b><b class="g">Gb</b><b class="b">B</b><b class="b">B</b><b class="g">Gb</b><b class="g">Gb</b><b class="b">B</b><b class="b">B</b></div></div>
      </div>
      <div class="help-prose"><h3>Quad CFA 的宏站点</h3><p>Quad CFA 把同色样本组成 2×2 块，因此基本周期为 4×4。Phase 表示文件坐标相对于该周期的偏移，X/Y 均为 0–3。</p></div>
      <div class="help-equation"><span>Quad 宏坐标</span><code>macroX = floor((((x + phaseX) mod 4) / 2))</code><code>macroY = floor((((y + phaseY) mod 4) / 2))</code><code>site(x,y) = BayerBase(macroX, macroY)</code></div>
      <div class="help-equation"><span>统计原子平面</span><code>atomicX = (x + phaseX) mod period</code><code>atomicY = (y + phaseY) mod period</code><code>period = MONO ? 1 : (Quad ? 4 : 2)</code></div>
      <div class="help-prose"><h3>裁剪后的 CFA</h3><p>裁剪改变输出图像左上角的坐标原点。标准 Bayer 导出会把裁剪偏移折算为新的 RGGB/BGGR/GBRG/GRBG；原始 Quad CFA 导出保留类型并更新 Phase。</p></div>
      <div class="help-equation"><span>Quad 原始裁剪</span><code>phaseX′ = (phaseX + cropX) mod 4</code><code>phaseY′ = (phaseY + cropY) mod 4</code></div>
      <aside class="help-callout"><strong>如何区分 CFA 错误与布局错误</strong><p>CFA 或 Phase 错误通常让颜色站点按 2×2 或 4×4 周期错置，但像素几何仍连续；rowStride 或 Packing 错误会让后续像素或行的字节位置持续偏移。</p></aside>`,
  },
  {
    id: "remosaic",
    group: "processing",
    kicker: "Quad CFA 处理",
    title: "Remosaic：重排与同色重建",
    summary: "将 Quad CFA 转为标准 Bayer 语义时，可以选择可逆重排或同色双线性重建。",
    level: "参考",
    readingTime: "约 11 分钟",
    body: `
      <div class="help-flow" aria-label="Remosaic processing flow"><span>Quad CFA DN</span><i>→</i><span>目标 Bayer 站点</span><i>→</i><span>坐标重排或同色重建</span><i>→</i><span>Bayer DN</span></div>
      <div class="help-prose"><h3>仅重排：4 点局部置换</h3><p>每个坐标轴独立执行相同置换。把局部坐标序列 <code>[0,1,2,3]</code> 变为 <code>[0,2,1,3]</code>，即交换中间两项；X/Y 组合后把 4×4 同色块重新排列为标准 Bayer 周期。该模式不插值 DN。</p></div>
      <div class="help-equation"><span>单轴源坐标</span><code>s = v + phase</code><code>block = 4 · floor(s / 4)</code><code>local = s mod 4</code><code>perm(local) = 2 · (local mod 2) + floor(local / 2)</code><code>source = block + perm(local) − phase</code></div>
      <div class="help-example"><small>局部映射</small><p>Phase 为 0 时，输出位置 0、1、2、3 分别读取源位置 0、2、1、3。二维映射对 X 和 Y 各执行一次，因此它是确定性的坐标置换，可以通过逆置换恢复站点顺序。</p></div>
      <div class="help-prose"><h3>同色双线性重建</h3><p>先确定输出坐标需要的 Bayer 站点，再在 Quad CFA 中寻找该站点在 X/Y 方向包围目标的合法坐标。四个组合角点按距离乘积加权；缺失角点不进入分子和分母。</p></div>
      <div class="help-equation"><span>二维权重</span><code>w(xᵢ,yⱼ) = wₓ(xᵢ) · wᵧ(yⱼ)</code><code>wₓ(x₀)=x₁−x,  wₓ(x₁)=x−x₀</code><code>wᵧ(y₀)=y₁−y,  wᵧ(y₁)=y−y₀</code><code>DN′ = round(Σ valid(DNᵢⱼ · wᵢⱼ) / Σ valid(wᵢⱼ))</code></div>
      <div class="help-prose"><h3>边缘与原位样本</h3><p>目标坐标本身已经是所需站点且可读时，直接保留原 DN。图像边缘只有单侧合法坐标时，该轴退化为单点权重 1；若最终没有任何有效权重，输出像素保持缺失。</p></div>
      <div class="help-impact"><strong>选择建议</strong><span>仅重排：验证站点与可逆格式转换</span><span>同色重建：观察空间连续性</span><span>二者都不做白平衡或颜色校正</span></div>
      <aside class="help-note"><strong>计算成本</strong><p>仅重排每个输出像素只定位并读取一个源 DN；同色重建需要搜索合法同色坐标并读取最多四个组合角点，因此在大图和频繁缩放时更慢。</p></aside>`,
  },
  {
    id: "demosaic",
    group: "processing",
    kicker: "从 Bayer 到 RGB",
    title: "双线性 Demosaic 的实际口径",
    summary: "每个像素保留自身采样通道，并从 3×3 邻域的同目标通道样本重建其它分量。",
    level: "参考",
    readingTime: "约 10 分钟",
    body: `
      <div class="help-prose"><h3>处理顺序</h3><p>标准 Bayer 直接进入 Demosaic；Quad CFA 先按当前 Remosaic 选项生成“处理后的 Bayer”，再执行相同插值。因此改变 Remosaic 会同时影响 Quad CFA 的 Demosaic 和 RGB 单通道结果。</p></div>
      <div class="help-equation"><span>目标通道集合</span><code>Nc(x,y) = { (u,v) ∈ 3×3 邻域 | (u,v)≠(x,y), channel(u,v)=c, DN 可读 }</code></div>
      <div class="help-equation"><span>通道重建</span><code>Cc(x,y) = nativeDN(x,y),  当当前位置就是通道 c</code><code>Cc(x,y) = floor(Σ(u,v)∈Nc DN(u,v) / |Nc|),  其它情况</code></div>
      <div class="help-card-grid">
        <article><h3>红/蓝站点上的绿色</h3><p>3×3 邻域筛选会得到上、下、左、右最多四个绿色样本，取可读样本算术平均。</p></article>
        <article><h3>红站点上的蓝色</h3><p>筛选得到最多四个对角蓝色样本；蓝站点上的红色同理。</p></article>
        <article><h3>绿色站点上的红或蓝</h3><p>根据 Gr/Gb 所在行，目标颜色来自水平或垂直方向最多两个相邻样本。</p></article>
        <article><h3>图像边缘与部分帧</h3><p>越界邻居跳过，缺失 DN 也跳过并重新按实际数量归一化；一个有效邻居即可给出结果，没有有效邻居则该 RGB 像素缺失。</p></article>
      </div>
      <div class="help-example"><small>示例 · 红站点重建绿色</small><p>若可读的上、左、右绿色 DN 分别为 510、506、514，而下方缺失，则 <code>G=floor((510+506+514)/3)=510</code>。缺失样本不会按 0 参加平均。</p></div>
      <div class="help-impact"><strong>算法边界</strong><span>输出仍处于传感器 DN 域</span><span>不含白平衡、CCM、Gamma、降噪或锐化</span><span>Demosaic RGB48 导出保留该重建口径</span></div>
      <aside class="help-callout"><strong>为什么它适合诊断而非成片</strong><p>双线性方法局部、确定、容易解释，适合检查 CFA、曝光和通道连续性；它不会抑制伪色或拉链，也不代表相机 ISP 的最终画质。</p></aside>`,
  },
  {
    id: "rendering",
    group: "processing",
    kicker: "DN 到屏幕",
    title: "显示归一化、瓦片与 LOD",
    summary: "预览是对 DN 的可交互表达；显示范围和 LOD 不应被误认为源数据变换。",
    level: "进阶",
    readingTime: "约 10 分钟",
    body: `
      <div class="help-prose"><h3>8-bit 预览归一化</h3><p>瓦片纹理最终使用 8-bit 通道。设显示下限为 <var>L</var>、上限为 <var>H</var>，先钳制 DN，再线性映射并进行整数四舍五入。上限设为 0 时按位深使用 <code>2^bitDepth−1</code>。</p></div>
      <div class="help-equation"><span>正常范围 H &gt; L</span><code>preview = floor(((clamp(DN,L,H)−L)·255 + (H−L)/2) / (H−L))</code></div>
      <div class="help-equation"><span>退化范围 H ≤ L</span><code>preview = DN &gt; L ? 255 : 0</code></div>
      <div class="help-prose"><h3>LOD 层级选择</h3><p>层级 <var>l</var> 的一个输出 texel 覆盖最多 <code>2^l × 2^l</code> 个源像素。100% 及以上始终使用 L0；缩小时由缩放率计算理想层级。</p></div>
      <div class="help-equation"><span>理想层级</span><code>maxLevel = min(30, ceil(log₂(max(width,height))))</code><code>ideal = clamp(log₂(1/zoom), 0, maxLevel)</code></div>
      <div class="help-card-grid">
        <article><h3>平滑型视图</h3><p>MONO、Demosaic 与 RGB 通道使用 <code>floor(ideal)</code> 和下一层，并按小数部分交叉淡化；淡化量小于 0.015 时只画精细层。</p></article>
        <article><h3>结构型视图</h3><p>彩色 RAW、CFA、Remosaic 不跨层淡化，避免把不同尺寸的 CFA 网格混色。层级在半级阈值外加 0.08 滞回后整体切换。</p></article>
        <article><h3>同站点聚合</h3><p>结构型 LOD 只平均输出位置对应的同一 CFA 站点。Quad CFA 的 L1 texel 对应一个原生 2×2 同色块，之后继续保持 Bayer 顺序。</p></article>
        <article><h3>平滑聚合</h3><p>其它视图在覆盖区域内分别累加有效通道。缺失源像素不进入均值；没有任何有效样本时保持缺失。</p></article>
      </div>
      <div class="help-prose"><h3>缺失像素与图像外部</h3><p>预览内部用不同标记区分“图像范围内但源字节不可读”和“图像边界外”。前者由主题化棋盘或纯色表示，后者保持透明；棋盘相位基于全局图像坐标，跨瓦片连续。</p></div>
      <aside class="help-note"><strong>完整预览图</strong><p>完整预览选择长边不超过 4096 px 的最高分辨率 LOD。它适合共享当前显示语义，不替代 L0 原始 DN 导出或精确统计。</p></aside>`,
  },
  {
    id: "inspection",
    group: "analysis",
    kicker: "精确定位",
    title: "像素检查、ROI 与缺失数据",
    summary: "把屏幕上的位置可靠地还原为包含式图像坐标和可解释的 DN。",
    level: "入门",
    readingTime: "约 7 分钟",
    body: `
      <div class="help-card-grid">
        <article><h3>高倍率像素值</h3><p>RAW、CFA 和 Remosaic 显示当前站点的单个 DN；R/G/B 显示对应重建通道；Demosaic 可按设置显示原始站点 DN 或三行 R/G/B 重建值。</p></article>
        <article><h3>网格与数值分离</h3><p>关闭像素值会停止额外 DN 检查请求并隐藏文字，但像素网格仍可保留。网格颜色和通道着色只影响画面呈现。</p></article>
        <article><h3>鼠标 ROI</h3><p>按 <kbd>R</kbd> 后持续使用右键拖动。短距离右键仍打开主画布菜单；拖动可从图像外开始，端点会钳制到图像边缘。</p></article>
        <article><h3>坐标 ROI</h3><p><kbd>Shift</kbd><kbd>R</kbd> 输入左上和右下端点。坐标从 (0,0) 开始，两端均包含；反向、非整数或越界坐标会被拒绝。</p></article>
      </div>
      <div class="help-equation"><span>包含式端点转矩形</span><code>width = xEnd − xStart + 1</code><code>height = yEnd − yStart + 1</code><code>要求 0 ≤ xStart ≤ xEnd &lt; imageWidth</code><code>要求 0 ≤ yStart ≤ yEnd &lt; imageHeight</code></div>
      <div class="help-example"><small>示例</small><p>从 <code>(10,20)</code> 到 <code>(12,21)</code> 的 ROI 宽 3、高 2，共期望 6 个像素；不是 2×1。彩色 CFA 各语义组的 expected 数量则由这 6 个绝对坐标上的站点决定。</p></div>
      <aside class="help-callout"><strong>缺失并不等于零</strong><p>不可读取的像素没有 DN。预览用缺失外观标记，统计把它计入 missing 但不计入均值，导出则使用单独指定的缺失填充值。三者不能互相替代。</p></aside>`,
  },
  {
    id: "statistics",
    group: "analysis",
    kicker: "精确计算口径",
    title: "Histogram、均值、方差与百分位",
    summary: "统计对当前帧的 L0 原始 CFA DN 做一次顺序扫描，并保留缺失样本的可追踪性。",
    level: "参考",
    readingTime: "约 12 分钟",
    body: `
      <div class="help-prose"><h3>数据范围与分组</h3><p>没有 ROI 时扫描整帧；有 ROI 时只扫描该包含式矩形。统计不读取屏幕 8-bit 值、不读取 LOD，也不读取 Demosaic RGB。MONO 提供 All/Y；彩色 CFA 提供 All、R、G、Gr、Gb、B。</p></div>
      <div class="help-equation"><span>计数关系</span><code>missing = expected − valid</code><code>expected：属于该组的坐标数</code><code>valid：其中成功读取 DN 的坐标数</code></div>
      <div class="help-prose"><h3>在线均值与总体方差</h3><p>为避免先求和再平方带来的精度损失，扫描使用 Welford 在线更新。这里计算的是当前 ROI 有效样本总体的描述性方差，分母是 <var>n</var>，不是无偏样本方差的 <var>n−1</var>。</p></div>
      <div class="help-equation"><span>第 n 个有效 DN：xₙ</span><code>δ = xₙ − μₙ₋₁</code><code>μₙ = μₙ₋₁ + δ / n</code><code>M2ₙ = M2ₙ₋₁ + δ · (xₙ − μₙ)</code><code>variance = M2ₙ / n</code><code>standardDeviation = √variance</code></div>
      <div class="help-prose"><h3>精确 Histogram 与离散百分位</h3><p>位深为 <var>b</var> 时建立 <code>2^b</code> 个精确 DN 桶，DN 直接作为索引。最小值和最大值是首个/最后一个非零桶；众数出现并列时取较小 DN。</p></div>
      <div class="help-equation"><span>p 百分位，p∈[0,100]</span><code>rank = floor((n−1) · p / 100)</code><code>percentile = 第一个使 cumulativeCount &gt; rank 的 DN</code></div>
      <div class="help-example"><small>示例 · 总体方差</small><p>有效 DN 为 2、4、6 时，均值为 4；总体方差为 <code>((2−4)²+(4−4)²+(6−4)²)/3 = 8/3</code>，标准差约 1.633。若另有一个缺失坐标，则 expected=4、valid=3、missing=1，但上述数值不把缺失当 0。</p></div>
      <div class="help-prose"><h3>Row / Column Profile</h3><p>每一行、每一列和每个语义组都维护同样的 expected、valid、mean 和总体标准差。坐标保留整幅图绝对坐标，因此 ROI 从 (100,200) 开始时，Profile 也从列 100、行 200 开始。</p></div>
      <aside class="help-callout"><strong>测量边界</strong><p>这些结果是单帧、单 ROI 的描述性统计，不包含多帧 temporal noise、曝光线性序列、暗场/平场条件或 EMVA 1288 的完整测量流程。</p></aside>`,
  },
  {
    id: "charts",
    group: "analysis",
    kicker: "精确数据的可视化",
    title: "统计图表的聚合与阅读",
    summary: "后端结果保持精确；前端只在绘制超大数组时使用有界、可追踪的显示降采样。",
    level: "进阶",
    readingTime: "约 8 分钟",
    body: `
      <div class="help-prose"><h3>Histogram 显示桶</h3><p>精确 Histogram 可能有 65,536 个桶。绘图最多使用 4096 个连续显示桶；每个显示点累加一段原始 DN 桶，X 坐标取该段起止 DN 的中点，Tooltip 保留起止范围。</p></div>
      <div class="help-equation"><span>显示聚合</span><code>bucketSize = max(1, ceil(exactBinCount / 4096))</code><code>displayCount[k] = Σ exactCount[i],  i∈[startₖ,endₖ]</code><code>displayX[k] = (startₖ + endₖ) / 2</code></div>
      <div class="help-prose"><h3>Profile min/max envelope</h3><p>当前可见范围不超过 4096 个有效点时全部绘制。超出时保留首尾点，并把内部范围分桶；每桶按原坐标顺序输出最小值和最大值，从而保留窄尖峰，而不是简单等间隔抽点。</p></div>
      <div class="help-equation"><span>点数上限</span><code>bucketCount = floor((limit − 2) / 2)</code><code>result = first + 每桶(min,max，按坐标排序) + last</code><code>limit = 4096</code></div>
      <div class="help-card-grid">
        <article><h3>缩放恢复原始点</h3><p>横轴缩放到较小范围后，会从精确 Profile 中重新筛选该范围；若点数低于上限，显示全部真实点。</p></article>
        <article><h3>采样标记</h3><p>只有可见真实点不超过 512，且平均屏幕间距至少 5 px 时才显示标记，避免标记覆盖曲线。</p></article>
        <article><h3>滚轮约定</h3><p>普通滚轮滚动页面；<kbd>Ctrl</kbd>+滚轮缩放横轴，<kbd>Shift</kbd>+滚轮缩放纵轴，同时按下则缩放双轴。</p></article>
        <article><h3>曲线与状态</h3><p>各图表的曲线显隐、横纵范围和布局高度独立保存。切换载体不会重新扫描 RAW，也不会改变 ROI。</p></article>
      </div>
      <aside class="help-note"><strong>显示降采样不改变摘要</strong><p>均值、方差、百分位和计数始终来自精确统计；图表聚合只控制送入绘图库的点数，不回写统计结果。</p></aside>`,
  },
  {
    id: "export",
    group: "analysis",
    kicker: "确定性输出",
    title: "裁剪、数值映射与安全写入",
    summary: "导出冻结来源快照，明确处理位深转换、缺失填充、CFA 更新和目标文件替换。",
    level: "参考",
    readingTime: "约 11 分钟",
    body: `
      <div class="help-table-wrap"><table><thead><tr><th>目标</th><th>数据语义</th><th>关键限制</th></tr></thead><tbody>
        <tr><td>原始 CFA</td><td>裁剪后的源 DN，可转换 Packing、位深、字节序和对齐</td><td>保留 Bayer/Quad CFA 语义并更新排列或 Phase</td></tr>
        <tr><td>Remosaic Bayer</td><td>当前重排或同色重建得到的标准 Bayer DN</td><td>只接受 Quad CFA 来源；输出 Phase 为 0</td></tr>
        <tr><td>Demosaic RGB48</td><td>当前双线性处理得到的 R、G、B 交错值</td><td>每通道 16-bit 容器、每像素 6 B；不接受 MONO</td></tr>
      </tbody></table></div>
      <div class="help-prose"><h3>位深映射</h3><p>Preserve 直接保留 DN；超过目标满量程时钳制并累计 clipped 数量。Scale Full Range 把源位深满量程线性映射到目标位深满量程，并做整数四舍五入。</p></div>
      <div class="help-equation"><span>满量程</span><code>sourceMax = 2^sourceDepth − 1</code><code>targetMax = 2^targetDepth − 1</code></div>
      <div class="help-equation"><span>Preserve / Scale</span><code>preserve = min(DN, targetMax)</code><code>scale = floor((DN · targetMax + sourceMax/2) / sourceMax)</code></div>
      <div class="help-prose"><h3>输出布局</h3><p>非 RGB 输出沿用对应 Packing 的行字节公式；RGB48 固定为 <code>cropWidth×6</code> 字节。行大小先按 rowAlignment 对齐，再乘裁剪高度并按 frameAlignment 对齐，padding 写 0。</p></div>
      <div class="help-equation"><span>导出大小</span><code>rowStrideOut = alignUp(rowBytesOut, rowAlignment)</code><code>frameBytesOut = rowStrideOut · cropHeight</code><code>bytesWritten = alignUp(frameBytesOut, frameAlignment)</code></div>
      <div class="help-prose"><h3>缺失填充</h3><p>原始 CFA 和 Remosaic 可按目标站点使用独立填充值；Demosaic 的缺失 RGB 使用 R、B 以及 <code>round((Gr+Gb)/2)</code>。填充值必须落在输出满量程内。</p></div>
      <div class="help-prose"><h3>原子替换策略</h3><p>导出先在目标目录创建唯一临时文件。完整写入并刷新后才提交；若目标已存在，先改名为临时备份，再将新文件改名到目标。提交失败时尝试恢复原文件；取消或写入失败会删除临时文件。</p></div>
      <aside class="help-callout"><strong>安全约束</strong><p>不能覆盖当前打开的源文件；裁剪必须在图像范围内；固定 Packing 必须使用匹配位深；导出期间来源 generation 或快照失效会拒绝旧任务。</p></aside>`,
  },
  {
    id: "boundaries",
    group: "reference",
    kicker: "可靠性契约",
    title: "边界检查、性能与排错",
    summary: "把警告视为对结果可信度的说明，并按症状定位描述符、数据完整性或算法边界。",
    level: "参考",
    readingTime: "约 8 分钟",
    body: `
      <div class="help-table-wrap"><table><thead><tr><th>现象</th><th>优先检查</th><th>原因解释</th></tr></thead><tbody>
        <tr><td>每行逐渐斜切、周期性断裂</td><td>Packing、宽度、rowStride</td><td>后续行的起始字节位置错误</td></tr>
        <tr><td>几何连续但颜色站点错位</td><td>CFA 类型、Quad Phase</td><td>字节读取正确，空间采样语义错误</td></tr>
        <tr><td>帧尾出现棋盘或纯色</td><td>文件大小、frameStride、尾帧</td><td>部分帧中相应像素字节不存在</td></tr>
        <tr><td>Demosaic 边缘颜色不稳定</td><td>边界邻居、缺失样本、CFA</td><td>边缘可用邻居少，错误 CFA 会筛错目标通道</td></tr>
        <tr><td>统计 valid 小于 expected</td><td>ROI 覆盖的源字节范围</td><td>缺失样本被显式计数但不参与数值统计</td></tr>
        <tr><td>导出被拒绝</td><td>裁剪、目标兼容性、位深、来源状态</td><td>导出使用比预览更严格的确定性校验</td></tr>
      </tbody></table></div>
      <div class="help-checklist"><h3>重要输入边界</h3><ul><li>有效宽度 1–25000，高度 1–20000。</li><li>可配置位深 8–16；MIPI RAW10/12/14 使用固定位深。</li><li>Quad CFA Phase X/Y 为 0–3。</li><li>ROI 宽高必须大于 0，端点必须为整数且在图像内。</li><li>所有地址、乘法、坐标相加和输出大小都会检查溢出。</li><li>瓦片尺寸在后端限制为 64–1024，LOD 最大为 30。</li></ul></div>
      <div class="help-checklist"><h3>性能判断</h3><ul><li>同色重建比坐标重排需要更多读取和计算。</li><li>统计扫描 L0 ROI，耗时大致随有效 ROI 像素数增长。</li><li>纹理缓存只改变重复查看的响应与内存占用，不改变结果。</li><li>旧渲染、统计和导出任务使用 revision/generation 协作取消，不能覆盖新状态。</li></ul></div>
      <div class="help-faq">
        <details open><summary>为什么预览能显示，导出却失败？</summary><p>预览允许对短步长和部分帧尽力读取并给出诊断；导出必须保证目标布局、位深、裁剪和来源快照确定，因此校验更严格。</p></details>
        <details><summary>为什么显示范围改变后统计不变？</summary><p>显示范围只把 DN 映射到屏幕 8-bit。统计始终读取 L0 原始 DN，不使用屏幕值。</p></details>
        <details><summary>为什么不同 LOD 的 CFA 图不会平滑淡化？</summary><p>不同层级代表不同大小的采样网格，交叉淡化会视觉混合 CFA 站点；结构型视图因此整层切换。</p></details>
      </div>`,
  },
  {
    id: "glossary",
    group: "reference",
    kicker: "术语与能力边界",
    title: "术语表与结果解释",
    summary: "统一 RAW 工作流中的关键术语，并说明哪些结论可以从 eRAW 得出。",
    level: "入门",
    readingTime: "约 7 分钟",
    body: `
      <div class="help-definition-grid">
        <article><strong>DN</strong><p>Digital Number。像素解包并提取有效位后的整数码值，不等同于光子数、电子数或显示亮度。</p></article>
        <article><strong>Packing</strong><p>多个像素位如何装入连续字节。它决定组大小和解码公式，不描述 CFA 颜色。</p></article>
        <article><strong>Stride</strong><p>相邻行或帧起点间的字节距离，可以大于有效数据以包含 padding。</p></article>
        <article><strong>CFA</strong><p>Color Filter Array。坐标对应的颜色采样站点；Bayer 周期 2×2，Quad CFA 周期 4×4。</p></article>
        <article><strong>Phase</strong><p>文件坐标相对于 Quad CFA 基本周期的偏移。裁剪改变原点，因此可能改变 Phase。</p></article>
        <article><strong>Remosaic</strong><p>把 Quad CFA 组织成标准 Bayer 语义的过程；当前提供坐标重排和同色双线性重建。</p></article>
        <article><strong>Demosaic</strong><p>从单色采样站点重建每像素 RGB 分量。当前实现为局部双线性方法。</p></article>
        <article><strong>LOD</strong><p>Level of Detail。缩小时使用的多层预览；结构型视图保持 CFA 站点，不把它当普通彩色图平均。</p></article>
        <article><strong>ROI</strong><p>Region of Interest。统计或检查关注的包含式矩形区域，使用整幅图绝对坐标。</p></article>
        <article><strong>RGB48</strong><p>R/G/B 交错输出，每通道使用 16-bit 容器，每像素共 48 bit。</p></article>
        <article><strong>总体方差</strong><p>以当前有效样本集合本身作为总体，分母为 n；不同于用 n−1 的无偏样本方差。</p></article>
        <article><strong>缺失样本</strong><p>坐标有效但所需源字节不可读取。它没有 DN，不应自动解释为 0。</p></article>
      </div>
      <div class="help-impact"><strong>可以可靠回答</strong><span>当前描述符如何解释字节</span><span>当前帧/ROI 的原始 DN 分布</span><span>当前算法与参数会产生什么确定性输出</span></div>
      <div class="help-impact muted"><strong>不能单独回答</strong><span>未知文件真实格式是什么</span><span>传感器完整噪声与线性性能</span><span>相机 ISP 的最终颜色和画质</span></div>
      <aside class="help-note"><strong>手册版本</strong><p>本中文技术参考与 eRAW V0.5.2 当前实现同步。后续增加 Packing、处理算法或统计口径时，应把手册公式、测试和程序版本作为同一项变更维护。</p></aside>`,
  },
];
