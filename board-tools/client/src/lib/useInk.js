import { useCallback, useEffect, useRef, useState } from "react";
import { simplifyStroke, strokesHitBy } from "./stroke.js";
import { rafThrottle } from "./raf-throttle.js";

// Bán kính gôm, đơn vị toạ độ canvas. Cộng thêm w/2 của từng nét trong
// strokesHitBy, nên nét dày dễ chạm hơn nét mảnh — đúng cảm giác mong đợi.
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
  const activeRef = useRef(null);   // "pen" | "eraser" | null

  const pushDraft = useRef(null);
  if (!pushDraft.current) {
    pushDraft.current = rafThrottle((color, w, pts) => setDraft({ color, w, pts }));
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
      eraseSetRef.current = new Set(strokesHitBy(board.drawings || [], start, ERASE_RADIUS));
      pushErase.current(Array.from(eraseSetRef.current));
      // Gọi cả khi rỗng: beginErase phải tăng strokeId để lượt quét này có khoá
      // overlay riêng, không nối tiếp vào lượt trước.
      live?.beginErase(Array.from(eraseSetRef.current));
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
        const hit = strokesHitBy(b.drawings || [], p, ERASE_RADIUS);
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

      ptsRef.current.push(p.x, p.y);
      unsentRef.current.push(Math.round(p.x), Math.round(p.y));
      pushDraft.current(penPrefs.color, penPrefs.w, ptsRef.current.slice());
      // Gói mang đúng những điểm chưa gửi; trailingThrottle bên useInkLive gộp
      // các lần gọi trong cùng 40ms nên phải xả `unsent` ở ĐÓ, không phải ở đây.
      live?.pushPoints(unsentRef.current);
    }

    function finish() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", finish);
      const wasPen = activeRef.current === "pen";
      activeRef.current = null;

      if (!wasPen) {
        const ids = Array.from(eraseSetRef.current);
        eraseSetRef.current = new Set();
        pushErase.current.cancel();
        setEraseIds([]);
        // Quét mà không chạm nét nào: không commit, không tạo entry hoàn tác rác.
        if (ids.length) onEraseDone(ids);
        live?.endErase();
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

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", finish);
  }, [tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, live]);

  // Cửa sổ mất focus giữa nét: mouseup sẽ không bao giờ tới, nên phải tự huỷ —
  // nếu không, nét treo lại trên màn hình mình và trên màn hình người khác.
  useEffect(() => {
    function onBlur() {
      if (!activeRef.current) return;
      activeRef.current = null;
      ptsRef.current = [];
      unsentRef.current = [];
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
