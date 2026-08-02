import {
  HELP_GROUPS,
  HELP_SECTIONS,
  equation,
  type HelpGroup,
  type HelpGroupId,
  type HelpSection,
} from "./help-content";
import type { ResolvedLocale } from "./i18n";

export interface HelpUiText {
  readonly manualTitle: string;
  readonly subtitle: string;
  readonly navigationLabel: string;
  readonly home: string;
  readonly previous: string;
  readonly next: string;
  readonly first: string;
  readonly last: string;
  readonly article: string;
}

export interface HelpCatalog {
  readonly groups: readonly HelpGroup[];
  readonly sections: readonly HelpSection[];
  readonly ui: HelpUiText;
}

type NonChineseLocale = Exclude<ResolvedLocale, "zh-CN">;
type AdmonitionKind = "tip" | "warning" | "danger" | "supplement";
type SectionId = typeof SECTION_IDS[number];

interface SectionCopy {
  readonly kicker: string;
  readonly title: string;
  readonly summary: string;
  readonly level: string;
  readonly readingTime: string;
  readonly blocks: readonly { readonly title: string; readonly text: string }[];
  readonly formulaHeading?: string;
  readonly formulaLabels?: readonly string[];
  readonly note: { readonly kind: AdmonitionKind; readonly title: string; readonly text: string };
}

interface LocaleCopy {
  readonly groupTitles: Readonly<Record<HelpGroupId, string>>;
  readonly ui: HelpUiText;
  readonly admonitionLabels: Readonly<Record<AdmonitionKind, string>>;
  readonly sections: Readonly<Record<SectionId, SectionCopy>>;
}

const SECTION_IDS = [
  "start", "workflow", "layout", "packing", "cfa", "remosaic", "demosaic",
  "rendering", "inspection", "statistics", "charts", "export", "boundaries", "glossary",
] as const;

const FORMULAS: Partial<Record<SectionId, readonly (readonly string[])[]>> = {
  layout: [
    [String.raw`\mathrm{rowBytes}=W`],
    [String.raw`\mathrm{rowBytes}=2W`],
    [String.raw`\mathrm{rowBytes}=5\left\lceil\frac{W}{4}\right\rceil`],
    [String.raw`\mathrm{rowBytes}=3\left\lceil\frac{W}{2}\right\rceil`],
    [String.raw`\mathrm{rowBytes}=7\left\lceil\frac{W}{4}\right\rceil`],
    [String.raw`\operatorname{alignUp}(v,a)=v+\left((a-(v\bmod a))\bmod a\right)`],
    [String.raw`\begin{aligned}\mathrm{rowStride}&=\operatorname{alignUp}(\mathrm{rowBytes},\mathrm{rowAlignment})\\\mathrm{frameBytes}&=\mathrm{rowStride}\cdot H\\\mathrm{frameStride}&=\operatorname{alignUp}(\mathrm{frameBytes},\mathrm{frameAlignment})\end{aligned}`],
    [String.raw`\begin{aligned}\mathrm{available}&=\max(\mathrm{fileSize}-\mathrm{headerOffset},0)\\\mathrm{complete}&=\left\lfloor\frac{\mathrm{available}}{\mathrm{frameStride}}\right\rfloor\\\mathrm{trailing}&=\mathrm{available}\bmod\mathrm{frameStride}\\\mathrm{frameCount}&=\mathrm{complete}+\mathbf{1}_{\mathrm{trailing}>0}\end{aligned}`],
  ],
  packing: [
    [String.raw`\begin{aligned}d&=\operatorname{clamp}(\mathrm{bitDepth},1,\mathrm{containerBits})\\v'&=\begin{cases}v\gg(\mathrm{containerBits}-d),&\text{MSB aligned}\\v,&\text{otherwise}\end{cases}\\\mathrm{DN}&=v'\mathbin{\&}(2^d-1)\end{aligned}`],
    [String.raw`\mathrm{DN}_i=(B_i\ll2)\;\vert\;\left((B_4\gg2i)\mathbin{\&}\mathrm{0x03}\right)`],
    [String.raw`\begin{aligned}\mathrm{DN}_0&=(B_0\ll4)\;\vert\;(B_2\mathbin{\&}\mathrm{0x0F})\\\mathrm{DN}_1&=(B_1\ll4)\;\vert\;((B_2\gg4)\mathbin{\&}\mathrm{0x0F})\end{aligned}`],
    [String.raw`\begin{aligned}L_0&=B_4\mathbin{\&}\mathrm{0x3F}\\L_1&=((B_4\gg6)\mathbin{\&}\mathrm{0x03})\;\vert\;((B_5\mathbin{\&}\mathrm{0x0F})\ll2)\\L_2&=((B_5\gg4)\mathbin{\&}\mathrm{0x0F})\;\vert\;((B_6\mathbin{\&}\mathrm{0x03})\ll4)\\L_3&=(B_6\gg2)\mathbin{\&}\mathrm{0x3F}\\\mathrm{DN}_i&=(B_i\ll6)\;\vert\;L_i\end{aligned}`],
  ],
  cfa: [
    [String.raw`\begin{aligned}m_x&=\left\lfloor\frac{(x+p_x)\bmod4}{2}\right\rfloor\\m_y&=\left\lfloor\frac{(y+p_y)\bmod4}{2}\right\rfloor\\\operatorname{site}(x,y)&=\operatorname{BayerBase}(m_x,m_y)\end{aligned}`],
    [String.raw`\begin{aligned}a_x&=(x+p_x)\bmod P\\a_y&=(y+p_y)\bmod P\\P&=\begin{cases}1,&\mathrm{MONO}\\4,&\mathrm{Quad\ CFA}\\2,&\mathrm{Bayer}\end{cases}\end{aligned}`],
    [String.raw`p_x'=(p_x+\mathrm{cropX})\bmod4`, String.raw`p_y'=(p_y+\mathrm{cropY})\bmod4`],
  ],
  remosaic: [
    [String.raw`\begin{aligned}s&=v+p\\b&=4\left\lfloor\frac{s}{4}\right\rfloor\\\ell&=s\bmod4\\\pi(\ell)&=2(\ell\bmod2)+\left\lfloor\frac{\ell}{2}\right\rfloor\\v_{\mathrm{src}}&=b+\pi(\ell)-p\end{aligned}`],
    [String.raw`\begin{aligned}w_{ij}&=w_x(x_i)w_y(y_j)\\w_x(x_0)&=x_1-x,&w_x(x_1)&=x-x_0\\w_y(y_0)&=y_1-y,&w_y(y_1)&=y-y_0\\\mathrm{DN}'&=\operatorname{round}\!\left(\frac{\sum_{(i,j)\in V}\mathrm{DN}_{ij}w_{ij}}{\sum_{(i,j)\in V}w_{ij}}\right)\end{aligned}`],
  ],
  demosaic: [
    [String.raw`N_c(x,y)=\left\{(u,v)\in\mathcal{N}_{3\times3}(x,y)\;\middle|\;(u,v)\ne(x,y),\ \operatorname{channel}(u,v)=c,\ \mathrm{DN}(u,v)\ \mathrm{valid}\right\}`],
    [String.raw`C_c(x,y)=\begin{cases}\mathrm{DN}(x,y),&\operatorname{channel}(x,y)=c\\\left\lfloor\dfrac{\sum_{(u,v)\in N_c(x,y)}\mathrm{DN}(u,v)}{|N_c(x,y)|}\right\rfloor,&|N_c(x,y)|>0\end{cases}`],
  ],
  rendering: [
    [String.raw`\mathrm{preview}=\left\lfloor\frac{(\operatorname{clamp}(\mathrm{DN},L,H)-L)\cdot255+\frac{H-L}{2}}{H-L}\right\rfloor`],
    [String.raw`\mathrm{preview}=\begin{cases}255,&\mathrm{DN}>L\\0,&\mathrm{DN}\le L\end{cases}`],
    [String.raw`\begin{aligned}\ell_{\max}&=\min\!\left(30,\left\lceil\log_2(\max(W,H))\right\rceil\right)\\\ell_{\mathrm{ideal}}&=\operatorname{clamp}\!\left(\log_2\frac{1}{z},0,\ell_{\max}\right)\end{aligned}`],
  ],
  inspection: [
    [String.raw`\begin{aligned}W_{\mathrm{ROI}}&=x_1-x_0+1,\quad 0\le x_0\le x_1<W\\H_{\mathrm{ROI}}&=y_1-y_0+1,\quad 0\le y_0\le y_1<H\end{aligned}`],
  ],
  statistics: [
    [String.raw`n_{\mathrm{missing}}=n_{\mathrm{expected}}-n_{\mathrm{valid}}`],
    [String.raw`\begin{aligned}\delta_n&=x_n-\mu_{n-1}\\\mu_n&=\mu_{n-1}+\frac{\delta_n}{n}\\M_{2,n}&=M_{2,n-1}+\delta_n(x_n-\mu_n)\\\sigma^2&=\frac{M_{2,n}}{n},&\sigma&=\sqrt{\sigma^2}\end{aligned}`],
    [String.raw`r_p=\left\lfloor\frac{(n-1)p}{100}\right\rfloor`, String.raw`Q_p=\min\left\{d\;\middle|\;\sum_{k=0}^{d}h_k>r_p\right\}`],
  ],
  charts: [
    [String.raw`\begin{aligned}s&=\max\!\left(1,\left\lceil\frac{N_{\mathrm{bin}}}{4096}\right\rceil\right)\\H_k&=\sum_{i=a_k}^{b_k}h_i\\X_k&=\frac{a_k+b_k}{2}\end{aligned}`],
    [String.raw`B=\left\lfloor\frac{L-2}{2}\right\rfloor,\qquad L=4096`, String.raw`\mathcal{R}=\{p_{\mathrm{first}}\}\cup\bigcup_{k=1}^{B}\{p_{\min,k},p_{\max,k}\}_{\mathrm{ordered}}\cup\{p_{\mathrm{last}}\}`],
  ],
  export: [
    [String.raw`S_{\max}=2^{d_s}-1,\qquad T_{\max}=2^{d_t}-1`],
    [String.raw`\mathrm{DN}_{\mathrm{preserve}}=\min(\mathrm{DN},T_{\max})`, String.raw`\mathrm{DN}_{\mathrm{scale}}=\left\lfloor\frac{\mathrm{DN}\cdot T_{\max}+S_{\max}/2}{\max(S_{\max},1)}\right\rfloor`],
    [String.raw`\begin{aligned}R_{\mathrm{stride}}&=\operatorname{alignUp}(R_{\mathrm{bytes}},A_r)\\F_{\mathrm{bytes}}&=R_{\mathrm{stride}}\cdot H_{\mathrm{crop}}\\B_{\mathrm{written}}&=\operatorname{alignUp}(F_{\mathrm{bytes}},A_f)\end{aligned}`],
  ],
};

function localizedBody(copy: SectionCopy, id: SectionId, labels: LocaleCopy["admonitionLabels"]): string {
  const prose = copy.blocks
    .map((block) => `<div class="help-prose"><h3>${block.title}</h3><p>${block.text}</p></div>`)
    .join("");
  const formulaGroups = FORMULAS[id] ?? [];
  const formulas = formulaGroups.length === 0 ? "" : `
    <div class="help-prose"><h3>${copy.formulaHeading ?? "Formulae"}</h3></div>
    ${formulaGroups.map((expressions, index) => equation(copy.formulaLabels?.[index] ?? `(${index + 1})`, ...expressions)).join("")}`;
  const note = `<aside class="help-admonition ${copy.note.kind}"><header><small>${labels[copy.note.kind]}</small><strong>${copy.note.title}</strong></header><p>${copy.note.text}</p></aside>`;
  return `${prose}${formulas}${note}`;
}

function buildCatalog(locale: NonChineseLocale, copy: LocaleCopy): HelpCatalog {
  const groups = HELP_GROUPS.map((group) => ({ id: group.id, title: copy.groupTitles[group.id] }));
  const sections = HELP_SECTIONS.map((section) => {
    const localized = copy.sections[section.id as SectionId];
    return {
      id: section.id,
      group: section.group,
      kicker: localized.kicker,
      title: localized.title,
      summary: localized.summary,
      level: localized.level,
      readingTime: localized.readingTime,
      body: localizedBody(localized, section.id as SectionId, copy.admonitionLabels),
    } satisfies HelpSection;
  });
  void locale;
  return { groups, sections, ui: copy.ui };
}

