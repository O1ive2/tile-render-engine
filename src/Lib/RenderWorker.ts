import Gaia from './Gaia';
import Paint from './Paint';
import Publisher from './Publisher';
import { RenderingState } from './Region';

export default class RenderWorker {
  private gaia: Gaia;
  private isBusy = false;
  private isInitialized = false;
  private publisher: Publisher = new Publisher();

  private worker: Worker;

  constructor(gaia: Gaia) {
    this.gaia = gaia;

    const blob_str = new Blob(
      [
        `
          const render = ${this.passRender()}
          const rerender = ${this.passReRender()}

          const imageMap = new Map();
          const svgMap = new Map();
          const shared = new Map();

          const textDecoder = new TextDecoder();
  
          self.onmessage = async (e) => {
            if(e.data.type === 'init') {
              // image
              // const imageMapStr = e.data.sharedImageMap;

              // const sharedImageMapData = new Uint8Array(imageMapStr);
              // const sharedImageMap = JSON.parse(textDecoder.decode(sharedImageMapData));

              // for(let key in sharedImageMap) {
              //   const {width,height,normalImgBase64,hoverImgBase64,checkedImgBase64} = sharedImageMap[key];
              //   imageMap.set(Number(key),{
              //     width,
              //     height,
              //     img:await parseImage(normalImgBase64),
              //     hoverImg:await parseImage(hoverImgBase64),
              //     checkImg:await parseImage(checkedImgBase64)
              //   });
              // }

              // svg
              const svgMapStr = e.data.sharedSvgMap;
  
              const sharedSvgMapData = new Uint8Array(svgMapStr);
              const sharedSvgMap = JSON.parse(textDecoder.decode(sharedSvgMapData));

              for(let key in sharedSvgMap) {
                const {width,height,renderingWidth,renderingHeight,svgSolidPaths,svgSolidPolygons,svgDashedPaths,svgDashedPolygons} = sharedSvgMap[key];
                svgMap.set(Number(key),{
                  width,
                  height,
                  renderingWidth,
                  renderingHeight,
                  svgSolidPaths,
                  svgSolidPolygons,
                  svgDashedPaths,
                  svgDashedPolygons
                });
              }
  
              self.postMessage({
                type: 'init'
              });

            } else if (e.data.type === 'decode_shared') {
                
              const sharedData = e.data.shared;

              sharedData.rect.other = JSON.parse(textDecoder.decode(new Uint8Array(sharedData.rect.other)));
              sharedData.text.other = JSON.parse(textDecoder.decode(new Uint8Array(sharedData.text.other)));
              sharedData.path.other = JSON.parse(textDecoder.decode(new Uint8Array(sharedData.path.other)));
              sharedData.svg.other = JSON.parse(textDecoder.decode(new Uint8Array(sharedData.svg.other)));
              shared.set(e.data.id,sharedData);

              self.postMessage({
                type: 'decode_shared',
                id: e.data.id
              });

            } else if(e.data.type === 'render') {
              const width = e.data.width;
              const height = e.data.height;
              const offsetX = e.data.offsetX;
              const offsetY = e.data.offsetY;
              const idList = e.data.idList;
              const typeList = e.data.typeList;
              const highlightList = e.data.highlightList;
              const realPieceToRenderingScale = e.data.realPieceToRenderingScale;

              const level = e.data.level;
              const pieceIndex = e.data.pieceIndex;
  
              const canvas = new OffscreenCanvas(width*2,height*2); 
              const ctx = canvas.getContext('2d',{
                willReadFrequently: true,
              });
  
  
              ctx.save();
              ctx.rect(0,0,canvas.width,canvas.height);
              ctx.clip();
  
              render(ctx,width,height,shared.get(e.data.id),idList,typeList,highlightList,imageMap,svgMap,offsetX,offsetY,realPieceToRenderingScale);
              
              ctx.restore();
  
              const transferCanvas = new OffscreenCanvas(canvas.width,canvas.height); 
              const transferCtx = transferCanvas.getContext("2d");
  
              transferCtx.drawImage(canvas,0,0);
              
              self.postMessage({
                type: "render",
                level,
                pieceIndex,
                image: transferCanvas.transferToImageBitmap()
              });
              
            } else if(e.data.type === 'rerender') {
              const offsetX = e.data.offsetX;
              const offsetY = e.data.offsetY;
              const idList = e.data.idList;
              const typeList = e.data.typeList;
              const reRenderList = e.data.reRenderList;
              const highlightList = e.data.highlightList;
              const realPieceToRenderingScale = e.data.realPieceToRenderingScale;
              const image = e.data.image;
  
              const level = e.data.level;
              const pieceIndex = e.data.pieceIndex;
  
  
              const canvas = new OffscreenCanvas(image.width,image.height); 
              const ctx = canvas.getContext('2d',{
                willReadFrequently: true,
              });
  
  
              ctx.save();
              ctx.rect(0,0,canvas.width,canvas.height);
              ctx.clip();
  
              ctx.drawImage(image,0,0);

              rerender(ctx,shared.get(e.data.id),idList,typeList,reRenderList,highlightList,imageMap,svgMap,offsetX,offsetY,realPieceToRenderingScale);
  
              ctx.restore();
  
              const transferCanvas = new OffscreenCanvas(canvas.width,canvas.height); 
              const transferCtx = transferCanvas.getContext("2d");
  
              transferCtx.drawImage(canvas,0,0);
  
              self.postMessage({
                type: "rerender",
                level,
                pieceIndex,
                image: transferCanvas.transferToImageBitmap()
              });
  
            }
            
          };
          `,
      ],
      { type: 'text/javascript' },
    );

    this.worker = new Worker(URL.createObjectURL(blob_str));
  }

