export interface TileMapProps {
  tileData: TileDataProps[];
  onTileClick?: (clickProps: ClickProps) => void;
  handlewheel?: (newViewport: number) => void;
  onDragMove?: (from: Location, to: Location) => void;
  tileWidth: number;
  tileHeight: number;
  width?: number;
  height?: number;
}

export interface TileDataProps {
  base64: string;
  index: number;
}

export interface Location {
  x: number;
  y: number;
}

export interface ClickProps {
  x: number;
  y: number;
}
