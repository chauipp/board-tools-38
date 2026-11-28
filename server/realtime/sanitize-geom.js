// Kiểm gói live:geom trước khi relay cho cả phòng. Di chuyển nguyên văn từ index.js.

// Kênh live:geom giờ chỉ mang ĐÚNG những item đang bị kéo (thường là 1), không
// mang cả board như trước. Chặn ở đây để một client lỗi (hoặc cố tình) không
// bơm được mảng khổng lồ rồi bắt server phát cho cả phòng.
export const MAX_LIVE_GEOM_ITEMS = 200;

export function sanitizeGeom(payload) {
  if (!payload || typeof payload !== "object") return null;
  const nodes = [];
  const groups = [];
  for (const n of Array.isArray(payload.nodes) ? payload.nodes : []) {
    if (nodes.length >= MAX_LIVE_GEOM_ITEMS) break;
    if (!n || !Number.isFinite(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    nodes.push({
      id: n.id, x: n.x, y: n.y,
      w: Number.isFinite(n.w) ? n.w : undefined,
      h: Number.isFinite(n.h) ? n.h : undefined
    });
  }
  for (const g of Array.isArray(payload.groups) ? payload.groups : []) {
    if (groups.length >= MAX_LIVE_GEOM_ITEMS) break;
    if (!g || !Number.isFinite(g.id) || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    groups.push({
      id: g.id, x: g.x, y: g.y,
      w: Number.isFinite(g.w) ? g.w : undefined,
      h: Number.isFinite(g.h) ? g.h : undefined
    });
  }
  if (!nodes.length && !groups.length) return null;
  return { nodes, groups, done: payload.done === true };
}
