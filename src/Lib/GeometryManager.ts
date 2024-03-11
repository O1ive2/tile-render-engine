import {
  IDrawingDataModel,
  ImageProperty,
  PathProperty,
  RectProperty,
  RectType,
  TextProperty,
} from '../Type/Geometry.type';

export default class GeometryManager {
  private static mgr: GeometryManager | null = null;

  private contextHelper = <OffscreenCanvasRenderingContext2D>(
    new OffscreenCanvas(0, 0).getContext('2d')
  );

  private canvasArea: Array<
    Array<{
      bitmap: ImageBitmap | OffscreenCanvas | null;
      rendering: {
        typeList: Uint8Array;
        idList: Uint32Array;
      };
    }>
  > = [];

  private currentZIndex = 0;

  private drawingDataModel: IDrawingDataModel = {
    rect: new Map(),
    path: new Map(),
    image: new Map(),
    text: new Map(),
  };

  private nameIdMap: Map<string, number> = new Map();
  private imageMap: Map<number, any> = new Map();

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
        zIndex: null,
        propertyType: null,
        state: null,
        lineWidth: null,
        other: null,
        style: null,
      },
      hoverFunction: [],
      clickFunction: [],
      hoverIdList: new Map(),
      checkedIdList: new Map(),
    },
    text: {
      shared: {
        id: null,
        x: null,
        y: null,
        width: null,
        height: null,
        fontSize: null,
        alpha: null,
        zIndex: null,
        propertyType: null,
        other: null,
      },
    },
    image: {
      shared: {
        id: null,
        x: null,
        y: null,
        state: null,
        imageIndex: null,
        alpha: null,
        zIndex: null,
        propertyType: null,
      },
      hoverFunction: [],
      clickFunction: [],
      hoverIdList: new Map(),
      checkedIdList: new Map(),
    },
    path: {
      shared: {
        id: null,
        fromX: null,
        fromY: null,
        toX: null,
        toY: null,
        alpha: null,
        zIndex: null,
        propertyType: null,
        state: null,
        lineWidth: null,
        lineCap: null,
        other: null,
      },
      hoverFunction: [],
      clickFunction: [],
      hoverIdList: new Map(),
      checkedIdList: new Map(),
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
      (obj.zIndex === undefined || typeof obj.zIndex === 'number') &&
      (obj.hover === undefined || typeof obj.hover === 'function')
    );
  }

  private isTextPropertyType(obj: any): obj is TextProperty {
    return (
      (obj.id === undefined || typeof obj.id === 'number') &&
      typeof obj === 'object' &&
      typeof obj.x === 'number' &&
      typeof obj.y === 'number' &&
      typeof obj.content === 'string' &&
      (obj.width === undefined || typeof obj.width === 'number') &&
      (obj.height === undefined || typeof obj.height === 'number') &&
      (obj.fontSize === undefined || typeof obj.fontSize === 'number') &&
      (obj.fillStyle === undefined || typeof obj.fillStyle === 'string') &&
      (obj.textAlign === undefined ||
        obj.textAlign === 'start' ||
        obj.textAlign === 'end' ||
        obj.textAlign === 'left' ||
        obj.textAlign === 'right' ||
        obj.textAlign === 'center') &&
      (obj.textBaseline === undefined ||
        obj.textBaseline === 'top' ||
        obj.textBaseline === 'middle' ||
        obj.textBaseline === 'alphabetic' ||
        obj.textBaseline === 'ideographic' ||
        obj.textBaseline === 'bottom') &&
      (obj.direction === undefined ||
        obj.direction === 'ltr' ||
        obj.direction === 'rtl' ||
        obj.direction === 'inherit') &&
      (obj.alpha === undefined || typeof obj.alpha === 'number') &&
      (obj.zIndex === undefined || typeof obj.zIndex === 'number')
    );
  }

  private setAreaByLevel = (level: number) => {
    const pieceNumber = 4 ** level;
    this.canvasArea[level] = Array.from({ length: pieceNumber }, () => ({
      bitmap: null,
      rendering: {
        typeList: new Uint8Array(),
        idList: new Uint32Array(),
      },
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

    if (level <= 1) {
      const rectList = Array.from(this.drawingDataModel.rect.values());
      const textList = Array.from(this.drawingDataModel.text.values());
      const imageList = Array.from(this.drawingDataModel.image.values());
      const pathList = Array.from(this.drawingDataModel.path.values());

      const mergedList = (<any>rectList).concat(textList).concat(imageList).concat(pathList);

      this.setCanvasArea(
        level,
        pieceIndex,
        mergedList
          .sort((a: any, b: any) => a.zIndex - b.zIndex)
          .reduce(
            (
              idList: Array<{
                id: number;
                propertyType: number;
              }>,
              item: any,
            ) => {
              // todo use text align etc. to set selfOffset
              let selfOffsetX = item.propertyType === 1 ? -item.width / 2 : 0;
              let selfOffsetY = item.propertyType === 1 ? -item.height / 2 : 0;

              // todo add crossing region flag
              if (
                this.intersects(
                  {
                    x: pieceIndexX * pieceWidth + offsetX,
                    y: pieceIndexY * pieceHeight + offsetY,
                    width: pieceWidth,
                    height: pieceHeight,
                  },
                  {
                    x: item.x + selfOffsetX,
                    y: item.y + selfOffsetY,
                    width: item.width,
                    height: item.height,
                  },
                )
              ) {
                idList.push({
                  id: item.id,
                  propertyType: item.propertyType,
                });
              }
              return idList;
            },
            [],
          ),
      );
    } else {
      // get parent level index location
      const parentIndex = Math.abs(
        Math.ceil((pieceIndexX + 1) / 2 - 1) +
          Math.ceil((pieceIndexY + 1) / 2 - 1) * (sideNumber / 2),
      );

      this.fillCanvasArea(level - 1, parentIndex);

      if (this.canvasArea[level - 1][parentIndex].rendering.idList.length === 0) {
        this.setAreaPiece(level - 1, parentIndex);
      }

      const idList = this.canvasArea[level - 1][parentIndex].rendering.idList;
      const typeList = this.canvasArea[level - 1][parentIndex].rendering.typeList;

      const mergedList: any = [];

      idList.forEach((id: number, index: number) => {
        const type = typeList[index];
        let item = null;

        // todo use text align etc. to set selfOffset
        let selfOffsetX = 0;
        let selfOffsetY = 0;

        if (type === 0) {
          item = this.drawingDataModel.rect.get(id);
        } else if (type === 1) {
          item = this.drawingDataModel.text.get(id);
          selfOffsetX = -(item?.width ?? 0) / 2;
          selfOffsetY = -(item?.height ?? 0) / 2;
        } else if (type === 2) {
          item = this.drawingDataModel.image.get(id);
        } else if (type === 3) {
          item = this.drawingDataModel.path.get(id);
        }

        if (
          this.intersects(
            {
              x: pieceIndexX * pieceWidth + offsetX,
              y: pieceIndexY * pieceHeight + offsetY,
              width: pieceWidth,
              height: pieceHeight,
            },
            {
              x: (item?.x ?? 0) + selfOffsetX,
              y: (item?.y ?? 0) + selfOffsetY,
              width: item?.width ?? 0,
              height: item?.height ?? 0,
            },
          )
        ) {
          mergedList.push({
            id,
            propertyType: type,
          });
        }
      });

      this.setCanvasArea(level, pieceIndex, mergedList);
    }
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

    const rectList = this.drawingDataModel.rect;
    const textList = this.drawingDataModel.text;
    const imageList = this.drawingDataModel.image;
    const pathList = this.drawingDataModel.path;

    for (const [id, rect] of rectList) {
      minX = Math.min(minX, rect.width < 0 ? rect.x + rect.width : rect.x);
      minY = Math.min(minY, rect.height < 0 ? rect.y + rect.height : rect.y);
      maxX = Math.max(maxX, rect.width < 0 ? rect.x : rect.x + rect.width);
      maxY = Math.max(maxY, rect.height < 0 ? rect.y : rect.y + rect.height);
    }

    for (const [id, text] of textList) {
      minX = Math.min(minX, (text.width || 0) < 0 ? text.x + (text.width || 0) : text.x);
      minY = Math.min(minY, (text.height || 0) < 0 ? text.y + (text.height || 0) : text.y);
      maxX = Math.max(maxX, (text.width || 0) < 0 ? text.x : text.x + (text.width || 0));
      maxY = Math.max(maxY, (text.height || 0) < 0 ? text.y : text.y + (text.height || 0));
    }

    for (const [id, image] of imageList) {
      minX = Math.min(minX, (image.width || 0) < 0 ? image.x + (image.width || 0) : image.x);
      minY = Math.min(minY, (image.height || 0) < 0 ? image.y + (image.height || 0) : image.y);
      maxX = Math.max(maxX, (image.width || 0) < 0 ? image.x : image.x + (image.width || 0));
      maxY = Math.max(maxY, (image.height || 0) < 0 ? image.y : image.y + (image.height || 0));
    }

    for (const [id, path] of pathList) {
      minX = Math.min(minX, path.fromX, path.toX);
      minY = Math.min(minY, path.fromY, path.toY);
      maxX = Math.max(maxX, path.fromX, path.toX);
      maxY = Math.max(maxY, path.fromY, path.toY);
    }

    if (rectList.size === 0 && textList.size === 0 && imageList.size === 0) {
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
        rendering: {
          typeList: new Uint8Array(),
          idList: new Uint32Array(),
        },
      };
    }
  }

  public collectRect(rect: RectProperty): void {
    rect.id = this.drawingDataModel.rect.size;
    if (rect.width < 0) {
      rect.x = rect.x + rect.width;
      rect.width = -rect.width;
    }
    if (rect.height < 0) {
      rect.y = rect.y + rect.height;
      rect.height = -rect.height;
    }
    rect.propertyType = 0;
    rect.zIndex = this.currentZIndex++;
    this.drawingDataModel.rect.set(rect.id, rect);
  }

  public collectText(text: TextProperty): void {
    text.id = this.drawingDataModel.text.size;
    text.zIndex = this.currentZIndex++;
    text.fontSize = text.fontSize || 10;
    this.contextHelper.font = `${text.fontSize}px sans-serif`;
    text.width = this.contextHelper.measureText(text.content).width;
    text.height = text.fontSize;
    text.propertyType = 1;
    this.drawingDataModel.text.set(text.id, text);
  }

  public collectImage(img: ImageProperty): void {
    img.id = this.drawingDataModel.image.size;
    img.zIndex = this.currentZIndex++;
    img.imageIndex = this.nameIdMap.get(img.imageId);
    img.width = this.imageMap.get(<number>img.imageIndex).width;
    img.height = this.imageMap.get(<number>img.imageIndex).height;
    img.propertyType = 2;
    this.drawingDataModel.image.set(img.id, img);
  }

  public collectPath(path: PathProperty): void {
    path.id = this.drawingDataModel.path.size;
    path.propertyType = 3;
    path.zIndex = this.currentZIndex++;

    const minX = Math.min(path.fromX, path.toX);
    const minY = Math.min(path.fromY, path.toY);
    const maxX = Math.max(path.fromX, path.toX);
    const maxY = Math.max(path.fromY, path.toY);
    const borderWidth = (path.lineWidth || 1) / 2;

    if (maxX - minX === 0) {
      path.x = minX - borderWidth;
      path.width = borderWidth * 2;
    } else {
      path.x = minX;
      path.width = maxX - minX;
    }

    if (maxY - minY === 0) {
      path.y = minY - borderWidth;
      path.height = borderWidth * 2;
    } else {
      path.y = minY;
      path.height = maxY - minY;
    }

    this.drawingDataModel.path.set(path.id, path);
  }

  public getBoundary(): [number, number, number, number, number, number] {
    return this.boundary;
  }

  public setCanvasArea(level: number, index: number, canvas: OffscreenCanvas): void;
  public setCanvasArea(level: number, index: number, bitmap: ImageBitmap): void;
  public setCanvasArea(level: number, index: number, rect: RectProperty): void;
  public setCanvasArea(
    level: number,
    index: number,
    idList: Array<{ id: number; propertyType: number }>,
  ): void;
  public setCanvasArea(level: number, index: number, value: any): void {
    this.fillCanvasArea(level, index);
    if (value instanceof ImageBitmap) {
      this.canvasArea[level][index].bitmap = value;
    } else if (value instanceof OffscreenCanvas) {
      this.canvasArea[level][index].bitmap = value;
    } else if (Array.isArray(value)) {
      this.canvasArea[level][index].rendering.idList = new Uint32Array(
        new SharedArrayBuffer(value.length * 4),
      );
      this.canvasArea[level][index].rendering.typeList = new Uint8Array(
        new SharedArrayBuffer(value.length),
      );

      for (let i = 0; i < value.length; i++) {
        this.canvasArea[level][index].rendering.idList[i] = value[i].id;
        this.canvasArea[level][index].rendering.typeList[i] = value[i].propertyType;
      }
    } else if (this.isRectPropertyType(value)) {
      // this.canvasArea[level][index].rectList.push(value);
    }
  }

  public getCanvasAreaBitmap(level: number, index: number): any {
    return this.canvasArea[level]?.[index]?.bitmap;
  }

  public getCanvasArea(level: number, index: number): any {
    this.fillCanvasArea(level, index);
    if (this.canvasArea[level]?.[index]?.rendering.idList.length === 0) {
      this.setAreaPiece(level, index);
    }
    return {
      idList: this.canvasArea[level]?.[index]?.rendering.idList,
      typeList: this.canvasArea[level]?.[index]?.rendering.typeList,
    };
  }

  public getOriginalRectList(): Map<number, RectProperty> {
    return this.drawingDataModel.rect;
  }

  public getOriginalTextList(): Map<number, TextProperty> {
    return this.drawingDataModel.text;
  }

  public getOriginalImageList(): Map<number, ImageProperty> {
    return this.drawingDataModel.image;
  }

  public getOriginalPathList(): Map<number, PathProperty> {
    return this.drawingDataModel.path;
  }

  public serializeRect(): void {
    const rectNumber = this.drawingDataModel.rect.size;
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
    sharedRect.zIndex = new Uint32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.propertyType = new Uint8Array(new SharedArrayBuffer(rectNumber));

    // sharedRect.style = new Uint8Array(new SharedArrayBuffer(rectNumber * 256));

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(
        Array.from(this.drawingDataModel.rect.values()).map((item, i) => {
          sharedRect.x[i] = item.x;
          sharedRect.y[i] = item.y;
          sharedRect.width[i] = item.width;
          sharedRect.height[i] = item.height;
          sharedRect.type[i] = item.type;
          sharedRect.state[i] = item.state;
          sharedRect.alpha[i] = item.alpha;
          sharedRect.lineWidth[i] = item.lineWidth;
          sharedRect.zIndex[i] = item.zIndex;
          sharedRect.propertyType[i] = item.propertyType;

          this.serializedSharedData.rect.hoverFunction[i] = item.hover;
          this.serializedSharedData.rect.clickFunction[i] = item.click;

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

  public serializeText(): void {
    const textNumber = this.drawingDataModel.text.size;
    const sharedText = this.serializedSharedData.text.shared;

    sharedText.id = new Uint32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.x = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.y = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.width = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.height = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.fontSize = new Uint8Array(new SharedArrayBuffer(textNumber));
    sharedText.alpha = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.zIndex = new Uint32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.propertyType = new Uint8Array(new SharedArrayBuffer(textNumber));
    // sharedRect.style = new Uint8Array(new SharedArrayBuffer(rectNumber * 256));

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(
        Array.from(this.drawingDataModel.text.values()).map((item, i) => {
          sharedText.x[i] = item.x;
          sharedText.y[i] = item.y;
          sharedText.width[i] = item.width;
          sharedText.height[i] = item.height;
          sharedText.fontSize[i] = item.fontSize;
          sharedText.alpha[i] = item.alpha;
          sharedText.zIndex[i] = item.zIndex;
          sharedText.propertyType[i] = item.propertyType;

          // const encodedData = textEncoder.encode(
          //   JSON.stringify({
          //     fillStyle: item.fillStyle,
          //     strokeStyle: item.strokeStyle,
          //   }),
          // );
          // sharedRect.style[i * 256] = encodedData.length;
          // sharedRect.style.set(encodedData, i * 256 + 1);

          return {
            content: item.content,
            fillStyle: item.fillStyle,
            textAlign: item.textAlign,
            textBaseline: item.textBaseline,
            direction: item.direction,
          };
        }),
      ),
    );
    sharedText.other = new Uint8Array(new SharedArrayBuffer(encodedData.length));
    sharedText.other.set(encodedData);
  }

  public serializeImage(): void {
    const imageNumber = this.drawingDataModel.image.size;
    const sharedImage = this.serializedSharedData.image.shared;

    sharedImage.id = new Uint32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.x = new Float32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.y = new Float32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.imageIndex = new Uint8Array(new SharedArrayBuffer(imageNumber));
    sharedImage.state = new Uint8Array(new SharedArrayBuffer(imageNumber));
    sharedImage.alpha = new Float32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.zIndex = new Uint32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.propertyType = new Uint8Array(new SharedArrayBuffer(imageNumber));

    Array.from(this.drawingDataModel.image.values()).forEach((item, i) => {
      sharedImage.x[i] = item.x;
      sharedImage.y[i] = item.y;
      sharedImage.imageIndex[i] = item.imageIndex;
      sharedImage.state[i] = item.state;
      sharedImage.alpha[i] = item.alpha;
      sharedImage.zIndex[i] = item.zIndex;
      sharedImage.propertyType[i] = item.propertyType;

      this.serializedSharedData.image.hoverFunction[i] = item.hover;
      this.serializedSharedData.image.clickFunction[i] = item.click;
    });
  }

  public serializePath(): void {
    const pathNumber = this.drawingDataModel.path.size;
    const sharedPath = this.serializedSharedData.path.shared;

    sharedPath.id = new Uint32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.fromX = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.fromY = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.toX = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.toY = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.state = new Uint8Array(new SharedArrayBuffer(pathNumber));
    sharedPath.alpha = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.lineWidth = new Uint8Array(new SharedArrayBuffer(pathNumber));
    sharedPath.zIndex = new Uint32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.propertyType = new Uint8Array(new SharedArrayBuffer(pathNumber));
    sharedPath.lineCap = new Uint8Array(new SharedArrayBuffer(pathNumber));

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(
        Array.from(this.drawingDataModel.path.values()).map((item, i) => {
          sharedPath.fromX[i] = item.fromX;
          sharedPath.fromY[i] = item.fromY;
          sharedPath.toX[i] = item.toX;
          sharedPath.toY[i] = item.toY;
          sharedPath.state[i] = item.state;
          sharedPath.alpha[i] = item.alpha;
          sharedPath.lineWidth[i] = item.lineWidth;
          sharedPath.zIndex[i] = item.zIndex;
          sharedPath.propertyType[i] = item.propertyType;
          sharedPath.lineCap[i] = item.lineCap;

          this.serializedSharedData.path.hoverFunction[i] = item.hover;
          this.serializedSharedData.path.clickFunction[i] = item.click;

          return {
            lineDash: item.lineDash,
            strokeStyle: item.strokeStyle,
          };
        }),
      ),
    );
    sharedPath.other = new Uint8Array(new SharedArrayBuffer(encodedData.length));
    sharedPath.other.set(encodedData);
  }

  public getSerializedRectData(): any {
    return this.serializedSharedData.rect;
  }

  public getSerializedTextData(): any {
    return this.serializedSharedData.text;
  }

  public getSerializedImageData(): any {
    return this.serializedSharedData.image;
  }

  public getSerializedPathData(): any {
    return this.serializedSharedData.path;
  }

  public getImageMap(): any {
    return this.imageMap;
  }

  public getExistedPiecesById(id: number): Array<{ level: number; index: number }> {
    const queryList: Array<{ level: number; index: number }> = [];
    for (let level = 0; level < this.canvasArea.length; level++) {
      const pieceList = this.canvasArea?.[level] || [];

      for (let pieceIndex = 0; pieceIndex < pieceList.length; pieceIndex++) {
        if (pieceList[pieceIndex].bitmap && pieceList[pieceIndex].rendering.idList.includes(id)) {
          queryList.push({
            level,
            index: pieceIndex,
          });
        }
      }
    }
    return queryList;
  }

  public findIntersecting(
    geometryType: number,
    currentId: number,
  ): { idList: Array<number>; typeList: Array<number> } {
    // todo use piece info to find intersecting

    let borderWidth = 0;
    let width = 0;
    let height = 0;
    let rectType = 0;
    let sharedItem = null;

    const sharedRect = this.serializedSharedData.rect.shared;
    const sharedText = this.serializedSharedData.text.shared;
    const sharedImage = this.serializedSharedData.image.shared;
    const sharedPath = this.serializedSharedData.path.shared;

    const originalPathData = this.getOriginalPathList();

    let x = 0;
    let y = 0;

    if (geometryType === 0) {
      sharedItem = sharedRect;
      borderWidth =
        sharedItem.type[currentId] === RectType.stroke ||
        sharedItem.type[currentId] === RectType.fillAndStroke
          ? sharedItem.lineWidth[currentId]
          : 0;
      width = sharedItem.width[currentId];
      height = sharedItem.height[currentId];
      rectType = sharedItem.type[currentId];
      x = sharedItem.x[currentId];
      y = sharedItem.y[currentId];
    } else if (geometryType === 1) {
      sharedItem = sharedText;
      width = sharedItem.width[currentId];
      height = sharedItem.height[currentId];
      x = sharedItem.x[currentId];
      y = sharedItem.y[currentId];
    } else if (geometryType === 2) {
      sharedItem = sharedImage;
      const imageInfo = this.imageMap.get(sharedItem.imageIndex[currentId]);
      width = imageInfo.width;
      height = imageInfo.height;
      x = sharedItem.x[currentId];
      y = sharedItem.y[currentId];
    } else if (geometryType === 3) {
      sharedItem = sharedPath;
      width = originalPathData.get(currentId)?.width ?? 0;
      height = originalPathData.get(currentId)?.height ?? 0;
      x = originalPathData.get(currentId)?.x ?? 0;
      y = originalPathData.get(currentId)?.y ?? 0;
    }

    // const pieceList = this.canvasArea?.[level];
    const idList: Array<number> = [];
    const typeList: Array<number> = [];

    for (const [id] of this.drawingDataModel.rect) {
      const additionalBorderWidth =
        sharedRect.type[id] === RectType.stroke || sharedRect.type[id] === RectType.fillAndStroke
          ? sharedRect.lineWidth[id]
          : 0;

      if (
        this.intersects(
          {
            x: sharedRect.x[id] - additionalBorderWidth / 2,
            y: sharedRect.y[id] - additionalBorderWidth / 2,
            width: sharedRect.width[id] + additionalBorderWidth,
            height: sharedRect.height[id] + additionalBorderWidth,
          },
          {
            x: x - borderWidth / 2,
            y: y - borderWidth / 2,
            width: width + borderWidth,
            height: height + borderWidth,
          },
        )
      ) {
        idList.push(id);
        typeList.push(0);
      }
    }

    for (const [id] of this.drawingDataModel.text) {
      if (
        this.intersects(
          {
            x: sharedText.x[id] - sharedText.width[id] / 2,
            y: sharedText.y[id] - sharedText.height[id] / 2,
            width: sharedText.width[id],
            height: sharedText.height[id],
          },
          {
            x: x - borderWidth / 2,
            y: y - borderWidth / 2,
            width: width + borderWidth,
            height: height + borderWidth,
          },
        )
      ) {
        idList.push(id);
        typeList.push(1);
      }
    }

    for (const [id] of this.drawingDataModel.image) {
      if (
        this.intersects(
          {
            x: sharedImage.x[id],
            y: sharedImage.y[id],
            width: this.imageMap.get(<number>sharedImage.imageIndex[id]).width,
            height: this.imageMap.get(<number>sharedImage.imageIndex[id]).height,
          },
          {
            x: x - borderWidth / 2,
            y: y - borderWidth / 2,
            width: width + borderWidth,
            height: height + borderWidth,
          },
        )
      ) {
        idList.push(id);
        typeList.push(2);
      }
    }

    for (const [id] of this.drawingDataModel.path) {
      const pathInfo = originalPathData?.get(id);
      if (
        this.intersects(
          {
            x: <number>pathInfo?.x,
            y: <number>pathInfo?.y,
            width: <number>pathInfo?.width,
            height: <number>pathInfo?.height,
          },
          {
            x: x - borderWidth / 2,
            y: y - borderWidth / 2,
            width: width + borderWidth,
            height: height + borderWidth,
          },
        )
      ) {
        idList.push(id);
        typeList.push(3);
      }
    }

    return {
      idList,
      typeList,
    };
  }

  public loadImage(
    img: HTMLImageElement,
    info: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      renderingWidth: number;
      renderingHeight: number;
    }>,
  ): Promise<void> {
    return new Promise((resolve) => {
      const offscreenCanvas = new OffscreenCanvas(img.width, img.height);
      const offscreenCtx = <OffscreenCanvasRenderingContext2D>offscreenCanvas.getContext('2d');
      offscreenCtx.drawImage(img, 0, 0);

      for (let i = 0; i < info.length; i++) {
        const { id, x, y, width, height, renderingWidth, renderingHeight } = info[i];

        const newOffscreenCanvas = new OffscreenCanvas(width, height);
        const newOffscreenCtx = <OffscreenCanvasRenderingContext2D>(
          newOffscreenCanvas.getContext('2d')
        );

        // const intervalColor = [0, 0, 0, 255];
        // const intervalColor2 = [92, 219, 211, 255];

        // normal state
        let imageData = offscreenCtx.getImageData(x, y, width, height);
        let data = imageData.data;

        const normalColor = [255, 156, 110, 255];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] !== 0) {
            data[i] = normalColor[0];
            data[i + 1] = normalColor[1];
            data[i + 2] = normalColor[2];
            data[i + 3] = normalColor[3];
          }
        }
        newOffscreenCtx.putImageData(imageData, 0, 0);
        const normalImage = newOffscreenCanvas.transferToImageBitmap();

        // hover state
        imageData = offscreenCtx.getImageData(x, y, width, height);
        data = imageData.data;
        const hoverColor = [92, 219, 211, 255];
        for (let i = 0; i < data.length; i += 4) {
          if (
            data[i + 3] !== 0 &&
            data[i] !== hoverColor[0] &&
            data[i + 1] !== hoverColor[1] &&
            data[i + 2] !== hoverColor[2]
          ) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0;
          }
        }
        newOffscreenCtx.clearRect(0, 0, width, height);
        newOffscreenCtx.putImageData(imageData, 0, 0);
        const hoverImage = newOffscreenCanvas.transferToImageBitmap();

        // checke state
        imageData = offscreenCtx.getImageData(x, y, width, height);
        data = imageData.data;
        const checkColor = [0, 50, 211, 255];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] !== 0) {
            data[i] = checkColor[0];
            data[i + 1] = checkColor[1];
            data[i + 2] = checkColor[2];
            data[i + 3] = checkColor[3];
          }
        }
        newOffscreenCtx.clearRect(0, 0, width, height);
        newOffscreenCtx.putImageData(imageData, 0, 0);
        const checkImage = newOffscreenCanvas.transferToImageBitmap();

        this.nameIdMap.set(id, i);
        this.imageMap.set(i, {
          img: normalImage,
          hoverImg: hoverImage,
          checkImg: checkImage,
          width: renderingWidth,
          height: renderingHeight,
        });

        resolve();
      }
    });
  }

  public flush(): void {
    // rect serialize
    this.serializeRect();

    // text serialize
    this.serializeText();

    // image serialize
    this.serializeImage();

    // path serialize
    this.serializePath();

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
