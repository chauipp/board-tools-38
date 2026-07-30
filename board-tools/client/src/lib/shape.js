// Mọi phép tính hình học của hình khối nằm ở đây, không dính React: nhờ vậy
// test được bằng node:test và InkLayer chỉ việc gọi shapePath.
//
// HAI DẠNG pts, và mọi hàm dưới đây đọc được cả hai:
//
//   HỘP BAO — 4 số, hai góc đối [x0,y0,x1,y1]. Đây là thứ tool Hình khối tạo ra:
//     người dùng kéo một cái hộp, và hình được dựng vừa khít trong hộp đó. Hệ quả
//     là hình luôn "chuẩn": chữ nhật thẳng trục, tam giác CÂN (đỉnh giữa cạnh
//     trên), hình thoi đối xứng.
//
//   ĐỈNH THẬT — 2N số [x1,y1,x2,y2,…]. Dùng cho hình mà dáng KHÔNG suy ra được
//     từ một cái hộp: tam giác vuông/tù/bè/nghiêng, hình bình hành, hình thang,
//     tứ giác bất kỳ. Sinh ra từ hai chỗ: nhận hình từ nét vẽ tay (recognize.js)
//     và kéo tay cầm đỉnh (shapeHandles/moveShapeHandle bên dưới).
//
// VERTEX_NUMBERS là bảng tra duy nhất quyết định kind nào có dạng đỉnh thật và
// bao nhiêu đỉnh. Thêm một hình N đỉnh mới chỉ là thêm một dòng vào đó cộng một
// nhãn ở ToolOptions — không phải rắc `if (kind === …)` vào từng hàm.
//
// Vì sao KHÔNG gom "tam giác 3 đỉnh" và "tứ giác 4 đỉnh" thành một kind "poly"
// duy nhất: kind là thứ người dùng nhìn thấy tên (menu, nhãn, sau này là bộ
// lọc). Bên trong thì chúng đã đi CHUNG một đường rồi — shapeVertices() là chỗ
// duy nhất biết dạng đỉnh thật, mọi hàm khác chỉ hỏi nó.

import { polylineHitBy, pointInPolygon } from "./stroke.js";
import { textHitBy } from "./text-el.js";

// MỌI kind hợp lệ, kể cả kind không vẽ trực tiếp được.
export const SHAPE_KINDS = ["rect", "ellipse", "line", "arrow", "triangle", "diamond", "quad"];

// Nút có mặt trên bảng chọn ở khu 4, theo đúng thứ tự hiện ra. Cũng là danh
// sách mà pen.js dùng để lọc lựa chọn đã lưu trong localStorage.
//
// ĐÂY LÀ ID CỦA NÚT, KHÔNG PHẢI KIND LƯU VÀO BOARD. Hai cái cuối đều lưu ra
// "quad" — xem TOOL_KIND ngay dưới.
export const SHAPE_TOOL_KINDS = [
  "rect", "ellipse", "line", "arrow", "triangle", "diamond", "parallelogram", "trapezoid"
];

// Nút nào lưu ra kind khác tên nó. Hình bình hành và hình thang chỉ khác nhau ở
// DÁNG KHỞI ĐẦU khi kéo hộp — cùng bốn đỉnh tự do, cùng cách vẽ, cùng tay cầm.
//
// Không đặt cho chúng hai kind riêng, và lý do rất cụ thể: kéo một cái góc là
// hình hết còn là hình thang. Một kind tên "trapezoid" sẽ thành cái tên nói dối
// ngay ở thao tác đầu tiên người ta làm với nó, còn "quad" — tứ giác bất kỳ —
// thì đúng mãi mãi.
const TOOL_KIND = { parallelogram: "quad", trapezoid: "quad" };

// Nút ở khu 4 → kind lưu vào board.
export function shapeKindOf(tool) {
  return TOOL_KIND[tool] || tool;
}

// Hình có vùng trong nên tô được. Hai hình còn lại (line, arrow) là hình mở: nút
// "cả hình" ở khu 4 bị vô hiệu khi đang chọn chúng.
export const SHAPE_CLOSED = new Set(["rect", "ellipse", "triangle", "diamond", "quad"]);

