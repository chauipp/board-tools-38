// GẠCH XOÁ: vẽ một nét ngoằn ngoèo đè lên thứ gì đó là xoá nó đi — đúng phản xạ
// gạch bỏ trên giấy. Không dính React, không đụng DOM: test được bằng node:test.
//
// Cử chỉ này KHÔNG có nút bấm, không có khoảng chờ, không có tool riêng. Nó chỉ
// là một nét bút bình thường, và toàn bộ việc của file này là trả lời hai câu:
//
//   1. Nét vừa vẽ có phải một cú GẠCH XOÁ không?  → isScribble
//   2. Nếu phải thì nó gạch vào những cái gì?     → scribbleTargets
//
// Trả lời sai câu 1 là mất việc của người ta một cách không báo trước, nên cả
// file này thiên về NÓI KHÔNG: chưa chắc thì cứ để nó là một nét vẽ, người dùng
// gạch lại lần nữa là xong, còn xoá oan thì họ phải đi tìm Ctrl+Z.
//
// ── Vì sao ĐỔI CHIỀU LIÊN TIẾP mới là dấu hiệu, chứ không phải "nhiều góc nhọn"
//
// Bản đầu đếm góc nhọn rồi cộng thêm chốt "đường đi dài hơn hẳn khổ hình". Cả
// hai đều đúng với cú gạch xoá, nhưng cũng đúng với đủ thứ người ta cố ý vẽ:
// ngôi sao năm cánh có năm góc rất nhọn và đường đi dài gấp mấy lần đường chéo;
// hình vuông có bốn góc vuông và đường đi gấp 2,8 lần đường chéo.
//
// Thứ tách được chúng là DẤU của góc quay. Ngôi sao, hình vuông, tam giác, vòng
// tròn — mọi thứ vẽ một mạch quanh một cái ruột — đều quay MÃI VỀ MỘT PHÍA. Còn
// gạch xoá thì theo đúng nghĩa đen là đi tới rồi quay lại: trái, phải, trái,
// phải. Đếm chuỗi góc nhọn ĐAN DẤU dài nhất là bắt trúng ngay cái định nghĩa đó,
// và nó tự miễn nhiễm với mọi hình kín mà không cần biết tên hình nào.
//
// ── Mọi phép đo ở đây chạy trên nét ĐÃ RÚT GỌN
//
// Cùng bài học đã ghi ba lần bên recognize.js: số điểm của một nét là hệ quả của
// việc vẽ lâu hay mau, không phải của hình vẽ ra. Đếm góc trên điểm thô thì một
// nét thẳng vẽ chậm sinh ra hàng trăm góc rung li ti, dấu của chúng thì đan
// nhau, và cái nét thẳng đó bị đọc thành gạch xoá. Rút gọn bằng RDP với dung sai
// TỈ LỆ với khổ nét (không phải một con số tuyệt đối) trước, rồi mới đo.

import { simplifyStroke } from "./stroke.js";
import { shapeOutline, drawingBox } from "./shape.js";

// Góc quay tại một đỉnh phải bằng chừng này mới được tính là "đổi chiều". Thấp
// hơn một góc vuông là cố ý: cú gạch xoá vội thường ngoằn ngoèo xiên chứ không
// gập hẳn lại, và chốt đan dấu bên dưới mới là thứ gánh việc phân biệt — chốt
// này chỉ để loại mấy cái vênh nhè nhẹ của tay.
const TURN_MIN = (65 * Math.PI) / 180;

