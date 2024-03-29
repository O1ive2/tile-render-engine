import { ImageProperty, PathProperty, RectProperty, TextProperty } from '../Type/Geometry.type';

export class Whole {
  static instance: Whole;

  public OriginalBoundary = {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0,
  };

  constructor() {}

  public getOriginalBoundary() {
    return this.OriginalBoundary;
  }

  public initOriginalBoundary(list: {
    rect?: Map<number, RectProperty>;
    text?: Map<number, TextProperty>;
    image?: Map<number, ImageProperty>;
    path?: Map<number, PathProperty>;
  }) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    if (list.rect) {
      for (const [id, rect] of list.rect) {
        minX = Math.min(minX, rect.width < 0 ? rect.x + rect.width : rect.x);
        minY = Math.min(minY, rect.height < 0 ? rect.y + rect.height : rect.y);
        maxX = Math.max(maxX, rect.width < 0 ? rect.x : rect.x + rect.width);
        maxY = Math.max(maxY, rect.height < 0 ? rect.y : rect.y + rect.height);
      }
    }

    if (list.text) {
      for (const [id, text] of list.text) {
        minX = Math.min(minX, (text.width || 0) < 0 ? text.x + (text.width || 0) : text.x);
        minY = Math.min(minY, (text.height || 0) < 0 ? text.y + (text.height || 0) : text.y);
        maxX = Math.max(maxX, (text.width || 0) < 0 ? text.x : text.x + (text.width || 0));
        maxY = Math.max(maxY, (text.height || 0) < 0 ? text.y : text.y + (text.height || 0));
      }
    }

    if (list.image) {
      for (const [id, image] of list.image) {
        minX = Math.min(minX, (image.width || 0) < 0 ? image.x + (image.width || 0) : image.x);
        minY = Math.min(minY, (image.height || 0) < 0 ? image.y + (image.height || 0) : image.y);
        maxX = Math.max(maxX, (image.width || 0) < 0 ? image.x : image.x + (image.width || 0));
        maxY = Math.max(maxY, (image.height || 0) < 0 ? image.y : image.y + (image.height || 0));
      }
    }

    if (list.path) {
      for (const [id, path] of list.path) {
        minX = Math.min(minX, path.fromX, path.toX);
        minY = Math.min(minY, path.fromY, path.toY);
        maxX = Math.max(maxX, path.fromX, path.toX);
        maxY = Math.max(maxY, path.fromY, path.toY);
      }
    }

    if (
      list.rect?.size === 0 &&
      list.text?.size === 0 &&
      list.image?.size === 0 &&
      list.path?.size === 0
    ) {
      minX = 0;
      minY = 0;
    }

    // todo considering border width
    minX -= 2;
    maxX += 2;
    minY -= 2;
    maxY += 2;

    this.OriginalBoundary = {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };

    return this.OriginalBoundary;
  }

  static from(): Whole {
    if (!this.instance) {
      this.instance = new Whole();
    }
    return this.instance;
  }
}
