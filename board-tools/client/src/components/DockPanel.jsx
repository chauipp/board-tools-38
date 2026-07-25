import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { snapPanel } from "../lib/dock.js";

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

  function handleGripMouseDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const grabX = e.clientX - rect.left, grabY = e.clientY - rect.top;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) dragging = true;
      if (!dragging) return;
      const p = snapPanel(
        ev.clientX - grabX, ev.clientY - grabY,
        el.offsetWidth, el.offsetHeight,
        window.innerWidth, window.innerHeight,
        otherPanelRects(el)
      );
      setGuides(p.guides);
      onLayout({ ...layout, free: true, x: p.x, y: p.y });
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setGuides([]);
      // Không kéo = click → xoay ngang/dọc.
      if (!dragging) return onLayout({ ...layout, vertical: !layout.vertical });
      // Thả lên hàng nút thì neo về chỗ cũ. Vùng thả là hàng nút chứ không phải
      // cả filterbar: lấy cả bar thì nó nuốt đúng dải mà người ta muốn đặt panel
      // nổi thẳng hàng với panel đang neo, và không bao giờ căn hàng được ở đó.
      const bar = barRef.current && barRef.current.getBoundingClientRect();
      if (bar && ev.clientX >= bar.left && ev.clientX <= bar.right && ev.clientY >= bar.top && ev.clientY <= bar.bottom) {
        onLayout({ ...layout, free: false });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Hướng dọc chỉ có nghĩa khi panel nổi: panel neo trải hết chiều ngang bar nên
  // xếp dọc chỉ làm bar cao vống lên, mỗi chip một dòng. Cờ vẫn được lưu để kéo
  // ra là dọc ngay.
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
