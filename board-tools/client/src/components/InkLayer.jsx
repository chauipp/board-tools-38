import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { shapePath } from "../lib/shape.js";
import { penVar } from "../lib/pen.js";
import { seedFrom, sketchyPath } from "../lib/sketchy.js";

// Một đường vẽ duy nhất cho cả ba nguồn: nét đã lưu trong board, nét mình đang
// kéo, và nét người khác đang vẽ. Không có code path thứ hai để lệch nhau.
function Stroke({ id, kind, color, w, pts, fill, erasing, sketch }) {
  // Nét BÚT không đụng tới ở skin vẽ tay: nó vốn đã là nét tay thật, rung thêm
  // một lớp nữa chỉ làm nó nhoè.
  const d = !kind || kind === "pen"
    ? strokePath(pts)
    : (sketch ? sketchyPath(kind, pts, seedFrom(id)) : shapePath(kind, pts));
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

function InkLayer({ drawings, draft, eraseIds, liveStrokes, sketch }) {
  // Nét bị đánh dấu xoá: của mình đang quét, hoặc của người khác đang quét.
  const dimmed = new Set(eraseIds);
  for (const e of liveStrokes.values()) {
    if (e.erase) for (const id of e.erase) dimmed.add(id);
  }

  return (
    <svg className="ink-layer">
      {drawings.map((d) => (
        <Stroke key={d.id} id={d.id} kind={d.kind} color={d.color} w={d.w} pts={d.pts} fill={d.fill} erasing={dimmed.has(d.id)} sketch={sketch} />
      ))}
      {/* Nét người khác đang vẽ và nét mình đang kéo chưa có id — dùng chung một
          seed cố định. Chúng chỉ sống vài giây rồi được thay bằng nét đã lưu (có
          id thật), nên không đáng để bịa ra một định danh tạm. */}
      {Array.from(liveStrokes.entries()).map(([key, e]) => (
        e.pts ? <Stroke key={"live-" + key} id={0} kind={e.kind} color={e.color} w={e.w} pts={e.pts} fill={e.fill} sketch={sketch} /> : null
      ))}
      {draft && <Stroke id={0} kind={draft.kind} color={draft.color} w={draft.w} pts={draft.pts} fill={draft.fill} sketch={sketch} />}
    </svg>
  );
}

export default memo(InkLayer);
