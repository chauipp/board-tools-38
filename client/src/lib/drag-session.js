import { rafThrottle } from "./raf-throttle.js";

// Một lượt kéo chuột: phần "ống nước" mà 18 handler kéo trong IdeaMap.jsx từng
// tự viết lại mỗi chỗ một bản — gắn mousemove/mouseup lên window, bọc
// rafThrottle, chạy nốt (hoặc bỏ) khung hình còn treo lúc nhả, gỡ listener.
// Phép tính toạ độ của từng cú kéo vẫn nằm ở handler; ở đây không tính gì cả.
//
// Tham số:
// - onMove(ev, session)   mỗi nhịp di chuột (đã gộp theo khung hình nếu throttle).
// - onEnd(ev, session)    lúc nhả chuột (hoặc mất focus nếu blur: "end"). Chạy
//                         SAU khi đã gỡ listener và xử lý khung hình còn treo.
// - onCancel(session)     khi lượt kéo bị huỷ: cancel() được gọi, Esc, hoặc
//                         mất focus nếu blur: "cancel".
// - threshold             > 0: chỉ coi là "đã kéo" khi con trỏ đi XA HƠN chừng
//                         này pixel màn hình kể từ lúc bấm; trước đó onMove
//                         không được gọi. 0: nhịp di đầu tiên đã là kéo.
// - throttle              bọc onMove bằng rafThrottle (mặc định có).
// - release               "flush": lúc nhả chạy nốt nhịp còn treo — thả ra là
//                         dừng đúng dưới con trỏ. "cancel": bỏ nhịp đó (cho các
//                         cú kéo chỉ vẽ bóng tạm, lúc nhả tự đọc toạ độ từ ev).
// - blur                  "end" | "cancel" | null: cửa sổ mất focus giữa lượt
//                         kéo thì mouseup không bao giờ tới.
// - cancelOnEscape        Esc huỷ lượt kéo (bắt ở pha capture, chặn lan tiếp).
// - target                nơi gắn listener (mặc định window; test truyền giả).
//
// Trả về hàm cancel(): gỡ mọi listener, bỏ nhịp còn treo, gọi onCancel. Gọi
// sau khi lượt kéo đã kết thúc thì không làm gì.
export function startDrag(event, {
  onMove,
  onEnd,
  onCancel,
  threshold = 0,
  throttle = true,
  release = "flush",
  blur = null,
  cancelOnEscape = false,
  target = typeof window !== "undefined" ? window : null
} = {}) {
  const session = { moved: false, startX: event?.clientX ?? 0, startY: event?.clientY ?? 0 };
  let active = true;

  function handle(ev) {
    if (!active) return;
    if (!session.moved) {
      if (threshold > 0 && Math.hypot(ev.clientX - session.startX, ev.clientY - session.startY) <= threshold) return;
      session.moved = true;
    }
    onMove?.(ev, session);
  }
  const move = throttle ? rafThrottle(handle) : handle;

  function onBlur(ev) {
    if (blur === "end") end(ev);
    else cancel();
  }
  function onKey(ev) {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    cancel();
  }

  function detach() {
    target.removeEventListener("mousemove", move);
    target.removeEventListener("mouseup", end);
    if (blur) target.removeEventListener("blur", onBlur);
    if (cancelOnEscape) target.removeEventListener("keydown", onKey, true);
  }

  function end(ev) {
    if (!active) return;
    detach();
    if (throttle) {
      if (release === "flush") move.flush();
      else move.cancel();
    }
    active = false;
    onEnd?.(ev, session);
  }

  function cancel() {
    if (!active) return;
    detach();
    if (throttle) move.cancel();
    active = false;
    onCancel?.(session);
  }

  target.addEventListener("mousemove", move);
  target.addEventListener("mouseup", end);
  if (blur) target.addEventListener("blur", onBlur);
  if (cancelOnEscape) target.addEventListener("keydown", onKey, true);
  return cancel;
}
