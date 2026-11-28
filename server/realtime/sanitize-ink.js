// Kiểm gói live:ink trước khi relay cho cả phòng. Di chuyển nguyên văn từ
// index.js; các hằng số MAX/MIN_LIVE_INK_* cũng được sanitize-laser.js dùng chung.
import { sanitizeLiveText, sanitizeLiveMoves } from "../live-text.js";
import { SHAPE_KINDS, SHAPE_CLOSED, VERTEX_NUMBERS } from "../../shared/ink-kinds.js";

// Gói live:ink mang ĐIỂM MỚI THÊM của một nét đang vẽ. Trần này để một client
// lỗi (hoặc cố tình) không bơm được mảng khổng lồ rồi bắt server phát cho cả
// phòng — cùng lý do với MAX_LIVE_GEOM_ITEMS.
export const MAX_LIVE_INK_NUMBERS = 200;
export const MAX_LIVE_ERASE_IDS = 200;
// color là token kiểu "pen-red" — 32 ký tự là quá rộng rãi cho nó. w hợp lệ từ
// client hiện là 2/4/8; chấp một dải rộng hơn thay vì đúng ba giá trị đó để
// không phải redeploy server mỗi khi client đổi danh sách độ dày. Chặn ở đây
// để một client lỗi (hoặc cố tình) không bơm chuỗi màu khổng lồ hay w khổng lồ
// rồi bắt server phát vệt bút phủ kín màn hình cho cả phòng tới khi hết TTL.
export const MAX_LIVE_INK_COLOR_LEN = 32;
export const MIN_LIVE_INK_W = 1;
export const MAX_LIVE_INK_W = 64;

// Biên độ tuyệt đối cho từng số trong `pts`. Number.isFinite một mình KHÔNG đủ:
// nó cho qua 1e9. Với nét bút, thiệt hại tối đa của toạ độ khổng lồ chỉ là một
// VỆT rộng ≤ MAX_LIVE_INK_W — đó là lý do MAX_LIVE_INK_W tồn tại. Nhưng hình
// khối có `fill`, nên gói {kind:"rect", fill:true, pts:[-1e9,-1e9,1e9,1e9]} đi
// vòng qua chốt đó và phủ kín màn hình cả phòng tới khi hết TTL.
//
// .canvas là 4200×3200 nên 20000 (gần 5 lần cạnh dài) rộng hơn mọi thao tác
// thật rất nhiều — kể cả kéo hình vượt ra ngoài mép canvas — mà vẫn giữ vùng
// hiển thị hữu hạn. Chốt này áp cho MỌI kind, cả nét bút.
export const MAX_LIVE_INK_COORD = 20000;

// SHAPE_KINDS dùng chung với client (shared/ink-kinds.js), cộng "pen" và "text".
export const LIVE_INK_KINDS = new Set(["pen", ...SHAPE_KINDS, "text"]);
// SHAPE_CLOSED dùng chung với client (shared/ink-kinds.js).
// Chỉ bốn hình ĐÓNG mới có vùng trong để tô. Client không bao giờ gắn `fill`
// cho line/arrow, nên nếu server chấp thì một gói {kind:"arrow", fill:true} làm
// đầu mũi tên hiện thành nêm tô đặc lúc peer kéo rồi biến mất khi board:update
// về — nhấp nháy không giải thích được.
export const LIVE_INK_FILLABLE_KINDS = new Set(SHAPE_CLOSED);
export const LIVE_INK_BOX_NUMBERS = 4;
// Hình có dạng ĐỈNH THẬT thì pts dài hơn 4 số. Hộp bao chỉ tả được hình "chuẩn"
// (tam giác cân, chữ nhật thẳng trục), mà hình nhận ra từ nét vẽ tay — hoặc hình
// vừa bị kéo tay cầm đỉnh — thì đủ loại: tam giác vuông/tù/bè, hình bình hành,
// hình thang. Xem ghi chú đầu client/src/lib/shape.js.
//
// VERTEX_NUMBERS dùng chung với client (shared/ink-kinds.js).
export const LIVE_INK_VERTEX_NUMBERS = VERTEX_NUMBERS;

