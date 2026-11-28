// Nguồn duy nhất cho danh sách field nội dung của board.
//
// Trước đây danh sách này bị chép tay 5 lần trong boards.js (GET, restore,
// destructure/update/broadcast của PUT). Thêm một field mà sót một chỗ là mất
// dữ liệu âm thầm: server nhận nhưng không ghi, hoặc ghi nhưng không phát cho
// người khác trong phòng. Thêm field mới thì thêm Ở ĐÂY.

// Thứ tự giữ nguyên như trong board-payload.js: validateBoardPayload trả lỗi
// đầu tiên gặp, nên đổi thứ tự là đổi câu lỗi.
export const BOARD_LIST_FIELDS = ["nodes", "edges", "groups", "drawings", "statuses", "tags", "palette"];
export const BOARD_COUNTER_FIELDS = [
  "nextNodeId", "nextEdgeId", "nextGroupId",
  "nextStatusId", "nextTagId", "nextPaletteId", "nextDrawingId"
];
export const BOARD_THEME_FIELDS = ["bg", "grid", "pack"];
// `kind` và các field game-design không nằm trong pickBoardContent: chúng đi
// qua resolveGameDesignFields (thiếu field là giữ giá trị cũ, không phải xoá).
export const BOARD_GAME_DESIGN_FIELDS = ["gameDesignBrief", "gameDesignFlow", "gameDesignBalance"];

const CONTENT_FIELDS = [...BOARD_LIST_FIELDS, ...BOARD_THEME_FIELDS, ...BOARD_COUNTER_FIELDS];

// Luôn đặt đủ key, kể cả khi giá trị là undefined: findByIdAndUpdate bỏ qua
// field undefined (thiếu field = "không đổi phần này"), và JSON cũng bỏ nó.
export function pickBoardContent(obj) {
  const out = {};
  for (const field of CONTENT_FIELDS) out[field] = obj[field];
  return out;
}

// Nội dung board trả cho client. Dùng chung cho GET và cho thân của 409
// (conflict) — hai chỗ đó phải trả ĐÚNG một hình dạng, lệch nhau là phía client
// ghép nhầm một board thiếu field.
export function boardPayload(obj) {
  return {
    kind: obj.kind || "idea",
    ...Object.fromEntries(BOARD_GAME_DESIGN_FIELDS.map((field) => [field, obj[field] ?? null])),
    ...pickBoardContent(obj),
    nextStatusId: safeNextStatusId(obj),
    updatedAt: obj.updatedAt
  };
}

// Bộ đếm id trạng thái không bao giờ được nhỏ hơn max(id) + 1. Board
// game-design tạo trước bản sửa B1 lưu 9 trạng thái (id 1–9) với
// nextStatusId = 9, và client cấp thẳng số đó cho trạng thái mới → trùng id với
// "Archived" (review PR #5). Sửa ở đây là sửa cho mọi đường trả board (GET, thân
// 409, snapshot); lần lưu kế tiếp của client ghi lại giá trị đã sửa. Chỉ đổi bộ
// đếm, không đụng id của trạng thái nào nên tham chiếu trên thẻ giữ nguyên.
export function safeNextStatusId(obj) {
  const stored = obj.nextStatusId;
  if (!Array.isArray(obj.statuses)) return stored;
  const maxId = obj.statuses.reduce((m, s) => (Number.isFinite(s?.id) && s.id > m ? s.id : m), 0);
  return Math.max(Number.isFinite(stored) ? stored : 1, maxId + 1);
}
