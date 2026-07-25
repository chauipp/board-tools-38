import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { snapToEdges } from "../lib/dock.js";

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
      const p = snapToEdges(
        ev.clientX - grabX, ev.clientY - grabY,
        el.offsetWidth, el.offsetHeight,
        window.innerWidth, window.innerHeight
      );
      onLayout({ ...layout, free: true, x: p.x, y: p.y });
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // Không kéo = click → xoay ngang/dọc.
      if (!dragging) return onLayout({ ...layout, vertical: !layout.vertical });
      // Thả lại trong filterbar thì neo về chỗ cũ. Chính filterbar là vùng thả,
      // nên không cần vẽ thêm drop zone nào.
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
  );
}
