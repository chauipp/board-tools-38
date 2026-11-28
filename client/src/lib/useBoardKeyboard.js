import { useEffect, useRef } from "react";
import { moveDrawing } from "./shape.js";

// Phím tắt toàn cục của bảng (một listener keydown trên window) và nhích vùng
// chọn bằng phím mũi tên — cả loạt nhích chỉ ghi lịch sử một lần. Trước nằm
// trong IdeaMap.jsx. Danh sách deps của effect giữ nguyên như cũ. armPlace,
// deleteSelection, enterMode, movingPayload, zoomToSelection gắn qua bind() mỗi
// lượt render.
export function useBoardKeyboard({
  store, board, boardRef, role, view, mode, tool, setTool, placeTool, setPlaceTool, past, future, undo, redo, saveNow, saveDebounced, flushNudgeBurst, nudgeTimerRef, setBoard, inkLive, laser, editingId, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, clearSelection, linkMode, setLinkMode, setPendingSource, toggleLinkMode, colorMenu, setColorMenu, badgeUI, setBadgeUI, edgeMenu, setEdgeMenu, commentsFor, setCommentsFor, focusId, setFocusId, searchOpen, setSearchOpen, searchInputRef, setCardLevelPref, presentIndex, stepPresentation, exitPresentation, createLinkedNode, createSiblingNode, duplicateSelection, publishGeom, finishGeom
}) {
  const depsRef = useRef({});
  const armPlace = (...a) => depsRef.current.armPlace(...a);
  const deleteSelection = (...a) => depsRef.current.deleteSelection(...a);
  const enterMode = (...a) => depsRef.current.enterMode(...a);
  const movingPayload = (...a) => depsRef.current.movingPayload(...a);
  const zoomToSelection = (...a) => depsRef.current.zoomToSelection(...a);

  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      const key = e.key.toLowerCase();
      // Đang trình chiếu: ←/→/Esc được ưu tiên, mọi phím tắt khác tạm tắt.
      if (presentIndex != null) {
        if (key === "arrowright") { e.preventDefault(); stepPresentation(1); }
        else if (key === "arrowleft") { e.preventDefault(); stepPresentation(-1); }
        else if (key === "escape") { exitPresentation(); }
        // `k` là ngoại lệ duy nhất trong danh sách phím tắt bị tắt khi trình
        // chiếu, vì đang trình chiếu MỚI là lúc cần cây laser nhất. Nó cũng
        // không đụng gì tới slide: chỉ đổi mode, không ghi, không lia bảng.
        else if (key === "k") { e.preventDefault(); enterMode(mode === "laser" ? "select" : "laser"); }
        return;
      }
      // Undo/redo/nhân bản đều ghi dữ liệu. Với người chỉ xem chúng không lưu
      // được (saveNow chặn) nhưng vẫn làm thẻ nhảy trên màn hình rồi biến mất
      // khi tải lại — nên chặn thẳng ở đây.
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+F chỉ dời con trỏ vào ô tìm kiếm, không ghi gì — người chỉ xem
        // vẫn phải dùng được, nên xử lý TRƯỚC guard viewer bên dưới.
        if (key === "f") {
          e.preventDefault();
          setSearchOpen(true);
          // Đang mở sẵn thì focus ngay tại đây; đang đóng thì ô nhập chưa có
          // trong cây, useEffect theo `searchOpen` bên dưới lo nốt.
          const el = searchInputRef.current;
          if (el) { el.focus(); el.select(); }
          return;
        }
        if (role === "viewer") return;
        if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
        else if (key === "z") { e.preventDefault(); undo(); }
        else if (key === "y") { e.preventDefault(); redo(); }
        else if (key === "d") { e.preventDefault(); duplicateSelection(); }
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (role === "viewer") return;
        e.preventDefault();
        deleteSelection();
      }
      else if (key === "escape") {
        if (mode === "draw" || mode === "place" || mode === "laser") enterMode("select");
        else if (colorMenu) setColorMenu(null);
        else if (badgeUI) setBadgeUI(null);
        else if (edgeMenu) setEdgeMenu(null);
        else if (commentsFor) setCommentsFor(null);
        else if (linkMode) { setLinkMode(false); setPendingSource(null); }
        else if (focusId != null) setFocusId(null);
        else if (selectedIds.size > 0 || selectedEdgeIds.size > 0 || selectedGroupIds.size > 0 || selectedDrawingIds.size > 0) clearSelection();
      }
      // Enter trên thẻ đang chọn = tạo thẻ con bên phải, Shift+Enter = tạo thẻ
      // cùng cấp bên dưới. Handler đã thoát sớm khi con trỏ nằm trong
      // input/textarea, nên thẻ đang mở ô sửa không rơi vào đây.
      else if (key === "enter") {
        if (role === "viewer") return;
        if (editingId != null || selectedIds.size !== 1) return;
        if (colorMenu || badgeUI || edgeMenu || commentsFor) return;
        e.preventDefault();
        const [id] = selectedIds;
        if (e.shiftKey) createSiblingNode(id);
        else createLinkedNode(id, "right");
      }
      // `n` không còn thả thẳng một thẻ ra giữa màn hình: nó lên nòng nút "thêm
      // ý tưởng" y như bấm nút đó, rồi chờ bấm chỉ chỗ. Shift+N lên nòng luôn ở
      // bậc 1 (thẻ gốc) — thay cho nút "thêm thẻ gốc" đã rời khỏi khu 3.
      else if (key === "n") {
        if (role === "viewer") return;
        e.preventDefault();
        // Shift+N luôn LÊN nòng, không bao giờ hạ: nó mang thêm ý "đổi sang bậc
        // 1", nên bấm nó lúc đang lên nòng sẵn mà lại tắt đi là ngược ý.
        if (e.shiftKey) { setCardLevelPref(1); setPlaceTool("node"); enterMode("place"); }
        else armPlace("node");
      }
      // v chỉ đổi mode, không ghi gì — người chỉ xem vẫn dùng được.
      else if (key === "v") { e.preventDefault(); enterMode("select"); }
      // `p` = Pen. Trước đây là `b` (brush) — đổi vì tool này tên là Bút.
      else if (key === "p") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("pen"); }
      else if (key === "e") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("eraser"); }
      else if (key === "s") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("shape"); }
      else if (key === "t") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("text"); }
      else if (key === "l") { if (role === "viewer") return; e.preventDefault(); toggleLinkMode(); }
      // `k` — chữ cái Excalidraw dùng cho laser. Bấm lần nữa là tắt: laser là
      // thứ bật lên trong dăm câu nói rồi tắt, khác bút (chọn xong vẽ cả buổi),
      // nên nó cần một phím BẬT/TẮT chứ không phải một phím chọn.
      // Không có chốt viewer: laser không ghi gì vào board.
      else if (key === "k") { e.preventDefault(); enterMode(mode === "laser" ? "select" : "laser"); }
      // `f` (vừa khung theo lựa chọn) chỉ đổi view — người chỉ xem vẫn dùng được.
      else if (key === "f") { e.preventDefault(); zoomToSelection(); }
      else if (key === "arrowleft") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(e.shiftKey ? -10 : -1, 0); }
      else if (key === "arrowright") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(e.shiftKey ? 10 : 1, 0); }
      else if (key === "arrowup") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(0, e.shiftKey ? -10 : -1); }
      else if (key === "arrowdown") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(0, e.shiftKey ? 10 : 1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // selectedDrawingIds PHẢI có trong danh sách này: chọn riêng mấy nét vẽ mà
    // không đụng tới thẻ/khung thì effect không chạy lại, và handler còn giữ
    // closure của lượt render cũ — Delete sẽ đọc một vùng chọn rỗng và không
    // xoá gì. Cùng lý do với mọi state khác trong hàm này.
  }, [board, past, future, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, linkMode, colorMenu, badgeUI, edgeMenu, commentsFor, focusId, presentIndex, role, editingId, mode, placeTool]);

  function nudgeSelection(dx, dy) {
    if (selectedIds.size === 0 && selectedGroupIds.size === 0 && selectedDrawingIds.size === 0) return;
    if (store.beginNudge(board)) {   // history recorded once per burst, at burst end
      // Mỗi loạt nhích là MỘT lượt live riêng. Thiếu dòng này thì gói dùng lại
      // strokeId của lượt kéo trước và đè lên entry của nó.
      inkLive.beginMove();
    }
    // Cùng tập với cú kéo bằng chuột: khung đang chọn đi kèm ruột của nó.
    const { groupIds, nodeIds } = selectionDragSet(board, selectedGroupIds, selectedIds);
    const moveNodes = new Set(nodeIds);
    const moveGroups = new Set(groupIds);
    const next = {
      ...board,
      nodes: board.nodes.map((n) => (moveNodes.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      groups: board.groups.map((g) => (moveGroups.has(g.id) ? { ...g, x: g.x + dx, y: g.y + dy } : g)),
      // Nét vẽ / hình / chữ nhích cùng cả cụm. Chúng KHÔNG vào publishGeom bên
      // dưới: gói geom chỉ mang thẻ và khung, người khác thấy nét vẽ nhảy tới
      // chỗ mới ở lần lưu — cùng cách cú kéo nét bằng chuột đang làm.
      drawings: (board.drawings || []).map((d) => (selectedDrawingIds.has(d.id) ? moveDrawing(d, dx, dy) : d))
    };
    setBoard(next);
    // Nhích bằng phím mũi tên cũng là một cú "kéo": người khác phải thấy thẻ
    // chạy ngay, chứ không đợi bản lưu 500ms sau mới nhảy một phát.
    publishGeom({
      nodes: next.nodes.filter((n) => moveNodes.has(n.id)),
      groups: next.groups.filter((g) => moveGroups.has(g.id))
    });
    // Nét vẽ / hình / chữ trong cụm cũng nhích, và chúng đi kênh riêng.
    if (selectedDrawingIds.size) inkLive.pushMove(movingPayload(next, selectedDrawingIds));
    saveDebounced(next);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      finishGeom({
        nodes: boardRef.current.nodes.filter((n) => moveNodes.has(n.id)),
        groups: boardRef.current.groups.filter((g) => moveGroups.has(g.id))
      });
      if (selectedDrawingIds.size) inkLive.endMove(movingPayload(boardRef.current, selectedDrawingIds));
      flushNudgeBurst();
    }, 600);
  }

  return {
    nudgeSelection,
    bind: (d) => { depsRef.current = d; }
  };
}
