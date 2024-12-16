import { useState, useEffect, useRef, useMemo } from "react";
import { TileMapProps } from "./interface";
import React from "react";
import ReactDOM from "react-dom/client";

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
      const { base64, index } = item;
      const img = new Image();
      img.src = `data:img/png;base64,${base64}`;
      const x = tileWidth*(index % sideLen);
      const y = tileHeight*(Math.floor(index/sideLen));

      return { img, x, y };
    });
  }, [tileData]);

  // 加载瓦片并渲染
  const drawTiles = (context: CanvasRenderingContext2D) => {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // 清空画布

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
      console.log("draw");
      drawTiles(context);
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

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const data = [
  {
    base64: "iVBORw0KGgoAAAANSUhEUgAAAIMAAABICAIAAABa0NFGAAAABmJLR0QA/wD/AP+gvaeTAAAB1klEQVR4nO3cz00CQRiH4W+MBRgacAvwwNEDyQ4nb7YABxugApcObGELMLGEoROOXq1gPbiRPxnIwO7AT/d9wgEXNCOvLDOTja5pGoOAm2sPAC1KqKCECkqooISK21O/wXtbrXKMZOjcqbNY54x5bw6cnVRQQgUlVFBCxclzpz1MpfrSde7EVKovnJ1UUEIFJVRQQgUlVFBCBSVUpK7sQrAQ2vtVtfPQ3pfXEdbVqq7Kmfni2kM5U+p7YjrNOgwkr7F/19KssTPhc0IFJVRQQgUlVFBCBSVUxEqEtYX1pQcyeLE19rR+sef3u2L72Gh0mfEMV6xEeT//+nyY7RxbLDa7Gux25BArEeYTs8nusfF4s++EHLiiQAVzJxWUUEEJFZRQQQkVlFBBCRWUUBFbY7vlmz1+lE/bx4rCiqK9z27Hebw37w8+mvqeqOteBjNox6+P4dqOyzn+WvE5oYISKiihghIqKKGCEioooYISKrr+j4IIt+z/Z4prXlOeVZbm3MFHM5Sw1JH9E8l/eccvjuHspIISKiihghIqKKGCEioooYISKiihghIqupb42UvZvlXm+xjYn1GZ33sFzrx1vLYj9tTl4Pad+vh9OTupoIQKSqighIpvctduWGTJHVUAAAAASUVORK5CYII=",
    index: 0
  },
  {
    base64: "iVBORw0KGgoAAAANSUhEUgAAAIMAAABICAIAAABa0NFGAAAABmJLR0QA/wD/AP+gvaeTAAABcElEQVR4nO3cQW6DMBQA0f8R9zI5Wc3NuBndVFVXtSEOmZZ5yi4RchgwyEHJfd9DANO7B6AvlqCwBIUlKCxBkRHeO71cKbFtjc/M3sReILP9GWcnCktQWILCEhRzz8VE5/TcMn3z3umFDh3lzk4UlqCwBIUlKOZhW8p12Kb+iv1j4MbGlYjBI6MbfeQ5O1HMtf729rLEslwykNtrnBOPxzXDUDTOifV+l+F38TpBYQkKS1BYgsISFJagaJQoJTK7XjWWSwb8bzXWnfp//IvcIspTY7m36cC+1itNrmdAeMWmsASFJSgsQWEJCktQWILCEhRT/8qS604/1Via+6QcWf3JYf8Wkevtnnfq/r6Z0dzNzk4UlqCwBIUlKCxBYQkKS1BYgsISFJagmIYsOt1w3Wm4cf9R4PNOz3F2orAEhSUoLEFhCQpLUFiCwhIUlqCwBIXrTif1PO906MEn151OqrHVfeT3dXaisASFJSgsQfEJ3h4y6zeyPZkAAAAASUVORK5CYII=",
      index: 1
  },
  {
    base64: "iVBORw0KGgoAAAANSUhEUgAAAIMAAABICAIAAABa0NFGAAAABmJLR0QA/wD/AP+gvaeTAAABXklEQVR4nO3cQQ6CMBQA0dZ4L3szy8nUk+HCxBXU0lIywXlhYYQQcIKQvyDO8xwqxBg+G34/rG86hfles8+T2Ol8L/270C4sQWEJCktQWIJic4nbLcRYWnJIA46TK4dU/kFql61PsRWb+hTbwn8nCktQWILCEhSWoLAEhSUoLEFhCQpLUNSW+Dlucu500NxpA+dOTfx3orAEhSUoLEFhCQpLUFiCwhIUlqBYKpGfIT+PPpC/t1RieuUpNs9PnDvtN3f6XBA5NR6ac6cm14Xvmhuog3dsCktQWILCEhSWoLAEhSUoLEHh3InCuVMv504Yzp1Oxjs2hSUoLEFhCQpLUFiCwhIUlqBw7kTh3KlX/dwppdJ+nDt1qz7fWHxHlnMnCu/YFJagsASFJSgsQWEJiqWnWA2T8+oqr4njPB6ltV4Tx0mpNPAYUyJOQ3Z7agPe76Qm3icoLEFhCQpLULwBqUFae59ZdwgAAAAASUVORK5CYII=",
      index: 2
  },
  {
    base64: "iVBORw0KGgoAAAANSUhEUgAAAIMAAABICAIAAABa0NFGAAAABmJLR0QA/wD/AP+gvaeTAAABV0lEQVR4nO3cwXGDMBBA0V2GQtKJ1UlKQZTiSix34k6Uc/ApoBk+8X/jEweN4I/B3gPZe48hco2+jFnqEkaf7zRwLR1hCQpLUFiCwhIUU2YM+dQoZ5/Ltc2jfsRGtojboLU+kXcnCktQWILCEhSWoLAEhSUoLEFhCQpLnKG2qG1zzLnTTjXK/mu1ZqzPzYLOnXaq0Wrfe761v1+r+eiOtEMt78d8TlBYgsISFJagsASFJSgsQWEJCktQOHeicO5E4d2JwhIUlqCwBIUlKCxBYQkKS1BYgsISFHMp0dqgxXIdtNAnyohh74vQEd6dKCxBYQkKS1BYgsISFJagsARFRvTluq/va6/6vNfbd5Svs7fyB2W9l3htXiM4PR5n7Ue/pLMOCJ8TFJagsASFJSgsQWEJCktQWIIil+XK/+z+07TjrN1ow2kHhd8JCktQWILCEhSWoLAExQ9ApkFzinEERwAAAABJRU5ErkJggg==",
      index: 3
  }
];

const onTileClick = (coords: { x: number; y: number }) =>
  console.log("click", coords);
const handlewheel = (newViewport: number) =>
  console.log("222212", newViewport);

root.render(
  <React.StrictMode>
    <TileMap
      tileData={data}
      onTileClick={onTileClick}
      handlewheel={handlewheel}
      tileWidth={131}
      tileHeight={72}
      width={1000}
      height={1000}
    />
  </React.StrictMode>
);

export default TileMap;