// Cần bao nhiêu lần đổi chiều liên tiếp. Năm nghĩa là tay đã đi tới đi lui hơn
// hai vòng trọn vẹn: chữ "N", chữ "W", một cái tia chớp, một mũi tên gấp khúc
// đều chỉ được 2–3 nên nằm ngoài, còn một cú gạch xoá dù vội cũng vượt qua dễ
// dàng (cú gạch trong ảnh gốc được 13).
//
// ĐÃ THỬ và ĐÃ BỎ một chốt phụ "đường đi phải dài gấp N lần đường chéo". Nghe
// hợp lý — cú gạch trong ảnh gốc đạt 8 lần — nhưng nó đo ĐỘ CHẶT chứ không đo ý
// định, mà chính cảnh thường gặp nhất của cử chỉ này lại không chặt: gạch ngang
// một dòng chữ rộng 180 cao 30 bằng sáu nhát chỉ cho 1,4 lần. Đặt chốt đủ thấp
// để dòng chữ đó qua được thì nó chẳng còn loại được gì nữa. Bỏ hẳn, và để việc
// chống nhận nhầm cho hai thứ khác: số lần đổi chiều ở đây, và luật "phải cắt
// qua thứ gì đó hai lần" bên scribbleTargets — nhờ luật sau, một nét ngoằn ngoèo
// vẽ giữa chỗ trống vẫn cứ là một nét vẽ.
export const SCRIBBLE_MIN_TURNS = 5;

// Dung sai rút gọn, TỈ LỆ với đường chéo hộp bao. Tỉ lệ chứ không tuyệt đối vì
// câu trả lời không được đổi khi người ta gạch một cái to gấp đôi.
const SIMPLIFY_RATIO = 0.03;

// Cắt qua nhau mấy lần thì coi là bị gạch. Một lần là đi ngang qua — nét nào vẽ
// xong mà chẳng cắt qua một nét khác đâu đó. Hai lần nghĩa là đã quay lại đúng
// chỗ đó lần nữa, và đó mới là gạch xoá.
const MIN_CROSSINGS = 2;

function bbox(pts) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (pts[i] < l) l = pts[i];
    if (pts[i] > r) r = pts[i];
    if (pts[i + 1] < t) t = pts[i + 1];
    if (pts[i + 1] > b) b = pts[i + 1];
  }
  return { l, t, r, b, w: r - l, h: b - t };
}

// Nét đã rút gọn ở khổ của chính nó, hoặc null nếu không đủ để nói gì.
function reduce(raw) {
  if (!raw || typeof raw.length !== "number" || raw.length < 8) return null;
  const box = bbox(raw);
  const diag = Math.hypot(box.w, box.h);
  if (!(diag > 0)) return null;
  const tol = Math.max(1, diag * SIMPLIFY_RATIO);
  const pts = simplifyStroke(raw, tol, tol);
  return Math.floor(pts.length / 2) >= 3 ? { pts, diag } : null;
}

// Chuỗi góc nhọn ĐAN DẤU dài nhất trong nét. Đây là toàn bộ phép nhận dạng.
//
// "Liên tiếp" tính trên riêng các góc NHỌN, bỏ qua mấy đỉnh thoai thoải xen
// giữa: một cú gạch có chỗ đáy hơi tròn vẫn phải đếm được, mà cái đáy tròn đó
// thì không mang dấu nào đáng tin.
export function turnRuns(pts) {
  const n = Math.floor(pts.length / 2);
  let best = 0, run = 0, prev = 0;
  for (let i = 1; i + 1 < n; i++) {
    const ax = pts[i * 2] - pts[(i - 1) * 2];
    const ay = pts[i * 2 + 1] - pts[(i - 1) * 2 + 1];
    const bx = pts[(i + 1) * 2] - pts[i * 2];
    const by = pts[(i + 1) * 2 + 1] - pts[i * 2 + 1];
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    const turn = Math.atan2(cross, dot);
    if (Math.abs(turn) < TURN_MIN) continue;
    const sign = turn > 0 ? 1 : -1;
    // Cùng dấu với góc nhọn trước ⇒ vẫn đang quay về một phía ⇒ chuỗi đứt, và
    // chính đỉnh này mở chuỗi mới.
    run = sign === prev ? 1 : run + 1;
    prev = sign;
    if (run > best) best = run;
  }
  return best;
}

export function isScribble(raw) {
  const red = reduce(raw);
  return !!red && turnRuns(red.pts) >= SCRIBBLE_MIN_TURNS;
}

