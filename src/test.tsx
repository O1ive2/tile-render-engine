import ReactDOM from "react-dom/client";
import Gaia from "./index";
import React, { useEffect, useRef, useState } from "react";
import { TileDataProps, TileMapEventInfo } from "./interface";

const Home = () => {
  const [data, setData] = useState<TileDataProps[]>();
  const level = useRef(1);
  useEffect(() => {
    fetchAllData("/data_4.json");
  }, []);

  const fetchAllData = async (path: string) => {
    try {
      const res = await (await fetch(path)).json();
      setData(res.blocks);
    } catch (e) {
      console.log("error");
    }
  };

  const fetchData = async (indexList: number[], level: number) => {
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
      setData(res.blocks);
    } catch (e) {
      console.log("error");
    }
  };

  const onTileClick = (event: TileMapEventInfo) => {
    fetchData(
      event.visibleIndexList as number[],
      event.curResolution as number
    );
  };

  const onDragMove = (event: TileMapEventInfo) => {
    fetchData(
      event.visibleIndexList as number[],
      event.curResolution as number
    );
  };

  const visbleTilesWatcher = (list: number[]) => {
    // console.log("vis", list);
  };

  const handlewheel = (event: TileMapEventInfo) => {
    console.log("wheelzoomlevel", event);
    fetchData(
      event.visibleIndexList as number[],
      event.curResolution as number
    );
  };

  return (
    <div className="home">
      {data ? (
        <Gaia
          tileData={data}
          incrementalLoad={true}
          onDragMove={onDragMove}
          onTileClick={onTileClick}
          handlewheel={handlewheel}
          tileConfig={{
            tileSwitchLevel: 4,
            tilesNumPerResolution: [
              { x: 2, y: 2 },
              { x: 8, y: 8 },
              { x: 32, y: 32 },
            ],
          }}
          canvasSize={{ width: 1000, height: 1000 }}
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
