import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
} from "react";
import { TileDataProps, TileMapProps } from "./interface";
import React from "react";
import { init } from "./test";
import "./index.css";

const Gaia: React.FC<TileMapProps> = ({
  tileData,
  onTileClick,
  handlewheel,
  onDragMove,
  tileSize,
  tilesX,
  tilesY,
  tileSwitchLevel = 1,
  canvasSize = {
    width: 200,
    height: 200,
  },
  dynamicLoad = false,
  visbleTilesWatcher,
}) => {
  const { width: tileWidth, height: tileHeight } = tileSize;
  const canvasRef = useRef<null | HTMLCanvasElement>(null);
  const [imgCache, setImgCache] = useState<
    {
      img: HTMLImageElement;
      x: number;
      y: number;
      index: number;
    }[]
  >([]);
  const viewport = useRef({ x: 0, y: 0 });
  const zoomLevel = useRef(1);
  const requestRef = useRef<number>(0); // 用于存储请求的 ID
  const lastPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // 存储上一次的鼠标位置

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (context) {
      drawTiles(context);
      visbleTilesWatcher?.(calculateImageVisibleArea());
    }
  }, [tileData, imgCache]);

  const updateData = useMemo(() => {
    return tileData.map((item) => {
      const { blockBase64Str, index } = item;
      const img = new Image();
      img.src = `data:img/png;base64,${blockBase64Str}`;
      const x = tileWidth * (index % tilesX);
      const y = tileHeight * Math.floor(index / tilesX);

      return { img, x, y, index };
    });
  }, [tileData]);

  useLayoutEffect(() => {
    // 在放大到切换瓦片图的临界层级时，修复瓦片图扩张带来的偏移值
    if (zoomLevel.current > tileSwitchLevel) {
      // 在图层levle切换的时候，清空缓存
      if (dynamicLoad) {
        setImgCache([]);
        console.log("clear");
      }
      zoomLevel.current = zoomLevel.current / tileSwitchLevel;
    } else if (zoomLevel.current < 1 / tileSwitchLevel) {
      // 在图层levle切换的时候，清空缓存
      if (dynamicLoad) {
        setImgCache([]);
        console.log("clear");
      }
      // 在缩小到切换瓦片图的临界层级时，修复瓦片图缩减带来的偏移值
      zoomLevel.current = zoomLevel.current / (1 / tileSwitchLevel);
    }
    // 动态加载，则增量更新imgCache缓存
    if (dynamicLoad) {
      // todo 优化缓存更新逻辑
      setImgCache((cache) => {
        return [...cache, ...updateData];
      });
    } else {
      // 非动态加载，直接替换imgCache内容
      setImgCache(updateData);
    }
    console.log("imgCache", imgCache);
  }, [tileData, dynamicLoad]);

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
        visibleIndexList: calculateImageVisibleArea(),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // 计算可视区域的瓦片图index
  const calculateImageVisibleArea = () => {
    const canvasWidth = canvasSize.width as number;
    const canvasHeight = canvasSize.height as number;

    // 计算每个瓦片的缩放后的尺寸
    const scaledTileWidth = tileSize.width * zoomLevel.current;
    const scaledMapWidth = scaledTileWidth * tilesX;
    const scaledTileHeight = tileSize.height * zoomLevel.current;
    const scaledMapHeight = scaledTileHeight * tilesY;

    const startX = viewport.current.x;
    const startY = viewport.current.y;

    const endX = viewport.current.x + scaledMapWidth;
    const endY = viewport.current.y + scaledMapHeight;

    const visIndex: number[] = [];
    let x1, y1, x2, y2;

    // 判断瓦片图在canvas内部
    if (
      startX <= canvasWidth &&
      startY <= canvasWidth &&
      endX >= 0 &&
      endY >= 0
    ) {
      x1 = startX < 0 ? Math.floor(-startX / scaledTileWidth) : 0;
      y1 = startY < 0 ? Math.floor(-startY / scaledTileHeight) : 0;
      x2 =
        endX > canvasWidth
          ? Math.ceil((canvasWidth - startX) / scaledTileWidth)
          : tilesX;
      y2 =
        endY > canvasHeight
          ? Math.ceil((canvasHeight - startY) / scaledTileHeight)
          : tilesY;
    }

    for (let x = x1; x < x2; x++) {
      for (let y = y1; y < y2; y++) {
        visIndex.push(y * tilesX + x);
      }
    }

    return visIndex;
  };

  const handleWheel: React.WheelEventHandler<HTMLCanvasElement> = (event) => {
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
    // setZoomLevel(newZoomLevel);

    const newViewPort = { x: newViewportX, y: newViewportY };

    viewport.current = newViewPort;
    // setViewport(newViewPort);

    handlewheel?.({
      zoomLevel: newZoomLevel,
      viewPort: { x: newViewportX, y: newViewportY },
      type: "Wheel",
      visibleIndexList: calculateImageVisibleArea(),
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const handleWheelWithPreventDefault = (event: any) => {
      event.preventDefault();
      handleWheel(event);
    };

    canvas.addEventListener("wheel", handleWheelWithPreventDefault, {
      passive: false,
    });
    return () => {
      canvas?.removeEventListener("wheel", handleWheelWithPreventDefault);
    };
  }, []);

  const handleClick: React.MouseEventHandler<HTMLCanvasElement> = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect() as DOMRect;
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    onTileClick?.({
      type: "Click",
      x: clickX,
      y: clickY,
      viewPort: viewport.current,
      zoomLevel: zoomLevel.current,
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

init();

export default Gaia;
