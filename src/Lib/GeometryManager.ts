import { IDrawingDataModel, RectProperty, RectType } from '../Type/Geometry.type';

export default class GeometryManager {
  private static mgr: GeometryManager | null = null;
  private canvasArea: Array<
    Array<{
      bitmap: ImageBitmap | OffscreenCanvas | null;
      rectIdList: Uint32Array;
    }>
  > = [];

  private drawingDataModel: IDrawingDataModel = {
    rect: [],
    path: [],
    image: [],
    text: [],
  };

  private serializedSharedData: any = {
    rect: {
      shared: {
        id: null,
        x: null,
        y: null,
        width: null,
        height: null,
        type: null,
        alpha: null,
        state: null,
        lineWidth: null,
        other: null,
        style: null,
      },
      hoverFunction: [],
      hoverIdList: new Map(),
    },
  };

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
      rectIdList: new Uint32Array(),
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

    const serializedRect = this.serializedSharedData.rect.shared;

    // rect
    let rectIdList: any = [];

    if (level <= 1) {
      rectIdList = serializedRect.id;
    } else {
      // get parent level index location
      const parentIndex = Math.abs(
        Math.ceil((pieceIndexX + 1) / 2 - 1) +
          Math.ceil((pieceIndexY + 1) / 2 - 1) * (sideNumber / 2),
      );

      if (this.canvasArea[level - 1][parentIndex].rectIdList?.length === 0) {
        this.setAreaPiece(level - 1, parentIndex);
      }

      rectIdList = this.canvasArea[level - 1][parentIndex].rectIdList;
    }