const EN_COPY: LocaleCopy = {
  groupTitles: { guide: "Using eRAW", data: "Interpreting data", processing: "Processing and display", analysis: "Analysis and output", reference: "Boundaries and reference" },
  ui: {
    manualTitle: "User Manual", subtitle: "Technical reference · English", navigationLabel: "User manual contents",
    home: "Manual home", previous: "Previous", next: "Next", first: "This is the first article", last: "This is the last article",
    article: "Article {current} / {total}",
  },
  admonitionLabels: { tip: "TIP", warning: "WARNING", danger: "ERROR AND RISK", supplement: "ADDITIONAL NOTE" },
  sections: {
    start: {
      kicker: "READING PATH", title: "How to use this technical manual", summary: "Start with a reproducible RAW inspection, then move to the data, algorithm, statistics, or export topic that matches your task.", level: "Getting started", readingTime: "About 4 min",
      blocks: [
        { title: "Describe the bytes", text: "eRAW does not guess an unknown file format. Open the file with <code>Ctrl+O</code>, then record width, height, Packing, bit depth, CFA, Phase, offsets, and strides. The descriptor is the contract that turns bytes into pixel coordinates and DN values." },
        { title: "Validate before interpreting", text: "Check RAW intensity first for continuous rows and frames. Then inspect CFA color sites and Phase. A recognizable picture is not proof that the descriptor is correct; periodic skew, duplicated rows, or repeating color errors are stronger diagnostic signals." },
        { title: "Measure and freeze", text: "Inspect L0 DN at high zoom or compute Histogram and Profiles over an inclusive ROI. Before export, freeze the file, frame, descriptor, processing mode, crop, and target bit depth so that the result remains reproducible." },
      ],
      note: { kind: "tip", title: "Keep a minimum experiment record", text: "Record a source checksum, dimensions, Packing, bit depth, CFA/Phase, frame, ROI, and export settings. Results are comparable only when their input conditions can be reproduced." },
    },
    workflow: {
      kicker: "OPERATING MODEL", title: "File sessions, canvas, and shortcuts", summary: "Understand the relationship between the current document, frame, and viewing state so stale results are not carried into a new file.", level: "Getting started", readingTime: "About 6 min",
      blocks: [
        { title: "Document lifetime", text: "Only one RAW document is active at a time. Opening another file or successfully applying a new descriptor invalidates old tiles and statistics. <code>Ctrl+W</code> closes the document and releases its read-only mapping while preserving saved application preferences." },
        { title: "View and ROI", text: "The wheel zooms around the image point under the pointer and left drag pans. <code>Ctrl+0</code> fits the image; <code>Ctrl+1</code> returns to 100%. Frame changes of the same dimensions retain the view, while a dimension change clears coordinate-dependent ROI state." },
        { title: "Task shortcuts", text: "Use <code>R</code> or <code>Shift+R</code> for mouse or coordinate ROI, <code>P</code> to locate a pixel, <code>Ctrl+I</code> for statistics, <code>Ctrl+E</code> for deterministic export, <code>F11</code> for native fullscreen, and <code>F1</code> for this manual." },
      ],
      note: { kind: "supplement", title: "Settings do not change sensor data", text: "Theme, language, font size, sidebar position, wheel speed, cache level, and reduced motion affect interaction or resource use only. They do not change source bytes, DN, CFA semantics, statistics, or deterministic export." },
    },
    layout: {
      kicker: "FROM FILE TO FRAME", title: "File layout, strides, and frame count", summary: "Use explicit byte equations to locate every frame, row, and packed pixel group.", level: "Advanced", readingTime: "About 9 min",
      blocks: [
        { title: "Minimum row size", text: "Packing defines the minimum bytes required for an active width <code>W</code>. Ceiling division means that an incomplete final MIPI pixel group still occupies a complete storage group." },
        { title: "Alignment and explicit strides", text: "An alignment below 1 is treated as 1. Automatic layout is used only when the explicit stride is zero. A non-zero user stride remains authoritative even when it is short enough to overlap rows or frames; the preview reports the risk and attempts a bounded read." },
        { title: "Partial final frame", text: "The header offset is removed before counting frames. Any trailing bytes after complete frames create one inspectable partial frame. Pixels whose required source bytes do not exist become missing samples rather than fabricated zeroes." },
      ],
      formulaHeading: "Byte layout equations", formulaLabels: ["Unpacked8", "Unpacked16", "MIPI RAW10", "MIPI RAW12", "MIPI RAW14", "Alignment", "Automatic layout", "Frame count"],
      note: { kind: "warning", title: "Recommended diagnostic order", text: "For diagonal tearing or periodic displacement, check width, Packing, rowStride, and headerOffset in that order. Check frameStride when frames interfere. A CFA error changes site colors but normally does not make byte positions drift across a row." },
    },
    packing: {
      kicker: "FROM BYTES TO DN", title: "Unpacked and MIPI RAW decoding", summary: "See how bit depth, endianness, valid-bit alignment, and MIPI groups produce an integer sensor DN.", level: "Reference", readingTime: "About 10 min",
      blocks: [
        { title: "Unpacked containers", text: "Unpacked8 reads one byte per pixel. Unpacked16 combines two bytes using the selected endian order. MSB alignment applies only to Unpacked data; the extracted value is then masked to the effective bit depth." },
        { title: "MIPI RAW10 and RAW12", text: "RAW10 stores four high-byte parts followed by four 2-bit tails in a fifth byte. RAW12 stores two high-byte parts and two 4-bit tails in a third byte. Byte order and valid-bit position controls do not apply to these fixed Packing formats." },
        { title: "MIPI RAW14", text: "RAW14 uses seven bytes for four pixels. <code>B0–B3</code> carry the upper eight bits and <code>B4–B6</code> carry four contiguous six-bit tails. The equations below show the exact low-bit reconstruction." },
      ],
      formulaHeading: "Decoding equations", formulaLabels: ["Effective-bit extraction", "RAW10 pixel i", "RAW12 pair", "RAW14 low-bit assembly"],
      note: { kind: "danger", title: "Truncated groups are missing data", text: "MIPI RAW10/12/14 use fixed bit depths. The last partial group still requires the full group byte count; if any required byte is absent, that pixel is missing. It must not be silently interpreted as DN 0." },
    },
    cfa: {
      kicker: "SPATIAL SAMPLING", title: "Bayer, Quad CFA, and Phase", summary: "A CFA describes the sensor sample represented by each coordinate, not a display tint.", level: "Advanced", readingTime: "About 9 min",
      blocks: [
        { title: "Bayer and Quad periods", text: "Standard Bayer uses a 2×2 coordinate-parity period. Quad CFA expands each same-color sample into a 2×2 block, producing a 4×4 base period. Gr and Gb remain distinct green sites for analysis." },
        { title: "Phase", text: "Phase is the file-coordinate offset into the Quad CFA period. Both axes are in the range 0–3. Statistics retain the sixteen atomic Quad planes and merge them into semantic R, Gr, Gb, and B groups only for presentation." },
        { title: "Cropping changes the origin", text: "A crop moves the output coordinate origin. Standard Bayer export folds an odd crop into a new RGGB/BGGR/GBRG/GRBG pattern. Original Quad export preserves the CFA type and updates Phase modulo four." },
      ],
      formulaHeading: "Site equations", formulaLabels: ["Quad macro-coordinate", "Atomic statistics plane", "Quad crop Phase"],
      note: { kind: "tip", title: "Distinguish CFA errors from layout errors", text: "CFA or Phase errors repeat on a 2×2 or 4×4 cycle while geometry stays continuous. Packing or rowStride errors make later bytes and rows drift from their intended coordinates." },
    },
    remosaic: {
      kicker: "QUAD CFA PROCESSING", title: "Remosaic: permutation and same-color reconstruction", summary: "Convert Quad CFA to standard Bayer semantics by reversible coordinate permutation or same-color bilinear reconstruction.", level: "Reference", readingTime: "About 11 min",
      blocks: [
        { title: "Coordinate permutation", text: "Each axis applies the local order <code>[0,1,2,3] → [0,2,1,3]</code>. Combining both axes rearranges a 4×4 Quad block into Bayer order without interpolating DN. It is deterministic and reversible at the site-order level." },
        { title: "Same-color reconstruction", text: "For each output Bayer site, the implementation finds valid Quad samples of the required color on both axes. Up to four corner combinations are weighted bilinearly; invalid or out-of-range samples are excluded and the remaining weights are renormalized." },
        { title: "Choosing a mode", text: "Permutation preserves measured samples and is useful for structural diagnosis. Same-color reconstruction produces smoother Bayer content but performs more reads and arithmetic and is not reversible." },
      ],
      formulaHeading: "Remosaic equations", formulaLabels: ["One-axis source coordinate", "Two-dimensional weights"],
      note: { kind: "warning", title: "Reconstruction costs more", text: "Permutation reads one source DN per output pixel. Same-color reconstruction searches valid coordinates and may read four corner samples, so large images and repeated zoom operations require more work." },
    },
    demosaic: {
      kicker: "FROM BAYER TO RGB", title: "The actual bilinear Demosaic contract", summary: "Keep the pixel's sampled channel and reconstruct the other two components from valid same-channel neighbors in a 3×3 neighborhood.", level: "Reference", readingTime: "About 10 min",
      blocks: [
        { title: "Processing order", text: "Standard Bayer enters Demosaic directly. Quad CFA first applies the selected Remosaic mode to form processed Bayer data. MONO cannot be Demosaiced to RGB because it has no color-site semantics." },
        { title: "Local reconstruction", text: "The channel sampled at the center keeps its DN. Each missing channel is the floored arithmetic mean of valid neighbors of that channel in the 3×3 neighborhood. Edges have fewer neighbors; missing samples never enter the denominator." },
        { title: "Interpretation", text: "This local, deterministic method is suitable for checking CFA selection, exposure, and channel continuity. It does not suppress false color or zipper artifacts and is not a model of a camera ISP's final image quality." },
      ],
      formulaHeading: "Neighborhood equations", formulaLabels: ["Target-channel set", "Channel reconstruction"],
      note: { kind: "tip", title: "Use it as a diagnostic rendering", text: "Bilinear Demosaic is intentionally explainable. Treat it as a way to inspect sensor organization and values, not as a production color pipeline." },
    },
    rendering: {
      kicker: "DN TO SCREEN", title: "Display normalization, tiles, and LOD", summary: "Separate raw numerical meaning from the 8-bit preview, tiled rendering, and level-of-detail selection.", level: "Advanced", readingTime: "About 10 min",
      blocks: [
        { title: "Display range", text: "The preview clamps DN to <code>[L,H]</code> and maps it to 0–255 with integer rounding. When <code>H≤L</code>, values above L become white and all others black. This display-only mapping never changes inspected DN, statistics, or export." },
        { title: "Tiles and revisions", text: "The viewport requests bounded tiles. Every render belongs to a document generation and render revision; completed work from an older state is rejected as stale rather than overwriting a newer view." },
        { title: "LOD semantics", text: "The ideal level follows zoom and is clamped to the available pyramid. Structural RAW/CFA views preserve sample-site organization instead of averaging them as ordinary RGB pixels. A full preview selects the highest-resolution LOD whose long edge is at most 4096 px." },
      ],
      formulaHeading: "Display and LOD equations", formulaLabels: ["Normal range H > L", "Degenerate range H ≤ L", "Ideal LOD"],
      note: { kind: "supplement", title: "A full preview is still a preview", text: "It preserves current display semantics and is useful for sharing, but it does not replace L0 DN export or exact L0 statistics." },
    },
    inspection: {
      kicker: "COORDINATES AND VALIDITY", title: "Pixel inspection, ROI, and missing data", summary: "Read absolute image coordinates, define an inclusive ROI, and keep unavailable samples distinct from numerical zero.", level: "Getting started", readingTime: "About 7 min",
      blocks: [
        { title: "Pixel inspection", text: "At high zoom, the overlay can show the pixel grid and DN. Turning off values keeps the positioning grid and performs no DN lookup. RAW/CFA modes report sampled DN; Demosaic channel views report reconstructed components." },
        { title: "Inclusive ROI", text: "Mouse and coordinate ROI use absolute full-image endpoints <code>(x0,y0)</code> and <code>(x1,y1)</code>, both included. Coordinates must be integers, ordered, and inside the image. A single pixel is therefore a valid 1×1 ROI." },
        { title: "Missing is not zero", text: "A valid coordinate may still lack required source bytes in a partial frame. Preview marks it with a dedicated appearance, statistics count it as missing and exclude it from numerical summaries, and export uses an explicit missing fill value." },
      ],
      formulaHeading: "Inclusive endpoints converted to dimensions", formulaLabels: ["Inclusive ROI rectangle"],
      note: { kind: "danger", title: "Do not substitute zero for absence", text: "DN 0 is a valid measured code. A missing sample has no DN; conflating the two biases histograms, means, variance, and exported sensor data." },
    },
    statistics: {
      kicker: "EXACT STATISTICAL CONTRACT", title: "Histogram, mean, variance, and percentiles", summary: "Scan current-frame L0 CFA DN once, preserve missing-sample traceability, and compute deterministic descriptive statistics.", level: "Reference", readingTime: "About 12 min",
      blocks: [
        { title: "Data range and grouping", text: "Without an ROI the whole frame is scanned; with an ROI only its inclusive rectangle is scanned. Statistics never read screen 8-bit values, LOD, or Demosaic RGB. MONO provides Y; CFA data provides All plus semantic color groups." },
        { title: "Online population variance", text: "Valid DN values update Welford state in scan order. The reported variance describes the current valid ROI population and therefore divides by <code>n</code>, not the unbiased sample denominator <code>n−1</code>. Missing samples do not enter the state." },
        { title: "Exact discrete percentiles", text: "A histogram over the integer DN domain is exact. The percentile rank is floored to <code>[0,n−1]</code>; the result is the first DN whose cumulative count exceeds that rank. Min and max are the first and last occupied bins." },
      ],
      formulaHeading: "Statistical equations", formulaLabels: ["Missing count", "Welford update and population variance", "Discrete percentile"],
      note: { kind: "warning", title: "Measurement boundary", text: "These are single-frame, single-ROI descriptive results. They do not provide temporal noise, exposure-linearity sequences, dark/flat-field conditions, or a complete EMVA 1288 measurement." },
    },
    charts: {
      kicker: "BOUNDED VISUALIZATION", title: "Aggregation and interpretation of statistics charts", summary: "Keep exact summaries while reducing only the number of points sent to the interactive chart renderer.", level: "Advanced", readingTime: "About 8 min",
      blocks: [
        { title: "Histogram aggregation", text: "When the exact histogram has more than 4096 bins, consecutive bins are summed into bounded display buckets and plotted at each bucket midpoint. The underlying counts, mean, variance, and percentiles remain exact." },
        { title: "Profile envelope", text: "Long Row and Column Profiles retain first and last samples and preserve ordered local minima and maxima from each bucket. This min–max envelope keeps narrow spikes visible while bounding the render set to 4096 points." },
        { title: "Interaction", text: "Ordinary wheel input scrolls the document. <code>Ctrl+wheel</code> scales X, <code>Shift+wheel</code> scales Y, and both modifiers scale both axes. Curve visibility, zoom ranges, and chart height are presentation state only." },
      ],
      formulaHeading: "Display-reduction equations", formulaLabels: ["Histogram buckets", "Profile min–max envelope"],
      note: { kind: "supplement", title: "Display reduction does not alter summaries", text: "Only chart payload size is reduced. Exact statistics are computed before display aggregation and are never reconstructed from the rendered points." },
    },
    export: {
      kicker: "DETERMINISTIC OUTPUT", title: "Cropping, numerical mapping, and safe writes", summary: "Freeze the source state, validate the target contract, and write original CFA, Remosaic Bayer, or Demosaic RGB48 deterministically.", level: "Reference", readingTime: "About 11 min",
      blocks: [
        { title: "Frozen source contract", text: "Export snapshots the current file generation, frame, descriptor, processing options, crop, missing fill, target Packing, bit depth, endianness, and alignment. A later state change makes the old task stale instead of allowing it to overwrite current intent." },
        { title: "Preserve or scale", text: "Preserve clamps DN to the target maximum. Scale maps the source full scale to the target full scale with integer rounding. The operation is performed on numerical DN, not on the display's 8-bit preview." },
        { title: "Safe replacement", text: "Rows and frames are aligned using the target contract. Output is written through a temporary file and safely replaces the destination only after completion. Cancellation or failure leaves an existing destination intact." },
      ],
      formulaHeading: "Output equations", formulaLabels: ["Source and target full scale", "Preserve and scale", "Aligned output size"],
      note: { kind: "danger", title: "Export safety constraints", text: "The open source file cannot be overwritten. Crop bounds must be valid; fixed MIPI Packing must match its bit depth; target sizes must not overflow; and a stale generation or snapshot is rejected." },
    },
    boundaries: {
      kicker: "FAILURE MODES", title: "Boundary checks, performance, and troubleshooting", summary: "Use visible failure patterns to separate descriptor errors, data absence, algorithm limits, and stale asynchronous work.", level: "Advanced", readingTime: "About 9 min",
      blocks: [
        { title: "Input boundaries", text: "Dimensions are limited to 1–25000 by 1–20000; configurable bit depth is 8–16; Quad Phase is 0–3 on each axis; ROI endpoints are inclusive integers inside the image. Address arithmetic, products, and output sizes are overflow-checked." },
        { title: "Read the symptom", text: "Diagonal tearing suggests width, Packing, or rowStride. A stable 2×2 or 4×4 color cycle suggests CFA/Phase. Frame interference suggests frameStride. <code>valid &lt; expected</code> means some required source bytes were unavailable." },
        { title: "Performance and cancellation", text: "Same-color Remosaic costs more than permutation. Statistics scale roughly with valid L0 ROI pixels. Old rendering, analysis, and export tasks carry revision/generation identifiers and cannot commit after newer state exists." },
      ],
      note: { kind: "warning", title: "Preview tolerance is not export permission", text: "Preview may diagnose short strides and partial frames with bounded missing reads. Export uses stricter validation because its destination layout and source snapshot must be deterministic." },
    },
    glossary: {
      kicker: "TERMS AND CLAIMS", title: "Glossary and interpretation of results", summary: "Use consistent RAW terminology and understand which conclusions eRAW can and cannot support.", level: "Getting started", readingTime: "About 7 min",
      blocks: [
        { title: "Data terms", text: "<code>DN</code> is the integer Digital Number after unpacking and effective-bit extraction; it is not photon count, electron count, or display brightness. <code>Packing</code> describes how pixel bits occupy bytes. <code>Stride</code> is the byte distance between row or frame starts." },
        { title: "Spatial and processing terms", text: "<code>CFA</code> maps coordinates to color sample sites; <code>Phase</code> offsets Quad CFA coordinates. <code>Remosaic</code> converts Quad organization to Bayer semantics. <code>Demosaic</code> reconstructs RGB components. <code>LOD</code> is a multi-resolution preview, and <code>ROI</code> is an inclusive absolute-coordinate region." },
        { title: "What the result means", text: "eRAW can state how the current descriptor interprets bytes, describe current-frame L0 DN over a selected ROI, and produce deterministic output for the selected algorithm. It cannot discover an unknown format by itself, characterize complete sensor noise/linearity, or reproduce a camera ISP's final color." },
      ],
      note: { kind: "supplement", title: "Manual version", text: "This technical reference follows eRAW V0.5.4. Packing, processing, or statistical changes should update code, equations, tests, and all language catalogs as one versioned change." },
    },
  },
};

