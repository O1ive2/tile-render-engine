import { ImageProperty, PathProperty, RectProperty, TextProperty } from '../Type/Geometry.type';
import CanvasManager from './CanvasManager';
import GeometryManager from './GeometryManager';
import { Highlight } from './Highlight';

export default class Paint {
  private canvasManager: CanvasManager;
  private geometryManager: GeometryManager;

  constructor(canvasManager: CanvasManager, geometryManager: GeometryManager) {
    this.canvasManager = canvasManager;
    this.geometryManager = geometryManager;
  }

  public zoom(id: string, scale: number): void {
    // 获取当前画布
    const canvas = document.getElementById(id) as HTMLCanvasElement;
    // 当前画布宽高
    const originWidth = canvas.width;
    const originHeight = canvas.height;
    // 缩放后画布宽高
    const newWidth = originWidth * scale;
    const newHeight = originHeight * scale;
    // 缩放后画布偏移量
    const offsetX = (newWidth - originWidth) / 2;
    const offsetY = (newHeight - originHeight) / 2;

    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, originWidth, originHeight);
    context?.translate(-offsetX, -offsetY);
    context?.scale(scale, scale);

    this.canvasManager.updateTransform({ k: scale, x: -offsetX, y: -offsetY });
  }

  public resize(id: string): void {
    // 获取当前画布
    const canvas = document.getElementById(id) as HTMLCanvasElement;
    const context = canvas.getContext('2d');

    if (context) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.putImageData(imageData, 0, 0);
    }
  }

  public drawRect(rectProperty: RectProperty): void {
    this.geometryManager.collectRect(rectProperty);
  }

  public drawText(textProperty: TextProperty): void {
    this.geometryManager.collectText(textProperty);
  }

  public drawImage(imageProperty: ImageProperty): void {
    this.geometryManager.collectImage(imageProperty);
  }

  public drawPath(pathProperty: PathProperty): void {
    this.geometryManager.collectPath(pathProperty);
  }

  public highlight(idList: Array<number | string>, property: any): void {
    const highlightList = Highlight.from();

    for (let businessId of idList) {
      const autoIdMap = this.geometryManager.getAutoIdMap();
      const mapInfo = autoIdMap.get(businessId);
      if (mapInfo) {
        const { id, type } = mapInfo;
        if (property) {
          highlightList.get(type)?.set(id, property);
        } else {
          highlightList.get(type)?.delete(id);
        }

        this.canvasManager.updateCanvasByGeometryId(type, id);
      }
    }
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
    return new Promise((resolve, reject) => {
      this.geometryManager.loadImage(spriteInfo).then(resolve);
    });
  }

  public flush(): Promise<void> {
    return new Promise((resolve) => {
      this.geometryManager.flush(this.canvasManager).then(() => {
        this.canvasManager.flush();
        resolve();
      });
    });
  }

  public static from(canvasManager: CanvasManager, geometryManager: GeometryManager): Paint {
    return new Paint(canvasManager, geometryManager);
  }
}
