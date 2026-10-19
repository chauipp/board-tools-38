import { nodesInFrame } from "./board-geometry.js";

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
export const TREE_DIRECTIONS = ["down", "up", "right", "left"];
const DEFAULT_GAP = { depth: 70, breadth: 28 };

// Optional persisted slots are hints: malformed entries never disable a tree.
// Actual parentage is checked against BFS below, after these shape checks.
export function normalizeTreeSlots(value, directions) {
  const entries = (v) => v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v) : [];
  const key = (v) => typeof v === "string" && /^(node|group):.+$/.test(v);
  const siblingOrder = Object.fromEntries(entries(value?.siblingOrder)
    .filter(([parent, kids]) => key(parent) && Array.isArray(kids) && kids.every(key))
    .map(([parent, kids]) => [parent, [...new Set(kids)]]));
  const branchDirections = Object.fromEntries(entries(value?.branchDirections)
    .filter(([child, dir]) => key(child) && directions.includes(dir)));
  return {
    ...(Object.keys(siblingOrder).length ? { siblingOrder } : {}),
    ...(Object.keys(branchDirections).length ? { branchDirections } : {})
  };
}

function isVertical(direction) {
  return direction === "down" || direction === "up";
}

// Hướng dọc thì bề ngang thẻ nằm trên trục breadth, chiều cao nằm trên trục
// depth; hướng ngang thì đổi vai.
function axisSize(size, vertical) {
  return vertical
    ? { breadth: size.w, depth: size.h }
    : { breadth: size.h, depth: size.w };
}

// Khoảng cách giữa hai anh em kề nhau. Hai LÁ kề nhau dùng trị riêng: hàng cuối
// cùng của cây thường là chỗ muốn bó sát lại (hoặc nới ra) mà không kéo theo
// khoảng cách giữa các nhánh lớn phía trên.
function siblingGap(a, b, children, g) {
  const leaf = (k) => (children.get(k) || []).length === 0;
  return leaf(a) && leaf(b) ? g.leaf : g.breadth;
}

// Bề rộng một hàng anh em = tổng span của từng đứa + các khe giữa chúng.
function rowSpan(kids, span, children, g) {
  let total = 0;
  kids.forEach((k, i) => {
    if (i > 0) total += siblingGap(kids[i - 1], k, children, g);
    total += span.get(k);
  });
  return total;
}

// Bề rộng nhánh tính từ dưới lên: lá chiếm đúng cỡ của nó, thẻ có con chiếm
// phần lớn hơn giữa (cỡ chính nó) và (bề rộng hàng con) — nên nhánh ít con
// không chiếm chỗ thừa. `order` là thứ tự BFS nên duyệt ngược là từ lá lên.
function spansOf(order, children, breadthSize, g) {
  const span = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const key = order[i];
    const kids = children.get(key) || [];
    const own = breadthSize(key);
    span.set(key, kids.length === 0 ? own : Math.max(own, rowSpan(kids, span, children, g)));
  }
  return span;
}

// Cây con chỉ gồm gốc + đúng những nhánh được giao cho một hướng. Bản đồ children
// giữ nguyên cho các tầng dưới, chỉ hàng con của gốc bị thay.
function branchOf(rootKey, children, kids) {
  const sub = new Map(children);
  sub.set(rootKey, kids);
  const order = [rootKey];
  for (let i = 0; i < order.length; i++) {
    (sub.get(order[i]) || []).forEach((k) => order.push(k));
  }
  return { order, children: sub };
}

// Chia các nhánh con của gốc về từng hướng sao cho hai (ba, bốn) phía nặng ngang
// nhau: nhánh to chia trước, luôn rơi vào phía đang nhẹ nhất. Trong mỗi phía
// vẫn giữ đúng thứ tự nối dây ban đầu, nên nhìn vẫn đoán được đâu là nhánh nào.
export function splitBranches(kids, weightOf, count) {
  if (count <= 1) return [kids.slice()];
  const picks = Array.from({ length: count }, () => []);
  const load = new Array(count).fill(0);
  kids
    .map((k, i) => i)
    .sort((a, b) => (weightOf(kids[b]) - weightOf(kids[a])) || (a - b))
    .forEach((i) => {
      let at = 0;
      for (let j = 1; j < count; j++) if (load[j] < load[at]) at = j;
      picks[at].push(i);
      load[at] += weightOf(kids[i]);
    });
  return picks.map((list) => list.sort((a, b) => a - b).map((i) => kids[i]));
}

// Toạ độ trên hệ quy chiếu riêng của một hướng (gốc chưa dịch về chỗ thật).
function layoutBranch({ order, children, sizeOf, rootKey, direction, g, persistedSlots }) {
  const vertical = isVertical(direction);
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

  const span = spansOf(order, children, (key) => size.get(key).breadth, g);

  // Rải theo trục breadth từ trên xuống: mỗi thẻ nằm giữa khoảng đã cấp cho
  // nhánh của nó, các con chia nhau khoảng đó theo đúng span của từng đứa.
  const breadthOf = new Map();
  function place(key, start) {
    const own = size.get(key).breadth;
    const mine = span.get(key);
    breadthOf.set(key, start + (mine - own) / 2);
    const kids = children.get(key) || [];
    if (kids.length === 0) return;
    let at = start + (mine - rowSpan(kids, span, children, g)) / 2;  // cha to hơn con: con dồn vào giữa
    kids.forEach((k, i) => {
      if (i > 0) at += siblingGap(kids[i - 1], k, children, g);
      place(k, at);
      at += span.get(k);
    });
  }
  place(rootKey, 0);

  const sign = direction === "up" || direction === "left" ? -1 : 1;
  const raw = new Map();
  order.forEach((key) => {
    const b = breadthOf.get(key);
    // Saved slots reflect rectangle edges, so a larger swapped branch cannot
    // grow back into its parent. Trees without saved slots retain legacy positions.
    const correction = persistedSlots && sign < 0 ? size.get(rootKey).depth - size.get(key).depth : 0;
    const d = depthStart[depthOf.get(key)] * sign + correction;
    raw.set(key, vertical ? { x: b, y: d } : { x: d, y: b });
  });
  return raw;
}

