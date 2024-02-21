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
      offsetX: number,
      offsetY: number,
      rectListCompressed: any,
      realPieceToRenderingScale: number,
    ): void => {
      if (!rectListCompressed) {
        return;
      }

      const now = Date.now();
      const retrievedData = new Uint8Array(rectListCompressed);
      const textDecoder = new TextDecoder();
      const rectList = JSON.parse(textDecoder.decode(retrievedData));
      console.log(rectList.length);
      console.log(Date.now() - now);

      for (const {
        x,
        y,
        width,
        height,
        fillStyle = '',
        strokeStyle = '',
        lineWidth = 1,
        type = 0,
        lineDash = [],
        alpha = 1,
        state = 0,
      } of rectList) {
        ctx.save();

        ctx.globalAlpha = alpha;
        ctx.setLineDash(lineDash);
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;

        ctx.beginPath();

        ctx.rect(
          (x - offsetX) * realPieceToRenderingScale,
          (y - offsetY) * realPieceToRenderingScale,
          width * realPieceToRenderingScale,
          height * realPieceToRenderingScale,
        );

        if (type === 0) {
          ctx.fill();
        } else if (type === 1) {
          ctx.stroke();
        } else if (type === 2) {
          ctx.stroke();
          ctx.fill();
        }

        ctx.closePath();

        ctx.restore();
      }
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

      const rectListCompressed = this.geometryManager.getCanvasAreaCompressedList(
        level,
        pieceIndex,
      );

      this.blob_str = new Blob(
        [
          `
          const drawRect = ${this.retDrawRect()}

          self.onmessage = (e) => {
            const canvas = e.data.canvas;
            const offsetX = e.data.offsetX;
            const offsetY = e.data.offsetY;

            const rectListCompressed = e.data.rectListCompressed;
            const realPieceToRenderingScale = e.data.realPieceToRenderingScale;
            const ctx = canvas.getContext('2d');

            drawRect(ctx,offsetX,offsetY,rectListCompressed,realPieceToRenderingScale);

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
        console.timeEnd(`${this.characterHash} time`);
        resolve(msg.data);
      });

      this.worker.postMessage(
        {
          canvas: offscreenCanvas,
          rectListCompressed,
          realPieceToRenderingScale,
          offsetX,
          offsetY,
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
    console.time(`${this.characterHash} time`);
    return this.characterHash;
  }

  public hasCharacter(str: string): boolean {
    return this.characterHash === str;
  }
}
