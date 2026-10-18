// Sinh path "vẽ tay" cho SVG: dây nối và hình khối rung như vẽ bằng bút chì.
//
// Module này KHÔNG động tới hình học thật. Hit-test (shapeOutline,
// drawingsHitBy), cắt dây vào biên thẻ (clipToRect) và cục gôm vẫn chạy trên
// đường thẳng như cũ — rung chỉ là chuyện hiển thị. Bắt trượt nửa pixel còn hơn
// phải viết lại hit-test cho một hình đang rung.
//
// Chiều import một phía sketchy.js → shape.js, không có vòng.
import { SHAPE_KINDS, shapeOutline } from "./shape.js";

// mulberry32 — PRNG 32 bit gieo được. TUYỆT ĐỐI không dùng Math.random(): độ
// lệch phải là hàm của id thẻ/dây, không phải của thời điểm render. Nếu nó ngẫu
// nhiên thật thì mỗi khung hình nét lại rung một kiểu, và kéo một thẻ là cả bản
// đồ giật.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a: id nào — số hay chuỗi — cũng ra một seed ổn định.
export function seedFrom(value) {
  const s = String(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const MIN_AMP = 0.6, MAX_AMP = 4, AMP_RATIO = 0.02;
// Trần là thứ bắt buộc: không có nó thì một dây dài 900 đơn vị uốn thành con rắn.
// Sàn cũng vậy: một đoạn 10 đơn vị mà lệch 0.2 thì nhìn y như đường thẳng.
export function amplitude(len) {
  return Math.min(MAX_AMP, Math.max(MIN_AMP, len * AMP_RATIO));
}

// Hai đầu chỉ lệch bằng 0.4 lần biên độ thân: đầu dây phải còn dính vào mép
// thẻ, lệch nhiều là nhìn ra ngay chỗ hở.
const END_RATIO = 0.4;
const ELLIPSE_STEPS = 16;

const r1 = (v) => Math.round(v * 10) / 10;

// Một đoạn thẳng thành một đoạn cong rung. Độ lệch chỉ lấy từ `rand` và `amp`,
// KHÔNG lấy từ toạ độ tuyệt đối — nhờ vậy kéo thẻ thì dây uốn theo mượt thay vì
// nhảy sang một hình rung khác ở mỗi khung hình.
function wobble(x1, y1, x2, y2, rand, amp) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return "";
  const nx = -dy / len, ny = dx / len;
  const off = () => (rand() * 2 - 1) * amp;

  const s = off() * END_RATIO, e = off() * END_RATIO;
  const c1 = off(), c2 = off();
  const sx = x1 + nx * s, sy = y1 + ny * s;
  const ex = x2 + nx * e, ey = y2 + ny * e;
  const c1x = x1 + dx / 3 + nx * c1, c1y = y1 + dy / 3 + ny * c1;
  const c2x = x1 + (dx * 2) / 3 + nx * c2, c2y = y1 + (dy * 2) / 3 + ny * c2;
  return `M${r1(sx)} ${r1(sy)} C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(ex)} ${r1(ey)}`;
}

export function sketchyLine(x1, y1, x2, y2, seed, opts = {}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len === 0) return "";
  const amp = opts.amp ?? amplitude(len);
  const passes = opts.passes ?? 2;
  const rand = opts.rand ?? rng(seed);
  const parts = [];
  // Hai lượt dùng CHUNG một `rand`: lượt sau lấy tiếp dãy số nên tự lệch khác
  // lượt trước — đúng cái nhìn "vẽ đi vẽ lại một nét".
  for (let i = 0; i < passes; i++) parts.push(wobble(x1, y1, x2, y2, rand, amp));
  return parts.filter(Boolean).join(" ");
}

// Đường gấp khúc (mảng số phẳng, điểm cuối trùng điểm đầu với hình đóng) → nét
// rung từng cạnh.
function wobblePolyline(flat, rand, amp) {
  const parts = [];
  for (let i = 0; i + 3 < flat.length; i += 2) {
    parts.push(wobble(flat[i], flat[i + 1], flat[i + 2], flat[i + 3], rand, amp));
  }
  return parts.filter(Boolean).join(" ");
}

