const Util = {
  getLevelByScale(scale: number): number {
    if (scale <= 1) {
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
};
export default Util;
