import { GeometryType } from '../Type/Geometry.type';

export class Highlight {
  static instance: Highlight;

  public data: Map<GeometryType, Map<number, { [key: string]: any }>> = new Map([
    [GeometryType.rect, new Map()],
    [GeometryType.text, new Map()],
    [GeometryType.image, new Map()],
    [GeometryType.path, new Map()],
  ]);

  constructor() {}

  public get(type: GeometryType): Map<number, { [key: string]: any }> | undefined {
    return this.data.get(type);
  }

  static from(): Highlight {
    if (!this.instance) {
      this.instance = new Highlight();
    }
    return this.instance;
  }
}