    this.setCanvasArea(
      level,
      pieceIndex,
      rectIdList.reduce((idList: Array<number>, id: number) => {
        if (
          this.intersects(
            {
              x: pieceIndexX * pieceWidth + offsetX,
              y: pieceIndexY * pieceHeight + offsetY,
              width: pieceWidth,
              height: pieceHeight,
            },
            {
              x: serializedRect.x[id],
              y: serializedRect.y[id],
              width: serializedRect.width[id],
              height: serializedRect.height[id],
            },
          )
        ) {
          idList.push(id);
        }
        return idList;
      }, []),
    );
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
        rectIdList: new Uint32Array(),
      };
    }
  }

  public collectRect(rect: RectProperty): void {
    rect.id = this.drawingDataModel.rect.length;
    this.drawingDataModel.rect.push(rect);
  }

  public getBoundary(): [number, number, number, number, number, number] {
    return this.boundary;
  }

  public setCanvasArea(level: number, index: number, canvas: OffscreenCanvas): void;
  public setCanvasArea(level: number, index: number, bitmap: ImageBitmap): void;
  public setCanvasArea(level: number, index: number, rect: RectProperty): void;
  public setCanvasArea(level: number, index: number, idList: Array<number>): void;
  public setCanvasArea(level: number, index: number, value: any): void {
    this.fillCanvasArea(level, index);
    if (value instanceof ImageBitmap) {
      this.canvasArea[level][index].bitmap = value;
    } else if (value instanceof OffscreenCanvas) {
      this.canvasArea[level][index].bitmap = value;
    } else if (Array.isArray(value)) {
      this.canvasArea[level][index].rectIdList = new Uint32Array(
        new SharedArrayBuffer(value.length * 4),
      );
      this.canvasArea[level][index].rectIdList.set(value);
    } else if (this.isRectPropertyType(value)) {
      // this.canvasArea[level][index].rectList.push(value);
    }
  }

  public getCanvasArea(level: number, index: number): any {
    return this.canvasArea[level]?.[index];
  }

  public getCanvasAreaBitmap(level: number, index: number): any {
    return this.canvasArea[level]?.[index]?.bitmap;
  }

  public getCanvasAreaIdList(level: number, index: number): any {
    this.fillCanvasArea(level, index);
    if (this.canvasArea[level]?.[index]?.rectIdList.length === 0) {
      this.setAreaPiece(level, index);
    }
    return this.canvasArea[level]?.[index]?.rectIdList;
  }

  public getOriginalRectList(): Array<RectProperty> {
    return this.drawingDataModel.rect;
  }

  public serializeRect(): void {
    const rectNumber = this.drawingDataModel.rect.length;
    const sharedRect = this.serializedSharedData.rect.shared;

    sharedRect.id = new Uint32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.x = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.y = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.width = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.height = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.type = new Uint8Array(new SharedArrayBuffer(rectNumber));
    sharedRect.state = new Uint8Array(new SharedArrayBuffer(rectNumber));
    sharedRect.alpha = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.lineWidth = new Uint16Array(new SharedArrayBuffer(rectNumber * 2));
    // sharedRect.style = new Uint8Array(new SharedArrayBuffer(rectNumber * 256));

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(
        this.drawingDataModel.rect.map((item, i) => {
          sharedRect.id[i] = item.id;
          sharedRect.x[i] = item.x;
          sharedRect.y[i] = item.y;
          sharedRect.width[i] = item.width;
          sharedRect.height[i] = item.height;
          sharedRect.type[i] = item.type;
          sharedRect.state[i] = item.state;
          sharedRect.alpha[i] = item.alpha;
          sharedRect.lineWidth[i] = item.lineWidth;
          this.serializedSharedData.rect.hoverFunction[i] = item.hover;

          // const encodedData = textEncoder.encode(
          //   JSON.stringify({
          //     fillStyle: item.fillStyle,
          //     strokeStyle: item.strokeStyle,
          //   }),
          // );
          // sharedRect.style[i * 256] = encodedData.length;
          // sharedRect.style.set(encodedData, i * 256 + 1);

          return {
            lineDash: item.lineDash,
            fillStyle: item.fillStyle,
            strokeStyle: item.strokeStyle,
          };
        }),
      ),
    );
    sharedRect.other = new Uint8Array(new SharedArrayBuffer(encodedData.length));
    sharedRect.other.set(encodedData);
  }

  public getSerializedRectData(): any {
    return this.serializedSharedData.rect;
  }

  public getExistedPiecesByRectId(id: number): Array<{ level: number; index: number }> {
    const queryList: Array<{ level: number; index: number }> = [];
    for (let level = 0; level < this.canvasArea.length; level++) {
      const pieceList = this.canvasArea?.[level] || [];

      for (let pieceIndex = 0; pieceIndex < pieceList.length; pieceIndex++) {
        if (pieceList[pieceIndex].bitmap && pieceList[pieceIndex].rectIdList.includes(id)) {
          queryList.push({
            level,
            index: pieceIndex,
          });
        }
      }
    }
    return queryList;
  }

  public findIntersectingByLevel(currentId: number, level: number): Set<number> {
    const pieceList = this.canvasArea?.[level];
    const filteredList: Set<number> = new Set([]);
    const sharedRect = this.serializedSharedData.rect.shared;
    const currentMarginWidth =
      sharedRect.type[currentId] === RectType.stroke ||
      sharedRect.type[currentId] === RectType.fillAndStroke
        ? sharedRect.lineWidth[currentId]
        : 0;

    if (pieceList) {
      for (let { rectIdList } of pieceList) {
        for (let id of rectIdList) {
          const marginWidth =
            sharedRect.type[id] === RectType.stroke ||
            sharedRect.type[id] === RectType.fillAndStroke
              ? sharedRect.lineWidth[id]
              : 0;
          if (
            this.intersects(
              {
                x: sharedRect.x[id] - marginWidth,
                y: sharedRect.y[id] - marginWidth,
                width: sharedRect.width[id] + marginWidth * 2,
                height: sharedRect.height[id] + marginWidth * 2,
              },
              {
                x: sharedRect.x[currentId] - currentMarginWidth,
                y: sharedRect.y[currentId] - currentMarginWidth,
                width: sharedRect.width[currentId] + currentMarginWidth * 2,
                height: sharedRect.height[currentId] + currentMarginWidth * 2,
              },
            )
          ) {
            filteredList.add(id);
          }
        }
      }
    }
    return filteredList;
  }

  public flush(): void {
    // rect serialize
    this.serializeRect();

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
