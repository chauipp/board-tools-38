import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { penVar } from "../lib/pen.js";

// Một đường vẽ duy nhất cho cả ba nguồn: nét đã lưu trong board, nét mình đang
// kéo, và nét người khác đang vẽ. Không có code path thứ hai để lệch nhau.
function Stroke({ color, w, pts, erasing }) {
  const d = strokePath(pts);
  if (!d) return null;
  // Không dùng vector-effect: non-scaling-stroke — muốn zoom vào là nét dày ra
  // như mực trên giấy.
  return <path className={erasing ? "erasing" : undefined} d={d} stroke={penVar(color)} strokeWidth={w} />;
}

function InkLayer({ drawings, draft, eraseIds, liveStrokes }) {
  // Nét bị đánh dấu xoá: của mình đang quét, hoặc của người khác đang quét.
  const dimmed = new Set(eraseIds);
  for (const e of liveStrokes.values()) {
    if (e.erase) for (const id of e.erase) dimmed.add(id);
  }

  return (
    <svg className="ink-layer">
      {drawings.map((d) => (
        <Stroke key={d.id} color={d.color} w={d.w} pts={d.pts} erasing={dimmed.has(d.id)} />
      ))}
      {Array.from(liveStrokes.entries()).map(([key, e]) => (
        e.pts ? <Stroke key={"live-" + key} color={e.color} w={e.w} pts={e.pts} /> : null
      ))}
      {draft && <Stroke color={draft.color} w={draft.w} pts={draft.pts} />}
    </svg>
  );
}

export default memo(InkLayer);
