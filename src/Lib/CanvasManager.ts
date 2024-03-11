import throttle from 'lodash/throttle';
import { CommonState, PathProperty, RectProperty, TextProperty } from '../Type/Geometry.type';
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
    return 1 << this.level;
  }

  private geometryManager: GeometryManager = GeometryManager.from();

  constructor(canvas: HTMLCanvasElement) {
    this.mainCanvas = canvas;
    this.mainCtx = <CanvasRenderingContext2D>canvas.getContext('2d');
    this.subCanvasList = Array.from({ length: maxThreads }, () => new SubCanvas());
    this.on(
      'zoom',
      (transform: any) => {
        this.opLock.hover = true;
        this.opLock.click = true;
        this.updateTransform(transform);
      },
      () => {
        setTimeout(() => {
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
            this.updateHover(x, y);
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
        this.updateCheck(x, y);
      }
    });

    this.render();
  }

  public updateCanvasByGeometryId(geometryType: number, id: number): void {
    const boundary = this.geometryManager.getBoundary();
    const imageMap = this.geometryManager.getImageMap();

    let sharedItem = null;
    let serializedData = null;
    let originalData = null;
    let borderWidth = 0;
    let width = 0;
    let height = 0;

    let x = 0;
    let y = 0;

    if (geometryType === 0) {
      originalData = this.geometryManager.getOriginalRectList();
      serializedData = this.geometryManager.getSerializedRectData();
      sharedItem = serializedData.shared;
      borderWidth = sharedItem.lineWidth[id];
      width = sharedItem.width[id];
      height = sharedItem.height[id];
      x = sharedItem.x[id];
      y = sharedItem.y[id];
    } else if (geometryType === 1) {
      originalData = this.geometryManager.getOriginalTextList();
      serializedData = this.geometryManager.getSerializedTextData();
      sharedItem = serializedData.shared;
      width = sharedItem.width[id];
      height = sharedItem.height[id];
      x = sharedItem.x[id];
      y = sharedItem.y[id];
    } else if (geometryType === 2) {
      originalData = this.geometryManager.getOriginalImageList();
      serializedData = this.geometryManager.getSerializedImageData();
      sharedItem = serializedData.shared;
      const imageInfo = imageMap.get(sharedItem.imageIndex[id]);
      width = imageInfo.width;
      height = imageInfo.height;
      x = sharedItem.x[id];
      y = sharedItem.y[id];
    } else if (geometryType === 3) {
      originalData = this.geometryManager.getOriginalPathList();
      serializedData = this.geometryManager.getSerializedPathData();
      sharedItem = serializedData.shared;
      width = originalData.get(id)?.width ?? 0;
      height = originalData.get(id)?.height ?? 0;
      x = originalData.get(id)?.x ?? 0;
      y = originalData.get(id)?.y ?? 0;
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

      const globalLineCaps = ['butt', 'round', 'square'];
      const sideNumber = 1 << level;
      const indexX = index % sideNumber;
      const indexY = Math.floor(index / sideNumber);
      const realX = (indexX * this.realWidth) / sideNumber;
      const realY = (indexY * this.realHeight) / sideNumber;
      const realPieceToRenderingScale = sideNumber * this.renderingToRealScale;
      // const clipX = (x) * realPieceToRenderingScale;
      // const clipY = (y - borderWidth / 2) * realPieceToRenderingScale;
      // const clipWidth = (width + borderWidth) * realPieceToRenderingScale;
      // const clipHeight = (height + borderWidth) * realPieceToRenderingScale;

      const offscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = <OffscreenCanvasRenderingContext2D>offscreenCanvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

      ctx.save();

      ctx.scale(realPieceToRenderingScale, realPieceToRenderingScale);
      ctx.translate(
        -(realX + boundary[0] + borderWidth / 2),
        -(realY + boundary[2] + borderWidth / 2),
      );

      ctx.clearRect(x, y, width + borderWidth, height + borderWidth);

      ctx.beginPath();
      ctx.rect(x, y, width + borderWidth, height + borderWidth);
      ctx.clip();

      for (let i = 0; i < filteredIdList.length; i++) {
        const id = filteredIdList[i];
        const geometryType = filteredTypeList[i];
        const x = sharedItem.x?.[id];
        const y = sharedItem.y?.[id];
        const alpha = sharedItem.alpha[id] ?? 1;
        const state = sharedItem.state[id] || 0;
        if (geometryType === 0) {
          originalData = <Map<number, RectProperty>>originalData;
          const width = sharedItem.width[id];
          const height = sharedItem.height[id];
          const fillStyle = originalData.get(id)?.fillStyle || '';
          const strokeStyle = originalData.get(id)?.strokeStyle || '';
          const lineDash = originalData.get(id)?.lineDash || [];
          const lineWidth = sharedItem.lineWidth[id] || 1;
          const type = sharedItem.type[id] ?? 0;

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.fillStyle = fillStyle || '';
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = lineWidth;

          ctx.beginPath();
          ctx.rect(x, y, width, height);

          // hover
          if (state === 1) {
            // todo more property support
            const hoverProperty = serializedData.hoverIdList.get(id);
            ctx.globalAlpha = hoverProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = hoverProperty.strokeStyle || ctx.strokeStyle;
            ctx.fillStyle = hoverProperty.fillStyle || ctx.fillStyle;
          } else if (state === 2) {
            // todo more property support
            const checkedProperty = serializedData.checkedIdList.get(id);
            ctx.globalAlpha = checkedProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = checkedProperty.strokeStyle || ctx.strokeStyle;
            ctx.fillStyle = checkedProperty.fillStyle || ctx.fillStyle;
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
        } else if (geometryType === 1) {
          originalData = <Map<number, TextProperty>>originalData;
          const width = sharedItem.width[id];
          const height = sharedItem.height[id];
          const fontSize = sharedItem.fontSize[id];
          const content = originalData.get(id)?.content || '';
          const fillStyle = originalData.get(id)?.fillStyle || '';

          // direction?: 'ltr' | 'rtl' | 'inherit';

          ctx.globalAlpha = alpha;
          ctx.fillStyle = fillStyle || '#000';

          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(content, x, y);
        } else if (geometryType === 2) {
          const { width, height, img, hoverImg, checkImg } = imageMap.get(
            sharedItem.imageIndex[id],
          );

          ctx.save();

          ctx.globalAlpha = alpha;

          let renderingImg = img;

          if (state === 1) {
            // todo more property support
            const hoverProperty = serializedData.hoverIdList.get(id);
            ctx.globalAlpha = hoverProperty.alpha || ctx.globalAlpha;
            renderingImg = hoverImg;
          } else if (state === 2) {
            // todo more property support
            const checkedProperty = serializedData.checkedIdList.get(id);
            ctx.globalAlpha = checkedProperty.alpha || ctx.globalAlpha;
            renderingImg = checkImg;
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
        } else if (geometryType === 3) {
          const fromX = sharedItem.fromX[id];
          const fromY = sharedItem.fromY[id];
          const toX = sharedItem.toX[id];
          const toY = sharedItem.toY[id];
          const lineCap = sharedItem.lineCap[id] ?? 0;
          const lineWidth = sharedItem.lineWidth[id] || 1;
          const lineDash = (<PathProperty>originalData?.get(id)).lineDash || [];
          const strokeStyle = (<PathProperty>originalData?.get(id)).strokeStyle || '';
          const state = sharedItem.state[id];

          ctx.save();

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = lineWidth;
          ctx.lineCap = <CanvasLineCap>globalLineCaps[lineCap];

          // hover
          if (state === 1) {
            // todo more property support
            const hoverProperty = serializedData.hoverIdList.get(id);
            ctx.globalAlpha = hoverProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = hoverProperty.strokeStyle || ctx.strokeStyle;
          } else if (state === 2) {
            // todo more property support
            const checkedProperty = serializedData.checkedIdList.get(id);
            ctx.globalAlpha = checkedProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = checkedProperty.strokeStyle || ctx.strokeStyle;
          }

          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          ctx.restore();
        }
      }

      ctx.restore();

      // const img = new Image();
      // offscreenCanvas
      //   .convertToBlob()
      //   .then((data) => {
      //     img.src = URL.createObjectURL(data);
      //     img.onload = () => {
      //       // console.log(chip, scale);
      //     };
      //   })
      //   .catch((e) => {});

      this.geometryManager.setCanvasArea(level, index, offscreenCanvas);
    }

    this.renderList = [];

    const areaList = this.getPiecesIndex({
      x: this.renderingOffsetX,
      y: this.renderingOffsetY,
      k: this.renderingScale,
    });

    for (let pieceIndex of areaList) {
      const indexX = pieceIndex % this.sideNumberOnLevel;
      const indexY = Math.floor(pieceIndex / this.sideNumberOnLevel);
      const renderingX = (indexX * this.initialRenderingWidth) / this.sideNumberOnLevel;
      const renderingY = (indexY * this.initialRenderingHeight) / this.sideNumberOnLevel;
      const bitmap = this.geometryManager.getCanvasAreaBitmap(this.level, pieceIndex);

      this.renderList.push({
        x: renderingX,
        y: renderingY,
        bitmap,
      });
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
    const sideNumber = 1 << level;

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

    const serializedRectData = this.geometryManager.getSerializedRectData();
    const serializedTextData = this.geometryManager.getSerializedTextData();
    const serializedImageData = this.geometryManager.getSerializedImageData();
    const serializedPathData = this.geometryManager.getSerializedPathData();

    // rect & image & path
    const sharedRect = serializedRectData.shared;
    const sharedText = serializedTextData.shared;
    const sharedImage = serializedImageData.shared;
    const sharedPath = serializedPathData.shared;

    // origin
    const originalPathData = this.geometryManager.getOriginalPathList();

    // image map
    const imageMap = this.geometryManager.getImageMap();

    // remove hover state
    for (let [id] of serializedRectData.hoverIdList) {
      const initialX =
        (sharedRect.x[id] - boundary[0] - sharedRect.lineWidth[id] / 2) * scale + totalOffsetX;
      const initialY =
        (sharedRect.y[id] - boundary[2] - sharedRect.lineWidth[id] / 2) * scale + totalOffsetY;
      const state = sharedRect.state[id];
      if (
        !(
          pointerX >= initialX &&
          pointerX <= initialX + (sharedRect.width[id] + sharedRect.lineWidth[id]) * scale &&
          pointerY >= initialY &&
          pointerY <= initialY + (sharedRect.height[id] + sharedRect.lineWidth[id]) * scale
        )
      ) {
        if (state === CommonState.hover) {
          serializedRectData.hoverIdList.delete(id);
          sharedRect.state[id] = CommonState.normal;
          this.updateCanvasByGeometryId(0, id);
        }
      }
    }

    for (let [id] of serializedImageData.hoverIdList) {
      const initialX = (sharedImage.x[id] - boundary[0]) * scale + totalOffsetX;
      const initialY = (sharedImage.y[id] - boundary[2]) * scale + totalOffsetY;
      const { width, height } = imageMap.get(sharedImage.imageIndex[id]);
      const state = sharedImage.state[id];
      if (
        !(
          pointerX >= initialX &&
          pointerX <= initialX + width * scale &&
          pointerY >= initialY &&
          pointerY <= initialY + height * scale
        )
      ) {
        if (state === CommonState.hover) {
          serializedImageData.hoverIdList.delete(id);
          sharedImage.state[id] = CommonState.normal;
          this.updateCanvasByGeometryId(2, id);
        }
      }
    }

    for (let [id] of serializedPathData.hoverIdList) {
      const pathInfo = originalPathData.get(id);
      const initialX = (pathInfo?.x ?? 0 - boundary[0]) * scale + totalOffsetX;
      const initialY = (pathInfo?.y ?? 0 - boundary[2]) * scale + totalOffsetY;
      const state = sharedPath.state[id];

      const width = pathInfo?.width ?? 0;
      const height = pathInfo?.height ?? 0;

      if (
        !(
          pointerX >= initialX &&
          pointerX <= initialX + width * scale &&
          pointerY >= initialY &&
          pointerY <= initialY + height * scale
        )
      ) {
        if (state === CommonState.hover) {
          serializedPathData.hoverIdList.delete(id);
          sharedPath.state[id] = CommonState.normal;
          this.updateCanvasByGeometryId(3, id);
        }
      }
    }

    const typeList = pieceInfo.typeList.slice().reverse();
    const idList = pieceInfo.idList.slice().reverse();

    for (let i = 0; i < idList.length; i++) {
      const type = typeList[i];
      const id = idList[i];

      let sharedItem = null;
      let serializedData = null;
      let borderWidth = 0;
      let sharedItemWidth = 0;
      let sharedItemHeight = 0;
      let x = 0;
      let y = 0;

      if (type === 0) {
        sharedItem = sharedRect;
        serializedData = serializedRectData;
        borderWidth = sharedItem.lineWidth[id];
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
      } else if (type === 1) {
        sharedItem = sharedText;
        serializedData = serializedTextData;
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
      } else if (type === 2) {
        const imageInfo = imageMap.get(sharedImage.imageIndex[id]);
        sharedItem = sharedImage;
        serializedData = serializedImageData;
        sharedItemWidth = imageInfo.width;
        sharedItemHeight = imageInfo.height;
        x = sharedItem.x[id];
        y = sharedItem.y[id];
      } else if (type === 3) {
        sharedItem = sharedPath;
        serializedData = serializedPathData;
        sharedItemWidth = originalPathData.get(id)?.width ?? 0;
        sharedItemHeight = originalPathData.get(id)?.height ?? 0;
        x = originalPathData.get(id)?.x ?? 0;
        y = originalPathData.get(id)?.y ?? 0;
      }

      if (!serializedData?.hoverFunction?.[id]) {
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
        const state = sharedItem.state?.[id];
        if (
          state === CommonState.hover ||
          state === CommonState.checked ||
          serializedData.hoverIdList?.has(id)
        ) {
          break;
        }

        sharedItem.state[id] = CommonState.hover;

        const property = serializedData.hoverFunction[id]?.(id);

        serializedData.hoverIdList.set(id, property);

        this.updateCanvasByGeometryId(type, id);

        break;
      }
    }
  }

  public updateTransform(transform: any): void {
    this.renderingOffsetX = transform.x;
    this.renderingOffsetY = transform.y;
    this.renderingScale = transform.k;
    this.level = Util.getLevelByScale(transform.k);
    const areaList = this.getPiecesIndex(transform);
    this.renderList = [];

    for (let pieceIndex of areaList) {
      const bitmap = this.geometryManager.getCanvasAreaBitmap(this.level, pieceIndex);
      const indexX = pieceIndex % this.sideNumberOnLevel;
      const indexY = Math.floor(pieceIndex / this.sideNumberOnLevel);
      const renderingX = (indexX * this.initialRenderingWidth) / this.sideNumberOnLevel;
      const renderingY = (indexY * this.initialRenderingHeight) / this.sideNumberOnLevel;
      const realX = (indexX * this.realWidth) / this.sideNumberOnLevel;
      const realY = (indexY * this.realHeight) / this.sideNumberOnLevel;
      if (bitmap) {
        this.renderList.push({
          x: renderingX,
          y: renderingY,
          bitmap,
        });
      } else {
        this.paintPartCanvas(
          realX,
          realY,
          this.realWidth / this.sideNumberOnLevel,
          this.realHeight / this.sideNumberOnLevel,
          pieceIndex,
        )
          .then((bitmap: ImageBitmap | null) => {
            this.renderList.push({
              x: renderingX,
              y: renderingY,
              bitmap,
            });
            this.geometryManager.setCanvasArea(this.level, pieceIndex, <ImageBitmap>bitmap);
          })
          .catch((e) => {});
      }
    }
  }

  public updateCheck(pointerX: number, pointerY: number) {
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
    const sideNumber = 1 << level;

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

    const serializedRectData = this.geometryManager.getSerializedRectData();
    const serializedTextData = this.geometryManager.getSerializedTextData();
    const serializedImageData = this.geometryManager.getSerializedImageData();
    const serializedPathData = this.geometryManager.getSerializedPathData();

    // rect & image & path
    const sharedRect = serializedRectData.shared;
    const sharedText = serializedTextData.shared;
    const sharedImage = serializedImageData.shared;
    const sharedPath = serializedPathData.shared;

    // origin
    const originalPathData = this.geometryManager.getOriginalPathList();

    // image map
    const imageMap = this.geometryManager.getImageMap();

    const typeList = pieceInfo.typeList.slice().reverse();
    const idList = pieceInfo.idList.slice().reverse();

    for (let i = 0; i < idList.length; i++) {
      const type = typeList[i];
      const id = idList[i];

      let sharedItem = null;
      let serializedData = null;
      let borderWidth = 0;
      let sharedItemWidth = 0;
      let sharedItemHeight = 0;
      let x = 0;
      let y = 0;

      if (type === 0) {
        sharedItem = sharedRect;
        serializedData = serializedRectData;
        borderWidth = sharedItem.lineWidth[id];
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
      } else if (type === 1) {
        sharedItem = sharedText;
        serializedData = serializedTextData;
        sharedItemWidth = sharedItem.width[id];
        sharedItemHeight = sharedItem.height[id];
        x = sharedItem.x[id];
        y = sharedItem.y[id];
      } else if (type === 2) {
        const imageInfo = imageMap.get(sharedImage.imageIndex[id]);
        sharedItem = sharedImage;
        serializedData = serializedImageData;
        sharedItemWidth = imageInfo.width;
        sharedItemHeight = imageInfo.height;
        x = sharedItem.x[id];
        y = sharedItem.y[id];
      } else if (type === 3) {
        sharedItem = sharedPath;
        serializedData = serializedPathData;
        sharedItemWidth = originalPathData.get(id)?.width ?? 0;
        sharedItemHeight = originalPathData.get(id)?.height ?? 0;
        x = originalPathData.get(id)?.x ?? 0;
        y = originalPathData.get(id)?.y ?? 0;
      }

      if (!serializedData?.hoverFunction?.[id]) {
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
        const state = sharedItem.state?.[id];
        if (state === CommonState.checked || serializedData.checkedIdList.has(id)) {
          break;
        }

        sharedItem.state[id] = CommonState.checked;

        const property = serializedData.clickFunction[id]?.(id);

        serializedData.checkedIdList.set(id, property);

        this.updateCanvasByGeometryId(type, id);

        break;
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
      let k = 1;
      let x = 0;
      let y = 0;
      let draggable = false;
      let startX = 0;
      let startY = 0;
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
            const perScale = 0.2;
            if (event.deltaY < 0) {
              x = event.offsetX - (event.offsetX - x) * (1 + perScale / k);
              y = event.offsetY - (event.offsetY - y) * (1 + perScale / k);
              k += perScale;
            } else {
              if (k > 0.5) {
                x = event.offsetX - (event.offsetX - x) * (1 - perScale / k);
                y = event.offsetY - (event.offsetY - y) * (1 - perScale / k);
                k -= perScale;
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

    let indexStartX = Math.floor(
      Math.abs(snapshot.minX / (renderingWidth / this.sideNumberOnLevel)),
    );
    let indexEndX = Math.ceil(Math.abs(snapshot.maxX / (renderingWidth / this.sideNumberOnLevel)));
    let indexStartY = Math.floor(
      Math.abs(snapshot.minY / (renderingHeight / this.sideNumberOnLevel)),
    );
    let indexEndY = Math.ceil(Math.abs(snapshot.maxY / (renderingHeight / this.sideNumberOnLevel)));
    indexEndX = indexEndX > this.sideNumberOnLevel ? this.sideNumberOnLevel : indexEndX;
    indexEndY = indexEndY > this.sideNumberOnLevel ? this.sideNumberOnLevel : indexEndY;

    const areaList = [];
    for (let i = indexStartX; i < indexEndX; i++) {
      for (let j = indexStartY; j < indexEndY; j++) {
        areaList.push(i + j * this.sideNumberOnLevel);
      }
    }

    return areaList;
  }

  private paintPartCanvas(
    x: number,
    y: number,
    width: number,
    height: number,
    pieceIndex: number,
  ): Promise<ImageBitmap | null> {
    const realPieceToRenderingScale = this.sideNumberOnLevel * this.renderingToRealScale;
    const paintWidth = width * realPieceToRenderingScale;
    const paintHeight = height * realPieceToRenderingScale;
    const characterHash = `${this.level}@${pieceIndex}`;

    return new Promise((resolve, reject) => {
      // filter conflicts
      if (this.subCanvasList.some((item) => item.hasCharacter(characterHash))) {
        return reject();
      }

      // 找到一个空闲的线程
      const subCanvas = this.subCanvasList.find((item) => !item.getIsBusy());

      const boundary = this.geometryManager.getBoundary();

      if (subCanvas) {
        subCanvas.setCharacter(characterHash);
        subCanvas
          .run(
            new OffscreenCanvas(paintWidth, paintHeight),
            x + boundary[0],
            y + boundary[2],
            this.level,
            pieceIndex,
            realPieceToRenderingScale,
          )
          .then((bitmap: ImageBitmap | null) => {
            resolve(bitmap);
          });
      } else {
        // todo waiting for idle thread
      }
    });
  }

  private render(): void {
    const ctx = this.mainCtx;

    ctx.save();
    ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    ctx.translate(this.renderingOffsetX, this.renderingOffsetY);
    ctx.scale(this.renderingScale, this.renderingScale);

    ctx.translate(
      (this.mainCanvas.width - this.initialRenderingWidth) / 2,
      (this.mainCanvas.height - this.initialRenderingHeight) / 2,
    );

    for (let i = 0; i < this.renderList.length; i++) {
      let renderItem = this.renderList[i];

      this.mainCtx.drawImage(
        renderItem.bitmap,
        0,
        0,
        renderItem.bitmap.width,
        renderItem.bitmap.height,
        renderItem.x,
        renderItem.y,
        this.initialRenderingWidth / this.sideNumberOnLevel,
        this.initialRenderingHeight / this.sideNumberOnLevel,
      );
    }

    ctx.restore();

    requestAnimationFrame(() => this.render());
  }

  public static from(canvasDom: HTMLCanvasElement): Paint {
    return Paint.from(new CanvasManager(canvasDom));
  }
}
