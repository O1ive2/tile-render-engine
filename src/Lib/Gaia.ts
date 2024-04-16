import CanvasManager from './CanvasManager';
import Paint from './Paint';

class Gaia {
  // initialization
  public static init(canvasId: string): Paint | null {
    const canvas: HTMLCanvasElement | null = document.querySelector(canvasId);

    if (canvas) {
      return CanvasManager.from(canvasId, canvas);
    } else {
      return null;
    }
  }
}

export default Gaia;
