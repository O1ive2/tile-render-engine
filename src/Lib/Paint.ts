import { ImageProperty, PathProperty, RectProperty, TextProperty } from '../Type/Geometry.type';
import Canvas from './Canvas';
import Gaia from './Gaia';
import GeometryManager from './GeometryManager';
import { Highlight } from './Highlight';
import { RenderingRegion } from './Region';
import { Whole } from './Whole';

export default class Paint {
  private gaia: Gaia;

  private id: string;
  private whole: Whole;
  private region: RenderingRegion;
  private highlightList: Highlight;

  private canvas: Canvas;
  private geometryManager: GeometryManager;

  constructor(gaia: Gaia, id: string) {
    this.gaia = gaia;

    this.id = id;
    this.whole = new Whole(this);
    this.region = new RenderingRegion(this);
    this.highlightList = new Highlight();

    this.canvas = new Canvas(this, id);
    this.geometryManager = new GeometryManager(this, id);
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

    this.canvas.updateTransform({ k: scale, x: -offsetX, y: -offsetY });
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

  public getProperty() {
    return {
      id: this.id,
      whole: this.whole,
      region: this.region,
      highlightList: this.highlightList,
      canvas: this.canvas,
      geometryManager: this.geometryManager,
      gaia: this.gaia,
    };
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

  public setProperty(idList: Array<number | string>, property: any): void {
    const highlightList = this.highlightList;

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

        this.canvas.updateCanvasByGeometryId(type, id);
      }
    }
  }

  public clear() {
    this.region.clear();
    this.whole.reset();
    this.highlightList.reset();
    this.geometryManager.clear();
  }

  public flush(canvasFlush: boolean = true): Promise<void> {
    return new Promise((resolve) => {
      this.geometryManager.flush().then(() => {
        if (canvasFlush) {
          this.canvas.flush();
        } else {
          this.canvas.updateTransform();
        }
        resolve();
      });
    });
  }
}