const ZH_TW_COPY: LocaleCopy = {
  groupTitles: { guide: "使用基礎", data: "資料解讀", processing: "處理與呈現", analysis: "分析與輸出", reference: "邊界與速查" },
  ui: { manualTitle: "使用手冊", subtitle: "技術參考 · 繁體中文", navigationLabel: "使用手冊目錄", home: "手冊首頁", previous: "上一篇", next: "下一篇", first: "已經是第一篇", last: "已經是最後一篇", article: "第 {current} / {total} 篇" },
  admonitionLabels: { tip: "提示", warning: "警告", danger: "錯誤與風險", supplement: "補充說明" },
  sections: {
    start: {
      kicker: "閱讀入口", title: "如何使用這本技術手冊", summary: "從一次可重現的 RAW 檢查開始，再依任務進入資料、演算法、統計或匯出專題。", level: "入門", readingTime: "約 4 分鐘",
      blocks: [
        { title: "描述來源位元組", text: "eRAW 不會猜測未知格式。以 <code>Ctrl+O</code> 開啟檔案後，記錄寬高、Packing、位元深度、CFA、Phase、偏移與步長；描述符就是把位元組轉成座標與 DN 的契約。" },
        { title: "先驗證再解讀", text: "先用 RAW 強度確認行與影格連續，再檢查 CFA 站點與 Phase。畫面可辨識不代表參數正確；規律性的斜切、重複行或週期性色偏更具診斷價值。" },
        { title: "量測並凍結條件", text: "在高倍率檢查 L0 DN，或對包含式 ROI 計算 Histogram 與 Profile。匯出前凍結檔案、影格、描述符、處理模式、裁剪與目標位元深度。" },
      ], note: { kind: "tip", title: "保留最小實驗紀錄", text: "至少記錄來源校驗值、尺寸、Packing、位元深度、CFA/Phase、影格、ROI 與匯出參數。只有輸入條件可重現，結果才可比較。" },
    },
    workflow: {
      kicker: "操作模型", title: "檔案工作階段、畫布與快捷操作", summary: "理解目前文件、影格與觀察狀態的關係，避免把舊結果帶入新檔案。", level: "入門", readingTime: "約 6 分鐘",
      blocks: [
        { title: "文件生命週期", text: "同一時間只有一個 RAW 文件有效。重新開啟檔案或成功套用新描述符會使舊圖塊與統計失效；<code>Ctrl+W</code> 關閉文件並釋放唯讀映射，但保留已儲存的偏好。" },
        { title: "視圖與 ROI", text: "滾輪以指標下的影像點為錨縮放，左鍵拖曳平移；<code>Ctrl+0</code> 適合視窗，<code>Ctrl+1</code> 回到 100%。同尺寸換幀保留視圖，尺寸改變會清除依賴座標的 ROI。" },
        { title: "常用快捷鍵", text: "<code>R</code>/<code>Shift+R</code> 選取 ROI，<code>P</code> 定位像素，<code>Ctrl+I</code> 統計，<code>Ctrl+E</code> 匯出，<code>F11</code> 原生全螢幕，<code>F1</code> 開啟本手冊。" },
      ], note: { kind: "supplement", title: "設定不改變感測器資料", text: "主題、語言、字級、側欄、滾輪速度、快取與減少動態效果只改變互動或資源使用，不改變來源位元組、DN、CFA、統計或確定性匯出。" },
    },
    layout: {
      kicker: "從檔案到影格", title: "檔案配置、步長與影格計數", summary: "用明確的位元組公式定位每個影格、每一行與每個像素群組。", level: "進階", readingTime: "約 9 分鐘",
      blocks: [
        { title: "最小有效行大小", text: "Packing 決定有效寬度 <code>W</code> 至少需要多少位元組。向上取整表示最後一個不完整 MIPI 像素群組仍占用完整儲存群組。" },
        { title: "對齊與顯式步長", text: "小於 1 的對齊值視為 1；只有顯式步長為 0 才自動計算。非零步長以使用者值為準，即使過短而造成重疊，預覽也只會提出風險並執行有界讀取。" },
        { title: "部分尾幀", text: "先從檔案大小扣除檔頭偏移。完整影格後只要仍有位元組，就形成一個可檢查的部分尾幀；缺少來源位元組的像素是缺失樣本，不會補成零。" },
      ], formulaHeading: "位元組配置公式", formulaLabels: ["Unpacked8", "Unpacked16", "MIPI RAW10", "MIPI RAW12", "MIPI RAW14", "向上對齊", "自動配置", "影格計數"], note: { kind: "warning", title: "建議排查順序", text: "整幅斜切或週期錯位時，依序檢查寬度、Packing、rowStride、headerOffset；影格互相干擾時再查 frameStride。CFA 錯誤通常不會讓每行位元組持續漂移。" },
    },
    packing: {
      kicker: "從位元組到 DN", title: "Unpacked 與 MIPI RAW 解碼", summary: "理解位元深度、位元組序、有效位對齊與 MIPI 群組如何形成感測器 DN。", level: "參考", readingTime: "約 10 分鐘",
      blocks: [
        { title: "Unpacked 容器", text: "Unpacked8 每像素讀一個位元組；Unpacked16 依指定端序組成 16-bit 容器。MSB 對齊只套用於 Unpacked，之後再依有效位元深度遮罩。" },
        { title: "MIPI RAW10 與 RAW12", text: "RAW10 以前四個位元組保存高 8 bit，第五個位元組保存四組低 2 bit。RAW12 以前兩個位元組保存高位，第三個位元組保存兩組低 4 bit。" },
        { title: "MIPI RAW14", text: "RAW14 以七個位元組保存四個像素；<code>B0–B3</code> 是高 8 bit，<code>B4–B6</code> 連續承載四組低 6 bit。" },
      ], formulaHeading: "解碼公式", formulaLabels: ["有效位元擷取", "RAW10 第 i 個像素", "RAW12 兩像素群組", "RAW14 低位拼接"], note: { kind: "danger", title: "截斷群組屬於缺失資料", text: "MIPI RAW10/12/14 位元深度固定；最後一組仍需要完整群組位元組。缺少任何必要位元組時，像素即為缺失，不能靜默解釋為 DN 0。" },
    },
    cfa: {
      kicker: "空間取樣語義", title: "Bayer、Quad CFA 與 Phase", summary: "CFA 描述每個座標代表的感測器取樣站點，不是顯示色調。", level: "進階", readingTime: "約 9 分鐘",
      blocks: [
        { title: "Bayer 與 Quad 週期", text: "標準 Bayer 以座標奇偶形成 2×2 週期。Quad CFA 把同色樣本擴成 2×2 區塊，因此基本週期為 4×4；統計仍區分 Gr 與 Gb。" },
        { title: "Phase", text: "Phase 是檔案座標相對 Quad CFA 週期的偏移，兩軸範圍均為 0–3。統計保留十六個原子平面，再於顯示層合併為語義色彩群組。" },
        { title: "裁剪改變原點", text: "標準 Bayer 匯出會把奇數裁剪折算成新的 RGGB/BGGR/GBRG/GRBG；原始 Quad 匯出保留 CFA 類型，並以模四方式更新 Phase。" },
      ], formulaHeading: "站點公式", formulaLabels: ["Quad 宏座標", "統計原子平面", "Quad 裁剪 Phase"], note: { kind: "tip", title: "區分 CFA 與配置錯誤", text: "CFA 或 Phase 錯誤通常以 2×2 或 4×4 週期重複，但幾何仍連續；Packing 或 rowStride 錯誤會讓後續位元組與行持續偏移。" },
    },
    remosaic: {
      kicker: "QUAD CFA 處理", title: "Remosaic：重排與同色重建", summary: "以可逆座標置換或同色雙線性重建，把 Quad CFA 轉成標準 Bayer 語義。", level: "參考", readingTime: "約 11 分鐘",
      blocks: [
        { title: "座標重排", text: "每個軸將局部順序 <code>[0,1,2,3]</code> 轉為 <code>[0,2,1,3]</code>；X/Y 組合後把 4×4 Quad 區塊排成 Bayer，過程不插值 DN，且站點次序可逆。" },
        { title: "同色重建", text: "先確定目標 Bayer 站點，再於兩軸尋找有效同色 Quad 樣本。最多四個角點以雙線性權重合成；無效或越界樣本被排除，剩餘權重重新正規化。" },
        { title: "模式選擇", text: "重排保留實測樣本，適合結構診斷；同色重建較平滑，但讀取與計算更多，也不可逆。" },
      ], formulaHeading: "Remosaic 公式", formulaLabels: ["單軸來源座標", "二維權重"], note: { kind: "warning", title: "重建成本較高", text: "重排每個輸出像素只讀一個來源 DN；同色重建需要搜尋座標並可能讀取四個角點，大圖與頻繁縮放會更耗時。" },
    },
    demosaic: {
      kicker: "從 BAYER 到 RGB", title: "雙線性 Demosaic 的實際口徑", summary: "保留像素自身取樣通道，並從 3×3 鄰域的有效同通道樣本重建其餘兩個分量。", level: "參考", readingTime: "約 10 分鐘",
      blocks: [
        { title: "處理順序", text: "標準 Bayer 直接進入 Demosaic；Quad CFA 先執行所選 Remosaic 形成處理後 Bayer。MONO 沒有色彩站點語義，不能 Demosaic 成 RGB。" },
        { title: "局部重建", text: "中心像素已取樣的通道保留原 DN；缺失通道取 3×3 鄰域內有效同通道樣本的向下取整算術平均。邊緣可用鄰居較少，缺失樣本不進分母。" },
        { title: "結果解讀", text: "此方法局部、確定且易於解釋，適合檢查 CFA、曝光與通道連續性；它不抑制偽色或拉鍊，也不代表相機 ISP 的最終畫質。" },
      ], formulaHeading: "鄰域公式", formulaLabels: ["目標通道集合", "通道重建"], note: { kind: "tip", title: "把它當成診斷渲染", text: "雙線性 Demosaic 的目的在於可解釋地觀察感測器組織與數值，而不是提供成片色彩管線。" },
    },
    rendering: {
      kicker: "從 DN 到螢幕", title: "顯示正規化、圖塊與 LOD", summary: "區分原始數值語義、8-bit 預覽、圖塊渲染與細節層級選擇。", level: "進階", readingTime: "約 10 分鐘",
      blocks: [
        { title: "顯示範圍", text: "預覽把 DN 夾在 <code>[L,H]</code> 並以整數捨入映射至 0–255；當 <code>H≤L</code> 時，只有大於 L 的值為白。這不改變檢查 DN、統計或匯出。" },
        { title: "圖塊與版本", text: "視口請求有界圖塊。每次渲染帶有文件 generation 與 render revision；舊狀態完成的工作會被拒絕為 stale，不得覆蓋新畫面。" },
        { title: "LOD 語義", text: "理想層級依縮放計算並限制於可用金字塔。RAW/CFA 結構視圖保留站點，不把它們當一般 RGB 平均；完整預覽選擇長邊不超過 4096 px 的最高解析度 LOD。" },
      ], formulaHeading: "顯示與 LOD 公式", formulaLabels: ["正常範圍 H > L", "退化範圍 H ≤ L", "理想 LOD"], note: { kind: "supplement", title: "完整預覽仍是預覽", text: "它保留目前顯示語義，適合分享，但不能取代 L0 DN 匯出或精確 L0 統計。" },
    },
    inspection: {
      kicker: "座標與有效性", title: "像素檢查、ROI 與缺失資料", summary: "讀取絕對影像座標、定義包含式 ROI，並讓不可用樣本與數值零保持區別。", level: "入門", readingTime: "約 7 分鐘",
      blocks: [
        { title: "像素檢查", text: "高倍率疊加層可顯示網格與 DN。關閉數值仍保留定位網格且不查詢 DN。RAW/CFA 顯示取樣 DN；Demosaic 通道視圖顯示重建分量。" },
        { title: "包含式 ROI", text: "滑鼠與座標 ROI 使用整幅影像的絕對端點 <code>(x0,y0)</code> 與 <code>(x1,y1)</code>，兩端都包含。座標必須是有序整數且位於影像內，因此單一像素是有效的 1×1 ROI。" },
        { title: "缺失不是零", text: "部分尾幀中的有效座標仍可能缺少來源位元組。預覽用專用外觀標記，統計計入 missing 並排除數值摘要，匯出則使用明確的缺失填充值。" },
      ], formulaHeading: "包含式端點轉換為尺寸", formulaLabels: ["包含式 ROI 矩形"], note: { kind: "danger", title: "不要用零代替缺失", text: "DN 0 是有效碼值；缺失樣本沒有 DN。混淆兩者會扭曲 Histogram、均值、方差與匯出資料。" },
    },
    statistics: {
      kicker: "精確統計口徑", title: "Histogram、均值、方差與百分位", summary: "一次掃描目前影格的 L0 CFA DN，保留缺失可追溯性並計算確定性的描述統計。", level: "參考", readingTime: "約 12 分鐘",
      blocks: [
        { title: "資料範圍與分組", text: "沒有 ROI 時掃描整幀，有 ROI 時只掃描其包含式矩形。統計不讀螢幕 8-bit、LOD 或 Demosaic RGB；MONO 提供 Y，CFA 提供 All 與語義色彩群組。" },
        { title: "線上總體方差", text: "有效 DN 依掃描順序更新 Welford 狀態。結果描述目前有效 ROI 樣本總體，因此分母是 <code>n</code>，不是無偏樣本方差的 <code>n−1</code>；缺失樣本不進狀態。" },
        { title: "精確離散百分位", text: "整數 DN 域的 Histogram 是精確的。百分位秩向下取整至 <code>[0,n−1]</code>，結果為累積計數首次超過該秩的 DN。" },
      ], formulaHeading: "統計公式", formulaLabels: ["缺失計數", "Welford 更新與總體方差", "離散百分位"], note: { kind: "warning", title: "量測邊界", text: "這些是單幀、單 ROI 的描述統計，不包含多幀 temporal noise、曝光線性序列、暗場/平場條件或完整 EMVA 1288 量測。" },
    },
    charts: {
      kicker: "有界視覺化", title: "統計圖表的聚合與閱讀", summary: "保留精確摘要，只降低送入互動圖表渲染器的點數。", level: "進階", readingTime: "約 8 分鐘",
      blocks: [
        { title: "Histogram 聚合", text: "精確 Histogram 超過 4096 bins 時，連續 bins 合併成有界顯示桶並以桶中點繪製；原始計數、均值、方差與百分位保持精確。" },
        { title: "Profile 包絡", text: "長 Row/Column Profile 保留首尾樣本，並保留每桶依原順序排列的局部最小與最大值，使窄尖峰仍可見且渲染點不超過 4096。" },
        { title: "互動", text: "一般滾輪捲動文件；<code>Ctrl+滾輪</code> 縮放 X，<code>Shift+滾輪</code> 縮放 Y，兩者同按縮放雙軸。曲線、範圍與圖高只屬於呈現狀態。" },
      ], formulaHeading: "顯示降採樣公式", formulaLabels: ["Histogram 顯示桶", "Profile min–max 包絡"], note: { kind: "supplement", title: "顯示降採樣不改變摘要", text: "只限制圖表負載；精確統計在聚合前完成，絕不從畫面點反推。" },
    },
    export: {
      kicker: "確定性輸出", title: "裁剪、數值映射與安全寫入", summary: "凍結來源狀態、驗證目標契約，再確定性寫出原始 CFA、Remosaic Bayer 或 Demosaic RGB48。", level: "參考", readingTime: "約 11 分鐘",
      blocks: [
        { title: "凍結來源契約", text: "匯出快照包含 generation、影格、描述符、處理選項、裁剪、缺失填值、目標 Packing、位元深度、端序與對齊。後續狀態改變會讓舊任務 stale。" },
        { title: "Preserve 或 Scale", text: "Preserve 把 DN 夾至目標最大值；Scale 以整數捨入把來源滿量程映射至目標滿量程。操作對象是 DN，不是 8-bit 顯示預覽。" },
        { title: "安全取代", text: "依目標契約對齊行與影格。先寫暫存檔，完成後才安全取代目的地；取消或失敗不破壞既有檔案。" },
      ], formulaHeading: "輸出公式", formulaLabels: ["來源與目標滿量程", "Preserve 與 Scale", "對齊後輸出大小"], note: { kind: "danger", title: "匯出安全限制", text: "不能覆寫目前開啟的來源檔；裁剪必須有效；固定 MIPI Packing 必須匹配位元深度；大小不得溢位；stale generation 或快照會被拒絕。" },
    },
    boundaries: {
      kicker: "失敗模式", title: "邊界檢查、效能與排錯", summary: "依可見症狀區分描述符錯誤、資料缺失、演算法限制與過期非同步工作。", level: "進階", readingTime: "約 9 分鐘",
      blocks: [
        { title: "輸入邊界", text: "尺寸限制為 1–25000 × 1–20000；可設定位元深度為 8–16；Quad Phase 每軸 0–3；ROI 端點為影像內的包含式整數。位址、乘法與輸出大小均檢查溢位。" },
        { title: "從症狀定位", text: "斜切通常指向寬度、Packing 或 rowStride；穩定的 2×2/4×4 色彩週期指向 CFA/Phase；影格互擾指向 frameStride；<code>valid &lt; expected</code> 表示來源位元組不足。" },
        { title: "效能與取消", text: "同色 Remosaic 比重排昂貴；統計成本約隨有效 L0 ROI 像素數成長；舊渲染、統計與匯出任務攜帶 revision/generation，不得提交到新狀態。" },
      ], note: { kind: "warning", title: "預覽容錯不等於允許匯出", text: "預覽可以有界方式診斷短步長與部分影格；匯出必須確保來源快照與目標配置確定，因此驗證更嚴格。" },
    },
    glossary: {
      kicker: "術語與結論", title: "術語表與結果解讀", summary: "統一 RAW 工作流程中的關鍵術語，並理解 eRAW 能與不能支持哪些結論。", level: "入門", readingTime: "約 7 分鐘",
      blocks: [
        { title: "資料術語", text: "<code>DN</code> 是解包與有效位擷取後的整數 Digital Number，不等於光子、電子或顯示亮度。<code>Packing</code> 描述像素位元如何進入位元組；<code>Stride</code> 是相鄰行或影格起點的位元組距離。" },
        { title: "空間與處理術語", text: "<code>CFA</code> 把座標映射到色彩站點；<code>Phase</code> 偏移 Quad CFA。<code>Remosaic</code> 轉成 Bayer 語義，<code>Demosaic</code> 重建 RGB，<code>LOD</code> 是多解析度預覽，<code>ROI</code> 是包含式絕對座標區域。" },
        { title: "結果能說明什麼", text: "eRAW 能說明目前描述符如何解讀位元組、目前影格 ROI 的 L0 DN 分布，以及所選演算法的確定性輸出；不能自行辨識未知格式、完整量測感測器噪聲/線性或重現相機 ISP 最終色彩。" },
      ], note: { kind: "supplement", title: "手冊版本", text: "本技術參考與 eRAW V0.5.4 同步。Packing、處理或統計變更應把程式、公式、測試與所有語言目錄作為同一版本變更維護。" },
    },
  },
};

