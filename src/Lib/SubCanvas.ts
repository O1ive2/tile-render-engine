import GeometryManager from './GeometryManager';
export default class SubCanvas {
  private isBusy = false;
  private isInitialized = false;
  private blob_str: Blob;
  private worker: Worker;
  private geometryManager: GeometryManager = GeometryManager.from();
  private characterHash: string = '';

  constructor() {
    this.blob_str = new Blob(
      [
        `
        const render = ${this.retRender()}
        const parseImage = ${this.retParseImage()}

        let shared = null;
        let imageMap = new Map();

        self.onmessage = async (e) => {
          if(e.data.type === 'init') {
            shared = e.data.shared;
            const imageMapStr = e.data.sharedImageMap;
            const textDecoder = new TextDecoder();
            const sharedImageMapData = new Uint8Array(imageMapStr);
            const sharedImageMap = JSON.parse(textDecoder.decode(sharedImageMapData));
            for(let key in sharedImageMap){
              const {width,height,imgBase64,hoverImgBase64,checkImgBase64} = sharedImageMap[key];
              imageMap.set(Number(key),{
                width,
                height,
                img:await parseImage(imgBase64),
                hoverImg:await parseImage(hoverImgBase64),
                checkImg:await parseImage(checkImgBase64)
              });
            }

            self.postMessage({
              type: 'init'
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

            const canvas = render(width,height,shared,idList,typeList,highlightList,imageMap,offsetX,offsetY,realPieceToRenderingScale);

            self.postMessage({
              type: "render",
              img: canvas?.transferToImageBitmap(),
              level,
              pieceIndex
            });
          }
          
        };
        `,
      ],
      { type: 'text/javascript' },
    );

    this.worker = new Worker(URL.createObjectURL(this.blob_str));
  }

