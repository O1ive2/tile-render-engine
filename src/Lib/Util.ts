const Util = {
  getLevelByScale(scale: number): number {
    if (scale <= 4) {
      return 1;
    }

    let base = 1;
    let exponent = 0;

    while (scale > base * 4) {
      base *= 4;
      exponent++;
    }

    return exponent + 1;
  },

  getSideNumberOnLevel(level: number) {
    return 1 << (level * 2 - 1);
  },

  intersects(
    range1: { x: number; y: number; width: number; height: number },
    range2: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      range1.x < range2.x + range2.width &&
      range1.x + range1.width > range2.x &&
      range1.y < range2.y + range2.height &&
      range1.y + range1.height > range2.y
    );
  },
};
export default Util;
