// Cửa lọc cho gói `live:ink` mang CHỮ ĐANG GÕ. Tách khỏi index.js vì cùng lý do
// với follow.js: index.js gọi server.listen() lúc import nên node --test không
// với tới được, mà đây lại là chỗ đáng test nhất trong cả kênh live:ink.
//
// VÌ SAO ĐÁNG TEST NHẤT. Mọi gói khác trên kênh này chở HÌNH HỌC — một mảng số,
// kích thước bị chặn sẵn bởi chính hình dạng (hộp 4 số, tam giác 6, tứ giác 8),
// và biên độ bị chặn bởi MAX_LIVE_INK_COORD. Gói chữ là gói DUY NHẤT chở dữ
// liệu người dùng gõ tự do, ở nhịp ~25 gói/giây, và server phát nó cho cả
// phòng. Không có trần thì một client lỗi (hoặc cố tình) bơm một đoạn văn khổng
// lồ là cả phòng nhận vài trăm KB mỗi giây.

// 4000 ký tự rộng hơn hẳn mọi đoạn chú thích thật trên bảng, mà vẫn giữ gói
// dưới vài KB. CẮT BỚT chứ không loại cả gói: người gõ vượt trần vẫn phải thấy
// mình gõ được — loại gói thì với họ tính năng đứng hình không rõ lý do — chỉ
// là người khác thấy bản bị cắt cho tới khi board:update mang bản đầy đủ về.
export const MAX_LIVE_INK_TEXT_LEN = 4000;

// Cỡ chữ client hiện cho chọn là 14–48. Chấp một dải rộng hơn để không phải
// redeploy server mỗi khi client đổi danh sách cỡ, cùng lý do với
// MIN/MAX_LIVE_INK_W bên index.js. Vẫn phải có trần: một gói size khổng lồ là
// một chữ cái phủ kín màn hình cả phòng cho tới khi hết TTL, và chữ đang gõ thì
// chưa có id nên không ai gôm nó đi được.
export const MIN_LIVE_INK_TEXT_SIZE = 6;
export const MAX_LIVE_INK_TEXT_SIZE = 400;

// Phần riêng của kind "text" trong một gói live:ink đã qua các chốt chung.
// `isOpen` là gói seq 0 — gói mở lượt gõ, chỗ duy nhất mang cỡ chữ và id đang
// sửa. Trả về phần cần trộn vào gói sạch, hoặc null nếu gói phải bị loại.
//
// Chữ đi ở MỌI gói vì nó chính là thứ đang thay đổi; cỡ chữ và id đang sửa chỉ
// đi ở gói mở vì chúng không đổi giữa chừng một lượt gõ.
export function sanitizeLiveText(payload, isOpen) {
  const out = { text: String(payload?.text ?? "").slice(0, MAX_LIVE_INK_TEXT_LEN) };
  if (!isOpen) return out;

  // Chữ không có độ dày nét; thứ tương đương của nó là CỠ CHỮ. Kiểm đúng cái mà
  // kind này thật sự dùng, chứ không đòi client bịa ra một `w` giả để lọt qua
  // cửa — một chốt kiểm bịa được thì không còn là chốt kiểm.
  const size = payload?.size;
  if (!Number.isFinite(size) || size < MIN_LIVE_INK_TEXT_SIZE || size > MAX_LIVE_INK_TEXT_SIZE) return null;
  out.size = size;

  // id đoạn text đang được sửa, để người nhận GIẤU bản đã lưu đi trong lúc
  // người kia còn gõ. null = đang tạo mới. Cố ý không dùng chung ô với
  // `drawingId`: xem ghi chú ở mergeInkPacket bên client/src/lib/ink-live.js —
  // nhét id đang sửa vào đó thì reconcile dọn overlay ngay gói đầu tiên.
  out.editId = Number.isFinite(payload?.editId) ? payload.editId : null;
  return out;
}

// ── Gói `moving`: nét đang bị người khác dời / co giãn / sửa hình ────────────
//
// Mang TRẠNG THÁI TUYỆT ĐỐI của từng nét (pts hiện tại) chứ không mang độ dời —
// lý do ở applyInkMoves bên client/src/lib/ink-live.js. Vì tuyệt đối nên gói to
// hơn hẳn các gói khác trên kênh này, và đó là chỗ phải chặn.
//
// Trần trùng với phía client (useInkLive.js) nhưng KHÔNG phải chỉ để nhắc lại:
// client tự kìm mình để khỏi ngốn băng thông, còn ở đây là để một client đã bị
// sửa không bơm được. Hai chốt cho hai mối lo khác nhau, cùng một con số.
const MAX_MOVE_ITEMS = 60;
const MAX_MOVE_NUMBERS = 4000;

// Cùng biên độ toạ độ với MAX_LIVE_INK_COORD bên index.js, chép lại vì module
// này không import ngược lên đó. Number.isFinite một mình cho qua 1e9.
const MAX_MOVE_COORD = 20000;

// Trả về danh sách đã lọc, hoặc null nếu gói phải bị loại cả.
//
// LOẠI CẢ GÓI chứ không cắt bớt, khác hẳn cách xử đoạn văn quá dài ở trên. Với
// chữ, một bản bị cắt vẫn đọc được và vẫn có ích. Với một cú kéo, danh sách bị
// cắt nghĩa là người nhận thấy nửa cụm nhúc nhích còn nửa kia đứng yên — sai
// lệch đó khó hiểu hơn hẳn việc không thấy gì.
// `kindAllowed` là vị từ kiểm kind, do index.js truyền vào — danh sách kind hợp
// lệ là bản sao tay của SHAPE_KINDS bên client và nó phải có ĐÚNG MỘT chỗ ở.
export function sanitizeLiveMoves(list, kindAllowed) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_MOVE_ITEMS) return null;
  const out = [];
  let total = 0;
  for (const m of list) {
    if (!m || !Number.isFinite(m.id) || !Array.isArray(m.pts)) return null;
    // pts là [x0,y0,…]: lẻ một số là dữ liệu hỏng, không phải thiếu điểm cuối.
    if (m.pts.length < 2 || m.pts.length % 2 !== 0) return null;
    total += m.pts.length;
    if (total > MAX_MOVE_NUMBERS) return null;
    if (!m.pts.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_MOVE_COORD)) return null;
    const item = { id: m.id, pts: m.pts };
    // Kéo tay cầm một góc đổi CẢ kind (chữ nhật thành tứ giác, tam giác cân
    // thành tam giác thường), nên kind phải đi kèm — thiếu nó thì người nhận vẽ
    // hình cũ với bộ toạ độ mới, tức một chữ nhật đọc pts 8 số.
    if (m.kind !== undefined) {
      if (typeof m.kind !== "string" || !kindAllowed(m.kind)) return null;
      item.kind = m.kind;
    }
    // Chỉ chữ mới mang ba field này (co giãn đổi cả cỡ chữ lẫn hộp chữ). Không
    // đòi hỏi chúng, nhưng có thì phải là số hợp lệ — một `size: 1e9` lọt qua là
    // một chữ cái phủ kín màn hình cả phòng.
    if (m.size !== undefined) {
      if (!Number.isFinite(m.size) || m.size < MIN_LIVE_INK_TEXT_SIZE || m.size > MAX_LIVE_INK_TEXT_SIZE) return null;
      item.size = m.size;
    }
    for (const f of ["w", "h"]) {
      if (m[f] === undefined) continue;
      if (!Number.isFinite(m[f]) || m[f] < 0 || m[f] > MAX_MOVE_COORD) return null;
      item[f] = m[f];
    }
    out.push(item);
  }
  return out;
}