const JA_COPY: LocaleCopy = {
  groupTitles: { guide: "基本操作", data: "データの解釈", processing: "処理と表示", analysis: "解析と出力", reference: "境界条件とリファレンス" },
  ui: { manualTitle: "ユーザーマニュアル", subtitle: "技術リファレンス · 日本語", navigationLabel: "ユーザーマニュアル目次", home: "マニュアル先頭", previous: "前の記事", next: "次の記事", first: "最初の記事です", last: "最後の記事です", article: "第 {current} / {total} 記事" },
  admonitionLabels: { tip: "ヒント", warning: "警告", danger: "エラーと危険", supplement: "補足" },
  sections: {
    start: { kicker: "読み方", title: "この技術マニュアルの使い方", summary: "再現可能な RAW 検査から始め、目的に応じてデータ、アルゴリズム、統計、出力の章へ進みます。", level: "入門", readingTime: "約 4 分",
      blocks: [
        { title: "バイト列を記述する", text: "eRAW は未知形式を推測しません。<code>Ctrl+O</code> で開き、幅、高さ、Packing、bit depth、CFA、Phase、offset、stride を記録します。この descriptor がバイトを座標と DN に変換する契約です。" },
        { title: "解釈前に検証する", text: "まず RAW 強度で行と frame の連続性を確認し、次に CFA site と Phase を調べます。高倍率 DN または包含 ROI の Histogram/Profile を記録し、export 前にすべての条件を固定します。" },
      ], note: { kind: "tip", title: "最小限の実験記録を残す", text: "source checksum、寸法、Packing、bit depth、CFA/Phase、frame、ROI、export 設定を保存してください。入力条件を再現できて初めて結果を比較できます。" } },
    workflow: { kicker: "操作モデル", title: "ファイルセッション、キャンバス、ショートカット", summary: "現在の document、frame、表示状態の関係を理解し、古い結果を新しいファイルへ持ち込まないようにします。", level: "入門", readingTime: "約 6 分",
      blocks: [
        { title: "document の寿命", text: "有効な RAW document は常に一つです。別ファイルを開くか descriptor を適用すると旧 tile と統計は無効になります。<code>Ctrl+W</code> は read-only mapping を解放しますが、保存済み設定は残します。" },
        { title: "表示と操作", text: "wheel は pointer 下を基準に zoom、左 drag は pan です。<code>Ctrl+0</code> は fit、<code>Ctrl+1</code> は 100%。<code>R</code> は ROI、<code>P</code> は pixel、<code>Ctrl+I</code> は統計、<code>Ctrl+E</code> は export、<code>F1</code> は本マニュアルです。" },
      ], note: { kind: "supplement", title: "表示設定は sensor data を変更しない", text: "theme、language、font size、sidebar、wheel speed、cache は source bytes、DN、CFA、統計、確定的 export を変更しません。" } },
    layout: { kicker: "ファイルから FRAME へ", title: "ファイル配置、stride、frame 数", summary: "明示的なバイト式で各 frame、row、packed pixel group を特定します。", level: "上級", readingTime: "約 9 分",
      blocks: [
        { title: "最小 row size", text: "Packing が有効幅 <code>W</code> の最小 byte 数を決めます。切り上げにより、最後の不完全な MIPI group も完全な storage group を占有します。" },
        { title: "stride と partial frame", text: "明示 stride が 0 のときだけ自動計算します。headerOffset を除いた後、完全 frame の後に byte が残れば一つの partial frame とします。読めない pixel は missing であり、0 ではありません。" },
      ], formulaHeading: "バイト配置式", formulaLabels: ["Unpacked8", "Unpacked16", "MIPI RAW10", "MIPI RAW12", "MIPI RAW14", "切り上げ alignment", "自動配置", "frame 数"], note: { kind: "warning", title: "推奨確認順序", text: "斜めのずれは width、Packing、rowStride、headerOffset の順に確認し、frame 間干渉では frameStride を確認します。" } },
    packing: { kicker: "BYTE から DN へ", title: "Unpacked と MIPI RAW の decode", summary: "bit depth、endianness、有効 bit alignment、MIPI group から sensor DN が得られる過程を示します。", level: "リファレンス", readingTime: "約 10 分",
      blocks: [
        { title: "Unpacked container", text: "Unpacked8 は 1 byte、Unpacked16 は選択 endianness で 2 byte を結合します。MSB alignment は Unpacked のみで、その後に有効 bit depth の mask を適用します。" },
        { title: "固定 MIPI group", text: "RAW10 は 5 byte/4 pixel、RAW12 は 3 byte/2 pixel、RAW14 は 7 byte/4 pixel です。endianness と有効 bit 位置はこれらの固定 Packing には作用しません。" },
      ], formulaHeading: "decode 式", formulaLabels: ["有効 bit 抽出", "RAW10 pixel i", "RAW12 pair", "RAW14 low-bit 結合"], note: { kind: "danger", title: "切れた group は missing", text: "必要 byte が一つでも無い pixel は missing です。DN 0 として扱ってはいけません。" } },
    cfa: { kicker: "空間サンプリング", title: "Bayer、Quad CFA、Phase", summary: "CFA は表示色ではなく、各座標が表す sensor sample site を定義します。", level: "上級", readingTime: "約 9 分",
      blocks: [
        { title: "周期と Phase", text: "標準 Bayer は 2×2、Quad CFA は同色 2×2 block による 4×4 周期です。Phase は Quad 周期に対する file coordinate offset で、各軸 0–3 です。" },
        { title: "crop", text: "crop は出力原点を移動します。標準 Bayer は RGGB/BGGR/GBRG/GRBG を更新し、元 Quad CFA の export は型を保って Phase を mod 4 で更新します。" },
      ], formulaHeading: "site 式", formulaLabels: ["Quad macro coordinate", "統計 atomic plane", "Quad crop Phase"], note: { kind: "tip", title: "CFA と layout error の区別", text: "CFA/Phase error は 2×2 または 4×4 周期で繰り返します。Packing/rowStride error は後続 byte の座標を連続してずらします。" } },
    remosaic: { kicker: "QUAD CFA 処理", title: "Remosaic：並べ替えと同色再構成", summary: "可逆な座標 permutation または同色 bilinear reconstruction で Quad CFA を Bayer semantics に変換します。", level: "リファレンス", readingTime: "約 11 分",
      blocks: [
        { title: "座標 permutation", text: "各軸で <code>[0,1,2,3] → [0,2,1,3]</code> を適用し、DN を補間せず 4×4 Quad block を Bayer 順へ並べ替えます。site order は可逆です。" },
        { title: "同色再構成", text: "目的 Bayer site と同色の有効 Quad sample を両軸で探し、最大四つの corner を bilinear weight で合成します。無効 sample は除外し weight を再正規化します。" },
      ], formulaHeading: "Remosaic 式", formulaLabels: ["1 軸 source coordinate", "2 次元 weight"], note: { kind: "warning", title: "再構成は高コスト", text: "permutation は output pixel ごとに 1 DN、同色再構成は最大 4 corner を読むため大画像では遅くなります。" } },
    demosaic: { kicker: "BAYER から RGB へ", title: "bilinear Demosaic の実際の仕様", summary: "自身の sampled channel を保持し、3×3 近傍の有効な同 channel sample から残りを再構成します。", level: "リファレンス", readingTime: "約 10 分",
      blocks: [
        { title: "処理順序", text: "Bayer は直接、Quad CFA は選択した Remosaic 後に Demosaic します。MONO には color-site semantics がないため RGB 化できません。" },
        { title: "局所平均", text: "center の sampled channel は元 DN を保持します。欠けた channel は 3×3 内の有効な同 channel sample の算術平均を floor します。edge は sample が少なく、missing は分母に入りません。" },
      ], formulaHeading: "近傍式", formulaLabels: ["対象 channel 集合", "channel 再構成"], note: { kind: "tip", title: "診断 rendering として使う", text: "局所的で説明可能な方法であり、CFA と連続性の確認向けです。camera ISP の最終画質を表しません。" } },
    rendering: { kicker: "DN から画面へ", title: "表示正規化、tile、LOD", summary: "raw 数値、8-bit preview、tile rendering、detail level を分離して理解します。", level: "上級", readingTime: "約 10 分",
      blocks: [
        { title: "表示 range", text: "DN を <code>[L,H]</code> に clamp し 0–255 へ整数 mapping します。<code>H≤L</code> では L より大きい値だけ白です。これは DN、統計、export を変更しません。" },
        { title: "tile と LOD", text: "render は generation/revision を持ち、古い完了結果は stale として拒否されます。RAW/CFA LOD は site 構造を保持し、full preview は長辺 4096 px 以下の最高解像度を選びます。" },
      ], formulaHeading: "表示と LOD の式", formulaLabels: ["通常 range H > L", "退化 range H ≤ L", "理想 LOD"], note: { kind: "supplement", title: "full preview も preview", text: "現在の表示 semantics を共有する画像であり、L0 DN export や正確な L0 統計の代替ではありません。" } },
    inspection: { kicker: "座標と有効性", title: "ピクセル検査、ROI、欠損データ", summary: "絶対座標と包含 ROI を使い、欠損 sample と数値 0 を区別します。", level: "入門", readingTime: "約 7 分",
      blocks: [
        { title: "pixel と ROI", text: "高 zoom では grid と DN を表示できます。値を無効にしても grid は残り DN lookup は行いません。ROI の両 endpoint は full-image 絶対座標として含まれ、1×1 ROI も有効です。" },
        { title: "missing は 0 ではない", text: "partial frame では座標が有効でも source byte が無い場合があります。preview は専用表示、統計は missing count、export は明示 fill value を使います。" },
      ], formulaHeading: "包含 endpoint から寸法へ", formulaLabels: ["包含 ROI rectangle"], note: { kind: "danger", title: "欠損を 0 に置換しない", text: "DN 0 は有効な測定 code です。missing sample には DN がなく、混同すると統計と出力を歪めます。" } },
    statistics: { kicker: "正確な統計仕様", title: "Histogram、平均、分散、percentile", summary: "現在 frame の L0 CFA DN を一回走査し、missing を追跡しながら確定的な記述統計を計算します。", level: "リファレンス", readingTime: "約 12 分",
      blocks: [
        { title: "範囲と grouping", text: "ROI 無しは全 frame、有りは包含 rectangle のみです。画面 8-bit、LOD、Demosaic RGB は読みません。MONO は Y、CFA は All と色 group を提供します。" },
        { title: "母分散と percentile", text: "有効 DN を Welford 法で更新し、現在 ROI を母集団として <code>n</code> で割ります。percentile は exact integer Histogram の累積 count が rank を初めて超える DN です。" },
      ], formulaHeading: "統計式", formulaLabels: ["missing count", "Welford 更新と母分散", "離散 percentile"], note: { kind: "warning", title: "測定範囲", text: "単一 frame/ROI の記述統計です。temporal noise、露光 linearity、dark/flat 条件、完全な EMVA 1288 測定ではありません。" } },
    charts: { kicker: "有界な可視化", title: "統計 chart の集約と読み方", summary: "正確な summary を保ち、interactive renderer に渡す点数だけを削減します。", level: "上級", readingTime: "約 8 分",
      blocks: [
        { title: "Histogram", text: "4096 bins を超える exact Histogram は連続 bin を合計して midpoint に描画します。count、平均、分散、percentile は exact のままです。" },
        { title: "Profile envelope", text: "長い Profile は first/last と各 bucket の ordered min/max を保持し、細い spike を残しながら 4096 points に制限します。" },
      ], formulaHeading: "表示削減式", formulaLabels: ["Histogram bucket", "Profile min–max envelope"], note: { kind: "supplement", title: "表示削減は summary を変えない", text: "chart payload だけを減らします。exact statistics は集約前に計算されます。" } },
    export: { kicker: "確定的出力", title: "crop、数値 mapping、安全な書き込み", summary: "source state と target contract を固定し、CFA、Remosaic Bayer、Demosaic RGB48 を確定的に出力します。", level: "リファレンス", readingTime: "約 11 分",
      blocks: [
        { title: "snapshot と mapping", text: "export は generation、frame、descriptor、処理、crop、missing fill、target Packing、bit depth、endianness、alignment を snapshot 化します。Preserve は clamp、Scale は source full scale を target へ整数 mapping します。" },
        { title: "安全な置換", text: "target contract で row/frame を align し temporary file へ書き、完了後のみ置換します。cancel/error は既存 destination を保持します。" },
      ], formulaHeading: "出力式", formulaLabels: ["source/target full scale", "Preserve と Scale", "aligned output size"], note: { kind: "danger", title: "export 安全条件", text: "open source の上書き、無効 crop、bit depth 不一致、size overflow、stale generation は拒否されます。" } },
    boundaries: { kicker: "失敗モード", title: "境界検査、性能、トラブルシュート", summary: "descriptor error、missing data、algorithm limit、stale async work を症状から区別します。", level: "上級", readingTime: "約 9 分",
      blocks: [
        { title: "主な境界", text: "寸法は 1–25000 × 1–20000、bit depth は 8–16、Quad Phase は各軸 0–3、ROI は画像内の包含整数 endpoint です。address、積、output size は overflow check されます。" },
        { title: "症状", text: "斜めずれは width/Packing/rowStride、2×2/4×4 色周期は CFA/Phase、frame 干渉は frameStride、<code>valid &lt; expected</code> は不足 source byte を示します。" },
      ], note: { kind: "warning", title: "preview の許容と export は別", text: "preview は短い stride や partial frame を診断できますが、export は確定的 layout と snapshot のためより厳格です。" } },
    glossary: { kicker: "用語と主張", title: "用語集と結果の解釈", summary: "RAW workflow の用語を統一し、eRAW の結果が何を意味するかを明確にします。", level: "入門", readingTime: "約 7 分",
      blocks: [
        { title: "データ用語", text: "<code>DN</code> は unpack 後の Digital Number で、光子、電子、表示輝度ではありません。<code>Packing</code> は bit の byte 配置、<code>Stride</code> は row/frame start 間の byte 距離です。" },
        { title: "空間と結論", text: "<code>CFA</code>、<code>Phase</code>、<code>Remosaic</code>、<code>Demosaic</code>、<code>LOD</code>、<code>ROI</code> は別の責務です。eRAW は現在 descriptor と ROI の L0 DN、選択 algorithm の出力を説明できますが、未知形式や sensor 全特性、camera ISP 色は推定しません。" },
      ], note: { kind: "supplement", title: "マニュアル版", text: "本リファレンスは eRAW V0.5.4 に対応します。Packing、処理、統計の変更時は code、式、test、全言語 catalog を同時更新します。" } },
  },
};

