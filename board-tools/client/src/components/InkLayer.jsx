import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { shapePath } from "../lib/shape.js";
import { penVar } from "../lib/pen.js";

// Một đường vẽ duy nhất cho cả ba nguồn: nét đã lưu trong board, nét mình đang
// kéo, và nét người khác đang vẽ. Không có code path thứ hai để lệch nhau.
function Stroke({ kind, color, w, pts, fill, erasing }) {
  const d = !kind || kind === "pen" ? strokePath(pts) : shapePath(kind, pts);
  if (!d) return null;
  // Không dùng vector-effect: non-scaling-stroke — muốn zoom vào là nét dày ra
  // như mực trên giấy.
  //
  // `fill` phải là attribute trên chính thẻ này và CSS của .ink-layer path
  // KHÔNG được khai `fill`: trong SVG, CSS thắng presentation attribute, nên một
  // dòng `fill: none` trong stylesheet sẽ làm mọi hình tô đặc biến thành viền.
  return (
    <path
      className={erasing ? "erasing" : undefined}
      d={d}
      stroke={penVar(color)}
      strokeWidth={w}
      fill={fill ? penVar(color) : "none"}
    />
  );
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
        <Stroke key={d.id} kind={d.kind} color={d.color} w={d.w} pts={d.pts} fill={d.fill} erasing={dimmed.has(d.id)} />
      ))}
      {Array.from(liveStrokes.entries()).map(([key, e]) => (
        e.pts ? <Stroke key={"live-" + key} kind={e.kind} color={e.color} w={e.w} pts={e.pts} fill={e.fill} /> : null
      ))}
      {draft && <Stroke kind={draft.kind} color={draft.color} w={draft.w} pts={draft.pts} fill={draft.fill} />}
    </svg>
  );
}

export default memo(InkLayer);
