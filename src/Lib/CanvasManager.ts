import throttle from 'lodash/throttle';
import { ImageProperty, PathProperty, RectProperty, TextProperty } from '../Type/Geometry.type';
import { maxThreads } from '../config';
import GeometryManager from './GeometryManager';
import Paint from './Paint';
import SubCanvas from './SubCanvas';
import Util from './Util';

export default class CanvasManager {
  private level: number = 1;
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private subCanvasList: Array<SubCanvas>;
  private canvasCache: Array<Array<any>> = [];
  private renderList: Array<{ x: number; y: number; bitmap: any }> = [];

  // Initial Rendering W H Scale
  private initialRenderingWidth = 0;
  private initialRenderingHeight = 0;
  private renderingToRealScale = 1;
  private renderingScale = 1;
  private renderingOffsetX = 0;
  private renderingOffsetY = 0;

  // real size W H
  private realWidth = 0;
  private realHeight = 0;

  // lock
  private opLock = {
    zoom: false,
    hover: false,
    click: false,
  };

  get maxScaleOnLevel() {
    return 2 << (this.level * 2 - 2);
  }

  get pieceOnLevel() {
    return 2 << (this.level * 2);
  }

  get sideNumberOnLevel() {
    return 1 << (this.level * 2 - 1);
  }

  private geometryManager: GeometryManager = GeometryManager.from();

