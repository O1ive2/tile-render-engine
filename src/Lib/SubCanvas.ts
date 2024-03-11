import GeometryManager from './GeometryManager';

export default class SubCanvas {
  private isBusy = false;
  private blob_str: Blob | null = null;
  private worker: Worker | null = null;
  private geometryManager: GeometryManager = GeometryManager.from();
  private characterHash: string = '';

  constructor() {}

  public retDrawRect(): Function {
    return (
      ctx: any,
      shared: any,
      idList: any,
      typeList: any,
      hoverList: any,
      checkedList: any,
      imageMap: any,
      offsetX: number,
      offsetY: number,
      realPieceToRenderingScale: number,
    ): void => {
      // const now = Date.now();

      if (idList.length === 0) {
        return;
      }

      const sharedRect = shared.rect;
      const rectHoverList = hoverList.rect;
      const rectCheckedList = checkedList.rect;

      const sharedText = shared.text;

      const sharedImage = shared.image;
      const imageHoverList = hoverList.image;
      const imageCheckedList = checkedList.image;

      const sharedPath = shared.path;
      const pathHoverList = hoverList.path;
      const pathCheckedList = checkedList.path;

      const textDecoder = new TextDecoder();

      const retrievedRectData = new Uint8Array(sharedRect.other);
      const rectOtherList = JSON.parse(textDecoder.decode(retrievedRectData));

      const retrievedTextData = new Uint8Array(sharedText.other);
      const textOtherList = JSON.parse(textDecoder.decode(retrievedTextData));

      const retrievedPathData = new Uint8Array(sharedPath.other);
      const pathOtherList = JSON.parse(textDecoder.decode(retrievedPathData));

      const globalLineCaps = ['butt', 'round', 'square'];

      // ctx.fillStyle = `rgba(${Math.floor(Math.random() * 256)},${Math.floor(
      //   Math.random() * 256,
      // )},${Math.floor(Math.random() * 256)})`;
      // ctx.fillRect(0, 0, 10000, 10000);

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
          const state = sharedRect.state[id] || 0;

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

          // hover
          if (state === 1) {
            // todo more property support
            const hoverProperty = rectHoverList.get(id);
            ctx.globalAlpha = hoverProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = hoverProperty.strokeStyle || ctx.strokeStyle;
            ctx.fillStyle = hoverProperty.fillStyle || ctx.fillStyle;
          } else if (state === 2) {
            // todo more property support
            const checkedProperty = rectCheckedList.get(id);
            ctx.globalAlpha = checkedProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = checkedProperty.strokeStyle || ctx.strokeStyle;
            ctx.fillStyle = checkedProperty.fillStyle || ctx.fillStyle;
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
          const width = sharedText.width[id];
          const height = sharedText.height[id];
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
          const state = sharedImage.state[id] || 0;

          ctx.save();

          ctx.globalAlpha = alpha;

          let renderingImg = img;

          if (state === 1) {
            // todo more property support
            const hoverProperty = imageHoverList.get(id);
            ctx.globalAlpha = hoverProperty.alpha || ctx.globalAlpha;
            renderingImg = hoverImg;
          } else if (state === 2) {
            // todo more property support
            const checkedProperty = imageCheckedList.get(id);
            ctx.globalAlpha = checkedProperty.alpha || ctx.globalAlpha;
            renderingImg = checkImg;
          }

          ctx.drawImage(renderingImg, x, y, width, height);

          ctx.restore();
        } else if (typeList[i] === 3) {
          const fromX = sharedPath.fromX[id];
          const fromY = sharedPath.fromY[id];
          const toX = sharedPath.toX[id];
          const toY = sharedPath.toY[id];
          const lineCap = sharedPath.lineCap[id] ?? 0;
          const lineWidth = sharedPath.lineWidth[id] || 1;
          const lineDash = pathOtherList[id].lineDash || [];
          const strokeStyle = pathOtherList[id].strokeStyle || '';
          const alpha = sharedPath.alpha[id] ?? 1;
          const state = sharedPath.state[id] || 0;

          ctx.save();

          ctx.globalAlpha = alpha;
          ctx.setLineDash(lineDash);
          ctx.strokeStyle = strokeStyle || '';
          ctx.lineWidth = lineWidth;
          ctx.lineCap = globalLineCaps[lineCap];

          // hover
          if (state === 1) {
            // todo more property support
            const hoverProperty = pathHoverList.get(id);
            ctx.globalAlpha = hoverProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = hoverProperty.strokeStyle || ctx.strokeStyle;
          } else if (state === 2) {
            // todo more property support
            const checkedProperty = pathCheckedList.get(id);
            ctx.globalAlpha = checkedProperty.alpha || ctx.globalAlpha;
            ctx.strokeStyle = checkedProperty.strokeStyle || ctx.strokeStyle;
          }

          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          ctx.restore();
        }
      }

      ctx.restore();

      // console.log(Date.now() - now + 'ms');

      // console.log('------------');
    };
  }

  public run(
    offscreenCanvas: OffscreenCanvas,
    offsetX: number,
    offsetY: number,
    level: number,
    pieceIndex: number,
    realPieceToRenderingScale: number,
  ): Promise<ImageBitmap | null> {
    return new Promise(async (resolve, reject) => {
      const testStr = Math.random().toString();

      this.isBusy = true;

      this.blob_str = new Blob(
        [
          `
          const drawRect = ${this.retDrawRect()}

          self.onmessage = (e) => {
            const canvas = e.data.canvas;
            const offsetX = e.data.offsetX;
            const offsetY = e.data.offsetY;

            const shared = e.data.shared;
            const idList = e.data.idList;
            const typeList = e.data.typeList;
            const hoverList = e.data.hoverList;
            const checkedList = e.data.checkedList;
            const imageMap = e.data.imageMap;

            const realPieceToRenderingScale = e.data.realPieceToRenderingScale;
            const ctx = canvas.getContext('2d');

            drawRect(ctx,e.data.shared,idList,typeList,hoverList,checkedList,imageMap,offsetX,offsetY,realPieceToRenderingScale);

            const img = canvas.transferToImageBitmap();

            self.postMessage(img);
          };
          `,
        ],
        { type: 'text/javascript' },
      );
      this.worker = new Worker(URL.createObjectURL(this.blob_str));

      this.worker.addEventListener('message', (msg) => {
        this.isBusy = false;
        this.worker?.terminate();
        this.setCharacter('');
        resolve(msg.data);
      });
      console.time(testStr);

      // rect
      const serializedRectData = this.geometryManager.getSerializedRectData();

      // text
      const serializedTextData = this.geometryManager.getSerializedTextData();

      // image
      const serializedImageData = this.geometryManager.getSerializedImageData();

      // path
      const serializedPathData = this.geometryManager.getSerializedPathData();

      // image map
      const imageMap = this.geometryManager.getImageMap();

      // const passList: any = [];

      // imageMap.forEach((value: any) => {
      //   passList.push(value.img);
      //   passList.push(value.hoverImg);
      //   passList.push(value.checkImg);
      // });

      this.worker.postMessage(
        {
          canvas: offscreenCanvas,
          realPieceToRenderingScale,
          offsetX,
          offsetY,
          shared: {
            rect: serializedRectData.shared,
            text: serializedTextData.shared,
            image: serializedImageData.shared,
            path: serializedPathData.shared,
          },
          idList: this.geometryManager.getCanvasArea(level, pieceIndex).idList,
          typeList: this.geometryManager.getCanvasArea(level, pieceIndex).typeList,
          hoverList: {
            rect: serializedRectData.hoverIdList,
            image: serializedImageData.hoverIdList,
            path: serializedPathData.hoverIdList,
          },
          checkedList: {
            rect: serializedRectData.checkedIdList,
            image: serializedImageData.checkedIdList,
            path: serializedPathData.checkedIdList,
          },
          imageMap: imageMap,
        },
        [offscreenCanvas],
      );

      console.timeEnd(testStr);
    });
  }

  public getIsBusy(): boolean {
    return this.isBusy;
  }

  public setCharacter(str: string): string {
    this.characterHash = str;
    return this.characterHash;
  }

  public hasCharacter(str: string): boolean {
    return this.characterHash === str;
  }
}
