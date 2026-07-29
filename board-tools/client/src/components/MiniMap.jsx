import { memo, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { colorVar } from "../lib/badges.js";
import { boundsOf, fitTransform, toMini, toCanvas, unionRect, viewRect } from "../lib/minimap.js";

// Khung minimap cố định, không co theo nội dung: một cái hộp đổi kích thước
// theo bảng là một cái hộp nhảy nhót mỗi lần thêm thẻ.
export const MINI_W = 176, MINI_H = 120;

function MiniMap({ shapes, view, viewportSize, onGoTo, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);

  const content = boundsOf([shapes.groups, shapes.nodes, shapes.inks]);
  const seen = viewRect(view, viewportSize);
  // Gộp vùng nội dung với vùng đang nhìn: lia ra một chỗ trống xa tít thì khung
  // nhìn vẫn phải nằm trong minimap — mất nó là mất luôn thứ duy nhất cho biết
  // "mình đang ở đâu so với đống thẻ kia".
  const area = unionRect(content, seen);
  if (!area) return null;
  const t2 = fitTransform(area, { w: MINI_W, h: MINI_H });

  const box = (r) => {
    const p = toMini(r.x, r.y, t2);
    return { x: p.x, y: p.y, width: Math.max(r.w * t2.scale, 1.5), height: Math.max(r.h * t2.scale, 1.5) };
  };

  // Bấm chỗ nào là đi tới chỗ đó; giữ chuột kéo thì khung nhìn bám theo. Không
  // phân biệt "bấm trong khung nhìn" và "bấm ngoài": cả hai đều là một ý duy
  // nhất — cho tôi nhìn chỗ này.
  function goTo(ev) {
    const rect = ref.current.getBoundingClientRect();
    onGoTo(toCanvas(ev.clientX - rect.left, ev.clientY - rect.top, t2));
  }

  function onDown(ev) {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    goTo(ev);
    function onMove(e) { goTo(e); }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="minimap" onMouseDown={(e) => e.stopPropagation()}>
      <button className="mini-close" onClick={onClose} title={t`Ẩn bản đồ thu nhỏ`}>×</button>
      <svg ref={ref} width={MINI_W} height={MINI_H} onMouseDown={onDown}>
        {shapes.groups.map((g) => (
          <rect key={"g" + g.id} className="mini-frame" {...box(g)}
            style={g.color ? { stroke: colorVar(g.color) } : undefined} />
        ))}
        {/* Nét vẽ chỉ là vệt mờ: chúng là chú thích quanh nội dung, không phải
            cái mốc người ta dùng để định vị. */}
        {shapes.inks.map((d) => <rect key={"d" + d.id} className="mini-ink" {...box(d)} />)}
        {shapes.nodes.map((n) => (
          <rect key={"n" + n.id} className="mini-node" rx="1" {...box(n)}
            style={n.color ? { fill: colorVar(n.color) } : undefined} />
        ))}
        <rect className="mini-view" {...box(seen)} />
      </svg>
    </div>
  );
}

export default memo(MiniMap);
