export enum GeometryType {
  rect,
  text,
  image,
  path,
}

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
  id?: number | string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillStyle?: string | CanvasGradient | CanvasPattern;
  strokeStyle?: string | CanvasGradient | CanvasPattern;
  keepWidth?: 0 | 1;
  lineWidth?: number;
  type?: RectType;
  lineDash?: Array<number>;
  alpha?: number;
  hover?: Function;
  hoverOut?: Function;
  click?: Function;
  dbclick?: Function;
  rclick?: Function;
  zIndex?: number;
  propertyType?: GeometryType.rect;
};

export type TextProperty = {
  id?: number | string;
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
  zIndex?: number;
  propertyType?: GeometryType.text;
};

export type ImageProperty = {
  id?: number | string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  imageId: string;
  imageIndex?: number;
  alpha?: number;
  zIndex?: number;
  propertyType?: GeometryType.image;
  hover?: Function;
  hoverOut?: Function;
  click?: Function;
  dbclick?: Function;
  rclick?: Function;
};

export type PathProperty = {
  id?: number | string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strokeStyle?: string;
  keepWidth?: 0 | 1;
  lineWidth?: number;
  lineDash?: Array<number>;
  lineCap?: LineCapType;
  alpha?: number;
  zIndex?: number;
  propertyType?: GeometryType.path;
  hover?: Function;
  hoverOut?: Function;
  click?: Function;
  dbclick?: Function;
  rclick?: Function;
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

export type ISpriteProperty = {
  [key: string]: {
    width: number;
    height: number;
    normalImgBase64: string;
    hoverImgBase64: string;
    checkedImgBase64: string;
  };
};

export type ISpriteImageProperty = {
  img: HTMLImageElement;
  hoverImg: HTMLImageElement;
  checkImg: HTMLImageElement;
  width: number;
  height: number;
  normalImgBase64: string;
  hoverImgBase64: string;
  checkedImgBase64: string;
};
