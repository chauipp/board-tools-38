// Ảnh được nhúng thẳng vào board dưới dạng data URL, và cả board là MỘT document
// MongoDB — trần cứng 16MB của MongoDB là trần thật của tổng số ảnh trên bảng.
// Từ khi ảnh giữ nguyên chất lượng gốc (lib/image-utils.js) thì trần đó với tới
// được, nên phải kiểm TRƯỚC khi thêm: chạm trần mà không kiểm thì cú lưu lăn ra
// hỏng ở tận server, người dùng chỉ thấy "không lưu được" mà không hiểu vì sao,
// còn ảnh thì đã nằm trên bảng rồi.
export const BOARD_HARD_LIMIT = 16 * 1024 * 1024;
// Chừa chỗ cho phần còn lại của board (chữ, dây nối, nét vẽ, lịch sử bình luận)
// và cho phần phình 33% của base64 đã tính sẵn trong độ dài chuỗi.
export const BOARD_IMAGE_BUDGET = 14 * 1024 * 1024;

// Độ dài chuỗi data URL ~ số byte gửi đi (base64 là ASCII, một ký tự một byte).
export function imageBytes(nodes) {
  let total = 0;
  for (const n of nodes || []) {
    if (typeof n?.image === "string") total += n.image.length;
  }
  return total;
}

// `replaceNodeId`: dán đè ảnh lên thẻ đang có ảnh thì ảnh cũ được thay chứ không
// cộng thêm — không trừ ra là chặn nhầm ngay lần dán đè thứ hai.
export function canAddImage(nodes, dataUrl, replaceNodeId = null) {
  const adding = typeof dataUrl === "string" ? dataUrl.length : 0;
  const replaced = replaceNodeId == null
    ? 0
    : imageBytes((nodes || []).filter((n) => n.id === replaceNodeId));
  const used = imageBytes(nodes) - replaced;
  return { ok: used + adding <= BOARD_IMAGE_BUDGET, used, adding, budget: BOARD_IMAGE_BUDGET };
}

export function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}
