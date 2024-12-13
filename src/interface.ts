export interface TileMapProps {
  tileData: TileDataProps[];
  onTileClick?: (clickProps: ClickProps) => void;
  handlewheel?: (newViewport: number) => void;
  onDragMove?: (from: Location, to: Location) => void;
  width?: number;
  height?: number;
}

export interface TileDataProps {
  x: number;
  y: number;
  src: string;
}

export interface Location {
  x: number;
  y: number;
}

export interface ClickProps {
  x: number;
  y: number;
}
