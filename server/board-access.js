import { Board } from "./models.js";
import { getBoardRole } from "./auth.js";

// Board nhúng ảnh base64 trong nodes[] (giới hạn body 10mb), nên đọc cả document
// chỉ để xét quyền là rất đắt — nhất là ở PUT, nơi client autosave mỗi 500ms.
// Route nào không cần nội dung board thì truyền AUTH_FIELDS.
export const AUTH_FIELDS = "ownerEmail members";
// PUT cần thêm `updatedAt` để so với mốc client khai là mình đang dựa trên —
// đó là toàn bộ cơ chế phát hiện hai người lưu đè nhau. Vẫn KHÔNG đọc nội dung
// board: một Date thì rẻ, còn nodes[] có ảnh base64 thì không.
export const AUTH_FIELDS_VERSIONED = "ownerEmail members updatedAt kind gameDesignBrief gameDesignFlow gameDesignBalance";

// Trả 404 (không phải 403) khi người gọi không có role nào trên board —
// tránh lộ việc board có tồn tại hay không cho người ngoài.
export async function loadBoardWithRole(req, res, minRole, projection) {
  const query = Board.findById(req.params.id);
  if (projection) query.select(projection);
  const board = await query;
  if (!board) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  const role = getBoardRole(board, req.user.email);
  if (!role) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  if (minRole === "editor" && role === "viewer") {
    res.status(403).json({ error: "read_only" });
    return null;
  }
  if (minRole === "owner" && role !== "owner") {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  return { board, role };
}

// Mốc phiên bản kế tiếp của board: thời điểm hiện tại, nhưng LUÔN lớn hơn mốc
// đang lưu. `updatedAt` là thứ client dùng để khai "bản tôi đang dựa trên"; hai
// lần ghi trùng mốc thì chốt va chạm ở PUT không phân biệt được chúng.
export function nextUpdatedAt(current, now = Date.now()) {
  const prev = current ? new Date(current).getTime() : NaN;
  return new Date(Number.isFinite(prev) ? Math.max(now, prev + 1) : now);
}
