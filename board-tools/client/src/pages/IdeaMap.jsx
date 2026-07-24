import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { getIdeas, saveIdeas } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import LoadError from "../components/LoadError.jsx";
import "../styles/idea-map.css";

const STATUS = {
  idea: { label: "Ý tưởng mới", color: "var(--st-idea)" },
  considering: { label: "Đang cân nhắc", color: "var(--st-considering)" },
  chosen: { label: "Đã chọn", color: "var(--st-chosen)" },
  parked: { label: "Gác lại", color: "var(--st-parked)" },
  rejected: { label: "Đã loại", color: "var(--st-rejected)" }
};
const STATUS_ORDER = ["idea", "considering", "chosen", "parked", "rejected"];
const TAG_SUGGESTIONS = ["Cơ chế", "Cốt truyện", "Nghệ thuật", "Âm thanh", "Kỹ thuật", "Kinh doanh", "Nghiên cứu"];
const DOT_PALETTE = ["var(--dot-1)", "var(--dot-2)", "var(--dot-3)", "var(--dot-4)", "var(--dot-5)", "var(--dot-6)", "var(--dot-7)", "var(--dot-8)"];
const CARD_W = 210;
const MIN_SCALE = 0.3, MAX_SCALE = 2.4;

function hashTag(tag) {
  let h = 0;
  const s = String(tag || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DOT_PALETTE[h % DOT_PALETTE.length];
}

function computeZoom(currentBoard, rect, screenX, screenY, factor) {
  const mx = screenX - rect.left, my = screenY - rect.top;
  const oldScale = currentBoard.view.scale;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor));
  const cx = (mx - currentBoard.view.panX) / oldScale;
  const cy = (my - currentBoard.view.panY) / oldScale;
  return { ...currentBoard, view: { panX: mx - newScale * cx, panY: my - newScale * cy, scale: newScale } };
}

