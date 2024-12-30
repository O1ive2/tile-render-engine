import ReactDOM from "react-dom/client";
import Gaia from "./index";
import React, { useEffect, useState } from "react";
import { TileDataProps, TileMapEventInfo } from "./interface";

const Home = () => {
  const [data, setData] = useState<TileDataProps[]>();
  const [level, setLevel] = useState<number>(0);
  useEffect(() => {
    fetchData("/data_4.json");
  }, []);
  const fetchData = async (path: string) => {
    try {
      const res = await (await fetch(path)).json();
      setData(res.blocks);
    } catch (e) {
      console.log("error");
    }
  };

  const onTileClick = (coords: { x: number; y: number }) =>
    console.log("click", coords);
  const handlewheel = (event: TileMapEventInfo) => {
    const { zoomLevel } = event;
    console.log("wheelzoomlevel", zoomLevel);

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
    <>
      {data ? (
        <Gaia
          tileData={data}
          onTileClick={onTileClick}
          handlewheel={handlewheel}
          tileWidth={131}
          tileSwitchThreshold={4}
          tileHeight={72}
          width={5000}
          height={5000}
        />
      ) : (
        <></>
      )}
    </>
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
