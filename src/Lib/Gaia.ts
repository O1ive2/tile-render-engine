import { ISpriteImageProperty, ISpriteProperty, ISpriteSvgProperty } from '../Type/Geometry.type';
import Paint from './Paint';
import RenderWorker from './RenderWorker';

class Gaia {
  private workers: number;
  private renderWorkerList: Array<RenderWorker>;

  private spriteNameIdMap: Map<string, number> = new Map();
  private spriteIdImageMap: Map<number, ISpriteImageProperty> = new Map();
  private spriteIdSvgMap: Map<number, ISpriteSvgProperty> = new Map();

  private paintMap: Map<string, Paint> = new Map([]);

  constructor({ workers = 8 }) {
    this.workers = workers;
    this.renderWorkerList = Array.from({ length: 8 }, () => new RenderWorker(this));
  }

  public getProperty() {
    return {
      workers: this.workers,
      renderWorkerList: this.renderWorkerList,
      spriteNameIdMap: this.spriteNameIdMap,
      spriteIdImageMap: this.spriteIdImageMap,
      spriteIdSvgMap: this.spriteIdSvgMap,
    };
  }

  public createPaint(id: string): Paint {
    const paint = new Paint(this, id);
    this.paintMap.set(id, paint);
    return paint;
  }

  public loadSprite(sprite: ISpriteProperty): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      for (let key in sprite) {
        const { width, height, renderingWidth, renderingHeight, svgPaths, svgPolygons } =
          sprite[key];
        // image
        // const img = new Image();
        // const hoverImg = new Image();
        // const checkImg = new Image();
        // this.spriteNameIdMap.set(key, i);
        // this.spriteIdImageMap.set(i, {
        //   img,
        //   hoverImg,
        //   checkImg,
        //   width,
        //   height,
        //   normalImgBase64,
        //   hoverImgBase64,
        //   checkedImgBase64,
        // });
        // img.src = normalImgBase64;
        // hoverImg.src = hoverImgBase64;
        // checkImg.src = checkedImgBase64;

        //svg
        this.spriteNameIdMap.set(key, i);
        this.spriteIdSvgMap.set(i, {
          width,
          height,
          renderingWidth,
          renderingHeight,
          svgPaths,
          svgPolygons,
        });
        i++;
      }

      // svg
      const svgHash: ISpriteProperty = {};
      for (const [
        key,
        { width, height, renderingWidth, renderingHeight, svgPaths, svgPolygons },
      ] of this.spriteIdSvgMap) {
        svgHash[key] = {
          width,
          height,
          renderingWidth,
          renderingHeight,
          svgPaths,
          svgPolygons,
        };
      }

      const textEncoder = new TextEncoder();
      const encodedData = textEncoder.encode(JSON.stringify(svgHash));
      const sharedSvgMap = new Uint8Array(new SharedArrayBuffer(encodedData.length));
      sharedSvgMap.set(encodedData);

      Promise.all(
        this.renderWorkerList.map((renderWorker) => renderWorker.init(sharedSvgMap)),
      ).then(() => resolve());

      // image
      // const imageHash: ISpriteProperty = {};
      // for (const [key, { width, height, normalImgBase64, hoverImgBase64, checkedImgBase64 }] of this
      //   .spriteIdImageMap) {
      //   imageHash[key] = {
      //     width,
      //     height,
      //     normalImgBase64,
      //     hoverImgBase64,
      //     checkedImgBase64,
      //   };
      // }

      // const textEncoder = new TextEncoder();
      // const encodedData = textEncoder.encode(JSON.stringify(imageHash));
      // const sharedImageMap = new Uint8Array(new SharedArrayBuffer(encodedData.length));
      // sharedImageMap.set(encodedData);

      // Promise.all(
      //   this.renderWorkerList.map((renderWorker) => renderWorker.init(sharedImageMap)),
      // ).then(() => resolve());
    });
  }

  public static init({
    workers = 8,
    sprite,
  }: {
    workers: number;
    sprite: ISpriteProperty;
  }): Promise<Gaia> {
    return new Promise((resolve) => {
      const gaia = new Gaia({ workers });
      gaia.loadSprite(sprite).then(() => resolve(gaia));
    });
  }
}

export default Gaia;