// Kind nào có dạng ĐỈNH THẬT, và bao nhiêu toạ độ. Xem ghi chú đầu file.
export const VERTEX_NUMBERS = { triangle: 6, quad: 8 };

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

// Độ xiên mặc định khi kéo hộp, tính theo bề rộng hộp. Đủ để nhìn ra ngay là
// hình bình hành / hình thang chứ không phải chữ nhật vẽ lệch, mà chưa xiên tới
// mức thành một cái nêm.
const SLANT = { parallelogram: 0.25, trapezoid: 0.22 };

// Hộp vừa kéo → pts đúng dáng của nút đang chọn. Đây là chỗ DUY NHẤT đặt dáng
// khởi đầu cho hai hình lưu bằng đỉnh thật; useInk gọi nó ở cả ba chỗ cần pts
// (lúc ấn xuống, lúc kéo, lúc chốt) nên không có đường nào lọt ra ngoài với một
// cái hộp 4 số.
//
// Tam giác KHÔNG đi qua đây dù nó cũng có dạng đỉnh thật: tam giác ở dạng hộp
// bao đã là một hình đúng — tam giác cân — và đó chính là thứ nút tam giác vẽ
// ra. Còn tứ giác ở dạng hộp bao thì không tả được gì cả.
export function ptsFromBox(tool, box) {
  const slant = SLANT[tool];
  if (!slant || !Array.isArray(box) || box.length < 4) return box;
  const { l, t, r, b } = sorted(box);
  const d = Math.round((r - l) * slant);
  // Hình bình hành: cạnh trên thụt vào một bên, cạnh dưới thụt ra bên kia — hai
  // cạnh xiên song song. Hình thang: cạnh trên thụt vào CẢ HAI bên.
  return tool === "trapezoid"
    ? [l + d, t, r - d, t, r, b, l, b]
    : [l + d, t, r, t, r - d, b, l, b];
}

// Dạng ĐỈNH THẬT hay dạng HỘP BAO? Trả về mảng toạ độ đỉnh nếu là dạng đỉnh
// thật, null nếu không — nên chỗ gọi chỉ cần một phép kiểm null. Đây là hàm DUY
// NHẤT trong cả code base biết phân biệt hai dạng.
export function shapeVertices(kind, pts) {
  const need = VERTEX_NUMBERS[kind];
  if (!need || !Array.isArray(pts) || pts.length < need) return null;
  const v = pts.slice(0, need);
  return v.every((n) => Number.isFinite(n)) ? v : null;
}

// Hộp đã sắp: bốn hình đóng không quan tâm kéo từ góc nào.
//
// Quét MỌI cặp số chứ không chỉ hai góc đầu: tam giác ba đỉnh có 6 số, và lấy
// min/max của riêng hai số đầu sẽ cho một cái hộp cụt mất một đỉnh. Với 4 số thì
// kết quả không khác gì bản cũ.
function sorted(pts) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (pts[i] < l) l = pts[i];
    if (pts[i] > r) r = pts[i];
    if (pts[i + 1] < t) t = pts[i + 1];
    if (pts[i + 1] > b) b = pts[i + 1];
  }
  return { l, t, r, b };
}

function ok(kind, pts) {
  return SHAPE_KINDS.includes(kind) && Array.isArray(pts) && pts.length >= 4;
}

export function shapePath(kind, pts) {
  if (!ok(kind, pts)) return "";
  // Dạng đỉnh thật đi trước mọi thứ: nó tả trọn hình rồi, không cần hộp bao.
  const verts = shapeVertices(kind, pts);
  if (verts) {
    let d = `M ${r1(verts[0])} ${r1(verts[1])}`;
    for (let i = 2; i + 1 < verts.length; i += 2) d += ` L ${r1(verts[i])} ${r1(verts[i + 1])}`;
    return d + " Z";
  }
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
    // Hộp bao: đỉnh ở giữa cạnh trên, tức luôn là tam giác cân. Đây là dạng mà
    // tool Hình khối tạo ra khi kéo một cái hộp. Dạng ba đỉnh thật đã được nhánh
    // `verts` ở đầu hàm xử lý trước khi tới đây.
    return `M ${r1(cx)} ${r1(t)} L ${r1(r)} ${r1(b)} L ${r1(l)} ${r1(b)} Z`;
  }
  // Tứ giác thiếu đỉnh (dữ liệu hỏng): vẽ ra cái hộp của nó còn hơn vẽ ra chuỗi
  // rỗng — một hình vô hình thì không chọn được để mà sửa hay xoá.
  if (kind === "quad") {
    return `M ${r1(l)} ${r1(t)} L ${r1(r)} ${r1(t)} L ${r1(r)} ${r1(b)} L ${r1(l)} ${r1(b)} Z`;
  }
  // diamond
  return `M ${r1(cx)} ${r1(t)} L ${r1(r)} ${r1(cy)} L ${r1(cx)} ${r1(b)} L ${r1(l)} ${r1(cy)} Z`;
}

