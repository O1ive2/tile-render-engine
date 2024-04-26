import {
  GeometryType,
  IDrawingDataModel,
  ImageProperty,
  PathProperty,
  RectProperty,
  TextProperty,
} from '../Type/Geometry.type';
import Paint from './Paint';
import Util from './Util';

export enum RenderingState {
  unrendered,
  rendering,
  rendered,
  rerendering,
}

export type BlockAttribute = 'state' | 'image';

export class RenderingBlock {
  public renderingRegion: RenderingRegion;

  public level: number = 0;
  public index: number = 0;
  public indexVector: {
    x: number;
    y: number;
  } = {
    x: 0,
    y: 0,
  };

  public lock: boolean = false;
  public state: RenderingState = RenderingState.unrendered;
  public image: ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null = null;
  public idList: Uint32Array = new Uint32Array();
  public typeList: Uint8Array = new Uint8Array();
  public reRenderList: Map<string, { type: number; id: number; used: boolean }> = new Map([]);
  public parent: RenderingBlock | null = null;

  constructor(paint: Paint, level: number, index: number, renderingRegion: RenderingRegion) {
    this.renderingRegion = renderingRegion;

    const sideNumber = Util.getSideNumberOnLevel(level);

    this.level = level;
    this.index = index;
    this.indexVector.x = index % sideNumber;
    this.indexVector.y = Math.floor(index / sideNumber);

    const {
      minX: originalMinX,
      minY: originalMinY,
      width: originalWidth,
      height: originalHeight,
    } = paint.getProperty().whole.getOriginalBoundary();

    const originalWidthPerPiece = originalWidth / sideNumber;
    const originalHeightPerPiece = originalHeight / sideNumber;

    const geometryData = <IDrawingDataModel>this.renderingRegion.originalGeometryData;

    let idList: Array<number> = [];
    let typeList: Array<number> = [];

    if (level <= 1) {
      let mergedList: Array<any> = [];
      for (let key in geometryData) {
        mergedList = mergedList.concat(Array.from((<any>geometryData)[key].values()));
      }
      mergedList.sort((a: any, b: any) => a.zIndex - b.zIndex);

      idList = mergedList.map((item: any) => item.id);
      typeList = mergedList.map((item: any) => item.propertyType);
    } else {
      this.parent = this.renderingRegion.getParentRenderingBlock(level, index);
      idList = Array.from(this.parent?.idList ?? []);
      typeList = Array.from(this.parent?.typeList ?? []);
    }

    const intersectingIdList = [];
    const intersectingTypeList = [];

    for (let i = 0; i < idList.length; i++) {
      const id = idList[i];
      const type = typeList[i];

      let item = null;

      // todo use text align etc. to set selfOffset
      let selfOffsetX = 0;
      let selfOffsetY = 0;
      let selfWidth = 0;
      let selfHeight = 0;

      if (type === GeometryType.rect) {
        item = <RectProperty>geometryData.rect.get(id);
        selfWidth = item.width + (item.lineWidth ?? 0) * 2;
        selfHeight = item.height + (item.lineWidth ?? 0) * 2;
        selfOffsetX = -(item.lineWidth ?? 0);
        selfOffsetY = -(item.lineWidth ?? 0);
      } else if (type === GeometryType.text) {
        item = <TextProperty>geometryData.text.get(id);
        selfOffsetX = -(item?.width ?? 0) / 2;
        selfOffsetY = -(item?.height ?? 0) / 2;
        selfWidth = <number>item.width;
        selfHeight = <number>item.height;
      } else if (type === GeometryType.image) {
        item = <ImageProperty>geometryData.image.get(id);
        selfWidth = <number>item.width;
        selfHeight = <number>item.height;
      } else if (type === GeometryType.path) {
        item = <PathProperty>geometryData.path.get(id);
        selfWidth = <number>item.width;
        selfHeight = <number>item.height;

        if (item.keepWidth) {
          if (selfHeight > selfWidth) {
            selfWidth = selfWidth / sideNumber / 2;
            selfOffsetX = -selfWidth / 2 - (item.x ?? 0) + item.fromX;
          } else {
            selfHeight = selfHeight / sideNumber / 2;
            selfOffsetY = -selfHeight / 2 - (item.y ?? 0) + item.fromY;
          }
        }
      }

      if (
        Util.intersects(
          {
            x: this.indexVector.x * originalWidthPerPiece + originalMinX,
            y: this.indexVector.y * originalHeightPerPiece + originalMinY,
            width: originalWidthPerPiece,
            height: originalHeightPerPiece,
          },
          {
            x: (item?.x ?? 0) + selfOffsetX,
            y: (item?.y ?? 0) + selfOffsetY,
            width: selfWidth,
            height: selfHeight,
          },
        )
      ) {
        intersectingIdList.push(id);
        intersectingTypeList.push(type);
      }
    }

    this.idList = Uint32Array.from(intersectingIdList);
    this.typeList = Uint8Array.from(intersectingTypeList);
  }

