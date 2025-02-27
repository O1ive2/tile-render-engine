import { useEffect, useLayoutEffect, useState } from "react";
import { TileDataProps } from "../interface";

export function useTileImageCache(
  enableCache: boolean,
  tileSwitchLevel: number,
  curResolution: number,
  resolutionNumber: number,
  zoomLevel: React.RefObject<number>,
  setCurResolution: React.Dispatch<React.SetStateAction<number>>,
  updateData: {
    img: HTMLImageElement;
    x: number;
    y: number;
    index: number;
  }[]
) {
  const [imgCache, setImgCache] = useState<
    Map<number, { img: HTMLImageElement; x: number; y: number; index: number }>
  >(new Map());

  useLayoutEffect(() => {
    let newImgCache: Map<
      number,
      { img: HTMLImageElement; x: number; y: number; index: number }
    >;
    // 在放大到切换瓦片图的临界level时的处理
    if (
      zoomLevel.current > tileSwitchLevel &&
      curResolution < resolutionNumber - 1
    ) {
      // 在分辨率切换的时候，清空缓存
      newImgCache = new Map();
      // 修复瓦片图扩张切换带来的偏移值,并且防止无限制放大
      zoomLevel.current = zoomLevel.current / tileSwitchLevel;
      setCurResolution((cur) => cur + 1);
    } else if (zoomLevel.current < 1 / tileSwitchLevel && curResolution > 0) {
      // 在分辨率切换的时候，清空缓存
      newImgCache = new Map();
      // 在缩小到切换瓦片图的临界level时，修复瓦片图缩减切换带来的偏移值
      zoomLevel.current = zoomLevel.current / (1 / tileSwitchLevel);
      setCurResolution((cur) => cur - 1);
    } else {
      if (enableCache) {
        newImgCache = new Map(imgCache);
      } else {
        newImgCache = new Map();
      }

      updateData.forEach((img) => {
        newImgCache.set(img.index, img);
      });
    }
    setImgCache(newImgCache);
  }, [updateData]);

  return { imgCache, setImgCache };
}

export function useTest(tileData: TileDataProps[]) {
  useEffect(() => {
    console.log(tileData, "hooks test");
  }, [tileData]);
}
