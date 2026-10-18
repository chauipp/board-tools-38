// Text trên bảng: một phần tử của board.drawings với kind: "text". Nó KHÔNG có
// kiểu dữ liệu riêng — nhờ vậy lưu, hoàn tác, realtime và cục gôm dùng lại được
// nguyên đường đã có của nét bút và hình khối.
//
//   { id, kind: "text", pts: [x, y], text, color, size, w, h }
//
// Khác hai loại kia ở ba chỗ: `pts` chỉ có 2 số (ĐIỂM NEO góc trên trái, không
// phải hộp — cỡ chữ quyết định chiều cao, nội dung quyết định chiều rộng, kéo ra
// một cái hộp là vô nghĩa); có `text` và `size`; và `w`/`h` là kích thước hộp
// chữ chứ không phải độ dày nét.

// Ba mức cố định, không phải ô nhập tự do. Cùng lý do ba mức độ dày của bút:
// trên một bảng nhiều người dùng chung, ba cỡ thì còn ra một hệ phân cấp đọc
// được, còn tự do thì mỗi người một cỡ và bảng thành cái chợ.
export const TEXT_SIZES = [14, 20, 30];

export const TEXT_LINE_H = 1.3;

// Hộp của text rỗng: vẫn phải bấm trúng được để còn sửa hoặc xoá.
const MIN_W = 8;

export function textLines(text) {
  if (typeof text !== "string") return [""];
  // Chuẩn hoá \r\n trước: textarea trên Windows trả về kiểu đó, và một ký tự \r
  // sót lại sẽ đo ra thừa một khoảng trắng ở cuối mỗi dòng.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return lines.length ? lines : [""];
}

// `measureWidth` là THAM SỐ chứ không gọi thẳng canvas: đo bề rộng chữ cần DOM,
// mà module này phải chạy được trong node:test. Người gọi trong IdeaMap truyền
// hàm đo thật dựng từ canvas 2d context — cùng cách png-export.js đang làm.
export function textBox(lines, size, measureWidth) {
  const rows = lines && lines.length ? lines : [""];
  let w = MIN_W;
  for (const line of rows) {
    const lw = measureWidth(line, size);
    if (lw > w) w = lw;
  }
  // Dòng trống cũng tính một dòng chiều cao: nếu không thì gõ Enter xuống dòng
  // rồi để trống, hộp co lại và cục gôm hụt mất phần dưới.
  return { w: Math.round(w), h: Math.round(rows.length * size * TEXT_LINE_H) };
}

// `w`/`h` đọc từ chính phần tử, không đo lại: đo cần DOM, và hit-test thì chạy
// hàng chục lần mỗi giây trong lúc quét gôm. Cái giá là đổi skin (đổi font) làm
// hộp lệch vài phần trăm so với chữ đang hiển thị — chấp nhận được, vì hộp chỉ
// dùng cho vùng chạm. Đo lại toàn bộ mỗi lần đổi skin thì phải ghi cả drawings
// lên server chỉ vì một người đổi kiểu xem.
export function textHitBy(el, point, radius) {
  const pts = el && el.pts;
  if (!Array.isArray(pts) || pts.length < 2) return false;
  if (!(el.w > 0) || !(el.h > 0)) return false;
  const [x, y] = pts;
  return point.x >= x - radius && point.x <= x + el.w + radius
      && point.y >= y - radius && point.y <= y + el.h + radius;
}
