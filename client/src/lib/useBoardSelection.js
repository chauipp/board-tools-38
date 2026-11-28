import { useEffect, useMemo, useRef, useState } from "react";
import { selectionBounds } from "./selection-box.js";
import { selectionDragSet as selectionDragSetFor, unionIdSet } from "./selection.js";
import { rectsOverlap } from "./board-geometry.js";
import { routeIntersectsRect } from "./edge-routing.js";
import { drawingsInRect } from "./shape.js";
import { EMPTY_SET } from "./board-constants.js";
import { startDrag } from "./drag-session.js";

// Lựa chọn trên bảng: bốn tập id (thẻ, dây, khung, nét vẽ), khung quét chọn,
// hộp bao vùng chọn và việc ghi ?card= lên URL. Trước nằm trong IdeaMap.jsx.
//
// viewportRef, viewRef, boardRef, edgeRoutesRef được gắn qua bind() mỗi lượt
// render (edgeRoutesRef khai báo sau hook này trong IdeaMap); chỉ đọc trong
// handler.
export function useBoardSelection({ board, frameCardSize }) {
  const depsRef = useRef({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(new Set());
  // Khung (nhóm) cũng là một thứ chọn được, quét trúng là vào đây. Kéo một khung
  // luôn kéo theo thẻ nằm trong nó, nên tập này KHÔNG chứa sẵn các thẻ thành
  // viên — chúng được tính lại tại chỗ (selectionDragSet), vì thẻ có thể ra vào
  // khung bất cứ lúc nào.
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  // Nét bút, hình khối và chữ — cả ba nằm chung trong board.drawings nên chung
  // một tập chọn. Chúng không có nút DOM riêng (cả lớp vẽ là một thẻ <svg>
  // pointer-events: none), nên mọi phép bắt chuột ở đây đều là hit-test hình học
  // trên toạ độ canvas, không phải elementFromPoint như thẻ.
  const [selectedDrawingIds, setSelectedDrawingIds] = useState(new Set());
  const [marquee, setMarquee] = useState(null);

  // Vùng chọn gói lại thành MỘT object để truyền xuống lib/selection-box.js —
  // ba Set rời nhau là ba tham số phải bê theo qua từng hàm.
  const selectionSet = useMemo(
    () => ({ nodeIds: selectedIds, groupIds: selectedGroupIds, drawingIds: selectedDrawingIds }),
    [selectedIds, selectedGroupIds, selectedDrawingIds]
  );

  // Hộp bao của cả vùng chọn. Có nó thì: cầm chỗ nào TRONG vùng cũng kéo được cả
  // cụm (không phải nhắm đúng vào một cái thẻ hay một cái nét), thả màu vào chỗ
  // trống trong vùng là cả cụm đổi màu, và bốn góc trở thành tay cầm co giãn.
  //
  // Phụ thuộc cả `frameCardSize`: chiều cao thẻ do ResizeObserver đo, thẻ vừa
  // được đo lại (ảnh tải xong, chữ xuống dòng) thì hộp phải ôm lại theo.
  const selBounds = useMemo(
    () => selectionBounds(board, selectionSet, frameCardSize),
    [board?.nodes, board?.groups, board?.drawings, selectionSet, frameCardSize]
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const want = selectedIds.size === 1 ? String(Array.from(selectedIds)[0]) : null;
    const have = url.searchParams.get("card");
    if (want === have) return;
    if (want != null) url.searchParams.set("card", want);
    else url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  }, [selectedIds]);

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectedGroupIds(new Set());
    setSelectedDrawingIds(new Set());
  }

  // Bản gắn sẵn kích thước thẻ của lib/selection.js#selectionDragSet.
  function selectionDragSet(base, groupIds, nodeIds) {
    return selectionDragSetFor(base, groupIds, nodeIds, frameCardSize);
  }

  function handleMarqueeMouseDown(e) {
    const { viewportRef, viewRef, boardRef, edgeRoutesRef } = depsRef.current;
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
      const view = viewRef.current;
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

    const onMove = (ev) => {
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
    };
    function onUp() {
      // Bấm-không-kéo trên nền trống = bỏ chọn hết, NHƯNG có Ctrl thì không:
      // ở đó Ctrl nghĩa là "đang cộng dồn lựa chọn", trượt tay bấm nhầm nền
      // trống mà mất cả vùng chọn vừa gom là hỏng việc.
      if (!dragging) { if (!additive) clearSelection(); return; }
      setMarquee(null);
    }
    startDrag(e, { onMove, onEnd: onUp, release: "cancel" });
  }

  return {
    selectedIds, setSelectedIds, selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds, selectedDrawingIds, setSelectedDrawingIds,
    marquee, setMarquee, selectionSet, selBounds,
    clearSelection, selectionDragSet, handleMarqueeMouseDown,
    bind: (d) => { depsRef.current = d; }
  };
}
