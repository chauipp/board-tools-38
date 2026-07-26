// Cây dựng từ dây nối, không phải từ toạ độ: một thẻ là con của thẻ nào phụ
// thuộc vào đường đi ngắn nhất từ gốc, nên duyệt theo chiều rộng (BFS).
export function edgeKey(kind, id) {
  return kind + ":" + id;
}

export function buildTree(edges, rootKey) {
  // Con là thẻ có mũi tên đi ra từ cha: dây vô hướng (arrow: "none") hoặc dây
  // đi ngược (mũi tên chỉ vào cha) không tạo quan hệ cha-con trên cây.
  const neighbors = new Map();
  function link(a, b) {
    if (a === b) return;                      // dây tự nối: không phải quan hệ
    if (!neighbors.has(a)) neighbors.set(a, []);
    neighbors.get(a).push(b);
  }
  edges.forEach((e) => {
    if (e.arrow === "none") return;           // vô hướng: không thuộc cây
    const a = edgeKey(e.fromKind || "node", e.from);
    const b = edgeKey(e.toKind || "node", e.to);
    link(a, b);
  });

  const order = [rootKey];
  const children = new Map();
  const visited = new Set([rootKey]);
  // BFS: thẻ đã ghé thì bỏ qua, nên chu trình tự dừng và thẻ có hai "cha" chỉ
  // thuộc về cha gặp trước — không cần dò vòng lặp riêng.
  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    (neighbors.get(key) || []).forEach((next) => {
      if (visited.has(next)) return;
      visited.add(next);
      order.push(next);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(next);
    });
  }
  return { order, children };
}

// Xếp cây trên hai trục trừu tượng rồi mới đổ ra x/y: "depth" là tầng (số bước
// từ gốc), "breadth" là chỗ đứng trong hàng anh em. Nhờ vậy một cách tính dùng
// được cho cả bốn hướng, chỉ khác nhau ở bước ánh xạ cuối.
const DEFAULT_GAP = { depth: 70, breadth: 28 };

// Hướng dọc thì bề ngang thẻ nằm trên trục breadth, chiều cao nằm trên trục
// depth; hướng ngang thì đổi vai.
function axisSize(size, vertical) {
  return vertical
    ? { breadth: size.w, depth: size.h }
    : { breadth: size.h, depth: size.w };
}

export function treeLayout({ edges, rootKey, rootPos, sizeOf, direction, gap }) {
  const g = { ...DEFAULT_GAP, ...(gap || {}) };
  const vertical = direction === "down" || direction === "up";
  const { order, children } = buildTree(edges, rootKey);
  const size = new Map(order.map((key) => [key, axisSize(sizeOf(key), vertical)]));

  // Tầng: mọi thẻ cùng tầng dùng chung một mốc depth, mốc sau = mốc trước +
  // thẻ dày nhất của tầng trước + gap. Đó là điều kiện để chúng thẳng hàng dù
  // cao thấp khác nhau.
  const depthOf = new Map([[rootKey, 0]]);
  order.forEach((key) => {
    (children.get(key) || []).forEach((child) => depthOf.set(child, depthOf.get(key) + 1));
  });
  const thickest = [];
  order.forEach((key) => {
    const d = depthOf.get(key);
    thickest[d] = Math.max(thickest[d] || 0, size.get(key).depth);
  });
  const depthStart = [0];
  for (let d = 1; d < thickest.length; d++) {
    depthStart[d] = depthStart[d - 1] + thickest[d - 1] + g.depth;
  }

  // Bề rộng nhánh tính từ dưới lên: lá chiếm đúng cỡ của nó, thẻ có con chiếm
  // phần lớn hơn giữa (cỡ chính nó) và (tổng các nhánh con + gap) — nên nhánh
  // ít con không chiếm chỗ thừa.
  const span = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const key = order[i];
    const kids = children.get(key) || [];
    const own = size.get(key).breadth;
    if (kids.length === 0) { span.set(key, own); continue; }
    const kidsSpan = kids.reduce((sum, k) => sum + span.get(k), 0) + g.breadth * (kids.length - 1);
    span.set(key, Math.max(own, kidsSpan));
  }

  // Rải theo trục breadth từ trên xuống: mỗi thẻ nằm giữa khoảng đã cấp cho
  // nhánh của nó, các con chia nhau khoảng đó theo đúng span của từng đứa.
  const breadthOf = new Map();
  function place(key, start) {
    const own = size.get(key).breadth;
    const mine = span.get(key);
    breadthOf.set(key, start + (mine - own) / 2);
    const kids = children.get(key) || [];
    if (kids.length === 0) return;
    const kidsSpan = kids.reduce((sum, k) => sum + span.get(k), 0) + g.breadth * (kids.length - 1);
    let at = start + (mine - kidsSpan) / 2;   // cha to hơn con: con dồn vào giữa
    kids.forEach((k) => { place(k, at); at += span.get(k) + g.breadth; });
  }
  place(rootKey, 0);

  // Đổ hai trục ra x/y theo hướng, rồi dịch cả cây một lần sao cho gốc rơi đúng
  // chỗ nó đang đứng — người dùng thấy gốc bất động, cây mọc ra quanh nó.
  const sign = direction === "up" || direction === "left" ? -1 : 1;
  const raw = new Map();
  order.forEach((key) => {
    const b = breadthOf.get(key);
    const d = depthStart[depthOf.get(key)] * sign;
    raw.set(key, vertical ? { x: b, y: d } : { x: d, y: b });
  });
  const rootRaw = raw.get(rootKey);
  const dx = rootPos.x - rootRaw.x, dy = rootPos.y - rootRaw.y;
  const positions = new Map();
  raw.forEach((p, key) => {
    positions.set(key, { x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
  });
  return positions;
}
