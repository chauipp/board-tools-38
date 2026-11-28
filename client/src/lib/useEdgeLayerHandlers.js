import { useMemo, useRef } from "react";
import { toggleId } from "./selection.js";
import { EMPTY_SET } from "./board-constants.js";

// Handler cho lớp dây (EdgeLayer, bọc memo): hover, bấm trái để chọn dây (Ctrl
// để cộng dồn), bấm phải để mở menu sửa dây. Bọc useMemo để định danh ổn định —
// đổi định danh là cả lớp dây vẽ lại ở mỗi lượt render. Trước nằm trong
// IdeaMap.jsx.
export function useEdgeLayerHandlers({
  board, setHoveredEdgeId, setColorMenu, setCommentsFor, setEdgeMenu, setDesignEditId, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds
}) {
  const depsRef = useRef({});

  const onEdgeEnter = useMemo(() => (id) => setHoveredEdgeId(id), []);

  const onEdgeLeave = useMemo(() => (id) => setHoveredEdgeId((cur) => (cur === id ? null : cur)), []);

  // Chuột TRÁI trên dây = chọn, y như bấm vào thẻ: một mình nó, hoặc Ctrl để
  // cộng dồn. Chuột PHẢI mới mở menu sửa dây — cùng luật với thẻ và khung, nên
  // không phải nhớ riêng cho dây một kiểu bấm khác.
  const onEdgeClick = useMemo(() => (e, id) => {
    setColorMenu(null);
    setCommentsFor(null);
    setEdgeMenu(null);
    setDesignEditId(null);
    if (e.ctrlKey || e.metaKey) {
      setSelectedEdgeIds((prev) => toggleId(prev, id));
      return;
    }
    setSelectedEdgeIds(new Set([id]));
    setSelectedIds(EMPTY_SET);
    setSelectedGroupIds(EMPTY_SET);
    setSelectedDrawingIds(EMPTY_SET);
  }, [board?.kind]);

  const onEdgeContextMenu = useMemo(() => (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setColorMenu(null);
    setCommentsFor(null);
    if (board?.kind === "game-design") {
      setDesignEditId(null);
      setSelectedEdgeIds(new Set([id]));
      setSelectedIds(EMPTY_SET);
      setSelectedGroupIds(EMPTY_SET);
      setSelectedDrawingIds(EMPTY_SET);
      setEdgeMenu(null);
      return;
    }
    setEdgeMenu({ id, x: e.clientX, y: e.clientY });
  }, [board?.kind]);

  return {
    onEdgeEnter, onEdgeLeave, onEdgeClick, onEdgeContextMenu,
    bind: (d) => { depsRef.current = d; }
  };
}