// Nối các điểm bằng đường cong bậc hai đi qua TRUNG ĐIỂM từng cạnh, đỉnh làm
// điểm điều khiển. Đây là cách làm trơn một đa giác mà không cần Catmull-Rom.
function smoothClosed(pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${r1(start[0])} ${r1(start[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    d += ` Q${r1(p[0])} ${r1(p[1])} ${r1(m[0])} ${r1(m[1])}`;
  }
  return d + " Z";
}

// Ê-líp đi đường riêng: nhiễu BÁN KÍNH ở 16 mẫu rồi làm trơn, chứ không rung
// từng cạnh của đa giác 32 đỉnh như ba hình đóng kia — 32 đoạn cong nhỏ mỗi
// đoạn một bezier trông ra răng cưa chứ không ra nét bút.
function sketchyEllipse(l, t, r, b, rand, amp, passes) {
  const cx = (l + r) / 2, cy = (t + b) / 2;
  const rx = (r - l) / 2, ry = (b - t) / 2;
  if (rx <= 0 && ry <= 0) return "";
  const parts = [];
  for (let p = 0; p < passes; p++) {
    const pts = [];
    for (let i = 0; i < ELLIPSE_STEPS; i++) {
      const a = (i / ELLIPSE_STEPS) * Math.PI * 2;
      const j = (rand() * 2 - 1) * amp;
      pts.push([cx + (rx + j) * Math.cos(a), cy + (ry + j) * Math.sin(a)]);
    }
    parts.push(smoothClosed(pts));
  }
  return parts.join(" ");
}

// Cùng chữ ký với shapePath(kind, pts) cộng một seed, nên chỗ gọi chỉ việc đổi
// tên hàm. Trả "" đúng những trường hợp shapePath trả "".
export function sketchyPath(kind, pts, seed) {
  if (!SHAPE_KINDS.includes(kind) || !Array.isArray(pts) || pts.length < 4) return "";
  const [x0, y0, x1, y1] = pts;
  // Quét MỌI cặp số, không chỉ hai góc đầu: tam giác có thể mang ba đỉnh (6 số,
  // xem ghi chú đầu shape.js) và lấy hộp của riêng hai đỉnh đầu sẽ ra một đường
  // chéo cụt — tức biên độ rung tính sai, hình to mà nét rung như hình bé.
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (pts[i] < l) l = pts[i];
    if (pts[i] > r) r = pts[i];
    if (pts[i + 1] < t) t = pts[i + 1];
    if (pts[i + 1] > b) b = pts[i + 1];
  }
  // Biên độ tính theo ĐƯỜNG CHÉO của cả hình, không theo từng cạnh: đo theo
  // cạnh thì một hình chữ nhật 300x20 có cạnh ngắn rung ít, cạnh dài rung nhiều
  // — nhìn ra ngay là hai nét của hai người khác nhau.
  const amp = amplitude(Math.hypot(r - l, b - t));
  const rand = rng(seed);
  const passes = 2;

  if (kind === "line") return sketchyLine(x0, y0, x1, y1, seed, { rand, amp, passes });

  if (kind === "arrow") {
    // Đúng công thức đầu mũi tên của shapePath — hai chỗ phải khớp nhau, không
    // thì bật/tắt skin là mũi tên đổi cỡ.
    const len = Math.hypot(x1 - x0, y1 - y0);
    const head = Math.max(6, Math.min(18, len * 0.25));
    const a = Math.atan2(y1 - y0, x1 - x0);
    const wing = 0.44;
    const shaft = sketchyLine(x0, y0, x1, y1, seed, { rand, amp, passes });
    // Hai gạch đầu mũi tên chỉ vẽ MỘT lượt: chúng ngắn, vẽ hai lượt thành một
    // vệt dày cộm ở ngọn.
    const w1 = wobble(x1 - head * Math.cos(a - wing), y1 - head * Math.sin(a - wing), x1, y1, rand, amp);
    const w2 = wobble(x1, y1, x1 - head * Math.cos(a + wing), y1 - head * Math.sin(a + wing), rand, amp);
    return [shaft, w1, w2].filter(Boolean).join(" ");
  }

  if (kind === "ellipse") return sketchyEllipse(l, t, r, b, rand, amp, passes);

  // rect / triangle / diamond / quad — đường bao đã khép sẵn (shapeOutline lặp lại
  // điểm đầu ở cuối), nên chỉ cần rung từng cạnh rồi đóng Z.
  const outline = shapeOutline(kind, pts);
  if (!outline.length) return "";
  const parts = [];
  for (let p = 0; p < passes; p++) parts.push(wobblePolyline(outline, rand, amp) + " Z");
  return parts.filter((s) => s.trim() !== "Z").join(" ");
}
