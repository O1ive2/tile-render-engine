import ReactDOM from "react-dom/client";
import Gaia from "./index";
import React, { useEffect, useState } from "react";
import { Location, TileDataProps, TileMapEventInfo } from "./interface";

const Home = () => {
  const [data, setData] = useState<TileDataProps[]>();
  useEffect(() => {
    fetchData([0, 1, 2, 3], 1);
  }, []);

  const fetchData = async (indexList: number[], level: number) => {
    try {
      const res = await (
        await fetch(`http://192.168.100.140:8080/initialRender`, {
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

  const fetchClickData = async (level: number, coordinate: Location) => {
    try {
      const res = await (
        await fetch(`http://192.168.100.140:8080/handleClick`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientX: coordinate.x,
            clientY: coordinate.y,
            level: level,
          }),
        })
      ).json();
      setData(res.blocks);
    } catch (e) {
      console.log("error");
    }
  };

  const handleClick = (event: TileMapEventInfo) => {
    console.log("click", event.mouseInfo?.coordinateInTile);
    fetchClickData(
      event.curResolution + 1,
      event.mouseInfo?.coordinateInTile as Location
    );
  };

  const onDragMove = (event: TileMapEventInfo) => {
    fetchData(
      event.visibleIndexList as number[],
      (event.curResolution as number) + 1
    );
  };

  const handlewheel = (event: TileMapEventInfo) => {
    console.log("wheelzoomlevel", event);
    fetchData(
      event.visibleIndexList as number[],
      (event.curResolution as number) + 1
    );

    // if (event.curResolution === 0) {
    //   fetchAllData("/data_4.json");
    // } else if (event.curResolution === 1) {
    //   fetchAllData("/data_64.json");
    // } else {
    //   fetchAllData("/data_1024.json");
    // }
  };

  return (
    <div className="home">
      {data ? (
        <Gaia
          enableCache={true}
          tileData={data}
          onDragMove={onDragMove}
          handleClick={handleClick}
          handlewheel={handlewheel}
          tileConfig={{
            tileSwitchLevel: 4,
            tilesNumPerResolution: [
              { x: 2, y: 2 },
              { x: 8, y: 8 },
              { x: 32, y: 32 },
            ],
          }}
          canvasSize={{ width: 1000, height: 600 }}
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
