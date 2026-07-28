import { useLayoutEffect, useState } from "react";
import { clampPopover } from "./popover.js";

// Trả về {left, top} đã ghim vào trong màn hình cho một popover position: fixed.
// Phải đo chính nó rồi mới quyết được: chiều cao của .badge-editor thay đổi rất
// nhiều theo nội dung (menu một thẻ, menu nhiều thẻ, ô bình luận có/không có
// bình luận), đoán trước bằng hằng số là sai.
//
// useLayoutEffect chứ không useEffect: đo và dời phải xong TRƯỚC khi trình duyệt
// vẽ, nếu không menu sẽ nháy một hình ở chỗ tràn ra ngoài rồi mới nhảy vào.
export function usePopoverPosition(ref, x, y) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setPos(clampPopover({
        x, y, w: r.width, h: r.height,
        vw: window.innerWidth, vh: window.innerHeight
      }));
    };
    measure();
    // Nội dung đổi cỡ sau khi mở (gõ bình luận, đổi số dòng…) thì ghim lại.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y]);

  return pos || { left: x, top: y };
}