// `samples` chỉ có tác dụng với ê-líp, và mặc định là mức đủ cho hit-test (sai
// dưới 1 đơn vị, mà cái giá của sai số chỉ là cục gôm bắt chệch nửa pixel). Cục
// tẩy theo độ rộng đòi mức mịn hơn hẳn vì nó BIẾN đường bao này thành nét thật
// nằm lại trên bảng — 32 cạnh thì một cái ê-líp to nhìn ra ngay là đa giác.
export function shapeOutline(kind, pts, samples = ELLIPSE_SAMPLES) {
  if (!ok(kind, pts)) return [];
  // Đỉnh thật: đường bao CHÍNH LÀ các đỉnh, lặp lại điểm đầu ở cuối để cạnh khép
  // kín cũng bắt được chuột.
  const verts = shapeVertices(kind, pts);
  if (verts) return verts.concat([verts[0], verts[1]]);
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
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    }
    out.push(out[0], out[1]);
    return out;
  }

  let corners;
  if (kind === "rect" || kind === "quad") corners = [l, t, r, t, r, b, l, b];
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

// Hộp bao của một nét/hình/chữ, dùng để vẽ viền "đang chọn" và để quét vùng.
// Trả null nếu dữ liệu không đủ dựng hình — người gọi lọc ra là xong, không có
// hộp rỗng nào lọt vào phép so.
//
// Nét bút và hình khối nới ra w/2 mỗi phía vì `w` là ĐỘ DÀY NÉT: hộp ôm đúng
// đường tâm sẽ cắt mất nửa nét ở mọi mép. Text thì `w`/`h` đã là kích thước hộp
// chữ sẵn (cùng cái bẫy đã ghi ở drawingsHitBy).
export function drawingBox(d) {
  if (!d) return null;
  const pts = d.pts || [];
  const kind = d.kind || "pen";
  if (kind === "text") {
    if (pts.length < 2 || !(d.w > 0) || !(d.h > 0)) return null;
    return { x: pts[0], y: pts[1], w: d.w, h: d.h };
  }
  if (pts.length < 2) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  if (kind === "pen") {
    for (let i = 0; i + 1 < pts.length; i += 2) {
      l = Math.min(l, pts[i]); r = Math.max(r, pts[i]);
      t = Math.min(t, pts[i + 1]); b = Math.max(b, pts[i + 1]);
    }
  } else {
    if (pts.length < 4) return null;
    const s = sorted(pts);
    l = s.l; t = s.t; r = s.r; b = s.b;
  }
  const pad = (d.w || 0) / 2;
  return { x: l - pad, y: t - pad, w: (r - l) + pad * 2, h: (b - t) + pad * 2 };
}

// Quét vùng: dính khi hộp bao CHẠM vùng quét, cùng luật với thẻ và khung —
// không đòi quét trùm kín.
export function drawingsInRect(drawings, rect) {
  const out = [];
  for (const d of drawings || []) {
    const box = drawingBox(d);
    if (!box) continue;
    if (box.x < rect.x + rect.w && rect.x < box.x + box.w &&
        box.y < rect.y + rect.h && rect.y < box.y + box.h) out.push(d.id);
  }
  return out;
}

