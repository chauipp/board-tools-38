import { useRef } from "react";
import { useStableHandlers } from "./useStableHandlers.js";

// Vỏ handler định danh cố định cho IdeaCard và FrameBox (cả hai bọc React.memo):
// mỗi khoá gọi xuyên tới bản mới nhất của hàm xử lý qua useStableHandlers. Trước
// nằm trong IdeaMap.jsx.
export function useBoardItemHandlers({
  cardDragClickGuardRef, deleteGroup, deleteNode, handleCardClick, handleConnectorMouseDown, handleGroupConnectorMouseDown, handleGroupMouseDown, handleGroupResizeMouseDown, handleImageDrop, handleImageResizeMouseDown, handleNodeMouseDown, handlePdfResizeMouseDown, openColorMenu, removeNodeImage, saveGroupTitle, saveNodeEdit, saveNodeEditAndNext, sendLiveText, setColorMenu, setCommentsFor, setEdgeMenu, setEditingGroupTitleId, setEditingId, toggleFavorite
}) {
  const depsRef = useRef({});

  // Lớp vỏ định danh cố định cho React.memo trên IdeaCard/FrameBox (xem
  // lib/useStableHandlers.js): mỗi khoá gọi xuyên tới bản mới nhất của hàm.
  const cardHandlers = useStableHandlers({
    mouseDown: (e, id) => handleNodeMouseDown(e, id),
    click: (id) => handleCardClick(id),
    isClick: () => cardDragClickGuardRef.current.consume(),
    contextMenu: (e, id) => openColorMenu(e, "card", id),
    connectorMouseDown: (e, id, direction) => handleConnectorMouseDown(e, id, direction),
    edit: (id) => setEditingId(id),
    cancelEdit: () => setEditingId(null),
    remove: (id) => deleteNode(id),
    toggleFavorite: (id) => toggleFavorite(id),
    openComments: (e, id) => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id, x: e.clientX, y: e.clientY }); },
    liveText: (id, field, value) => sendLiveText({ nodeId: id, field, value }),
    save: (id, fields) => saveNodeEdit(id, fields),
    saveAndNext: (id, fields) => saveNodeEditAndNext(id, fields),
    dropImage: (e, id) => handleImageDrop(e, id),
    removeImage: (id) => removeNodeImage(id),
    imageResize: (e, id) => handleImageResizeMouseDown(e, id),
    pdfResize: (e, id) => handlePdfResizeMouseDown(e, id)
  });

  const groupHandlers = useStableHandlers({
    mouseDown: (e, id) => handleGroupMouseDown(e, id),
    contextMenu: (e, id) => openColorMenu(e, "group", id),
    remove: (id) => deleteGroup(id),
    editTitle: (id) => setEditingGroupTitleId(id),
    cancelTitle: () => setEditingGroupTitleId(null),
    saveTitle: (id, title) => saveGroupTitle(id, title),
    resizeMouseDown: (e, id) => handleGroupResizeMouseDown(e, id),
    connectorMouseDown: (e, id) => handleGroupConnectorMouseDown(e, id)
  });

  return {
    cardHandlers, groupHandlers,
    bind: (d) => { depsRef.current = d; }
  };
}