const ES_COPY: LocaleCopy = {
  groupTitles: { guide: "Uso básico", data: "Interpretación de datos", processing: "Procesamiento y visualización", analysis: "Análisis y salida", reference: "Límites y referencia" },
  ui: { manualTitle: "Manual de usuario", subtitle: "Referencia técnica · Español", navigationLabel: "Índice del manual", home: "Inicio del manual", previous: "Anterior", next: "Siguiente", first: "Este es el primer artículo", last: "Este es el último artículo", article: "Artículo {current} / {total}" },
  admonitionLabels: { tip: "CONSEJO", warning: "ADVERTENCIA", danger: "ERROR Y RIESGO", supplement: "NOTA ADICIONAL" },
  sections: {
    start: { kicker: "RUTA DE LECTURA", title: "Cómo usar este manual técnico", summary: "Empiece con una inspección RAW reproducible y continúe con datos, algoritmos, estadísticas o exportación según la tarea.", level: "Introducción", readingTime: "Unos 4 min",
      blocks: [{ title: "Describir los bytes", text: "eRAW no adivina formatos desconocidos. Abra con <code>Ctrl+O</code> y registre dimensiones, Packing, profundidad de bits, CFA, Phase, offsets y strides: el descriptor es el contrato que convierte bytes en coordenadas y DN." }, { title: "Validar antes de interpretar", text: "Compruebe primero la continuidad RAW y después los sitios CFA y Phase. Inspeccione DN L0 o Histogram/Profile de un ROI inclusivo y congele todas las condiciones antes de exportar." }],
      note: { kind: "tip", title: "Conserve un registro mínimo", text: "Guarde checksum, dimensiones, Packing, profundidad, CFA/Phase, frame, ROI y parámetros de exportación. Solo se pueden comparar resultados con entradas reproducibles." } },
    workflow: { kicker: "MODELO OPERATIVO", title: "Sesiones de archivo, lienzo y atajos", summary: "Relacione documento, frame y estado de vista para no reutilizar resultados obsoletos.", level: "Introducción", readingTime: "Unos 6 min",
      blocks: [{ title: "Ciclo del documento", text: "Solo hay un documento RAW activo. Abrir otro archivo o aplicar un descriptor invalida tiles y estadísticas anteriores. <code>Ctrl+W</code> libera el mapeo de solo lectura sin borrar preferencias guardadas." }, { title: "Vista y tareas", text: "La rueda amplía bajo el puntero y el arrastre izquierdo desplaza. <code>Ctrl+0</code> ajusta, <code>Ctrl+1</code> vuelve al 100%, <code>R</code> crea ROI, <code>Ctrl+I</code> abre estadísticas, <code>Ctrl+E</code> exporta y <code>F1</code> abre este manual." }],
      note: { kind: "supplement", title: "La presentación no modifica los datos", text: "Tema, idioma, tamaño de fuente, panel, velocidad, caché y movimiento reducido no cambian bytes, DN, CFA, estadísticas ni exportación determinista." } },
    layout: { kicker: "DEL ARCHIVO AL FRAME", title: "Diseño de archivo, strides y recuento de frames", summary: "Localice cada frame, fila y grupo de píxeles con ecuaciones explícitas de bytes.", level: "Avanzado", readingTime: "Unos 9 min",
      blocks: [{ title: "Tamaño mínimo de fila", text: "Packing determina los bytes mínimos para el ancho activo <code>W</code>. El redondeo superior hace que un último grupo MIPI incompleto ocupe un grupo de almacenamiento completo." }, { title: "Strides y frame parcial", text: "Solo un stride explícito igual a cero activa el cálculo automático. Tras retirar headerOffset, cualquier byte restante crea un frame parcial inspeccionable; los píxeles sin bytes suficientes son missing, no cero." }],
      formulaHeading: "Ecuaciones de disposición", formulaLabels: ["Unpacked8", "Unpacked16", "MIPI RAW10", "MIPI RAW12", "MIPI RAW14", "Alineación superior", "Diseño automático", "Recuento de frames"], note: { kind: "warning", title: "Orden de diagnóstico", text: "Para cortes diagonales revise ancho, Packing, rowStride y headerOffset; para interferencia entre frames revise frameStride." } },
    packing: { kicker: "DE BYTES A DN", title: "Decodificación Unpacked y MIPI RAW", summary: "Entienda cómo profundidad, endianness, alineación de bits y grupos MIPI forman el DN del sensor.", level: "Referencia", readingTime: "Unos 10 min",
      blocks: [{ title: "Contenedores Unpacked", text: "Unpacked8 lee un byte; Unpacked16 combina dos según el endianness. La alineación MSB solo se aplica a Unpacked y después se enmascara la profundidad efectiva." }, { title: "Grupos MIPI fijos", text: "RAW10 usa 5 bytes/4 píxeles, RAW12 3 bytes/2 píxeles y RAW14 7 bytes/4 píxeles. Endianness y posición de bits válidos no se aplican a estos Packing fijos." }],
      formulaHeading: "Ecuaciones de decodificación", formulaLabels: ["Extracción de bits válidos", "Píxel i de RAW10", "Par RAW12", "Ensamblado RAW14"], note: { kind: "danger", title: "Un grupo truncado es dato ausente", text: "Si falta cualquier byte requerido, el píxel es missing y nunca debe interpretarse silenciosamente como DN 0." } },
    cfa: { kicker: "MUESTREO ESPACIAL", title: "Bayer, Quad CFA y Phase", summary: "CFA define el sitio de muestreo del sensor en cada coordenada, no un tinte de pantalla.", level: "Avanzado", readingTime: "Unos 9 min",
      blocks: [{ title: "Período y Phase", text: "Bayer estándar tiene período 2×2; Quad CFA crea bloques 2×2 del mismo color y período 4×4. Phase es el offset de coordenadas dentro de ese período, de 0 a 3 por eje." }, { title: "Recorte", text: "El recorte mueve el origen. Bayer actualiza RGGB/BGGR/GBRG/GRBG; la exportación Quad original conserva el tipo y actualiza Phase módulo cuatro." }],
      formulaHeading: "Ecuaciones de sitios", formulaLabels: ["Coordenada macro Quad", "Plano atómico estadístico", "Phase tras recorte Quad"], note: { kind: "tip", title: "Distinguir CFA de layout", text: "Un error CFA/Phase se repite en 2×2 o 4×4 sin romper la geometría; Packing/rowStride desplaza continuamente bytes posteriores." } },
    remosaic: { kicker: "PROCESAMIENTO QUAD CFA", title: "Remosaic: permutación y reconstrucción del mismo color", summary: "Convierta Quad CFA en Bayer mediante permutación reversible o reconstrucción bilineal del mismo color.", level: "Referencia", readingTime: "Unos 11 min",
      blocks: [{ title: "Permutación", text: "Cada eje aplica <code>[0,1,2,3] → [0,2,1,3]</code>. La combinación reordena el bloque Quad 4×4 sin interpolar DN y es reversible en el orden de sitios." }, { title: "Reconstrucción", text: "Para cada sitio Bayer se buscan muestras Quad válidas del mismo color. Hasta cuatro esquinas se combinan con pesos bilineales; las inválidas se excluyen y los pesos restantes se normalizan." }],
      formulaHeading: "Ecuaciones de Remosaic", formulaLabels: ["Coordenada fuente en un eje", "Pesos bidimensionales"], note: { kind: "warning", title: "Mayor coste", text: "La permutación lee un DN por salida; la reconstrucción puede buscar y leer cuatro esquinas, por lo que cuesta más en imágenes grandes." } },
    demosaic: { kicker: "DE BAYER A RGB", title: "Contrato real del Demosaic bilineal", summary: "Conserve el canal muestreado y reconstruya los otros con vecinos válidos del mismo canal en 3×3.", level: "Referencia", readingTime: "Unos 10 min",
      blocks: [{ title: "Orden", text: "Bayer entra directamente; Quad CFA aplica antes el Remosaic elegido. MONO no puede producir RGB porque carece de semántica de sitios de color." }, { title: "Media local", text: "El canal central conserva su DN. Cada canal ausente usa la media aritmética truncada de vecinos válidos del mismo canal; los missing no entran en el denominador." }],
      formulaHeading: "Ecuaciones de vecindad", formulaLabels: ["Conjunto del canal objetivo", "Reconstrucción de canal"], note: { kind: "tip", title: "Render diagnóstico", text: "Es local, determinista y explicable; sirve para revisar CFA y continuidad, no representa la calidad final de un ISP de cámara." } },
    rendering: { kicker: "DE DN A PANTALLA", title: "Normalización, tiles y LOD", summary: "Separe el valor RAW de la vista previa de 8 bits, el render por tiles y la selección LOD.", level: "Avanzado", readingTime: "Unos 10 min",
      blocks: [{ title: "Rango de pantalla", text: "DN se limita a <code>[L,H]</code> y se mapea a 0–255. Si <code>H≤L</code>, solo DN mayores que L son blancos. Este mapeo no cambia DN, estadísticas ni exportación." }, { title: "Tiles y LOD", text: "Cada render lleva generation/revision y un resultado antiguo se rechaza como stale. Los LOD RAW/CFA conservan sitios; la vista completa elige el LOD de mayor resolución con lado largo ≤4096 px." }],
      formulaHeading: "Ecuaciones de pantalla y LOD", formulaLabels: ["Rango normal H > L", "Rango degenerado H ≤ L", "LOD ideal"], note: { kind: "supplement", title: "La vista completa sigue siendo preview", text: "Sirve para compartir la presentación, pero no sustituye DN L0 ni estadísticas exactas L0." } },
    inspection: { kicker: "COORDENADAS Y VALIDEZ", title: "Inspección de píxeles, ROI y datos ausentes", summary: "Use coordenadas absolutas y ROI inclusivo manteniendo separados los datos ausentes y el cero.", level: "Introducción", readingTime: "Unos 7 min",
      blocks: [{ title: "Píxel y ROI", text: "A gran zoom se muestran rejilla y DN. Desactivar valores conserva la rejilla sin consultar DN. Ambos extremos del ROI son coordenadas absolutas incluidas; un único píxel forma un ROI 1×1 válido." }, { title: "Missing no es cero", text: "En un frame parcial puede faltar el byte de una coordenada válida. Preview lo marca, estadísticas lo cuentan y excluyen, y exportación usa un fill explícito." }],
      formulaHeading: "Extremos inclusivos a dimensiones", formulaLabels: ["Rectángulo ROI inclusivo"], note: { kind: "danger", title: "No sustituya ausencia por cero", text: "DN 0 es un código medido válido. Confundirlo con missing sesga Histogram, media, varianza y salida." } },
    statistics: { kicker: "CONTRATO ESTADÍSTICO EXACTO", title: "Histogram, media, varianza y percentiles", summary: "Escanee una vez DN CFA L0 del frame actual y calcule estadísticas deterministas conservando missing.", level: "Referencia", readingTime: "Unos 12 min",
      blocks: [{ title: "Rango y grupos", text: "Sin ROI se escanea el frame; con ROI, su rectángulo inclusivo. Nunca se leen 8-bit de pantalla, LOD ni RGB Demosaic. MONO ofrece Y y CFA ofrece All y grupos de color." }, { title: "Varianza de población", text: "Welford actualiza solo DN válidos y divide por <code>n</code>, porque el ROI actual es la población. Los percentiles proceden del Histogram entero exacto y su acumulado." }],
      formulaHeading: "Ecuaciones estadísticas", formulaLabels: ["Recuento missing", "Welford y varianza de población", "Percentil discreto"], note: { kind: "warning", title: "Límite de medición", text: "Son estadísticas descriptivas de un frame y ROI; no son ruido temporal, linealidad de exposición ni una medición EMVA 1288 completa." } },
    charts: { kicker: "VISUALIZACIÓN ACOTADA", title: "Agregación y lectura de gráficos", summary: "Conserve resúmenes exactos reduciendo solo los puntos enviados al render interactivo.", level: "Avanzado", readingTime: "Unos 8 min",
      blocks: [{ title: "Histogram", text: "Si hay más de 4096 bins, se suman bins consecutivos y se dibuja su punto medio. Recuentos, media, varianza y percentiles siguen exactos." }, { title: "Profile", text: "Los Profiles largos conservan primero, último y mínimos/máximos ordenados por bucket para mantener picos con un máximo de 4096 puntos." }],
      formulaHeading: "Ecuaciones de reducción", formulaLabels: ["Buckets de Histogram", "Envolvente min–max de Profile"], note: { kind: "supplement", title: "La reducción no cambia los resúmenes", text: "Solo se reduce el payload gráfico; las estadísticas exactas se calculan antes." } },
    export: { kicker: "SALIDA DETERMINISTA", title: "Recorte, mapeo numérico y escritura segura", summary: "Congele fuente y destino para escribir CFA, Remosaic Bayer o Demosaic RGB48.", level: "Referencia", readingTime: "Unos 11 min",
      blocks: [{ title: "Snapshot y mapeo", text: "Se fijan generation, frame, descriptor, procesamiento, crop, fill, Packing, bit depth, endianness y alignment. Preserve limita al máximo destino; Scale mapea full scale con redondeo entero." }, { title: "Sustitución segura", text: "Se escribe primero un archivo temporal y solo se sustituye al terminar; cancelar o fallar conserva el destino existente." }],
      formulaHeading: "Ecuaciones de salida", formulaLabels: ["Full scale fuente y destino", "Preserve y Scale", "Tamaño alineado"], note: { kind: "danger", title: "Restricciones de seguridad", text: "Se rechazan sobrescribir la fuente abierta, crop inválido, MIPI con profundidad incompatible, overflow y generation stale." } },
    boundaries: { kicker: "MODOS DE FALLO", title: "Límites, rendimiento y diagnóstico", summary: "Separe errores de descriptor, ausencia de datos, límites algorítmicos y trabajo asíncrono stale.", level: "Avanzado", readingTime: "Unos 9 min",
      blocks: [{ title: "Límites", text: "Dimensiones: 1–25000 × 1–20000; bit depth: 8–16; Quad Phase: 0–3; ROI: enteros inclusivos dentro de imagen. Direcciones, productos y tamaños comprueban overflow." }, { title: "Síntomas", text: "Corte diagonal: width/Packing/rowStride; ciclo 2×2/4×4: CFA/Phase; frames mezclados: frameStride; <code>valid &lt; expected</code>: faltan bytes." }],
      note: { kind: "warning", title: "La tolerancia de preview no autoriza exportar", text: "Preview puede diagnosticar strides cortos y frames parciales; exportación exige snapshot y layout deterministas." } },
    glossary: { kicker: "TÉRMINOS Y CONCLUSIONES", title: "Glosario e interpretación", summary: "Unifique términos RAW y determine qué conclusiones admite eRAW.", level: "Introducción", readingTime: "Unos 7 min",
      blocks: [{ title: "Datos", text: "<code>DN</code> es Digital Number tras desempaquetar, no fotones ni brillo. <code>Packing</code> organiza bits en bytes; <code>Stride</code> separa inicios de fila/frame." }, { title: "Espacio y alcance", text: "CFA, Phase, Remosaic, Demosaic, LOD y ROI tienen responsabilidades distintas. eRAW explica el descriptor actual, DN L0 y salida elegida; no descubre formatos desconocidos ni caracteriza todo el sensor o ISP." }],
      note: { kind: "supplement", title: "Versión del manual", text: "Esta referencia corresponde a eRAW V0.5.4. Cambios de Packing, procesamiento o estadísticas deben actualizar código, fórmulas, tests y todos los idiomas juntos." } },
  },
};

