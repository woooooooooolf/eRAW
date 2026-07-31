import type { ImagePoint } from "./viewport-transform";
import { SelectionModel, ViewportTransform } from "./viewport-transform";
import { t } from "./i18n";

export class ViewportOverlayLayer {
  readonly selection = new SelectionModel();
  private readonly svg: SVGSVGElement;
  private readonly boundaryRects: NodeListOf<SVGRectElement>;
  private readonly selectionElement: HTMLElement;
  private selectionVisible = true;

  constructor(svg: SVGSVGElement, selectionElement: HTMLElement) {
    this.svg = svg;
    this.boundaryRects = svg.querySelectorAll<SVGRectElement>(".image-boundary-rect");
    if (!selectionElement) throw new Error(t("error.selectionOverlayMissing"));
    this.selectionElement = selectionElement;
  }

  beginSelection(point: ImagePoint, imageWidth: number, imageHeight: number): void {
    this.selection.begin(point, imageWidth, imageHeight);
  }

  updateSelection(point: ImagePoint, imageWidth: number, imageHeight: number): void {
    this.selection.update(point, imageWidth, imageHeight);
  }

  endSelection(): void {
    this.selection.end();
  }

  clearSelection(): void {
    this.selection.clear();
  }

  setSelection(rect: import("./viewport-transform").ImageRect | null): void {
    this.selection.set(rect);
  }

  setSelectionVisible(visible: boolean): void {
    this.selectionVisible = visible;
    if (!visible) this.selectionElement.classList.remove("visible");
  }

  update(transform: ViewportTransform, imageWidth: number, imageHeight: number): void {
    const boundary = transform.imageRectToScreen({ x: 0, y: 0, width: imageWidth, height: imageHeight });
    for (const rect of this.boundaryRects) {
      this.setRect(rect, boundary);
    }
    const selection = this.selection.rect;
    if (selection && this.selectionVisible) {
      this.setElementRect(this.selectionElement, transform.imageRectToScreen(selection));
      this.selectionElement.classList.add("visible");
    } else {
      this.selectionElement.classList.remove("visible");
    }
    this.svg.classList.add("visible");
  }

  hide(): void {
    this.svg.classList.remove("visible");
    this.selectionElement.classList.remove("visible");
  }

  private setRect(element: SVGRectElement, rect: { x: number; y: number; width: number; height: number }): void {
    element.setAttribute("x", String(rect.x));
    element.setAttribute("y", String(rect.y));
    element.setAttribute("width", String(rect.width));
    element.setAttribute("height", String(rect.height));
  }

  private setElementRect(
    element: HTMLElement,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    element.style.left = `${rect.x}px`;
    element.style.top = `${rect.y}px`;
    element.style.width = `${Math.max(1, rect.width)}px`;
    element.style.height = `${Math.max(1, rect.height)}px`;
  }
}
