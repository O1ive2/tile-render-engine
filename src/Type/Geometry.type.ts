export enum RectType {
  fill,
  stroke,
  fillAndStroke,
}

export enum RectState {
  normal,
  hover,
  checked,
}

export type RectProperty = {
  id?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fillStyle?: string | CanvasGradient | CanvasPattern;
  strokeStyle?: string | CanvasGradient | CanvasPattern;
  lineWidth?: number;
  type?: RectType;
  lineDash?: Array<number>;
  alpha?: number;
  hover?: Function;
  state?: RectState;
};

export type IDrawingDataModel = {
  rect: Array<RectProperty>;
  path: Array<{ x: number; y: number; width: number; height: number }>;
  image: Array<{ x: number; y: number; width: number; height: number }>;
  text: Array<{ x: number; y: number; width: number; height: number }>;
};
