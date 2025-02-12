export interface TileMapProps {
  tileData: TileDataProps[];
  onTileClick?: (event: TileMapEventInfo) => void;
  // Wheel event callback
  handlewheel?: (event: TileMapEventInfo) => void;
  onDragMove?: (event: TileMapEventInfo) => void;
  // Canvas size
  canvasSize: {
    width?: number;
    height?: number;
  };
  // Whether to load incrementally
  incrementalLoad?: boolean;
  // resolutionNumber: number;
  tileConfig: {
    // Threshold level of tile switching,default 1
    tileSwitchLevel?: number;
    // The number of images in the x,y axis of the tile map corresponding to each resolution
    tilesNumPerResolution: ITilesNum[] | ITilesNum;
  };
}

interface ITilesNum {
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
  type?: "Wheel" | "Click" | "DragMove";
  viewPort?: {
    x?: number;
    y?: number;
  };
  zoomLevel?: number;
  x?: number;
  y?: number;
  visibleIndexList?: number[];
  curResolution?: number;
}
