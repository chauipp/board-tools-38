// Mọi phép tính về nét vẽ nằm ở đây, không dính React: nhờ vậy test được bằng
// node:test và IdeaMap không phải mang thêm logic hình học nào.
const MIN_DIST = 2;
const RDP_TOLERANCE = 1;

// Khoảng cách từ điểm P tới ĐOẠN AB (không phải tới đường thẳng AB): kẹp t vào
// [0,1] để điểm nằm ngoài hai đầu đoạn thì đo tới đầu gần nhất.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Ramer–Douglas–Peucker: giữ điểm lệch xa nhất khỏi dây cung, rồi lặp lại cho
// hai nửa. Ghi kết quả vào `keep` thay vì cắt mảng để không cấp phát trung gian.
function rdp(pts, first, last, tolerance, keep) {
  if (last - first < 2) return;
  const ax = pts[first * 2], ay = pts[first * 2 + 1];
  const bx = pts[last * 2], by = pts[last * 2 + 1];
  let maxD = -1, idx = -1;
  for (let i = first + 1; i < last; i++) {
    const d = distToSegment(pts[i * 2], pts[i * 2 + 1], ax, ay, bx, by);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (idx < 0 || maxD <= tolerance) return;
  keep[idx] = true;
  rdp(pts, first, idx, tolerance, keep);
  rdp(pts, idx, last, tolerance, keep);
}

export function simplifyStroke(pts, minDist = MIN_DIST, tolerance = RDP_TOLERANCE) {
  // Làm tròn TRƯỚC rồi mới lọc: toạ độ lưu vào board là số nguyên, nên phép đo
  // khoảng cách phải chạy trên đúng những con số sẽ được lưu.
  const rounded = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = Math.round(pts[i]), y = Math.round(pts[i + 1]);
    if (rounded.length >= 2) {
      const px = rounded[rounded.length - 2], py = rounded[rounded.length - 1];
      if (Math.hypot(x - px, y - py) < minDist) continue;
    }
    rounded.push(x, y);
  }
  const n = rounded.length / 2;
  if (n <= 2) return rounded;

  const keep = new Array(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  rdp(rounded, 0, n - 1, tolerance, keep);

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(rounded[i * 2], rounded[i * 2 + 1]);
  return out;
}

export function strokePath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0]} ${pts[1]} L ${pts[0]} ${pts[1]}`;
  let d = `M ${pts[0]} ${pts[1]}`;
  for (let i = 2; i + 1 < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;
  return d;
}

export function strokesHitBy(drawings, point, radius) {
  const out = [];
  for (const d of drawings || []) {
    const pts = d.pts || [];
    if (pts.length < 2) continue;
    const limit = (d.w || 0) / 2 + radius;
    let hit = false;
    if (pts.length === 2) {
      hit = Math.hypot(point.x - pts[0], point.y - pts[1]) <= limit;
    } else {
      for (let i = 0; i + 3 < pts.length && !hit; i += 2) {
        hit = distToSegment(point.x, point.y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= limit;
      }
    }
    if (hit) out.push(d.id);
  }
  return out;
}
