import { maxThreads } from '../config';
import { RenderingRegion } from './Region';
import SubCanvas from './SubCanvas';

export default class SubCanvasManager {
  static instance: SubCanvasManager;

  private subCanvasList: Array<SubCanvas>;

  constructor(region: RenderingRegion) {
    this.subCanvasList = Array.from(
      { length: maxThreads },
      () => new SubCanvas(region),
    );
  }

  public getSubCanvasList(): Array<SubCanvas> {
    return this.subCanvasList;
  }

  static from(region: RenderingRegion): SubCanvasManager {
    if (!this.instance) {
      this.instance = new SubCanvasManager(region);
    }
    return this.instance;
  }
}
