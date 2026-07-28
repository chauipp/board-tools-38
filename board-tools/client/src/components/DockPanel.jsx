import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { snapPanel, clampToBounds } from "../lib/dock.js";

// Panel nổi bị kẹp trong vùng vẽ. Từ khi canvas tràn viền, vùng vẽ CHÍNH LÀ cả
// khung nhìn — hàm này không đổi một dòng nào, nhưng ý nghĩa của nó thì đổi: nó
// không còn đảm bảo "panel không che lên thanh nào" được nữa, vì không còn thanh
// nào để né. Panel giờ có thể nằm đè lên đảo; kéo đi chỗ khác là xong.
function canvasBounds() {
  const el = document.querySelector(".viewport");
  if (!el) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

// Mốc căn hàng = các panel còn lại (neo hay nổi đều tính). Đọc trực tiếp từ DOM
// thay vì truyền rect qua prop: chỉ một panel được kéo tại một thời điểm, và rect
// thật là thứ duy nhất khớp với cái người dùng đang nhìn.
function otherPanelRects(self) {
  return Array.from(document.querySelectorAll(".dock-panel"))
    .filter((el) => el !== self)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
}

function GripIcon() {
  return (
    <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
      <circle cx="2" cy="2" r="1.1" fill="currentColor" />
      <circle cx="6" cy="2" r="1.1" fill="currentColor" />
      <circle cx="2" cy="6" r="1.1" fill="currentColor" />
      <circle cx="6" cy="6" r="1.1" fill="currentColor" />
      <circle cx="2" cy="10" r="1.1" fill="currentColor" />
      <circle cx="6" cy="10" r="1.1" fill="currentColor" />
    </svg>
  );
}

export default function DockPanel({ title, layout, barRef, onLayout, children }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const [guides, setGuides] = useState([]);

  // Vị trí lưu từ phiên trước có thể đang đè lên bar (dữ liệu cũ, từ trước khi panel
  // bị kẹp trong vùng vẽ) hoặc nằm ngoài cửa sổ đã thu nhỏ. Kẹp lại khi mount và mỗi
  // lần đổi cỡ cửa sổ. Chỉ kẹp, không hút mép: một vị trí vẫn hợp lệ thì để nguyên.
  useEffect(() => {
    if (!layout.free) return;
    function reclamp() {
      const el = ref.current;
      if (!el) return;
      const p = clampToBounds(layout.x, layout.y, el.offsetWidth, el.offsetHeight, canvasBounds());
      if (p.x !== layout.x || p.y !== layout.y) onLayout({ ...layout, x: p.x, y: p.y });
    }
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [layout.free, layout.x, layout.y]);

  function handleGripMouseDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const grabX = e.clientX - rect.left, grabY = e.clientY - rect.top;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;

    // Vùng thả là khay neo trong đảo to. Không lấy cả đảo: hàng nút của đảo phải
    // bấm được, và lấy cả đảo thì mọi lần thả gần đó đều thành neo. Khay là đích
    // duy nhất nên không nhập nhằng "đậu nổi ở đây" với "neo vào đây": trong khay
    // là neo, ngoài khay là nổi.
    function overBar(ev) {
      const bar = barRef.current && barRef.current.getBoundingClientRect();
      return !!bar && ev.clientX >= bar.left && ev.clientX <= bar.right
        && ev.clientY >= bar.top && ev.clientY <= bar.bottom;
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        dragging = true;
        // Khay neo co về 0 khi không panel nào neo, nên lúc đó nó không nhắm
        // trúng được — bung nó ra thành ô nét đứt suốt lượt kéo. Thiếu bước này
        // thì panel cuối cùng rời khay là không còn đường nào neo lại.
        // Bật ở đây chứ không ở mousedown: bấm-không-kéo là lệnh xoay ngang/dọc,
        // không nên làm khay nhấp nháy một cái.
        if (barRef.current) barRef.current.classList.add("drag-active");
      }
      if (!dragging) return;
      const p = snapPanel(
        ev.clientX - grabX, ev.clientY - grabY,
        el.offsetWidth, el.offsetHeight,
        canvasBounds(),
        otherPanelRects(el)
      );
      setGuides(p.guides);
      // Bật sáng hàng nút bằng classList thay vì state: đây là gợi ý hover thuần
      // thị giác, không đáng kéo state xuyên qua IdeaMap để mỗi mousemove render lại.
      if (barRef.current) barRef.current.classList.toggle("drop-target", overBar(ev));
      onLayout({ ...layout, free: true, x: p.x, y: p.y });
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setGuides([]);
      if (barRef.current) barRef.current.classList.remove("drop-target", "drag-active");
      // Không kéo = click → xoay ngang/dọc.
      if (!dragging) return onLayout({ ...layout, vertical: !layout.vertical });
      if (overBar(ev)) onLayout({ ...layout, free: false });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Hướng dọc chỉ áp dụng khi panel nổi. Panel neo dùng chung một hàng với các
  // panel neo khác, xếp dọc một cái là cả hàng cao theo nó và đẩy canvas xuống.
  // Cờ vẫn được lưu để kéo ra là dọc ngay.
  const cls = "fb-panel dock-panel"
    + (layout.free ? " free" : "")
    + (layout.free && layout.vertical ? " vertical" : "");

  return (
    <>
      <div
        className={cls}
        ref={ref}
        style={layout.free ? { left: layout.x, top: layout.y } : undefined}
      >
        <button
          className="dock-grip"
          onMouseDown={handleGripMouseDown}
          title={t`Kéo để đặt vị trí — bấm để xoay ngang/dọc`}
        >
          <GripIcon />
        </button>
        {layout.free && <span className="dock-title">{title}</span>}
        {children}
      </div>
      {guides.map((g, i) => (
        <div
          key={i}
          className={"dock-guide " + g.axis}
          style={g.axis === "v"
            ? { left: g.pos, top: g.start, height: g.end - g.start }
            : { top: g.pos, left: g.start, width: g.end - g.start }}
        />
      ))}
    </>
  );
}
