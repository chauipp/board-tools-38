import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { shapePath, drawingBox } from "../lib/shape.js";
import { penVar, dashArray } from "../lib/pen.js";
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
// Viền chọn nới ra một chút cho khỏi cắt sát vào nét, và một Set rỗng dùng
// chung để prop `selectedIds` vắng mặt không sinh Set mới ở mỗi lần render (memo
// trên InkLayer sẽ vô nghĩa).
const SEL_PAD = 4;
const EMPTY_SET = new Set();

// memo: cả lớp này render lại ở MỌI khung hình trong lúc có người vẽ (`draft`
// đổi mỗi nhịp chuột của mình, `liveStrokes` đổi mỗi gói của người khác). Không
// có memo thì mỗi lượt đó dựng lại chuỗi `d` cho TOÀN BỘ nét đã lưu — đo được
// 28.8µs cho một nét bút 120 điểm, tức 500 nét đã lưu ngốn 14.4ms/khung hình,
// gần trọn ngân sách 16.7ms, và đó là trước cả React diff lẫn repaint.
// `pts` giữ nguyên tham chiếu qua các lần render (inkDrawings trả thẳng
// board.drawings khi không kéo text), nên phép so sánh nông của memo ăn thật:
// chỉ nét đang vẽ mới phải dựng lại.
const TextEl = memo(function TextEl({ text, color, size, pts, erasing }) {
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
});

// Một đường vẽ duy nhất cho cả ba nguồn: nét đã lưu trong board, nét mình đang
// kéo, và nét người khác đang vẽ. Không có code path thứ hai để lệch nhau.
// memo vì cùng lý do với TextEl ở trên — xem ghi chú ở đó.
const Stroke = memo(function Stroke({ id, kind, color, w, pts, fill, dashed, erasing, sketch }) {
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
  // `strokeDasharray` chỉ tác động lên VIỀN, không lên ruột: một hình vừa tô đặc
  // vừa để nét đứt vẫn kín ruột và viền đứt quãng — đúng thứ người ta muốn khi
  // chọn cả hai.
  return (
    <path
      className={erasing ? "erasing" : undefined}
      d={d}
      stroke={penVar(color)}
      strokeWidth={w}
      strokeDasharray={dashed ? dashArray(w) : undefined}
      fill={fill ? penVar(color) : "none"}
    />
  );
});

function InkLayer({ drawings, draft, eraseIds, cut, liveStrokes, sketch, editingTextId, selectedIds }) {
  // Nét bị đánh dấu xoá: của mình đang quét, hoặc của người khác đang quét.
  const dimmed = new Set(eraseIds);
  // Đoạn text mà NGƯỜI KHÁC đang mở ra sửa. Phải giấu bản đã lưu đi trong lúc
  // đó, đúng vai trò `editingTextId` làm cho bản thân mình: để cả hai cùng hiện
  // thì thấy chữ cũ và chữ đang gõ chồng lệch lên nhau, mà chữ cũ lại nằm dưới
  // nên mỗi ký tự xoá đi lại lòi ra một mẩu chữ cũ.
  const liveEdit = new Set();
  for (const e of liveStrokes.values()) {
    if (e.erase) for (const id of e.erase) dimmed.add(id);
    if (e.editId != null) liveEdit.add(e.editId);
  }
  const picked = selectedIds || EMPTY_SET;
  // Nét đang bị cục tẩy THEO ĐỘ RỘNG cắt dở. Khác `dimmed` ở chỗ chúng biến mất
  // hẳn khỏi lớp này chứ không chỉ mờ đi: bản đang được vẽ thay vào là mấy mảnh
  // trong `cut.parts`, để cùng lúc cả nét cũ lẫn mảnh mới thì rãnh vừa cắt bị
  // chính cái nét cũ lấp lại và người dùng không thấy mình đang tẩy tới đâu.
  const cutIds = cut ? cut.ids : EMPTY_SET;

  return (
    <svg className="ink-layer">
      {drawings.map((d) => {
        // Phần tử đang được sửa phải BIẾN MẤT khỏi lớp này: ô nhập nằm chồng
        // lên đúng chỗ đó, để cả hai cùng hiện thì thấy hai lớp chữ lệch nhau.
        if (d.id === editingTextId || cutIds.has(d.id) || liveEdit.has(d.id)) return null;
        if (d.kind === "text") {
          return <TextEl key={d.id} text={d.text} color={d.color} size={d.size} pts={d.pts} erasing={dimmed.has(d.id)} />;
        }
        return <Stroke key={d.id} id={d.id} kind={d.kind} color={d.color} w={d.w} pts={d.pts} fill={d.fill} dashed={d.dashed} erasing={dimmed.has(d.id)} sketch={sketch} />;
      })}
      {/* Nét người khác đang vẽ và nét mình đang kéo chưa có id — dùng chung một
          seed cố định. Chúng chỉ sống vài giây rồi được thay bằng nét đã lưu (có
          id thật), nên không đáng để bịa ra một định danh tạm. */}
      {Array.from(liveStrokes.entries()).map(([key, e]) => {
        if (!e.pts) return null;
        // Chữ người khác đang gõ đi qua ĐÚNG component mà chữ đã lưu dùng, nên
        // font, cách xuống dòng và cách neo theo đường chân không thể lệch nhau
        // giữa lúc đang gõ và lúc đã lưu.
        if (e.kind === "text") {
          return <TextEl key={"live-" + key} text={e.text} color={e.color} size={e.size} pts={e.pts} />;
        }
        return <Stroke key={"live-" + key} id={0} kind={e.kind} color={e.color} w={e.w} pts={e.pts} fill={e.fill} dashed={e.dashed} sketch={sketch} />;
      })}
      {draft && <Stroke id={0} kind={draft.kind} color={draft.color} w={draft.w} pts={draft.pts} fill={draft.fill} dashed={draft.dashed} sketch={sketch} />}
      {/* Mảnh còn sống của những nét đang bị cắt dở. Chưa có id thật (chúng chỉ
          thành nét riêng lúc nhả chuột), nên `key` là "id nét gốc : thứ tự
          mảnh" — đủ ổn định để React không dựng lại cả chùm ở mỗi nhịp cắt. */}
      {cut && cut.parts.map((p) => (
        <Stroke key={"cut-" + p.key} id={0} color={p.color} w={p.w} pts={p.pts} dashed={p.dashed} sketch={sketch} />
      ))}
      {/* Viền chọn vẽ SAU cùng nên luôn nằm trên nét; và là hộp bao chứ không
          phải tô sáng chính nét vẽ: một nét mảnh màu vàng được tô sáng thì gần
          như không thấy khác gì, còn cái hộp thì nói rõ "cụm này đang được
          chọn, kéo được". */}
      {drawings.map((d) => {
        // Nét đang bị cắt dở thì bỏ luôn viền chọn của nó: nét đã biến khỏi lớp
        // này rồi, để cái hộp lại là một khung rỗng quây quanh chỗ trống.
        if (!picked.has(d.id) || cutIds.has(d.id)) return null;
        const box = drawingBox(d);
        if (!box) return null;
        return (
          <rect
            key={"sel-" + d.id}
            className="ink-selected"
            x={box.x - SEL_PAD} y={box.y - SEL_PAD}
            width={box.w + SEL_PAD * 2} height={box.h + SEL_PAD * 2}
          />
        );
      })}
    </svg>
  );
}

export default memo(InkLayer);
