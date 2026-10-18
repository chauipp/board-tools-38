import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { shapePath } from "../lib/shape.js";
import { penVar } from "../lib/pen.js";
import { seedFrom, sketchyPath } from "../lib/sketchy.js";
import { TEXT_LINE_H } from "../lib/text-el.js";

// Text vẽ bằng <text> ngay trong lớp SVG này, cùng chỗ với nét bút và hình
// khối — nhờ vậy thứ tự trên/dưới giữa chữ và hình là nhất quán, và cục gôm
// quét một lượt là ăn cả ba loại.
//
// Font lấy từ CSS (.ink-layer text { font-family: var(--canvas-font) }), nên
// bật skin vẽ tay là chữ trên bảng thành chữ viết tay mà không cần một dòng JS
// nào. Cố ý KHÔNG dùng sketchy.js: nét rung làm mềm hình khối, còn bẻ cong chữ
// thì chỉ làm nó khó đọc.
function TextEl({ text, color, size, pts, erasing }) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const [x, y] = pts;
  return (
    <text
      className={erasing ? "erasing" : undefined}
      x={x}
      // SVG neo chữ theo ĐƯỜNG CHÂN, còn pts là góc TRÊN trái (để khớp với hộp
      // w/h dùng cho hit-test và với ô nhập HTML). Đẩy dòng đầu xuống một lượt
      // chiều cao dòng là hai hệ khớp nhau.
      y={y + size * TEXT_LINE_H * 0.78}
      fill={penVar(color)}
      fontSize={size}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * TEXT_LINE_H}>{line}</tspan>
      ))}
    </text>
  );
}

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

function InkLayer({ drawings, draft, eraseIds, liveStrokes, sketch, editingTextId }) {
  // Nét bị đánh dấu xoá: của mình đang quét, hoặc của người khác đang quét.
  const dimmed = new Set(eraseIds);
  for (const e of liveStrokes.values()) {
    if (e.erase) for (const id of e.erase) dimmed.add(id);
  }

  return (
    <svg className="ink-layer">
      {drawings.map((d) => {
        // Phần tử đang được sửa phải BIẾN MẤT khỏi lớp này: ô nhập nằm chồng
        // lên đúng chỗ đó, để cả hai cùng hiện thì thấy hai lớp chữ lệch nhau.
        if (d.id === editingTextId) return null;
        if (d.kind === "text") {
          return <TextEl key={d.id} text={d.text} color={d.color} size={d.size} pts={d.pts} erasing={dimmed.has(d.id)} />;
        }
        return <Stroke key={d.id} id={d.id} kind={d.kind} color={d.color} w={d.w} pts={d.pts} fill={d.fill} erasing={dimmed.has(d.id)} sketch={sketch} />;
      })}
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
