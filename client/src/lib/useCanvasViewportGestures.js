import { useEffect } from "react";
import { routeIntersectsRect } from "./edge-routing.js";
import { drawingsInRect } from "./shape.js";
import { rafThrottle } from "./raf-throttle.js";
import { unionIdSet } from "./selection.js";

const EMPTY_SET = new Set();
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 2.4;

export function computeZoom(currentBoard, rect, screenX, screenY, factor) {
  const mx = screenX - rect.left, my = screenY - rect.top;
  const oldScale = currentBoard.view.scale;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor));
  const cx = (mx - currentBoard.view.panX) / oldScale;
  const cy = (my - currentBoard.view.panY) / oldScale;
  return { ...currentBoard, view: { panX: mx - newScale * cx, panY: my - newScale * cy, scale: newScale } };
}

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function useCanvasViewportGestures({
  boardReady, boardRef, viewportRef, wheelReaderRef, wheelMode, stopFollow, setBoard,
  edgeRoutesRef, frameCardSize, clearSelection, setMarquee, setIsPanning, suppressContextMenuRef,
  selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds,
  setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds
}) {
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function wheelHandler(e) {
      // Dock/phần panel có vùng cuộn riêng: nếu canvas bắt wheel ở đây rồi
      // preventDefault thì scrollbar vẫn hiện nhưng người dùng không thể cuộn
      // form. Mọi panel nổi đều cùng luật này — di chuột trên panel chỉ cuộn
      // nội dung của nó, không lia/zoom sa bàn nằm dưới.
      if (e.target.closest(".outline-panel, .io-drawer, .tree-panel, .edit-dock")) return;
      e.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      // Cuộn/zoom là người dùng tự lái camera → thôi bám theo người khác.
      stopFollow();
      // MỘT chỗ duy nhất quyết định "cú này là lia hay là phóng": lib/pointer-input.js.
      // Trước đây chỗ này tự xử, và nó xử cùng một kiểu cho nút lăn với touchpad —
      // nên trên laptop chỉ trượt nhẹ hai ngón là bảng phóng to vọt lên. Xem ghi
      // chú đầu file đó về từng dấu hiệu nhận thiết bị.
      const cmd = wheelReaderRef.current.read(e, wheelMode);
      if (cmd.intent === "pan") {
        const next = {
          ...current,
          view: { ...current.view, panX: current.view.panX - cmd.dx, panY: current.view.panY - cmd.dy }
        };
        setBoard(next);
        return;
      }
      setBoard(computeZoom(current, el.getBoundingClientRect(), e.clientX, e.clientY, cmd.factor));
    }
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
    // stopFollow là useCallback ổn định (chỉ phụ thuộc sendFollow, cũng ổn
    // định), nên thêm vào deps không làm listener gắn lại thêm lần nào.
    // Re-chạy khi board tải xong: lúc mount đầu board còn null nên viewport
    // chưa render (return "Đang tải…"), viewportRef.current == null và listener
    // sẽ không được gắn nếu chỉ phụ thuộc [].
    // wheelMode chỉ đổi khi người dùng bấm trong panel Giao diện — gắn lại
    // listener khi đó thì rẻ, và rẻ hơn hẳn một ref nữa phải đồng bộ tay.
  }, [boardReady, stopFollow, wheelMode]);

  function handleMarqueeMouseDown(e) {
    const rect = viewportRef.current.getBoundingClientRect();
    const startScreenX = e.clientX, startScreenY = e.clientY;
    let dragging = false;
    const THRESHOLD = 4;
    // Giữ Ctrl/Cmd lúc bắt đầu quét = quét thêm vào lựa chọn đang có. Chốt lại
    // mốc ngay đây, không đọc `selectedIds` trong onMove: onMove là closure của
    // lần render này nên `selectedIds` ở đó cũng là bản cũ, nhưng đọc từ biến
    // này thì rõ ý là "lựa chọn lúc bắt đầu quét" chứ không phải nhìn nhầm.
    const additive = e.ctrlKey || e.metaKey;
    const baseNodeIds = additive ? selectedIds : EMPTY_SET;
    const baseEdgeIds = additive ? selectedEdgeIds : EMPTY_SET;
    const baseGroupIds = additive ? selectedGroupIds : EMPTY_SET;
    const baseDrawingIds = additive ? selectedDrawingIds : EMPTY_SET;

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }

    function hitIdsFor(m) {
      return boardRef.current.nodes
        .filter((n) => {
          const { w, h } = frameCardSize(n.id);
          return rectsOverlap(m.x, m.y, m.w, m.h, n.x, n.y, w, h);
        })
        .map((n) => n.id);
    }

    // Khung dính khi vùng quét CHẠM nó, cùng luật với thẻ — không đòi quét trùm
    // kín. Khung thường to hơn cả khung nhìn, đòi trùm kín thì gần như không bao
    // giờ chọn được bằng chuột.
    function groupHitIdsFor(m) {
      return boardRef.current.groups
        .filter((g) => rectsOverlap(m.x, m.y, m.w, m.h, g.x, g.y, g.w, g.h))
        .map((g) => g.id);
    }

    function edgeHitIdsFor(m) {
      return boardRef.current.edges
        .filter((edge) => routeIntersectsRect(edgeRoutesRef.current.get(edge.id), m))
        .map((edge) => edge.id);
    }

    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startScreenX, ev.clientY - startScreenY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const a = toCanvas(startScreenX, startScreenY);
      const b = toCanvas(ev.clientX, ev.clientY);
      const m = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      setMarquee(m);
      // Giữ nguyên Set cũ khi tập chọn không đổi: một Set mới ở mỗi nhịp chuột
      // sẽ kích hoạt effect ghi URL và effect phát selection lên socket dù
      // chẳng có gì thay đổi.
      setSelectedIds((prev) => unionIdSet(prev, baseNodeIds, hitIdsFor(m)));
      setSelectedEdgeIds((prev) => unionIdSet(prev, baseEdgeIds, edgeHitIdsFor(m)));
      setSelectedGroupIds((prev) => unionIdSet(prev, baseGroupIds, groupHitIdsFor(m)));
      setSelectedDrawingIds((prev) => unionIdSet(prev, baseDrawingIds, drawingsInRect(boardRef.current.drawings || [], m)));
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      // Bấm-không-kéo trên nền trống = bỏ chọn hết, NHƯNG có Ctrl thì không:
      // ở đó Ctrl nghĩa là "đang cộng dồn lựa chọn", trượt tay bấm nhầm nền
      // trống mà mất cả vùng chọn vừa gom là hỏng việc.
      if (!dragging) { if (!additive) clearSelection(); return; }
      setMarquee(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startPan(e) {
    e.preventDefault();
    // Tự lia nền → thôi bám theo người khác. Đặt ở đây (mousedown) chứ không
    // trong onMove: người dùng vừa chạm vào là dừng ngay, không phải đợi camera
    // giằng co với vòng bám qua vài khung hình.
    stopFollow();
    const startX = e.clientX, startY = e.clientY;
    const startPanX = boardRef.current.view.panX, startPanY = boardRef.current.view.panY;
    let dragging = false;
    const THRESHOLD = 4;

    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) {
        dragging = true;
        setIsPanning(true);
      }
      if (!dragging) return;
      const nx = startPanX + (ev.clientX - startX);
      const ny = startPanY + (ev.clientY - startY);
      setBoard((prev) => ({ ...prev, view: { ...prev.view, panX: nx, panY: ny } }));
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      if (dragging) {
        setIsPanning(false);
        // KHÔNG lưu: lia sa bàn chỉ đổi camera, mà camera là riêng từng người
        // (api.js đã bỏ `view` khỏi payload). Lần PUT ở đây không ghi được gì,
        // nhưng vẫn đẩy cả board — kể cả ảnh base64 — lên server rồi bắt server
        // phát board:update cho MỌI người khác. Mỗi cú lia nền của một người là
        // một cú giật trên màn hình tất cả những người còn lại.
        suppressContextMenuRef.current = true;
        setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { handleMarqueeMouseDown, startPan };
}