// ── Sửa hình bằng tay cầm ────────────────────────────────────────────────────
//
// Chọn MỘT hình rồi kéo tay cầm để đặt từng góc, từng cạnh vào đúng chỗ muốn.
//
// LUẬT MỘT CÂU: kéo một góc thì CHỈ góc đó đi, ở mọi hình có góc.
//
// Luật đó không hiển nhiên, vì bốn hình (chữ nhật, tam giác cân, hình thoi,
// ê-líp) được lưu bằng HỘP BAO — hai góc đối. Với hộp thì "kéo góc trên trái"
// tất yếu kéo theo hai góc kề: chúng dùng chung mép trái và mép trên. Nên hình
// hộp có góc thật ĐỔI LUÔN SANG DẠNG ĐỈNH THẬT ngay ở cú kéo góc đầu tiên:
//
//   chữ nhật ─┐
//   hình thoi ─┴─ kéo một góc ─→ tứ giác (quad, 4 đỉnh tự do)
//   tam giác cân ── kéo một góc ─→ tam giác 3 đỉnh, vẫn là kind "triangle"
//
// Đổi kind nghe to tát nhưng chính là điều người dùng vừa yêu cầu: một chữ nhật
// mà ba góc đứng yên còn một góc đi tự do thì theo định nghĩa nó không còn là
// chữ nhật nữa. Không có dữ liệu nào mất: cả hai kind đều kín, đều tô được, đều
// đi qua đúng một đường vẽ / hit-test / live như trước.
//
// Ê-líp là ngoại lệ DUY NHẤT — nó không có góc nào để mà kéo riêng, nên bốn tay
// cầm ở góc hộp của nó giữ nguyên nghĩa co giãn.
//
// Tay cầm CẠNH dời trọn một cạnh: dời cả hai đỉnh của nó đi cùng một lượng. Chỉ
// chữ nhật và ê-líp được miễn — cạnh của chúng đúng bằng mép hộp, nên ở đó tay
// cầm cạnh giữ nghĩa CO GIÃN và hình không đổi kind. Đó cũng là đường co giãn
// duy nhất còn lại sau khi góc đã thành góc tự do.

export const HANDLE_VERTEX = "v";
export const HANDLE_EDGE = "e";

// Bốn góc hộp theo chiều kim đồng hồ từ trên trái, và bốn mép theo cùng thứ tự
// bắt đầu từ mép trên. `i` là chỉ số trong đúng thứ tự này — moveShapeHandle
// dịch nó ngược lại, nên hai hàm phải đọc cùng một quy ước.
const BOX_CORNERS = ["nw", "ne", "se", "sw"];
const BOX_EDGES = ["n", "e", "s", "w"];

// Kind nào lưu bằng hộp bao mà vẫn CÓ GÓC THẬT. Ê-líp không có mặt: nó là hình
// hộp duy nhất không có góc. line/arrow cũng không: chúng đã ở dạng hai đầu tự
// do sẵn rồi.
const BOX_POLYGONS = new Set(["rect", "triangle", "diamond", "quad"]);

// Kind nào có CẠNH TRÙNG với mép hộp — chỉ hai cái. Với chúng thì tay cầm cạnh
// giữ nghĩa co giãn (kéo mép phải thì rộng ra, vẫn là chữ nhật / ê-líp).
//
// Hình thoi và tam giác cân KHÔNG được vào đây, và lý do rất cụ thể: trung điểm
// mép hộp của chúng rơi ĐÚNG vào đỉnh — mép trên của tam giác cân trùng chóp,
// cả bốn mép hộp của hình thoi trùng cả bốn đỉnh. Đặt tay cầm cạnh ở đó thì nó
// nằm chồng lên tay cầm góc, và không ai bấm trúng cái mình muốn.
const BOX_EDGE_KINDS = new Set(["rect", "ellipse"]);

// Các GÓC THẬT của một hình đang ở dạng hộp bao, phẳng [x,y,x,y,…], hoặc null
// nếu hình này không có góc. Lấy thẳng từ shapeOutline (bỏ điểm lặp ở cuối) để
// chỉ có MỘT chỗ trong file biết hình nào có góc ở đâu — tay cầm hiện ra đúng
// chỗ nét được vẽ, không cần định nghĩa lại lần thứ hai.
function boxPolygon(kind, pts) {
  if (!BOX_POLYGONS.has(kind) || shapeVertices(kind, pts)) return null;
  const outline = shapeOutline(kind, pts);
  return outline.length >= 8 ? outline.slice(0, -2) : null;
}

