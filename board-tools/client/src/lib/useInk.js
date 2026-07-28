import { useCallback, useEffect, useRef, useState } from "react";
import { simplifyStroke } from "./stroke.js";
import { drawingsHitBy, normalizeBox, SHAPE_CLOSED, SHAPE_MIN_DIAGONAL } from "./shape.js";
import { rafThrottle } from "./raf-throttle.js";

// Bán kính gôm, đơn vị toạ độ canvas. Cộng thêm w/2 của từng nét trong
// drawingsHitBy, nên nét dày dễ chạm hơn nét mảnh — đúng cảm giác mong đợi.
const ERASE_RADIUS = 8;

// Chuột → toạ độ canvas. Camera nằm trong board.view, đọc qua ref để handler
// gắn vào window không bị bám vào một bản chụp cũ.
function toCanvas(e, viewportEl, view) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - view.panX) / view.scale,
    y: (e.clientY - rect.top - view.panY) / view.scale
  };
}

export function useInk({ tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, live }) {
  const [draft, setDraft] = useState(null);
  const [eraseIds, setEraseIds] = useState([]);

  // `live` qua ref: effect nghe `blur` chỉ cần gắn MỘT lần, không phải gỡ/gắn
  // lại mỗi khi object live được dựng lại.
  const liveRef = useRef(live);
  liveRef.current = live;

  // Điểm thô nằm trong ref, KHÔNG trong state: setState cho mỗi mousemove là
  // dựng lại cây React 100+ lần/giây rồi vứt đi phần lớn.
  const ptsRef = useRef([]);
  // Điểm chưa gửi lên kênh live — gói mang ĐIỂM MỚI THÊM, không phải cả nét.
  const unsentRef = useRef([]);
  const eraseSetRef = useRef(new Set());
  const activeRef = useRef(null);   // "pen" | "eraser" | "shape" | null
  const startRef = useRef(null);   // điểm bắt đầu của hình khối đang kéo
  // Hộp mới nhất phải nằm trong REF, không đọc lại từ state `draft`: pushDraft
  // là rafThrottle nên hộp cuối cùng có thể chưa kịp vào state lúc mouseup, và
  // finish() gắn listener vào window ngay từ mousedown nên closure của nó giữ
  // `draft` của lượt render tại thời điểm đó (luôn là null). Cùng lý do liveRef
  // bên dưới phải tồn tại.
  const boxRef = useRef(null);

  // Hàm dọn của lượt ĐANG chạy: gỡ hai listener window và xoá activeRef. Phải
  // nằm trong ref vì onMove/finish là closure dựng lại mỗi lần mousedown, còn
  // effect nghe `blur` gắn một lần với deps [] nên không có cách nào thấy được
  // closure đó. Nhờ ref này chỉ có MỘT đường dọn: cả `finish` (mouseup bình
  // thường) và `onBlur` (mất focus giữa nét) đều đi qua nó, không còn chuyện
  // blur xoá state mà để listener sống rồi lượt đã chết vẫn commit được.
  const cleanupRef = useRef(null);

  const pushDraft = useRef(null);
  if (!pushDraft.current) {
    pushDraft.current = rafThrottle((color, w, pts, kind, fill) => setDraft({ color, w, pts, kind, fill }));
  }
  const pushErase = useRef(null);
  if (!pushErase.current) {
    pushErase.current = rafThrottle((ids) => setEraseIds(ids));
  }

  useEffect(() => () => {
    pushDraft.current?.cancel();
    pushErase.current?.cancel();
  }, []);

  const handleMouseDown = useCallback((e) => {
    const viewportEl = viewportRef.current;
    const board = boardRef.current;
    if (!viewportEl || !board) return;

    const start = toCanvas(e, viewportEl, board.view);

    if (tool === "eraser") {
      activeRef.current = "eraser";
      eraseSetRef.current = new Set(drawingsHitBy(board.drawings || [], start, ERASE_RADIUS));
      pushErase.current(Array.from(eraseSetRef.current));
      // Gọi cả khi rỗng: beginErase phải tăng strokeId để lượt quét này có khoá
      // overlay riêng, không nối tiếp vào lượt trước.
      live?.beginErase(Array.from(eraseSetRef.current));
    } else if (tool === "shape") {
      activeRef.current = "shape";
      startRef.current = start;
      const kind = penPrefs.kind;
      // Hình mở không có vùng trong: `fill` phải bị dập ở ĐÂY, không trông vào
      // nút ở khu 4 đã bị disable — prefs cũ trong localStorage vẫn có thể mang
      // fill: true cùng với kind: "line".
      const fill = SHAPE_CLOSED.has(kind) && penPrefs.fill === true;
      const box = normalizeBox(start.x, start.y, start.x, start.y);
      boxRef.current = box;
      pushDraft.current(penPrefs.color, penPrefs.w, box, kind, fill);
      live?.beginShape(kind, penPrefs.color, penPrefs.w, fill, box);
    } else {
      activeRef.current = "pen";
      ptsRef.current = [start.x, start.y];
      unsentRef.current = [];
      pushDraft.current(penPrefs.color, penPrefs.w, ptsRef.current.slice());
      live?.beginStroke(penPrefs.color, penPrefs.w, [Math.round(start.x), Math.round(start.y)]);
    }

    function onMove(ev) {
      const b = boardRef.current;
      if (!b) return;
      const p = toCanvas(ev, viewportEl, b.view);

      if (activeRef.current === "eraser") {
        const hit = drawingsHitBy(b.drawings || [], p, ERASE_RADIUS);
        let added = null;
        for (const id of hit) {
          if (eraseSetRef.current.has(id)) continue;
          eraseSetRef.current.add(id);
          (added || (added = [])).push(id);
        }
        if (added) {
          pushErase.current(Array.from(eraseSetRef.current));
          live?.pushErase(added);
        }
        return;
      }

      if (activeRef.current === "shape") {
        const s = startRef.current;
        const kind = penPrefs.kind;
        const closed = SHAPE_CLOSED.has(kind);
        // Shift: hình đóng thì ép vuông/tròn đều, hình mở thì ép hướng 0/45/90.
        const box = normalizeBox(s.x, s.y, p.x, p.y, closed ? { square: ev.shiftKey } : { snap: ev.shiftKey });
        boxRef.current = box;
        pushDraft.current(penPrefs.color, penPrefs.w, box, kind, closed && penPrefs.fill === true);
        live?.pushShape(box);
        return;
      }

      ptsRef.current.push(p.x, p.y);
      unsentRef.current.push(Math.round(p.x), Math.round(p.y));
      pushDraft.current(penPrefs.color, penPrefs.w, ptsRef.current.slice());
      // Gói mang đúng những điểm chưa gửi; trailingThrottle bên useInkLive gộp
      // các lần gọi trong cùng 40ms nên phải xả `unsent` ở ĐÓ, không phải ở đây.
      live?.pushPoints(unsentRef.current);
    }

    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", finish);
      activeRef.current = null;
      cleanupRef.current = null;
    }

    function finish() {
      const was = activeRef.current;
      cleanup();
      // Không có lượt nào đang chạy thì không có gì để commit. Chốt phòng thủ
      // cho trường hợp `finish` vẫn bị gọi sau khi lượt đã bị huỷ bằng đường
      // khác (mouseup tới sau blur chẳng hạn): thiếu chốt này thì `was === null`
      // rơi xuống nhánh bút ở cuối hàm và lưu ra một nét chưa từng được vẽ.
      if (!was) return;

      if (was === "eraser") {
        const ids = Array.from(eraseSetRef.current);
        eraseSetRef.current = new Set();
        pushErase.current.cancel();
        setEraseIds([]);
        // Quét mà không chạm nét nào: không commit, không tạo entry hoàn tác rác.
        if (ids.length) onEraseDone(ids);
        live?.endErase();
        return;
      }

      if (was === "shape") {
        pushDraft.current.cancel();
        setDraft(null);
        const box = boxRef.current;
        boxRef.current = null;
        startRef.current = null;
        // Bấm rồi nhả gần như không di: hình suy biến, bỏ. Đo theo ĐƯỜNG CHÉO,
        // vì một đường thẳng ngang dài 200 có chiều cao 0 — đo từng chiều sẽ bỏ oan.
        const diag = box ? Math.hypot(box[2] - box[0], box[3] - box[1]) : 0;
        if (!box || diag < SHAPE_MIN_DIAGONAL) { live?.cancelStroke(); return; }
        const kind = penPrefs.kind;
        const stroke = { kind, color: penPrefs.color, w: penPrefs.w, pts: box };
        // `fill` chỉ có ở hình đóng — nét bút và hình mở không mang field này.
        if (SHAPE_CLOSED.has(kind)) stroke.fill = penPrefs.fill === true;
        const drawingId = onStrokeDone(stroke);
        live?.endShape(drawingId);
        return;
      }

      pushDraft.current.cancel();
      setDraft(null);
      const pts = simplifyStroke(ptsRef.current);
      ptsRef.current = [];
      unsentRef.current = [];
      // Bấm rồi nhả mà không di: một điểm, không phải nét. Bỏ.
      if (pts.length < 4) { live?.cancelStroke(); return; }
      const drawingId = onStrokeDone({ kind: "pen", color: penPrefs.color, w: penPrefs.w, pts });
      live?.endStroke(drawingId);
    }

    cleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", finish);
  }, [tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, live]);

  // Cửa sổ mất focus giữa nét: mouseup sẽ không bao giờ tới, nên phải tự huỷ —
  // nếu không, nét treo lại trên màn hình mình và trên màn hình người khác.
  useEffect(() => {
    function onBlur() {
      if (!activeRef.current) return;
      // Dọn qua ĐÚNG đường dọn của lượt hiện tại: xoá activeRef mà để listener
      // mousemove/mouseup sống là cái đã sinh ra nét rác — mousemove sau đó vẫn
      // bơm điểm và mouseup vẫn gọi `finish`.
      cleanupRef.current?.();
      activeRef.current = null;
      ptsRef.current = [];
      unsentRef.current = [];
      startRef.current = null;
      boxRef.current = null;
      eraseSetRef.current = new Set();
      pushDraft.current.cancel();
      pushErase.current.cancel();
      setDraft(null);
      setEraseIds([]);
      liveRef.current?.cancelStroke();
    }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return { draft, eraseIds, handleMouseDown };
}
