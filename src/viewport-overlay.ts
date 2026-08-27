import type { ImagePoint } from "./viewport-transform";
import { SelectionModel, ViewportTransform } from "./viewport-transform";
import { t } from "./i18n";
import type { ViewportCoordinateHighlight } from "./statistics-link";

export class ViewportOverlayLayer {
  readonly selection = new SelectionModel();
  private readonly svg: SVGSVGElement;
  private readonly boundaryRects: NodeListOf<SVGRectElement>;
  private readonly selectionElement: HTMLElement;
  private readonly coordinateHighlightElement: HTMLElement;
  private readonly rowHighlightElement: HTMLElement;
  private readonly columnHighlightElement: HTMLElement;
  private selectionVisible = true;
  private coordinateHighlight: ViewportCoordinateHighlight | null = null;

  constructor(
    svg: SVGSVGElement,
    selectionElement: HTMLElement,
    coordinateHighlightElement: HTMLElement,
  ) {
    this.svg = svg;
    this.boundaryRects = svg.querySelectorAll<SVGRectElement>(".image-boundary-rect");
    if (!selectionElement) throw new Error(t("error.selectionOverlayMissing"));
    this.selectionElement = selectionElement;
    this.coordinateHighlightElement = coordinateHighlightElement;
    this.rowHighlightElement = coordinateHighlightElement.querySelector<HTMLElement>(".coordinate-highlight-row")!;
    this.columnHighlightElement = coordinateHighlightElement.querySelector<HTMLElement>(".coordinate-highlight-column")!;
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

  setCoordinateHighlight(highlight: ViewportCoordinateHighlight | null): void {
    this.coordinateHighlight = highlight;
  }

  update(
    transform: ViewportTransform,
    imageWidth: number,
    imageHeight: number,
    coordinateHighlightEnabled: boolean,
  ): void {
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
    this.updateCoordinateHighlight(
      transform,
      imageWidth,
      imageHeight,
      coordinateHighlightEnabled,
    );
    this.svg.classList.add("visible");
  }

  hide(): void {
    this.svg.classList.remove("visible");
    this.selectionElement.classList.remove("visible");
    this.coordinateHighlightElement.classList.remove("visible");
    this.rowHighlightElement.classList.remove("visible");
    this.columnHighlightElement.classList.remove("visible");
  }

  private updateCoordinateHighlight(
    transform: ViewportTransform,
    imageWidth: number,
    imageHeight: number,
    enabled: boolean,
  ): void {
    const highlight = this.coordinateHighlight;
    if (!enabled || !highlight) {
      this.coordinateHighlightElement.classList.remove("visible");
      this.rowHighlightElement.classList.remove("visible");
      this.columnHighlightElement.classList.remove("visible");
      return;
    }
    const rowVisible = highlight.y !== null && highlight.y >= 0 && highlight.y < imageHeight;
    const columnVisible = highlight.x !== null && highlight.x >= 0 && highlight.x < imageWidth;
    if (rowVisible) {
      this.setElementRect(
        this.rowHighlightElement,
        transform.imageRectToScreen({ x: 0, y: highlight.y!, width: imageWidth, height: 1 }),
      );
    }
    if (columnVisible) {
      this.setElementRect(
        this.columnHighlightElement,
        transform.imageRectToScreen({ x: highlight.x!, y: 0, width: 1, height: imageHeight }),
      );
    }
    this.rowHighlightElement.classList.toggle("visible", rowVisible);
    this.columnHighlightElement.classList.toggle("visible", columnVisible);
    this.coordinateHighlightElement.classList.toggle("visible", rowVisible || columnVisible);
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