// Đa giác n đỉnh này mang kind nào? Tra ngược VERTEX_NUMBERS chứ không viết
// thẳng "3 thì triangle, 4 thì quad": bảng đó là chỗ duy nhất khai báo dạng
// đỉnh thật, thêm hình 5 đỉnh sau này chỉ phải sửa một nơi.
function vertexKindOf(count) {
  return Object.keys(VERTEX_NUMBERS).find((k) => VERTEX_NUMBERS[k] === count) || null;
}

// Tay cầm của một đa giác cho sẵn: mỗi đỉnh một cái, mỗi cạnh một cái ở trung
// điểm — kể cả CẠNH KHÉP KÍN (đỉnh cuối → đỉnh đầu), bỏ sót nó thì đúng một
// cạnh của hình không dời được.
function polygonHandles(poly) {
  const n = poly.length / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ t: HANDLE_VERTEX, i, x: poly[i * 2], y: poly[i * 2 + 1] });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push({
      t: HANDLE_EDGE, i,
      x: (poly[i * 2] + poly[j * 2]) / 2,
      y: (poly[i * 2 + 1] + poly[j * 2 + 1]) / 2
    });
  }
  return out;
}

// Tay cầm của một hình, toạ độ canvas. Trả mảng rỗng cho thứ không sửa được
// bằng tay cầm (nét bút, chữ) — người gọi chỉ việc kiểm độ dài.
//
// Quy tắc đặt tay cầm, một câu: nó nằm ở góc và ở giữa cạnh của HÌNH BẠN NHÌN
// THẤY, không phải của cái hộp lưu nó. Ngoại lệ là hai kind mà cạnh của hình
// đúng bằng mép hộp (xem BOX_EDGE_KINDS).
export function shapeHandles(d) {
  const kind = d?.kind;
  const pts = d?.pts || [];
  if (!kind || kind === "pen" || kind === "text" || !ok(kind, pts)) return [];

  const verts = shapeVertices(kind, pts);
  if (verts) return polygonHandles(verts);

  if (kind === "line" || kind === "arrow") {
    return [
      { t: HANDLE_VERTEX, i: 0, x: pts[0], y: pts[1] },
      { t: HANDLE_VERTEX, i: 1, x: pts[2], y: pts[3] }
    ];
  }

  // Hình hộp CÓ góc mà cạnh KHÔNG trùng mép hộp (tam giác cân, hình thoi): mọi
  // tay cầm bám theo đa giác thật.
  const poly = boxPolygon(kind, pts);
  if (poly && !BOX_EDGE_KINDS.has(kind)) return polygonHandles(poly);

  const { l, t, r, b } = sorted(pts);
  const cx = (l + r) / 2, cy = (t + b) / 2;
  const edge = { n: [cx, t], e: [r, cy], s: [cx, b], w: [l, cy] };
  const edges = BOX_EDGES.map((c, i) => ({ t: HANDLE_EDGE, i, x: edge[c][0], y: edge[c][1] }));

  // Chữ nhật: góc là góc thật của nó (kéo một cái là bỏ hộp), mép là mép hộp
  // (kéo một cái là co giãn). Hai loại tay cầm không đè lên nhau ở đâu cả.
  if (poly) {
    const corners = [];
    for (let i = 0; i * 2 + 1 < poly.length; i++) {
      corners.push({ t: HANDLE_VERTEX, i, x: poly[i * 2], y: poly[i * 2 + 1] });
    }
    return [...corners, ...edges];
  }

  // Ê-líp: không có góc, nên bốn góc HỘP giữ nghĩa co giãn.
  const corner = { nw: [l, t], ne: [r, t], se: [r, b], sw: [l, b] };
  return [
    ...BOX_CORNERS.map((c, i) => ({ t: HANDLE_VERTEX, i, x: corner[c][0], y: corner[c][1] })),
    ...edges
  ];
}

