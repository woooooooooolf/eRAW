import type { ImagePoint } from "./viewport-transform";
import { SelectionModel, ViewportTransform } from "./viewport-transform";
import { t } from "./i18n";

export class ViewportOverlayLayer {
  readonly selection = new SelectionModel();
  private readonly svg: SVGSVGElement;
  private readonly boundaryRects: NodeListOf<SVGRectElement>;
  private readonly selectionRect: SVGRectElement;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    this.boundaryRects = svg.querySelectorAll<SVGRectElement>(".image-boundary-rect");
    const selectionRect = svg.querySelector<SVGRectElement>(".image-selection");
    if (!selectionRect) throw new Error(t("error.selectionOverlayMissing"));
    this.selectionRect = selectionRect;
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

  update(transform: ViewportTransform, imageWidth: number, imageHeight: number): void {
    const boundary = transform.imageRectToScreen({ x: 0, y: 0, width: imageWidth, height: imageHeight });
    for (const rect of this.boundaryRects) {
      this.setRect(rect, boundary);
    }
    const selection = this.selection.rect;
    if (selection) {
      this.setRect(this.selectionRect, transform.imageRectToScreen(selection));
      this.selectionRect.classList.add("visible");
    } else {
      this.selectionRect.classList.remove("visible");
    }
    this.svg.classList.add("visible");
  }

  hide(): void {
    this.svg.classList.remove("visible");
    this.selectionRect.classList.remove("visible");
  }

  private setRect(element: SVGRectElement, rect: { x: number; y: number; width: number; height: number }): void {
    element.setAttribute("x", String(rect.x));
    element.setAttribute("y", String(rect.y));
    element.setAttribute("width", String(rect.width));
    element.setAttribute("height", String(rect.height));
  }
}
