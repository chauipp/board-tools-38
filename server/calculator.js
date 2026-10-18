// Kiểm và làm sạch payload bàn tính trước khi ghi vào Mongo.
//
// Cùng triết lý với live-text.js: dữ liệu hỏng thì LOẠI CẢ GÓI chứ không cắt gọt
// rồi ghi phần còn lại. Ghi một nửa payload là để lại trạng thái không ai cố ý
// tạo ra, và lần sau đọc lên sẽ không ai hiểu vì sao nó thành ra thế.

export const CALC_LIMITS = {
  maxStats: 100,
  maxNameLen: 80,
  // Nới rộng có chủ đích: người dùng gõ số vào ô là chính, nên trần chỉ để chặn
  // payload phi lý (chuỗi số dài vô tận, giá trị sinh ra do lỗi), không phải để
  // áp luật cân bằng game lên người ta.
  maxNumber: 1e9
};

function isCleanNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= CALC_LIMITS.maxNumber;
}

function cleanStat(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!Number.isInteger(raw.id) || raw.id < 0) return null;
  if (typeof raw.name !== "string" || raw.name.length > CALC_LIMITS.maxNameLen) return null;
  if (!isCleanNumber(raw.cost) || !isCleanNumber(raw.a) || !isCleanNumber(raw.b)) return null;
  // Dựng object mới thay vì trải raw: field lạ do client cũ hoặc do người ta tự
  // chèn không được đi lọt vào document.
  return { id: raw.id, name: raw.name, cost: raw.cost, a: raw.a, b: raw.b };
}

// Trả về object sạch để ghi, hoặc null nếu payload không dùng được.
export function sanitizeCalculator(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!isCleanNumber(body.budget)) return null;
  if (!Number.isInteger(body.nextStatId) || body.nextStatId < 1) return null;
  if (!Array.isArray(body.stats) || body.stats.length > CALC_LIMITS.maxStats) return null;

  const stats = [];
  for (const raw of body.stats) {
    const stat = cleanStat(raw);
    if (!stat) return null;
    stats.push(stat);
  }
  // Hai chỉ số cùng id thì client tra nhầm nhau khi sửa — chặn ngay ở cửa.
  if (new Set(stats.map((s) => s.id)).size !== stats.length) return null;

  return { budget: body.budget, nextStatId: body.nextStatId, stats };
}

// Cú ghi nào tới trước thì thắng? Không phải cú tới sau, mà cú được TẠO RA sau.
//
// Bàn tính lưu theo từng phím gõ, nên hai request có thể chồng nhau và về không
// đúng thứ tự gửi đi — cú cũ về sau sẽ ghi đè cú mới, và người dùng thấy chữ
// mình vừa gõ tự lùi lại. Client gửi kèm mốc thời gian lúc sửa; mốc cũ hơn bản
// đang có nghĩa là cú này đã lỗi thời, bỏ qua.
//
// Dựa vào đồng hồ máy client là chấp nhận được vì hai cú ghi đang so với nhau
// gần như luôn tới từ cùng một máy (một người, vài tab). Không có `savedAt` thì
// cho ghi — client cũ vẫn phải dùng được.
export function isStaleWrite(incomingSavedAt, storedSavedAt) {
  if (typeof incomingSavedAt !== "number" || !Number.isFinite(incomingSavedAt)) return false;
  if (typeof storedSavedAt !== "number" || !Number.isFinite(storedSavedAt)) return false;
  return incomingSavedAt < storedSavedAt;
}
