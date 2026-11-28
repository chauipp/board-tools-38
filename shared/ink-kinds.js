// Loại nét vẽ / hình khối — dùng chung client và server (ESM thuần, không
// dependency, không đụng DOM/Node API).
//
// Trước đây server (realtime/sanitize-ink.js) giữ BẢN SAO TAY của ba bảng này,
// kèm ghi chú "thêm một kind mới thì phải sửa cả hai chỗ — client sẽ vẽ được
// nhưng server sẽ chặn gói nếu quên". Giờ cả hai cùng import từ đây.
// Ý nghĩa của từng bảng: xem ghi chú đầu client/src/lib/shape.js.

// MỌI kind hình khối hợp lệ, kể cả kind không vẽ trực tiếp được.
export const SHAPE_KINDS = ["rect", "ellipse", "line", "arrow", "triangle", "diamond", "quad"];

// Hình có vùng trong nên tô được. Hai hình còn lại (line, arrow) là hình mở: nút
// "cả hình" ở khu 4 bị vô hiệu khi đang chọn chúng.
export const SHAPE_CLOSED = new Set(["rect", "ellipse", "triangle", "diamond", "quad"]);

// Kind nào có dạng ĐỈNH THẬT, và bao nhiêu toạ độ.
export const VERTEX_NUMBERS = { triangle: 6, quad: 8 };
