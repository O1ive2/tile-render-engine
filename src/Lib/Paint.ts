import { RectProperty } from '../Type/Geometry.type';
import CanvasManager from './CanvasManager';
import GeometryManager from './GeometryManager';

export default class Paint {
  private canvasManager: CanvasManager;
  private geometryManager: GeometryManager = GeometryManager.from();

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
  }

  public drawPath() {}

  public drawRect(rectProperty: RectProperty) {
    this.geometryManager.collectRect(rectProperty);
  }

  public drawImage() {}

  public drawText() {}

  public flush() {
    this.geometryManager.flush();
    this.canvasManager.flush();
  }

  public static from(canvasManager: CanvasManager): Paint {
    return new Paint(canvasManager);
  }
}
