// Chỗ đặt thẻ mới khi bấm nút `+` trên một thẻ có sẵn, hoặc khi dùng phím tắt
// Enter / Shift+Enter.
//
// Hợp đồng của tính năng này là "bấm hướng nào thì thẻ ra hướng đó" — nên khi
// vướng thẻ khác, thuật toán chỉ được đẩy tiếp theo ĐÚNG hướng đã bấm, không
// bao giờ lệch sang trục vuông góc và không bao giờ đi tìm chỗ trống ở nơi
// khác. Chỗ trống rơi ra ngoài khung nhìn là chuyện bình thường: hàm trả điểm
// cần pan tới, người gọi dời camera theo.

const DIRECTIONS = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0]
};

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/**
 * @param {object}   opts
 * @param {{x,y,w,h}} opts.anchor    thẻ/khung mà thẻ mới mọc ra từ đó
 * @param {{w,h}}    opts.size       kích thước ước lượng của thẻ mới
 * @param {string}   opts.direction  "top" | "right" | "bottom" | "left"
 * @param {Array<{x,y,w,h}>} opts.obstacles  các thẻ đã có (trừ anchor)
 * @param {{x0,y0,x1,y1}=} opts.viewport  vùng canvas đang nhìn thấy, đã trừ lề
 * @returns {{x:number, y:number, panTo:{x,y}|null}} panTo là tâm thẻ mới, chỉ
 *          khác null khi thẻ không nằm gọn trong viewport.
 */
export function placeLinkedNode({
  anchor,
  size,
  direction,
  obstacles = [],
  viewport = null,
  gap = 70,
  step = 60,
  maxSteps = 60
}) {
  const [dx, dy] = DIRECTIONS[direction] || DIRECTIONS.right;

  // Hai tâm thẳng hàng trên trục vuông góc, cách nhau nửa-nửa cộng gap trên
  // trục đã bấm.
  let x = anchor.x + anchor.w / 2 - size.w / 2 + dx * (anchor.w / 2 + gap + size.w / 2);
  let y = anchor.y + anchor.h / 2 - size.h / 2 + dy * (anchor.h / 2 + gap + size.h / 2);

  const blocked = () => obstacles.some((o) => rectsOverlap(x, y, size.w, size.h, o.x, o.y, o.w, o.h));

  let steps = 0;
  while (steps < maxSteps && blocked()) {
    x += dx * step;
    y += dy * step;
    steps++;
  }
  // Hết maxSteps mà vẫn chồng: nhận vị trí cuối. Board dày tới mức đó thì thẻ
  // chồng nhẹ vẫn dễ hiểu hơn là thẻ nhảy sang chỗ chẳng ai bấm tới.

  x = Math.round(x);
  y = Math.round(y);

  let panTo = null;
  if (viewport) {
    const inside =
      x >= viewport.x0 && x + size.w <= viewport.x1 &&
      y >= viewport.y0 && y + size.h <= viewport.y1;
    if (!inside) panTo = { x: x + size.w / 2, y: y + size.h / 2 };
  }

  return { x, y, panTo };
}

/**
 * Thẻ cha của một thẻ, dùng cho Shift+Enter (tạo thẻ cùng cấp = cùng cha).
 *
 * Dây trong bản đồ có hướng và một thẻ chỉ có một cha trong cách dùng thường
 * gặp; nếu ai đó nối nhiều dây tới cùng một thẻ thì lấy dây đầu tiên — đủ tốt
 * cho một phím tắt, và vẫn ổn định vì thứ tự `edges` không tự đổi.
 *
 * Dây đi từ KHUNG không tính: khung không phải một cấp trong cây ý tưởng.
 *
 * @returns {number|null} null khi thẻ không có cha (thẻ gốc).
 */
export function parentNodeId(edges, nodeId) {
  const edge = edges.find(
    (e) => e.to === nodeId && (e.toKind || "node") === "node" && (e.fromKind || "node") === "node"
  );
  return edge ? edge.from : null;
}
