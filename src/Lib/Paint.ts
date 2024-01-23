import Calc from './Calc';
import CanvasManager from './CanvasManager';
import Util from './Util';

export type IDrawingDataModel = {
  rect: Array<{ x: number; y: number; width: number; height: number }>;
  path: Array<{ x: number; y: number; width: number; height: number }>;
  image: Array<{ x: number; y: number; width: number; height: number }>;
  text: Array<{ x: number; y: number; width: number; height: number }>;
};

export default class Paint {
  private level: number = 1;
  private boundary = [0, 0, 0, 0, 0, 0];

  // Initial Rendering W H Scale
  private initialRenderingWidth = 0;
  private initialRenderingHeight = 0;
  private initialRenderingToRealScale = 1;

  // real size W H
  private realWidth = 0;
  private realHeight = 0;

  // interaction added
  private interactionAdded: boolean = false;

  get maxScaleOnLevel() {
    return 2 << (this.level * 2 - 2);
  }

  get pieceOnLevel() {
    return 2 << (this.level * 2);
  }

  get sideNumberOnLevel() {
    return 2 << this.level;
  }

  private canvasManager: CanvasManager;
  private drawingDataModel: IDrawingDataModel = {
    rect: [],
    path: [],
    image: [],
    text: [],
  };

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
  }

  public drawPath() {}

  public drawRect(x: number, y: number, width: number, height: number) {
    this.drawingDataModel.rect.push({
      x,
      y,
      width,
      height,
    });
  }

  public drawImage() {}

  public drawText() {}

  public flush() {
    const boundary = (this.boundary = Calc.from().getBoundary(this.drawingDataModel));
    const canvasWidth = this.canvasManager.getWidth();
    const canvasHeight = this.canvasManager.getHeight();
    this.realWidth = boundary[4];
    this.realHeight = boundary[5];
    if (this.realWidth / this.realHeight > canvasWidth / canvasHeight) {
      // 目字形
      //   const y = (canvasHeight - boundary[5]) / 2;
      this.initialRenderingWidth = canvasWidth;
      this.initialRenderingToRealScale = this.initialRenderingWidth / this.realWidth;
      this.initialRenderingHeight = this.initialRenderingToRealScale * this.realHeight;
    } else {
      this.initialRenderingHeight = canvasHeight;
      this.initialRenderingToRealScale = this.initialRenderingHeight / this.realHeight;
      this.initialRenderingWidth = this.initialRenderingToRealScale * this.realWidth;
    }
  }

  // operation
  public addInteraction() {
    if (this.interactionAdded) {
      return;
    }
    this.interactionAdded = true;
    this.canvasManager.on('zoom', (transform: any) => {
      const canvasWidth = this.canvasManager.getWidth();
      const canvasHeight = this.canvasManager.getHeight();

      const { k, x, y } = transform;

      this.level = Util.getLevelByScale(k);

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
      let indexEndX = Math.ceil(
        Math.abs(snapshot.maxX / (renderingWidth / this.sideNumberOnLevel)),
      );
      let indexStartY = Math.floor(
        Math.abs(snapshot.minY / (renderingHeight / this.sideNumberOnLevel)),
      );
      let indexEndY = Math.ceil(
        Math.abs(snapshot.maxY / (renderingHeight / this.sideNumberOnLevel)),
      );
      indexEndX = indexEndX > this.sideNumberOnLevel ? this.sideNumberOnLevel : indexEndX;
      indexEndY = indexEndY > this.sideNumberOnLevel ? this.sideNumberOnLevel : indexEndY;


      let areaList = [];
      for (let i = indexStartX; i < indexEndX; i++) {
          for (let j = indexStartY; j < indexEndY; j++) {
              areaList.push(i + j * this.sideNumberOnLevel);
          }
      }
  
    //   return areaList;
  


    });
  }

  // partition
  private partition(transform) {}

  public static from(canvasManager: CanvasManager): Paint {
    return new Paint(canvasManager);
  }
}
