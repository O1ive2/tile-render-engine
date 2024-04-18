import {
  IDrawingDataModel,
  ImageProperty,
  PathProperty,
  RectProperty,
  RectType,
  TextProperty,
} from '../Type/Geometry.type';
import Paint from './Paint';
export default class GeometryManager {
  private paint: Paint;
  private id: string;

  private contextHelper = <OffscreenCanvasRenderingContext2D>new OffscreenCanvas(0, 0).getContext(
    '2d',
    {
      willReadFrequently: true,
    },
  );

  private currentZIndex = 0;

  private drawingDataModel: IDrawingDataModel = {
    rect: new Map(),
    path: new Map(),
    image: new Map(),
    text: new Map(),
  };

  private autoIdMap: Map<number | string, { id: number; type: number }> = new Map();

  private serializedSharedData: any = {
    rect: {
      id: null,
      x: null,
      y: null,
      width: null,
      height: null,
      type: null,
      alpha: null,
      zIndex: null,
      propertyType: null,
      keepWidth: null,
      lineWidth: null,
      other: null,
      style: null,
    },
    text: {
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
    image: {
      id: null,
      x: null,
      y: null,
      imageIndex: null,
      alpha: null,
      zIndex: null,
      propertyType: null,
    },
    path: {
      id: null,
      fromX: null,
      fromY: null,
      toX: null,
      toY: null,
      alpha: null,
      zIndex: null,
      propertyType: null,
      keepWidth: null,
      lineWidth: null,
      lineCap: null,
      other: null,
      x: null,
      y: null,
      width: null,
      height: null,
    },
  };

  constructor(paint: Paint, id: string) {
    this.id = id;
    this.paint = paint;
  }

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

  public collectRect(rect: RectProperty): void {
    if (rect.id) {
      this.autoIdMap.set(rect.id, { id: this.drawingDataModel.rect.size, type: 0 });
    }
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
    if (text.id) {
      this.autoIdMap.set(text.id, { id: this.drawingDataModel.text.size, type: 1 });
    }
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
    const gaiaProperty = this.paint.getProperty().gaia.getProperty();
    if (img.id) {
      this.autoIdMap.set(img.id, { id: this.drawingDataModel.image.size, type: 2 });
    }
    img.id = this.drawingDataModel.image.size;
    img.zIndex = this.currentZIndex++;

    img.imageIndex = gaiaProperty.spriteNameIdMap.get(img.imageId);
    img.width = gaiaProperty.spriteIdImageMap.get(<number>img.imageIndex)?.width ?? 0;
    img.height = gaiaProperty.spriteIdImageMap.get(<number>img.imageIndex)?.height ?? 0;
    img.propertyType = 2;
    this.drawingDataModel.image.set(img.id, img);
  }

  public collectPath(path: PathProperty): void {
    if (path.id) {
      this.autoIdMap.set(path.id, { id: this.drawingDataModel.path.size, type: 3 });
    }
    path.id = this.drawingDataModel.path.size;
    path.propertyType = 3;
    path.zIndex = this.currentZIndex++;

    const minX = Math.min(path.fromX, path.toX);
    const minY = Math.min(path.fromY, path.toY);
    const maxX = Math.max(path.fromX, path.toX);
    const maxY = Math.max(path.fromY, path.toY);
    const borderWidth = Math.ceil((path.lineWidth || 1) / 2);

    if (maxX - minX === 0) {
      path.x = minX - borderWidth;
      path.width = borderWidth * 2;
    } else {
      let addtionalWidth = 0;
      if (path.lineCap === 1 || path.lineCap === 2) {
        addtionalWidth = borderWidth * 2;
      }
      path.x = minX - addtionalWidth;
      path.width = maxX - minX + addtionalWidth * 2;
    }

    if (maxY - minY === 0) {
      path.y = minY - borderWidth;
      path.height = borderWidth * 2;
    } else {
      let addtionalWidth = 0;
      if (path.lineCap === 1 || path.lineCap === 2) {
        addtionalWidth = borderWidth * 2;
      }
      path.y = minY - addtionalWidth;
      path.height = maxY - minY + addtionalWidth * 2;
    }

    this.drawingDataModel.path.set(path.id, path);
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

  public getOriginalDataByType(type: number) {
    const originalList: Array<any> = [
      this.drawingDataModel.rect,
      this.drawingDataModel.text,
      this.drawingDataModel.image,
      this.drawingDataModel.path,
    ];
    return originalList[type];
  }

  public getOriginalData() {
    return this.drawingDataModel;
  }

  public serializeRect(): void {
    const rectNumber = this.drawingDataModel.rect.size;
    const sharedRect = this.serializedSharedData.rect;

    sharedRect.id = new Uint32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.x = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.y = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.width = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.height = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.type = new Uint8Array(new SharedArrayBuffer(rectNumber));
    sharedRect.alpha = new Float32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.lineWidth = new Uint16Array(new SharedArrayBuffer(rectNumber * 2));
    sharedRect.zIndex = new Uint32Array(new SharedArrayBuffer(rectNumber * 4));
    sharedRect.propertyType = new Uint8Array(new SharedArrayBuffer(rectNumber));
    sharedRect.keepWidth = new Uint8Array(new SharedArrayBuffer(rectNumber));

    // sharedRect.style = new Uint8Array((rectNumber * 256));

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(
        Array.from(this.drawingDataModel.rect.values()).map((item, i) => {
          sharedRect.x[i] = item.x;
          sharedRect.y[i] = item.y;
          sharedRect.width[i] = item.width;
          sharedRect.height[i] = item.height;
          sharedRect.type[i] = item.type;
          sharedRect.alpha[i] = item.alpha;
          sharedRect.lineWidth[i] = item.lineWidth;
          sharedRect.zIndex[i] = item.zIndex;
          sharedRect.propertyType[i] = item.propertyType;
          sharedRect.keepWidth[i] = item.keepWidth;

          return {
            lineDash: item.lineDash,
            fillStyle: item.fillStyle,
            strokeStyle: item.strokeStyle,
          };
        }),
      ),
    );
    sharedRect.other = new Uint8Array(encodedData.length);
    sharedRect.other.set(encodedData);
  }

  public serializeText(): void {
    const textNumber = this.drawingDataModel.text.size;
    const sharedText = this.serializedSharedData.text;

    sharedText.id = new Uint32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.x = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.y = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.width = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.height = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.fontSize = new Uint8Array(new SharedArrayBuffer(textNumber));
    sharedText.alpha = new Float32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.zIndex = new Uint32Array(new SharedArrayBuffer(textNumber * 4));
    sharedText.propertyType = new Uint8Array(new SharedArrayBuffer(textNumber));
    // sharedRect.style = new Uint8Array((rectNumber * 256));

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
    const sharedImage = this.serializedSharedData.image;

    sharedImage.id = new Uint32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.x = new Float32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.y = new Float32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.imageIndex = new Uint8Array(new SharedArrayBuffer(imageNumber));
    sharedImage.alpha = new Float32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.zIndex = new Uint32Array(new SharedArrayBuffer(imageNumber * 4));
    sharedImage.propertyType = new Uint8Array(new SharedArrayBuffer(imageNumber));

    Array.from(this.drawingDataModel.image.values()).forEach((item, i) => {
      sharedImage.x[i] = item.x;
      sharedImage.y[i] = item.y;
      sharedImage.imageIndex[i] = item.imageIndex;
      sharedImage.alpha[i] = item.alpha;
      sharedImage.zIndex[i] = item.zIndex;
      sharedImage.propertyType[i] = item.propertyType;
    });

  }

  public serializePath(): void {
    const pathNumber = this.drawingDataModel.path.size;
    const sharedPath = this.serializedSharedData.path;

    sharedPath.id = new Uint32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.fromX = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.fromY = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.toX = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.toY = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.alpha = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.lineWidth = new Uint8Array(new SharedArrayBuffer(pathNumber));
    sharedPath.zIndex = new Uint32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.propertyType = new Uint8Array(new SharedArrayBuffer(pathNumber));
    sharedPath.lineCap = new Uint8Array(new SharedArrayBuffer(pathNumber));
    sharedPath.keepWidth = new Uint8Array(new SharedArrayBuffer(pathNumber));

    sharedPath.x = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.y = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.width = new Float32Array(new SharedArrayBuffer(pathNumber * 4));
    sharedPath.height = new Float32Array(new SharedArrayBuffer(pathNumber * 4));

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(
      JSON.stringify(
        Array.from(this.drawingDataModel.path.values()).map((item, i) => {
          sharedPath.fromX[i] = item.fromX;
          sharedPath.fromY[i] = item.fromY;
          sharedPath.toX[i] = item.toX;
          sharedPath.toY[i] = item.toY;
          sharedPath.alpha[i] = item.alpha;
          sharedPath.lineWidth[i] = item.lineWidth;
          sharedPath.zIndex[i] = item.zIndex;
          sharedPath.propertyType[i] = item.propertyType;
          sharedPath.lineCap[i] = item.lineCap;
          sharedPath.keepWidth[i] = item.keepWidth;
          sharedPath.x[i] = item.x;
          sharedPath.y[i] = item.y;
          sharedPath.width[i] = item.width;
          sharedPath.height[i] = item.height;

          return {
            lineDash: item.lineDash,
            strokeStyle: item.strokeStyle,
          };
        }),
      ),
    );
    sharedPath.other = new Uint8Array(encodedData.length);
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

  public getSerializedData(): any {
    return this.serializedSharedData;
  }

  public getAutoIdMap(): Map<number | string, { id: number; type: number }> {
    return this.autoIdMap;
  }

  public async flush(): Promise<void> {
    // rect serialize
    this.serializeRect();

    // text serialize
    this.serializeText();

    // path serialize
    this.serializePath();

    // image serialize
    this.serializeImage();

    this.paint.getProperty().whole.initOriginalBoundary(this.drawingDataModel);

    this.paint.getProperty().region.init(this.drawingDataModel);

    this.paint.getProperty().region.setRenderingBlockByLevel(1);
    this.paint.getProperty().region.setRenderingBlockByLevel(2);
    this.paint.getProperty().region.setRenderingBlockByLevel(3);

    await Promise.all(
      this.paint
        .getProperty()
        .gaia.getProperty()
        .renderWorkerList.map((item: any) => item.decodeShared(this.id, this.getSerializedData())),
    );
  }

  public clear() {
    this.drawingDataModel.rect = new Map([]);
    this.drawingDataModel.text = new Map([]);
    this.drawingDataModel.image = new Map([]);
    this.drawingDataModel.path = new Map([]);

    this.serializedSharedData = {
      rect: {
        id: null,
        x: null,
        y: null,
        width: null,
        height: null,
        type: null,
        alpha: null,
        zIndex: null,
        propertyType: null,
        keepWidth: null,
        lineWidth: null,
        other: null,
        style: null,
      },
      text: {
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
      image: {
        id: null,
        x: null,
        y: null,
        imageIndex: null,
        alpha: null,
        zIndex: null,
        propertyType: null,
      },
      path: {
        id: null,
        fromX: null,
        fromY: null,
        toX: null,
        toY: null,
        alpha: null,
        zIndex: null,
        propertyType: null,
        keepWidth: null,
        lineWidth: null,
        lineCap: null,
        other: null,
        x: null,
        y: null,
        width: null,
        height: null,
      },
    };
  }
}
