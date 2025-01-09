import ReactDOM from "react-dom/client";
import Gaia from "./index";
import React, { useEffect, useState } from "react";
import { TileDataProps, TileMapEventInfo } from "./interface";

const Home = () => {
  const [data, setData] = useState<TileDataProps[]>();
  const [level, setLevel] = useState<number>(0);
  const [tilesLen, setTilesLen] = useState(0);
  useEffect(() => {
    fetchAllData("/data_4.json");
  }, []);

  const fetchAllData = async (path: string) => {
    try {
      const res = await (await fetch(path)).json();
      setData(res.blocks);
      setTilesLen(Math.floor(Math.sqrt(res.blocks.length)));
    } catch (e) {
      console.log("error");
    }
  };

  const fetchData = async (indexList: number[], level: number, len: number) => {
    try {
      const res = await (
        await fetch(`http://192.168.15.92:3008/getBlocks`, {
          method: "post",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            indexList: indexList,
            level: level,
          }),
        })
      ).json();
      console.log("res", res);
      setData(res.blocks);
      setTilesLen(len);
    } catch (e) {
      console.log("error");
    }
  };

  const onTileClick = (event: TileMapEventInfo) => {
    fetchData(event.visibleIndexList as number[], level + 1, 2);
  };

  const onDragMove = (event: TileMapEventInfo) => {
    console.log("drag", event);
  };

  const visbleTilesWatcher = (list: number[]) => {
    console.log("vis", list);
  };

  const handlewheel = (event: TileMapEventInfo) => {
    const { zoomLevel } = event;
    console.log("wheelzoomlevel", event);

    if (zoomLevel && zoomLevel < 0.25) {
      if (level === 1) {
        fetchData(event.visibleIndexList as number[], level - 1, 2).then(() => {
          setLevel(0);
        });
      } else if (level === 2) {
        fetchData(event.visibleIndexList as number[], level - 1, 8).then(() => {
          setLevel(1);
        });
      }
    } else if (zoomLevel && zoomLevel >= 4) {
      if (level === 0) {
        fetchData(event.visibleIndexList as number[], level + 1, 8).then(() => {
          setLevel(1);
        });
      } else if (level === 1) {
        fetchData(event.visibleIndexList as number[], level + 1, 32).then(
          () => {
            setLevel(2);
          }
        );
      }
    }
  };

  return (
    <div className="home">
      {data ? (
        <Gaia
          tileData={data}
          dynamicLoad={true}
          tilesX={tilesLen}
          tilesY={tilesLen}
          onDragMove={onDragMove}
          onTileClick={onTileClick}
          handlewheel={handlewheel}
          tileSize={{ width: 131, height: 72 }}
          tileSwitchLevel={4}
          canvasSize={{ width: 600, height: 600 }}
          visbleTilesWatcher={visbleTilesWatcher}
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
