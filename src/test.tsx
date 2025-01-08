import ReactDOM from "react-dom/client";
import Gaia from "./index";
import React, { useEffect, useState } from "react";
import { TileDataProps, TileMapEventInfo } from "./interface";

const Home = () => {
  const [data, setData] = useState<TileDataProps[]>();
  const [level, setLevel] = useState<number>(0);
  const [tilesLen, setTilesLen] = useState(0);
  useEffect(() => {
    fetchData("/data_4.json");
  }, []);
  const fetchData = async (path: string) => {
    try {
      const res = await (await fetch(path)).json();
      setData(res.blocks);
      setTilesLen(Math.floor(Math.sqrt(res.blocks.length)));
    } catch (e) {
      console.log("error");
    }
  };

  const onTileClick = (event: TileMapEventInfo) => {
    console.log("click", event);
  };

  const handlewheel = (event: TileMapEventInfo) => {
    const { zoomLevel } = event;
    console.log("wheelzoomlevel", event);

    if (zoomLevel && zoomLevel < 0.25) {
      if (level === 1) {
        fetchData("/data_4.json").then(() => {
          setLevel(0);
        });
      } else if (level === 2) {
        fetchData("/data_64.json").then(() => {
          setLevel(1);
        });
      }
    } else if (zoomLevel && zoomLevel >= 4) {
      if (level === 0) {
        fetchData("/data_64.json").then(() => {
          setLevel(1);
        });
      } else if (level === 1) {
        fetchData("/data_1024.json").then(() => {
          setLevel(2);
        });
      }
    }
  };

  return (
    <div className="home">
      {data ? (
        <Gaia
          tileData={data}
          tilesX={tilesLen}
          handlewheel={handlewheel}
          tileSize={{ width: 131, height: 72 }}
          tileSwitchLevel={4}
          canvasSize={{ width: 600, height: 600 }}
        />
      ) : (
        <></>
      )}
    </div>
  );
};

export const init = async () => {
  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <Home></Home>
    </React.StrictMode>
  );
};