const FR_COPY: LocaleCopy = {
  groupTitles: { guide: "Prise en main", data: "Interprétation des données", processing: "Traitement et affichage", analysis: "Analyse et sortie", reference: "Limites et référence" },
  ui: { manualTitle: "Manuel utilisateur", subtitle: "Référence technique · Français", navigationLabel: "Sommaire du manuel", home: "Accueil du manuel", previous: "Précédent", next: "Suivant", first: "Premier article", last: "Dernier article", article: "Article {current} / {total}" },
  admonitionLabels: { tip: "CONSEIL", warning: "AVERTISSEMENT", danger: "ERREUR ET RISQUE", supplement: "COMPLÉMENT" },
  sections: {
    start: { kicker: "PARCOURS DE LECTURE", title: "Utiliser ce manuel technique", summary: "Commencez par une inspection RAW reproductible, puis consultez les données, algorithmes, statistiques ou exports utiles.", level: "Débutant", readingTime: "Environ 4 min", blocks: [{ title: "Décrire les octets", text: "eRAW ne devine pas un format inconnu. Ouvrez avec <code>Ctrl+O</code> et consignez dimensions, Packing, bit depth, CFA, Phase, offsets et strides : le descripteur transforme les octets en coordonnées et DN." }, { title: "Valider avant d'interpréter", text: "Contrôlez la continuité RAW, puis les sites CFA et la Phase. Inspectez les DN L0 ou Histogram/Profile d'un ROI inclusif et figez toutes les conditions avant export." }], note: { kind: "tip", title: "Conserver une trace minimale", text: "Notez checksum, dimensions, Packing, profondeur, CFA/Phase, frame, ROI et paramètres d'export. Les résultats ne sont comparables qu'avec des entrées reproductibles." } },
    workflow: { kicker: "MODÈLE D'UTILISATION", title: "Sessions de fichier, canevas et raccourcis", summary: "Reliez document, frame et vue pour éviter de réutiliser des résultats périmés.", level: "Débutant", readingTime: "Environ 6 min", blocks: [{ title: "Durée de vie", text: "Un seul document RAW est actif. Ouvrir un autre fichier ou appliquer un descripteur invalide les anciens tiles et statistiques. <code>Ctrl+W</code> libère le mapping en lecture seule sans effacer les préférences." }, { title: "Vue et tâches", text: "La molette zoome sous le pointeur et le glisser gauche déplace. <code>Ctrl+0</code> ajuste, <code>Ctrl+1</code> affiche 100 %, <code>R</code> crée un ROI, <code>Ctrl+I</code> ouvre les statistiques, <code>Ctrl+E</code> exporte et <code>F1</code> ouvre ce manuel." }], note: { kind: "supplement", title: "La présentation ne modifie pas les données", text: "Thème, langue, police, panneau, vitesse, cache et animations n'altèrent ni octets, DN, CFA, statistiques, ni export déterministe." } },
    layout: { kicker: "DU FICHIER AU FRAME", title: "Disposition, strides et nombre de frames", summary: "Localisez chaque frame, ligne et groupe de pixels avec des équations d'octets explicites.", level: "Avancé", readingTime: "Environ 9 min", blocks: [{ title: "Taille minimale d'une ligne", text: "Packing fixe les octets minimaux pour la largeur active <code>W</code>. L'arrondi supérieur réserve un groupe MIPI complet même si le dernier est incomplet." }, { title: "Strides et frame partiel", text: "Le calcul automatique n'est utilisé que si le stride explicite vaut zéro. Après headerOffset, tout reste crée un frame partiel inspectable ; un pixel sans octets suffisants est missing, pas zéro." }], formulaHeading: "Équations de disposition", formulaLabels: ["Unpacked8", "Unpacked16", "MIPI RAW10", "MIPI RAW12", "MIPI RAW14", "Alignement supérieur", "Disposition automatique", "Nombre de frames"], note: { kind: "warning", title: "Ordre de diagnostic", text: "Pour un cisaillement, vérifiez largeur, Packing, rowStride, headerOffset ; pour des frames mélangés, vérifiez frameStride." } },
    packing: { kicker: "DES OCTETS AU DN", title: "Décodage Unpacked et MIPI RAW", summary: "Comprenez comment profondeur, endianness, alignement des bits et groupes MIPI produisent le DN.", level: "Référence", readingTime: "Environ 10 min", blocks: [{ title: "Conteneurs Unpacked", text: "Unpacked8 lit un octet ; Unpacked16 en combine deux selon l'endianness. L'alignement MSB ne vaut que pour Unpacked, puis la profondeur effective est masquée." }, { title: "Groupes MIPI fixes", text: "RAW10 emploie 5 octets/4 pixels, RAW12 3/2 et RAW14 7/4. Endianness et position des bits valides ne s'appliquent pas à ces Packing fixes." }], formulaHeading: "Équations de décodage", formulaLabels: ["Extraction des bits valides", "Pixel i RAW10", "Paire RAW12", "Assemblage RAW14"], note: { kind: "danger", title: "Un groupe tronqué est absent", text: "S'il manque un octet requis, le pixel est missing et ne doit jamais devenir silencieusement DN 0." } },
    cfa: { kicker: "ÉCHANTILLONNAGE SPATIAL", title: "Bayer, Quad CFA et Phase", summary: "Le CFA définit le site capteur associé à chaque coordonnée, pas une teinte d'affichage.", level: "Avancé", readingTime: "Environ 9 min", blocks: [{ title: "Période et Phase", text: "Bayer standard a une période 2×2 ; Quad CFA forme des blocs 2×2 de même couleur et une période 4×4. Phase est l'offset dans cette période, de 0 à 3 par axe." }, { title: "Recadrage", text: "Le crop déplace l'origine. Bayer met à jour RGGB/BGGR/GBRG/GRBG ; l'export Quad original conserve le type et met Phase à jour modulo quatre." }], formulaHeading: "Équations de sites", formulaLabels: ["Macro-coordonnée Quad", "Plan atomique statistique", "Phase après crop Quad"], note: { kind: "tip", title: "Distinguer CFA et disposition", text: "Une erreur CFA/Phase se répète en 2×2 ou 4×4 sans casser la géométrie ; Packing/rowStride décale progressivement les octets." } },
    remosaic: { kicker: "TRAITEMENT QUAD CFA", title: "Remosaic : permutation et reconstruction même couleur", summary: "Convertissez Quad CFA en Bayer par permutation réversible ou reconstruction bilinéaire même couleur.", level: "Référence", readingTime: "Environ 11 min", blocks: [{ title: "Permutation", text: "Chaque axe applique <code>[0,1,2,3] → [0,2,1,3]</code>. Le bloc Quad 4×4 passe en ordre Bayer sans interpoler DN ; l'ordre des sites est réversible." }, { title: "Reconstruction", text: "Pour chaque site Bayer, les échantillons Quad valides de même couleur sont recherchés. Jusqu'à quatre coins sont pondérés ; les invalides sont exclus et les poids restants renormalisés." }], formulaHeading: "Équations Remosaic", formulaLabels: ["Coordonnée source sur un axe", "Poids bidimensionnels"], note: { kind: "warning", title: "Coût supérieur", text: "La permutation lit un DN par sortie ; la reconstruction peut rechercher et lire quatre coins, donc coûte plus sur une grande image." } },
    demosaic: { kicker: "DE BAYER À RGB", title: "Contrat réel du Demosaic bilinéaire", summary: "Conservez le canal échantillonné et reconstruisez les autres depuis les voisins valides du même canal en 3×3.", level: "Référence", readingTime: "Environ 10 min", blocks: [{ title: "Ordre", text: "Bayer entre directement ; Quad CFA applique d'abord le Remosaic choisi. MONO ne produit pas de RGB faute de sites couleur." }, { title: "Moyenne locale", text: "Le canal central conserve son DN. Chaque canal absent utilise la moyenne entière des voisins valides du même canal ; les missing sont exclus du dénominateur." }], formulaHeading: "Équations de voisinage", formulaLabels: ["Ensemble du canal cible", "Reconstruction du canal"], note: { kind: "tip", title: "Rendu de diagnostic", text: "La méthode est locale et explicable : utile pour CFA et continuité, elle ne représente pas la qualité finale d'un ISP." } },
    rendering: { kicker: "DU DN À L'ÉCRAN", title: "Normalisation, tiles et LOD", summary: "Séparez la valeur RAW de la preview 8-bit, du rendu par tiles et du choix LOD.", level: "Avancé", readingTime: "Environ 10 min", blocks: [{ title: "Plage d'affichage", text: "DN est limité à <code>[L,H]</code> puis mappé sur 0–255. Si <code>H≤L</code>, seuls les DN supérieurs à L sont blancs. Ce mapping ne modifie ni DN, statistiques, ni export." }, { title: "Tiles et LOD", text: "Chaque rendu porte generation/revision ; un résultat ancien est rejeté comme stale. Les LOD RAW/CFA gardent les sites et la preview complète choisit le meilleur niveau dont le grand côté ≤4096 px." }], formulaHeading: "Équations d'affichage et LOD", formulaLabels: ["Plage normale H > L", "Plage dégénérée H ≤ L", "LOD idéal"], note: { kind: "supplement", title: "La preview complète reste une preview", text: "Elle partage la présentation, mais ne remplace pas l'export DN L0 ni les statistiques L0 exactes." } },
    inspection: { kicker: "COORDONNÉES ET VALIDITÉ", title: "Inspection des pixels, ROI et données manquantes", summary: "Employez des coordonnées absolues et un ROI inclusif en distinguant données manquantes et zéro.", level: "Débutant", readingTime: "Environ 7 min", blocks: [{ title: "Pixel et ROI", text: "À fort zoom, grille et DN peuvent être affichés. Désactiver les valeurs garde la grille sans lire DN. Les deux extrémités du ROI sont incluses ; un pixel forme un ROI 1×1 valide." }, { title: "Une donnée manquante n'est pas zéro", text: "Dans un frame partiel, une coordonnée valide peut manquer d'octets. Preview la marque, les statistiques la comptent et l'excluent, l'export emploie un fill explicite." }], formulaHeading: "Extrémités inclusives vers dimensions", formulaLabels: ["Rectangle ROI inclusif"], note: { kind: "danger", title: "Ne pas remplacer l'absence par zéro", text: "DN 0 est un code valide. Le confondre avec une donnée manquante biaise Histogram, moyenne, variance et sortie." } },
    statistics: { kicker: "CONTRAT STATISTIQUE EXACT", title: "Histogram, moyenne, variance et percentiles", summary: "Parcourez une fois les DN CFA L0 du frame et calculez des statistiques déterministes avec traçabilité missing.", level: "Référence", readingTime: "Environ 12 min", blocks: [{ title: "Plage et groupes", text: "Sans ROI, tout le frame est lu ; avec ROI, son rectangle inclusif. Jamais les 8-bit écran, LOD ou RGB Demosaic. MONO fournit Y ; CFA fournit All et groupes couleur." }, { title: "Variance de population", text: "Welford met à jour les DN valides et divise par <code>n</code>, le ROI étant la population. Les percentiles viennent du Histogram entier exact et de son cumul." }], formulaHeading: "Équations statistiques", formulaLabels: ["Compte missing", "Welford et variance de population", "Percentile discret"], note: { kind: "warning", title: "Limite de mesure", text: "Ce sont des statistiques descriptives d'un frame/ROI, pas le bruit temporel, la linéarité d'exposition ni une mesure EMVA 1288 complète." } },
    charts: { kicker: "VISUALISATION BORNÉE", title: "Agrégation et lecture des graphiques", summary: "Gardez les résumés exacts en réduisant seulement les points envoyés au rendu interactif.", level: "Avancé", readingTime: "Environ 8 min", blocks: [{ title: "Histogram", text: "Au-delà de 4096 bins, des bins consécutifs sont sommés et tracés à leur milieu. Comptes, moyenne, variance et percentiles restent exacts." }, { title: "Profile", text: "Les Profiles longs gardent premier, dernier et min/max ordonnés par bucket, préservant les pics avec au plus 4096 points." }], formulaHeading: "Équations de réduction", formulaLabels: ["Buckets Histogram", "Enveloppe min–max Profile"], note: { kind: "supplement", title: "La réduction ne change pas les résumés", text: "Seul le payload graphique diminue ; les statistiques exactes sont calculées avant." } },
    export: { kicker: "SORTIE DÉTERMINISTE", title: "Crop, mapping numérique et écriture sûre", summary: "Figez source et cible pour écrire CFA, Remosaic Bayer ou Demosaic RGB48.", level: "Référence", readingTime: "Environ 11 min", blocks: [{ title: "Snapshot et mapping", text: "Generation, frame, descripteur, traitement, crop, fill, Packing, bit depth, endianness et alignment sont figés. Preserve limite au maximum cible ; Scale mappe les pleines échelles avec arrondi entier." }, { title: "Remplacement sûr", text: "Un fichier temporaire est écrit puis remplace la cible uniquement après succès ; annulation ou erreur conserve la cible existante." }], formulaHeading: "Équations de sortie", formulaLabels: ["Pleines échelles source/cible", "Preserve et Scale", "Taille alignée"], note: { kind: "danger", title: "Contraintes de sécurité", text: "Sont refusés : écraser la source ouverte, crop invalide, MIPI incompatible, overflow et generation stale." } },
    boundaries: { kicker: "MODES D'ÉCHEC", title: "Limites, performances et diagnostic", summary: "Séparez erreurs de descripteur, données absentes, limites algorithmiques et tâches stale.", level: "Avancé", readingTime: "Environ 9 min", blocks: [{ title: "Limites", text: "Dimensions 1–25000 × 1–20000 ; bit depth 8–16 ; Quad Phase 0–3 ; ROI entier inclusif dans l'image. Adresses, produits et tailles sont protégés contre overflow." }, { title: "Symptômes", text: "Cisaillement : width/Packing/rowStride ; cycle 2×2/4×4 : CFA/Phase ; frames mêlés : frameStride ; <code>valid &lt; expected</code> : octets absents." }], note: { kind: "warning", title: "La tolérance preview n'autorise pas l'export", text: "Preview peut diagnostiquer strides courts et frames partiels ; l'export exige snapshot et disposition déterministes." } },
    glossary: { kicker: "TERMES ET CONCLUSIONS", title: "Glossaire et interprétation", summary: "Uniformisez le vocabulaire RAW et les conclusions permises par eRAW.", level: "Débutant", readingTime: "Environ 7 min", blocks: [{ title: "Données", text: "<code>DN</code> est le Digital Number après unpack, pas des photons ni la luminosité. <code>Packing</code> place les bits dans les octets ; <code>Stride</code> sépare les débuts de lignes/frames." }, { title: "Espace et portée", text: "CFA, Phase, Remosaic, Demosaic, LOD et ROI ont des rôles distincts. eRAW explique le descripteur, les DN L0 et la sortie choisie ; il ne découvre pas un format inconnu et ne caractérise pas tout le capteur ou l'ISP." }], note: { kind: "supplement", title: "Version du manuel", text: "Cette référence suit eRAW V0.5.4. Toute modification Packing, traitement ou statistiques doit mettre à jour code, formules, tests et toutes les langues ensemble." } },
  },
};

