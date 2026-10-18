// Phép cắt của CỤC TẨY THEO ĐỘ RỘNG, tách khỏi React để test được bằng
// node:test — cùng kỷ luật với stroke.js và shape.js.
//
// HAI KIỂU TẨY, và chúng khác nhau ở CÁI GÌ BỊ MẤT chứ không ở cách rê tay:
//
//   "stroke" — chạm vào đâu thì MẤT CẢ NÉT đó. Cục tẩy ở đây là một cái que chỉ:
//     nó không có bề rộng đáng kể, việc của nó chỉ là nói "cái này".
//
//   "part"   — chỉ mất ĐÚNG PHẦN mà cục tẩy quét qua, nét bị cắt làm nhiều mảnh
//     và các mảnh còn lại vẫn là nét riêng. Ở đây bề rộng là toàn bộ vấn đề:
//     nó chính là thứ quyết định cắt được bao nhiêu.
//
// CẮT ĐƯỢC CẢ HÌNH KHỐI, không riêng nét bút. Một cái chữ nhật bị cắt ngang sẽ
// thôi làm chữ nhật và thành mấy mảnh nét bút — mất tay cầm, mất kind, mất phần
// tô đặc. Nghe như một cái giá đắt, nhưng đó CHÍNH LÀ điều vừa được yêu cầu:
// "di đến đâu xoá đến đó". Một cái chữ nhật khuyết một góc thì theo định nghĩa
// không còn là chữ nhật, y hệt luật đã có sẵn ở tay cầm (kéo một góc chữ nhật là
// nó thành tứ giác) — đây chỉ là cùng luật đó, áp cho cục tẩy.
//
// Cắt nguyên một nhánh riêng cho "hình" là bất khả: hình lưu bằng hộp bao hoặc
// bằng đỉnh, mà một mẩu cung ê-líp thì không có hộp bao nào tả được.
//
// CHỮ là ngoại lệ duy nhất còn lại: nó là con chữ chứ không phải đường nét, cắt
// đôi một chữ "A" không ra hai nửa chữ A mà ra rác. Chạm vào chữ là mất cả.
import { shapeOutline } from "./shape.js";

export const ERASE_STROKE = "stroke";
export const ERASE_PART = "part";
export const ERASE_MODES = [ERASE_STROKE, ERASE_PART];

// Bề rộng cục tẩy, đơn vị TOẠ ĐỘ CANVAS y như độ dày nét: phóng to bảng thì cục
// tẩy to lên cùng, đúng luật "mực trên giấy" mà cả lớp vẽ đang theo.
//
// Ba bậc chứ không phải một thanh trượt, cùng lý do với ba bậc độ dày nét: thứ
// người ta thật sự chọn là "nhỏ / vừa / to", còn giữa 23 và 24 thì không ai
// phân biệt được mà cũng không ai cần.
export const ERASE_WIDTHS = [10, 24, 56];

// Mảnh còn lại ngắn hơn chừng này thì bỏ hẳn. Nó là RÁC chứ không phải nét: mắt
// thấy một cái chấm, mà cục gôm thì rất khó nhắm lại đúng nó để dọn.
const MIN_PART = 2;

export function eraseRadius(w) {
  return Math.max(1, Number(w) || 0) / 2;
}

// Ê-líp cắt ra sẽ NẰM LẠI trên bảng dưới dạng nét bút, nên nó phải mịn hơn hẳn
// mức dùng cho hit-test — 32 cạnh thì một cái ê-líp to nhìn ra ngay là đa giác.
const CUT_ELLIPSE_SAMPLES = 96;

