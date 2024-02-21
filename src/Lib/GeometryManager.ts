import { IDrawingDataModel, RectProperty, RectType } from '../Type/Geometry.type';

export default class GeometryManager {
  private static mgr: GeometryManager | null = null;
  private canvasArea: Array<
    Array<{
      bitmap: ImageBitmap | null;
      rectList: Array<RectProperty>;
      rectListCompressed: any;
    }>
  > = [];

  private drawingDataModel: IDrawingDataModel = {
    rect: [],
    path: [],
    image: [],
    text: [],
  };

  private drawingDataModelBuffer: any = {};

  private boundary: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  constructor() {}

  private isRectPropertyType(obj: any): obj is RectProperty {
    return (
      (obj.id === undefined || typeof obj.id === 'number') &&
      typeof obj === 'object' &&
      typeof obj.x === 'number' &&
      typeof obj.y === 'number' &&
      typeof obj.width === 'number' &&
      typeof obj.height === 'number' &&
      (obj.fillStyle === undefined ||
        typeof obj.fillStyle === 'string' ||
        obj.fillStyle instanceof CanvasGradient ||
        obj.fillStyle instanceof CanvasPattern) &&
      (obj.strokeStyle === undefined ||
        typeof obj.strokeStyle === 'string' ||
        obj.strokeStyle instanceof CanvasGradient ||
        obj.strokeStyle instanceof CanvasPattern) &&
      (obj.lineWidth === undefined || typeof obj.lineWidth === 'number') &&
      (obj.type === undefined || Object.values(RectType).includes(obj.type)) &&
      (obj.lineDash === undefined ||
        (Array.isArray(obj.lineDash) &&
          obj.lineDash.every((item: any) => typeof item === 'number'))) &&
      (obj.alpha === undefined || typeof obj.alpha === 'number') &&
      (obj.hover === undefined || typeof obj.hover === 'function')
    );
  }

  private setAreaByLevel = (level: number) => {
    const pieceNumber = 4 ** level;
    this.canvasArea[level] = Array.from({ length: pieceNumber }, () => ({
      bitmap: null,
      rectList: [],
      rectListCompressed: null,
    }));
    for (let i = 0; i < pieceNumber; i++) {
      this.setAreaPiece(level, i);
    }
  };

  private setAreaPiece = (level: number, pieceIndex: number) => {
    const sideNumber = 1 << level;

    const offsetX = this.boundary[0];
    const offsetY = this.boundary[2];

    const realWidth = this.boundary[4];
    const realHeight = this.boundary[5];

    const pieceIndexX = pieceIndex % sideNumber;
    const pieceIndexY = Math.floor(pieceIndex / sideNumber);

    const pieceWidth = realWidth / sideNumber;
    const pieceHeight = realHeight / sideNumber;

    // rect
    let rectList: any = [];

    if (level <= 1) {
      rectList = this.drawingDataModel.rect;
    } else {
      // get parent level index location
      const parentIndex = Math.abs(
        Math.ceil((pieceIndexX + 1) / 2 - 1) +
          Math.ceil((pieceIndexY + 1) / 2 - 1) * (sideNumber / 2),
      );

      if (this.canvasArea[level - 1][parentIndex].rectList?.length === 0) {
        this.setAreaPiece(level - 1, parentIndex);
      }

      rectList = this.canvasArea[level - 1][parentIndex].rectList;
    }

    for (let i = 0; i < rectList.length; i++) {
      if (
        this.intersects(
          {
            x: pieceIndexX * pieceWidth + offsetX,
            y: pieceIndexY * pieceHeight + offsetY,
            width: pieceWidth,
            height: pieceHeight,
          },
          rectList[i],
        )
      ) {
        this.setCanvasArea(level, pieceIndex, rectList[i]);
      }
    }

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(this.canvasArea[level][pieceIndex]?.rectList),
    );
    const sharedBuffer = new SharedArrayBuffer(encodedData.length);
    this.canvasArea[level][pieceIndex].rectListCompressed = new Uint8Array(sharedBuffer);
    this.canvasArea[level][pieceIndex].rectListCompressed.set(encodedData);
  };

  private intersects(
    range1: { x: number; y: number; width: number; height: number },
    range2: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      range1.x < range2.x + range2.width &&
      range1.x + range1.width > range2.x &&
      range1.y < range2.y + range2.height &&
      range1.y + range1.height > range2.y
    );
  }

  private getDrawingBoundary(
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY,
  ): [number, number, number, number, number, number] {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    // rect
    const rectList = this.drawingDataModel.rect;
    for (const rect of rectList) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    if (rectList.length === 0) {
      minX = 0;
      minY = 0;
    }

    // todo considering border width
    minX -= 2;
    maxX += 2;
    minY -= 2;
    maxY += 2;

    return [minX, maxX, minY, maxY, maxX - minX, maxY - minY];
  }

  private fillCanvasArea(level: number, index: number) {
    if (!this.canvasArea[level]) {
      this.canvasArea[level] = [];
    }
    if (!this.canvasArea[level][index]) {
      this.canvasArea[level][index] = {
        bitmap: null,
        rectList: [],
        rectListCompressed: null,
      };
    }
  }

  public collectRect(rect: RectProperty): void {
    this.drawingDataModel.rect.push(rect);
  }

  public getBoundary(): [number, number, number, number, number, number] {
    return this.boundary;
  }

  public setCanvasArea(level: number, index: number, bitmap: ImageBitmap): void;
  public setCanvasArea(level: number, index: number, rect: RectProperty): void;
  public setCanvasArea(level: number, index: number, value: any): void {
    this.fillCanvasArea(level, index);
    if (value instanceof ImageBitmap) {
      this.canvasArea[level][index].bitmap = value;
    } else if (this.isRectPropertyType(value)) {
      this.canvasArea[level][index].rectList.push(value);
    }
  }

  public getCanvasArea(level: number, index: number): any {
    return this.canvasArea[level]?.[index];
  }

  public getCanvasAreaBitmap(level: number, index: number): any {
    return this.canvasArea[level]?.[index]?.bitmap;
  }

  public getCanvasAreaCompressedList(level: number, index: number): any {
    this.fillCanvasArea(level, index);
    if (!this.canvasArea[level]?.[index]?.rectListCompressed) {
      this.setAreaPiece(level, index);
    }
    return this.canvasArea[level]?.[index]?.rectListCompressed;
  }

  public getOriginalRectList(): Array<RectProperty> {
    return this.drawingDataModel.rect;
  }

  public flush(): void {
    this.boundary = this.getDrawingBoundary();
    this.setAreaByLevel(1);
    this.setAreaByLevel(2);
    this.setAreaByLevel(3);
  }

  public static from(): GeometryManager {
    if (!this.mgr) {
      this.mgr = new GeometryManager();
    }

    return this.mgr;
  }
}
