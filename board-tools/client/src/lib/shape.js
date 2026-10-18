// Mọi phép tính hình học của hình khối nằm ở đây, không dính React: nhờ vậy
// test được bằng node:test và InkLayer chỉ việc gọi shapePath.
//
// pts của một hình khối là ĐÚNG 4 số — hai góc đối [x0,y0,x1,y1] — chứ không
// phải danh sách điểm như nét bút.

import { polylineHitBy, pointInPolygon } from "./stroke.js";
import { textHitBy } from "./text-el.js";

export const SHAPE_KINDS = ["rect", "ellipse", "line", "arrow", "triangle", "diamond"];

// Bốn hình có vùng trong nên tô được. Hai hình còn lại (line, arrow) là hình
// mở: nút "cả hình" ở khu 4 bị vô hiệu khi đang chọn chúng.
export const SHAPE_CLOSED = new Set(["rect", "ellipse", "triangle", "diamond"]);

// Số mẫu khi xấp xỉ ê-líp cho hit-test. 32 mẫu ở kích thước thường sai dưới 1
// đơn vị canvas, và cái giá của sai số chỉ là cục gôm bắt chệch nửa pixel.
const ELLIPSE_SAMPLES = 32;

// Làm tròn về 1 chữ số thập phân trong chuỗi `d`: toạ độ hộp là số nguyên nên
// phần lớn số vẫn ra nguyên, chỉ trung điểm của cạnh lẻ và đầu mũi tên mới có
// phần thập phân. Giữ chuỗi ngắn mà không lệch mắt thấy được.
function r1(v) {
  return Math.round(v * 10) / 10;
}

// Đường chéo ngắn hơn ngưỡng này thì useInk bỏ hình, không tạo hình rác. Đo
// theo ĐƯỜNG CHÉO chứ không theo từng chiều: một đường thẳng ngang dài 200 có
// chiều cao 0, đo từng chiều sẽ bỏ oan.
export const SHAPE_MIN_DIAGONAL = 4;

export function normalizeBox(x0, y0, x1, y1, opts = {}) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  if (opts.square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = dx < 0 ? -side : side;
    dy = dy < 0 ? -side : side;
  } else if (opts.snap) {
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const step = Math.PI / 4;
      const angle = Math.round(Math.atan2(dy, dx) / step) * step;
      dx = len * Math.cos(angle);
      dy = len * Math.sin(angle);
    }
  }
  return [Math.round(x0), Math.round(y0), Math.round(x0 + dx), Math.round(y0 + dy)];
}

// Hộp đã sắp: bốn hình đóng không quan tâm kéo từ góc nào.
function sorted(pts) {
  const [x0, y0, x1, y1] = pts;
  return {
    l: Math.min(x0, x1), t: Math.min(y0, y1),
    r: Math.max(x0, x1), b: Math.max(y0, y1)
  };
}

function ok(kind, pts) {
  return SHAPE_KINDS.includes(kind) && Array.isArray(pts) && pts.length >= 4;
}

export function shapePath(kind, pts) {
  if (!ok(kind, pts)) return "";
  const [x0, y0, x1, y1] = pts;
  const { l, t, r, b } = sorted(pts);
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;

  if (kind === "rect") {
    return `M ${r1(l)} ${r1(t)} L ${r1(r)} ${r1(t)} L ${r1(r)} ${r1(b)} L ${r1(l)} ${r1(b)} Z`;
  }
  if (kind === "ellipse") {
    const rx = (r - l) / 2;
    const ry = (b - t) / 2;
    // Hai nửa cung: một lệnh A không vẽ được vòng kín vì điểm đầu trùng điểm cuối.
    return `M ${r1(l)} ${r1(cy)}`
      + ` A ${r1(rx)} ${r1(ry)} 0 1 0 ${r1(r)} ${r1(cy)}`
      + ` A ${r1(rx)} ${r1(ry)} 0 1 0 ${r1(l)} ${r1(cy)} Z`;
  }
  if (kind === "line") {
    return `M ${r1(x0)} ${r1(y0)} L ${r1(x1)} ${r1(y1)}`;
  }
  if (kind === "arrow") {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const head = Math.max(6, Math.min(18, len * 0.25));
    const a = Math.atan2(y1 - y0, x1 - x0);
    const wing = 0.44;   // ~25 độ mỗi bên
    const lx = x1 - head * Math.cos(a - wing);
    const ly = y1 - head * Math.sin(a - wing);
    const rxp = x1 - head * Math.cos(a + wing);
    const ryp = y1 - head * Math.sin(a + wing);
    return `M ${r1(x0)} ${r1(y0)} L ${r1(x1)} ${r1(y1)}`
      + ` M ${r1(lx)} ${r1(ly)} L ${r1(x1)} ${r1(y1)} L ${r1(rxp)} ${r1(ryp)}`;
  }
  if (kind === "triangle") {
    return `M ${r1(cx)} ${r1(t)} L ${r1(r)} ${r1(b)} L ${r1(l)} ${r1(b)} Z`;
  }
  // diamond
  return `M ${r1(cx)} ${r1(t)} L ${r1(r)} ${r1(cy)} L ${r1(cx)} ${r1(b)} L ${r1(l)} ${r1(cy)} Z`;
}

