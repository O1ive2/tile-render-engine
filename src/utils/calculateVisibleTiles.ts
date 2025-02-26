// 计算可视区域的瓦片图index
const calculateVisibleTiles = (
  canvasSize: { width: number; height: number },
  zoomLevel: number,
  viewport: { x: number; y: number },
  tilesX: number,
  tilesY: number,
  tileWidth: number,
  tileHeight: number
) => {
  const canvasWidth = canvasSize.width as number;
  const canvasHeight = canvasSize.height as number;

  // 计算每个瓦片的缩放后的尺寸
  const scaledTileWidth = tileWidth * zoomLevel;
  const scaledMapWidth = scaledTileWidth * tilesX;
  const scaledTileHeight = tileHeight * zoomLevel;
  const scaledMapHeight = scaledTileHeight * tilesY;

  const startX = viewport.x;
  const startY = viewport.y;

  const endX = viewport.x + scaledMapWidth;
  const endY = viewport.y + scaledMapHeight;

  const visIndex: number[] = [];
  let x1: number = 0,
    y1: number = 0,
    x2: number = 0,
    y2: number = 0;

  // 判断瓦片图在canvas内部
  if (
    startX <= canvasWidth &&
    startY <= canvasWidth &&
    endX >= 0 &&
    endY >= 0
  ) {
    x1 = startX < 0 ? Math.floor(-startX / scaledTileWidth) : 0;
    y1 = startY < 0 ? Math.floor(-startY / scaledTileHeight) : 0;
    x2 =
      endX > canvasWidth
        ? Math.ceil((canvasWidth - startX) / scaledTileWidth)
        : tilesX;
    y2 =
      endY > canvasHeight
        ? Math.ceil((canvasHeight - startY) / scaledTileHeight)
        : tilesY;
  }

  for (let x = x1; x < x2; x++) {
    for (let y = y1; y < y2; y++) {
      visIndex.push(y * tilesX + x);
    }
  }

  return visIndex;
};

export default calculateVisibleTiles;
