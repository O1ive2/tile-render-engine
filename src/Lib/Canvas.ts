import throttle from 'lodash/throttle';
import { ImageProperty, RectProperty } from '../Type/Geometry.type';
import Paint from './Paint';
import { RenderingBlock, RenderingState } from './Region';
import Util from './Util';

export default class Canvas {
  private id: string;
  private level: number = 1;
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;

  private paint: Paint;

  // Initial Rendering W H Scale
  private initialRenderingWidth = 0;
  private initialRenderingHeight = 0;
  private renderingToRealScale = 1;
  private renderingScale = 1;
  private renderingOffsetX = 0;
  private renderingOffsetY = 0;
  private renderingAreaList: Array<number> = [];

  // real size W H
  private realWidth = 0;
  private realHeight = 0;

  // lock
  private opLock = {
    zoom: false,
    hover: false,
    click: false,
  };

  private resizeObserver: ResizeObserver | null = null;

  private detectTimer: NodeJS.Timeout | null = null;

  get maxScaleOnLevel() {
    return 2 << (this.level * 2 - 2);
  }

  get pieceOnLevel() {
    return 2 << (this.level * 2);
  }

  private hoverList: Map<string, { id: number; type: number }> = new Map();

  constructor(paint: Paint, id: string) {
    this.id = id;

    this.paint = paint;

    this.mainCanvas = document.querySelector(id) ?? document.createElement('canvas');
    this.mainCtx = <CanvasRenderingContext2D>this.mainCanvas.getContext('2d', {
      willReadFrequently: true,
    });

    this.detect();
  }

  public updateCanvasByGeometryId(geometryType: number, id: number): void {
    const blockList = this.paint.getProperty().region.getRenderingBlockByFilter({
      type: geometryType,
      id,
    });

    for (let i = 0; i < blockList.length; i++) {
      const blockInfo = blockList[i];

      if (blockInfo.image) {
        blockInfo.addReRender(geometryType, id);
      }
    }
  }

