import {
  IDrawingDataModel,
  ImageProperty,
  PathProperty,
  RectProperty,
  RectType,
  TextProperty,
} from '../Type/Geometry.type';
import CanvasManager from './CanvasManager';
import { RenderingRegion } from './Region';
import Util from './Util';
import { Whole } from './Whole';
export default class GeometryManager {
  private static mgr: GeometryManager | null = null;

  private whole: Whole = Whole.from();
  private region: RenderingRegion = RenderingRegion.from();

  private contextHelper = <OffscreenCanvasRenderingContext2D>new OffscreenCanvas(0, 0).getContext(
    '2d',
    {
      willReadFrequently: true,
    },
  );

  private canvasArea: Array<
    Array<{
      state: 0 | 1 | 2; // 0未渲染 1待渲染 2已渲染
      bitmap: ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null;
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

  private autoIdMap: Map<number | string, { id: number; type: number }> = new Map();
  private nameIdMap: Map<string, number> = new Map();
  private imageMap: Map<number, any> = new Map();

  private highlightList = {
    rect: new Map(),
    text: new Map(),
    image: new Map(),
    path: new Map(),
  };

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
      lineWidth: null,
      lineCap: null,
      other: null,
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
    if (img.id) {
      this.autoIdMap.set(img.id, { id: this.drawingDataModel.image.size, type: 2 });
    }
    img.id = this.drawingDataModel.image.size;
    img.zIndex = this.currentZIndex++;
    img.imageIndex = this.nameIdMap.get(img.imageId);
    img.width = this.imageMap.get(<number>img.imageIndex).width;
    img.height = this.imageMap.get(<number>img.imageIndex).height;
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

  public getCanvasAreaState(level: number, index: number): 0 | 1 | 2 {
    return this.canvasArea[level]?.[index]?.state;
  }

  public getCanvasAreaBitmap(level: number, index: number): any {
    return this.canvasArea[level]?.[index]?.bitmap;
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

  public async serializeOriginalImageMap(): Promise<void> {
    const imageMapHash: any = {};

    const convertImage2Base64 = (img: ImageBitmap) => {
      return new Promise((resolve) => {
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = <OffscreenCanvasRenderingContext2D>canvas.getContext('2d', {
          willReadFrequently: true,
        });
        ctx.drawImage(img, 0, 0);
        canvas.convertToBlob().then((data) => {
          const reader = new FileReader();
          reader.onload = function (event) {
            const base64String = event.target?.result;
            resolve(base64String);
          };
          reader.readAsDataURL(data);
        });
      });
    };

    for (const [key, { width, height, img, hoverImg, checkImg }] of this.imageMap) {
      let realKey: any;
      for (let [id, value] of this.nameIdMap) {
        if (key === value) {
          realKey = id;
        }
      }

      imageMapHash[realKey] = {
        width,
        height,
        imgBase64: await convertImage2Base64(img),
        hoverImgBase64: await convertImage2Base64(hoverImg),
        checkImgBase64: await convertImage2Base64(checkImg),
      };
    }
  }

  public serializeImageMap() {
    const imageMapHash: any = {};
    for (const [key, { width, height, imgBase64, hoverImgBase64, checkImgBase64 }] of this
      .imageMap) {
      imageMapHash[key] = {
        width,
        height,
        imgBase64,
        hoverImgBase64,
        checkImgBase64,
      };
    }

    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(JSON.stringify(imageMapHash));
    const sharedImageMap = new Uint8Array(new SharedArrayBuffer(encodedData.length));
    sharedImageMap.set(encodedData);
    return sharedImageMap;
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

  public getHighlightList(): any {
    return this.highlightList;
  }

  public getHighlightListByType(type: number): any {
    const highlightList: Array<any> = [
      this.highlightList.rect,
      this.highlightList.text,
      this.highlightList.image,
      this.highlightList.path,
    ];
    return highlightList[type];
  }

  public getAutoIdMap(): Map<number | string, { id: number; type: number }> {
    return this.autoIdMap;
  }

  public getImageMap(): any {
    return this.imageMap;
  }

  public getExistedPiecesById(id: number): Array<{ level: number; index: number }> {
    const queryList: Array<{ level: number; index: number }> = [];
    for (let level = 0; level < this.canvasArea.length; level++) {
      const pieceList = this.canvasArea?.[level] || [];

      for (let pieceIndex = 0; pieceIndex < pieceList.length; pieceIndex++) {
        if (pieceList[pieceIndex]?.bitmap && pieceList[pieceIndex].rendering.idList.includes(id)) {
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
    let sharedItem = null;

    const sharedRect = this.serializedSharedData.rect;
    const sharedText = this.serializedSharedData.text;
    const sharedImage = this.serializedSharedData.image;
    const sharedPath = this.serializedSharedData.path;

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
        Util.intersects(
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
        Util.intersects(
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
        Util.intersects(
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
        Util.intersects(
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

  public loadImage(spriteInfo: {
    [key: string]: {
      width: number;
      height: number;
      normalImgBase64: string;
      hoverImgBase64: string;
      checkedImgBase64: string;
    };
  }): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      for (let key in spriteInfo) {
        const { width, height, normalImgBase64, hoverImgBase64, checkedImgBase64 } =
          spriteInfo[key];
        const img = new Image();
        const hoverImg = new Image();
        const checkImg = new Image();
        this.nameIdMap.set(key, i);
        this.imageMap.set(i, {
          img,
          hoverImg,
          checkImg,
          width,
          height,
          imgBase64: normalImgBase64,
          hoverImgBase64,
          checkImgBase64: checkedImgBase64,
        });
        img.src = normalImgBase64;
        hoverImg.src = hoverImgBase64;
        checkImg.src = checkedImgBase64;
        i++;
      }
      resolve();
    });
  }

  public async flush(canvasManager: CanvasManager): Promise<void> {
    // rect serialize
    this.serializeRect();

    // text serialize
    this.serializeText();

    // image serialize
    this.serializeImage();

    // path serialize
    this.serializePath();

    // image map serialize
    const sharedImageMap = this.serializeImageMap();

    this.whole.initOriginalBoundary(this.drawingDataModel);

    this.region.setRenderingBlockByLevel(1);
    this.region.setRenderingBlockByLevel(2);
    this.region.setRenderingBlockByLevel(3);

    await Promise.all(
      canvasManager.getSubCanvasList().map((subCanvas) => subCanvas.init(sharedImageMap)),
    );
  }

  public static from(): GeometryManager {
    if (!this.mgr) {
      this.mgr = new GeometryManager();
    }

    return this.mgr;
  }
}