  private hoverList: Map<string, { id: number; type: number }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.mainCanvas = canvas;
    this.mainCtx = <CanvasRenderingContext2D>canvas.getContext('2d', {
      willReadFrequently: true,
    });
    this.subCanvasList = Array.from({ length: maxThreads }, () => new SubCanvas());
  }

  public getSubCanvasList(): Array<SubCanvas> {
    return this.subCanvasList;
  }

  public updateCanvasByGeometryId(geometryType: number, id: number): void {
    const boundary = this.geometryManager.getBoundary();
    const imageMap = this.geometryManager.getImageMap();
    const areaList = this.getPiecesIndex({
      x: this.renderingOffsetX,
      y: this.renderingOffsetY,
      k: this.renderingScale,
    });

    // let sharedItem = null;
    let borderWidth = 0;
    let width = 0;
    let height = 0;

    let x = 0;
    let y = 0;

    const originalRectData = this.geometryManager.getOriginalRectList();
    const originalTextData = this.geometryManager.getOriginalTextList();
    const originalImageData = this.geometryManager.getOriginalImageList();
    const originalPathData = this.geometryManager.getOriginalPathList();

    const highlightList = this.geometryManager.getHighlightList();

    if (geometryType === 0) {
      const rectItem = <RectProperty>originalRectData.get(id);
      x = rectItem.x;
      y = rectItem.y;
      width = rectItem.width;
      height = rectItem.height;
      borderWidth = rectItem.lineWidth ?? 0;
    } else if (geometryType === 1) {
      const texItem = <TextProperty>originalTextData.get(id);
      x = texItem.x;
      y = texItem.y;
      width = <number>texItem.width;
      height = <number>texItem.height;
    } else if (geometryType === 2) {
      const imageItem = <ImageProperty>originalImageData.get(id);
      x = imageItem.x;
      y = imageItem.y;
      width = <number>imageItem.width;
      height = <number>imageItem.height;
    } else if (geometryType === 3) {
      const pathItem = <PathProperty>originalPathData.get(id);
      x = <number>pathItem.x;
      y = <number>pathItem.y;
      width = <number>pathItem.width;
      height = <number>pathItem.height;
    }

    const intersect = this.geometryManager.findIntersecting(geometryType, id);

    // find intersecting

    const pieceList = this.geometryManager.getExistedPiecesById(id);

    for (let i = 0; i < pieceList.length; i++) {
      const { level, index } = pieceList[i];

      const bitmap = this.geometryManager.getCanvasAreaBitmap(level, index);
      const canvasArea = this.geometryManager.getCanvasArea(level, index);

      const filteredIdList: Array<number> = [];
      const filteredTypeList: Array<number> = [];

      canvasArea.idList.forEach((id: number, index: number) => {
        const type = canvasArea.typeList[index];
        if (
          intersect.idList.some((intersectId: number, intersectIndex) => {
            return intersectId === id && intersect.typeList[intersectIndex] === type;
          })
        ) {
          filteredIdList.push(id);
          filteredTypeList.push(type);
        }
      });

      if (filteredIdList.length <= 0) {
        continue;
      }

      const globalLineCaps = ['butt', 'round', 'square'];
      const sideNumber = this.sideNumberOnLevel;
      const indexX = index % sideNumber;
      const indexY = Math.floor(index / sideNumber);
      const realX = (indexX * this.realWidth) / sideNumber;
      const realY = (indexY * this.realHeight) / sideNumber;
      const realPieceToRenderingScale = sideNumber * this.renderingToRealScale;

      const offscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = <OffscreenCanvasRenderingContext2D>offscreenCanvas.getContext('2d', {
        willReadFrequently: true,
      });

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      ctx.clearRect(0, 0, bitmap.width, bitmap.height);

      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

      ctx.save();

      ctx.scale(realPieceToRenderingScale, realPieceToRenderingScale);
      ctx.translate(
        -(realX + boundary[0] + borderWidth / 2),
        -(realY + boundary[2] + borderWidth / 2),
      );

      ctx.beginPath();
      ctx.rect(x, y, width + borderWidth, height + borderWidth);
      ctx.clip();
      ctx.clearRect(x, y, width + borderWidth, height + borderWidth);

      for (let i = 0; i < filteredIdList.length; i++) {
        const id = filteredIdList[i];
        const filteredType = filteredTypeList[i];

        if (filteredType === 0) {
          const rectItem = <RectProperty>originalRectData.get(id);
          const x = rectItem.x;
          const y = rectItem.y;
          const width = rectItem.width;
          const height = rectItem.height;
          const lineWidth = rectItem.lineWidth ?? 0;
          const fillStyle = rectItem.fillStyle || '';
          const strokeStyle = rectItem.strokeStyle || '';
          const lineDash = rectItem.lineDash || [];
          const type = rectItem.type ?? 0;
          const alpha = rectItem.alpha ?? 1;

          ctx.save();

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.fillStyle = fillStyle || '';
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = lineWidth;

          ctx.beginPath();
          ctx.rect(x, y, width, height);

          // hover
          if (highlightList.rect.has(id)) {
            // todo more property support
            const highlightProperty = highlightList.rect.get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
              ctx.fillStyle = highlightProperty.fillStyle || ctx.fillStyle;
            }
          }

          if (type === 0) {
            ctx.fill();
          } else if (type === 1) {
            ctx.stroke();
          } else if (type === 2) {
            ctx.stroke();
            ctx.fill();
          }

          ctx.closePath();

          ctx.restore();
        } else if (filteredType === 1) {
          const textItem = <TextProperty>originalTextData.get(id);
          const x = textItem.x;
          const y = textItem.y;
          const alpha = textItem.alpha ?? 1;
          const fontSize = textItem.fontSize;
          const content = textItem.content || '';
          const fillStyle = textItem.fillStyle || '';

          // direction?: 'ltr' | 'rtl' | 'inherit';

          ctx.save();

          ctx.globalAlpha = alpha;
          ctx.fillStyle = fillStyle || '#000';

          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(content, x, y);

          ctx.restore();
        } else if (filteredType === 2) {
          const imageItem = <ImageProperty>originalImageData.get(id);
          const x = imageItem.x;
          const y = imageItem.y;
          const alpha = imageItem.alpha ?? 1;

          const { width, height, img, hoverImg, checkImg } = imageMap.get(imageItem.imageIndex);

          ctx.save();

          ctx.globalAlpha = alpha;

          let renderingImg = img;

          if (highlightList.image.has(id)) {
            // todo more property support
            const highlightProperty = highlightList.image.get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              if (highlightProperty.state === 'hover') {
                renderingImg = hoverImg;
              } else if (highlightProperty.state === 'check') {
                renderingImg = checkImg;
              } else {
                renderingImg = img;
              }
            }
          }

          ctx.drawImage(renderingImg, x, y, width, height);

          // if (state === 1) {
          //   const hoverProperty = serializedData.hoverIdList.get(id);
          //   ctx.globalCompositeOperation = 'source-in';
          //   ctx.fillStyle = hoverProperty.strokeStyle;
          //   ctx.fillRect(x, y, width, height);
          // } else if (state === 2) {
          //   const checkedProperty = serializedData.checkedIdList.get(id);
          //   ctx.globalCompositeOperation = 'source-in';
          //   ctx.fillStyle = checkedProperty.strokeStyle;
          //   ctx.fillRect(x, y, width, height);
          // }

          ctx.restore();
        } else if (filteredType === 3) {
          const pathItem = <PathProperty>originalPathData.get(id);
          const alpha = pathItem.alpha ?? 1;
          const fromX = pathItem.fromX;
          const fromY = pathItem.fromY;
          const toX = pathItem.toX;
          const toY = pathItem.toY;
          const lineCap = pathItem.lineCap ?? 0;
          const lineWidth =
            (pathItem.keepWidth
              ? (pathItem?.lineWidth ?? 0) / realPieceToRenderingScale
              : pathItem?.lineWidth ?? 0) || 1;
          const lineDash = pathItem.lineDash || [];
          const strokeStyle = pathItem.strokeStyle || '';

          ctx.save();

          ctx.beginPath();

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = lineWidth;
          ctx.lineCap = <CanvasLineCap>globalLineCaps[lineCap];

          // hover
          if (highlightList.path.has(id)) {
            // todo more property support
            const highlightProperty = highlightList.path.get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
              ctx.setLineDash(highlightProperty.lineDash || lineDash);
            }
          }

          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();
          ctx.closePath();

          ctx.restore();
        }
      }

      ctx.restore();

      // if (this.level === level) {
      //   const img = new Image();
      //   offscreenCanvas
      //     .convertToBlob()
      //     .then((data) => {
      //       img.src = URL.createObjectURL(data);
      //       img.onload = () => {
      //         // console.log(chip, scale);
      //       };
      //     })
      //     .catch((e) => {});
      // }

      this.geometryManager.setCanvasArea(level, index, offscreenCanvas);
    }
  }

  public updateHover(pointerX: number, pointerY: number) {
    const boundary = this.geometryManager.getBoundary();

    const totalOffsetX =
      this.renderingOffsetX +
      ((this.mainCanvas.width - this.initialRenderingWidth) / 2) * this.renderingScale;

    const totalOffsetY =
      this.renderingOffsetY +
      ((this.mainCanvas.height - this.initialRenderingHeight) / 2) * this.renderingScale;

    const scale = this.renderingToRealScale * this.renderingScale;

    // deeper level less query
    const level = this.level > 3 ? this.level : 3;
    const sideNumber = this.sideNumberOnLevel;

    const pieceIndexX = Math.floor(
      ((pointerX - totalOffsetX) / (boundary[4] * scale)) * sideNumber,
    );

    const pieceIndexY = Math.floor(
      ((pointerY - totalOffsetY) / (boundary[5] * scale)) * sideNumber,
    );

    if (
      pieceIndexX < 0 ||
      pieceIndexX >= sideNumber ||
      pieceIndexY < 0 ||
      pieceIndexY >= sideNumber
    ) {
      return;
    }

    const pieceIndex = pieceIndexX + pieceIndexY * sideNumber;

    const pieceInfo = this.geometryManager.getCanvasArea(level, pieceIndex);

    const {
      rect: sharedRect,
      text: sharedText,
      image: sharedImage,
      path: sharedPath,
    } = this.geometryManager.getSerializedData();

    // origin
    const originalRectData = this.geometryManager.getOriginalRectList();
    const originalTextData = this.geometryManager.getOriginalTextList();
    const originalImageData = this.geometryManager.getOriginalImageList();
    const originalPathData = this.geometryManager.getOriginalPathList();

    // image map
    const imageMap = this.geometryManager.getImageMap();

    // remove hover state
    for (let [key, { type, id }] of this.hoverList) {
      let minX = 0;
      let minY = 0;
      let maxX = 0;
      let maxY = 0;
      if (type === 0) {
        const rect = <RectProperty>originalRectData.get(id);
        minX = (rect.x - boundary[0] - (rect.lineWidth ?? 0) / 2) * scale + totalOffsetX;
        minY = (rect.y - boundary[2] - (rect.lineWidth ?? 0) / 2) * scale + totalOffsetY;
        maxX = minX + (rect.width + (rect.lineWidth ?? 0)) * scale;
        maxY = minY + (rect.height + (rect.lineWidth ?? 0)) * scale;
      } else if (type === 2) {
        const image = <ImageProperty>originalImageData.get(id);
        const { width, height } = imageMap.get(sharedImage.imageIndex[id]);

        minX = (image.x - boundary[0]) * scale + totalOffsetX;
        minY = (image.y - boundary[2]) * scale + totalOffsetY;
        maxX = minX + width * scale;
        maxY = minY + height * scale;
      } else if (type === 3) {
        const path = originalPathData.get(id);
        const width = path?.width ?? 0;
        const height = path?.height ?? 0;

        minX = ((path?.x ?? 0) - boundary[0]) * scale + totalOffsetX;
        minY = ((path?.y ?? 0) - boundary[2]) * scale + totalOffsetY;
        maxX = minX + width * scale;
        maxY = minY + height * scale;
      }

      if (!(pointerX >= minX && pointerX <= maxX && pointerY >= minY && pointerY <= maxY)) {
        const currentGeometry = this.geometryManager.getOriginalDataByType(type).get(id);
        this.hoverList.delete(key);
        currentGeometry.hoverOut?.();
      }
    }

    const typeList = pieceInfo.typeList.slice().reverse();
    const idList = pieceInfo.idList.slice().reverse();

    for (let i = 0; i < idList.length; i++) {
      const type = typeList[i];
      const id = idList[i];

      let sharedItem = null;
      let borderWidth = 0;
      let sharedItemWidth = 0;
      let sharedItemHeight = 0;
      let x = 0;
      let y = 0;
      let originalData = null;

      if (type === 0) {
        sharedItem = sharedRect;
        borderWidth = sharedItem.lineWidth[id];
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
        originalData = originalRectData;
      } else if (type === 1) {
        sharedItem = sharedText;
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
        originalData = originalTextData;
      } else if (type === 2) {
        const imageInfo = imageMap.get(sharedImage.imageIndex[id]);
        sharedItem = sharedImage;
        sharedItemWidth = imageInfo.width;
        sharedItemHeight = imageInfo.height;
        x = sharedItem.x[id];
        y = sharedItem.y[id];
        originalData = originalImageData;
      } else if (type === 3) {
        sharedItem = sharedPath;
        sharedItemWidth = originalPathData.get(id)?.width ?? 0;
        sharedItemHeight = originalPathData.get(id)?.height ?? 0;
        x = originalPathData.get(id)?.x ?? 0;
        y = originalPathData.get(id)?.y ?? 0;
        originalData = originalPathData;
      }

      const currentGeometry = <any>originalData?.get(id);

      if (!currentGeometry?.hover) {
        continue;
      }

      const initialX = (x - boundary[0] - borderWidth / 2) * scale + totalOffsetX;
      const initialY = (y - boundary[2] - borderWidth / 2) * scale + totalOffsetY;

      if (
        pointerX >= initialX &&
        pointerX <= initialX + (sharedItemWidth + borderWidth) * scale &&
        pointerY >= initialY &&
        pointerY <= initialY + (sharedItemHeight + borderWidth) * scale
      ) {
        if (this.hoverList.has(`${type}@${id}`)) {
          break;
        }

        this.hoverList.set(`${type}@${id}`, {
          type,
          id,
        });

        currentGeometry.hover();

        this.updateCanvasByGeometryId(type, id);

        break;
      }
    }
  }

  public updateCheck(pointerX: number, pointerY: number, checkType = 'click') {
    const boundary = this.geometryManager.getBoundary();

    const totalOffsetX =
      this.renderingOffsetX +
      ((this.mainCanvas.width - this.initialRenderingWidth) / 2) * this.renderingScale;

    const totalOffsetY =
      this.renderingOffsetY +
      ((this.mainCanvas.height - this.initialRenderingHeight) / 2) * this.renderingScale;

    const scale = this.renderingToRealScale * this.renderingScale;

    // deeper level less query
    const level = this.level > 3 ? this.level : 3;
    const sideNumber = this.sideNumberOnLevel;

    const pieceIndexX = Math.floor(
      ((pointerX - totalOffsetX) / (boundary[4] * scale)) * sideNumber,
    );

    const pieceIndexY = Math.floor(
      ((pointerY - totalOffsetY) / (boundary[5] * scale)) * sideNumber,
    );

    if (
      pieceIndexX < 0 ||
      pieceIndexX >= sideNumber ||
      pieceIndexY < 0 ||
      pieceIndexY >= sideNumber
    ) {
      return;
    }

    const pieceIndex = pieceIndexX + pieceIndexY * sideNumber;

    const pieceInfo = this.geometryManager.getCanvasArea(level, pieceIndex);

    const {
      rect: sharedRect,
      text: sharedText,
      image: sharedImage,
      path: sharedPath,
    } = this.geometryManager.getSerializedData();

    // origin
    const originalRectData = this.geometryManager.getOriginalRectList();
    const originalTextData = this.geometryManager.getOriginalTextList();
    const originalImageData = this.geometryManager.getOriginalImageList();
    const originalPathData = this.geometryManager.getOriginalPathList();

    // image map
    const imageMap = this.geometryManager.getImageMap();

    const typeList = pieceInfo.typeList.slice().reverse();
    const idList = pieceInfo.idList.slice().reverse();

    for (let i = 0; i < idList.length; i++) {
      const type = typeList[i];
      const id = idList[i];

      let sharedItem = null;
      let borderWidth = 0;
      let sharedItemWidth = 0;
      let sharedItemHeight = 0;
      let x = 0;
      let y = 0;
      let originalData = null;

      if (type === 0) {
        sharedItem = sharedRect;
        borderWidth = sharedItem.lineWidth[id];
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
        originalData = originalRectData;
      } else if (type === 1) {
        sharedItem = sharedText;
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
        originalData = originalTextData;
      } else if (type === 2) {
        const imageInfo = imageMap.get(sharedImage.imageIndex[id]);
        sharedItem = sharedImage;
        sharedItemWidth = imageInfo.width;
        sharedItemHeight = imageInfo.height;
        x = sharedItem.x[id];
        y = sharedItem.y[id];
        originalData = originalImageData;
      } else if (type === 3) {
        sharedItem = sharedPath;
        sharedItemWidth = originalPathData.get(id)?.width ?? 0;
        sharedItemHeight = originalPathData.get(id)?.height ?? 0;
        x = originalPathData.get(id)?.x ?? 0;
        y = originalPathData.get(id)?.y ?? 0;
        originalData = originalPathData;
      }

      const currentGeometry = <any>originalData?.get(id);

      if (!currentGeometry?.[checkType]) {
        continue;
      }

      const initialX = (x - boundary[0] - borderWidth / 2) * scale + totalOffsetX;
      const initialY = (y - boundary[2] - borderWidth / 2) * scale + totalOffsetY;

      if (
        pointerX >= initialX &&
        pointerX <= initialX + (sharedItemWidth + borderWidth) * scale &&
        pointerY >= initialY &&
        pointerY <= initialY + (sharedItemHeight + borderWidth) * scale
      ) {
        currentGeometry[checkType]();
        this.updateCanvasByGeometryId(type, id);

        break;
      }
    }
  }

  public updateTransform(transform: any): void {
    this.renderingOffsetX = transform.x;
    this.renderingOffsetY = transform.y;
    this.renderingScale = transform.k;
    const level = (this.level = Util.getLevelByScale(transform.k));
    const areaList = this.getPiecesIndex(transform);
    const sideNumberOnLevel = this.sideNumberOnLevel;

    for (let pieceIndex of areaList) {
      this.geometryManager.fillCanvasArea(level, pieceIndex);
      const state = this.geometryManager.getCanvasAreaState(level, pieceIndex);
      const indexX = pieceIndex % sideNumberOnLevel;
      const indexY = Math.floor(pieceIndex / sideNumberOnLevel);
      const realX = (indexX * this.realWidth) / sideNumberOnLevel;
      const realY = (indexY * this.realHeight) / sideNumberOnLevel;

      if (state === 0) {
        this.geometryManager.setCanvasArea(level, pieceIndex, 1);
        this.paintPartCanvas(
          level,
          realX,
          realY,
          this.realWidth / sideNumberOnLevel,
          this.realHeight / sideNumberOnLevel,
          pieceIndex,
        );
      }
    }
  }

  public getWidth(): number {
    return this.mainCanvas.width;
  }

  public getHeight(): number {
    return this.mainCanvas.height;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  public on(event: string, callback: any, callbackEnd?: any): void {
    const canvas = this.mainCanvas;
    if (event === 'zoom') {
      let k = this.renderingScale;
      let x = this.renderingOffsetX;
      let y = this.renderingOffsetY;
      let draggable = false;
      let startX = this.renderingOffsetX;
      let startY = this.renderingOffsetY;
      canvas.addEventListener(
        'pointerdown',
        (event: PointerEvent) => {
          draggable = true;
          startX = event.offsetX;
          startY = event.offsetY;
        },
        false,
      );
      canvas.addEventListener(
        'pointermove',
        (event: PointerEvent) => {
          if (draggable) {
            x += event.offsetX - startX;
            y += event.offsetY - startY;
            startX = event.offsetX;
            startY = event.offsetY;
            callback({ k, x, y });
          }
        },
        false,
      );
      canvas.addEventListener(
        'pointerup',
        () => {
          draggable = false;
          callbackEnd && callbackEnd();
        },
        false,
      );
      canvas.addEventListener(
        'pointerout',
        () => {
          draggable = false;
          callbackEnd && callbackEnd();
        },
        false,
      );
      canvas.addEventListener(
        'wheel',
        (event: WheelEvent) => {
          if (!draggable) {
            const perScale = 1.2;
            if (event.deltaY < 0) {
              x = event.offsetX - (event.offsetX - x) * perScale;
              y = event.offsetY - (event.offsetY - y) * perScale;
              k *= perScale;
            } else {
              if (k > 0.5) {
                x = event.offsetX - (event.offsetX - x) / perScale;
                y = event.offsetY - (event.offsetY - y) / perScale;
                k /= perScale;
              }
            }
            callback({ k, x, y });
            callbackEnd && callbackEnd();
          }
        },
        false,
      );
    } else if (event === 'hover') {
      canvas.addEventListener(
        'pointermove',
        (event: PointerEvent) => {
          callback({ x: event.offsetX, y: event.offsetY });
        },
        false,
      );
    } else if (event === 'click') {
      canvas.addEventListener(
        'click',
        (event: MouseEvent) => {
          callback({ x: event.offsetX, y: event.offsetY });
        },
        false,
      );
    } else if (event === 'rclick') {
      canvas.addEventListener(
        'contextmenu',
        (event: MouseEvent) => {
          event.preventDefault();
          callback({ x: event.offsetX, y: event.offsetY });
        },
        false,
      );
    } else if (event === 'dbclick') {
      canvas.addEventListener(
        'dblclick',
        (event: MouseEvent) => {
          event.preventDefault();
          callback({ x: event.offsetX, y: event.offsetY });
        },
        false,
      );
    }
  }

  public flush() {
    const boundary = this.geometryManager.getBoundary();
    const canvasWidth = this.getWidth();
    const canvasHeight = this.getHeight();
    this.realWidth = boundary[4];
    this.realHeight = boundary[5];

    if (this.realWidth / this.realHeight > canvasWidth / canvasHeight) {
      // 目字形
      this.initialRenderingWidth = canvasWidth;
      this.renderingToRealScale = this.initialRenderingWidth / this.realWidth;
      this.initialRenderingHeight = this.renderingToRealScale * this.realHeight;
    } else {
      this.initialRenderingHeight = canvasHeight;
      this.renderingToRealScale = this.initialRenderingHeight / this.realHeight;
      this.initialRenderingWidth = this.renderingToRealScale * this.realWidth;
    }
    this.updateTransform({
      k: 1,
      x: 0,
      y: 0,
    });

    let lockTimer: NodeJS.Timeout | null = null;

    this.on(
      'zoom',
      throttle(
        (transform: any) => {
          lockTimer && clearTimeout(lockTimer);
          this.opLock.hover = true;
          this.opLock.click = true;
          this.updateTransform(transform);
          this.render(true);
        },
        0,
        {
          leading: true,
          trailing: false,
        },
      ),
      () => {
        lockTimer = setTimeout(() => {
          this.opLock.hover = false;
          this.opLock.click = false;
        }, 0);
      },
    );

    this.on(
      'hover',
      throttle(
        ({ x, y }: { x: number; y: number }) => {
          if (!this.opLock.hover) {
            // const hoverNow = Date.now();
            // this.updateHover(x, y);
            // if (Date.now() - hoverNow > 2) {
            //   console.log(Date.now() - hoverNow + 'ms');
            // }
          }
        },
        30,
        {
          leading: true,
          trailing: false,
        },
      ),
    );

    this.on('click', ({ x, y }: { x: number; y: number }) => {
      if (!this.opLock.click) {
        this.updateCheck(x, y, 'click');
      }
    });

    this.on('rclick', ({ x, y }: { x: number; y: number }) => {
      if (!this.opLock.click) {
        this.updateCheck(x, y, 'rclick');
      }
    });

    this.on('dbclick', ({ x, y }: { x: number; y: number }) => {
      if (!this.opLock.click) {
        this.updateCheck(x, y, 'dbclick');
      }
    });

    this.render();
  }

  private getPiecesIndex(transform: any): Array<number> {
    const canvasWidth = this.getWidth();
    const canvasHeight = this.getHeight();

    const { k, x, y } = transform;

    // rendering x y
    const renderingX = ((canvasWidth - this.initialRenderingWidth) / 2) * k + x;
    const renderingY = ((canvasHeight - this.initialRenderingHeight) / 2) * k + y;

    // rendering width height
    const renderingWidth = this.initialRenderingWidth * k;
    const renderingHeight = this.initialRenderingHeight * k;

    // 截取区域
    const snapshot = {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    };

    // 屏幕展示区域
    const monitor = {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    };

    if (renderingX > 0) {
      snapshot.minX = 0;

      if (renderingWidth + renderingX < canvasWidth) {
        snapshot.maxX = renderingWidth;
      } else {
        snapshot.maxX = canvasWidth - renderingX;
      }

      monitor.minX = renderingX;

      if (renderingWidth + renderingX < canvasWidth) {
        monitor.maxX = renderingWidth + renderingX;
      } else {
        monitor.maxX = canvasWidth;
      }
    } else {
      snapshot.minX = -renderingX;

      if (canvasWidth - renderingX > renderingWidth) {
        snapshot.maxX = renderingWidth;
      } else {
        snapshot.maxX = canvasWidth - renderingX;
      }

      monitor.minX = 0;

      if (canvasWidth - renderingX > renderingWidth) {
        monitor.maxX = renderingWidth + renderingX;
      } else {
        monitor.maxX = canvasWidth;
      }
    }

    if (renderingY > 0) {
      snapshot.minY = 0;

      if (renderingHeight + renderingY < canvasHeight) {
        snapshot.maxY = renderingHeight;
      } else {
        snapshot.maxY = canvasHeight - renderingY;
      }

      monitor.minY = renderingY;

      if (renderingHeight + renderingY < canvasHeight) {
        monitor.maxY = renderingHeight + renderingY;
      } else {
        monitor.maxY = canvasHeight;
      }
    } else {
      snapshot.minY = -renderingY;

      if (canvasHeight - renderingY > renderingHeight) {
        snapshot.maxY = renderingHeight;
      } else {
        snapshot.maxY = canvasHeight - renderingY;
      }

      monitor.minY = 0;

      if (canvasHeight - renderingY > renderingHeight) {
        monitor.maxY = renderingHeight + renderingY;
      } else {
        monitor.maxY = canvasHeight;
      }
    }

    const sideNumber = this.sideNumberOnLevel;

    let indexStartX = Math.floor(Math.abs(snapshot.minX / (renderingWidth / sideNumber)));
    let indexEndX = Math.ceil(Math.abs(snapshot.maxX / (renderingWidth / sideNumber)));
    let indexStartY = Math.floor(Math.abs(snapshot.minY / (renderingHeight / sideNumber)));
    let indexEndY = Math.ceil(Math.abs(snapshot.maxY / (renderingHeight / sideNumber)));
    indexEndX = indexEndX > sideNumber ? sideNumber : indexEndX;
    indexEndY = indexEndY > sideNumber ? sideNumber : indexEndY;

    const areaList = [];
    for (let i = indexStartX; i < indexEndX; i++) {
      for (let j = indexStartY; j < indexEndY; j++) {
        areaList.push(i + j * sideNumber);
      }
    }

    return areaList;
  }

  private paintPartCanvas(
    level: number,
    x: number,
    y: number,
    width: number,
    height: number,
    pieceIndex: number,
  ): void {
    const sideNumber = this.sideNumberOnLevel;
    const realPieceToRenderingScale = sideNumber * this.renderingToRealScale;
    const paintWidth = width * realPieceToRenderingScale;
    const paintHeight = height * realPieceToRenderingScale;

    const subCanvas = this.subCanvasList.find(
      (item) => item.getIsInitialized() && !item.getIsBusy(),
    );

    if (subCanvas) {
      const boundary = this.geometryManager.getBoundary();
      subCanvas.render(
        paintWidth,
        paintHeight,
        x + boundary[0],
        y + boundary[2],
        level,
        pieceIndex,
        realPieceToRenderingScale,
      );
    } else {
      setTimeout(() => {
        // todo check index
        if (this.level === level) {
          this.paintPartCanvas(level, x, y, width, height, pieceIndex);
        } else {
          this.geometryManager.setCanvasArea(level, pieceIndex, 0);
        }
      }, 0);
    }
  }

  private render(once = false): void {
    const ctx = this.mainCtx;

    const renderingOffsetX = this.renderingOffsetX;
    const renderingOffsetY = this.renderingOffsetY;
    const renderingScale = this.renderingScale;
    const level = this.level;
    const sideNumber = this.sideNumberOnLevel;

    const areaList = this.getPiecesIndex({
      k: renderingScale,
      x: renderingOffsetX,
      y: renderingOffsetY,
    });

    ctx.save();

    ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    for (let pieceIndex of areaList) {
      const bitmap = this.geometryManager.getCanvasAreaBitmap(level, pieceIndex);
      const state = this.geometryManager.getCanvasAreaState(level, pieceIndex);
      const indexX = pieceIndex % sideNumber;
      const indexY = Math.floor(pieceIndex / sideNumber);
      const renderingX = (indexX * this.initialRenderingWidth) / sideNumber;
      const renderingY = (indexY * this.initialRenderingHeight) / sideNumber;

      if (state === 2 && bitmap) {
        this.mainCtx.drawImage(
          bitmap,
          0,
          0,
          bitmap.width,
          bitmap.height,
          (renderingX + (this.mainCanvas.width - this.initialRenderingWidth) / 2) * renderingScale +
            renderingOffsetX,
          (renderingY + (this.mainCanvas.height - this.initialRenderingHeight) / 2) *
            renderingScale +
            renderingOffsetY,
          (this.initialRenderingWidth / sideNumber) * renderingScale,
          (this.initialRenderingHeight / sideNumber) * renderingScale,
        );
      }
    }

    ctx.restore();

    if (!once) {
      requestAnimationFrame(() => this.render());
    }
  }

  public static from(canvasDom: HTMLCanvasElement): Paint {
    return Paint.from(new CanvasManager(canvasDom));
  }
}