  public init(sharedSvgMap: Uint8Array): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.isInitialized) {
        console.error("Can't init twice!");
        return reject();
      }

      this.worker.onmessage = (e) => {
        if (e.data.type === 'init') {
          this.isInitialized = true;
          resolve();
        } else if (e.data.type === 'decode_shared') {
          this.publisher.publish({
            type: 'decode_shared',
            id: e.data.id,
          });
        } else if (e.data.type === 'render') {
          this.publisher.publish({
            type: 'render',
            level: e.data.level,
            pieceIndex: e.data.pieceIndex,
            image: e.data.image,
          });
        } else if (e.data.type === 'rerender') {
          this.publisher.publish({
            type: 'rerender',
            level: e.data.level,
            pieceIndex: e.data.pieceIndex,
            image: e.data.image,
          });
        }
      };

      this.worker.postMessage({
        type: 'init',
        sharedSvgMap,
      });
    });
  }

  public decodeShared(id: string, shared: any): Promise<void> {
    return new Promise((resolve) => {
      const cb = (data: any) => {
        if (data.type === 'decode_shared') {
          if (id === data.id) {
            resolve();
            this.publisher.unsubscribe(cb);
          }
        }
      };

      this.publisher.subscribe(cb);

      this.worker.postMessage({
        type: 'decode_shared',
        id,
        shared,
      });
    });
  }

  public passRender = () => {
    return (
      ctx: OffscreenCanvasRenderingContext2D,
      width: number,
      height: number,
      shared: any,
      idList: any,
      typeList: any,
      highlightList: any,
      imageMap: any,
      svgMap: any,
      offsetX: number,
      offsetY: number,
      realPieceToRenderingScale: number,
    ) => {
      // const now = Date.now();

      const sharedRect = shared.rect;
      const sharedText = shared.text;
      const sharedImage = shared.image;
      const sharedPath = shared.path;
      const sharedSvg = shared.svg;

      const globalLineCaps = ['butt', 'round', 'square'];

      // ctx.fillStyle = `rgba(${Math.floor(Math.random() * 256)},${Math.floor(
      //   Math.random() * 256,
      // )},${Math.floor(Math.random() * 256)})`;
      // ctx.fillRect(0, 0, 10000, 10000);

      // ctx.imageSmoothingEnabled = false;

      // ctx.fillRect(0, 0, width, height);

      ctx.save();

      ctx.scale(realPieceToRenderingScale * 2, realPieceToRenderingScale * 2);
      ctx.translate(-offsetX, -offsetY);

      for (let i = 0; i < idList.length; i++) {
        const id = idList[i];
        if (typeList[i] === 0) {
          const x = sharedRect.x[id];
          const y = sharedRect.y[id];
          const width = sharedRect.width[id];
          const height = sharedRect.height[id];
          const fillStyle = sharedRect.other[id].fillStyle || '';
          const strokeStyle = sharedRect.other[id].strokeStyle || '';
          const lineDash = sharedRect.other[id].lineDash || [];
          const lineWidth = sharedRect.lineWidth[id] || 1;
          const type = sharedRect.type[id] ?? 0;
          const alpha = sharedRect.alpha[id] ?? 1;
          const keepWidth = sharedRect.keepWidth[id] ?? 0;

          // const styleIndex = id * 256;
          // const encodedDataLength = sharedRect.style[styleIndex];
          // const encodedData = sharedRect.style.slice(
          //   styleIndex + 1,
          //   styleIndex + 1 + encodedDataLength,
          // );
          // const decodedStyle = textDecoder.decode(encodedData);
          // const style = {
          //   fillStyle: '',
          //   strokeStyle: '',
          // };

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.fillStyle = fillStyle || '';
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = keepWidth ? (lineWidth / realPieceToRenderingScale) * 2 : lineWidth;

          ctx.beginPath();
          ctx.rect(x, y, width, height);

          if (highlightList.data.get(0).has(id)) {
            // todo more property support
            const highlightProperty = highlightList.data.get(0).get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
              ctx.fillStyle = highlightProperty.fillStyle || ctx.fillStyle;
            }
          }

          if (type === 0) {
            ctx.fill();
          } else if (type === 1) {
            ctx.stroke();
          } else if (type === 2) {
            ctx.stroke();
            ctx.fill();
          } else if (type === 4) {
            ctx.stroke();
            ctx.fill();
          }

          ctx.closePath();
        } else if (typeList[i] === 1) {
          const x = sharedText.x[id];
          const y = sharedText.y[id];
          const fontSize = sharedText.fontSize[id];
          const content = sharedText.other[id].content || '';
          const fillStyle = sharedText.other[id].fillStyle || '';
          const alpha = sharedText.alpha[id] ?? 1;

          // direction?: 'ltr' | 'rtl' | 'inherit';

          ctx.globalAlpha = alpha;
          ctx.fillStyle = fillStyle || '#000';

          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(content, x, y);
        } else if (typeList[i] === 2) {
          const { width, height, img, hoverImg, checkImg } = imageMap.get(
            sharedImage.imageIndex[id],
          );
          const x = sharedImage.x[id];
          const y = sharedImage.y[id];
          const alpha = sharedImage.alpha[id] ?? 1;
          ctx.save();
          ctx.globalAlpha = alpha;
          let renderingImg = img;
          if (highlightList.data.get(2).has(id)) {
            // todo more property support
            const highlightProperty = highlightList.data.get(2).get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              if (highlightProperty.state === 'hover') {
                renderingImg = hoverImg;
              } else if (highlightProperty.state === 'check') {
                renderingImg = checkImg;
              } else {
                renderingImg = img;
              }
            }
          }
          ctx.drawImage(renderingImg, x, y, width, height);
          ctx.restore();
        } else if (typeList[i] === 3) {
          const fromX = sharedPath.fromX[id];
          const fromY = sharedPath.fromY[id];
          const toX = sharedPath.toX[id];
          const toY = sharedPath.toY[id];
          const lineCap = sharedPath.lineCap[id] ?? 0;
          const lineDash =
            sharedPath.other[id].lineDash?.map(
              (item: number) => item * realPieceToRenderingScale * 2,
            ) || [];
          const strokeStyle = sharedPath.other[id].strokeStyle || '';
          const alpha = sharedPath.alpha[id] ?? 1;
          const lineWidth = sharedPath.lineWidth[id] || 1;
          const keepWidth = sharedPath.keepWidth[id];

          ctx.save();

          // line 单独处理是因为当lineWidth特别小的时候，画布不显示
          ctx.translate(offsetX, offsetY);
          ctx.scale(1 / realPieceToRenderingScale / 2, 1 / realPieceToRenderingScale / 2);

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = keepWidth ? lineWidth * 4 : lineWidth * realPieceToRenderingScale * 2;
          ctx.lineCap = <CanvasLineCap>globalLineCaps[lineCap];

          if (highlightList.data.get(3).has(id)) {
            // todo more property support
            const highlightProperty = highlightList.data.get(3).get(id);
            if (highlightProperty) {
              ctx.lineWidth = keepWidth
                ? highlightProperty.lineWidth * 4 ?? ctx.lineWidth
                : highlightProperty.lineWidth
                ? ctx.lineWidth * realPieceToRenderingScale * 2
                : ctx.lineWidth;
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
              ctx.setLineDash(
                highlightProperty.lineDash?.map(
                  (item: number) => item * realPieceToRenderingScale * 2,
                ) || lineDash,
              );
            }
          }

          ctx.beginPath();
          ctx.moveTo(
            (fromX - offsetX) * realPieceToRenderingScale * 2,
            (fromY - offsetY) * realPieceToRenderingScale * 2,
          );
          ctx.lineTo(
            (toX - offsetX) * realPieceToRenderingScale * 2,
            (toY - offsetY) * realPieceToRenderingScale * 2,
          );
          ctx.stroke();
          ctx.closePath();

          ctx.restore();
        } else if (typeList[i] === 4) {
          const {
            width,
            height,
            renderingWidth,
            renderingHeight,
            svgSolidPaths,
            svgSolidPolygons,
            svgDashedPaths,
            svgDashedPolygons,
          } = svgMap.get(sharedSvg.svgIndex[id]);
          const x = sharedSvg.x[id];
          const y = sharedSvg.y[id];
          const alpha = sharedSvg.alpha[id] ?? 1;
          const fillStyle = sharedSvg.other[id].fillStyle || '';

          ctx.save();
          ctx.globalAlpha = alpha;

          const svgCanvas = new OffscreenCanvas(width, height);
          const svgCtx = svgCanvas.getContext('2d', {
            willReadFrequently: true,
          });

          let svgPaths = svgSolidPaths;
          let svgPolygons = svgSolidPolygons;

          if (svgCtx) {
            svgCtx.fillStyle = fillStyle || '';
            svgCtx.globalAlpha = alpha;
          }
          if (highlightList.data.get(4).has(id)) {
            const highlightProperty = highlightList.data.get(4).get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              if (svgCtx) {
                svgCtx.fillStyle = highlightProperty.fillStyle || svgCtx.fillStyle;
                svgCtx.globalAlpha = highlightProperty.alpha || svgCtx.globalAlpha;
              }
              if (highlightProperty.state === 'hover') {
                svgPaths = svgDashedPaths;
                svgPolygons = svgDashedPolygons;
                svgCtx?.clearRect(0, 0, svgCanvas.width, svgCanvas.height);
              }
            }
          }

          svgPaths.forEach((svgPath: string) => {
            svgCtx?.fill(new Path2D(svgPath));
          });

          svgPolygons.forEach((svgPolygon: string) => {
            const pointsArray = svgPolygon.split(' ').map(Number);
            const path = new Path2D();
            path.moveTo(pointsArray[0], pointsArray[1]);
            for (let i = 2; i < pointsArray.length; i += 2) {
              path.lineTo(pointsArray[i], pointsArray[i + 1]);
            }
            path.closePath();
            svgCtx?.fill(path);
          });

          ctx.drawImage(svgCanvas, x, y, renderingWidth, renderingHeight);

          ctx.restore();
        }
      }

      ctx.restore();

      // console.log(Date.now() - now + 'ms');

      // console.log('------------');
    };
  };

  public passReRender = () => {
    return (
      ctx: OffscreenCanvasRenderingContext2D,
      shared: any,
      idList: any,
      typeList: any,
      reRenderList: any,
      highlightList: any,
      imageMap: any,
      svgMap: any,
      offsetX: number,
      offsetY: number,
      realPieceToRenderingScale: number,
    ) => {
      const intersects = (
        range1: { x: number; y: number; width: number; height: number },
        range2: { x: number; y: number; width: number; height: number },
      ) => {
        return (
          range1.x < range2.x + range2.width &&
          range1.x + range1.width > range2.x &&
          range1.y < range2.y + range2.height &&
          range1.y + range1.height > range2.y
        );
      };

      const sharedRect = shared.rect;
      const sharedText = shared.text;
      const sharedImage = shared.image;
      const sharedPath = shared.path;
      const sharedSvg = shared.svg;

      const globalLineCaps = ['butt', 'round', 'square'];

      for (let [key, { type, id, used }] of reRenderList) {
        if (!used) {
          continue;
        }

        let borderWidth = 0;
        let x = 0;
        let y = 0;
        let width = 0;
        let height = 0;

        if (type === 0) {
          x = sharedRect.x[id];
          y = sharedRect.y[id];
          width = sharedRect.width[id];
          height = sharedRect.height[id];
          borderWidth =
            sharedRect.type[id] === 1 || sharedRect.type[id] === 2 ? sharedRect.lineWidth[id] : 0;
        } else if (type === 1) {
          x = sharedText.x[id];
          y = sharedText.y[id];
          width = sharedText.width[id];
          height = sharedText.height[id];
        } else if (type === 2) {
          const imageInfo = imageMap.get(sharedImage.imageIndex[id]);
          x = sharedImage.x[id];
          y = sharedImage.y[id];
          width = imageInfo.width;
          height = imageInfo.height;
        } else if (type === 3) {
          x = sharedPath.x[id];
          y = sharedPath.y[id];
          width = sharedPath.width[id];
          height = sharedPath.height[id];
        } else if (type === 4) {
          const svgInfo = svgMap.get(sharedSvg.svgIndex[id]);
          x = sharedSvg.x[id];
          y = sharedSvg.y[id];
          width = svgInfo.renderingWidth;
          height = svgInfo.renderingHeight;
        }

        const filteredList: Array<{ id: number; type: number }> = [];

        for (let i = 0; i < idList.length; i++) {
          const containerId = idList[i];
          const containerType = typeList[i];

          let containerX = 0;
          let containerY = 0;
          let containerWidth = 0;
          let containerHeight = 0;
          let containerBorderWidth = 0;

          if (containerType === 0) {
            containerBorderWidth =
              sharedRect.type[containerId] === 1 || sharedRect.type[containerId] === 2
                ? sharedRect.lineWidth[containerId]
                : 0;
            containerX = sharedRect.x[containerId] - containerBorderWidth / 2;
            containerY = sharedRect.y[containerId] - containerBorderWidth / 2;
            containerWidth = sharedRect.width[containerId] + containerBorderWidth;
            containerHeight = sharedRect.height[containerId] + containerBorderWidth;
          } else if (containerType === 1) {
            containerX = sharedText.x[containerId] - sharedText.width[containerId] / 2;
            containerY = sharedText.y[containerId] - sharedText.height[containerId] / 2;
            containerWidth = sharedText.width[containerId];
            containerHeight = sharedText.height[containerId];
          } else if (containerType === 2) {
            containerX = sharedImage.x[containerId];
            containerY = sharedImage.y[containerId];
            containerWidth = imageMap.get(<number>sharedImage.imageIndex[containerId]).width;
            containerHeight = imageMap.get(<number>sharedImage.imageIndex[containerId]).height;
          } else if (containerType === 3) {
            containerX = sharedPath.x[containerId];
            containerY = sharedPath.y[containerId];
            containerWidth = sharedPath.width[containerId];
            containerHeight = sharedPath.height[containerId];
          } else if (containerType === 4) {
            containerX = sharedSvg.x[containerId];
            containerY = sharedSvg.y[containerId];
            containerWidth = svgMap.get(<number>sharedSvg.svgIndex[containerId]).renderingWidth;
            containerHeight = svgMap.get(<number>sharedSvg.svgIndex[containerId]).renderingHeight;
          }

          if (
            intersects(
              {
                x: containerX - containerBorderWidth / 2,
                y: containerY - containerBorderWidth / 2,
                width: containerWidth + containerBorderWidth,
                height: containerHeight + containerBorderWidth,
              },
              {
                x: x - borderWidth / 2,
                y: y - borderWidth / 2,
                width: width + borderWidth,
                height: height + borderWidth,
              },
            )
          ) {
            filteredList.push({
              id: containerId,
              type: containerType,
            });
          }
        }

        ctx.save();

        ctx.scale(realPieceToRenderingScale * 2, realPieceToRenderingScale * 2);
        ctx.translate(-(offsetX + borderWidth / 2), -(offsetY + borderWidth / 2));

        ctx.beginPath();
        ctx.rect(x, y, width + borderWidth, height + borderWidth);
        ctx.clip();
        ctx.clearRect(x, y, width + borderWidth, height + borderWidth);

        for (let i = 0; i < filteredList.length; i++) {
          const id = filteredList[i].id;
          const type = filteredList[i].type;
          if (type === 0) {
            const x = sharedRect.x[id];
            const y = sharedRect.y[id];
            const width = sharedRect.width[id];
            const height = sharedRect.height[id];
            const fillStyle = sharedRect.other[id].fillStyle || '';
            const strokeStyle = sharedRect.other[id].strokeStyle || '';
            const lineDash = sharedRect.other[id].lineDash || [];
            const lineWidth = sharedRect.lineWidth[id] || 1;
            const type = sharedRect.type[id] ?? 0;
            const alpha = sharedRect.alpha[id] ?? 1;
            const keepWidth = sharedRect.keepWidth[id] ?? 0;

            // const styleIndex = id * 256;
            // const encodedDataLength = sharedRect.style[styleIndex];
            // const encodedData = sharedRect.style.slice(
            //   styleIndex + 1,
            //   styleIndex + 1 + encodedDataLength,
            // );
            // const decodedStyle = textDecoder.decode(encodedData);
            // const style = {
            //   fillStyle: '',
            //   strokeStyle: '',
            // };

            ctx.globalAlpha = alpha;
            ctx.setLineDash(lineDash);
            ctx.fillStyle = fillStyle || '';
            ctx.strokeStyle = strokeStyle || '';
            ctx.lineWidth = keepWidth ? (lineWidth / realPieceToRenderingScale) * 2 : lineWidth;

            ctx.beginPath();
            ctx.rect(x, y, width, height);

            if (highlightList.data.get(0).has(id)) {
              // todo more property support
              const highlightProperty = highlightList.data.get(0).get(id);
              if (highlightProperty) {
                ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
                ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
                ctx.fillStyle = highlightProperty.fillStyle || ctx.fillStyle;
              }
            }

            if (type === 0) {
              ctx.fill();
            } else if (type === 1) {
              ctx.stroke();
            } else if (type === 2) {
              ctx.stroke();
              ctx.fill();
            } else if (type === 4) {
              ctx.stroke();
              ctx.fill();
            }

            ctx.closePath();
          } else if (type === 1) {
            const x = sharedText.x[id];
            const y = sharedText.y[id];
            const fontSize = sharedText.fontSize[id];
            const content = sharedText.other[id].content || '';
            const fillStyle = sharedText.other[id].fillStyle || '';
            const alpha = sharedText.alpha[id] ?? 1;

            // direction?: 'ltr' | 'rtl' | 'inherit';

            ctx.globalAlpha = alpha;
            ctx.fillStyle = fillStyle || '#000';

            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(content, x, y);
          } else if (type === 2) {
            const { width, height, img, hoverImg, checkImg } = imageMap.get(
              sharedImage.imageIndex[id],
            );
            const x = sharedImage.x[id];
            const y = sharedImage.y[id];
            const alpha = sharedImage.alpha[id] ?? 1;
            ctx.save();
            ctx.globalAlpha = alpha;
            let renderingImg = img;
            if (highlightList.data.get(2).has(id)) {
              // todo more property support
              const highlightProperty = highlightList.data.get(2).get(id);
              if (highlightProperty) {
                ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
                if (highlightProperty.state === 'hover') {
                  renderingImg = hoverImg;
                } else if (highlightProperty.state === 'check') {
                  renderingImg = checkImg;
                } else {
                  renderingImg = img;
                }
              }
            }
            ctx.drawImage(renderingImg, x, y, width, height);
            ctx.restore();
          } else if (type === 3) {
            const fromX = sharedPath.fromX[id];
            const fromY = sharedPath.fromY[id];
            const toX = sharedPath.toX[id];
            const toY = sharedPath.toY[id];
            const lineCap = sharedPath.lineCap[id] ?? 0;
            const lineDash =
              sharedPath.other[id].lineDash?.map(
                (item: number) => item * realPieceToRenderingScale * 2,
              ) || [];
            const strokeStyle = sharedPath.other[id].strokeStyle || '';
            const alpha = sharedPath.alpha[id] ?? 1;
            const lineWidth = sharedPath.lineWidth[id] || 1;
            const keepWidth = sharedPath.keepWidth[id];

            ctx.save();

            // line 单独处理是因为当lineWidth特别小的时候，画布不显示
            ctx.translate(offsetX, offsetY);
            ctx.scale(1 / realPieceToRenderingScale / 2, 1 / realPieceToRenderingScale / 2);

            ctx.globalAlpha = alpha;
            ctx.setLineDash(lineDash);
            ctx.strokeStyle = strokeStyle || '';
            ctx.lineWidth = keepWidth ? lineWidth * 4 : lineWidth * realPieceToRenderingScale * 2;
            ctx.lineCap = <CanvasLineCap>globalLineCaps[lineCap];

            if (highlightList.data.get(3).has(id)) {
              // todo more property support
              const highlightProperty = highlightList.data.get(3).get(id);
              if (highlightProperty) {
                ctx.lineWidth = keepWidth
                  ? highlightProperty.lineWidth * 4 ?? ctx.lineWidth
                  : highlightProperty.lineWidth
                  ? ctx.lineWidth * realPieceToRenderingScale * 2
                  : ctx.lineWidth;
                ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
                ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
                ctx.setLineDash(
                  highlightProperty.lineDash?.map(
                    (item: number) => item * realPieceToRenderingScale * 2,
                  ) || lineDash,
                );
              }
            }

            ctx.beginPath();
            ctx.moveTo(
              (fromX - offsetX) * realPieceToRenderingScale * 2,
              (fromY - offsetY) * realPieceToRenderingScale * 2,
            );
            ctx.lineTo(
              (toX - offsetX) * realPieceToRenderingScale * 2,
              (toY - offsetY) * realPieceToRenderingScale * 2,
            );
            ctx.stroke();
            ctx.closePath();

            ctx.restore();
          } else if (type === 4) {
            const {
              width,
              height,
              renderingWidth,
              renderingHeight,
              svgSolidPaths,
              svgSolidPolygons,
              svgDashedPaths,
              svgDashedPolygons,
            } = svgMap.get(sharedSvg.svgIndex[id]);

            const x = sharedSvg.x[id];
            const y = sharedSvg.y[id];
            const alpha = sharedSvg.alpha[id] ?? 1;
            const fillStyle = sharedSvg.other[id].fillStyle || '';

            ctx.save();
            ctx.globalAlpha = alpha;

            const svgCanvas = new OffscreenCanvas(width, height);
            const svgCtx = svgCanvas.getContext('2d', { willReadFrequently: true });

            let svgPaths = svgSolidPaths;
            let svgPolygons = svgSolidPolygons;

            if (svgCtx) {
              svgCtx.fillStyle = fillStyle || '';
              svgCtx.globalAlpha = alpha;
            }
            if (highlightList.data.get(4).has(id)) {
              const highlightProperty = highlightList.data.get(4).get(id);
              if (highlightProperty) {
                ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
                if (svgCtx) {
                  svgCtx.fillStyle = highlightProperty.fillStyle || svgCtx.fillStyle;
                  svgCtx.globalAlpha = highlightProperty.alpha || svgCtx.globalAlpha;
                }
                if (highlightProperty.state === 'hover') {
                  svgPaths = svgDashedPaths;
                  svgPolygons = svgDashedPolygons;
                  svgCtx?.clearRect(0, 0, svgCanvas.width, svgCanvas.height);
                }
              }
            }

            svgPaths.forEach((svgPath: string) => {
              svgCtx?.fill(new Path2D(svgPath));
            });

            svgPolygons.forEach((svgPolygon: string) => {
              const pointsArray = svgPolygon.split(' ').map(Number);
              const path = new Path2D();
              path.moveTo(pointsArray[0], pointsArray[1]);
              for (let i = 2; i < pointsArray.length; i += 2) {
                path.lineTo(pointsArray[i], pointsArray[i + 1]);
              }
              path.closePath();
              svgCtx?.fill(path);
            });

            ctx.drawImage(svgCanvas.transferToImageBitmap(), x, y, renderingWidth, renderingHeight);

            ctx.restore();
          }
        }

        ctx.restore();
      }
    };
  };

  public passParseImage = () => {
    return (imageDataURI: string) => {
      return new Promise((resolve) => {
        const byteCharacters = atob(imageDataURI.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        createImageBitmap(blob)
          .then(function (bitmap) {
            resolve(bitmap);
          })
          .catch(function (error) {
            console.error('Error loading image in worker:', error);
          });
      });
    };
  };

  public render(
    id: string,
    width: number,
    height: number,
    offsetX: number,
    offsetY: number,
    level: number,
    pieceIndex: number,
    realPieceToRenderingScale: number,
    paint: Paint,
  ): void {
    this.isBusy = true;

    const paintProperty = paint.getProperty();

    const blockInfo = paintProperty.region.getRenderingBlock(level, pieceIndex);
    if (!blockInfo || blockInfo.idList.length <= 0) {
      paintProperty.region.updateRenderingBlockAttribute(level, pieceIndex, 'image', null);
      paintProperty.region.updateRenderingBlockAttribute(
        level,
        pieceIndex,
        'state',
        RenderingState.rendered,
      );
      paintProperty.canvas.render();
      this.isBusy = false;
      return;
    }

    const cb = (data: any) => {
      if (data.type === 'render') {
        const level = data.level;
        const pieceIndex = data.pieceIndex;
        paintProperty.region.updateRenderingBlockAttribute(level, pieceIndex, 'image', data.image);
        paintProperty.region.updateRenderingBlockAttribute(
          level,
          pieceIndex,
          'state',
          RenderingState.rendered,
        );
        paintProperty.canvas.render();
        this.isBusy = false;

        // const imageBitmap = e.data.image;
        // const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        // const ctx = canvas.getContext('2d');

        // ctx?.drawImage(imageBitmap, 0, 0);

        // const img = new Image();

        // canvas.convertToBlob().then((data) => {
        //   img.src = URL.createObjectURL(data);
        // });
        this.publisher.unsubscribe(cb);
      }
    };

    this.publisher.subscribe(cb);

    this.worker.postMessage({
      type: 'render',
      id,
      width,
      height,
      realPieceToRenderingScale,
      offsetX,
      offsetY,
      idList: blockInfo.idList,
      typeList: blockInfo.typeList,
      highlightList: paintProperty.highlightList,
      level,
      pieceIndex,
    });
  }

  public reRender(
    id: string,
    offsetX: number,
    offsetY: number,
    level: number,
    pieceIndex: number,
    realPieceToRenderingScale: number,
    paint: Paint,
  ): void {
    const paintProperty = paint.getProperty();

    const blockInfo = paintProperty.region.getRenderingBlock(level, pieceIndex);

    this.isBusy = true;

    if (blockInfo?.lock) {
      setTimeout(() => {
        this.reRender(id, offsetX, offsetY, level, pieceIndex, realPieceToRenderingScale, paint);
      }, 0);
      return;
    }

    if (blockInfo) {
      blockInfo.lock = true;
    }

    blockInfo?.reRenderList.forEach((item: any) => {
      item.used = true;
    });

    if (!blockInfo || blockInfo.idList.length <= 0) {
      paintProperty.region.updateRenderingBlockAttribute(level, pieceIndex, 'image', null);
      paintProperty.region.updateRenderingBlockAttribute(
        level,
        pieceIndex,
        'state',
        RenderingState.rendered,
      );
      paintProperty.canvas.render();
      this.isBusy = false;
      return;
    }

    const cb = (data: any) => {
      if (data.type === 'rerender') {
        const level = data.level;
        const pieceIndex = data.pieceIndex;

        const blockInfo = paintProperty.region.getRenderingBlock(level, pieceIndex);

        paintProperty.region.updateRenderingBlockAttribute(level, pieceIndex, 'image', data.image);

        for (let [id, value] of blockInfo?.reRenderList ?? new Map()) {
          if (value.used) {
            blockInfo?.reRenderList.delete(id);
          }
        }

        if (blockInfo) {
          blockInfo.lock = false;
        }

        paintProperty.canvas.render();

        this.isBusy = false;
        this.publisher.unsubscribe(cb);
      }
    };

    this.publisher.subscribe(cb);

    this.worker.postMessage(
      {
        type: 'rerender',
        id,
        realPieceToRenderingScale,
        offsetX,
        offsetY,
        idList: blockInfo.idList,
        typeList: blockInfo.typeList,
        reRenderList: blockInfo.reRenderList,
        highlightList: paintProperty.highlightList,
        level,
        pieceIndex,
        image: blockInfo.image,
      },
      [],
    );
  }

  public getIsBusy(): boolean {
    return this.isBusy;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }
}
