import { useEffect, useLayoutEffect, useState } from "react";
import { ICanvasSize, ITilesNum, TileDataProps } from "../interface";

export function useTileImageCache(
  enableCache: boolean,
  tileSwitchLevel: number,
  curResolution: number,
  resolutionNumber: number,
  tileTotal: number,
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
        img.index < tileTotal && newImgCache.set(img.index, img);
      });
    }
    setImgCache(newImgCache);
  }, [updateData]);

  return { imgCache, setImgCache };
}

export function useGaiaInit(
  tileData: TileDataProps[],
  viewport: React.RefObject<{
    x: number;
    y: number;
  }>,
  tilesNumPerResolution: ITilesNum | ITilesNum[],
  canvasSize: ICanvasSize,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const [tileWidth, setTileWidth] = useState(0);
  const [tileHeight, setTileHeight] = useState(0);
  const [tilesX, setTilesX] = useState<number>(
    tilesNumPerResolution instanceof Array
      ? tilesNumPerResolution[0].x
      : tilesNumPerResolution.x
  );
  const [tilesY, setTilesY] = useState<number>(
    tilesNumPerResolution instanceof Array
      ? tilesNumPerResolution[0].y
      : tilesNumPerResolution.y
  );
  // 计算单个瓦片图宽高
  useLayoutEffect(() => {
    if (tileData[0]) {
      const img = new Image();
      img.src = `data:image/png;base64,${tileData[0].blockBase64Str}`;

      img.onload = () => {
        setTileHeight(img.height);
        setTileWidth(img.width);
      };
    }
  }, []);

  // 初次渲染将瓦片图移动到视图最中央
  useEffect(() => {
    const fullWidth = tilesX * tileWidth;
    const fullHeight = tilesY * tileHeight;

    viewport.current = {
      x: ((canvasSize.width as number) - fullWidth) / 2,
      y: ((canvasSize.height as number) - fullHeight) / 2,
    };
  }, [tileWidth, tileHeight]);

  // 监听canvas的wheel事件，防止默认行为
  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const handleWheelWithPreventDefault = (event: any) => {
      event.preventDefault();
    };

    canvas.addEventListener("wheel", handleWheelWithPreventDefault);
    return () => {
      canvas?.removeEventListener("wheel", handleWheelWithPreventDefault);
    };
  }, []);

  return {
    tileWidth,
    tileHeight,
    tilesX,
    setTilesX,
    tilesY,
    setTilesY,
  };
}