// `directions` là danh sách hướng (1–4). Nhiều hướng thì các nhánh con của gốc
// được chia về từng hướng, mỗi phía chạy đúng một lần thuật toán trên, và gốc
// là điểm neo chung của mọi phía — đó là hình sao/mindmap toả ra hai bên.
// `direction` (số ít) vẫn nhận được, coi như danh sách một phần tử.
export function treeLayoutBranches({ edges, rootKey, sizeOf, direction, directions, gap, siblingOrder, branchDirections }) {
  const g = { ...DEFAULT_GAP, ...(gap || {}) };
  if (g.leaf == null) g.leaf = g.breadth;
  const dirs = (directions && directions.length ? directions : [direction || "down"])
    .filter((d) => TREE_DIRECTIONS.includes(d));
  const dirList = dirs.length ? dirs : ["down"];

  const { order, children } = buildTree(edges, rootKey);
  const slots = normalizeTreeSlots({ siblingOrder, branchDirections }, dirList);
  for (const [parent, kids] of children) {
    const saved = slots.siblingOrder?.[parent] || [];
    const current = new Set(kids);
    const ordered = saved.filter((key) => current.has(key));
    const placed = new Set(ordered);
    children.set(parent, [...ordered, ...kids.filter((key) => !placed.has(key))]);
  }
  const rootKids = children.get(rootKey) || [];
  if (!rootKids.length) return { children, g, dirList, buckets: dirList.map(() => []), persistedSlots: false };

  // Cân theo bề rộng thật của nhánh, đo trên trục breadth của hướng ĐẦU TIÊN —
  // hai hướng đối nhau (lên/xuống, trái/phải) dùng chung trục nên đo thế là
  // chính xác; trường hợp trộn trục (lên + phải) thì đây là ước lượng.
  const weightVertical = isVertical(dirList[0]);
  const weight = spansOf(order, children, (key) => axisSize(sizeOf(key), weightVertical).breadth, g);
  const defaults = splitBranches(rootKids, (key) => weight.get(key), dirList.length);
  const assigned = new Map(defaults.flatMap((kids, i) => kids.map((key) => [key, dirList[i]])));
  const buckets = dirList.map((dir) => rootKids.filter((key) =>
    (slots.branchDirections?.[key] || assigned.get(key)) === dir));
  const persistedSlots = rootKids.some((key) => slots.branchDirections?.[key]);
  return { children, g, dirList, buckets, persistedSlots };
}

export function treeLayout({ rootKey, rootPos, sizeOf, ...options }) {
  const { children, g, dirList, buckets, persistedSlots } = treeLayoutBranches({ ...options, rootKey, sizeOf });
  const positions = new Map([[rootKey, { x: Math.round(rootPos.x), y: Math.round(rootPos.y) }]]);

  dirList.forEach((dir, i) => {
    const kids = buckets[i];
    if (!kids || kids.length === 0) return;
    const branch = branchOf(rootKey, children, kids);
    const raw = layoutBranch({ ...branch, sizeOf, rootKey, direction: dir, g, persistedSlots });
    // Dịch cả phía này một lần sao cho gốc rơi đúng chỗ nó đang đứng — người
    // dùng thấy gốc bất động, cây mọc ra quanh nó.
    const rootRaw = raw.get(rootKey);
    const dx = rootPos.x - rootRaw.x, dy = rootPos.y - rootRaw.y;
    raw.forEach((p, key) => {
      if (key === rootKey) return;
      positions.set(key, { x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
    });
  });
  return positions;
}

// Khung (group) trong cây bị treeLayout dời chỗ, nhưng thẻ nằm trong khung đó
// mà không có dây nối riêng thì không nằm trong `pos` — đứng yên trong khi
// khung dời đi, nên rớt ra ngoài khung. Hàm này dời thêm những thẻ đó theo
// đúng độ lệch của khung chứa nó, để chúng đi theo khung.
export function carryGroupMembers(pos, groups, nodes, sizeOf) {
  const extra = new Map();
  groups.forEach((g) => {
    const p = pos.get(edgeKey("group", g.id));
    if (!p || g.locked) return;
    const dx = p.x - g.x, dy = p.y - g.y;
    if (dx === 0 && dy === 0) return;
    nodesInFrame(nodes, g, sizeOf).forEach((id) => {
      if (pos.has(edgeKey("node", id)) || extra.has(id)) return;   // đã có chỗ riêng trong cây
      const n = nodes.find((nn) => nn.id === id);
      if (!n || n.locked) return;
      extra.set(id, { x: n.x + dx, y: n.y + dy });
    });
  });
  return extra;
}
