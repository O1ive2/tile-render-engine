export enum RectType {
  fill,
  stroke,
  fillAndStroke,
}

export enum LineCapType {
  butt,
  round,
  square,
}

export enum CommonState {
  normal,
  hover,
  checked,
}

export type RectProperty = {
  id?: number|string;
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
  hoverOut?: Function;
  click?: Function;
  state?: CommonState;
  zIndex?: number;
  propertyType?: 0;
};

export type TextProperty = {
  id?: number|string;
  x: number;
  y: number;
  content: string;
  width?: number;
  height?: number;
  fontSize?: number;
  fillStyle?: string;
  textAlign?: 'start' | 'end' | 'left' | 'right' | 'center';
  textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
  direction?: 'ltr' | 'rtl' | 'inherit';
  alpha?: number;
  state?: CommonState;
  zIndex?: number;
  propertyType?: 1;
};

export type ImageProperty = {
  id?: number|string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  imageId: string;
  imageIndex?: number;
  alpha?: number;
  zIndex?: number;
  propertyType?: 2;
  hover?: Function;
  hoverOut?: Function;
  click?: Function;
  state?: CommonState;
};

export type PathProperty = {
  id?: number|string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strokeStyle?: string;
  lineWidth?: number;
  lineDash?: Array<number>;
  lineCap?: LineCapType;
  alpha?: number;
  zIndex?: number;
  propertyType?: 3;
  hover?: Function;
  hoverOut?: Function;
  click?: Function;
  state?: CommonState;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type IDrawingDataModel = {
  rect: Map<number, RectProperty>;
  path: Map<number, PathProperty>;
  image: Map<number, ImageProperty>;
  text: Map<number, TextProperty>;
};