export default function IdeaMap() {
  const toggleTheme = useTheme();
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [linkMode, setLinkMode] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);
  const [filterStatus, setFilterStatus] = useState({});
  const [filterTags, setFilterTags] = useState({});
  const [search, setSearch] = useState("");
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState("export");
  const [ioText, setIoText] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [linkDraft, setLinkDraft] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [chipDrag, setChipDrag] = useState(null);
  const [tool, setTool] = useState("hand");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [marquee, setMarquee] = useState(null);
  const [, bump] = useState(0);

  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const saveTimerRef = useRef(null);
  const boardRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getIdeas()
      .then((data) => { if (!cancelled) setBoard(data); })
      .catch((e) => setLoadError(e.code || "UNKNOWN"));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { boardRef.current = board; }, [board]);

  useEffect(() => {
    if (!board) return;
    const id = requestAnimationFrame(() => bump((x) => x + 1));
    return () => cancelAnimationFrame(id);
  }, [board]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function wheelHandler(e) {
      e.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.pow(1.0015, -e.deltaY);
        const next = computeZoom(current, el.getBoundingClientRect(), e.clientX, e.clientY, factor);
        setBoard(next);
        saveDebounced(next);
      } else {
        const next = { ...current, view: { ...current.view, panX: current.view.panX - e.deltaX, panY: current.view.panY - e.deltaY } };
        setBoard(next);
        saveDebounced(next);
      }
    }
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
  }, []);

  function saveNow(next) {
    saveIdeas(next).then(() => setSaveError(null)).catch(() => setSaveError(true));
  }

  function saveDebounced(next) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNow(next), 500);
  }

  const MAX_HISTORY = 50;
  function recordHistory(prevBoard) {
    setPast((p) => {
      const nextPast = [...p, prevBoard];
      return nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast;
    });
    setFuture([]);
  }

  function commitAndSave(next, opts) {
    if (!opts || opts.historical !== false) recordHistory(board);
    setBoard(next);
    saveNow(next);
  }

  function undo() {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [board, ...f]);
    setEditingId(null);
    setBoard(prev);
    saveNow(prev);
  }

  function redo() {
    if (future.length === 0) return;
    const nextState = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, board]);
    setEditingId(null);
    setBoard(nextState);
    saveNow(nextState);
  }

  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (key === "z") { e.preventDefault(); undo(); }
      else if (key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board, past, future]);

  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    function onKey(e) { if (e.key === "Escape") setContextMenu(null); }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  if (loadError) {
    return <LoadError code={loadError} />;
  }
  if (!board) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></div>;
  }

  function passesFilter(node) {
    const statusKeys = Object.keys(filterStatus).filter((k) => filterStatus[k]);
    if (statusKeys.length && filterStatus[node.status] !== true) return false;
    const tagKeys = Object.keys(filterTags).filter((k) => filterTags[k]);
    if (tagKeys.length && !filterTags[node.tag || "—"]) return false;
    if (search) {
      const hay = (node.title + " " + node.desc).toLowerCase();
      if (hay.indexOf(search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function createNode(x, y) {
    const id = board.nextNodeId;
    const node = { id, title: "Ý tưởng mới", desc: "", tag: "", status: "idea", x: Math.round(x), y: Math.round(y) };
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: id + 1 };
    setEditingId(id);
    commitAndSave(next);
  }

  function handleAddClick() {
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
    const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
    createNode(cx - CARD_W / 2, cy - 40);
  }

  function handleViewportDoubleClick(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left - board.view.panX) / board.view.scale;
    const cy = (e.clientY - rect.top - board.view.panY) / board.view.scale;
    createNode(cx - CARD_W / 2, cy - 40);
  }

  function handleViewportContextMenu(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left - board.view.panX) / board.view.scale;
    const cy = (e.clientY - rect.top - board.view.panY) / board.view.scale;
    setContextMenu({
      type: "canvas",
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 60),
      canvasX: cx,
      canvasY: cy
    });
  }

  function handleCardContextMenu(e, node) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      type: "node",
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 140),
      nodeId: node.id
    });
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  function createLinkedNode(sourceId, direction) {
    const source = board.nodes.find((n) => n.id === sourceId);
    if (!source) return;
    const sourceCard = canvasRef.current.querySelector(`.idea-card[data-id="${sourceId}"]`);
    const sw = sourceCard ? sourceCard.offsetWidth : CARD_W;
    const sh = sourceCard ? sourceCard.offsetHeight : 110;
    const estH = 180;
    const GAP = 70, STEP = 60, MARGIN = 24;
    const dir = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }[direction] || [1, 0];

    function overlapsAny(px, py) {
      return board.nodes.some((n) => {
        const card = canvasRef.current.querySelector(`.idea-card[data-id="${n.id}"]`);
        const w = card ? card.offsetWidth : CARD_W, h = card ? card.offsetHeight : estH;
        return rectsOverlap(px, py, CARD_W, estH, n.x, n.y, w, h);
      });
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const view = board.view;
    const visX0 = (-view.panX + MARGIN) / view.scale;
    const visY0 = (-view.panY + MARGIN) / view.scale;
    const visX1 = (rect.width - view.panX - MARGIN) / view.scale - CARD_W;
    const visY1 = (rect.height - view.panY - MARGIN) / view.scale - estH;
    function inViewport(px, py) { return px >= visX0 && px <= visX1 && py >= visY0 && py <= visY1; }

    let x = source.x + sw / 2 - CARD_W / 2 + dir[0] * (sw / 2 + GAP + CARD_W / 2);
    let y = source.y + sh / 2 - estH / 2 + dir[1] * (sh / 2 + GAP + estH / 2);
    let placed = false;
    let attempts = 0;
    while (attempts < 10 && inViewport(x, y)) {
      if (!overlapsAny(x, y)) { placed = true; break; }
      x += dir[0] * STEP + (dir[0] === 0 ? STEP : 0);
      y += dir[1] * STEP + (dir[1] === 0 ? STEP : 0);
      attempts++;
    }

    if (!placed && visX1 >= visX0 && visY1 >= visY0) {
      search:
      for (let gy = visY0; gy <= visY1; gy += STEP) {
        for (let gx = visX0; gx <= visX1; gx += STEP) {
          if (!overlapsAny(gx, gy)) { x = gx; y = gy; placed = true; break search; }
        }
      }
    }

    let nextView = null;
    if (!placed) {
      x = source.x + sw / 2 - CARD_W / 2 + dir[0] * (sw / 2 + GAP + CARD_W / 2);
      y = source.y + sh / 2 - estH / 2 + dir[1] * (sh / 2 + GAP + estH / 2);
      attempts = 0;
      while (overlapsAny(x, y) && attempts < 30) {
        x += dir[0] * STEP + (dir[0] === 0 ? STEP : 0);
        y += dir[1] * STEP + (dir[1] === 0 ? STEP : 0);
        attempts++;
      }
      const cx = x + CARD_W / 2, cy = y + estH / 2;
      nextView = { scale: view.scale, panX: rect.width / 2 - cx * view.scale, panY: rect.height / 2 - cy * view.scale };
    }

    const id = board.nextNodeId;
    const newNode = { id, title: "Ý tưởng mới", desc: "", tag: "", status: "idea", x: Math.round(x), y: Math.round(y) };
    const next = {
      ...board,
      nodes: [...board.nodes, newNode],
      edges: [...board.edges, { id: board.nextEdgeId, from: sourceId, to: id }],
      nextNodeId: id + 1,
      nextEdgeId: board.nextEdgeId + 1,
      view: nextView || board.view
    };
    setEditingId(id);
    commitAndSave(next);
  }

  function handleConnectorMouseDown(e, node, direction) {
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetCardIdAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      const card = el && el.closest(".idea-card");
      if (!card) return null;
      const id = Number(card.getAttribute("data-id"));
      return id === node.id ? null : id;
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: node.id, x: p.x, y: p.y });
      setDropTargetId(targetCardIdAt(ev.clientX, ev.clientY));
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (dragging) {
        setLinkDraft(null);
        const targetId = targetCardIdAt(ev.clientX, ev.clientY);
        setDropTargetId(null);
        if (targetId !== null) toggleEdge(node.id, targetId);
      } else {
        createLinkedNode(node.id, direction);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function applyChipToNode(nodeId, kind, value) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (kind === "status") {
      if (node.status === value) return;
      commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, status: value } : n)) });
    } else {
      const nextTag = value === "—" ? "" : value;
      if ((node.tag || "") === nextTag) return;
      commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, tag: nextTag } : n)) });
    }
  }

  function handleChipMouseDown(e, kind, value) {
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    function targetCardIdAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      const card = el && el.closest(".idea-card");
      return card ? Number(card.getAttribute("data-id")) : null;
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setChipDrag({ kind, value, x: ev.clientX, y: ev.clientY });
      setDropTargetId(targetCardIdAt(ev.clientX, ev.clientY));
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragging) return;
      const targetId = targetCardIdAt(ev.clientX, ev.clientY);
      setChipDrag(null);
      setDropTargetId(null);
      if (targetId !== null) applyChipToNode(targetId, kind, value);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function deleteNode(id) {
    commitAndSave({
      ...board,
      nodes: board.nodes.filter((n) => n.id !== id),
      edges: board.edges.filter((e) => e.from !== id && e.to !== id)
    });
  }

  function saveNodeEdit(id, fields) {
    setEditingId(null);
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) });
  }

  function toggleEdge(a, b) {
    const existing = board.edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
    if (existing) {
      commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== existing.id) });
    } else {
      commitAndSave({ ...board, edges: [...board.edges, { id: board.nextEdgeId, from: a, to: b }], nextEdgeId: board.nextEdgeId + 1 });
    }
  }

  function handleCardClick(node) {
    if (!linkMode) return;
    if (pendingSource === null) setPendingSource(node.id);
    else if (pendingSource === node.id) setPendingSource(null);
    else { toggleEdge(pendingSource, node.id); setPendingSource(null); }
  }

  function handleNodeMouseDown(e, node) {
    if (linkMode || editingId === node.id) return;
    e.stopPropagation();

    let groupIds = [node.id];
    if (tool === "select") {
      if (selectedIds.has(node.id) && selectedIds.size > 1) {
        groupIds = Array.from(selectedIds);
      } else {
        setSelectedIds(new Set([node.id]));
      }
    }

    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const startPositions = new Map(
      groupIds.map((id) => {
        const n = board.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    let latest = board;
    let moved = false;

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
      setBoard((prev) => {
        const next = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const start = startPositions.get(n.id);
            if (!start) return n;
            return { ...n, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
          })
        };
        latest = next;
        return next;
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (moved) recordHistory(boardBeforeDrag);
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleMarqueeMouseDown(e) {
    const rect = viewportRef.current.getBoundingClientRect();
    const startScreenX = e.clientX, startScreenY = e.clientY;
    let dragging = false;
    const THRESHOLD = 4;

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startScreenX, ev.clientY - startScreenY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const a = toCanvas(startScreenX, startScreenY);
      const b = toCanvas(ev.clientX, ev.clientY);
      setMarquee({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragging) { setSelectedIds(new Set()); return; }
      setMarquee((m) => {
        if (m) {
          const hitIds = boardRef.current.nodes
            .filter((n) => {
              const card = canvasRef.current.querySelector(`.idea-card[data-id="${n.id}"]`);
              const w = card ? card.offsetWidth : CARD_W, h = card ? card.offsetHeight : 100;
              return rectsOverlap(m.x, m.y, m.w, m.h, n.x, n.y, w, h);
            })
            .map((n) => n.id);
          setSelectedIds(new Set(hitIds));
        }
        return null;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleViewportMouseDown(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    if (linkMode) { setPendingSource(null); return; }
    if (tool === "select") { handleMarqueeMouseDown(e); return; }
    setIsPanning(true);
    const startX = e.clientX, startY = e.clientY;
    const startPanX = board.view.panX, startPanY = board.view.panY;
    let latest = board;

    function onMove(ev) {
      const nx = startPanX + (ev.clientX - startX);
      const ny = startPanY + (ev.clientY - startY);
      setBoard((prev) => {
        const next = { ...prev, view: { ...prev.view, panX: nx, panY: ny } };
        latest = next;
        return next;
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setIsPanning(false);
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function zoomButton(factor) {
    const rect = viewportRef.current.getBoundingClientRect();
    const next = computeZoom(board, rect, rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    setBoard(next);
    saveDebounced(next);
  }

  function fitToView() {
    if (board.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    board.nodes.forEach((n) => {
      const card = canvasRef.current.querySelector(`.idea-card[data-id="${n.id}"]`);
      const w = card ? card.offsetWidth : CARD_W;
      const h = card ? card.offsetHeight : 120;
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    commitAndSave({
      ...board,
      view: {
        scale,
        panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
        panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
      }
    }, { historical: false });
  }

  function handleImportConfirm() {
    try {
      const parsed = JSON.parse(ioText);
      if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
      commitAndSave(parsed);
      setIoOpen(false);
    } catch (e) {
      alert("JSON không hợp lệ — kiểm tra lại nội dung đã dán.");
    }
  }

  const distinctTags = Array.from(new Set(board.nodes.map((n) => n.tag || "—")));

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <div className="eyebrow">Bản đồ ý tưởng</div>
          <h1 className="display" style={{ fontSize: 19, margin: 0 }}>Game Của Tôi</h1>
        </div>
        <Link to="/" className="btn ghost">← Trang chủ</Link>
        <button className="btn" onClick={handleAddClick}>+ Ý tưởng</button>
        <button className="btn ghost icon" onClick={undo} disabled={past.length === 0} title="Hoàn tác (Ctrl+Z)">↶</button>
        <button className="btn ghost icon" onClick={redo} disabled={future.length === 0} title="Làm lại (Ctrl+Shift+Z)">↷</button>
        <div className="tool-group">
          <button
            className={"btn ghost toggle" + (tool === "hand" ? " active" : "")}
            onClick={() => setTool("hand")}
            title="Bàn tay — giữ và kéo khoảng trống để lia sa bàn"
          >
            Bàn tay
          </button>
          <button
            className={"btn ghost toggle" + (tool === "select" ? " active" : "")}
            onClick={() => setTool("select")}
            title="Con trỏ — kéo để bôi đen chọn nhiều thẻ rồi kéo cả nhóm đi"
          >
            Con trỏ
          </button>
        </div>
        <button
          className={"btn ghost toggle" + (linkMode ? " active" : "")}
          onClick={() => { setLinkMode((v) => !v); setPendingSource(null); }}
        >
          Nối ý tưởng
        </button>
        <div className="search-box">
          <input type="text" placeholder="Tìm theo tên/mô tả…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="spacer" />
        {saveError && <span style={{ fontSize: 11, color: "var(--danger)" }}><Trans>Không lưu được lên server.</Trans></span>}
        <button className="btn ghost" onClick={() => { setIoMode("export"); setIoText(JSON.stringify(board, null, 2)); setIoOpen(true); }}>Xuất JSON</button>
        <button className="btn ghost" onClick={() => { setIoMode("import"); setIoText(""); setIoOpen(true); }}>Nhập JSON</button>
        <button className="btn ghost icon" onClick={toggleTheme} title="Đổi giao diện sáng/tối">◐</button>
      </div>

      <div className="filterbar">
        <span className="fb-label">Trạng thái</span>
        {STATUS_ORDER.map((key) => (
          <span
            key={key}
            className={"chip-toggle" + (filterStatus[key] ? " on" : "")}
            onMouseDown={(e) => handleChipMouseDown(e, "status", key)}
            onClick={() => setFilterStatus((prev) => ({ ...prev, [key]: !prev[key] }))}
            title="Bấm để lọc — kéo thả vào thẻ để gán trạng thái"
          >
            <span className="dot" style={{ background: STATUS[key].color }}></span>
            {STATUS[key].label}
          </span>
        ))}
        <span className="fb-label" style={{ marginLeft: 10 }}>Nhãn</span>
        {distinctTags.map((tag) => (
          <span
            key={tag}
            className={"chip-toggle" + (filterTags[tag] ? " on" : "")}
            style={{ marginLeft: 6 }}
            onMouseDown={(e) => handleChipMouseDown(e, "tag", tag)}
            onClick={() => setFilterTags((prev) => ({ ...prev, [tag]: !prev[tag] }))}
            title="Bấm để lọc — kéo thả vào thẻ để gán nhãn"
          >
            <span className="dot" style={{ background: hashTag(tag) }}></span>
            {tag}
          </span>
        ))}
      </div>

      <div
        className={"viewport" + (isPanning ? " panning" : "") + (tool === "select" ? " select-tool" : "")}
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onDoubleClick={handleViewportDoubleClick}
        onContextMenu={handleViewportContextMenu}
      >
        <div
          className="canvas"
          ref={canvasRef}
          style={{ transform: `translate(${board.view.panX}px, ${board.view.panY}px) scale(${board.view.scale})` }}
        >
          {marquee && (
            <div className="marquee-box" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}
          <svg className="edge-layer">
            {board.edges.map((edge) => {
              const a = board.nodes.find((n) => n.id === edge.from);
              const b = board.nodes.find((n) => n.id === edge.to);
              if (!a || !b) return null;
              const cardA = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${a.id}"]`);
              const cardB = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${b.id}"]`);
              const aw = cardA ? cardA.offsetWidth : CARD_W, ah = cardA ? cardA.offsetHeight : 100;
              const bw = cardB ? cardB.offsetWidth : CARD_W, bh = cardB ? cardB.offsetHeight : 100;
              const x1 = a.x + aw / 2, y1 = a.y + ah / 2;
              const x2 = b.x + bw / 2, y2 = b.y + bh / 2;
              return (
                <g key={edge.id}>
                  <line
                    className="hit"
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    onClick={() => commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== edge.id) })}
                  />
                  <line className="visible" x1={x1} y1={y1} x2={x2} y2={y2} />
                </g>
              );
            })}
            {linkDraft && (() => {
              const a = board.nodes.find((n) => n.id === linkDraft.fromId);
              if (!a) return null;
              const cardA = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${a.id}"]`);
              const aw = cardA ? cardA.offsetWidth : CARD_W, ah = cardA ? cardA.offsetHeight : 100;
              return <line className="draft" x1={a.x + aw / 2} y1={a.y + ah / 2} x2={linkDraft.x} y2={linkDraft.y} />;
            })()}
          </svg>

          {board.nodes.map((node) => (
            <IdeaCard
              key={node.id}
              node={node}
              editing={editingId === node.id}
              dimmed={!passesFilter(node)}
              linkPending={linkMode && pendingSource === node.id}
              dropTarget={dropTargetId === node.id}
              selected={tool === "select" && selectedIds.has(node.id)}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onClick={() => handleCardClick(node)}
              onContextMenu={(e) => handleCardContextMenu(e, node)}
              onConnectorMouseDown={(e, direction) => handleConnectorMouseDown(e, node, direction)}
              onEdit={() => setEditingId(node.id)}
              onDelete={() => deleteNode(node.id)}
              onSave={(fields) => saveNodeEdit(node.id, fields)}
              onCancel={() => setEditingId(null)}
            />
          ))}
        </div>

        {board.nodes.length === 0 && (
          <div className="empty-hint">
            Nhấp đúp vào khoảng trống để tạo ý tưởng đầu tiên.<br />
            Kéo để di chuyển sa bàn, cuộn để lia, giữ Ctrl/⌘ + cuộn để phóng to.
          </div>
        )}

        <div className="zoom-ctrl">
          <button onClick={() => zoomButton(1 / 1.2)} title="Thu nhỏ">−</button>
          <span className="pct mono">{Math.round(board.view.scale * 100)}%</span>
          <button onClick={() => zoomButton(1.2)} title="Phóng to">+</button>
          <div className="sep" />
          <button onClick={fitToView} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}>Vừa khung</button>
        </div>

        {ioOpen && (
          <div className="io-drawer">
            <div className="note">
              {ioMode === "export" ? "JSON hiện tại — copy để sao lưu hoặc gửi cho người khác xem." : "Dán JSON đã xuất trước đó, rồi bấm Nhập vào bản đồ."}
            </div>
            <textarea spellCheck={false} value={ioText} onChange={(e) => setIoText(e.target.value)} />
            <div className="io-actions">
              {ioMode === "import" && <button className="btn small" onClick={handleImportConfirm}>Nhập vào bản đồ</button>}
              <button className="btn ghost small" onClick={() => setIoOpen(false)}>Đóng</button>
            </div>
          </div>
        )}

        {contextMenu && (
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
            {contextMenu.type === "canvas" && (
              <button onClick={() => { createNode(contextMenu.canvasX - CARD_W / 2, contextMenu.canvasY - 40); setContextMenu(null); }}>
                + Thêm ý tưởng ở đây
              </button>
            )}
            {contextMenu.type === "node" && (
              <>
                <button onClick={() => { setEditingId(contextMenu.nodeId); setContextMenu(null); }}>✎ Sửa</button>
                <button onClick={() => { setLinkMode(true); setPendingSource(contextMenu.nodeId); setContextMenu(null); }}>⤳ Bắt đầu nối</button>
                <button className="danger" onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null); }}>× Xoá</button>
              </>
            )}
          </div>
        )}
      </div>

      {chipDrag && (
        <div className="chip-ghost" style={{ left: chipDrag.x, top: chipDrag.y }}>
          <span className="dot" style={{ background: chipDrag.kind === "status" ? STATUS[chipDrag.value].color : hashTag(chipDrag.value) }}></span>
          {chipDrag.kind === "status" ? STATUS[chipDrag.value].label : chipDrag.value}
        </div>
      )}

      <datalist id="tagOptions">
        {TAG_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
}

function IdeaCard({ node, editing, dimmed, linkPending, dropTarget, selected, onMouseDown, onClick, onContextMenu, onConnectorMouseDown, onEdit, onDelete, onSave, onCancel }) {
  const [title, setTitle] = useState(node.title);
  const [desc, setDesc] = useState(node.desc);
  const [tag, setTag] = useState(node.tag);
  const [status, setStatus] = useState(node.status);

  useEffect(() => {
    if (editing) {
      setTitle(node.title); setDesc(node.desc); setTag(node.tag); setStatus(node.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const classNames = ["idea-card"];
  if (dimmed) classNames.push("dim");
  if (linkPending) classNames.push("link-pending");
  if (dropTarget) classNames.push("drop-target");
  if (selected) classNames.push("selected");

  if (editing) {
    return (
      <div className={classNames.join(" ")} data-id={node.id} style={{ left: node.x, top: node.y }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="edit-form">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên ý tưởng" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả ngắn" />
          <div className="edit-row">
            <input type="text" list="tagOptions" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nhãn" />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
          </div>
          <div className="edit-actions">
            <button className="save-btn" onClick={() => onSave({ title: title.trim() || "Ý tưởng mới", desc: desc.trim(), tag: tag.trim(), status })}>Lưu</button>
            <button className="cancel-btn" onClick={onCancel}>Hủy</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames.join(" ")}
      data-id={node.id}
      style={{ left: node.x, top: node.y }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="card-actions">
        <button className="icon-btn" title="Sửa" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
        <button className="icon-btn" title="Xoá" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
      </div>
      <div className="card-top">
        <div className="title">{node.title}</div>
      </div>
      <div className="desc">{node.desc}</div>
      <div className="meta-row">
        <span className="status-pill" style={{ background: STATUS[node.status].color }}>{STATUS[node.status].label}</span>
        {node.tag && (
          <span className="tag-pill">
            <span className="dot" style={{ background: hashTag(node.tag) }}></span>
            {node.tag}
          </span>
        )}
      </div>
      <span className="connector-zone top" onMouseDown={(e) => onConnectorMouseDown(e, "top")} onClick={(e) => e.stopPropagation()} title="Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác"><span className="connector-dot">+</span></span>
      <span className="connector-zone right" onMouseDown={(e) => onConnectorMouseDown(e, "right")} onClick={(e) => e.stopPropagation()} title="Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác"><span className="connector-dot">+</span></span>
      <span className="connector-zone bottom" onMouseDown={(e) => onConnectorMouseDown(e, "bottom")} onClick={(e) => e.stopPropagation()} title="Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác"><span className="connector-dot">+</span></span>
      <span className="connector-zone left" onMouseDown={(e) => onConnectorMouseDown(e, "left")} onClick={(e) => e.stopPropagation()} title="Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác"><span className="connector-dot">+</span></span>
    </div>
  );
}