  public retParseImage = () => {
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

  public retRender = () => {
    return (
      width: number,
      height: number,
      shared: any,
      idList: any,
      typeList: any,
      highlightList: any,
      imageMap: any,
      offsetX: number,
      offsetY: number,
      realPieceToRenderingScale: number,
    ): OffscreenCanvas | void => {
      // const now = Date.now();

      const canvas = new OffscreenCanvas(width, height);
      const ctx = <OffscreenCanvasRenderingContext2D>canvas.getContext('2d', {
        willReadFrequently: true,
      });

      const sharedRect = shared.rect;
      const sharedText = shared.text;
      const sharedImage = shared.image;
      const sharedPath = shared.path;

      const textDecoder = new TextDecoder();

      const retrievedRectData = new Uint8Array(sharedRect.other);
      const rectOtherList = JSON.parse(textDecoder.decode(retrievedRectData));

      const retrievedTextData = new Uint8Array(sharedText.other);
      const textOtherList = JSON.parse(textDecoder.decode(retrievedTextData));

      const retrievedPathData = new Uint8Array(sharedPath.other);
      const pathOtherList = JSON.parse(textDecoder.decode(retrievedPathData));

      const globalLineCaps = ['butt', 'round', 'square'];

      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 256)},${Math.floor(
        Math.random() * 256,
      )},${Math.floor(Math.random() * 256)})`;
      ctx.fillRect(0, 0, 10000, 10000);

      // ctx.imageSmoothingEnabled = false;

      // ctx.fillRect(0, 0, width, height);

      ctx.save();

      ctx.scale(realPieceToRenderingScale, realPieceToRenderingScale);
      ctx.translate(-offsetX, -offsetY);

      for (let i = 0; i < idList.length; i++) {
        const id = idList[i];
        if (typeList[i] === 0) {
          const x = sharedRect.x[id];
          const y = sharedRect.y[id];
          const width = sharedRect.width[id];
          const height = sharedRect.height[id];
          const fillStyle = rectOtherList[id].fillStyle || '';
          const strokeStyle = rectOtherList[id].strokeStyle || '';
          const lineDash = rectOtherList[id].lineDash || [];
          const lineWidth = sharedRect.lineWidth[id] || 1;
          const type = sharedRect.type[id] ?? 0;
          const alpha = sharedRect.alpha[id] ?? 1;

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
          ctx.lineWidth = lineWidth;

          ctx.beginPath();
          ctx.rect(x, y, width, height);

          if (highlightList.rect.has(id)) {
            // todo more property support
            const highlightProperty = highlightList.rect.get(id);
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
          }

          ctx.closePath();
        } else if (typeList[i] === 1) {
          const x = sharedText.x[id];
          const y = sharedText.y[id];
          const fontSize = sharedText.fontSize[id];
          const content = textOtherList[id].content || '';
          const fillStyle = textOtherList[id].fillStyle || '';
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

          if (highlightList.image.has(id)) {
            // todo more property support
            const highlightProperty = highlightList.image.get(id);
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
          const lineDash = pathOtherList[id].lineDash || [];
          const strokeStyle = pathOtherList[id].strokeStyle || '';
          const alpha = sharedPath.alpha[id] ?? 1;
          const lineWidth = sharedPath.lineWidth[id] || 1;
          const keepWidth = sharedPath.keepWidth[id];

          ctx.save();

          // line 单独处理是因为当lineWidth特别小的时候，画布不显示
          ctx.translate(offsetX, offsetY);
          ctx.scale(1 / realPieceToRenderingScale, 1 / realPieceToRenderingScale);

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = keepWidth ? lineWidth : lineWidth * realPieceToRenderingScale;
          ctx.lineCap = <CanvasLineCap>globalLineCaps[lineCap];

          if (highlightList.path.has(id)) {
            // todo more property support
            const highlightProperty = highlightList.path.get(id);
            if (highlightProperty) {
              ctx.globalAlpha = highlightProperty.alpha || ctx.globalAlpha;
              ctx.strokeStyle = highlightProperty.strokeStyle || ctx.strokeStyle;
              ctx.setLineDash(highlightProperty.lineDash || lineDash);
            }
          }

          ctx.beginPath();
          ctx.moveTo(
            (fromX - offsetX) * realPieceToRenderingScale,
            (fromY - offsetY) * realPieceToRenderingScale,
          );
          ctx.lineTo(
            (toX - offsetX) * realPieceToRenderingScale,
            (toY - offsetY) * realPieceToRenderingScale,
          );
          ctx.stroke();
          ctx.closePath();

          ctx.restore();
        }
      }

      ctx.restore();

      return canvas;

      // console.log(Date.now() - now + 'ms');

      // console.log('------------');
    };
  };

  public init(sharedImageMap: Uint8Array): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.worker.onmessage = (e) => {
        if (e.data.type === 'init') {
          this.isInitialized = true;
          resolve();
        } else if (e.data.type === 'render') {
          const level = e.data.level;
          const pieceIndex = e.data.pieceIndex;

          this.geometryManager.setCanvasArea(level, pieceIndex, <ImageBitmap>e.data.img);
          this.geometryManager.setCanvasArea(level, pieceIndex, 2);
          this.isBusy = false;

          // const imageBitmap = e.data.img;
          // const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
          // const ctx = canvas.getContext('2d');

          // ctx?.drawImage(imageBitmap, 0, 0);

          // const img = new Image();

          // canvas.convertToBlob().then((data) => {
          //   img.src = URL.createObjectURL(data);
          // });
        }
      };

      this.worker.postMessage({
        type: 'init',
        shared: this.geometryManager.getSerializedData(),
        sharedImageMap,
      });
    });
  }

  public render(
    width: number,
    height: number,
    offsetX: number,
    offsetY: number,
    level: number,
    pieceIndex: number,
    realPieceToRenderingScale: number,
  ): void {
    this.isBusy = true;

    const areaInfo = this.geometryManager.getCanvasArea(level, pieceIndex);

    if (areaInfo.idList.length > 0) {
      this.worker.postMessage({
        type: 'render',
        width,
        height,
        realPieceToRenderingScale,
        offsetX,
        offsetY,
        idList: areaInfo.idList,
        typeList: areaInfo.typeList,
        highlightList: this.geometryManager.getHighlightList(),
        level,
        pieceIndex,
      });
    } else {
      this.geometryManager.setCanvasArea(level, pieceIndex, null);
      this.geometryManager.setCanvasArea(level, pieceIndex, 2);
      this.isBusy = false;
    }
  }

  public getIsBusy(): boolean {
    return this.isBusy;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public hasCharacter(str: string): boolean {
    return this.characterHash === str;
  }
}
