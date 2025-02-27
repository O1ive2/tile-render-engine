import { useState } from "react";

export function useTileImageCache() {
  const [imgCache, setImgCache] = useState<
    Map<number, { img: HTMLImageElement; x: number; y: number; index: number }>
  >(new Map());

  return { imgCache, setImgCache };
}
