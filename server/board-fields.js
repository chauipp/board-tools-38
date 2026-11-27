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
