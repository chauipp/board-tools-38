import { useRef, useState } from "react";
import { drawingsHitBy } from "./shape.js";
import { textLines, textBox } from "./text-el.js";
import { applyGeomOverlay } from "./useLiveSync.js";
import { startDrag } from "./drag-session.js";
import { useInk } from "./useInk.js";
import { TEXT_DRAG_THRESHOLD } from "./board-constants.js";
import { useLingui } from "@lingui/react/macro";

// Tool chữ: bấm chỗ trống mở ô nhập, bấm lên chữ có sẵn thì sửa hoặc kéo
// (dưới/qua ngưỡng), đo bề rộng chữ theo font đang hiển thị, phát gói live khi
// gõ, và chốt chữ đúng một lần. Trước nằm trong IdeaMap.jsx. commitStroke,
// eventToCanvas, movingPayload gắn qua bind() mỗi lượt render.
export function useTextTool({
  store, board, boardRef, inkLive, penPrefs, skin, tool, measureCtxRef
}) {
  const depsRef = useRef({});
  const { t } = useLingui();
  const commitStroke = (...a) => depsRef.current.commitStroke(...a);
  const eventToCanvas = (...a) => depsRef.current.eventToCanvas(...a);
  const movingPayload = (...a) => depsRef.current.movingPayload(...a);

  // Ô nhập text đang mở: { id: number|null, x, y, value, size, color }. id null
  // = đang tạo mới. Chỉ có MỘT ô mở tại một thời điểm.
  const [textEdit, setTextEdit] = useState(null);
  // Text đang được kéo: { id, x, y }. Chỉ là bản NHÁP để vẽ lại theo con trỏ;
  // board chỉ được ghi một lần lúc nhả chuột.
  const [textDrag, setTextDrag] = useState(null);
  // Bản sao của textEdit trong một ref, để commitText CHỐT ĐƯỢC MỘT LẦN. Nó là
  // handler của onBlur đồng thời được gọi tường minh khi bấm sang chỗ khác; hai
  // đường cùng đọc `textEdit` từ closure của một lượt vẽ nên gọi hai lần sẽ lưu
  // ra hai phần tử giống hệt nhau. Ref bị xoá ngay trong lời gọi đầu, lời gọi
  // thứ hai thành lệnh rỗng.
  const textEditRef = useRef(null);
  // Text đang kéo vẽ ở vị trí NHÁP, board vẫn giữ vị trí cũ cho tới lúc nhả
  // chuột. Cùng cách applyGeomOverlay phủ vị trí thẻ của người khác lên board.
  // Đồng bộ ref với state ở mỗi lượt vẽ. Đặt trong thân component (không phải
  // effect) để nó đúng NGAY trong lượt đó: handler mousedown có thể chạy trước
  // khi effect kịp chạy.
  textEditRef.current = textEdit;

  // Đo bề rộng một dòng chữ bằng đúng font đang hiển thị. Phải đọc --canvas-font
  // qua getComputedStyle chứ không viết cứng: bật skin vẽ tay là font đổi, và
  // hộp đo bằng font cũ sẽ lệch hẳn. Cùng cách png-export.js dựng ngữ cảnh 2d.
  function measureTextWidth(line, size) {
    if (measureCtxRef.current === undefined) {
      // getContext trả null ở môi trường không có canvas thật (jsdom của smoke
      // test). Dò một lần rồi nhớ kết quả: dò lại mỗi lần đo thì một text ba
      // dòng in ra ba dòng cảnh báo.
      measureCtxRef.current = document.createElement("canvas").getContext("2d") || null;
    }
    const ctx = measureCtxRef.current;
    // Không có ngữ cảnh 2d thì ước lượng thô. Hộp chỉ dùng cho vùng chạm của
    // cục gôm và vùng bấm để kéo, nên sai vài phần trăm còn hơn ném lỗi và làm
    // trắng cả trang chỉ vì không đo được một dòng chữ.
    if (!ctx) return line.length * size * 0.55;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--canvas-font").trim();
    ctx.font = `${size}px ${family || "sans-serif"}`;
    return ctx.measureText(line).width;
  }

  // Bấm khi đang cầm tool Text. Trúng một text đã có thì mở nó ra sửa, trúng
  // chỗ trống thì tạo mới tại đúng chỗ bấm.
  function handleTextMouseDown(e) {
    // BẮT BUỘC. Hành vi mặc định của mousedown là dời tiêu điểm: .ink-capture là
    // một div không nhận được tiêu điểm nên trình duyệt đẩy nó về <body>. Mà
    // React 18 xả sự kiện rời rạc NGAY trong lúc dispatch, nên ô nhập đã kịp gắn
    // vào cây và tự lấy tiêu điểm (autoFocus) TRƯỚC khi hành vi mặc định chạy —
    // rồi bị cướp tiêu điểm ngay sau đó, blur bắn ra, commitText thấy chuỗi rỗng
    // và gỡ ô nhập đi. Triệu chứng đúng như đã thấy: bấm mà "không ra cái gì để
    // viết". Không có dòng này thì mọi cách focus lại đều chỉ là vá ngọn.
    e.preventDefault();

    // Đang gõ dở mà bấm sang chỗ khác: chốt cái cũ lại rồi mở ngay ô mới ở chỗ
    // vừa bấm — ô nhập "nhảy" theo con trỏ, không bắt bấm hai lần.
    //
    // Việc này chỉ an toàn nhờ preventDefault ở trên. Không có nó, tiêu điểm bị
    // đẩy về <body> và `blur` bắn ra xen vào giữa hai việc dưới đây, thứ tự
    // khác nhau giữa các trình duyệt — và cái sai sẽ là mất chữ vừa gõ. Có nó
    // rồi thì tiêu điểm không rời textarea, React dùng lại đúng nút DOM đó
    // (cùng kiểu, cùng vị trí trong cây) nên `blur` không bao giờ xảy ra: chỉ
    // còn MỘT đường chốt, là lời gọi tường minh ngay đây.
    if (textEdit) commitText();

    // Đọc board SAU khi chốt: commitText vừa cập nhật boardRef.current, nên
    // phép dò bên dưới nhìn thấy cả đoạn text vừa gõ xong. Bấm đè lên chính nó
    // là mở lại nó ra sửa, đúng như bấm lên một text cũ bất kỳ.
    const current = boardRef.current;
    if (!current) return;
    const p = eventToCanvas(e);
    const hit = drawingsHitBy(current.drawings || [], p, 0)
      .map((id) => current.drawings.find((d) => d.id === id))
      .find((d) => d && d.kind === "text");
    if (hit) { startTextDrag(hit, p); return; }
    const fresh = { id: null, x: Math.round(p.x), y: Math.round(p.y), value: "", size: penPrefs.size, color: penPrefs.color };
    setTextEdit(fresh);
    beginLiveText(fresh);
  }

  // Bấm trúng một text: MỘT cú bấm phục vụ hai việc. Di dưới ngưỡng thì coi như
  // chỉ bấm → mở ra sửa; di quá ngưỡng thì là kéo → dời chỗ. Không cần bấm đúp,
  // và không có cách nào bấm nhầm sang việc kia.
  function startTextDrag(el, start) {
    const offX = start.x - el.pts[0];
    const offY = start.y - el.pts[1];
    let moved = false;
    let last = { x: el.pts[0], y: el.pts[1] };
    inkLive.beginMove();

    function onMove(ev) {
      const p = eventToCanvas(ev);
      if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < TEXT_DRAG_THRESHOLD) return;
      moved = true;
      last = { x: Math.round(p.x - offX), y: Math.round(p.y - offY) };
      // Chỉ đẩy vào state NHÁP, không ghi vào board: một lần kéo phải là một
      // lần lưu, không phải một lần cho mỗi nhịp chuột.
      setTextDrag({ id: el.id, x: last.x, y: last.y });
      // Vì board KHÔNG đổi trong lúc kéo, gói live phải dựng từ vị trí nháp chứ
      // không dựng qua movingPayload — hàm đó đọc board.
      inkLive.pushMove([{ id: el.id, pts: [last.x, last.y] }]);
    }

    function cleanup() {
      setTextDrag(null);
    }

    // Cửa sổ mất focus giữa lượt kéo: mouseup sẽ không bao giờ tới. Cùng cái bẫy
    // useInk.js đã có ghi chú dài — không dọn thì text treo ở vị trí nháp và cú
    // mouseup sau đó (ở một ngữ cảnh khác) vẫn commit.
    function cancel() { cleanup(); inkLive.cancelMove(); }

    function finish() {
      cleanup();
      if (!moved) {
        inkLive.cancelMove();
        const reopen = { id: el.id, x: el.pts[0], y: el.pts[1], value: el.text, size: el.size, color: el.color };
        setTextEdit(reopen);
        beginLiveText(reopen);
        return;
      }
      const current = boardRef.current;
      if (!current) { inkLive.cancelMove(); return; }
      inkLive.endMove([{ id: el.id, pts: [last.x, last.y] }]);
      const next = {
        ...current,
        drawings: current.drawings.map((d) => (d.id === el.id ? { ...d, pts: [last.x, last.y] } : d))
      };
      store.commit(next, { from: current });
    }

    // Không có sự kiện chuột ở đây (start là toạ độ canvas đã tính sẵn), và
    // ngưỡng kéo tính theo đơn vị canvas trong onMove — nên không truyền event.
    startDrag(null, { onMove, onEnd: finish, onCancel: cancel, throttle: false, blur: "cancel" });
  }

  // Cùng kỷ luật refs-only như commitStroke (xem ghi chú dài ở đó): gõ một đoạn
  // chú thích mất vài chục giây, board:update của người khác về giữa chừng mà
  // mình dựng `next` từ `board` đóng gói lúc mở ô nhập thì cú PUT sau đó đè mất
  // thay đổi của họ.
  // Mở kênh live cho một lượt gõ. Tách ra vì có HAI chỗ mở ô nhập — bấm chỗ
  // trống để tạo mới, và bấm lên một đoạn có sẵn để sửa — mà cả hai phải phát
  // gói đầu giống hệt nhau, không thì một trong hai đường lặng lẽ không realtime.
  function beginLiveText(edit) {
    inkLive.beginText(
      [Math.round(edit.x), Math.round(edit.y)],
      edit.value, edit.color, edit.size, edit.id
    );
  }

  function commitText() {
    const edit = textEditRef.current;
    textEditRef.current = null;
    setTextEdit(null);
    if (!edit) return;
    const current = boardRef.current;
    if (!current) { inkLive.cancelText(); return; }
    const value = edit.value.trim();

    // Rỗng: tạo mới thì không đẻ ra phần tử vô hình; sửa thì coi như xoá.
    if (!value) {
      // Cả hai nhánh dưới đây đều KHÔNG để lại đoạn text nào, nên overlay phải
      // bị huỷ chứ không phải chốt: gói done không có drawingId sẽ treo trên
      // màn hình người khác tới hết INK_SETTLE_TTL_MS.
      inkLive.cancelText();
      if (edit.id == null) return;
      const next = { ...current, drawings: current.drawings.filter((d) => d.id !== edit.id) };
      store.commit(next, { from: current });
      return;
    }

    // Mở một text ra xem rồi đóng lại mà không sửa gì: không ghi gì cả. Thiếu
    // chốt này thì mỗi lần bấm nhầm vào một dòng chú thích là một lần lưu lên
    // server VÀ một bước hoàn tác rỗng — Ctrl+Z mấy lần liền không thấy gì đổi.
    if (edit.id != null) {
      const before = current.drawings.find((d) => d.id === edit.id);
      if (before && before.text === value && before.size === edit.size
          && before.color === edit.color
          && before.pts[0] === Math.round(edit.x) && before.pts[1] === Math.round(edit.y)) {
        // Không lưu gì ⇒ sẽ KHÔNG có board:update nào để reconcileInkOverlay
        // dọn overlay theo, nên phải huỷ tay.
        inkLive.cancelText();
        return;
      }
    }

    const lines = textLines(value);
    const box = textBox(lines, edit.size, measureTextWidth);
    const el = {
      kind: "text", pts: [Math.round(edit.x), Math.round(edit.y)],
      text: value, color: edit.color, size: edit.size, w: box.w, h: box.h
    };
    let next;
    let savedId;
    if (edit.id == null) {
      const id = current.nextDrawingId;
      savedId = id;
      next = { ...current, drawings: [...current.drawings, { id, ...el }], nextDrawingId: id + 1 };
    } else {
      savedId = edit.id;
      next = { ...current, drawings: current.drawings.map((d) => (d.id === edit.id ? { ...d, ...el } : d)) };
    }
    // Chốt kèm id vừa lưu: người nhận giữ overlay cho tới đúng lúc board:update
    // mang id đó về, không sớm hơn (chữ biến mất rồi hiện lại) cũng không muộn
    // hơn (hai lớp chữ chồng nhau).
    inkLive.endText(savedId);
    store.commit(next, { from: current });
  }

  return {
    textEdit, setTextEdit, textDrag, measureTextWidth, handleTextMouseDown, startTextDrag, beginLiveText, commitText,
    bind: (d) => { depsRef.current = d; }
  };
}