// Đường bao đem ra đếm giao điểm. Khác cuttableOutline bên erase.js: ở đó câu
// hỏi là "cắt nhỏ được không" nên chữ và hình tô đặc bị trả null; ở đây câu hỏi
// chỉ là "nét gạch có băng qua nó không", mà cái đó thì thứ gì cũng trả lời được
// — chữ thì lấy đúng khung chữ của nó.
export function targetOutline(d) {
  const kind = d?.kind || "pen";
  if (kind === "pen") return d.pts?.length >= 4 ? d.pts : null;
  if (kind === "text") {
    const box = drawingBox(d);
    if (!box) return null;
    const { x, y, w, h } = box;
    return [x, y, x + w, y, x + w, y + h, x, y + h, x, y];
  }
  const outline = shapeOutline(kind, d.pts);
  return outline.length >= 4 ? outline : null;
}

// Hai đoạn thẳng có cắt nhau THẬT SỰ không (chạm đúng đầu mút không tính). Đếm
// giao điểm là phép đo của HÌNH HỌC hai đường, không phải của việc chúng được
// lấy mẫu dày hay thưa — đó là lý do chọn nó thay vì "có bao nhiêu điểm của nét
// gạch nằm gần nét kia".
function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function crossings(a, b) {
  let count = 0;
  for (let i = 0; i + 3 < a.length; i += 2) {
    for (let j = 0; j + 3 < b.length; j += 2) {
      if (segmentsCross(a[i], a[i + 1], a[i + 2], a[i + 3], b[j], b[j + 1], b[j + 2], b[j + 3])) {
        count++;
        if (count >= MIN_CROSSINGS) return count;
      }
    }
  }
  return count;
}

function boxesApart(p, q) {
  return p.r < q.x || p.l > q.x + q.w || p.b < q.y || p.t > q.y + q.h;
}

// Những gì cú gạch này xoá. Trả mảng rỗng nếu nét không phải một cú gạch xoá,
// hoặc nó gạch vào chỗ trống — và chỗ gọi hiểu mảng rỗng là "cứ lưu ra nét vẽ
// bình thường". Nhờ vậy gạch ngoằn ngoèo giữa bãi đất trống vẫn vẽ ra được cái
// ngoằn ngoèo đó, không mất đi đâu cả.
export function scribbleTargets(raw, drawings) {
  const red = reduce(raw);
  if (!red || turnRuns(red.pts) < SCRIBBLE_MIN_TURNS) return [];

  const mark = red.pts;
  const box = bbox(mark);
  // Tâm cú gạch, dùng cho nhánh "nằm gọn bên trong" bên dưới.
  const midX = (box.l + box.r) / 2, midY = (box.t + box.b) / 2;

  const out = [];
  for (const d of drawings || []) {
    const dbox = drawingBox(d);
    // Loại sớm bằng hộp bao: trên bảng đông nét thì tuyệt đại đa số rơi vào đây,
    // và bốn phép so rẻ hơn hẳn một lượt đếm giao điểm.
    if (!dbox || boxesApart(box, dbox)) continue;
    const outline = targetOutline(d);
    if (!outline) continue;
    if (crossings(mark, outline) >= MIN_CROSSINGS) { out.push(d.id); continue; }
    // KHÔNG cắt qua mép lần nào mà vẫn phải xoá: cú gạch nằm GỌN BÊN TRONG một
    // khối đặc. Gạch lên một dòng chữ hay gạch vào ruột một hình đã tô là cảnh
    // thường gặp nhất của cử chỉ này, mà nó lại cho đúng 0 giao điểm.
    //
    // Chỉ mở cho chữ và hình tô đặc, không mở cho hình chỉ có viền: gạch vào
    // giữa một cái khung rỗng là gạch vào chỗ trống bên trong nó, không phải
    // gạch vào nó. Cùng một luật mà cục gôm đang theo (xem drawingsHitBy).
    const solid = (d.kind === "text" || d.fill === true);
    if (solid && midX >= dbox.x && midX <= dbox.x + dbox.w && midY >= dbox.y && midY <= dbox.y + dbox.h) {
      out.push(d.id);
    }
  }
  return out;
}
