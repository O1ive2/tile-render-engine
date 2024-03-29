// @ts-ignore
import { IDrawingDataModel } from './CanvasManager';

export default class Calc {
  private static instance: Calc;

  constructor() {}

  public getBoundary(
    drawingDataModel: IDrawingDataModel,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY,
  ): [number, number, number, number, number, number] {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    // rect
    const rectList = drawingDataModel.rect;
    for (const rect of rectList) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    if (rectList.length === 0) {
      minX = 0;
      minY = 0;
    }

    return [minX, maxX, minY, maxY, maxX - minX, maxY - minY];
  }

  public static from(): Calc {
    if (!this.instance) {
      this.instance = new Calc();
    }
    return this.instance;
  }
}
