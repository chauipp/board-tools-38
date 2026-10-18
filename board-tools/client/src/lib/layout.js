export function gridLayout(items, origin, cols, gapX = 24, gapY = 24) {
  const colW = [], rowH = [];
  items.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    colW[c] = Math.max(colW[c] || 0, it.w);
    rowH[r] = Math.max(rowH[r] || 0, it.h);
  });
  const positions = new Map();
  items.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    let x = origin.x, y = origin.y;
    for (let k = 0; k < c; k++) x += colW[k] + gapX;
    for (let k = 0; k < r; k++) y += rowH[k] + gapY;
    positions.set(it.id, { x, y });
  });
  return positions;
}
