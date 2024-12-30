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

  useLayoutEffect(() => {
    // 修复偏移值
    if (zoomLevel > tileSwitchLevel) {
      setZoomLevel((i) => i / tileSwitchLevel);
    } else if (zoomLevel < 1 / tileSwitchLevel) {
      setZoomLevel((i) => i / (1 / tileSwitchLevel));
    }
  }, [tileData]);

  const imgCache = useMemo(() => {
    const sideLen = Math.floor(Math.sqrt(tileData.length));

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

    setViewport({ x: newViewportX, y: newViewportY });

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

export default Gaia;
