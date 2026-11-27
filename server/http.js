// Khối try/catch mà mọi route board đều lặp lại, gom về một chỗ.
//
// CastError là khi `:id` không phải ObjectId hợp lệ — với người gọi thì đó
// chính là "không có board này", nên trả 404 not_found như khi không tìm thấy,
// không phải 500. Lỗi khác thì 500 kèm đúng câu lỗi riêng của từng route.
//
// `onError` chạy TRƯỚC khi trả lỗi, cho route nào cần dọn dẹp (ví dụ upload xoá
// file tạm Multer vừa ghi) — không để lớp gói này nuốt mất bước dọn đó.
export function asyncRoute(handler, fallbackMessage, { onError } = {}) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (e) {
      if (onError) onError(req, e);
      if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
      res.status(500).json({ error: fallbackMessage });
    }
  };
}
