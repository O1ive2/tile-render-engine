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

  private eventList: Array<{
    eventName: string;
    trigger: () => void;
  }> = [];

  constructor(gaia: Gaia, id: string) {
    this.gaia = gaia;

    this.id = id;
    this.whole = new Whole(this);
    this.region = new RenderingRegion(this);
    this.highlightList = new Highlight();

    this.canvas = new Canvas(this, id);
    this.geometryManager = new GeometryManager(this, id);
  }

  public zoom(scale: number): void {
    const newScale = scale * this.canvas.getCurrentScale();
    // 当前画布宽高
    const currentWidth = this.canvas.getWidth();
    const currentHeight = this.canvas.getHeight();
    // 缩放后画布宽高
    const newWidth = currentWidth * newScale;
    const newHeight = currentHeight * newScale;
    // 缩放后画布偏移量
    const offsetX = (newWidth - currentWidth) / 2;
    const offsetY = (newHeight - currentHeight) / 2;

    // 更新缩放后的画布
    this.canvas.updateTransform({ k: newScale, x: -offsetX, y: -offsetY });
  }

  public resize(): void {
    // 画布初始宽高
    const originalWidth = 310;
    const originalHeight = 242;
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();
    const scaleX = canvasWidth / originalWidth;
    const scaleY = canvasHeight / originalHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasWidth * scale) / 2 - canvasWidth / 2;
    const offsetY = (canvasHeight * scale) / 2 - canvasHeight / 2;
    this.canvas.updateTransform({ k: scale, x: -offsetX, y: -offsetY });
  }

  public getProperty() {
    return {
      id: this.id,
      whole: this.whole,
      region: this.region,
      highlightList: this.highlightList,
      canvas: this.canvas,
      geometryManager: this.geometryManager,
      eventList: this.eventList,
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

  public onBlank(eventName: string, trigger: () => void) {
    this.eventList.push({
      eventName,
      trigger,
    });
  }
}
