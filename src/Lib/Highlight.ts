import { GeometryType } from '../Type/Geometry.type';

export class Highlight {
  public data: Map<GeometryType, Map<number, { [key: string]: any }>> = new Map([
    [GeometryType.rect, new Map()],
    [GeometryType.text, new Map()],
    [GeometryType.image, new Map()],
    [GeometryType.path, new Map()],
    [GeometryType.svg, new Map()],
  ]);

  constructor() {}

  public get(type: GeometryType): Map<number, { [key: string]: any }> | undefined {
    return this.data.get(type);
  }

  public reset() {
    this.data = new Map([
      [GeometryType.rect, new Map()],
      [GeometryType.text, new Map()],
      [GeometryType.image, new Map()],
      [GeometryType.path, new Map()],
      [GeometryType.svg, new Map()],
    ]);
  }
}
