export interface TileMapProps {
  tileData: TileDataProps[];
  // Number of tile in X
  tilesX: number;
  tilesY: number;
  // Click event callback
  onTileClick?: (event: TileMapEventInfo) => void;
  // Wheel event callback
  handlewheel?: (event: TileMapEventInfo) => void;
  onDragMove?: (event: TileMapEventInfo) => void;
  // Threshold level of tile switching,default 1
  tileSwitchLevel?: number;
  // Single tile size
  tileSize: {
    height: number;
    width: number;
  };
  // Canvas size
  canvasSize: {
    width?: number;
    height?: number;
  };
  visbleTilesWatcher?: (indexList: number[]) => void;
  dynamicLoad?: boolean;
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
  type?: "Wheel" | "Click" | "DragMove";
  viewPort?: {
    x?: number;
    y?: number;
  };
  zoomLevel?: number;
  x?: number;
  y?: number;
  visibleIndexList?: number[];
}
