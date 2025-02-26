const tilesTransform = (
  tiles: number[],
  isExpand: boolean,
  switchLevel: number,
  tilesLen: number
) => {
  const newTiles: Set<number> = new Set();

  if (isExpand) {
    const newTilesLen = tilesLen * switchLevel;
    tiles.forEach((i) => {
      const x = i % tilesLen;
      const y = Math.floor(i / tilesLen);
      const newStartX = x * switchLevel;
      const newStartY = y * switchLevel;
      const newEndX = newStartX + switchLevel;
      const newEndY = newStartY + switchLevel;
      for (let i = newStartX; i < newEndX; i++) {
        for (let j = newStartY; j < newEndY; j++) {
          newTiles.add(j * newTilesLen + i);
        }
      }
    });
  } else {
    tiles.forEach((i) => {
      const x = i % tilesLen;
      const y = Math.floor(i / tilesLen);
      const newTilesLen = Math.floor(tilesLen / switchLevel);

      const newX = Math.floor(x / switchLevel);
      const newY = Math.floor(y / switchLevel);
      newTiles.add(newY * newTilesLen + newX);
    });
  }

  return newTiles;
};

export default tilesTransform;