  public updateHover(pointerX: number, pointerY: number) {
    const {
      minX: boundaryMinX,
      minY: boundaryMinY,
      width,
      height,
    } = this.paint.getProperty().whole.getOriginalBoundary();

    const totalOffsetX =
      this.renderingOffsetX +
      ((this.mainCanvas.width - this.initialRenderingWidth) / 2) * this.renderingScale;

    const totalOffsetY =
      this.renderingOffsetY +
      ((this.mainCanvas.height - this.initialRenderingHeight) / 2) * this.renderingScale;

    const scale = this.renderingToRealScale * this.renderingScale;

    // deeper level less query
    const level = this.level > 3 ? this.level : 3;
    const sideNumber = Util.getSideNumberOnLevel(level);

    const xIndex = Math.floor(((pointerX - totalOffsetX) / (width * scale)) * sideNumber);

    const yIndex = Math.floor(((pointerY - totalOffsetY) / (height * scale)) * sideNumber);

    const index = xIndex + yIndex * sideNumber;

    const blockInfo = this.paint.getProperty().region.getRenderingBlock(level, index);

    const {
      rect: sharedRect,
      text: sharedText,
      image: sharedImage,
      path: sharedPath,
    } = this.paint.getProperty().geometryManager.getSerializedData();

    // origin
    const originalRectData = this.paint.getProperty().geometryManager.getOriginalRectList();
    const originalTextData = this.paint.getProperty().geometryManager.getOriginalTextList();
    const originalImageData = this.paint.getProperty().geometryManager.getOriginalImageList();
    const originalPathData = this.paint.getProperty().geometryManager.getOriginalPathList();

    // image map
    const imageMap = this.paint.getProperty().gaia.getProperty().spriteIdImageMap;

    // remove hover state
    for (let [key, { type, id }] of this.hoverList) {
      let minX = 0;
      let minY = 0;
      let maxX = 0;
      let maxY = 0;
      if (type === 0) {
        const rect = <RectProperty>originalRectData.get(id);
        minX = (rect.x - boundaryMinX - (rect.lineWidth ?? 0) / 2) * scale + totalOffsetX;
        minY = (rect.y - boundaryMinY - (rect.lineWidth ?? 0) / 2) * scale + totalOffsetY;
        maxX = minX + (rect.width + (rect.lineWidth ?? 0)) * scale;
        maxY = minY + (rect.height + (rect.lineWidth ?? 0)) * scale;
      } else if (type === 2) {
        const image = <ImageProperty>originalImageData.get(id);
        const { width, height } = imageMap.get(sharedImage.imageIndex[id]) ?? {
          width: 0,
          height: 0,
        };

        minX = (image.x - boundaryMinX) * scale + totalOffsetX;
        minY = (image.y - boundaryMinY) * scale + totalOffsetY;
        maxX = minX + width * scale;
        maxY = minY + height * scale;
      } else if (type === 3) {
        const path = originalPathData.get(id);
        const width = path?.width ?? 0;
        const height = path?.height ?? 0;

        minX = ((path?.x ?? 0) - boundaryMinX) * scale + totalOffsetX;
        minY = ((path?.y ?? 0) - boundaryMinY) * scale + totalOffsetY;
        maxX = minX + width * scale;
        maxY = minY + height * scale;
      }

      if (!(pointerX >= minX && pointerX <= maxX && pointerY >= minY && pointerY <= maxY)) {
        const currentGeometry = this.paint
          .getProperty()
          .geometryManager.getOriginalDataByType(type)
          .get(id);
        this.hoverList.delete(key);
        currentGeometry.hoverOut?.();
      }
    }

    if (xIndex < 0 || xIndex >= sideNumber || yIndex < 0 || yIndex >= sideNumber) {
      return;
    }

    const typeList = blockInfo?.typeList.slice().reverse() ?? [];
    const idList = blockInfo?.idList.slice().reverse() ?? [];

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
        sharedItemWidth = imageInfo?.width ?? 0;
        sharedItemHeight = imageInfo?.height ?? 0;
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

      const initialX = (x - boundaryMinX - borderWidth / 2) * scale + totalOffsetX;
      const initialY = (y - boundaryMinY - borderWidth / 2) * scale + totalOffsetY;

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

        break;
      }
    }
  }

  public updateCheck(pointerX: number, pointerY: number, checkType = 'click') {
    const paintProperty = this.paint.getProperty();

    const {
      minX: boundaryMinX,
      minY: boundaryMinY,
      width,
      height,
    } = paintProperty.whole.getOriginalBoundary();

    const totalOffsetX =
      this.renderingOffsetX +
      ((this.mainCanvas.width - this.initialRenderingWidth) / 2) * this.renderingScale;

    const totalOffsetY =
      this.renderingOffsetY +
      ((this.mainCanvas.height - this.initialRenderingHeight) / 2) * this.renderingScale;

    const scale = this.renderingToRealScale * this.renderingScale;

    // deeper level less query
    const level = this.level > 3 ? this.level : 3;
    const sideNumber = Util.getSideNumberOnLevel(level);

    const xIndex = Math.floor(((pointerX - totalOffsetX) / (width * scale)) * sideNumber);

    const yIndex = Math.floor(((pointerY - totalOffsetY) / (height * scale)) * sideNumber);

    const index = xIndex + yIndex * sideNumber;

    const blockInfo = paintProperty.region.getRenderingBlock(level, index);

    const {
      rect: sharedRect,
      text: sharedText,
      image: sharedImage,
      path: sharedPath,
    } = paintProperty.geometryManager.getSerializedData();

    // origin
    const originalRectData = paintProperty.geometryManager.getOriginalRectList();
    const originalTextData = paintProperty.geometryManager.getOriginalTextList();
    const originalImageData = paintProperty.geometryManager.getOriginalImageList();
    const originalPathData = paintProperty.geometryManager.getOriginalPathList();

    // image map
    const imageMap = paintProperty.gaia.getProperty().spriteIdImageMap;

    // if (xIndex < 0 || xIndex >= sideNumber || yIndex < 0 || yIndex >= sideNumber) {
    //   return;
    // }

    const typeList = blockInfo?.typeList.slice().reverse() ?? [];
    const idList = blockInfo?.idList.slice().reverse() ?? [];

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
        sharedItemWidth = imageInfo?.width ?? 0;
        sharedItemHeight = imageInfo?.height ?? 0;
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

      const initialX = (x - boundaryMinX - borderWidth / 2) * scale + totalOffsetX;
      const initialY = (y - boundaryMinY - borderWidth / 2) * scale + totalOffsetY;

      if (
        pointerX >= initialX &&
        pointerX <= initialX + (sharedItemWidth + borderWidth) * scale &&
        pointerY >= initialY &&
        pointerY <= initialY + (sharedItemHeight + borderWidth) * scale
      ) {
        currentGeometry[checkType]();
        this.updateCanvasByGeometryId(type, id);

        return;
      }
    }

    for (const { eventName, trigger } of paintProperty.eventList) {
      if (eventName === checkType) {
        trigger();
      }
    }
  }

  public updateTransform(
    transform: any = {
      x: this.renderingOffsetX,
      y: this.renderingOffsetY,
      k: this.renderingScale,
    },
  ): void {
    this.renderingOffsetX = transform.x;
    this.renderingOffsetY = transform.y;
    this.renderingScale = transform.k;

    const level = (this.level = Util.getLevelByScale(transform.k));

    this.renderingAreaList = this.getPiecesIndex(transform);

    const region = this.paint.getProperty().region;

    for (let pieceIndex of this.renderingAreaList) {
      const state = (<RenderingBlock>region.getRenderingBlock(level, pieceIndex)).state;
      if (state === RenderingState.unrendered) {
        region.updateRenderingBlockAttribute(level, pieceIndex, 'state', RenderingState.rendering);
        this.paintPartCanvas(level, pieceIndex);
      }
    }

    this.render();
  }

  public getOffsetX(): number {
    return this.renderingOffsetX;
  }

  public getOffsetY(): number {
    return this.renderingOffsetY;
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

  public getCurrentScale(): number {
    return this.renderingScale;
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
            k = this.renderingScale;
            x = this.renderingOffsetX;
            y = this.renderingOffsetY;
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
          k = this.renderingScale;
          x = this.renderingOffsetX;
          y = this.renderingOffsetY;
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
    } else if (event === 'resize') {
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver((entries) => {
          callback(entries[0]);
        });
        this.resizeObserver.observe(canvas);
      }
      // canvas.addEventListener(
      //   'resize',
      //   (event: UIEvent) => {
      //     alert(123123123);
      //     callback();
      //   },
      //   false,
      // );
    }
  }

  public flush(canvasFlush: boolean = true) {
    const { width, height } = this.paint.getProperty().whole.getOriginalBoundary();
    const canvasWidth = this.getWidth();
    const canvasHeight = this.getHeight();
    this.realWidth = width;
    this.realHeight = height;

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

    if (canvasFlush) {
      let lockTimer: NodeJS.Timeout | null = null;

      this.on(
        'zoom',
        throttle(
          (transform: any) => {
            lockTimer && clearTimeout(lockTimer);
            this.opLock.hover = true;
            // this.opLock.click = true;
            this.updateTransform(transform);
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
            // this.opLock.click = false;
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
        // if (!this.opLock.click) {
        this.updateCheck(x, y, 'click');
        // }
      });

      this.on('rclick', ({ x, y }: { x: number; y: number }) => {
        // if (!this.opLock.click) {
        this.updateCheck(x, y, 'rclick');
        // }
      });

      this.on('dbclick', ({ x, y }: { x: number; y: number }) => {
        // if (!this.opLock.click) {
        this.updateCheck(x, y, 'dbclick');
        // }
      });

      const timer = setInterval(() => {
        if (this.mainCanvas.clientWidth === 0 || this.mainCanvas.clientWidth === 0) {
          return;
        }
        clearInterval(timer);
        let originalWidth = this.mainCanvas.clientWidth;
        let originalHeight = this.mainCanvas.clientHeight;
        this.on(
          'resize',
          throttle(
            (entry: ResizeObserverEntry) => {
              if (
                originalWidth !== this.mainCanvas.clientWidth ||
                originalHeight != this.mainCanvas.clientHeight
              ) {
                originalWidth = this.mainCanvas.clientWidth;
                originalHeight = this.mainCanvas.clientHeight;
                this.paint.getProperty().region.clearImage();
                this.flush(false);
              }
            },
            1000,
            {
              leading: false,
              trailing: true,
            },
          ),
        );
      }, 500);
    }
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

    const sideNumber = Util.getSideNumberOnLevel(this.level);

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
    pieceIndex: number,
    renderType: 'render' | 'rerender' = 'render',
  ): void {
    const sideNumber = Util.getSideNumberOnLevel(level);
    const xIndex = pieceIndex % sideNumber;
    const yIndex = Math.floor(pieceIndex / sideNumber);
    const offsetX = (xIndex * this.realWidth) / sideNumber;
    const offsetY = (yIndex * this.realHeight) / sideNumber;

    const widthPerPiece = this.realWidth / sideNumber;
    const heightPerPiece = this.realHeight / sideNumber;

    const realPieceToRenderingScale = sideNumber * this.renderingToRealScale;

    const paintWidth = widthPerPiece * realPieceToRenderingScale;
    const paintHeight = heightPerPiece * realPieceToRenderingScale;

    const renderWorker = this.paint
      .getProperty()
      .gaia.getProperty()
      .renderWorkerList.find((item: any) => item.getIsInitialized() && !item.getIsBusy());

    if (renderWorker) {
      const { minX, minY } = this.paint.getProperty().whole.getOriginalBoundary();
      if (renderType === 'render') {
        renderWorker.render(
          this.id,
          paintWidth,
          paintHeight,
          offsetX + minX,
          offsetY + minY,
          level,
          pieceIndex,
          realPieceToRenderingScale,
          this.paint,
        );
      } else if (renderType === 'rerender') {
        renderWorker.reRender(
          this.id,
          offsetX + minX,
          offsetY + minY,
          level,
          pieceIndex,
          realPieceToRenderingScale,
          this.paint,
        );
      }
    } else {
      setTimeout(() => {
        // todo check index
        if (this.level === level) {
          this.paintPartCanvas(level, pieceIndex, renderType);
        } else {
          this.paint
            .getProperty()
            .region.updateRenderingBlockAttribute(
              level,
              pieceIndex,
              'state',
              RenderingState.unrendered,
            );
        }
      }, 0);
    }
  }

  public render(): void {
    const ctx = this.mainCtx;

    const region = this.paint.getProperty().region;

    const renderingOffsetX = this.renderingOffsetX;
    const renderingOffsetY = this.renderingOffsetY;
    const renderingScale = this.renderingScale;
    const level = this.level;
    const sideNumber = Util.getSideNumberOnLevel(level);

    ctx.save();

    ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    for (let pieceIndex of this.renderingAreaList) {
      const blockInfo = region.getRenderingBlock(level, pieceIndex);
      const image = blockInfo?.image;
      const state = blockInfo?.state;
      const xIndex = pieceIndex % sideNumber;
      const yIndex = Math.floor(pieceIndex / sideNumber);
      const renderingX = (xIndex * this.initialRenderingWidth) / sideNumber;
      const renderingY = (yIndex * this.initialRenderingHeight) / sideNumber;

      if ((state === RenderingState.rendered || state === RenderingState.rerendering) && image) {
        this.mainCtx.drawImage(
          image,
          0,
          0,
          image.width,
          image.height,
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
  }

  private detect(): void {
    const region = this.paint.getProperty().region;
    const level = this.level;

    for (let pieceIndex of this.renderingAreaList) {
      const blockInfo = region.getRenderingBlock(level, pieceIndex);
      const state = blockInfo?.state;

      if (state === RenderingState.rerendering) {
        region.updateRenderingBlockAttribute(level, pieceIndex, 'state', RenderingState.rendered);
        setTimeout(() => {
          this.paintPartCanvas(level, pieceIndex, 'rerender');
        }, 0);
      }
    }
    this.detectTimer = setTimeout(() => {
      this.detect();
    }, 60);
  }
}
