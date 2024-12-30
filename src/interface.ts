export interface TileMapProps {
  tileData: TileDataProps[];
  onTileClick?: (clickProps: ClickProps) => void;
  handlewheel?: (event: TileMapEventInfo) => void;
  onDragMove?: (moveX: number, moveY: number) => void;
  // 瓦片图切换的触发阈值
  tileSwitchThreshold?: number;
  tileWidth: number;
  tileHeight: number;
  width?: number;
  height?: number;
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
  absoluteLevel?: number;
}

export interface ClickProps {
  x: number;
  y: number;
}