const DE_COPY: LocaleCopy = {
  groupTitles: { guide: "Grundlagen", data: "Dateninterpretation", processing: "Verarbeitung und Anzeige", analysis: "Analyse und Ausgabe", reference: "Grenzen und Referenz" },
  ui: { manualTitle: "Benutzerhandbuch", subtitle: "Technische Referenz · Deutsch", navigationLabel: "Inhalt des Benutzerhandbuchs", home: "Handbuch-Startseite", previous: "Zurück", next: "Weiter", first: "Dies ist der erste Artikel", last: "Dies ist der letzte Artikel", article: "Artikel {current} / {total}" },
  admonitionLabels: { tip: "HINWEIS", warning: "WARNUNG", danger: "FEHLER UND RISIKO", supplement: "ERGÄNZUNG" },
  sections: {
    start: { kicker: "LESEPFAD", title: "Dieses technische Handbuch verwenden", summary: "Beginnen Sie mit einer reproduzierbaren RAW-Prüfung und wechseln Sie dann zu Daten, Algorithmen, Statistik oder Export.", level: "Einstieg", readingTime: "Ca. 4 Min.", blocks: [{ title: "Bytes beschreiben", text: "eRAW errät kein unbekanntes Format. Öffnen Sie mit <code>Ctrl+O</code> und notieren Sie Maße, Packing, bit depth, CFA, Phase, Offsets und Strides. Der Descriptor ist der Vertrag von Bytes zu Koordinaten und DN." }, { title: "Vor der Interpretation prüfen", text: "Prüfen Sie zuerst RAW-Kontinuität, dann CFA-Sites und Phase. Untersuchen Sie L0-DN oder Histogram/Profile einer inklusiven ROI und fixieren Sie alle Bedingungen vor dem Export." }], note: { kind: "tip", title: "Minimales Versuchsprotokoll führen", text: "Speichern Sie Checksumme, Maße, Packing, Bittiefe, CFA/Phase, Frame, ROI und Exportparameter. Nur reproduzierbare Eingaben erlauben Vergleiche." } },
    workflow: { kicker: "BEDIENMODELL", title: "Dateisitzung, Canvas und Kurzbefehle", summary: "Verstehen Sie Dokument, Frame und Ansicht, damit veraltete Ergebnisse nicht in eine neue Datei gelangen.", level: "Einstieg", readingTime: "Ca. 6 Min.", blocks: [{ title: "Dokumentlebensdauer", text: "Es ist genau ein RAW-Dokument aktiv. Eine neue Datei oder ein neuer Descriptor verwirft alte Tiles und Statistik. <code>Ctrl+W</code> gibt das read-only Mapping frei, behält aber gespeicherte Einstellungen." }, { title: "Ansicht und Aufgaben", text: "Das Rad zoomt unter dem Zeiger, linkes Ziehen verschiebt. <code>Ctrl+0</code> passt ein, <code>Ctrl+1</code> zeigt 100 %, <code>R</code> wählt ROI, <code>Ctrl+I</code> öffnet Statistik, <code>Ctrl+E</code> exportiert und <code>F1</code> öffnet dieses Handbuch." }], note: { kind: "supplement", title: "Darstellung ändert keine Sensordaten", text: "Theme, Sprache, Schrift, Sidebar, Geschwindigkeit, Cache und reduzierte Bewegung ändern weder Bytes, DN, CFA, Statistik noch deterministischen Export." } },
    layout: { kicker: "VON DATEI ZU FRAME", title: "Dateilayout, Strides und Frame-Anzahl", summary: "Lokalisieren Sie Frames, Zeilen und Pixelgruppen mit expliziten Byte-Gleichungen.", level: "Fortgeschritten", readingTime: "Ca. 9 Min.", blocks: [{ title: "Minimale Zeilengröße", text: "Packing bestimmt die Mindestbytes für die aktive Breite <code>W</code>. Aufrunden reserviert auch für eine unvollständige letzte MIPI-Gruppe eine vollständige Speichergruppe." }, { title: "Strides und Teilframe", text: "Nur ein expliziter Stride von null wird automatisch berechnet. Nach headerOffset erzeugen übrige Bytes einen prüfbaren Teilframe; Pixel ohne benötigte Bytes sind missing, nicht null." }], formulaHeading: "Byte-Layout-Gleichungen", formulaLabels: ["Unpacked8", "Unpacked16", "MIPI RAW10", "MIPI RAW12", "MIPI RAW14", "Aufrundung", "Automatisches Layout", "Frame-Anzahl"], note: { kind: "warning", title: "Prüfreihenfolge", text: "Bei Schrägversatz prüfen Sie Breite, Packing, rowStride, headerOffset; bei vermischten Frames frameStride." } },
    packing: { kicker: "VON BYTES ZU DN", title: "Unpacked- und MIPI-RAW-Decodierung", summary: "So bilden Bittiefe, Endianness, Bit-Ausrichtung und MIPI-Gruppen einen Sensor-DN.", level: "Referenz", readingTime: "Ca. 10 Min.", blocks: [{ title: "Unpacked-Container", text: "Unpacked8 liest ein Byte; Unpacked16 kombiniert zwei gemäß Endianness. MSB-Ausrichtung gilt nur für Unpacked, danach wird auf die effektive Bittiefe maskiert." }, { title: "Feste MIPI-Gruppen", text: "RAW10 nutzt 5 Bytes/4 Pixel, RAW12 3/2 und RAW14 7/4. Endianness und Position gültiger Bits gelten nicht für diese festen Packing-Formate." }], formulaHeading: "Decodiergleichungen", formulaLabels: ["Extraktion gültiger Bits", "RAW10-Pixel i", "RAW12-Paar", "RAW14-Zusammensetzung"], note: { kind: "danger", title: "Abgeschnittene Gruppe ist fehlend", text: "Fehlt ein benötigtes Byte, ist das Pixel missing und darf nicht still als DN 0 interpretiert werden." } },
    cfa: { kicker: "RÄUMLICHE ABTASTUNG", title: "Bayer, Quad CFA und Phase", summary: "CFA definiert den Sensor-Sample-Site jeder Koordinate, nicht eine Anzeigefarbe.", level: "Fortgeschritten", readingTime: "Ca. 9 Min.", blocks: [{ title: "Periode und Phase", text: "Standard-Bayer hat 2×2; Quad CFA erzeugt gleichfarbige 2×2-Blöcke und eine 4×4-Periode. Phase ist der Koordinatenoffset in dieser Periode, 0–3 je Achse." }, { title: "Crop", text: "Crop verschiebt den Ursprung. Bayer aktualisiert RGGB/BGGR/GBRG/GRBG; originaler Quad-Export behält den Typ und aktualisiert Phase modulo vier." }], formulaHeading: "Site-Gleichungen", formulaLabels: ["Quad-Makrokoordinate", "Atomare Statistikebene", "Quad-Crop-Phase"], note: { kind: "tip", title: "CFA- und Layoutfehler unterscheiden", text: "CFA/Phase-Fehler wiederholen sich 2×2 oder 4×4 bei intakter Geometrie; Packing/rowStride verschiebt fortlaufend spätere Bytes." } },
    remosaic: { kicker: "QUAD-CFA-VERARBEITUNG", title: "Remosaic: Permutation und gleichfarbige Rekonstruktion", summary: "Wandeln Sie Quad CFA durch reversible Permutation oder bilineare gleichfarbige Rekonstruktion in Bayer um.", level: "Referenz", readingTime: "Ca. 11 Min.", blocks: [{ title: "Permutation", text: "Jede Achse nutzt <code>[0,1,2,3] → [0,2,1,3]</code>. Der 4×4-Quad-Block wird ohne DN-Interpolation in Bayer-Reihenfolge gebracht; die Site-Reihenfolge ist reversibel." }, { title: "Rekonstruktion", text: "Für jeden Bayer-Site werden gültige gleichfarbige Quad-Samples gesucht. Bis zu vier Ecken werden bilinear gewichtet; ungültige Samples werden entfernt und Restgewichte normalisiert." }], formulaHeading: "Remosaic-Gleichungen", formulaLabels: ["Quellkoordinate einer Achse", "Zweidimensionale Gewichte"], note: { kind: "warning", title: "Höherer Aufwand", text: "Permutation liest einen DN je Ausgabe; Rekonstruktion kann vier Ecken suchen und lesen und ist bei großen Bildern teurer." } },
    demosaic: { kicker: "VON BAYER ZU RGB", title: "Der tatsächliche bilineare Demosaic-Vertrag", summary: "Behalten Sie den gemessenen Kanal und rekonstruieren Sie andere aus gültigen Nachbarn desselben Kanals in 3×3.", level: "Referenz", readingTime: "Ca. 10 Min.", blocks: [{ title: "Reihenfolge", text: "Bayer geht direkt ein; Quad CFA nutzt zuerst den gewählten Remosaic. MONO kann ohne Farb-Site-Semantik kein RGB liefern." }, { title: "Lokaler Mittelwert", text: "Der gemessene Center-Kanal behält DN. Fehlende Kanäle nutzen den abgerundeten Mittelwert gültiger gleichkanaliger Nachbarn; missing Samples zählen nicht im Nenner." }], formulaHeading: "Nachbarschaftsgleichungen", formulaLabels: ["Zielkanalmenge", "Kanalrekonstruktion"], note: { kind: "tip", title: "Als Diagnose-Rendering verwenden", text: "Die Methode ist lokal und erklärbar, gut für CFA und Kontinuität, aber kein Modell der finalen Kamera-ISP-Qualität." } },
    rendering: { kicker: "VON DN ZUM BILDSCHIRM", title: "Anzeigenormalisierung, Tiles und LOD", summary: "Trennen Sie RAW-Wert, 8-bit Preview, Tile-Rendering und LOD-Auswahl.", level: "Fortgeschritten", readingTime: "Ca. 10 Min.", blocks: [{ title: "Anzeigebereich", text: "DN wird auf <code>[L,H]</code> begrenzt und nach 0–255 abgebildet. Bei <code>H≤L</code> sind nur DN größer L weiß. Dies ändert weder DN, Statistik noch Export." }, { title: "Tiles und LOD", text: "Jedes Rendering trägt generation/revision; alte Resultate werden als stale verworfen. RAW/CFA-LOD bewahren Sites; Full Preview wählt die höchste Auflösung mit langer Kante ≤4096 px." }], formulaHeading: "Anzeige- und LOD-Gleichungen", formulaLabels: ["Normalbereich H > L", "Entarteter Bereich H ≤ L", "Idealer LOD"], note: { kind: "supplement", title: "Full Preview bleibt Preview", text: "Sie teilt die aktuelle Darstellung, ersetzt aber weder L0-DN-Export noch exakte L0-Statistik." } },
    inspection: { kicker: "KOORDINATEN UND GÜLTIGKEIT", title: "Pixelprüfung, ROI und fehlende Daten", summary: "Nutzen Sie absolute Koordinaten und inklusive ROI und trennen Sie fehlende Daten von null.", level: "Einstieg", readingTime: "Ca. 7 Min.", blocks: [{ title: "Pixel und ROI", text: "Bei starkem Zoom sind Grid und DN sichtbar. Ohne Werte bleibt das Grid, ohne DN-Abfrage. Beide ROI-Endpunkte sind inklusive absolute Bildkoordinaten; ein Pixel ist eine gültige 1×1-ROI." }, { title: "Fehlend ist nicht null", text: "In einem Teilframe können gültige Koordinaten Quellbytes fehlen. Preview markiert sie, Statistik zählt und schließt sie aus, Export nutzt einen expliziten Fill-Wert." }], formulaHeading: "Inklusive Endpunkte zu Abmessungen", formulaLabels: ["Inklusives ROI-Rechteck"], note: { kind: "danger", title: "Fehlen nicht durch null ersetzen", text: "DN 0 ist ein gültiger Messcode. Verwechslung mit fehlenden Daten verzerrt Histogram, Mittelwert, Varianz und Ausgabe." } },
    statistics: { kicker: "EXAKTER STATISTIKVERTRAG", title: "Histogram, Mittelwert, Varianz und Perzentile", summary: "Scannen Sie L0-CFA-DN des Frames einmal und berechnen Sie deterministische Statistik mit missing-Nachweis.", level: "Referenz", readingTime: "Ca. 12 Min.", blocks: [{ title: "Bereich und Gruppen", text: "Ohne ROI wird der Frame, mit ROI das inklusive Rechteck gelesen. Nie Bildschirm-8-bit, LOD oder Demosaic-RGB. MONO liefert Y, CFA liefert All und Farbgruppen." }, { title: "Populationsvarianz", text: "Welford aktualisiert nur gültige DN und teilt durch <code>n</code>, weil die ROI die Population ist. Perzentile stammen aus dem exakten Integer-Histogram und seiner kumulierten Zählung." }], formulaHeading: "Statistikgleichungen", formulaLabels: ["Missing-Anzahl", "Welford und Populationsvarianz", "Diskretes Perzentil"], note: { kind: "warning", title: "Messgrenze", text: "Dies sind deskriptive Werte eines Frames/ROI, keine zeitliche Noise-, Exposure-Linearity- oder vollständige EMVA-1288-Messung." } },
    charts: { kicker: "BEGRENZTE VISUALISIERUNG", title: "Aggregation und Lesen der Statistikdiagramme", summary: "Bewahren Sie exakte Kennwerte und reduzieren Sie nur Punkte für den interaktiven Renderer.", level: "Fortgeschritten", readingTime: "Ca. 8 Min.", blocks: [{ title: "Histogram", text: "Über 4096 Bins werden aufeinanderfolgende Bins summiert und am Mittelpunkt gezeichnet. Counts, Mittelwert, Varianz und Perzentile bleiben exakt." }, { title: "Profile", text: "Lange Profiles behalten First/Last und geordnete Min/Max je Bucket, sodass Peaks mit höchstens 4096 Punkten sichtbar bleiben." }], formulaHeading: "Reduktionsgleichungen", formulaLabels: ["Histogram-Buckets", "Profile-Min–Max-Hülle"], note: { kind: "supplement", title: "Reduktion ändert keine Kennwerte", text: "Nur die Diagrammlast sinkt; exakte Statistik wird vorher berechnet." } },
    export: { kicker: "DETERMINISTISCHE AUSGABE", title: "Crop, Zahlenabbildung und sicheres Schreiben", summary: "Fixieren Sie Quelle und Ziel für CFA, Remosaic Bayer oder Demosaic RGB48.", level: "Referenz", readingTime: "Ca. 11 Min.", blocks: [{ title: "Snapshot und Mapping", text: "Generation, Frame, Descriptor, Verarbeitung, Crop, Fill, Packing, bit depth, Endianness und Alignment werden fixiert. Preserve begrenzt auf Zielmaximum; Scale bildet Full Scales ganzzahlig ab." }, { title: "Sicheres Ersetzen", text: "Zuerst wird eine temporäre Datei geschrieben und nur nach Erfolg ersetzt; Abbruch oder Fehler bewahrt das bestehende Ziel." }], formulaHeading: "Ausgabegleichungen", formulaLabels: ["Quell-/Ziel-Full-Scale", "Preserve und Scale", "Ausgerichtete Größe"], note: { kind: "danger", title: "Sicherheitsgrenzen", text: "Überschreiben der offenen Quelle, ungültiger Crop, inkompatibles MIPI, Overflow und stale generation werden abgelehnt." } },
    boundaries: { kicker: "FEHLERMODI", title: "Grenzprüfungen, Leistung und Fehlersuche", summary: "Trennen Sie Descriptorfehler, fehlende Daten, Algorithmusgrenzen und stale Tasks.", level: "Fortgeschritten", readingTime: "Ca. 9 Min.", blocks: [{ title: "Grenzen", text: "Maße 1–25000 × 1–20000; bit depth 8–16; Quad Phase 0–3; ROI inklusive Ganzzahlen im Bild. Adressen, Produkte und Größen sind overflow-geprüft." }, { title: "Symptome", text: "Schrägversatz: width/Packing/rowStride; 2×2/4×4-Farbzyklus: CFA/Phase; vermischte Frames: frameStride; <code>valid &lt; expected</code>: fehlende Bytes." }], note: { kind: "warning", title: "Preview-Toleranz erlaubt keinen Export", text: "Preview darf kurze Strides und Teilframes diagnostizieren; Export verlangt deterministischen Snapshot und Layout." } },
    glossary: { kicker: "BEGRIFFE UND AUSSAGEN", title: "Glossar und Ergebnisinterpretation", summary: "Vereinheitlichen Sie RAW-Begriffe und die Aussagen, die eRAW stützt.", level: "Einstieg", readingTime: "Ca. 7 Min.", blocks: [{ title: "Daten", text: "<code>DN</code> ist Digital Number nach Unpacking, nicht Photonenzahl oder Helligkeit. <code>Packing</code> ordnet Bits in Bytes; <code>Stride</code> trennt Row-/Frame-Anfänge." }, { title: "Raum und Reichweite", text: "CFA, Phase, Remosaic, Demosaic, LOD und ROI haben getrennte Aufgaben. eRAW erklärt aktuellen Descriptor, L0-DN und gewählte Ausgabe; unbekannte Formate, vollständige Sensoreigenschaften oder ISP-Farbe werden nicht ermittelt." }], note: { kind: "supplement", title: "Handbuchversion", text: "Diese Referenz entspricht eRAW V0.5.4. Packing-, Verarbeitungs- oder Statistikänderungen müssen Code, Formeln, Tests und alle Sprachen gemeinsam aktualisieren." } },
  },
};

const LOCALIZED_COPY: Readonly<Record<NonChineseLocale, LocaleCopy>> = {
  en: EN_COPY,
  "zh-TW": ZH_TW_COPY,
  ja: JA_COPY,
  es: ES_COPY,
  fr: FR_COPY,
  de: DE_COPY,
};

const ZH_CN_UI: HelpUiText = {
  manualTitle: "使用手册",
  subtitle: "技术参考 · 简体中文",
  navigationLabel: "使用手册目录",
  home: "手册首页",
  previous: "上一篇",
  next: "下一篇",
  first: "已经是第一篇",
  last: "已经是最后一篇",
  article: "第 {current} / {total} 篇",
};

export function getHelpCatalog(locale: ResolvedLocale): HelpCatalog {
  if (locale === "zh-CN") return { groups: HELP_GROUPS, sections: HELP_SECTIONS, ui: ZH_CN_UI };
  return buildCatalog(locale, LOCALIZED_COPY[locale]);
}
