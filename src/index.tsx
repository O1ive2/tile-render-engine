import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  memo,
} from "react";
import { TileMapProps } from "./interface";
import React from "react";
import "./index.css";
import calculateVisibleTiles from "./utils/calculateVisibleTiles";
import tilesTransform from "./utils/tilesTransform";
import { useTileImageCache } from "./hooks/renderHooks";

const Gaia: React.FC<TileMapProps> = ({
  enableCache = false,
  tileData,
  handleClick: handleClickCallback,
  handlewheel: handleWheelCallback,
  onDragMove,
  canvasSize = {
    width: 200,
    height: 200,
  },
  tileConfig,
}) => {
  const [renderFlag, setRenderFlag] = useState<boolean>(true);
  const { tileSwitchLevel = 1, tilesNumPerResolution } = tileConfig;
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
  const [curResolution, setCurResolution] = useState<number>(0);
  // const [imgCache, setImgCache] = useState<
  //   Map<
  //     number,
  //     {
  //       img: HTMLImageElement;
  //       x: number;
  //       y: number;
  //       index: number;
  //     }
  //   >
  // >(new Map());

  const canvasRef = useRef<null | HTMLCanvasElement>(null);
  const viewport = useRef({
    x: 0,
    y: 0,
  });
  const zoomLevel = useRef(1);
  const requestRef = useRef<number>(0); // 用于存储请求的 ID
  const lastPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // 存储上一次的鼠标位置

  const resolutionNumber = useMemo(() => {
    return tilesNumPerResolution instanceof Array
      ? tilesNumPerResolution.length
      : 1;
  }, []);
  const updateData = useMemo(() => {
    return tileData.map((item) => {
      const { blockBase64Str, index } = item;
      const img = new Image();
      img.src = `data:img/png;base64,${blockBase64Str}`;
      const x = tileWidth * (index % tilesX);
      const y = tileHeight * Math.floor(index / tilesX);
      return { img, x, y, index };
    });
  }, [tileData, tilesX, tileWidth]);
  const canvas = canvasRef.current;
  const context = canvas?.getContext("2d");

  const { imgCache } = useTileImageCache(
    enableCache,
    tileSwitchLevel,
    curResolution,
    resolutionNumber,
    zoomLevel,
    setCurResolution,
    updateData
  );

  // 计算瓦片图的宽高
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

  // 计算初始位置
  useEffect(() => {
    const fullWidth = tilesX * tileWidth;
    const fullHeight = tilesY * tileHeight;

    viewport.current = {
      x: ((canvasSize.width as number) - fullWidth) / 2,
      y: ((canvasSize.height as number) - fullHeight) / 2,
    };
  }, [tileWidth, tileHeight]);

  // 绘图
  useLayoutEffect(() => {
    if (context) {
      drawTiles(context);
    }
  }, [renderFlag, imgCache]);

  // 切换分辨率时，更新x，y轴瓦片数量
  useLayoutEffect(() => {
    tilesNumPerResolution instanceof Array &&
      setTilesX(tilesNumPerResolution[curResolution].x);
    tilesNumPerResolution instanceof Array &&
      setTilesY(tilesNumPerResolution[curResolution].y);
  }, [curResolution]);

  // 依据顺序绘制瓦片图
  const drawTiles = (context: CanvasRenderingContext2D) => {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    imgCache?.forEach((item) => {
      const { x, y, img } = item;

      if (img.complete) {
        context.drawImage(
          img,
          x * zoomLevel.current + viewport.current.x,
          y * zoomLevel.current + viewport.current.y,
          tileWidth * zoomLevel.current,
          tileHeight * zoomLevel.current
        );
      } else {
        img.onload = () => {
          context.drawImage(
            img,
            x * zoomLevel.current + viewport.current.x,
            y * zoomLevel.current + viewport.current.y,
            tileWidth * zoomLevel.current,
            tileHeight * zoomLevel.current
          );
        };
      }
    });
  };

  const handleMouseDown: React.MouseEventHandler<HTMLCanvasElement> = (
    event
  ) => {
    const startX = event.clientX;
    const startY = event.clientY;

    // 初始化 lastPosition 存储的值
    lastPosition.current = { x: startX, y: startY };

    // 使用 requestAnimationFrame 延迟更新视口
    const onMouseMove = (moveEvent: MouseEvent) => {
      setRenderFlag((f) => !f);
      const dx = moveEvent.clientX - lastPosition.current.x;
      const dy = moveEvent.clientY - lastPosition.current.y;

      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }

      requestRef.current = requestAnimationFrame(() => {
        viewport.current = {
          x: viewport.current.x + dx,
          y: viewport.current.y + dy,
        };

        lastPosition.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      });
      onDragMove?.({
        zoomLevel: zoomLevel.current,
        viewPort: { x: viewport.current.x, y: viewport.current.y },
        type: "DragMove",
        visibleIndexList: calculateVisibleTiles(
          canvasSize,
          zoomLevel.current,
          viewport.current,
          tilesX,
          tilesY,
          tileWidth,
          tileHeight
        ),
        curResolution: curResolution,
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleWheel: React.WheelEventHandler<HTMLCanvasElement> = (event) => {
    setRenderFlag((f) => !f);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomStep = 0.1;
    const zoomFactor = event.deltaY < 0 ? 1 + zoomStep : 1 - zoomStep;

    // 获取鼠标相对画布的位置
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // 根据鼠标位置计算新的 viewport，使得缩放在鼠标指针位置发生
    const newZoomLevel = Math.max(
      0.1,
      Math.min(100, zoomLevel.current * zoomFactor)
    );

    // 计算缩放后的偏移量
    const zoomRatio = newZoomLevel / zoomLevel.current;

    const newViewportX =
      viewport.current.x - (mouseX - viewport.current.x) * (zoomRatio - 1);
    const newViewportY =
      viewport.current.y - (mouseY - viewport.current.y) * (zoomRatio - 1);

    // 更新缩放和视口位置
    zoomLevel.current = newZoomLevel;

    const newViewPort = { x: newViewportX, y: newViewportY };

    viewport.current = newViewPort;

    const visibleIndexList = calculateVisibleTiles(
      canvasSize,
      zoomLevel.current,
      viewport.current,
      tilesX,
      tilesY,
      tileWidth,
      tileHeight
    );

    handleWheelCallback?.({
      zoomLevel: zoomLevel.current,
      viewPort: { x: viewport.current.x, y: viewport.current.y },
      type: "Wheel",
      visibleIndexList:
        zoomLevel.current < tileSwitchLevel &&
        zoomLevel.current > 1 / tileSwitchLevel
          ? visibleIndexList
          : zoomLevel.current > tileSwitchLevel
          ? Array.from(
              tilesTransform(visibleIndexList, true, tileSwitchLevel, tilesX)
            )
          : Array.from(
              tilesTransform(visibleIndexList, false, tileSwitchLevel, tilesX)
            ),
      curResolution:
        zoomLevel.current < tileSwitchLevel &&
        zoomLevel.current > 1 / tileSwitchLevel
          ? curResolution
          : zoomLevel.current > tileSwitchLevel
          ? Math.min(resolutionNumber - 1, curResolution + 1)
          : Math.max(0, curResolution - 1),
    });
  };

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

  const handleClick: React.MouseEventHandler<HTMLCanvasElement> = (event) => {
    setRenderFlag((f) => !f);
    const rect = canvasRef.current?.getBoundingClientRect() as DOMRect;
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    handleClickCallback?.({
      type: "Click",
      curResolution: curResolution,
      viewPort: viewport.current,
      zoomLevel: zoomLevel.current,
      visibleIndexList: calculateVisibleTiles(
        canvasSize,
        zoomLevel.current,
        viewport.current,
        tilesX,
        tilesY,
        tileWidth,
        tileHeight
      ),
      mouseInfo: {
        coordinate: {
          x: clickX,
          y: clickY,
        },
        coordinateInTile: {
          x: (clickX - viewport.current.x) / zoomLevel.current,
          y: (clickY - viewport.current.y) / zoomLevel.current,
        },
      },
    });
  };

  return (
    <canvas
      className="gaia-canvas"
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  );
};

export default memo(Gaia);
