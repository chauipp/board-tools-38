// Bấm nhiều lần liên tiếp trên bảng. Trên MỘT NÉT VẼ: 2 lần là đổi nét liền ↔
// nét đứt của đúng nét đó. Không dính React, không đụng DOM — nhờ vậy test
// được bằng node:test.
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

export function isDragGesture(anchor, point, tolerance = CLICK_DRAG_TOL) {
  if (!anchor || !point) return false;
  return Math.hypot(point.x - anchor.x, point.y - anchor.y) > tolerance;
}

// Bộ đếm bấm liên tiếp. `now` truyền từ ngoài vào (Date.now) chứ không đọc trong
// hàm: test phải chạy được mà không cần đợi thật.
export function createMultiClick(windowMs = MULTI_CLICK_MS) {
  let count = 0;
  let last = -Infinity;
  // Đích của lần bấm trước. Cố ý khởi tạo là `undefined` chứ không phải `null`:
  // `null` là một đích THẬT (nền trống), nên nếu khởi tạo bằng nó thì cú bấm đầu
  // tiên trong đời bộ đếm sẽ so ra "cùng đích" — vô hại lúc này vì `last` vẫn là
  // -Infinity, nhưng là một cái bẫy chỉ chờ ai đó đổi luật thời gian.
  let target;
  return {
    // Số lần bấm liên tiếp TÍNH CẢ lần này. `at` là thứ đang bị bấm: id của nét
    // vẽ nằm dưới con trỏ, hay null cho nền trống.
    //
    // Đổi đích là chuỗi BẮT ĐẦU LẠI từ 1, không cộng dồn. Thiếu vế này thì một cú
    // bấm lên nét rồi một cú bấm lên nền — hai việc chẳng liên quan gì nhau, và
    // là chuyện xảy ra liên tục khi vừa vẽ vừa sửa — sẽ đếm thành 2 và người dùng
    // ăn một cú hoàn tác không ai gọi.
    click(now, at = null) {
      count = now - last <= windowMs && at === target ? count + 1 : 1;
      last = now;
      target = at;
      return count;
    },
    // Kết thúc một chuỗi: sau khi đã làm xong việc, hoặc khi có thứ chen vào
    // (một cú kéo, một cú bấm trúng thẻ) làm chuỗi không còn là chuỗi nữa.
    cancel() {
      count = 0;
      last = -Infinity;
      target = undefined;
    }
  };
}
