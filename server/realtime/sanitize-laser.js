// Kiểm gói live:laser trước khi relay cho cả phòng. Trước đây phần kiểm này nằm
// thẳng trong handler live:laser của index.js; tách thành hàm thuần để test được.
import {
  MAX_LIVE_INK_COLOR_LEN,
  MIN_LIVE_INK_W,
  MAX_LIVE_INK_W,
  MAX_LIVE_INK_COORD
} from "./sanitize-ink.js";

// Gói live:laser mang các điểm mới của vệt laser. Cùng lý do trần với
// MAX_LIVE_INK_NUMBERS; nhỏ hơn vì client chỉ gom điểm trong 40ms rồi xả.
export const MAX_LIVE_LASER_NUMBERS = 120;

// Thời gian tan của vệt, do người chỉ đặt ở khu 4 (LASER_FADE_MIN/MAX trong
// client/src/lib/laser.js). Chấp một dải rộng hơn client một chút, cùng lý do
// với MIN/MAX_LIVE_INK_W: không phải redeploy server mỗi khi client nới biên độ.
// Vẫn phải có trần — một gói fade: 1e9 là vệt của người đó không bao giờ tan
// trên màn hình cả phòng, và không ai xoá được nó vì laser không có id để gôm.
export const MIN_LIVE_LASER_FADE = 100;
export const MAX_LIVE_LASER_FADE = 10000;

// Trả về gói sạch (chưa có socketId — server tự đính lúc phát), hoặc null nếu
// phải bỏ cả gói.
export function sanitizeLaser(payload) {
  if (!payload || !Array.isArray(payload.pts)) return null;
  const pts = payload.pts.slice(0, MAX_LIVE_LASER_NUMBERS);
  // pts là [x0,y0,x1,y1,…] — lẻ một số là dữ liệu hỏng, không phải thiếu điểm.
  if (pts.length < 2 || pts.length % 2 !== 0) return null;
  // Number.isFinite một mình không đủ: nó cho qua 1e9, và một vệt laser toạ
  // độ khổng lồ vẫn là một vạch phủ ngang màn hình cả phòng. Dùng chung biên
  // độ với live:ink.
  if (!pts.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_LIVE_INK_COORD)) return null;
  // Màu và độ đậm đi kèm MỌI gói, không chỉ gói đầu. Cố ý: gói đầu ở kênh này
  // đi đường .volatile nên có thể rơi, mà nếu chỉ gói đầu mang kiểu vệt thì
  // rơi nó là cả lượt chỉ đó mất màu. Lặp lại hai field nhỏ 25 lần/giây rẻ hơn
  // nhiều so với việc phải làm gói đầu tin cậy.
  //
  // Ở đây chỉ chặn được "chuỗi ngắn" và "số trong biên độ" — server không
  // import được bảng màu của client. Client lọc lần hai bằng
  // sanitizeLaserStyle(), nơi mới biết đâu là token màu thật.
  if (typeof payload.color !== "string" || payload.color.length > MAX_LIVE_INK_COLOR_LEN) return null;
  if (!Number.isFinite(payload.w) || payload.w < MIN_LIVE_INK_W || payload.w > MAX_LIVE_INK_W) return null;
  // fade VẮNG MẶT thì cho qua chứ không chặn gói: client bản cũ (tab đang mở từ
  // trước lần deploy này) không gửi field đó, và chặn nghĩa là vệt của họ biến
  // mất hẳn với cả phòng. Bên nhận tự lùi về mặc định (sanitizeLaserStyle).
  // Có gửi thì phải là số trong biên độ — số rác thì bỏ RIÊNG field đó.
  const fade = Number.isFinite(payload.fade)
    && payload.fade >= MIN_LIVE_LASER_FADE
    && payload.fade <= MAX_LIVE_LASER_FADE
    ? payload.fade : undefined;
  return {
    pts, color: payload.color, w: payload.w, fade,
    // Cú bấm chuột mới bên người gửi: người nhận bỏ vệt cũ thay vì nối tiếp.
    reset: payload.reset === true
  };
}
