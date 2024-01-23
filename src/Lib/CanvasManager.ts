import { maxThreads } from '../config';
import Paint from './Paint';
import SubCanvas from './SubCanvas';

export default class CanvasManager {
  private mainCanvas: HTMLCanvasElement;
  private subCanvasList: Array<SubCanvas>;

  constructor(canvas: HTMLCanvasElement) {
    this.mainCanvas = canvas;
    this.subCanvasList = Array.from({ length: maxThreads }, () => new SubCanvas());
  }

  public getWidth(): number {
    return this.mainCanvas.width;
  }

  public getHeight(): number {
    return this.mainCanvas.height;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  public on(event: string, callback: any): void {
    if (event === 'zoom') {
      const canvas = this.mainCanvas;
      let k = 1;
      let x = 0;
      let y = 0;
      let draggable = false;
      let startX = 0;
      let startY = 0;
      canvas.addEventListener(
        'pointerdown',
        (event: PointerEvent) => {
          draggable = true;
          startX = event.offsetX;
          startY = event.offsetY;
        },
        false,
      );
      canvas.addEventListener(
        'pointermove',
        (event: PointerEvent) => {
          if (draggable) {
            x += event.offsetX - startX;
            y += event.offsetY - startY;
            startX = event.offsetX;
            startY = event.offsetY;
            callback({ k, x, y });
          }
        },
        false,
      );
      canvas.addEventListener(
        'pointerup',
        () => {
          draggable = false;
        },
        false,
      );
      canvas.addEventListener(
        'pointerout',
        () => {
          draggable = false;
        },
        false,
      );
      canvas.addEventListener(
        'wheel',
        (event: WheelEvent) => {
          if (!draggable) {
            if (event.deltaY < 0) {
              x = event.offsetX - (event.offsetX - x) * (1 + 0.1 / k);
              y = event.offsetY - (event.offsetY - y) * (1 + 0.1 / k);
              k += 0.1;
            } else {
              if (k <= 0.5) {
                k = 0.5;
              } else {
                x = event.offsetX - (event.offsetX - x) * (1 - 0.1 / k);
                y = event.offsetY - (event.offsetY - y) * (1 - 0.1 / k);
                k -= 0.1;
              }
            }
            callback({ k, x, y });
          }
        },
        false,
      );
    }
  }

  public static from(canvasDom: HTMLCanvasElement): Paint {
    return Paint.from(new CanvasManager(canvasDom));
  }
}