export function sanitizeInk(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!Number.isFinite(payload.strokeId)) return null;
  const strokeId = payload.strokeId;
  const done = payload.done === true;

  if (payload.cancel === true) return { strokeId, cancel: true };

  // Lượt dời / co giãn / sửa hình: gói mang trạng thái tuyệt đối của các nét
  // đang bị thao tác. Xét TRƯỚC nhánh pts vì nó không có `pts` ở cấp gói.
  if (Array.isArray(payload.moving)) {
    const moving = sanitizeLiveMoves(payload.moving, (k) => LIVE_INK_KINDS.has(k));
    if (!moving) return null;
    return { strokeId, seq: Number.isFinite(payload.seq) ? payload.seq : 0, moving, done };
  }

  if (Array.isArray(payload.erase)) {
    const erase = payload.erase
      .filter((id) => Number.isFinite(id))
      .slice(0, MAX_LIVE_ERASE_IDS);
    return { strokeId, erase, done };
  }

  if (done) {
    return {
      strokeId, done: true,
      drawingId: Number.isFinite(payload.drawingId) ? payload.drawingId : null
    };
  }

  // pts phải là mảng số ĐỘ DÀI CHẴN: nó là [x0,y0,x1,y1,…], lẻ một số là dữ
  // liệu hỏng chứ không phải thiếu điểm cuối.
  if (!Array.isArray(payload.pts)) return null;

  let kind = "pen";
  if (payload.kind !== undefined) {
    if (typeof payload.kind !== "string" || !LIVE_INK_KINDS.has(payload.kind)) return null;
    kind = payload.kind;
  }
  // Hình khối: pts là hai góc đối, đúng 4 số — riêng hình có dạng đỉnh thật thì
  // nhận thêm đúng số toạ độ của dạng đó (tam giác 6, tứ giác 8). Kiểm ĐỘ DÀI GỐC trước khi slice — nếu kiểm sau thì một mảng
  // 4000 số bị cắt còn MAX_LIVE_INK_NUMBERS rồi vẫn không phải 4, nhưng một mảng
  // gửi kèm kind sai vẫn có thể lọt qua nhờ bị cắt.
  // Chữ neo bằng ĐÚNG một điểm (góc trên trái), không phải hộp hai góc: bề rộng
  // và chiều cao của nó do nội dung và cỡ chữ quyết định, không do người kéo.
  if (kind === "text") {
    if (payload.pts.length !== 2) return null;
  } else if (kind !== "pen") {
    const okLen = payload.pts.length === LIVE_INK_BOX_NUMBERS
      || payload.pts.length === LIVE_INK_VERTEX_NUMBERS[kind];
    if (!okLen) return null;
  }

  const pts = payload.pts.slice(0, MAX_LIVE_INK_NUMBERS);
  if (pts.length < 2 || pts.length % 2 !== 0) return null;
  if (!pts.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_LIVE_INK_COORD)) return null;

  const clean = { strokeId, seq: Number.isFinite(payload.seq) ? payload.seq : 0, pts };
  // Nét bút không mang kind, đúng như client phát — giữ gói nhẹ và giữ
  // mergeInkPacket mặc định về "pen".
  if (kind !== "pen") clean.kind = kind;

  // Phần riêng của chữ nằm ở server/live-text.js — xem ghi chú đầu file đó về
  // việc vì sao đúng nhánh này phải tách ra để test được.
  if (kind === "text") {
    const t = sanitizeLiveText(payload, clean.seq === 0);
    if (!t) return null;
    Object.assign(clean, t);
  }

  if (clean.seq === 0) {
    if (typeof payload.color !== "string" || payload.color.length > MAX_LIVE_INK_COLOR_LEN) return null;
    // Chữ không có `w` — cỡ chữ của nó đã được sanitizeLiveText kiểm ở trên.
    if (kind !== "text") {
      if (!Number.isFinite(payload.w) || payload.w < MIN_LIVE_INK_W || payload.w > MAX_LIVE_INK_W) return null;
      clean.w = payload.w;
    }
    clean.color = payload.color;
    // Không tin kiểu client gửi: chỉ đúng `true` mới là tô đặc. Và chỉ hình
    // ĐÓNG mới được mang `fill` — nét bút, line, arrow thì không có field này.
    if (LIVE_INK_FILLABLE_KINDS.has(kind)) clean.fill = payload.fill === true;
    // Nét đứt thì áp cho MỌI kind, kể cả nét bút — khác `fill` ngay trên, vốn chỉ
    // có nghĩa với hình đóng. Cũng không tin kiểu client gửi: chỉ đúng `true`.
    clean.dashed = payload.dashed === true;
  }
  return clean;
}
