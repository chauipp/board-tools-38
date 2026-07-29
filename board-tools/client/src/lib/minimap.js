// Bản đồ thu nhỏ: toàn bộ phép tính nằm ở đây, không dính React hay DOM, nên
// test được bằng node:test như mọi lib khác.
//
// Kích thước thẻ dùng ở đây là kích thước DANH NGHĨA (bề rộng đã lưu, chiều cao
// cố định), KHÔNG đo DOM: minimap vẽ mỗi thẻ ra chừng 3px, sai vài pixel không
// ai thấy — trong khi đo DOM cho cả trăm thẻ ở mỗi nhịp kéo chuột chính là thứ
// đã từng làm bản đồ giật (xem ghi chú dài ở handleNodeMouseDown).
export const MINI_NODE_H = 110;

export function rectsOf(board, defaultW, nodeBox) {
  const nodes = (board.nodes || []).map((n) => ({
    id: n.id,
    x: n.x, y: n.y,
    w: n.w || defaultW, h: MINI_NODE_H,
    color: n.color ?? null
  }));
  const groups = (board.groups || []).map((g) => ({
    id: g.id, x: g.x, y: g.y, w: g.w, h: g.h, color: g.color ?? null
  }));
  const inks = [];
  (board.drawings || []).forEach((d) => {
    const b = nodeBox(d);
    if (b) inks.push({ id: d.id, x: b.x, y: b.y, w: b.w, h: b.h });
  });
  return { nodes, groups, inks };
}

export function boundsOf(lists) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  lists.forEach((list) => list.forEach((r) => {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
  }));
  if (minX === Infinity) return null;                 // bảng trắng: không có gì để thu nhỏ
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Vùng đang nhìn thấy, quy về toạ độ canvas.
export function viewRect(view, size) {
  return {
    x: -view.panX / view.scale,
    y: -view.panY / view.scale,
    w: size.w / view.scale,
    h: size.h / view.scale
  };
}

export function unionRect(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {
    x, y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y
  };
}

// Phép co vùng `area` cho vừa khung `box`, giữ đúng tỉ lệ và căn giữa.
// Toạ độ mini = toạ độ canvas * scale + dx/dy.
export function fitTransform(area, box, pad = 6) {
  const w = Math.max(area.w, 1), h = Math.max(area.h, 1);
  const innerW = Math.max(box.w - pad * 2, 1), innerH = Math.max(box.h - pad * 2, 1);
  const scale = Math.min(innerW / w, innerH / h);
  return {
    scale,
    dx: pad + (innerW - w * scale) / 2 - area.x * scale,
    dy: pad + (innerH - h * scale) / 2 - area.y * scale
  };
}

export function toMini(x, y, t) {
  return { x: x * t.scale + t.dx, y: y * t.scale + t.dy };
}

export function toCanvas(x, y, t) {
  return { x: (x - t.dx) / t.scale, y: (y - t.dy) / t.scale };
}

// Pan mới để một điểm canvas rơi vào GIỮA khung nhìn. Chỉ đổi pan, không đụng
// scale: bấm vào minimap là "đi tới chỗ đó", không phải "phóng to chỗ đó".
export function panForCenter(pt, view, size) {
  return {
    panX: size.w / 2 - pt.x * view.scale,
    panY: size.h / 2 - pt.y * view.scale
  };
}
