class QuadTreeNode<T> {
  x: number;
  y: number;
  width: number;
  height: number;
  rectangles: Array<{ x: number; y: number; width: number; height: number; data: T }>;
  children: Array<QuadTreeNode<T>>;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rectangles = [];
    this.children = [];
  }

  insert(rectangle: { x: number; y: number; width: number; height: number; data: T }): void {
    if (this.children.length > 0) {
      const indexList = this.getIndexList(rectangle);

      for (let index of indexList) {
        this.children[index].insert(rectangle);
      }
    }

    this.rectangles.push(rectangle);
  }

  query(range: { x: number; y: number; width: number; height: number }): T[] {
    const result: T[] = [];
    this.queryRecursive(range, result);
    return result;
  }

  private queryRecursive(
    range: { x: number; y: number; width: number; height: number },
    result: T[],
  ): void {
    if (!this.intersects(range, this)) {
      return;
    }

    for (const rect of this.rectangles) {
      if (
        rect.x + rect.width >= range.x &&
        rect.x <= range.x + range.width &&
        rect.y + rect.height >= range.y &&
        rect.y <= range.y + range.height
      ) {
        result.push(rect.data);
      }
    }

    for (const child of this.children) {
      child.queryRecursive(range, result);
    }
  }

  private getIndexList(rectangle: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Array<number> {
    const { x, y, width, height } = this;

    const indexList: Array<number> = [];

    if (this.intersects({ x, y, width: width / 2, height: height / 2 }, rectangle)) {
      indexList.push(0);
    }
    if (this.intersects({ x: x + width / 2, y, width: width / 2, height: height / 2 }, rectangle)) {
      indexList.push(1);
    }
    if (
      this.intersects({ x, y: y + height / 2, width: width / 2, height: height / 2 }, rectangle)
    ) {
      indexList.push(2);
    }
    if (
      this.intersects(
        { x: x + width / 2, y: y + height / 2, width: width / 2, height: height / 2 },
        rectangle,
      )
    ) {
      indexList.push(3);
    }

    return indexList;
  }

  private intersects(
    range1: { x: number; y: number; width: number; height: number },
    range2: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      range1.x < range2.x + range2.width &&
      range1.x + range1.width > range2.x &&
      range1.y < range2.y + range2.height &&
      range1.y + range1.height > range2.y
    );
  }
}

class QuadTree<T> {
  root: QuadTreeNode<T>;

  constructor(x: number, y: number, width: number, height: number) {
    this.root = new QuadTreeNode<T>(x, y, width, height);
  }

  insert(x: number, y: number, width: number, height: number, data: T): void {
    this.root.insert({ x, y, width, height, data });
  }

  query(range: { x: number; y: number; width: number; height: number }): T[] {
    return this.root.query(range);
  }
}

//   // 示例用法
//   const quadTree = new QuadTree<number>(0, 0, 100, 100, 4);

//   // 插入一些矩形
//   quadTree.insert(10, 20, 30, 40, 42);
//   quadTree.insert(30, 40, 20, 25, 55);
//   quadTree.insert(80, 90, 10, 15, 66);

//   // 查询范围内的矩形
//   const result = quadTree.query({ x: 0, y: 0, width: 50, height: 50 });
//   console.log(result); // 输出插入在范围内的矩形的数据
