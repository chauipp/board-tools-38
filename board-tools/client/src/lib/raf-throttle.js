// Chuột hiện đại bắn `mousemove` 120–1000 lần/giây, còn màn hình chỉ vẽ được
// 60–120 khung hình/giây. Gọi setState cho từng sự kiện là làm thừa phần lớn
// công việc và là nguồn giật chính lúc kéo thẻ: React dựng lại cây, trình duyệt
// tính lại layout, rồi vứt đi vì khung hình kế tiếp đã có dữ liệu mới.
//
// rafThrottle gộp mọi lần gọi trong cùng một khung hình thành đúng một lần và
// luôn dùng THAM SỐ MỚI NHẤT — thả bớt khung trung gian, không thả vị trí cuối.
export function rafThrottle(fn) {
  let frame = 0;
  let pending = null;

  function run() {
    frame = 0;
    const args = pending;
    pending = null;
    if (args) fn(...args);
  }

  function throttled(...args) {
    pending = args;
    if (frame) return;
    frame = requestAnimationFrame(run);
  }

  // Lúc thả chuột phải chạy nốt lần gọi còn treo: nếu chỉ cancel, thẻ sẽ dừng
  // lệch khỏi con trỏ đúng bằng quãng của một khung hình cuối.
  throttled.flush = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    run();
  };

  throttled.cancel = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
  };

  return throttled;
}

// Throttle theo thời gian có "đuôi": trong khoảng `ms` chỉ gửi một lần, nhưng
// lần gọi cuối cùng của loạt luôn được gửi sau đó — dùng cho các kênh mạng
// (live:geom, selection:update) nơi bỏ mất trạng thái CUỐI là sai, còn bỏ các
// trạng thái giữa chừng thì không.
export function trailingThrottle(fn, ms) {
  let lastRun = 0;
  let timer = null;
  let pending = null;

  function fire() {
    timer = null;
    lastRun = Date.now();
    const args = pending;
    pending = null;
    if (args) fn(...args);
  }

  function throttled(...args) {
    pending = args;
    if (timer) return;
    const wait = ms - (Date.now() - lastRun);
    if (wait <= 0) fire();
    else timer = setTimeout(fire, wait);
  }

  throttled.flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending) fire();
  };

  throttled.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    pending = null;
  };

  return throttled;
}