// Đỉnh mới của một đa giác sau khi kéo `handle`, hoặc null nếu tay cầm không
// khớp với đa giác này (chỉ số vượt số đỉnh — tay cầm sót lại từ hình trước).
function movePolygonHandle(poly, handle, x, y) {
  const n = poly.length / 2;
  if (!(handle.i >= 0) || handle.i >= n) return null;
  const next = poly.map((v) => Math.round(v));
  if (handle.t === HANDLE_VERTEX) {
    next[handle.i * 2] = Math.round(x);
    next[handle.i * 2 + 1] = Math.round(y);
    return next;
  }
  // Cạnh: dời CẢ HAI đỉnh của nó đi cùng một lượng. Lượng đó đo từ vị trí cũ của
  // chính tay cầm, nên cạnh bám đúng theo con trỏ.
  const dx = x - handle.x;
  const dy = y - handle.y;
  const j = (handle.i + 1) % n;
  for (const k of [handle.i, j]) {
    next[k * 2] = Math.round(poly[k * 2] + dx);
    next[k * 2 + 1] = Math.round(poly[k * 2 + 1] + dy);
  }
  return next;
}

// Hình mới sau khi kéo `handle` tới (x, y): { kind, pts }. Trả cả kind vì kéo
// góc một hình hộp có thể ĐỔI kind (xem ghi chú ở đầu mục) — chỗ gọi cứ ghi đè
// cả hai trường là đúng trong mọi trường hợp.
//
// `d` phải là hình LÚC BẮT ĐẦU kéo và `handle` là tay cầm đọc từ chính nó — mọi
// nhịp chuột tính lại từ mốc đó chứ không cộng dồn, cùng kỷ luật với mọi cú kéo
// khác trong app.
export function moveShapeHandle(d, handle, x, y) {
  const kind = d?.kind;
  const pts = d?.pts || [];
  if (!handle || !(handle.i >= 0) || !ok(kind, pts)) return { kind, pts };

  const verts = shapeVertices(kind, pts);
  if (verts) {
    const next = movePolygonHandle(verts, handle, x, y);
    return next ? { kind, pts: next } : { kind, pts };
  }

  if (kind === "line" || kind === "arrow") {
    const next = pts.slice(0, 4);
    if (handle.i > 1) return { kind, pts };
    next[handle.i * 2] = Math.round(x);
    next[handle.i * 2 + 1] = Math.round(y);
    return { kind, pts: next };
  }

  // Hình hộp CÓ góc thật: bỏ hộp, giữ nguyên các góc đang thấy rồi dời đúng cái
  // vừa cầm. Chữ nhật/hình thoi thành tứ giác, tam giác cân thành tam giác
  // thường. Riêng mép hộp của chữ nhật/ê-líp thì không đi đường này — nó là
  // đường co giãn, xem BOX_EDGE_KINDS.
  if (handle.t === HANDLE_VERTEX || !BOX_EDGE_KINDS.has(kind)) {
    const poly = boxPolygon(kind, pts);
    const nextKind = poly && vertexKindOf(poly.length);
    const next = nextKind && movePolygonHandle(poly, handle, x, y);
    if (next) return { kind: nextKind, pts: next };
  }

  let { l, t, r, b } = sorted(pts);
  if (handle.t === HANDLE_VERTEX) {
    const c = BOX_CORNERS[handle.i];
    if (!c) return { kind, pts };
    if (c === "nw") { l = x; t = y; }
    else if (c === "ne") { r = x; t = y; }
    else if (c === "se") { r = x; b = y; }
    else { l = x; b = y; }
  } else {
    const c = BOX_EDGES[handle.i];
    if (!c) return { kind, pts };
    if (c === "n") t = y;
    else if (c === "e") r = x;
    else if (c === "s") b = y;
    else l = x;
  }
  // KHÔNG sắp lại l/r hay t/b: kéo mép trái vượt qua mép phải thì hình lật, và
  // đó đúng là thứ người dùng vừa làm. sorted() ở mọi hàm đọc đã chịu được hộp
  // lộn ngược từ đầu (tool Hình khối kéo ngược cũng ra hộp như vậy).
  return { kind, pts: [Math.round(l), Math.round(t), Math.round(r), Math.round(b)] };
}

// Dời một nét/hình/chữ đi (dx, dy). Mọi kind đều chỉ là danh sách toạ độ xen kẽ
// x, y — kể cả text (pts là điểm neo) và hình khối (hai góc đối) — nên một phép
// cộng chạy đúng cho cả ba, không cần rẽ nhánh theo kind.
export function moveDrawing(d, dx, dy) {
  const pts = d.pts || [];
  return { ...d, pts: pts.map((v, i) => Math.round(i % 2 === 0 ? v + dx : v + dy)) };
}
