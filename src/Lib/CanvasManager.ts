import throttle from 'lodash/throttle';
import { RectState, RectType } from '../Type/Geometry.type';
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

  public updateCanvasByGeometryId(id: number): void {
    const boundary = this.geometryManager.getBoundary();

    const originalRectData = this.geometryManager.getOriginalRectList();
    const serializedRectData = this.geometryManager.getSerializedRectData();
    const sharedRectData = this.geometryManager.getSerializedRectData().shared;

    const x = sharedRectData.x[id];
    const y = sharedRectData.y[id];
    const width = sharedRectData.width[id];
    const height = sharedRectData.height[id];
    const type = sharedRectData.type[id];
    const lineWidth = sharedRectData.lineWidth[id];
    const marginWidth = type === RectType.stroke || type === RectType.fillAndStroke ? lineWidth : 0;

    // find intersecting
    const itersectList = this.geometryManager.findIntersectingByLevel(id, 3);

    const pieceList = this.geometryManager.getExistedPiecesByRectId(id);

    for (let i = 0; i < pieceList.length; i++) {
      const { level, index } = pieceList[i];

      const pieceIndexList = this.geometryManager.getCanvasAreaIdList(level, index);
      const filteredIntersectList = new Set<number>(
        pieceIndexList.filter((x: number) => itersectList.has(x)),
      );

      const sideNumber = (1 << level);

      const indexX = index % sideNumber;
      const indexY = Math.floor(index / sideNumber);
      const realX = (indexX * this.realWidth) / sideNumber;
      const realY = (indexY * this.realHeight) / sideNumber;

      const realPieceToRenderingScale = sideNumber * this.renderingToRealScale;

      const clipX = (x - realX - boundary[0] - marginWidth / 2) * realPieceToRenderingScale;
      const clipY = (y - realY - boundary[2] - marginWidth / 2) * realPieceToRenderingScale;
      const clipWidth = (width + marginWidth) * realPieceToRenderingScale;
      const clipHeight = (height + marginWidth) * realPieceToRenderingScale;

      const bitmap = this.geometryManager.getCanvasAreaBitmap(level, index);
      const offscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = <OffscreenCanvasRenderingContext2D>offscreenCanvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
      ctx.clearRect(clipX, clipY, clipWidth, clipHeight);

      ctx.beginPath();
      ctx.rect(clipX, clipY, clipWidth, clipHeight);
      ctx.clip();

      ctx.save();

      ctx.scale(realPieceToRenderingScale, realPieceToRenderingScale);
      ctx.translate(-(realX + boundary[0]), -(realY + boundary[2]));

      // draw intersects
      for (let id of filteredIntersectList) {
        const x = sharedRectData.x[id];
        const y = sharedRectData.y[id];
        const width = sharedRectData.width[id];
        const height = sharedRectData.height[id];
        const lineWidth = sharedRectData.lineWidth[id] || 1;
        const type = sharedRectData.type[id] ?? 0;
        const alpha = sharedRectData.alpha[id] ?? 1;
        const state = sharedRectData.state[id] || 0;
        const fillStyle = originalRectData[id].fillStyle || '';
        const strokeStyle = originalRectData[id].strokeStyle || '';
        const lineDash = originalRectData[id].lineDash || [];

        ctx.beginPath();

        ctx.rect(x, y, width, height);

        ctx.globalAlpha = alpha;
        ctx.setLineDash(lineDash);
        ctx.fillStyle = fillStyle || '';
        ctx.strokeStyle = strokeStyle || '';
        ctx.lineWidth = lineWidth;

        // hover
        if (state === 1) {
          // todo more property support
          const hoverProperty = serializedRectData.hoverIdList.get(id);
          ctx.strokeStyle = hoverProperty.strokeStyle || ctx.strokeStyle;
          ctx.fillStyle = hoverProperty.fillStyle || ctx.fillStyle;
        } else if (state === 2) {
          // todo more property support
          const checkedProperty = serializedRectData.checkedIdList.get(id);
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

        // ctx.closePath();
      }

      ctx.restore();

      // console.log(level, index, offscreenCanvas);

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

    // rect

    const rectIdList = this.geometryManager.getCanvasAreaIdList(level, pieceIndex);
    const serializedRectData = this.geometryManager.getSerializedRectData();
    const sharedRectData = serializedRectData.shared;

    const iterator = serializedRectData.hoverIdList.keys();
    while (true) {
      const result = iterator.next();
      if (result.done) {
        break;
      }
      const id = result.value;
      const initialX =
        (sharedRectData.x[id] - boundary[0] - sharedRectData.lineWidth[id] / 2) * scale +
        totalOffsetX;
      const initialY =
        (sharedRectData.y[id] - boundary[2] - sharedRectData.lineWidth[id] / 2) * scale +
        totalOffsetY;
      const state = sharedRectData.state[id];
      if (
        !(
          pointerX >= initialX &&
          pointerX <=
            initialX + (sharedRectData.width[id] + sharedRectData.lineWidth[id]) * scale &&
          pointerY >= initialY &&
          pointerY <= initialY + (sharedRectData.height[id] + sharedRectData.lineWidth[id]) * scale
        )
      ) {
        if (state === RectState.hover) {
          serializedRectData.hoverIdList.delete(id);
          sharedRectData.state[id] = RectState.normal;
          this.updateCanvasByGeometryId(id);
        }
      }
    }

    for (let id of rectIdList.slice().reverse()) {
      if (!serializedRectData.hoverFunction[id]) {
        continue;
      }

      const initialX =
        (sharedRectData.x[id] - boundary[0] - sharedRectData.lineWidth[id] / 2) * scale +
        totalOffsetX;
      const initialY =
        (sharedRectData.y[id] - boundary[2] - sharedRectData.lineWidth[id] / 2) * scale +
        totalOffsetY;
      const state = sharedRectData.state[id];
      if (
        pointerX >= initialX &&
        pointerX <= initialX + (sharedRectData.width[id] + sharedRectData.lineWidth[id]) * scale &&
        pointerY >= initialY &&
        pointerY <= initialY + (sharedRectData.height[id] + sharedRectData.lineWidth[id]) * scale
      ) {
        if (
          state === RectState.hover ||
          state === RectState.checked ||
          serializedRectData.hoverIdList.has(id)
        ) {
          break;
        }

        sharedRectData.state[id] = RectState.hover;

        const rectProperty = serializedRectData.hoverFunction[id]?.(id);

        serializedRectData.hoverIdList.set(id, rectProperty);

        this.updateCanvasByGeometryId(id);

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

    // rect

    const rectIdList = this.geometryManager.getCanvasAreaIdList(level, pieceIndex);
    const serializedRectData = this.geometryManager.getSerializedRectData();
    const sharedRectData = serializedRectData.shared;

    for (let id of rectIdList.slice().reverse()) {
      if (!serializedRectData.clickFunction[id]) {
        continue;
      }

      const initialX =
        (sharedRectData.x[id] - boundary[0] - sharedRectData.lineWidth[id] / 2) * scale +
        totalOffsetX;
      const initialY =
        (sharedRectData.y[id] - boundary[2] - sharedRectData.lineWidth[id] / 2) * scale +
        totalOffsetY;
      const state = sharedRectData.state[id];
      if (
        pointerX >= initialX &&
        pointerX <= initialX + (sharedRectData.width[id] + sharedRectData.lineWidth[id]) * scale &&
        pointerY >= initialY &&
        pointerY <= initialY + (sharedRectData.height[id] + sharedRectData.lineWidth[id]) * scale
      ) {
        if (state === RectState.checked || serializedRectData.checkedIdList.has(id)) {
          console.log(id);
          break;
        }

        sharedRectData.state[id] = RectState.checked;

        const rectProperty = serializedRectData.clickFunction[id]?.(id);

        serializedRectData.checkedIdList.set(id, rectProperty);

        this.updateCanvasByGeometryId(id);

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
            if (event.deltaY < 0) {
              x = event.offsetX - (event.offsetX - x) * (1 + 0.1 / k);
              y = event.offsetY - (event.offsetY - y) * (1 + 0.1 / k);
              k += 0.1;
            } else {
              if (k > 0.5) {
                x = event.offsetX - (event.offsetX - x) * (1 - 0.1 / k);
                y = event.offsetY - (event.offsetY - y) * (1 - 0.1 / k);
                k -= 0.1;
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
