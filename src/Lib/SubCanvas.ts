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
      hoverList: any,
      checkedList: any,
      offsetX: number,
      offsetY: number,
      realPieceToRenderingScale: number,
    ): void => {
      const sharedRect = shared.rect;
      const rectIdList = idList.rect;
      const rectHoverList = hoverList.rect;
      const rectCheckedList = checkedList.rect;

      if (rectIdList.length === 0) {
        return;
      }

      // const now = Date.now();

      const retrievedData = new Uint8Array(sharedRect.other);
      const textDecoder = new TextDecoder();
      const rectOtherList = JSON.parse(textDecoder.decode(retrievedData));

      ctx.save();

      ctx.scale(realPieceToRenderingScale, realPieceToRenderingScale);
      ctx.translate(-offsetX, -offsetY);

      for (let id of rectIdList) {
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
          ctx.strokeStyle = hoverProperty.strokeStyle || ctx.strokeStyle;
          ctx.fillStyle = hoverProperty.fillStyle || ctx.fillStyle;
        } else if (state === 2) {
          // todo more property support
          const checkedProperty = rectCheckedList.get(id);
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

        // ctx.closePath();
      }

      ctx.restore();

      // console.log(rectIdList.length);
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
            const hoverList = e.data.hoverList;
            const checkedList = e.data.checkedList;

            const realPieceToRenderingScale = e.data.realPieceToRenderingScale;
            const ctx = canvas.getContext('2d');

            drawRect(ctx,e.data.shared,idList,hoverList,checkedList,offsetX,offsetY,realPieceToRenderingScale);

            self.postMessage(canvas.transferToImageBitmap());

          };
          `,
        ],
        { type: 'text/javascript' },
      );
      this.worker = new Worker(URL.createObjectURL(this.blob_str));

      this.worker.addEventListener('message', (msg) => {
        this.isBusy = false;
        this.setCharacter('');
        resolve(msg.data);
      });

      // rect
      const serializedRectData = this.geometryManager.getSerializedRectData();

      this.worker.postMessage(
        {
          canvas: offscreenCanvas,
          realPieceToRenderingScale,
          offsetX,
          offsetY,
          shared: {
            rect: serializedRectData.shared,
          },
          idList: {
            rect: this.geometryManager.getCanvasAreaIdList(level, pieceIndex),
          },
          hoverList: {
            rect: serializedRectData.hoverIdList,
          },
          checkedList: {
            rect: serializedRectData.checkedIdList,
          },
        },
        [offscreenCanvas],
      );
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