// Đường mà cục tẩy CẮT ĐƯỢC của một nét/hình, hoặc null nếu thứ này chỉ xoá cả
// được. Đây là chỗ DUY NHẤT quyết định cái gì nhấm nháp được và cái gì không.
//
// Hai thứ không cắt được, mỗi thứ một lý do khác hẳn:
//
//   CHỮ — nó là con chữ, không phải đường nét. Cắt đôi một chữ "A" không ra hai
//     nửa chữ A mà ra rác.
//
//   HÌNH TÔ ĐẶC — thứ cắt được ở đây là một ĐƯỜNG, mà ruột đặc thì không phải
//     đường. Khoét một miếng khỏi vùng tô đòi hình có lỗ, và không dạng dữ liệu
//     nào ở đây tả được điều đó. Chỉ cắt riêng cái viền thì càng tệ: rê ngang
//     qua giữa hình sẽ không xảy ra chuyện gì, còn chạm vào viền thì phần tô
//     biến mất sạch — hai kết quả đều không đoán trước được. Xoá cả, dứt khoát.
export function cuttableOutline(d) {
  const kind = d?.kind || "pen";
  if (kind === "pen") return d.pts?.length >= 4 ? d.pts : null;
  if (kind === "text" || d.fill === true) return null;
  const outline = shapeOutline(kind, d.pts, CUT_ELLIPSE_SAMPLES);
  return outline.length >= 4 ? outline : null;
}

// Đoạn AB cắt đường tròn (C, r) ở khúc tham số nào? Trả [t0, t1] đã kẹp về
// [0,1], hoặc null nếu đoạn nằm trọn ngoài đường tròn.
//
// Chỉ có MỘT khúc chứ không nhiều: hình tròn lồi, nên giao của nó với một đoạn
// thẳng luôn liền một mạch. Đây là thứ giữ cho cutPolyline không phải gom khoảng.
function circleSpan(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy;
  // Đoạn suy biến (hai đầu trùng nhau): không giải bậc hai được, hỏi thẳng xem
  // cái điểm đó có nằm trong vòng không.
  if (a === 0) return fx * fx + fy * fy <= r * r ? [0, 1] : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  // `<= 0`: tiếp tuyến (disc = 0) chạm đúng một điểm, cắt ra một khoảng dài 0 —
  // không xoá được gì mà lại làm nét bị chẻ đôi ở đó. Coi như không chạm.
  if (disc <= 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  const t1 = (-b + sq) / (2 * a);
  if (t1 <= 0 || t0 >= 1) return null;
  return [Math.max(0, t0), Math.min(1, t1)];
}

// Đoạn AB cắt VIÊN THUỐC (mọi điểm cách đoạn PQ không quá r) ở khúc nào?
//
// Viên thuốc là hình mà cục tẩy quét ra khi rê từ P tới Q, và đây là chỗ ăn thua
// của cả tính năng. Bản đầu tiên bổ một chuỗi nhát TRÒN dọc đường đi, mỗi nhát
// cách nhau nửa bán kính — rê 200px với cục tẩy nhỏ là 80 nhát, mỗi nhát quét
// lại toàn bộ điểm của toàn bộ nét. Đo được 86ms cho MỘT nhịp chuột trên bảng
// 400 nét, trong khi ngân sách một khung hình là 16,7ms.
//
// Viên thuốc LỒI (tổng Minkowski của một đoạn thẳng và một hình tròn, cả hai đều
// lồi), nên giao của nó với một đoạn thẳng luôn là MỘT khúc liền. Nhờ đó tính
// thẳng ra được bằng ba mảnh ghép — tròn ở P, tròn ở Q, và dải chữ nhật giữa hai
// tâm — rồi lấy khúc bao ngoài. Một lượt cho mỗi đoạn, không còn phụ thuộc vào
// việc rê nhanh hay chậm, và cũng chính xác hơn: nhát cắt bằng chuỗi vòng tròn
// vốn để lại gợn sóng li ti ở mép rãnh.
function capsuleSpan(ax, ay, bx, by, px, py, qx, qy, r) {
  let lo = Infinity, hi = -Infinity;
  const take = (span) => {
    if (!span) return;
    if (span[0] < lo) lo = span[0];
    if (span[1] > hi) hi = span[1];
  };
  take(circleSpan(ax, ay, bx, by, px, py, r));
  take(circleSpan(ax, ay, bx, by, qx, qy, r));

  const ex = qx - px, ey = qy - py;
  const len2 = ex * ex + ey * ey;
  // P trùng Q (nhát cắt tại chỗ): viên thuốc suy biến thành đúng hình tròn, hai
  // mảnh ghép trên đã tả trọn nó rồi.
  if (len2 > 0) {
    const len = Math.sqrt(len2);
    const dx = ex / len, dy = ey / len;   // dọc theo đường rê
    const nx = -dy, ny = dx;              // vuông góc với nó
    // Đổi hai đầu đoạn sang hệ (dọc, ngang) của đường rê. Cả hai toạ độ đều
    // TUYẾN TÍNH theo t, nên "nằm trong dải chữ nhật" là bốn bất phương trình
    // bậc nhất — kẹp dần [0,1] bằng chúng là ra khúc cần tìm.
    const uA = (ax - px) * dx + (ay - py) * dy;
    const uB = (bx - px) * dx + (by - py) * dy;
    const vA = (ax - px) * nx + (ay - py) * ny;
    const vB = (bx - px) * nx + (by - py) * ny;
    let t0 = 0, t1 = 1;
    const clip = (c0, c1, min, max) => {
      const d = c1 - c0;
      // Đoạn nằm song song với cặp mép này: không kẹp được gì, chỉ hỏi xem nó ở
      // trong hay ngoài.
      if (Math.abs(d) < 1e-12) return c0 >= min && c0 <= max;
      const ta = (min - c0) / d, tb = (max - c0) / d;
      if (Math.min(ta, tb) > t0) t0 = Math.min(ta, tb);
      if (Math.max(ta, tb) < t1) t1 = Math.max(ta, tb);
      return t0 < t1;
    };
    if (clip(uA, uB, 0, len) && clip(vA, vB, -r, r)) take([t0, t1]);
  }

  if (lo === Infinity) return null;
  lo = Math.max(0, lo);
  hi = Math.min(1, hi);
  return hi > lo ? [lo, hi] : null;
}

// Hộp bao của viên thuốc. Dùng để LOẠI SỚM: nét nào có hộp bao không chạm hộp
// này thì khỏi cần đụng tới phép cắt. Trên một bảng đông nét thì tuyệt đại đa số
// nét rơi vào đây, và một phép so bốn con số rẻ hơn hẳn một lượt quét toàn bộ
// điểm của nét đó.
export function eraseBounds(px, py, qx, qy, r) {
  return {
    x: Math.min(px, qx) - r, y: Math.min(py, qy) - r,
    w: Math.abs(qx - px) + r * 2, h: Math.abs(qy - py) + r * 2
  };
}

function polylineLength(pts) {
  let sum = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    sum += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
  }
  return sum;
}

