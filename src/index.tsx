import { useState, useEffect, useRef, useMemo } from "react";
import { TileMapProps } from "./interface";
import React from "react";
import { init } from "./test";

const TileMap: React.FC<TileMapProps> = ({
  tileData,
  onTileClick,
  handlewheel,
  tileWidth,
  tileHeight,
  width = 200,
  height = 200,
}) => {
  const canvasRef = useRef<null | HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);

  const imgCache = useMemo(() => {
    const sideLen = Math.floor(Math.sqrt(tileData.length));

    return tileData.map((item) => {
      const { blockBase64Str, index } = item;
      const img = new Image();
      img.src = `data:img/png;base64,${blockBase64Str}`;
      const x = tileWidth * (index % sideLen);
      const y = tileHeight * Math.floor(index / sideLen);

      return { img, x, y };
    });
  }, [tileData]);

  const drawTiles = (context: CanvasRenderingContext2D) => {
    console.log("draw");
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    imgCache.forEach((item) => {
      const { x, y, img } = item;

      if (img.complete) {
        context.drawImage(
          img,
          x * zoomLevel + viewport.x,
          y * zoomLevel + viewport.y,
          img.width * zoomLevel,
          img.height * zoomLevel
        );
      } else {
        img.onload = () => {
          context.drawImage(
            img,
            x * zoomLevel + viewport.x,
            y * zoomLevel + viewport.y,
            img.width * zoomLevel,
            img.height * zoomLevel
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

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setViewport({ x: viewport.x + dx, y: viewport.y + dy });
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

    handlewheel?.(newZoomLevel);
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
    onTileClick?.({ x: clickX, y: clickY });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (context) {
      requestAnimationFrame(() => drawTiles(context));
    }
  }, [tileData, zoomLevel, viewport]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  );
};

init();

export default TileMap;
