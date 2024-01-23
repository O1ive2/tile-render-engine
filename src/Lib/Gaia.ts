import CanvasManager from './CanvasManager';
import Paint from './Paint';

class Gaia {
  // initialization
  public static init(canvasId: string): Paint | null {
    const canvas: HTMLCanvasElement | null = document.querySelector(canvasId);
    if (canvas) {
      return CanvasManager.from(canvas);
    } else {
      return null;
    }
  }

  public static test() {
    console.log('hello,world');
  }
}

export default Gaia;
