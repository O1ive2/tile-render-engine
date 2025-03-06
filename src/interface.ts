export interface TileMapProps {
  enableCache?: boolean;
  tileData: TileDataProps[];
  onClick?: (event: TileMapEventInfo) => void;
  onWheel?: (event: TileMapEventInfo) => void;
  onDragMove?: (event: TileMapEventInfo) => void;
  onRightClick?: (event: TileMapEventInfo) => void;
  onDoubleClick?: (event: TileMapEventInfo) => void;
  // Canvas size,default width 200px,height 200px
  canvasSize?: ICanvasSize;
  tileConfig: ITileConfig;
}

export interface ICanvasSize {
  width: number;
  height: number;
}

interface ITileConfig {
  // Threshold level of tile switching,default 1
  tileSwitchLevel?: number;
  // The number of images in the x,y axis of the tile map corresponding to each resolution
  tilesNumPerResolution: ITilesNum[] | ITilesNum;
}

export interface ITilesNum {
  // The number of tiles on the x-axis
  x: number;
  // The number of tiles on the y-axis
  y: number;
}

export interface TileDataProps {
  blockBase64Str: string;
  index: number;
}

export interface Location {
  x: number;
  y: number;
}

export interface TileMapEventInfo {
  type: EventType;
  viewPort: Location;
  zoomLevel: number;
  visibleIndexList: number[];
  curResolution: number;
  mouseInfo?: IMouseInfo;
}

export enum EventType {
  Wheel = "Wheel",
  Click = "Click",
  DragMove = "DragMove",
  RightClick = "RightClick",
  DoubleClick = "DoubleClick",
}

export interface IMouseInfo {
  coordinate: Location;
  coordinateInTile: Location;
}
