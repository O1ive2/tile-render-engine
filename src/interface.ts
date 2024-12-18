export interface TileMapProps {
  tileData: TileDataProps[];
  onTileClick?: (clickProps: ClickProps) => void;
  handlewheel?: (newViewport: number) => void;
  onDragStart?: (startX: number, startY: number) => void;
  onDragMove?: (moveX: number, moveY: number) => void;
  onDragEnd?: (endX: number, endY: number) => void;
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
}

export interface ClickProps {
  x: number;
  y: number;
}
