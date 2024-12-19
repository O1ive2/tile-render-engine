import ReactDOM from "react-dom/client";
import TileMap from "./index";
import React from "react";

export const init = async () => {
  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  const fetchData = async () => {
    try {
      const res = await fetch("/data.json");
      const data = await res.json();
      return data.blocks;
    } catch (e) {
      console.log("error");
    }
  };
  const data = await fetchData();

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
};
