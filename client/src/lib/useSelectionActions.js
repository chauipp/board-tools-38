import { useRef } from "react";
import { layerLayout } from "./layout.js";
import { edgeKey } from "./tree-layout.js";

// Thao tác trên cả vùng chọn: xoá, gán thuộc tính, tô màu, xếp gọn; tập đích của
// một cú thả badge/màu (cả vùng chọn nếu thả vào một thẻ trong vùng); và mở menu
// màu của thẻ/khung. Trước nằm trong IdeaMap.jsx.
export function useSelectionActions({
  store, board, frameCardSize, layoutOwners, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, clearSelection, chipDrag, colorDrag, dropTargetId, setColorMenu, setCommentsFor, setEdgeMenu, suppressContextMenuRef
}) {
  const depsRef = useRef({});

  // Thả badge/màu vào một thẻ ĐANG nằm trong vùng chọn nhiều thì cả vùng chọn
  // nhận — cùng quy tắc với menu màu chuột phải (xem chỗ dựng ColorMenu bên
  // dưới). Thả vào thẻ NGOÀI vùng chọn thì chỉ thẻ đó, và vùng chọn để nguyên:
  // ở đó ý người dùng rõ ràng là gán cho đúng cái thẻ mình vừa nhắm.
  function dropIdsFor(kind, id) {
    const sel = kind === "edge" ? selectedEdgeIds : (kind === "drawing" ? selectedDrawingIds : selectedIds);
    return sel.size > 1 && sel.has(id) ? Array.from(sel) : [id];
  }

  // Viền "sắp thả vào đây" phải sáng ở MỌI thẻ sắp nhận, không chỉ thẻ dưới con
  // trỏ: thả badge vào một thẻ trong vùng chọn nhiều thì cả vùng đổi, mà chỉ tô
  // một thẻ thì hình ảnh nói sai việc sắp xảy ra.
  // Chỉ nới cho cú kéo badge/màu. `dropTargetId` còn được cú kéo dây dùng, và ở
  // đó đích thật sự chỉ có một thẻ.
  function isNodeDropTarget(nodeId) {
    if (!dropTargetId || dropTargetId.kind !== "node") return false;
    if (dropTargetId.id === nodeId) return true;
    if (!chipDrag && !colorDrag) return false;
    return selectedIds.size > 1 && selectedIds.has(dropTargetId.id) && selectedIds.has(nodeId);
  }

  function deleteSelection() {
    const ids = selectedIds;
    const edgeIds = selectedEdgeIds;
    const groupIds = selectedGroupIds;
    const drawIds = selectedDrawingIds;
    if (ids.size === 0 && edgeIds.size === 0 && groupIds.size === 0 && drawIds.size === 0) return;
    // Xoá khung chỉ bỏ CÁI KHUNG, thẻ bên trong ở nguyên — đúng như nút × trên
    // khung vẫn làm. Khung là một cái vòng vẽ quanh, không phải cái hộp sở hữu
    // thẻ; xoá nhầm mà mất luôn cả cụm ý tưởng thì quá đắt.
    store.commit({
      ...board,
      nodes: board.nodes.filter((n) => !ids.has(n.id)),
      groups: board.groups.filter((g) => !groupIds.has(g.id)),
      drawings: (board.drawings || []).filter((d) => !drawIds.has(d.id)),
      edges: board.edges.filter((e) => !(
        edgeIds.has(e.id) ||
        (ids.has(e.from) && (e.fromKind || "node") === "node") ||
        (ids.has(e.to) && (e.toKind || "node") === "node") ||
        (groupIds.has(e.from) && (e.fromKind || "node") === "group") ||
        (groupIds.has(e.to) && (e.toKind || "node") === "group")
      ))
    });
    clearSelection();
  }

  function applyToSelection(patch) {
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, ...patch } : n))
    });
  }

  // Màu là thuộc tính duy nhất mà thẻ và khung dùng chung một bộ token, nên nó
  // là thứ duy nhất áp được cho cả hai trong một cú bấm.
  function applyColorToSelection(color) {
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, color } : n)),
      groups: board.groups.map((g) => (selectedGroupIds.has(g.id) ? { ...g, color } : g)),
      // Nét vẽ không có khái niệm "không màu" (một nét không màu là nét vô
      // hình), nên ô "Không màu" bỏ qua chúng thay vì làm chúng biến mất.
      drawings: color == null
        ? (board.drawings || [])
        : (board.drawings || []).map((d) => (selectedDrawingIds.has(d.id) ? { ...d, color } : d))
    });
  }

  function tidySelection() {
    if (selectedIds.size < 2) return;
    const selected = board.nodes
      .filter((n) => selectedIds.has(n.id) && !n.locked && !layoutOwners.has(edgeKey("node", n.id)))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));       // thứ tự đọc
    if (selected.length < 2) return;
    const items = selected.map((n) => ({ id: n.id, ...frameCardSize(n.id) }));
    const origin = {
      x: Math.min(...selected.map((n) => n.x)),
      y: Math.min(...selected.map((n) => n.y))
    };
    // Chỉ cạnh thẻ–thẻ mới định tầng; cạnh dính khung không nói gì về thứ tự thẻ.
    const links = board.edges.filter(
      (e) => (e.fromKind || "node") === "node" && (e.toKind || "node") === "node"
    );
    const pos = layerLayout(items, links, origin);
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (pos.has(n.id) ? { ...n, ...pos.get(n.id) } : n))
    });
  }

  function openColorMenu(e, kind, id) {
    e.preventDefault();
    e.stopPropagation();
    if (suppressContextMenuRef.current) { suppressContextMenuRef.current = false; return; }
    setEdgeMenu(null);
    setCommentsFor(null);
    setColorMenu({ kind, id, x: e.clientX, y: e.clientY });
  }

  return {
    dropIdsFor, isNodeDropTarget, deleteSelection, applyToSelection, applyColorToSelection, tidySelection, openColorMenu,
    bind: (d) => { depsRef.current = d; }
  };
}
