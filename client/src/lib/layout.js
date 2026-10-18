// Xếp theo tầng: mỗi cạnh chạy từ cột k sang cột k+1, nên dây nằm trong khoảng
// trống giữa hai cột chứ không chui dưới thẻ. Lưới vuông thì thẻ nào cũng có thể
// đứng đúng trên đường nối hai thẻ khác — nhìn ra là thẻ đè lên dây.
export function layerLayout(items, edges, origin, gapX = 90, gapY = 28) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const links = edges.filter((e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);
  const depth = new Map(items.map((it) => [it.id, 0]));
  // Nới dần thay vì duyệt sâu: chu trình tự dừng sau n lượt, không cần dò vòng.
  for (let i = 0; i < items.length; i++) {
    let moved = false;
    for (const e of links) {
      if (depth.get(e.to) < depth.get(e.from) + 1) { depth.set(e.to, depth.get(e.from) + 1); moved = true; }
    }
    if (!moved) break;
  }

  const linked = new Set(links.flatMap((e) => [e.from, e.to]));
  const cols = new Map();
  items.filter((it) => linked.has(it.id)).forEach((it) => {
    const d = depth.get(it.id);
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d).push(it);   // giữ thứ tự caller truyền vào = thứ tự đọc cũ
  });

  const positions = new Map();
  let x = origin.x, bottom = origin.y;
  Array.from(cols.keys()).sort((a, b) => a - b).forEach((d) => {
    const col = cols.get(d);
    let y = origin.y;
    col.forEach((it) => { positions.set(it.id, { x, y }); y += it.h + gapY; });
    bottom = Math.max(bottom, y - gapY);
    x += Math.max(...col.map((it) => it.w)) + gapX;
  });

  // Thẻ không dây nào thì không thuộc tầng nào — xếp lưới thành khối riêng bên
  // dưới, cách ra một khoảng cột để đọc được là "nhóm rời".
  const loose = items.filter((it) => !linked.has(it.id));
  if (loose.length) {
    const at = { x: origin.x, y: cols.size ? bottom + gapX : origin.y };
    gridLayout(loose, at, Math.ceil(Math.sqrt(loose.length)), gapY, gapY)
      .forEach((p, id) => positions.set(id, p));
  }
  return positions;
}

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
