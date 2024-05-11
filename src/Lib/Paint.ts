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
    // 当前画布中心
    const centerX = this.canvas.getWidth() / 2;
    const centerY = this.canvas.getHeight() / 2;
    // 缩放后画布偏移量
    const offsetX = (centerX - this.canvas.getOffsetX()) * scale - centerX;
    const offsetY = (centerY - this.canvas.getOffsetY()) * scale - centerY;
    // 更新缩放后的画布
    this.canvas.updateTransform({ k: newScale, x: -offsetX, y: -offsetY });
  }

  public resize(): void {
    this.canvas.updateTransform({ k: 1, x: 0, y: 0 });
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
