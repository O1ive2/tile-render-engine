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
    this.on('zoom', (transform: any) => {
      this.updateTransform(transform);
    });

    this.on('hover', ({ x, y }: { x: number; y: number }) => {
      this.updateHover(x, y);
    });

    this.render();
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
    // rect
    const rectList = this.geometryManager.getOriginalRectList();
    for (let { x, y, width, height, hover } of rectList) {
      if (
        pointerX >= (x - boundary[0]) * scale + totalOffsetX &&
        pointerX <= (x - boundary[0] + width) * scale + totalOffsetX &&
        pointerY >= (y - boundary[2]) * scale + totalOffsetY &&
        pointerY <= (y - boundary[2] + height) * scale + totalOffsetY
      ) {
        hover?.();
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

  public getWidth(): number {
    return this.mainCanvas.width;
  }

  public getHeight(): number {
    return this.mainCanvas.height;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  public on(event: string, callback: any): void {
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
        },
        false,
      );
      canvas.addEventListener(
        'pointerout',
        () => {
          draggable = false;
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
