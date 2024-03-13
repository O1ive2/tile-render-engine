import { ImageProperty, PathProperty, RectProperty, TextProperty } from '../Type/Geometry.type';
import CanvasManager from './CanvasManager';
import GeometryManager from './GeometryManager';

export default class Paint {
  private canvasManager: CanvasManager;
  private geometryManager: GeometryManager = GeometryManager.from();

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
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
    for (let businessId of idList) {
      const autoIdMap = this.geometryManager.getAutoIdMap();
      const mapInfo = autoIdMap.get(businessId);
      if (mapInfo) {
        const { id, type } = mapInfo;
        this.geometryManager.getHighlightListByType(type).set(id, property);
        this.canvasManager.updateCanvasByGeometryId(type, id);
      }
    }
  }

  public loadImage(img: string, info: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const imgObj = new Image();
      imgObj.src = img;
      imgObj.onload = () => {
        this.geometryManager.loadImage(imgObj, info).then(resolve);
      };
      imgObj.onerror = () => {
        reject();
      };
    });
  }

  public flush() {
    this.geometryManager.flush(this.canvasManager).then(() => {
      this.canvasManager.flush();
    });
  }

  public static from(canvasManager: CanvasManager): Paint {
    return new Paint(canvasManager);
  }
}
