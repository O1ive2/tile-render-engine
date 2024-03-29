import throttle from 'lodash/throttle';
import { ImageProperty, RectProperty } from '../Type/Geometry.type';
import { maxThreads } from '../config';
import GeometryManager from './GeometryManager';
import Paint from './Paint';
import { RenderingBlock, RenderingRegion, RenderingState } from './Region';
import SubCanvas from './SubCanvas';
import Util from './Util';
import { Whole } from './Whole';

export default class CanvasManager {
  private level: number = 1;
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private subCanvasList: Array<SubCanvas>;
  private canvasCache: Array<Array<any>> = [];
  private renderList: Array<{ x: number; y: number; bitmap: any }> = [];

  private whole: Whole = Whole.from();
  private region: RenderingRegion = RenderingRegion.from();

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
    const blockList = this.region.getRenderingBlockByFilter({ type: geometryType, id });

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
    } = this.whole.getOriginalBoundary();

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

    const blockInfo = this.region.getRenderingBlock(level, index);

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
        minX = (rect.x - boundaryMinX - (rect.lineWidth ?? 0) / 2) * scale + totalOffsetX;
        minY = (rect.y - boundaryMinY - (rect.lineWidth ?? 0) / 2) * scale + totalOffsetY;
        maxX = minX + (rect.width + (rect.lineWidth ?? 0)) * scale;
        maxY = minY + (rect.height + (rect.lineWidth ?? 0)) * scale;
      } else if (type === 2) {
        const image = <ImageProperty>originalImageData.get(id);
        const { width, height } = imageMap.get(sharedImage.imageIndex[id]);

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
        const currentGeometry = this.geometryManager.getOriginalDataByType(type).get(id);
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
    const {
      minX: boundaryMinX,
      minY: boundaryMinY,
      width,
      height,
    } = this.whole.getOriginalBoundary();

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

    const blockInfo = this.region.getRenderingBlock(level, index);

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

    for (let pieceIndex of areaList) {
      const state = (<RenderingBlock>this.region.getRenderingBlock(level, pieceIndex)).state;
      if (state === RenderingState.unrendered) {
        this.region.updateRenderingBlockAttribute(
          level,
          pieceIndex,
          'state',
          RenderingState.rendering,
        );
        this.paintPartCanvas(level, pieceIndex);
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
    const { width, height } = this.whole.getOriginalBoundary();
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

    const subCanvas = this.subCanvasList.find(
      (item) => item.getIsInitialized() && !item.getIsBusy(),
    );

    if (subCanvas) {
      const { minX, minY } = this.whole.getOriginalBoundary();
      if (renderType === 'render') {
        subCanvas.render(
          paintWidth,
          paintHeight,
          offsetX + minX,
          offsetY + minY,
          level,
          pieceIndex,
          realPieceToRenderingScale,
        );
      } else if (renderType === 'rerender') {
        subCanvas.reRender(
          paintWidth,
          paintHeight,
          offsetX + minX,
          offsetY + minY,
          level,
          pieceIndex,
          realPieceToRenderingScale,
        );
      }
    } else {
      setTimeout(() => {
        // todo check index
        if (this.level === level) {
          this.paintPartCanvas(level, pieceIndex, renderType);
        } else {
          this.region.updateRenderingBlockAttribute(
            level,
            pieceIndex,
            'state',
            RenderingState.unrendered,
          );
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
    const sideNumber = Util.getSideNumberOnLevel(level);

    const areaList = this.getPiecesIndex({
      k: renderingScale,
      x: renderingOffsetX,
      y: renderingOffsetY,
    });

    ctx.save();

    ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    for (let pieceIndex of areaList) {
      const blockInfo = this.region.getRenderingBlock(level, pieceIndex);
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
        if (state === RenderingState.rerendering) {
          this.region.updateRenderingBlockAttribute(
            level,
            pieceIndex,
            'state',
            RenderingState.rendered,
          );
          setTimeout(() => {
            this.paintPartCanvas(level, pieceIndex, 'rerender');
          }, 0);
        }
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
