import { useState, useRef } from "react";
import { edgesMatch } from "./board-geometry.js";
import { startDrag } from "./drag-session.js";

// Dây nối giữa thẻ/khung: chế độ nối (linkMode/pendingSource), kéo dây mới từ
// connector của thẻ hoặc khung, kéo đầu dây có sẵn sang chỗ khác, menu dây và
// thêm/sửa/xoá dây. Trước nằm trong IdeaMap.jsx. createLinkedNode, enterMode,
// entityAtPoint gắn qua bind() mỗi lượt render.
export function useEdgeInteractions({
  store, board, setSelectedEdgeIds, setDropTargetId, viewRef, viewportRef
}) {
  const depsRef = useRef({});
  const createLinkedNode = (...a) => depsRef.current.createLinkedNode(...a);
  const enterMode = (...a) => depsRef.current.enterMode(...a);
  const entityAtPoint = (...a) => depsRef.current.entityAtPoint(...a);

  const [linkMode, setLinkMode] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);
  const [linkDraft, setLinkDraft] = useState(null);
  const [edgeMenu, setEdgeMenu] = useState(null); // { id, x, y } | null
  const [edgeDrag, setEdgeDrag] = useState(null); // { edgeId, end: "from"|"to", fixedKind, fixedId, x, y } | null

  // Bật "Nối ý tưởng" mà vẫn còn ở mode Sửa thì vô dụng: `.ink-capture` phủ
  // kín viewport ở mode Sửa và nuốt hết click lên thẻ, nên không bấm chọn
  // được thẻ nguồn/đích nào — bật lên rồi coi như chết. Bật link mode phải
  // kéo về mode Chuột (select) trước; tắt link mode thì giữ nguyên mode hiện
  // tại. Dùng chung cho cả phím tắt `l` và nút trên ToolRail.
  function toggleLinkMode() {
    const turningOn = !linkMode;
    if (turningOn) enterMode("select");
    setLinkMode(turningOn);
    setPendingSource(null);
  }

  function handleConnectorMouseDown(e, nodeId, direction) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    function toCanvas(clientX, clientY) {
      const view = viewRef.current;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.kind === "node" && t.id === nodeId) return null;
      return t;
    }

    // rAF: mỗi nhịp gọi document.elementFromPoint — một phép hit-test buộc
    // trình duyệt tính lại layout. Ở tần số chuột thô đó là vài trăm lần/giây.
    const onMove = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: nodeId, fromKind: "node", x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    };
    function onUp(ev) {
      if (dragging) {
        setLinkDraft(null);
        const t = targetAt(ev.clientX, ev.clientY);
        setDropTargetId(null);
        if (t) toggleEdge(nodeId, "node", t.id, t.kind);
      } else {
        createLinkedNode(nodeId, direction);
      }
    }
    startDrag(e, { onMove, onEnd: onUp, release: "cancel" });
  }

  function handleGroupConnectorMouseDown(e, groupId) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();

    function toCanvas(clientX, clientY) {
      const view = viewRef.current;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.kind === "group" && t.id === groupId) return null;
      return t;
    }

    const onMove = (ev) => {
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: groupId, fromKind: "group", x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    };
    function onUp(ev) {
      setLinkDraft(null);
      setDropTargetId(null);
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) toggleEdge(groupId, "group", t.id, t.kind);
    }
    startDrag(e, { onMove, onEnd: onUp, release: "cancel" });
  }

  // Cầm một đầu dây có sẵn và kéo sang thẻ/khung khác để đổi hướng nối. Khung
  // (group) là điểm đến hợp lệ y hệt thẻ — cả hai đi qua entityAtPoint chung.
  function handleEdgeEndpointMouseDown(e, edge, end) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setEdgeMenu(null);
    const rect = viewportRef.current.getBoundingClientRect();
    const fixedKind = end === "from" ? (edge.toKind || "node") : (edge.fromKind || "node");
    const fixedId = end === "from" ? edge.to : edge.from;

    function toCanvas(clientX, clientY) {
      const view = viewRef.current;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.id === fixedId && t.kind === fixedKind) return null;
      return t;
    }

    const onMove = (ev) => {
      const p = toCanvas(ev.clientX, ev.clientY);
      setEdgeDrag({ edgeId: edge.id, end, fixedKind, fixedId, x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    };
    function onUp(ev) {
      setEdgeDrag(null);
      setDropTargetId(null);
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) updateEdge(edge.id, end === "from" ? { from: t.id, fromKind: t.kind } : { to: t.id, toKind: t.kind });
    }
    startDrag(e, { onMove, onEnd: onUp, release: "cancel" });
  }

  function toggleEdge(a, aKind, b, bKind) {
    const existing = board.edges.find((e) => edgesMatch(e, a, aKind, b, bKind));
    if (existing) {
      store.commit({ ...board, edges: board.edges.filter((e) => e.id !== existing.id) });
    } else {
      const edge = { id: board.nextEdgeId, from: a, fromKind: aKind, to: b, toKind: bKind, ...(board.kind === "game-design" ? { relation: "depends-on" } : {}) };
      store.commit({ ...board, edges: [...board.edges, edge], nextEdgeId: board.nextEdgeId + 1 });
    }
  }

  function updateEdge(id, patch) {
    store.commit({ ...board, edges: board.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function deleteEdge(id) {
    store.commit({ ...board, edges: board.edges.filter((e) => e.id !== id) });
    setEdgeMenu(null);
    setSelectedEdgeIds((prev) => { if (!prev.has(id)) return prev; const next = new Set(prev); next.delete(id); return next; });
  }

  return {
    linkMode, setLinkMode, pendingSource, setPendingSource, linkDraft, setLinkDraft, edgeMenu, setEdgeMenu, edgeDrag, setEdgeDrag, toggleLinkMode, handleConnectorMouseDown, handleGroupConnectorMouseDown, handleEdgeEndpointMouseDown, toggleEdge, updateEdge, deleteEdge,
    bind: (d) => { depsRef.current = d; }
  };
}
