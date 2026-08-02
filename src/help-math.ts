import { render } from "katex";

const KATEX_OPTIONS = {
  displayMode: true,
  output: "mathml" as const,
  strict: "ignore" as const,
  throwOnError: false,
};

export function renderHelpMath(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-latex]").forEach((element) => {
    const source = element.textContent?.trim() ?? "";
    if (!source) return;
    element.dataset.latexSource = source;
    element.title = source;
    render(source, element, KATEX_OPTIONS);
  });
}
