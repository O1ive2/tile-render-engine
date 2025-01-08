import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { TileMapProps } from "./interface";
import React from "react";
import { init } from "./test";
import "./index.css";

const Gaia: React.FC<TileMapProps> = ({
  tileData,
  onTileClick,
  handlewheel,
  tilesX,
  tileSize,
  tileSwitchLevel = 1,
  canvasSize = {
    width: 200,
    height: 200,
  },
}) => {
  const { width: tileWidth, height: tileHeight } = tileSize;
  const canvasRef = useRef<null | HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const requestRef = useRef<number>(0); // 用于存储请求的 ID
  const lastPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // 存储上一次的鼠标位置

  const tilesY = useMemo(() => {
    return Math.floor(tileData.length / tilesX);
  }, [tileData]);

  useLayoutEffect(() => {
    // 修复偏移值
    if (zoomLevel > tileSwitchLevel) {
      setZoomLevel((i) => i / tileSwitchLevel);
    } else if (zoomLevel < 1 / tileSwitchLevel) {
      setZoomLevel((i) => i / (1 / tileSwitchLevel));
    }
  }, [tileData]);

  const imgCache = useMemo(() => {
    return tileData.map((item) => {
      const { blockBase64Str, index } = item;
      const img = new Image();
      img.src = `data:img/png;base64,${blockBase64Str}`;
      const x = tileWidth * (index % tilesX);
      const y = tileHeight * Math.floor(index / tilesX);

      return { img, x, y };
    });
  }, [tileData]);

  const drawTiles = (context: CanvasRenderingContext2D) => {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    imgCache.forEach((item) => {
      const { x, y, img } = item;

      if (img.complete) {
        context.drawImage(
          img,
          x * zoomLevel + viewport.x,
          y * zoomLevel + viewport.y,
          tileWidth * zoomLevel,
          tileHeight * zoomLevel
        );
      } else {
        img.onload = () => {
          context.drawImage(
            img,
            x * zoomLevel + viewport.x,
            y * zoomLevel + viewport.y,
            tileWidth * zoomLevel,
            tileHeight * zoomLevel
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
        setViewport((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));

        lastPosition.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const getVisibleTileIndexes = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    canvasWidth: number,
    canvasHeight: number,
    scaledTileWidth: number,
    scaledTileHeight: number,
    tilesX: number,
    tilesY: number
  ) => {
    const visIndex: number[] = [];

    // 计算开始的瓦片索引
    const startXIndex = Math.max(0, Math.floor(-startX / scaledTileWidth));
    const startYIndex = Math.max(0, Math.floor(-startY / scaledTileHeight));

    // 计算结束的瓦片索引
    const endXIndex = Math.min(
      tilesX,
      Math.ceil((endX - startX) / scaledTileWidth)
    );
    const endYIndex = Math.min(
      tilesY,
      Math.ceil((endY - startY) / scaledTileHeight)
    );

    // 遍历可视区域中的瓦片索引
    for (let x = startXIndex; x < endXIndex; x++) {
      for (let y = startYIndex; y < endYIndex; y++) {
        visIndex.push(y * tilesX + x);
      }
    }

    return visIndex;
  };

  const calculateImageVisibleArea = () => {
    const canvasWidth = canvasSize.width as number;
    const canvasHeight = canvasSize.height as number;

    // 计算每个瓦片的缩放后的尺寸
    const scaledTileWidth = tileSize.width * zoomLevel;
    const scaledMapWidth = scaledTileWidth * tilesX;
    const scaledTileHeight = tileSize.height * zoomLevel;
    const scaledMapHeight = scaledTileHeight * tilesY;

    const startX = viewport.x;
    const startY = viewport.y;

    const endX = viewport.x + scaledMapWidth;
    const endY = viewport.y + scaledMapHeight;
    console.log("startX:", startX, "startY:", startY);

    const visIndex = new Array();
    let x1, y1, x2, y2;

    if (
      startX <= canvasWidth &&
      startY <= canvasWidth &&
      endX >= 0 &&
      endY >= 0
    ) {
      if (startX < 0) {
        if (startY < 0) {
          x1 = Math.floor(-startX / scaledTileWidth);
          y1 = Math.floor(-startY / scaledTileHeight);
          x2 = tilesX;
          y2 = tilesY;
        } else if (startY >= 0 && endY <= canvasHeight) {
          x1 = Math.floor(-startX / scaledTileWidth);
          y1 = 0;
          x2 = tilesX;
          y2 = tilesY;
        } else if (startY >= 0 && endY > canvasHeight) {
          x1 = Math.floor(-startX / scaledTileWidth);
          y1 = 0;
          x2 = tilesX;
          y2 = Math.ceil((canvasHeight - startY) / scaledTileHeight);
        }
      } else if (startX >= 0 && endX <= canvasWidth) {
        if (startY < 0) {
          x1 = 0;
          y1 = Math.floor(-startY / scaledTileHeight);
          x2 = tilesX;
          y2 = tilesY;
        } else if (startY >= 0 && endY <= canvasHeight) {
          x1 = 0;
          y1 = 0;
          x2 = tilesX;
          y2 = tilesY;
        } else if (startY >= 0 && endY > canvasHeight) {
          x1 = 0;
          y1 = 0;
          x2 = tilesX;
          y2 = Math.ceil((canvasHeight - startY) / scaledTileHeight);
        }
      } else {
        if (startY < 0) {
          x1 = 0;
          y1 = Math.floor(-startY / scaledTileHeight);
          x2 = Math.ceil((canvasWidth - startX) / scaledTileWidth);
          y2 = tilesY;
        } else if (startY >= 0 && endY <= canvasHeight) {
          x1 = 0;
          y1 = 0;
          x2 = Math.ceil((canvasWidth - startX) / scaledTileWidth);
          y2 = tilesY;
        } else {
          x1 = 0;
          y1 = 0;
          x2 = Math.ceil((canvasWidth - startX) / scaledTileWidth);
          y2 = Math.ceil((canvasHeight - startY) / scaledTileHeight);
        }
      }
    }

    for (let x = x1; x < x2; x++) {
      for (let y = y1; y < y2; y++) {
        visIndex.push(y * tilesX + x);
      }
    }

    return visIndex;
  };

  const getVisibleTiles = () => {
    const canvasWidth = canvasSize.width as number;
    const canvasHeight = canvasSize.height as number;

    // 计算每个瓦片的缩放后的尺寸
    const scaledTileWidth = tileSize.width * zoomLevel;
    const scaledTileHeight = tileSize.height * zoomLevel;

    // 计算可视区域的瓦片的起始行列
    const startX = Math.max(0, Math.floor(viewport.x / scaledTileWidth)); // 起始行
    const startY = Math.max(0, Math.floor(viewport.y / scaledTileHeight)); // 起始列

    // 计算可视区域的瓦片的结束行列
    const endX = Math.min(
      Math.floor((canvasWidth + viewport.x) / scaledTileWidth),
      Math.floor(tileData.length / tilesX) // 根据瓦片总数限制结束位置
    ); // 结束行

    const endY = Math.min(
      Math.floor((canvasHeight + viewport.y) / scaledTileHeight),
      Math.floor(tileData.length / tilesX) // 根据瓦片总数限制结束位置
    ); // 结束列

    const visibleTiles = new Array();

    // 遍历瓦片数据，判断哪些瓦片在当前视口内
    for (let row = startY; row <= endY; row++) {
      for (let col = startX; col <= endX; col++) {
        const index = row * tilesX + col; // 计算每个瓦片在 tileData 中的索引
        const tile = tileData[index];

        if (tile) {
          visibleTiles.push({ index, tileData: tile, row, col });
        }
      }
    }

    return visibleTiles;
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
    const newZoomLevel = Math.max(0.1, Math.min(100, zoomLevel * zoomFactor));

    // 计算缩放后的偏移量
    const zoomRatio = newZoomLevel / zoomLevel;

    const newViewportX = viewport.x - (mouseX - viewport.x) * (zoomRatio - 1);
    const newViewportY = viewport.y - (mouseY - viewport.y) * (zoomRatio - 1);

    // 更新缩放和视口位置
    setZoomLevel(newZoomLevel);

    const newViewPort = { x: newViewportX, y: newViewportY };

    setViewport(newViewPort);

    handlewheel?.({
      zoomLevel: newZoomLevel,
      viewPort: { x: newViewportX, y: newViewportY },
      type: "Wheel",
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
  }, []);

  const handleClick: React.MouseEventHandler<HTMLCanvasElement> = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect() as DOMRect;
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    onTileClick?.({
      type: "Click",
      x: clickX,
      y: clickY,
      viewPort: viewport,
      zoomLevel: zoomLevel,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (context) {
      drawTiles(context);

      console.log("vis", calculateImageVisibleArea());
    }
  }, [tileData, zoomLevel, viewport]);

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
