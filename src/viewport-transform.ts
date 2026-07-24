export interface ImagePoint {
  x: number;
  y: number;
}

export interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ViewportTransform {
  cameraX = 0;
  cameraY = 0;
  zoom = 1;

  imageToScreen(point: ImagePoint): ImagePoint {
    return {
      x: this.cameraX + point.x * this.zoom,
      y: this.cameraY + point.y * this.zoom,
    };
  }

  screenToImage(point: ImagePoint): ImagePoint {
    return {
      x: (point.x - this.cameraX) / this.zoom,
      y: (point.y - this.cameraY) / this.zoom,
    };
  }

  imageRectToScreen(rect: ImageRect): ImageRect {
    const origin = this.imageToScreen(rect);
    return {
      x: origin.x,
      y: origin.y,
      width: rect.width * this.zoom,
      height: rect.height * this.zoom,
    };
  }

  screenToPixel(point: ImagePoint, imageWidth: number, imageHeight: number): ImagePoint | null {
    const image = this.screenToImage(point);
    const x = Math.floor(image.x);
    const y = Math.floor(image.y);
    if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) return null;
    return { x, y };
  }

  visibleImageRect(viewportWidth: number, viewportHeight: number, imageWidth: number, imageHeight: number): ImageRect | null {
    const topLeft = this.screenToImage({ x: 0, y: 0 });
    const bottomRight = this.screenToImage({ x: viewportWidth, y: viewportHeight });
    const x = Math.max(0, topLeft.x);
    const y = Math.max(0, topLeft.y);
    const right = Math.min(imageWidth, bottomRight.x);
    const bottom = Math.min(imageHeight, bottomRight.y);
    if (right <= x || bottom <= y) return null;
    return { x, y, width: right - x, height: bottom - y };
  }
}

export class SelectionModel {
  private value: ImageRect | null = null;
  private anchor: ImagePoint | null = null;

  get rect(): ImageRect | null {
    return this.value ? { ...this.value } : null;
  }

  clear(): void {
    this.value = null;
    this.anchor = null;
  }

  begin(point: ImagePoint, imageWidth: number, imageHeight: number): void {
    const x = Math.max(0, Math.min(imageWidth - 1, Math.floor(point.x)));
    const y = Math.max(0, Math.min(imageHeight - 1, Math.floor(point.y)));
    this.anchor = { x, y };
    this.value = { x, y, width: 1, height: 1 };
  }

  update(point: ImagePoint, imageWidth: number, imageHeight: number): void {
    if (!this.anchor) return;
    const currentX = Math.max(0, Math.min(imageWidth - 1, Math.floor(point.x)));
    const currentY = Math.max(0, Math.min(imageHeight - 1, Math.floor(point.y)));
    const x = Math.min(this.anchor.x, currentX);
    const y = Math.min(this.anchor.y, currentY);
    this.value = {
      x,
      y,
      width: Math.abs(currentX - this.anchor.x) + 1,
      height: Math.abs(currentY - this.anchor.y) + 1,
    };
  }

  end(): void {
    this.anchor = null;
  }
}