  public addReRender(type: GeometryType, id: number) {
    this.reRenderList.set(`${type}@${id}`, {
      type,
      id,
      used: false,
    });
    this.state = RenderingState.rerendering;
  }

  public setAttribute(key: BlockAttribute, value: any) {
    // todo
    this[key] = value;
  }

  public reset() {
    this.lock = false;
    this.state = RenderingState.unrendered;
    this.image = null;
    this.idList = new Uint32Array();
    this.typeList = new Uint8Array();
    this.reRenderList = new Map([]);
    this.parent = null;
  }

  public resetImage() {
    this.state = RenderingState.unrendered;
    this.image = null;
  }
}

export class RenderingRegion {
  private paint: Paint;

  public originalGeometryData: IDrawingDataModel | null = null;
  public data: Map<number, Map<number, RenderingBlock>> = new Map();

  constructor(paint: Paint) {
    this.paint = paint;
  }

  public init(originalGeometryData: IDrawingDataModel) {
    this.originalGeometryData = originalGeometryData;
  }

  public getParentRenderingBlock(level: number, index: number): RenderingBlock | null {
    const sideNumber = Util.getSideNumberOnLevel(level);
    const xIndex = index % sideNumber;
    const yIndex = Math.floor(index / sideNumber);
    const parentLevel = level - 1;
    const parentIndex = Math.abs(
      Math.ceil((xIndex + 1) / 4 - 1) + Math.ceil((yIndex + 1) / 4 - 1) * (sideNumber / 4),
    );
    return this.getRenderingBlock(parentLevel, parentIndex);
  }

  public getRenderingBlock(level: number, index: number): RenderingBlock | null {
    if (level < 1) {
      return null;
    }
    const renderingBlock = this.data.get(level)?.get(index);
    if (!renderingBlock) {
      this.setRenderingBlock(level, index, new RenderingBlock(this.paint, level, index, this));
      return this.data.get(level)?.get(index) ?? null;
    } else {
      return renderingBlock ?? null;
    }
  }

  public setRenderingBlock(level: number, index: number, renderingBlock: RenderingBlock): void {
    if (level < 1 || !renderingBlock) {
      return;
    }
    if (!this.data.get(level)) {
      this.data.set(level, new Map([]));
    }
    this.data.get(level)?.set(index, renderingBlock);
  }

  public setRenderingBlockByLevel(level: number) {
    const pieceNumber = Util.getSideNumberOnLevel(level) ** 2;
    for (let i = 0; i < pieceNumber; i++) {
      this.setRenderingBlock(level, i, new RenderingBlock(this.paint, level, i, this));
    }
  }

  public updateRenderingBlockAttribute(
    level: number,
    index: number,
    key: BlockAttribute,
    value: any,
  ) {
    this.getRenderingBlock(level, index)?.setAttribute(key, value);
  }

  public getRenderingBlockByFilter(filterOptions: { id: number; type: number }) {
    const filteredList = [];

    for (let [key, renderingBlockMap] of this.data) {
      for (let [index, renderingBlock] of renderingBlockMap) {
        for (let i = 0; i < renderingBlock.idList.length; i++) {
          if (
            renderingBlock.idList[i] === filterOptions.id &&
            renderingBlock.typeList[i] === filterOptions.type
          ) {
            filteredList.push(renderingBlock);
            break;
          }
        }
      }
    }

    return filteredList;
  }

  public clear() {
    for (let [key, renderingBlockMap] of this.data) {
      for (let [index, renderingBlock] of renderingBlockMap) {
        renderingBlock.reset();
      }
    }
  }

  public clearImage() {
    for (let [key, renderingBlockMap] of this.data) {
      for (let [index, renderingBlock] of renderingBlockMap) {
        renderingBlock.resetImage();
      }
    }
  }
}
