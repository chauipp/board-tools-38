// Bấm nhiều lần liên tiếp lên NỀN TRỐNG của bảng: 2 lần là hoàn tác, 3 lần là
// làm lại. Không dính React, không đụng DOM — nhờ vậy test được bằng node:test.
//
// Vì sao tự đếm thay vì đọc `event.detail` mà trình duyệt đã đếm sẵn: `detail`
// đếm theo cửa sổ riêng của từng trình duyệt (Chrome chừng 500ms, không chỉnh
// được), trong khi ở đây cửa sổ ĐẾM và cửa sổ CHỜ bắt buộc phải là cùng một con
// số. Chờ ngắn hơn đếm thì có lúc đã làm xong việc của "2 lần" rồi mà trình
// duyệt vẫn báo cú bấm tiếp theo là lần thứ 3 — và người dùng nhận được một cú
// làm lại mà họ không hề yêu cầu.
export const MULTI_CLICK_MS = 300;

// Chuột nhích quá chừng này (pixel MÀN HÌNH) giữa lúc ấn và lúc nhả thì đó là
// một cú KÉO chứ không phải một cú bấm. Chốt này bắt buộc phải có: quét chọn một
// vùng, vẽ một nét, lia bảng — cả ba đều kết thúc bằng một sự kiện `click` trên
// nền, và hai lần quét liền nhau sẽ thành một cú hoàn tác không ai gọi.
export const CLICK_DRAG_TOL = 4;

// Bấm mấy lần thì làm gì. Bốn lần trở lên KHÔNG làm gì: bấm loạn tay không được
// biến thành một chuỗi thao tác lên dữ liệu.
export function multiClickAction(count) {
  if (count === 2) return "undo";
  if (count === 3) return "redo";
  return null;
}

// Bộ đếm bấm liên tiếp. `now` truyền từ ngoài vào (Date.now) chứ không đọc trong
// hàm: test phải chạy được mà không cần đợi thật.
export function createMultiClick(windowMs = MULTI_CLICK_MS) {
  let count = 0;
  let last = -Infinity;
  return {
    // Số lần bấm liên tiếp TÍNH CẢ lần này.
    click(now) {
      count = now - last <= windowMs ? count + 1 : 1;
      last = now;
      return count;
    },
    // Kết thúc một chuỗi: sau khi đã làm xong việc, hoặc khi có thứ chen vào
    // (một cú kéo, một cú bấm trúng thẻ) làm chuỗi không còn là chuỗi nữa.
    cancel() {
      count = 0;
      last = -Infinity;
    }
  };
}