// Khoảng cách từ một điểm tới đoạn PQ — chỉ dùng cho nét suy biến một điểm.
function distToSeg(x, y, px, py, qx, qy) {
  const dx = qx - px, dy = qy - py;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x - px, y - py);
  let t = ((x - px) * dx + (y - py) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (px + t * dx), y - (py + t * dy));
}

// Cắt MỘT đường gấp khúc bằng một nhát viên thuốc (rê cục tẩy từ P tới Q). Trả:
//   null  — cục tẩy không chạm đường này, người gọi giữ nguyên bản cũ
//   []    — mất sạch
//   [...] — các mảnh còn lại, mỗi mảnh là một mảng phẳng [x,y,x,y,…]
//
// Phân biệt null với [] là có chủ ý: "không đụng tới" và "đã xoá hết" là hai
// việc khác hẳn nhau, và chỗ gọi cần biết mình có phải ghi lại gì không.
export function cutPolylineAlong(pts, px, py, qx, qy, r) {
  const n = Math.floor((pts?.length || 0) / 2);
  if (n < 1) return null;
  if (n === 1) return distToSeg(pts[0], pts[1], px, py, qx, qy) <= r ? [] : null;

  const out = [];
  let cur = [];
  let touched = false;

  // Mỗi vòng lặp xử lý ĐÚNG một đoạn, và bất biến là: `cur` luôn kết thúc ở
  // điểm đầu của đoạn sắp xét (hoặc rỗng). Nhờ vậy không chỗ nào phải chống
  // điểm lặp — điểm chung của hai đoạn liền nhau chỉ được đẩy vào một lần.
  for (let i = 0; i + 1 < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const bx = pts[(i + 1) * 2], by = pts[(i + 1) * 2 + 1];
    const span = capsuleSpan(ax, ay, bx, by, px, py, qx, qy, r);

    if (!span) {
      if (!cur.length) cur.push(ax, ay);
      cur.push(bx, by);
      continue;
    }

    touched = true;
    const [t0, t1] = span;
    // Khúc TRƯỚC chỗ cắt còn sống: nối nốt vào mảnh đang dựng rồi chốt mảnh đó.
    if (t0 > 0) {
      if (!cur.length) cur.push(ax, ay);
      cur.push(ax + (bx - ax) * t0, ay + (by - ay) * t0);
    }
    if (cur.length >= 4) out.push(cur);
    cur = [];
    // Khúc SAU chỗ cắt mở một mảnh mới.
    if (t1 < 1) cur.push(ax + (bx - ax) * t1, ay + (by - ay) * t1, bx, by);
  }
  if (cur.length >= 4) out.push(cur);

  if (!touched) return null;

  // ĐƯỜNG BAO KÍN (hình khối) có một MỐI NỐI: điểm đầu và điểm cuối trùng nhau,
  // nhưng về mặt dữ liệu nó vẫn là một đường mở bắt đầu ở một cái góc. Cắt một
  // nhát vào giữa cạnh trên của chữ nhật thì tự nhiên ra HAI mảnh — một mảnh tới
  // chỗ cắt, một mảnh từ chỗ cắt vòng hết về lại cái góc đó — dù mắt chỉ thấy
  // đúng một đường liền. Nối chúng lại: một nhát cắt thì phải ra một mảnh, không
  // thì mỗi lần chạm vào một cái hình là bảng đẻ thêm một bản ghi vô cớ, và cú
  // tẩy tiếp theo ở chỗ mối nối lại chẻ ra chỗ chẳng có gì để chẻ.
  const n2 = pts.length;
  const closed = pts[0] === pts[n2 - 2] && pts[1] === pts[n2 - 1];
  if (closed && out.length >= 2) {
    const head = out[0], tail = out[out.length - 1];
    // Chỉ nối khi mối nối còn NGUYÊN: nếu chính chỗ đó vừa bị cắt thì hai đầu
    // này là hai mép của rãnh, nối lại là lấp mất cái rãnh vừa tạo ra.
    if (head[0] === pts[0] && head[1] === pts[1]
      && tail[tail.length - 2] === pts[n2 - 2] && tail[tail.length - 1] === pts[n2 - 1]) {
      out[0] = tail.concat(head.slice(2));
      out.pop();
    }
  }

  return out.filter((p) => polylineLength(p) >= MIN_PART);
}

// Nhát cắt TẠI CHỖ (cục tẩy đứng yên) — chỉ là viên thuốc có P trùng Q. Giữ tên
// riêng vì lúc ấn chuột xuống thì đúng là chưa rê đi đâu cả.
export function cutPolyline(pts, cx, cy, r) {
  return cutPolylineAlong(pts, cx, cy, cx, cy, r);
}

// Rê cục tẩy từ P tới Q, cắt mọi mảnh đang có trên đường đi. `parts` là danh
// sách mảnh hiện tại của MỘT nét (lúc đầu chỉ có một phần tử: nguyên nét).
// Trả null nếu cả chặng không chạm gì — cùng quy ước với cutPolylineAlong.
export function cutPartsAlong(parts, px, py, qx, qy, r) {
  let next = null;
  for (let i = 0; i < parts.length; i++) {
    const res = cutPolylineAlong(parts[i], px, py, qx, qy, r);
    // Chưa mảnh nào bị đụng: `next` vẫn null, khỏi cấp phát mảng nào.
    if (res === null) { if (next) next.push(parts[i]); continue; }
    if (!next) next = parts.slice(0, i);
    for (const p of res) next.push(p);
  }
  return next;
}
