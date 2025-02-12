export interface TileMapProps {
  tileData: TileDataProps[];
  // The number of tiles on the x-axis
  // tilesX: number;
  // // The number of tiles on the y-axis
  // tilesY: number;
  // Click event callback
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
  // The number of different resolutions
  // resolutionNumber: number;
  tileConfig: {
    // Single tile size
    tileSize: {
      height: number;
      width: number;
    };
    // Threshold level of tile switching,default 1
    tileSwitchLevel?: number;
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
