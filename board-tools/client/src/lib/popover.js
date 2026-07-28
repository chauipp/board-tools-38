// Ghim một popover (menu chuột phải, bảng màu, ô bình luận…) vào trong màn hình.
// Trước đây các popover này lấy thẳng toạ độ con trỏ làm left/top, nên bấm gần
// mép phải hoặc mép dưới là một phần menu nằm ngoài màn hình và không có cách nào
// với tới — cửa sổ không cuộn được vì chúng là position: fixed.
export const POPOVER_MARGIN = 8;

// Chọn chỗ cho MỘT trục. Thứ tự ưu tiên:
//   1. Giữ nguyên chỗ neo (mở xuống/sang phải như thường) nếu còn vừa.
//   2. Không vừa thì lật sang phía bên kia điểm neo — menu mở lên trên / sang
//      trái con trỏ, con trỏ vẫn nằm ở một góc menu nên vẫn đọc ra là "menu của
//      chỗ vừa bấm".
//   3. Hai bên đều chật (menu cao/rộng hơn khoảng trống) thì dán vào mép cuối,
//      và nếu vẫn không đủ thì dán mép đầu — lúc đó chính menu tự cuộn
//      (max-height trong CSS), không bao giờ mất phần đầu.
function fitAxis(start, size, viewport, margin) {
  if (start + size <= viewport - margin) return Math.max(margin, start);
  const flipped = start - size;
  if (flipped >= margin) return flipped;
  return Math.max(margin, viewport - margin - size);
}

export function clampPopover({ x, y, w, h, vw, vh, margin = POPOVER_MARGIN }) {
  return {
    left: Math.round(fitAxis(x, w, vw, margin)),
    top: Math.round(fitAxis(y, h, vh, margin))
  };
}
