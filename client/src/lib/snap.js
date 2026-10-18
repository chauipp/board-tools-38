// Ứng viên mỗi trục: trái/giữa/phải (dọc) và trên/giữa/dưới (ngang) của bbox đang kéo
// so với cùng bộ mốc của mọi bbox khác. Trong ngưỡng → chỉnh theo ứng viên lệch ít nhất.
function anchors1D(pos, size) { return [pos, pos + size / 2, pos + size]; }

export function computeSnap(moving, others, threshold) {
  let best = { v: null, h: null };
  const mv = anchors1D(moving.x, moving.w);
  const mh = anchors1D(moving.y, moving.h);
  others.forEach((o) => {
    anchors1D(o.x, o.w).forEach((op) => {
      mv.forEach((mp) => {
        const d = op - mp;
        if (Math.abs(d) <= threshold && (best.v == null || Math.abs(d) < Math.abs(best.v.d))) {
          best.v = { d, pos: op, other: o };
        }
      });
    });
    anchors1D(o.y, o.h).forEach((op) => {
      mh.forEach((mp) => {
        const d = op - mp;
        if (Math.abs(d) <= threshold && (best.h == null || Math.abs(d) < Math.abs(best.h.d))) {
          best.h = { d, pos: op, other: o };
        }
      });
    });
  });
  const guides = [];
  if (best.v && best.v.d !== 0) {
    guides.push({
      axis: "v", pos: best.v.pos,
      start: Math.min(moving.y, best.v.other.y),
      end: Math.max(moving.y + moving.h, best.v.other.y + best.v.other.h)
    });
  }
  if (best.h && best.h.d !== 0) {
    guides.push({
      axis: "h", pos: best.h.pos,
      start: Math.min(moving.x, best.h.other.x),
      end: Math.max(moving.x + moving.w, best.h.other.x + best.h.other.w)
    });
  }
  // d === 0 (đã khớp) → không chỉnh, không vẽ guide (tránh guide nhấp nháy khi đứng yên)
  return { dx: best.v && best.v.d !== 0 ? best.v.d : 0, dy: best.h && best.h.d !== 0 ? best.h.d : 0, guides };
}