export function shapeOutline(kind, pts) {
  if (!ok(kind, pts)) return [];
  const [x0, y0, x1, y1] = pts;
  const { l, t, r, b } = sorted(pts);
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;

  // Hình mở: đường bao là chính phần thân. Đầu mũi tên nhỏ và nằm sát ngọn nên
  // đã lọt trong ngưỡng chạm, không cần đưa vào bao.
  if (kind === "line" || kind === "arrow") return [x0, y0, x1, y1];

  if (kind === "ellipse") {
    const rx = (r - l) / 2;
    const ry = (b - t) / 2;
    const out = [];
    for (let i = 0; i < ELLIPSE_SAMPLES; i++) {
      const a = (i / ELLIPSE_SAMPLES) * Math.PI * 2;
      out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    }
    out.push(out[0], out[1]);
    return out;
  }

  let corners;
  if (kind === "rect") corners = [l, t, r, t, r, b, l, b];
  else if (kind === "triangle") corners = [cx, t, r, b, l, b];
  else corners = [cx, t, r, cy, cx, b, l, cy];   // diamond
  // Lặp lại điểm đầu ở cuối: đoạn khép kín cũng phải được đo, không thì cạnh
  // cuối của hình không bắt được chuột.
  corners.push(corners[0], corners[1]);
  return corners;
}

// Hit-test cho CẢ nét bút lẫn hình khối. Nó nằm ở shape.js chứ không ở stroke.js
// vì nó phải biết hình học của từng `kind`, mà chỗ duy nhất biết điều đó là file
// này. Chiều import một phía shape.js → stroke.js, không có vòng.
//
// MỌI kind chỉ có MỘT đường hit-test: đo tới các đoạn của đường bao, cộng
// point-in-polygon trên chính đường bao đó khi `fill` bật.
export function drawingsHitBy(drawings, point, radius) {
  const out = [];
  for (const d of drawings || []) {
    const pts = d.pts || [];
    if (pts.length < 2) continue;
    const limit = (d.w || 0) / 2 + radius;
    const kind = d.kind || "pen";

    if (kind === "pen") {
      if (polylineHitBy(pts, point, limit)) out.push(d.id);
      continue;
    }
    // Text đi nhánh riêng, và cố ý dùng `radius` chứ KHÔNG dùng `limit`: `limit`
    // đã cộng d.w/2 vì với nét bút và hình khối, `w` là độ dày nét — nét càng
    // dày càng dễ chạm. Với text, `w` là BỀ RỘNG HỘP CHỮ. Dùng `limit` ở đây thì
    // một dòng chữ dài 400 đơn vị sẽ có vùng chạm phình thêm 200 đơn vị ra mọi
    // phía. Đây là cái giá của việc để hai loại vật thể khác hẳn nhau dùng chung
    // một mảng `drawings`, và chỗ này là nơi phải trả.
    if (kind === "text") {
      if (textHitBy(d, point, radius)) out.push(d.id);
      continue;
    }
    const outline = shapeOutline(kind, pts);
    if (!outline.length) continue;
    const hit = polylineHitBy(outline, point, limit)
      || (d.fill === true && pointInPolygon(outline, point.x, point.y));
    if (hit) out.push(d.id);
  }
  return out;
}
