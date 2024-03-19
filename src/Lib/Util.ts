const Util = {
  getLevelByScale(scale: number): number {
    if (scale < 2) {
      return 1;
    }

    let base = 1;
    let exponent = 0;

    while (scale > base * 2) {
      base *= 2;
      exponent++;
    }

    return exponent + 1;
  },

  convert2Power(num: number) {
    let cnum = Math.floor(num);
    let result = 1;

    while (result <= cnum) {
      result *= 4;
    }

    return result / 4;
  },

  // 判断两个矩形是否相交 x1,y1,x2,y2
  intersectingWithRect(
    rectangle1: [number, number, number, number],
    rectangle2: [number, number, number, number],
  ): boolean {
    return !(
      rectangle2[0] > rectangle1[2] ||
      rectangle2[2] < rectangle1[0] ||
      rectangle2[1] > rectangle1[3] ||
      rectangle2[3] < rectangle1[1]
    );
  },
};
export default Util;
