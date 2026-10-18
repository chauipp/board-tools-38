// Preset giao diện của MỘT BẢNG: nền sa bàn và bộ màu. Cả hai là dữ liệu board
// (lưu server, đồng bộ realtime), khác với sáng/tối và skin vẽ tay — hai thứ đó
// là thiết lập của từng người, nằm ở localStorage.
//
// Module này CHỈ giữ id, không giữ một mã màu nào: toàn bộ giá trị nằm trong
// idea-map.css, chọn theo `data-bg` / `data-pack` trên <html>. Nhờ vậy không có
// hai nguồn sự thật để lệch nhau, và nút swatch trong panel Giao diện chỉ cần
// mang `data-bg` là CSS tự tô đúng màu nó đại diện.

// `null` = "theo giao diện", tức nền như trước đợt này. Nó không nằm trong mảng
// vì đây là danh sách preset, còn null là "không preset nào".
export const BOARD_BGS = ["paper", "white", "slate", "mint", "blush"];

// `null` = bộ màu Cổ điển (8 token --dot-* gốc trong index.css).
export const COLOR_PACKS = ["pastel", "vivid", "mono"];

// Hai hàm dưới canh cửa cho DOM: giá trị đi thẳng vào setAttribute("data-bg", …).
// Nguồn của nó không phải lúc nào cũng là cú bấm của người dùng — "Nhập JSON"
// cho phép dán một board tay viết vào, và board đó có thể mang bg: "…" bất kỳ.
function isOneOf(list, v) {
  return v == null || (typeof v === "string" && list.includes(v));
}

export function isBoardBg(v) {
  return isOneOf(BOARD_BGS, v);
}

export function isColorPack(v) {
  return isOneOf(COLOR_PACKS, v);
}
