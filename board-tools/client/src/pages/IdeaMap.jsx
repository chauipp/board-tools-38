import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { getIdeas, saveIdeas } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import { BADGE_PALETTE, colorVar, statusById, tagById } from "../lib/badges.js";
import { paletteCss, applyColorTo, removePaletteColor } from "../lib/palette.js";
import { loadLayouts, saveLayouts } from "../lib/dock.js";
import DockPanel from "../components/DockPanel.jsx";
import LoadError from "../components/LoadError.jsx";
import LocaleToggle from "../components/LocaleToggle.jsx";
import BadgeEditor from "../components/BadgeEditor.jsx";
import ColorMenu from "../components/ColorMenu.jsx";
import FrameBox from "../components/FrameBox.jsx";
import { nodesInFrame, edgeEndpoint, edgesMatch, rectForEndpoint, clipToRect } from "../lib/board-geometry.js";
import { computeSnap } from "../lib/snap.js";
import { buildOutline, outlineToMarkdown } from "../lib/outline.js";
import { gridLayout, layerLayout } from "../lib/layout.js";
import { parseDesc } from "../lib/mdlite.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence, cursorColor } from "../lib/usePresence.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";
import { compressImage } from "../lib/image-utils.js";
import { drawBoardToCanvas } from "../lib/png-export.js";
import "../styles/idea-map.css";

const CARD_W = 210;
const MIN_SCALE = 0.3, MAX_SCALE = 2.4;

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
  const { t } = useLingui();
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [linkMode, setLinkMode] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);
  const [filterStatus, setFilterStatus] = useState({});
  const [filterTags, setFilterTags] = useState({});
  const [filterFav, setFilterFav] = useState(false);
  const [search, setSearch] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState("export");
  const [ioText, setIoText] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [linkDraft, setLinkDraft] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [chipDrag, setChipDrag] = useState(null);
  // Mặc định mở Trạng thái + Nhãn để giữ đúng hành vi cũ khi mới vào; Bảng màu
  // đóng. Chỉ giữ trong state — không lưu qua reload.
  const [panels, setPanels] = useState({ status: true, tag: true, palette: false });
  const [layouts, setLayouts] = useState(() => loadLayouts(window.localStorage));
  const [paletteUI, setPaletteUI] = useState(null); // { mode: "create"|"edit", id?, hex, x, y } | null
  const [colorDrag, setColorDrag] = useState(null); // { token, x, y } | null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [marquee, setMarquee] = useState(null);
  const [snapGuides, setSnapGuides] = useState([]);
  const [badgeUI, setBadgeUI] = useState(null); // { mode: "create"|"edit", kind, def?, x, y }
  const [colorMenu, setColorMenu] = useState(null); // { kind: "card"|"group", id, x, y }
  const [edgeMenu, setEdgeMenu] = useState(null); // { id, x, y } | null
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [edgeDrag, setEdgeDrag] = useState(null); // { edgeId, end: "from"|"to", fixedKind, fixedId, x, y } | null
  const [commentsFor, setCommentsFor] = useState(null); // { id, x, y } | null
  const [editingGroupTitleId, setEditingGroupTitleId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [presentIndex, setPresentIndex] = useState(null); // null = không trình chiếu
  const [initialCardParam] = useState(() => new URLSearchParams(window.location.search).get("card"));
  const [, bump] = useState(0);

  const { user } = useAuth();
  const { peers: presencePeers, sendCursor } = usePresence(user);

  const viewportRef = useRef(null);
  const fbDockRef = useRef(null);
  const canvasRef = useRef(null);
  const saveTimerRef = useRef(null);
  const boardRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const suppressContextMenuRef = useRef(false);
  const nudgeTimerRef = useRef(null);
  const nudgeBaseRef = useRef(null);
  const spacePanRef = useRef(false);
  const pendingJumpRef = useRef(null);
  const prePresentViewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getIdeas()
      .then((data) => {
        if (cancelled) return;
        if (initialCardParam && data.nodes.some((n) => n.id === Number(initialCardParam))) {
          pendingJumpRef.current = Number(initialCardParam);
        }
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...data });
      })
      .catch((e) => setLoadError(e.code || "UNKNOWN"));
    return () => { cancelled = true; };
  }, []);

  // Kéo panel cập nhật layouts mỗi mousemove; hoãn một nhịp để không ghi
  // localStorage 60 lần/giây.
  useEffect(() => {
    const id = setTimeout(() => saveLayouts(window.localStorage, layouts), 200);
    return () => clearTimeout(id);
  }, [layouts]);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const want = selectedIds.size === 1 ? String(Array.from(selectedIds)[0]) : null;
    const have = url.searchParams.get("card");
    if (want === have) return;
    if (want != null) url.searchParams.set("card", want);
    else url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  }, [selectedIds]);

  useEffect(() => {
    if (!board || pendingJumpRef.current == null) return;
    const id = pendingJumpRef.current;
    pendingJumpRef.current = null;
    setSelectedIds(new Set([id]));
    setFlashId(id);
    zoomToNodes([id]);
    setTimeout(() => setFlashId(null), 1600);
  }, [board != null]);

  useEffect(() => {
    if (!board) return;
    const id = requestAnimationFrame(() => bump((x) => x + 1));
    return () => cancelAnimationFrame(id);
  }, [board]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function wheelHandler(e) {
      if (e.target.closest(".outline-panel, .io-drawer")) return;
      e.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      // Lăn chuột = thu phóng tại vị trí con trỏ. Giữ Shift để lia ngang/dọc
      // (hữu ích cho trackpad hoặc khi muốn cuộn thay vì zoom).
      if (e.shiftKey) {
        const next = { ...current, view: { ...current.view, panX: current.view.panX - e.deltaX, panY: current.view.panY - e.deltaY } };
        setBoard(next);
        saveDebounced(next);
      } else {
        const factor = Math.pow(1.0015, -e.deltaY);
        const next = computeZoom(current, el.getBoundingClientRect(), e.clientX, e.clientY, factor);
        setBoard(next);
        saveDebounced(next);
      }
    }
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
    // Re-chạy khi board tải xong: lúc mount đầu board còn null nên viewport
    // chưa render (return "Đang tải…"), viewportRef.current == null và listener
    // sẽ không được gắn nếu chỉ phụ thuộc [].
  }, [board != null]);

  function saveNow(next) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    saveIdeas(next).then(() => setSaveError(null)).catch(() => setSaveError(true));
  }

  function saveDebounced(next) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNow(next), 500);
  }

  const MAX_HISTORY = 50;
  function recordHistoryRaw(prevBoard) {
    setPast((p) => {
      const nextPast = [...p, prevBoard];
      return nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast;
    });
    setFuture([]);
  }

  function flushNudgeBurst() {
    if (nudgeBaseRef.current == null) return;
    const base = nudgeBaseRef.current;
    nudgeBaseRef.current = null;
    if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
    recordHistoryRaw(base);
  }

  function recordHistory(prevBoard) {
    flushNudgeBurst();
    recordHistoryRaw(prevBoard);
  }

  function commitAndSave(next, opts) {
    if (!opts || opts.historical !== false) recordHistory(board);
    setBoard(next);
    saveNow(next);
  }

  function undo() {
    if (nudgeBaseRef.current != null) {
      const base = nudgeBaseRef.current;
      nudgeBaseRef.current = null;
      if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
      setFuture((f) => [board, ...f]);
      setEditingId(null);
      setBoard(base);
      saveNow(base);
      return;
    }
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [board, ...f]);
    setEditingId(null);
    setBoard(prev);
    saveNow(prev);
  }

  function redo() {
    if (nudgeBaseRef.current != null) { flushNudgeBurst(); return; }
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
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      const key = e.key.toLowerCase();
      // Đang trình chiếu: ←/→/Esc được ưu tiên, mọi phím tắt khác tạm tắt.
      if (presentIndex != null) {
        if (key === "arrowright") { e.preventDefault(); stepPresentation(1); }
        else if (key === "arrowleft") { e.preventDefault(); stepPresentation(-1); }
        else if (key === "escape") { exitPresentation(); }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
        else if (key === "z") { e.preventDefault(); undo(); }
        else if (key === "y") { e.preventDefault(); redo(); }
        else if (key === "d") { e.preventDefault(); duplicateSelection(); }
        return;
      }
      if (key === "delete" || key === "backspace") { e.preventDefault(); deleteSelection(); }
      else if (key === "escape") {
        if (colorMenu) setColorMenu(null);
        else if (badgeUI) setBadgeUI(null);
        else if (edgeMenu) setEdgeMenu(null);
        else if (commentsFor) setCommentsFor(null);
        else if (linkMode) { setLinkMode(false); setPendingSource(null); }
        else if (focusId != null) setFocusId(null);
        else if (selectedIds.size > 0) setSelectedIds(new Set());
      }
      else if (key === "n") { e.preventDefault(); handleAddClick(); }
      else if (key === "f") { e.preventDefault(); zoomToSelection(); }
      else if (key === "arrowleft") { e.preventDefault(); nudgeSelection(e.shiftKey ? -10 : -1, 0); }
      else if (key === "arrowright") { e.preventDefault(); nudgeSelection(e.shiftKey ? 10 : 1, 0); }
      else if (key === "arrowup") { e.preventDefault(); nudgeSelection(0, e.shiftKey ? -10 : -1); }
      else if (key === "arrowdown") { e.preventDefault(); nudgeSelection(0, e.shiftKey ? 10 : 1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board, past, future, selectedIds, linkMode, colorMenu, badgeUI, edgeMenu, commentsFor, focusId, presentIndex]);

  useEffect(() => {
    function down(e) {
      if (e.code !== "Space") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      e.preventDefault();            // chặn page scroll
      spacePanRef.current = true;
    }
    function up(e) { if (e.code === "Space") spacePanRef.current = false; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Ảnh dán/thả vào thẻ: applyImageToNode phải đọc boardRef.current (không phải
  // `board`) vì nó được gọi từ compressImage().then() bên trong listener "paste"
  // gắn-một-lần (deps: []), nơi `board` luôn là giá trị đóng gói lúc mount (stale).
  // commitAndSave cũng không dùng được ở đây vì nó tự gọi recordHistory(board) —
  // cùng vấn đề đóng gói cũ; nên trình tự ghi lịch sử/lưu được lặp lại thủ công.
  function applyImageToNode(nodeId, dataUrl) {
    const current = boardRef.current;
    if (!current) return;
    if (!current.nodes.some((n) => n.id === nodeId)) return;
    const next = { ...current, nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, image: dataUrl } : n)) };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
  }

  // Cùng kỷ luật refs-only như applyImageToNode: được gọi từ listener "paste"
  // gắn-một-lần và từ .then() của compressImage.
  function createImageNode(dataUrl, pos) {
    const current = boardRef.current;
    if (!current || !viewportRef.current) return;
    let x, y;
    if (pos) {
      ({ x, y } = pos);
    } else {
      const rect = viewportRef.current.getBoundingClientRect();
      x = Math.round((rect.width / 2 - current.view.panX) / current.view.scale - CARD_W / 2);
      y = Math.round((rect.height / 2 - current.view.panY) / current.view.scale - 80);
    }
    const id = current.nextNodeId;
    const node = { id, title: t`Ảnh`, desc: "", tagId: null, statusId: null, x, y, image: dataUrl };
    const next = { ...current, nodes: [...current.nodes, node], nextNodeId: id + 1 };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
    setSelectedIds(new Set([id]));
  }

  useEffect(() => {
    function onPaste(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const current = boardRef.current;
      if (!current) return;
      const sel = selectedIdsRef.current;
      if (sel.size > 1) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      const file = item.getAsFile();
      if (sel.size === 1) compressImage(file).then((dataUrl) => applyImageToNode(Array.from(sel)[0], dataUrl)).catch(() => {});
      else compressImage(file).then((dataUrl) => createImageNode(dataUrl)).catch(() => {});
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  if (loadError) {
    return <LoadError code={loadError} />;
  }
  if (!board) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></div>;
  }

  const currentUser = user.name;

  function handlePresenceMouseMove(e) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = boardRef.current.view;
    sendCursor(
      (e.clientX - rect.left - view.panX) / view.scale,
      (e.clientY - rect.top - view.panY) / view.scale
    );
  }

  function entityAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el && el.closest(".idea-card");
    if (card) return { id: Number(card.getAttribute("data-id")), kind: "node" };
    const frame = el && el.closest(".frame-box");
    if (frame) return { id: Number(frame.getAttribute("data-group-id")), kind: "group" };
    return null;
  }

  function passesFilter(node) {
    const statusKeys = Object.keys(filterStatus).filter((k) => filterStatus[k]);
    if (statusKeys.length) {
      const key = node.statusId == null ? "none" : String(node.statusId);
      if (!filterStatus[key]) return false;
    }
    const tagKeys = Object.keys(filterTags).filter((k) => filterTags[k]);
    if (tagKeys.length) {
      const key = node.tagId == null ? "none" : String(node.tagId);
      if (!filterTags[key]) return false;
    }
    if (filterFav && !(node.favorites?.length > 0)) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = (node.title + " " + node.desc).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function computeFocusSet(rootId) {
    // BFS ≤2 hop trên edge node↔node (bỏ qua edge dính group)
    const adj = new Map();
    board.edges.forEach((e) => {
      if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from).push(e.to);
      adj.get(e.to).push(e.from);
    });
    const seen = new Set([rootId]);
    let frontier = [rootId];
    for (let hop = 0; hop < 2; hop++) {
      const nextFrontier = [];
      frontier.forEach((id) => (adj.get(id) || []).forEach((nb) => {
        if (!seen.has(nb)) { seen.add(nb); nextFrontier.push(nb); }
      }));
      frontier = nextFrontier;
    }
    return seen;
  }
  const focusSet = focusId != null && board.nodes.some((n) => n.id === focusId)
    ? computeFocusSet(focusId)
    : null;

  function createNode(x, y) {
    const id = board.nextNodeId;
    const node = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: board.statuses[0]?.id ?? null, x: Math.round(x), y: Math.round(y) };
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

  function frameCardSize(nodeId) {
    const card = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${nodeId}"]`);
    return { w: card ? card.offsetWidth : CARD_W, h: card ? card.offsetHeight : 110 };
  }

  function createGroup() {
    const rect = viewportRef.current.getBoundingClientRect();
    const w = 480, h = 320;
    const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
    const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
    const id = board.nextGroupId;
    const group = { id, title: t`Khung mới`, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, color: null };
    commitAndSave({ ...board, groups: [...board.groups, group], nextGroupId: id + 1 });
  }

  function groupSelectedCards() {
    const PAD = 28, TITLE_ROOM = 20;
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ids.forEach((id) => {
      const n = board.nodes.find((nn) => nn.id === id);
      if (!n) return;
      const { w, h } = frameCardSize(id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    if (minX === Infinity) return;
    const id = board.nextGroupId;
    const group = {
      id, title: t`Khung mới`, color: null,
      x: Math.round(minX - PAD), y: Math.round(minY - PAD - TITLE_ROOM),
      w: Math.round(maxX - minX + PAD * 2), h: Math.round(maxY - minY + PAD * 2 + TITLE_ROOM)
    };
    setColorMenu(null);
    commitAndSave({ ...board, groups: [...board.groups, group], nextGroupId: id + 1 });
  }

  function duplicateNodes(ids, offset = 24) {
    let nextId = board.nextNodeId;
    const idMap = new Map();
    const clones = [];
    ids.forEach((id) => {
      const n = board.nodes.find((nn) => nn.id === id);
      if (!n) return;
      idMap.set(id, nextId);
      const { locked, ...rest } = n;
      clones.push({ ...rest, id: nextId, x: n.x + offset, y: n.y + offset });
      nextId++;
    });
    let nextEdgeId = board.nextEdgeId;
    const clonedEdges = [];
    board.edges.forEach((e) => {
      if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
      if (idMap.has(e.from) && idMap.has(e.to)) {
        clonedEdges.push({ ...e, id: nextEdgeId++, from: idMap.get(e.from), to: idMap.get(e.to) });
      }
    });
    return {
      next: {
        ...board,
        nodes: [...board.nodes, ...clones],
        edges: [...board.edges, ...clonedEdges],
        nextNodeId: nextId,
        nextEdgeId
      },
      cloneIds: Array.from(idMap.values())
    };
  }

  function handleGroupMouseDown(e, group) {
    if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }
    if (e.button !== 0) return;
    if (group.locked) return;
    e.stopPropagation();

    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const memberIds = nodesInFrame(board.nodes, group, frameCardSize)
      .filter((id) => !board.nodes.find((n) => n.id === id)?.locked);
    const startGroupPos = { x: group.x, y: group.y };
    const startNodePositions = new Map(
      memberIds.map((id) => {
        const n = board.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    let latest = board;
    let moved = false;

    function onMove(ev) {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;

      const frameX = startGroupPos.x + dx, frameY = startGroupPos.y + dy;
      let minX = frameX, minY = frameY, maxX = frameX + group.w, maxY = frameY + group.h;
      memberIds.forEach((id) => {
        const start = startNodePositions.get(id);
        const { w, h } = frameCardSize(id);
        const nx = start.x + dx, ny = start.y + dy;
        minX = Math.min(minX, nx); minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx + w); maxY = Math.max(maxY, ny + h);
      });
      const movingRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      if (ev.altKey) {
        setSnapGuides([]);
      } else {
        const otherRects = [
          ...board.nodes.filter((n) => !startNodePositions.has(n.id)).map((n) => {
            const { w, h } = frameCardSize(n.id);
            return { x: n.x, y: n.y, w, h };
          }),
          ...board.groups.filter((g) => g.id !== group.id).map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))
        ];
        const snap = computeSnap(movingRect, otherRects, 6 / scale);
        dx += snap.dx; dy += snap.dy;
        setSnapGuides(snap.guides);
      }

      setBoard((prev) => {
        const next = {
          ...prev,
          groups: prev.groups.map((g) => (g.id === group.id
            ? { ...g, x: Math.round(startGroupPos.x + dx), y: Math.round(startGroupPos.y + dy) }
            : g)),
          nodes: prev.nodes.map((n) => {
            const start = startNodePositions.get(n.id);
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
      setSnapGuides([]);
      if (moved) recordHistory(boardBeforeDrag);
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleGroupResizeMouseDown(e, group) {
    if (group.locked) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const startW = group.w, startH = group.h;
    const MIN_W = 160, MIN_H = 120;
    let latest = board;
    let moved = false;

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
      setBoard((prev) => {
        const next = {
          ...prev,
          groups: prev.groups.map((g) => (g.id === group.id
            ? { ...g, w: Math.max(MIN_W, Math.round(startW + dx)), h: Math.max(MIN_H, Math.round(startH + dy)) }
            : g))
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

  function saveGroupTitle(groupId, title) {
    setEditingGroupTitleId(null);
    commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, title: title.trim() || t`Khung` } : g)) });
  }

  function deleteGroup(id) {
    commitAndSave({
      ...board,
      groups: board.groups.filter((g) => g.id !== id),
      edges: board.edges.filter((e) => !(
        (e.from === id && (e.fromKind || "node") === "group") ||
        (e.to === id && (e.toKind || "node") === "group")
      ))
    });
  }

  function applyGroupColor(groupId, color) {
    commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, color } : g)) });
    setColorMenu(null);
  }

  function handleViewportDoubleClick(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left - board.view.panX) / board.view.scale;
    const cy = (e.clientY - rect.top - board.view.panY) / board.view.scale;
    createNode(cx - CARD_W / 2, cy - 40);
  }

  // Suppress the browser's native context menu across the whole page, so
  // right-click is free for our own gestures (chip → badge editor, drag to
  // pan). Text inputs keep the native menu so Copy/Paste still works there.
  function handlePageContextMenu(e) {
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    e.preventDefault();
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  function createLinkedNode(sourceId, direction, base = board) {
    const source = base.nodes.find((n) => n.id === sourceId);
    if (!source) return;
    const sourceCard = canvasRef.current.querySelector(`.idea-card[data-id="${sourceId}"]`);
    const sw = sourceCard ? sourceCard.offsetWidth : CARD_W;
    const sh = sourceCard ? sourceCard.offsetHeight : 110;
    const estH = 180;
    const GAP = 70, STEP = 60, MARGIN = 24;
    const dir = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }[direction] || [1, 0];

    function overlapsAny(px, py) {
      return base.nodes.some((n) => {
        const card = canvasRef.current.querySelector(`.idea-card[data-id="${n.id}"]`);
        const w = card ? card.offsetWidth : CARD_W, h = card ? card.offsetHeight : estH;
        return rectsOverlap(px, py, CARD_W, estH, n.x, n.y, w, h);
      });
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const view = base.view;
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

    const id = base.nextNodeId;
    const newNode = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: base.statuses[0]?.id ?? null, x: Math.round(x), y: Math.round(y) };
    const next = {
      ...base,
      nodes: [...base.nodes, newNode],
      edges: [...base.edges, { id: base.nextEdgeId, from: sourceId, to: id }],
      nextNodeId: id + 1,
      nextEdgeId: base.nextEdgeId + 1,
      view: nextView || base.view
    };
    setEditingId(id);
    commitAndSave(next);
  }

  function handleConnectorMouseDown(e, node, direction) {
    if (e.button !== 0) return;
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
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.kind === "node" && t.id === node.id) return null;
      return t;
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: node.id, fromKind: "node", x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (dragging) {
        setLinkDraft(null);
        const t = targetAt(ev.clientX, ev.clientY);
        setDropTargetId(null);
        if (t) toggleEdge(node.id, "node", t.id, t.kind);
      } else {
        createLinkedNode(node.id, direction);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleGroupConnectorMouseDown(e, group) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.kind === "group" && t.id === group.id) return null;
      return t;
    }

    function onMove(ev) {
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: group.id, fromKind: "group", x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setLinkDraft(null);
      setDropTargetId(null);
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) toggleEdge(group.id, "group", t.id, t.kind);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.id === fixedId && t.kind === fixedKind) return null;
      return t;
    }

    function onMove(ev) {
      const p = toCanvas(ev.clientX, ev.clientY);
      setEdgeDrag({ edgeId: edge.id, end, fixedKind, fixedId, x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setEdgeDrag(null);
      setDropTargetId(null);
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) updateEdge(edge.id, end === "from" ? { from: t.id, fromKind: t.kind } : { to: t.id, toKind: t.kind });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function applyChipToNode(nodeId, kind, value) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const nextVal = value === "none" ? null : Number(value);
    if (kind === "status") {
      if ((node.statusId ?? null) === nextVal) return;
      commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, statusId: nextVal } : n)) });
    } else {
      if ((node.tagId ?? null) === nextVal) return;
      commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, tagId: nextVal } : n)) });
    }
  }

  function handleChipMouseDown(e, kind, value) {
    if (e.button !== 0) return;
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
      const id = targetCardIdAt(ev.clientX, ev.clientY);
      setDropTargetId(id != null ? { id, kind: "node" } : null);
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
      edges: board.edges.filter((e) => !(
        (e.from === id && (e.fromKind || "node") === "node") ||
        (e.to === id && (e.toKind || "node") === "node")
      ))
    });
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function saveNodeEdit(id, fields) {
    setEditingId(null);
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) });
  }

  function saveNodeEditAndNext(id, fields) {
    setEditingId(null);
    const edited = { ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) };
    createLinkedNode(id, "right", edited);
  }

  function handleImageDrop(e, nodeId) {
    e.preventDefault();
    e.stopPropagation();
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
    if (f) compressImage(f).then((d) => applyImageToNode(nodeId, d)).catch(() => {});
  }

  // Thả file ảnh lên chỗ trống canvas → tạo thẻ ảnh tại điểm thả (thả lên thẻ
  // có sẵn do handleImageDrop xử lý và đã stopPropagation).
  function handleViewportImageDrop(e) {
    const f = Array.from(e.dataTransfer?.files ?? []).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - board.view.panX) / board.view.scale - CARD_W / 2);
    const y = Math.round((e.clientY - rect.top - board.view.panY) / board.view.scale - 40);
    compressImage(f).then((d) => createImageNode(d, { x, y })).catch(() => {});
  }

  // Kéo góc ảnh đổi bề rộng thẻ (node.w); chiều cao ảnh theo tỉ lệ. Cùng
  // pattern với handleGroupResizeMouseDown: live update, 1 history entry lúc thả.
  function handleImageResizeMouseDown(e, node) {
    if (e.button !== 0 || node.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const startW = node.w || CARD_W;
    const MIN_W = 140, MAX_W = 560;
    let latest = board;
    let moved = false;

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      if (Math.abs(dx) > 0.5) moved = true;
      const w = Math.min(MAX_W, Math.max(MIN_W, Math.round(startW + dx)));
      setBoard((prev) => {
        const next = { ...prev, nodes: prev.nodes.map((n) => (n.id === node.id ? { ...n, w } : n)) };
        latest = next;
        return next;
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (moved) { recordHistory(boardBeforeDrag); saveNow(latest); }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function removeNodeImage(id) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== id) return n;
        const { image, ...rest } = n;
        return rest;
      })
    });
  }

  function toggleEdge(a, aKind, b, bKind) {
    const existing = board.edges.find((e) => edgesMatch(e, a, aKind, b, bKind));
    if (existing) {
      commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== existing.id) });
    } else {
      const edge = { id: board.nextEdgeId, from: a, fromKind: aKind, to: b, toKind: bKind };
      commitAndSave({ ...board, edges: [...board.edges, edge], nextEdgeId: board.nextEdgeId + 1 });
    }
  }

  function updateEdge(id, patch) {
    commitAndSave({ ...board, edges: board.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function deleteEdge(id) {
    commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== id) });
    setEdgeMenu(null);
  }

  function handleCardClick(node) {
    if (!linkMode) return;
    if (pendingSource === null) setPendingSource(node.id);
    else if (pendingSource === node.id) setPendingSource(null);
    else { toggleEdge(pendingSource, "node", node.id, "node"); setPendingSource(null); }
  }

  function handleNodeMouseDown(e, node) {
    if (linkMode || editingId === node.id) return;
    if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }
    if (e.button !== 0) return;
    e.stopPropagation();
    if (node.locked && !e.altKey) { setSelectedIds(new Set([node.id])); return; }

    const boardBeforeDrag = board;
    let dragIds, baseBoard, isAlt = false, selectedIdsBeforeDrag;

    if (e.altKey) {
      isAlt = true;
      selectedIdsBeforeDrag = selectedIds;
      const cloneSourceIds = selectedIds.has(node.id) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [node.id];
      const dup = duplicateNodes(cloneSourceIds, 0);
      setBoard(dup.next);
      boardRef.current = dup.next;
      setSelectedIds(new Set(dup.cloneIds));
      dragIds = dup.cloneIds;
      baseBoard = dup.next;
    } else {
      dragIds = [node.id];
      if (selectedIds.has(node.id) && selectedIds.size > 1) {
        dragIds = Array.from(selectedIds).filter((id) => {
          const n = board.nodes.find((nn) => nn.id === id);
          return n && !n.locked;
        });
      } else {
        setSelectedIds(new Set([node.id]));
      }
      baseBoard = board;
    }

    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const startPositions = new Map(
      dragIds.map((id) => {
        const n = baseBoard.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    let latest = baseBoard;
    let moved = false;

    function onMove(ev) {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      dragIds.forEach((id) => {
        const start = startPositions.get(id);
        const { w, h } = frameCardSize(id);
        const nx = start.x + dx, ny = start.y + dy;
        minX = Math.min(minX, nx); minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx + w); maxY = Math.max(maxY, ny + h);
      });
      const movingRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      if (ev.altKey) {
        setSnapGuides([]);
      } else {
        const otherRects = [
          ...baseBoard.nodes.filter((n) => !startPositions.has(n.id)).map((n) => {
            const { w, h } = frameCardSize(n.id);
            return { x: n.x, y: n.y, w, h };
          }),
          ...baseBoard.groups.map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))
        ];
        const snap = computeSnap(movingRect, otherRects, 6 / scale);
        dx += snap.dx; dy += snap.dy;
        setSnapGuides(snap.guides);
      }

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
      setSnapGuides([]);
      if (moved) {
        recordHistory(boardBeforeDrag);
        saveNow(latest);
      } else if (isAlt) {
        // Alt-click without drag: roll back the clone so nothing is silently duplicated.
        setBoard(boardBeforeDrag);
        boardRef.current = boardBeforeDrag;
        setSelectedIds(selectedIdsBeforeDrag);
      } else {
        saveNow(latest);
      }
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

    function hitIdsFor(m) {
      return boardRef.current.nodes
        .filter((n) => {
          const card = canvasRef.current.querySelector(`.idea-card[data-id="${n.id}"]`);
          const w = card ? card.offsetWidth : CARD_W, h = card ? card.offsetHeight : 100;
          return rectsOverlap(m.x, m.y, m.w, m.h, n.x, n.y, w, h);
        })
        .map((n) => n.id);
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startScreenX, ev.clientY - startScreenY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const a = toCanvas(startScreenX, startScreenY);
      const b = toCanvas(ev.clientX, ev.clientY);
      const m = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      setMarquee(m);
      setSelectedIds(new Set(hitIdsFor(m)));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragging) { setSelectedIds(new Set()); return; }
      setMarquee(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startPan(e) {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startPanX = board.view.panX, startPanY = board.view.panY;
    let dragging = false;
    const THRESHOLD = 4;
    let latest = board;

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) {
        dragging = true;
        setIsPanning(true);
      }
      if (!dragging) return;
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
      if (dragging) {
        setIsPanning(false);
        saveNow(latest);
        suppressContextMenuRef.current = true;
        setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleViewportMouseDown(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    if (linkMode) { setPendingSource(null); return; }
    if (e.button === 2) { startPan(e); return; }
    if (e.button !== 0) return;
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    handleMarqueeMouseDown(e);
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

  function deleteSelection() {
    const ids = selectedIds;
    if (ids.size === 0) return;
    commitAndSave({
      ...board,
      nodes: board.nodes.filter((n) => !ids.has(n.id)),
      edges: board.edges.filter((e) => !(
        (ids.has(e.from) && (e.fromKind || "node") === "node") ||
        (ids.has(e.to) && (e.toKind || "node") === "node")
      ))
    });
    setSelectedIds(new Set());
  }

  function duplicateSelection() {
    if (selectedIds.size === 0) return;
    const { next, cloneIds } = duplicateNodes(Array.from(selectedIds));
    commitAndSave(next);
    setSelectedIds(new Set(cloneIds));
  }

  function applyToSelection(patch) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, ...patch } : n))
    });
  }

  function tidySelection() {
    if (selectedIds.size < 2) return;
    const selected = board.nodes
      .filter((n) => selectedIds.has(n.id) && !n.locked)
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
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (pos.has(n.id) ? { ...n, ...pos.get(n.id) } : n))
    });
  }

  function zoomToNodes(ids) {
    if (!ids || ids.length === 0) return;
    const targets = board.nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
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

  function zoomToSelection() {
    zoomToNodes(selectedIds.size > 0 ? Array.from(selectedIds) : board.nodes.map((n) => n.id));
  }

  function jumpToCard(id) {
    setSelectedIds(new Set([id]));
    zoomToNodes([id]);
  }

  function jumpToGroup(group) {
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = group.w + pad * 2, bboxH = group.h + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    commitAndSave({
      ...board,
      view: {
        scale,
        panX: -(group.x - pad) * scale + (rect.width - bboxW * scale) / 2,
        panY: -(group.y - pad) * scale + (rect.height - bboxH * scale) / 2
      }
    }, { historical: false });
  }

  function startPresentation() {
    if (board.groups.length === 0) return;
    // Đóng mọi UI tạm thời trước khi trình chiếu — CSS chỉ ẩn được chrome cố
    // định, còn popover/modal đang mở phải đóng bằng state.
    setColorMenu(null);
    setEdgeMenu(null);
    setBadgeUI(null);
    setCommentsFor(null);
    setEditingId(null);
    setIoOpen(false);
    setCaptureOpen(false);
    prePresentViewRef.current = board.view;
    setPresentIndex(0);
    jumpToGroup(board.groups[0]);
  }

  // Đọc thẳng `presentIndex` từ state (đã nằm trong deps của effect keydown)
  // thay vì dùng setState updater: jumpToGroup tự setState + lưu, không được
  // gọi bên trong updater (side effect trong updater bị cấm).
  function stepPresentation(delta) {
    if (board.groups.length === 0) { exitPresentation(); return; }
    // Khung có thể bị xoá giữa chừng (canvas vẫn tương tác được) → kẹp lại
    // chỉ số hiện tại trước khi bước.
    const current = Math.min(presentIndex, board.groups.length - 1);
    const next = Math.min(board.groups.length - 1, Math.max(0, current + delta));
    if (next !== presentIndex) {
      setPresentIndex(next);
      jumpToGroup(board.groups[next]);
    }
  }

  function exitPresentation() {
    setPresentIndex(null);
    if (prePresentViewRef.current) {
      commitAndSave({ ...board, view: prePresentViewRef.current }, { historical: false });
      prePresentViewRef.current = null;
    }
  }

  function exportMarkdown() {
    const md = outlineToMarkdown(board, frameCardSize, { other: t`Khác`, links: t`Liên kết` });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "idea-map.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPng() {
    const styles = getComputedStyle(document.documentElement);
    const v = (name) => styles.getPropertyValue(name).trim();
    const theme = {
      bg: v("--bg"), surface: v("--surface-2"), line: v("--line"),
      ink: v("--ink"), inkDim: v("--ink-dim"), accent: v("--accent"),
      colorOf: (token) => v(`--${token}`)
    };
    const canvas = drawBoardToCanvas(board, frameCardSize, theme);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "idea-map.png"; a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function nudgeSelection(dx, dy) {
    if (selectedIds.size === 0) return;
    if (nudgeBaseRef.current == null) {
      nudgeBaseRef.current = board;   // history recorded once per burst, at burst end
    }
    const next = {
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) && !n.locked ? { ...n, x: n.x + dx, y: n.y + dy } : n))
    };
    setBoard(next);
    saveDebounced(next);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      flushNudgeBurst();
    }, 600);
  }

  function handleImportConfirm() {
    try {
      const parsed = JSON.parse(ioText);
      if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
      if (!Array.isArray(parsed.groups)) parsed.groups = [];
      if (typeof parsed.nextGroupId !== "number") parsed.nextGroupId = 1;
      commitAndSave(parsed);
      setIoOpen(false);
    } catch (e) {
      alert(t`JSON không hợp lệ — kiểm tra lại nội dung đã dán.`);
    }
  }

  function confirmCapture() {
    const titles = captureText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (titles.length === 0) { setCaptureOpen(false); return; }
    setFocusId(null);
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
    const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
    const estH = 90;
    const cols = Math.ceil(Math.sqrt(titles.length));
    const items = titles.map((_, i) => ({ id: i, w: CARD_W, h: estH }));
    const gridW = cols * (CARD_W + 24) - 24;
    const rows = Math.ceil(titles.length / cols);
    const gridH = rows * (estH + 24) - 24;
    const pos = gridLayout(items, { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) }, cols);
    let nextId = board.nextNodeId;
    const newNodes = titles.map((title, i) => ({
      id: nextId + i,
      title,
      desc: "",
      tagId: null,
      statusId: board.statuses[0]?.id ?? null,
      x: pos.get(i).x,
      y: pos.get(i).y
    }));
    commitAndSave({ ...board, nodes: [...board.nodes, ...newNodes], nextNodeId: nextId + titles.length });
    setCaptureOpen(false);
    setCaptureText("");
  }

  const hasNoStatus = board.nodes.some((n) => n.statusId == null);
  const hasNoTag = board.nodes.some((n) => n.tagId == null);
  const activeFilterCount =
    Object.values(filterStatus).filter(Boolean).length +
    Object.values(filterTags).filter(Boolean).length +
    (filterFav ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const matchCount = board.nodes.filter(passesFilter).length;

  function togglePanel(key) {
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setLayout(key, layout) {
    setLayouts((prev) => ({ ...prev, [key]: layout }));
  }

  const hasDockedPanel = Object.keys(layouts).some((k) => panels[k] && !layouts[k].free);

  function clearFilters() {
    setFilterStatus({});
    setFilterTags({});
    setFilterFav(false);
    setSearch("");
  }

  function openBadgeMenu(e, kind, def) {
    e.preventDefault();
    e.stopPropagation();
    setBadgeUI({ mode: "edit", kind, def, x: e.clientX, y: e.clientY });
  }

  function openColorMenu(e, kind, id) {
    e.preventDefault();
    e.stopPropagation();
    if (suppressContextMenuRef.current) { suppressContextMenuRef.current = false; return; }
    setEdgeMenu(null);
    setCommentsFor(null);
    setColorMenu({ kind, id, x: e.clientX, y: e.clientY });
  }

  function applyNodeColor(nodeId, color) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)) });
    setColorMenu(null);
  }

  function toggleNodeLock(id) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, locked: !n.locked } : n)) });
    setColorMenu(null);
  }
  function toggleGroupLock(id) {
    commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g)) });
    setColorMenu(null);
  }

  function toggleFavorite(nodeId) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const favs = n.favorites ?? [];
        return { ...n, favorites: favs.includes(currentUser) ? favs.filter((f) => f !== currentUser) : [...favs, currentUser] };
      })
    });
  }

  function addComment(nodeId, text) {
    if (!text.trim()) return false;
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: [...(n.comments ?? []), { text: text.trim(), author: currentUser, at: new Date().toISOString() }] }
        : n))
    });
    return true;
  }

  function deleteComment(nodeId, index) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: (n.comments ?? []).filter((_, i) => i !== index) }
        : n))
    });
  }

  function openBadgeCreate(e, kind) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setBadgeUI({ mode: "create", kind, x: r.left, y: r.bottom + 4 });
  }

  function createBadge(kind, name, color) {
    if (kind === "status") {
      const id = board.nextStatusId;
      commitAndSave({ ...board, statuses: [...board.statuses, { id, name, color }], nextStatusId: id + 1 });
    } else {
      const id = board.nextTagId;
      commitAndSave({ ...board, tags: [...board.tags, { id, name, color }], nextTagId: id + 1 });
    }
    setBadgeUI(null);
  }

  function updateBadge(kind, id, name, color) {
    if (kind === "status") {
      commitAndSave({ ...board, statuses: board.statuses.map((s) => (s.id === id ? { ...s, name, color } : s)) });
    } else {
      commitAndSave({ ...board, tags: board.tags.map((tg) => (tg.id === id ? { ...tg, name, color } : tg)) });
    }
    setBadgeUI(null);
  }

  function deleteBadge(kind, id) {
    if (kind === "status") {
      commitAndSave({
        ...board,
        statuses: board.statuses.filter((s) => s.id !== id),
        nodes: board.nodes.map((n) => (n.statusId === id ? { ...n, statusId: null } : n))
      });
      setFilterStatus((prev) => { const next = { ...prev }; delete next[String(id)]; return next; });
    } else {
      commitAndSave({
        ...board,
        tags: board.tags.filter((tg) => tg.id !== id),
        nodes: board.nodes.map((n) => (n.tagId === id ? { ...n, tagId: null } : n))
      });
      setFilterTags((prev) => { const next = { ...prev }; delete next[String(id)]; return next; });
    }
    setBadgeUI(null);
  }

  function openPaletteEditor(e, entry) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setPaletteUI(entry
      ? { mode: "edit", id: entry.id, hex: entry.hex, x: r.left, y: r.bottom + 6 }
      : { mode: "create", hex: "#888888", x: r.left, y: r.bottom + 6 });
  }

  function createPaletteColor(hex) {
    const id = board.nextPaletteId;
    commitAndSave({ ...board, palette: [...board.palette, { id, hex }], nextPaletteId: id + 1 });
    setPaletteUI(null);
  }

  // Popover ở lại sau khi đổi màu: sửa xong còn có thể chọn lại hoặc xoá luôn.
  function updatePaletteColor(id, hex) {
    commitAndSave({ ...board, palette: board.palette.map((c) => (c.id === id ? { ...c, hex } : c)) });
  }

  function deletePaletteColor(id) {
    commitAndSave(removePaletteColor(board, id));
    setPaletteUI(null);
  }

  function handleColorMouseDown(e, token) {
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    // Badge phải kiểm TRƯỚC thẻ: .status-pill nằm bên trong .idea-card, nếu xét
    // thẻ trước thì thả vào pill sẽ tô thẻ chứ không đổi màu badge.
    function colorTargetAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const badge = el.closest("[data-badge-kind][data-badge-id]");
      if (badge) return { kind: badge.getAttribute("data-badge-kind"), id: Number(badge.getAttribute("data-badge-id")) };
      const card = el.closest(".idea-card[data-id]");
      if (card) return { kind: "node", id: Number(card.getAttribute("data-id")) };
      const edge = el.closest("[data-edge-id]");
      if (edge) return { kind: "edge", id: Number(edge.getAttribute("data-edge-id")) };
      return null;
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setColorDrag({ token, x: ev.clientX, y: ev.clientY });
      const target = colorTargetAt(ev.clientX, ev.clientY);
      setDropTargetId(target && target.kind === "node" ? { id: target.id, kind: "node" } : null);
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragging) return;
      const target = colorTargetAt(ev.clientX, ev.clientY);
      setColorDrag(null);
      setDropTargetId(null);
      if (target) commitAndSave(applyColorTo(board, target, token));
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className={"shell" + (presentIndex != null ? " presenting" : "")} onContextMenu={handlePageContextMenu}>
      {/* Khai báo màu tự tạo trong cây React: sửa hex là mọi card/dây/badge dùng
          var(--pal-N) repaint ngay, không cần đi ghi lại từng chỗ tham chiếu. */}
      <style>{paletteCss(board.palette)}</style>
      <div className="topbar">
        <div>
          <div className="eyebrow"><Trans>Bản đồ ý tưởng</Trans></div>
          <h1 className="display" style={{ fontSize: 19, margin: 0 }}><Trans>Game Của Tôi</Trans></h1>
        </div>
        <Link to="/" className="btn ghost"><Trans>← Trang chủ</Trans></Link>
        <button className="btn" onClick={handleAddClick}><Trans>+ Ý tưởng</Trans></button>
        <button className="btn ghost" onClick={createGroup}><Trans>+ Khung</Trans></button>
        <button className="btn ghost" onClick={() => setCaptureOpen(true)}><Trans>Nhập nhanh</Trans></button>
        <button className="btn ghost icon" onClick={undo} disabled={past.length === 0} title={t`Hoàn tác (Ctrl+Z)`}>↶</button>
        <button className="btn ghost icon" onClick={redo} disabled={future.length === 0} title={t`Làm lại (Ctrl+Shift+Z)`}>↷</button>
        <button
          className={"btn ghost toggle" + (linkMode ? " active" : "")}
          onClick={() => { setLinkMode((v) => !v); setPendingSource(null); }}
        >
          <Trans>Nối ý tưởng</Trans>
        </button>
        <div className="search-box">
          <input type="text" placeholder={t`Tìm theo tên/mô tả…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="spacer" />
        {saveError && <span style={{ fontSize: 11, color: "var(--danger)" }}><Trans>Không lưu được lên server.</Trans></span>}
        <button className="btn ghost" onClick={() => { setIoMode("export"); setIoText(JSON.stringify(board, null, 2)); setIoOpen(true); }}><Trans>Xuất JSON</Trans></button>
        <button className="btn ghost" onClick={() => { setIoMode("import"); setIoText(""); setIoOpen(true); }}><Trans>Nhập JSON</Trans></button>
        <button className="btn ghost" disabled={board.groups.length === 0} onClick={startPresentation}><Trans>Trình chiếu</Trans></button>
        <button className={"btn ghost toggle" + (outlineOpen ? " active" : "")} onClick={() => setOutlineOpen((v) => !v)}><Trans>Mục lục</Trans></button>
        <LocaleToggle />
        <button className="btn ghost icon" onClick={toggleTheme} title={t`Đổi giao diện sáng/tối`}>◐</button>
      </div>

      <div className="filterbar">
        <div className="fb-tabs">
          <button className={"btn ghost toggle" + (panels.status ? " active" : "")} onClick={() => togglePanel("status")}><Trans>Trạng thái</Trans></button>
          <button className={"btn ghost toggle" + (panels.tag ? " active" : "")} onClick={() => togglePanel("tag")}><Trans>Nhãn</Trans></button>
          <button className={"btn ghost toggle" + (panels.palette ? " active" : "")} onClick={() => togglePanel("palette")}><Trans>Bảng màu</Trans></button>
          <span
            className={"chip-toggle" + (filterFav ? " on" : "")}
            onClick={() => setFilterFav((v) => !v)}
          >
            ★ <Trans>Yêu thích</Trans>
          </span>
          <div className="spacer" />
          {activeFilterCount > 0 && (
            <div className="fb-tail">
              <span className="fb-count mono" title={t`Số ý tưởng khớp bộ lọc`}>
                <Trans>Khớp {matchCount}/{board.nodes.length}</Trans>
              </span>
              <button className="fb-clear" onClick={clearFilters}><Trans>Xoá lọc</Trans></button>
            </div>
          )}
        </div>

        {/* Khay neo: LUÔN hiện, kể cả rỗng, và chính nó là vùng thả. Panel neo chảy
            cùng một hàng, hết chỗ mới xuống dòng — bật panel thứ ba không được đẩy
            hai panel kia thành ba tầng. Giữ chỗ cả khi rỗng để panel vừa bật lên
            luôn có dải riêng của nó, không bị panel nổi đậu đè lên che mất. */}
        <div className={"fb-dock" + (hasDockedPanel ? " on" : "")} ref={fbDockRef}>
        {panels.status && (
          <DockPanel title={t`Trạng thái`} layout={layouts.status} barRef={fbDockRef} onLayout={(l) => setLayout("status", l)}>
            <div className="fb-chips">
              {board.statuses.map((s) => {
                const key = String(s.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle status" + (filterStatus[key] ? " on" : "")}
                    data-badge-kind="status"
                    data-badge-id={s.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "status", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "status", s)}
                    onClick={() => setFilterStatus((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán trạng thái — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(s.color) }}></span>
                    {s.name}
                  </span>
                );
              })}
              {hasNoStatus && (
                <span
                  className={"chip-toggle status" + (filterStatus["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "status", "none")}
                  onClick={() => setFilterStatus((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa có trạng thái`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không trạng thái</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "status")} title={t`Thêm trạng thái`}>+</button>
            </div>
          </DockPanel>
        )}

        {panels.tag && (
          <DockPanel title={t`Nhãn`} layout={layouts.tag} barRef={fbDockRef} onLayout={(l) => setLayout("tag", l)}>
            <div className="fb-chips">
              {board.tags.map((tg) => {
                const key = String(tg.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle tag" + (filterTags[key] ? " on" : "")}
                    data-badge-kind="tag"
                    data-badge-id={tg.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "tag", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "tag", tg)}
                    onClick={() => setFilterTags((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán nhãn — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(tg.color) }}></span>
                    {tg.name}
                  </span>
                );
              })}
              {hasNoTag && (
                <span
                  className={"chip-toggle tag" + (filterTags["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "tag", "none")}
                  onClick={() => setFilterTags((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa gắn nhãn`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không nhãn</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "tag")} title={t`Thêm nhãn`}>+</button>
            </div>
          </DockPanel>
        )}

        {panels.palette && (
          <DockPanel title={t`Bảng màu`} layout={layouts.palette} barRef={fbDockRef} onLayout={(l) => setLayout("palette", l)}>
            <div className="fb-chips">
              {board.palette.map((c) => (
                <button
                  key={c.id}
                  className="pal-swatch"
                  style={{ background: colorVar(`pal-${c.id}`) }}
                  onMouseDown={(e) => handleColorMouseDown(e, `pal-${c.id}`)}
                  onClick={(e) => openPaletteEditor(e, c)}
                  title={t`Bấm để sửa màu — kéo thả vào thẻ / dây / badge để tô màu`}
                />
              ))}
              <button className="fb-add" onClick={(e) => openPaletteEditor(e, null)} title={t`Thêm màu`}>+</button>
            </div>
            {board.palette.length === 0 && (
              <span className="fb-count"><Trans>Chưa có màu nào — bấm + để tạo.</Trans></span>
            )}
          </DockPanel>
        )}
        </div>
      </div>

      <div
        className={"viewport" + (isPanning ? " panning" : "")}
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onDoubleClick={handleViewportDoubleClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleViewportImageDrop}
        onMouseMove={handlePresenceMouseMove}
      >
        <div
          className="canvas"
          ref={canvasRef}
          style={{ transform: `translate(${board.view.panX}px, ${board.view.panY}px) scale(${board.view.scale})` }}
        >
          {marquee && (
            <div className="marquee-box" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}
          {board.groups.map((group) => (
            <FrameBox
              key={group.id}
              group={group}
              editingTitle={editingGroupTitleId === group.id}
              onMouseDown={(e) => handleGroupMouseDown(e, group)}
              onResizeMouseDown={(e) => handleGroupResizeMouseDown(e, group)}
              onContextMenu={(e) => openColorMenu(e, "group", group.id)}
              onTitleDoubleClick={() => setEditingGroupTitleId(group.id)}
              onTitleSave={(title) => saveGroupTitle(group.id, title)}
              onTitleCancel={() => setEditingGroupTitleId(null)}
              onDelete={() => deleteGroup(group.id)}
              onConnectorMouseDown={(e) => handleGroupConnectorMouseDown(e, group)}
              dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
            />
          ))}
          <svg className="edge-layer">
            <defs>
              <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {board.edges.map((edge) => {
              if (edgeDrag && edgeDrag.edgeId === edge.id) return null;
              const r1 = rectForEndpoint(edge.fromKind || "node", edge.from, board.nodes, board.groups, frameCardSize);
              const r2 = rectForEndpoint(edge.toKind || "node", edge.to, board.nodes, board.groups, frameCardSize);
              if (!r1 || !r2) return null;
              const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
              const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
              const hot = hoveredEdgeId === edge.id;
              return (
                <g
                  key={edge.id}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId((id) => (id === edge.id ? null : id))}
                >
                  <line
                    className="hit"
                    data-edge-id={edge.id}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    onClick={(e) => { setColorMenu(null); setCommentsFor(null); setEdgeMenu({ id: edge.id, x: e.clientX, y: e.clientY }); }}
                  />
                  <line
                    className={"visible" + (hot ? " hot" : "")}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    style={edge.color ? { stroke: colorVar(edge.color) } : undefined}
                    strokeDasharray={edge.style === "dashed" ? "6 5" : undefined}
                    markerEnd={edge.arrow === "none" ? undefined : "url(#edge-arrow)"}
                  />
                  {edge.label && (
                    <text className="edge-label" x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 4} textAnchor="middle">{edge.label}</text>
                  )}
                </g>
              );
            })}
            {snapGuides.map((g, i) => (g.axis === "v"
              ? <line key={i} className="snap-guide" x1={g.pos} y1={g.start} x2={g.pos} y2={g.end} />
              : <line key={i} className="snap-guide" x1={g.start} y1={g.pos} x2={g.end} y2={g.pos} />))}
            {linkDraft && (() => {
              const from = edgeEndpoint(linkDraft.fromKind || "node", linkDraft.fromId, board.nodes, board.groups, frameCardSize);
              if (!from) return null;
              return <line className="draft" x1={from.x} y1={from.y} x2={linkDraft.x} y2={linkDraft.y} />;
            })()}
            {edgeDrag && (() => {
              const fixed = edgeEndpoint(edgeDrag.fixedKind, edgeDrag.fixedId, board.nodes, board.groups, frameCardSize);
              if (!fixed) return null;
              return <line className="draft" x1={fixed.x} y1={fixed.y} x2={edgeDrag.x} y2={edgeDrag.y} />;
            })()}
          </svg>

          {board.nodes.map((node) => (
            <IdeaCard
              key={node.id}
              node={node}
              board={board}
              currentUser={currentUser}
              editing={editingId === node.id}
              dimmed={(!passesFilter(node) || (focusSet != null && !focusSet.has(node.id))) && editingId !== node.id}
              linkPending={linkMode && pendingSource === node.id}
              dropTarget={!!dropTargetId && dropTargetId.kind === "node" && dropTargetId.id === node.id}
              selected={selectedIds.has(node.id)}
              flash={flashId === node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onClick={() => handleCardClick(node)}
              onContextMenu={(e) => openColorMenu(e, "card", node.id)}
              onConnectorMouseDown={(e, direction) => handleConnectorMouseDown(e, node, direction)}
              onEdit={() => setEditingId(node.id)}
              onDelete={() => deleteNode(node.id)}
              onToggleFavorite={() => toggleFavorite(node.id)}
              onOpenComments={(e) => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id: node.id, x: e.clientX, y: e.clientY }); }}
              onSave={(fields) => saveNodeEdit(node.id, fields)}
              onSaveAndNext={(fields) => saveNodeEditAndNext(node.id, fields)}
              onCancel={() => setEditingId(null)}
              onDropImage={(e) => handleImageDrop(e, node.id)}
              onRemoveImage={() => removeNodeImage(node.id)}
              onImageResize={(e) => handleImageResizeMouseDown(e, node)}
            />
          ))}

          {Array.from(presencePeers.values()).map((peer) => (
            <div
              key={peer.socketId}
              className="peer-cursor"
              style={{ left: peer.x, top: peer.y, "--peer-color": cursorColor(peer.email) }}
            >
              <svg viewBox="0 0 20 20" width="16" height="16">
                <path d="M2 2 L18 9 L10 11 L8 18 Z" fill="var(--peer-color)" stroke="var(--bg)" strokeWidth="1" />
              </svg>
              <span className="peer-cursor-label" style={{ background: "var(--peer-color)" }}>{peer.name}</span>
            </div>
          ))}

          {/* Tay cầm nổi trên cùng, tách khỏi .edge-layer: đầu dây thường trùng
              đúng chỗ connector-zone của thẻ (cả hai đều ở tâm cạnh), và thẻ
              luôn vẽ sau .edge-layer nên connector-zone sẽ che tay cầm nếu để
              chung lớp — chuột sẽ trúng connector-zone thay vì tay cầm. */}
          {hoveredEdgeId != null && !edgeDrag && (() => {
            const edge = board.edges.find((e) => e.id === hoveredEdgeId);
            if (!edge) return null;
            const r1 = rectForEndpoint(edge.fromKind || "node", edge.from, board.nodes, board.groups, frameCardSize);
            const r2 = rectForEndpoint(edge.toKind || "node", edge.to, board.nodes, board.groups, frameCardSize);
            if (!r1 || !r2) return null;
            const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
            const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
            return (
              <svg
                className="edge-handle-layer"
                onMouseLeave={() => setHoveredEdgeId((id) => (id === edge.id ? null : id))}
              >
                <circle
                  className="edge-handle" cx={p1.x} cy={p1.y} r={6}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "from")}
                />
                <circle
                  className="edge-handle" cx={p2.x} cy={p2.y} r={6}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "to")}
                />
              </svg>
            );
          })()}
        </div>

        {board.nodes.length === 0 && (
          <div className="empty-hint">
            <Trans>Nhấp đúp vào khoảng trống để tạo ý tưởng đầu tiên.</Trans><br />
            <Trans>Chuột trái kéo để bôi đen chọn thẻ, chuột phải kéo để lia sa bàn, cuộn để lia, giữ Ctrl/⌘ + cuộn để phóng to.</Trans>
          </div>
        )}

        {focusSet != null && (
          <div className="focus-banner">
            <Trans>Đang tập trung — Esc để thoát</Trans>
            <button onClick={() => setFocusId(null)}>×</button>
          </div>
        )}

        <div className="zoom-ctrl">
          <button onClick={() => zoomButton(1 / 1.2)} title={t`Thu nhỏ`}>−</button>
          <span className="pct mono">{Math.round(board.view.scale * 100)}%</span>
          <button onClick={() => zoomButton(1.2)} title={t`Phóng to`}>+</button>
          <div className="sep" />
          <button onClick={fitToView} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}><Trans>Vừa khung</Trans></button>
        </div>

        {outlineOpen && (() => {
          const outline = buildOutline(board, frameCardSize);
          const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
          const row = (id) => {
            const n = nodeById.get(id);
            if (!n) return null;
            const s = statusById(board, n.statusId);
            return (
              <button key={id} className="op-row" onClick={() => jumpToCard(id)}>
                <span className="dot" style={{ background: s ? colorVar(s.color) : "transparent" }}></span>
                <span className="op-title">{n.title}</span>
              </button>
            );
          };
          return (
            <div className="outline-panel" onMouseDown={(e) => e.stopPropagation()}>
              <div className="op-head">
                <span className="op-count mono">{board.nodes.length}</span>
                <button className="btn ghost small" onClick={exportMarkdown}><Trans>Xuất MD</Trans></button>
                <button className="btn ghost small" onClick={exportPng}><Trans>Xuất PNG</Trans></button>
                <button className="op-close" onClick={() => setOutlineOpen(false)}>×</button>
              </div>
              <div className="op-body">
                {outline.frames.map(({ group, nodeIds }) => (
                  <div key={"g" + group.id} className="op-section">
                    <button className="op-section-title" onClick={() => jumpToGroup(group)}>
                      {group.title} <span className="mono op-n">{nodeIds.length}</span>
                    </button>
                    {nodeIds.map(row)}
                  </div>
                ))}
                {Array.from(outline.byStatus.entries()).map(([key, ids]) => (
                  <div key={"s" + key} className="op-section">
                    <div className="op-section-title static">
                      {key === "none" ? t`Khác` : (statusById(board, key)?.name ?? t`Khác`)}
                      {" "}<span className="mono op-n">{ids.length}</span>
                    </div>
                    {ids.map(row)}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {selectedIds.size >= 2 && (
          <div className="bulk-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="bb-count mono"><Trans>{selectedIds.size} thẻ</Trans></span>
            <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ statusId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
              <option value="">{t`Trạng thái…`}</option>
              <option value="none">{t`Không trạng thái`}</option>
              {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ tagId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
              <option value="">{t`Nhãn…`}</option>
              <option value="none">{t`Không nhãn`}</option>
              {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </select>
            <div className="bb-swatches">
              <button className="be-swatch dot-empty" onClick={() => applyToSelection({ color: null })} title={t`Không màu`} />
              {BADGE_PALETTE.map((token) => (
                <button key={token} className="be-swatch" style={{ background: colorVar(token) }} onClick={() => applyToSelection({ color: token })} title={token} />
              ))}
            </div>
            <button className="bb-clear" onClick={groupSelectedCards}><Trans>Gom nhóm</Trans></button>
            <button className="bb-clear" onClick={tidySelection}><Trans>Xếp gọn</Trans></button>
            <button className="bb-clear" onClick={duplicateSelection}><Trans>Nhân bản</Trans></button>
            <button className="bb-clear danger" onClick={deleteSelection}><Trans>Xoá</Trans></button>
            <span className="bb-sep" />
            <button className="bb-clear" onClick={() => setSelectedIds(new Set())}><Trans>Bỏ chọn</Trans></button>
          </div>
        )}

        {ioOpen && (
          <div className="io-drawer">
            <div className="note">
              {ioMode === "export"
                ? <Trans>JSON hiện tại — copy để sao lưu hoặc gửi cho người khác xem.</Trans>
                : <Trans>Dán JSON đã xuất trước đó, rồi bấm Nhập vào bản đồ.</Trans>}
            </div>
            <textarea spellCheck={false} value={ioText} onChange={(e) => setIoText(e.target.value)} />
            <div className="io-actions">
              {ioMode === "import" && <button className="btn small" onClick={handleImportConfirm}><Trans>Nhập vào bản đồ</Trans></button>}
              <button className="btn ghost small" onClick={() => setIoOpen(false)}><Trans>Đóng</Trans></button>
            </div>
          </div>
        )}

      </div>

      {presentIndex != null && (() => {
        // Khung có thể bị xoá trong lúc trình chiếu → kẹp chỉ số khi render;
        // nếu xoá hết khung vẫn giữ thanh (0/0) để nút thoát × còn bấm được
        // (bên cạnh Esc).
        const idx = Math.min(presentIndex, Math.max(0, board.groups.length - 1));
        const group = board.groups[idx];
        return (
          <div className="present-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="pb-step mono">{group ? `${idx + 1}/${board.groups.length}` : "0/0"}</span>
            {group && <span className="pb-title">{group.title}</span>}
            <button className="pb-exit" onClick={exitPresentation}>×</button>
          </div>
        );
      })()}

      {chipDrag && (
        <div className="chip-ghost" style={{ left: chipDrag.x, top: chipDrag.y }}>
          {(() => {
            const def = chipDrag.value === "none"
              ? null
              : (chipDrag.kind === "status" ? statusById(board, Number(chipDrag.value)) : tagById(board, Number(chipDrag.value)));
            return (
              <>
                <span className="dot" style={{ background: def ? colorVar(def.color) : "transparent" }}></span>
                {def ? def.name : (chipDrag.kind === "status" ? t`Không trạng thái` : t`Không nhãn`)}
              </>
            );
          })()}
        </div>
      )}

      {colorDrag && (
        <div className="chip-ghost" style={{ left: colorDrag.x, top: colorDrag.y }}>
          <span className="dot" style={{ background: colorVar(colorDrag.token) }}></span>
        </div>
      )}

      {colorMenu && colorMenu.kind === "card" && (() => {
        const node = board.nodes.find((n) => n.id === colorMenu.id);
        if (!node) return null;
        // Chuột phải vào thẻ đang nằm trong vùng chọn thì tác động lên cả vùng chọn.
        // Trước đây nó chỉ đổi đúng một thẻ, im lặng — chọn 5 thẻ rồi bấm màu là ra
        // một thẻ đổi màu. Lúc đó chỉ hiện những việc có nghĩa với nhiều thẻ.
        const multi = selectedIds.size > 1 && selectedIds.has(node.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            count={multi ? selectedIds.size : 1}
            color={multi ? null : node.color ?? null}
            onPick={(color) => (multi ? applyToSelection({ color }) : applyNodeColor(node.id, color))}
            onEdit={one(() => { setColorMenu(null); setEditingId(node.id); })}
            onGroup={multi ? groupSelectedCards : undefined}
            onTidy={multi ? () => { setColorMenu(null); tidySelection(); } : undefined}
            onFocus={one(() => { setColorMenu(null); setFocusId(node.id); })}
            onDuplicate={() => {
              setColorMenu(null);
              if (multi) return duplicateSelection();
              const { next, cloneIds } = duplicateNodes([node.id]);
              commitAndSave(next);
              setSelectedIds(new Set(cloneIds));
            }}
            onComments={one(() => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id: node.id, x: colorMenu.x, y: colorMenu.y }); })}
            onCopyLink={one(() => {
              const url = new URL(window.location.href);
              url.searchParams.set("card", String(node.id));
              navigator.clipboard.writeText(url.toString());
              setColorMenu(null);
            })}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteNode(node.id); }}
            onClose={() => setColorMenu(null)}
            locked={node.locked ?? false}
            onToggleLock={one(() => toggleNodeLock(node.id))}
          />
        );
      })()}

      {colorMenu && colorMenu.kind === "group" && (() => {
        const group = board.groups.find((g) => g.id === colorMenu.id);
        if (!group) return null;
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            color={group.color ?? null}
            onPick={(color) => applyGroupColor(group.id, color)}
            onClose={() => setColorMenu(null)}
            locked={group.locked ?? false}
            onToggleLock={() => toggleGroupLock(group.id)}
          />
        );
      })()}

      {badgeUI && badgeUI.mode === "create" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName=""
          initialColor={BADGE_PALETTE[0]}
          submitLabel={t`Tạo`}
          onSubmit={(name, color) => createBadge(badgeUI.kind, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
      {badgeUI && badgeUI.mode === "edit" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName={badgeUI.def.name}
          initialColor={badgeUI.def.color}
          submitLabel={t`Lưu`}
          onDelete={() => deleteBadge(badgeUI.kind, badgeUI.def.id)}
          onSubmit={(name, color) => updateBadge(badgeUI.kind, badgeUI.def.id, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}

      {paletteUI && (
        <PaletteEditor
          key={paletteUI.mode + "-" + (paletteUI.id ?? "new")}
          x={paletteUI.x}
          y={paletteUI.y}
          hex={paletteUI.hex}
          onPick={(hex) => (paletteUI.mode === "create" ? createPaletteColor(hex) : updatePaletteColor(paletteUI.id, hex))}
          onDelete={paletteUI.mode === "edit" ? () => deletePaletteColor(paletteUI.id) : undefined}
          onClose={() => setPaletteUI(null)}
        />
      )}

      {edgeMenu && (() => {
        const edge = board.edges.find((e) => e.id === edgeMenu.id);
        if (!edge) return null;
        return (
          <EdgeMenu
            key={edge.id}
            x={edgeMenu.x} y={edgeMenu.y}
            edge={edge}
            onStyleToggle={() => updateEdge(edge.id, { style: (edge.style === "dashed" ? "solid" : "dashed") })}
            onArrowToggle={() => updateEdge(edge.id, { arrow: edge.arrow === "none" ? undefined : "none" })}
            onReverse={() => updateEdge(edge.id, { from: edge.to, fromKind: edge.toKind, to: edge.from, toKind: edge.fromKind })}
            onLabel={(label) => updateEdge(edge.id, { label: label.trim() || undefined })}
            onColorChange={(color) => updateEdge(edge.id, { color: color || undefined })}
            onDelete={() => deleteEdge(edge.id)}
            onClose={() => setEdgeMenu(null)}
          />
        );
      })()}

      {commentsFor && (() => {
        const node = board.nodes.find((n) => n.id === commentsFor.id);
        if (!node) return null;
        return (
          <CommentsPopover
            key={node.id}
            x={commentsFor.x} y={commentsFor.y}
            comments={node.comments ?? []}
            onAdd={(text) => addComment(node.id, text)}
            onDelete={(index) => deleteComment(node.id, index)}
            onClose={() => setCommentsFor(null)}
          />
        );
      })()}

      {captureOpen && (
        <div className="capture-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCaptureOpen(false); }}>
          <div
            className="capture-modal"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.stopPropagation(); setCaptureOpen(false); }
            }}
          >
            <div className="cm-note"><Trans>Mỗi dòng một ý tưởng — xác nhận để tạo hàng loạt thẻ.</Trans></div>
            <textarea
              autoFocus
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); confirmCapture(); }
              }}
              placeholder={t`Ý tưởng 1\nÝ tưởng 2\n…`}
            />
            <div className="cm-actions">
              <button className="btn small" onClick={confirmCapture}><Trans>Tạo thẻ</Trans></button>
              <button className="btn ghost small" onClick={() => setCaptureOpen(false)}><Trans>Hủy</Trans></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MdLite({ text }) {
  const blocks = parseDesc(text);
  const renderInline = (tokens) => tokens.map((tk, i) => {
    if (tk.type === "bold") return <strong key={i}>{tk.value}</strong>;
    if (tk.type === "link") {
      return (
        <a key={i} href={tk.value} target="_blank" rel="noopener noreferrer"
           onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {tk.value}
        </a>
      );
    }
    return tk.value;
  });
  return (
    <>
      {blocks.map((b, i) => b.type === "bullet"
        ? <div key={i} className="md-bullet">{renderInline(b.inline)}</div>
        : <div key={i}>{renderInline(b.inline)}</div>)}
    </>
  );
}

function LineSolidIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function LineDashedIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" /></svg>;
}
function LineUndirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3" cy="6" r="1.8" fill="currentColor" />
      <circle cx="17" cy="6" r="1.8" fill="currentColor" />
    </svg>
  );
}
function LineDirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2l5 4-5 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReverseIcon() {
  return (
    <svg viewBox="0 0 20 16" width="20" height="16">
      <path d="M2 5h13M11 2l3 3-3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 11H5M9 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaletteEditor({ x, y, hex, onPick, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const inputRef = useRef(null);
  useCloseOnOutside(ref, onClose);

  // Listener "change" thật, không dùng onChange của React: React map onChange
  // của input màu sang sự kiện "input", tức là mỗi bước kéo trong bộ chọn màu
  // thành một entry undo + một lần lưu. "change" chỉ nổ một lần khi chốt màu.
  useEffect(() => {
    const el = inputRef.current;
    const handler = (e) => onPick(e.target.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, [onPick]);

  return (
    <div className="badge-editor pal-editor" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="eyebrow">{onDelete ? t`Sửa màu` : t`Màu mới`}</div>
      <input className="pal-input" type="color" defaultValue={hex} ref={inputRef} />
      {onDelete && (
        <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá màu</Trans></button>
      )}
    </div>
  );
}

function EdgeMenu({ x, y, edge, onStyleToggle, onArrowToggle, onReverse, onLabel, onColorChange, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);

  // Guard against a redundant second commit: Enter commits immediately, and a
  // later blur (e.g. clicking elsewhere) would otherwise push the same value
  // again. Comparing against the (by-then-updated) `edge.label` prop makes the
  // second call a no-op instead of a duplicate history entry.
  function commitLabel(rawValue) {
    const next = rawValue.trim();
    const prev = (edge.label ?? "").trim();
    if (next === prev) return;
    onLabel(rawValue);
  }

  const isDashed = edge.style === "dashed";
  const isDirected = edge.arrow !== "none";

  return (
    <div className="badge-editor edge-menu" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="be-name"
        type="text"
        autoFocus
        defaultValue={edge.label ?? ""}
        placeholder={t`Nhãn edge…`}
        onKeyDown={(e) => { if (e.key === "Enter") commitLabel(e.currentTarget.value); }}
        onBlur={(e) => commitLabel(e.target.value)}
      />

      <div className="em-section">
        <div className="eyebrow"><Trans>Kiểu nét</Trans></div>
        <div className="em-toggle-group">
          <button className={"em-icon-btn" + (!isDashed ? " on" : "")} onClick={() => isDashed && onStyleToggle()} title={t`Nét liền`}>
            <LineSolidIcon />
          </button>
          <button className={"em-icon-btn" + (isDashed ? " on" : "")} onClick={() => !isDashed && onStyleToggle()} title={t`Nét đứt`}>
            <LineDashedIcon />
          </button>
        </div>
      </div>

      <div className="em-section">
        <div className="eyebrow"><Trans>Hướng</Trans></div>
        <div className="em-toggle-group">
          <button className={"em-icon-btn" + (!isDirected ? " on" : "")} onClick={() => isDirected && onArrowToggle()} title={t`Vô hướng`}>
            <LineUndirectedIcon />
          </button>
          <button className={"em-icon-btn" + (isDirected ? " on" : "")} onClick={() => !isDirected && onArrowToggle()} title={t`Có hướng`}>
            <LineDirectedIcon />
          </button>
          {isDirected && (
            <button className="em-icon-btn" onClick={onReverse} title={t`Đảo chiều`}>
              <ReverseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="em-section">
        <div className="eyebrow"><Trans>Màu dây</Trans></div>
        <div className="be-swatches">
          <button className={"be-swatch dot-empty" + (!edge.color ? " on" : "")} onClick={() => onColorChange(null)} title={t`Mặc định`} />
          {BADGE_PALETTE.map((token) => (
            <button key={token} className={"be-swatch" + (edge.color === token ? " on" : "")} style={{ background: colorVar(token) }} onClick={() => onColorChange(token)} title={token} />
          ))}
        </div>
      </div>

      <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá cạnh</Trans></button>
    </div>
  );
}

function CommentsPopover({ x, y, comments, onAdd, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);
  const [text, setText] = useState("");

  function timeAgo(iso) {
    const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return t`vừa xong`;
    if (diffSec < 3600) { const m = Math.floor(diffSec / 60); return t`${m} phút trước`; }
    if (diffSec < 86400) { const h = Math.floor(diffSec / 3600); return t`${h} giờ trước`; }
    const d = Math.floor(diffSec / 86400);
    return t`${d} ngày trước`;
  }

  function submit() {
    if (!text.trim()) return;
    if (onAdd(text)) setText("");
  }

  return (
    <div className="badge-editor comments-pop" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      {comments.length > 0 && (
        <div className="cmt-list">
          {comments.map((c, i) => (
            <div className="cmt-item" key={i}>
              <div className="cmt-item-head">
                <span className="cmt-author">{c.author}</span>
                <span className="cmt-time">{timeAgo(c.at)}</span>
                <button className="cmt-delete" onClick={() => onDelete(i)} title={t`Xoá`}>×</button>
              </div>
              <div className="cmt-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t`Viết bình luận…`}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
      />
      <div className="cmt-actions">
        <button className="save-btn" onClick={submit}><Trans>Gửi</Trans></button>
      </div>
    </div>
  );
}

function IdeaCard({ node, board, currentUser, editing, dimmed, linkPending, dropTarget, selected, flash, onMouseDown, onClick, onContextMenu, onConnectorMouseDown, onEdit, onDelete, onToggleFavorite, onOpenComments, onSave, onSaveAndNext, onCancel, onDropImage, onRemoveImage, onImageResize }) {
  const { t } = useLingui();
  const [title, setTitle] = useState(node.title);
  const [desc, setDesc] = useState(node.desc);
  const [tagId, setTagId] = useState(node.tagId ?? null);
  const [statusId, setStatusId] = useState(node.statusId ?? null);

  useEffect(() => {
    if (editing) {
      setTitle(node.title); setDesc(node.desc); setTagId(node.tagId ?? null); setStatusId(node.statusId ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const classNames = ["idea-card"];
  if (dimmed) classNames.push("dim");
  if (linkPending) classNames.push("link-pending");
  if (dropTarget) classNames.push("drop-target");
  if (selected) classNames.push("selected");
  if (flash) classNames.push("flash");

  function handleEditKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSaveAndNext({ title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId });
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }

  if (editing) {
    return (
      <div className={classNames.join(" ")} data-id={node.id} style={{ left: node.x, top: node.y, ...(node.w ? { width: node.w } : {}) }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="edit-form">
          <input type="text" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t`Tên ý tưởng`} onKeyDown={handleEditKeyDown} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t`Mô tả ngắn`} onKeyDown={handleEditKeyDown} />
          <div className="edit-row">
            <select value={tagId ?? ""} onChange={(e) => setTagId(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t`Không nhãn`}</option>
              {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </select>
            <select value={statusId ?? ""} onChange={(e) => setStatusId(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t`Không trạng thái`}</option>
              {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="edit-actions">
            <button className="save-btn" onClick={() => onSave({ title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId })}><Trans>Lưu</Trans></button>
            <button className="cancel-btn" onClick={onCancel}><Trans>Hủy</Trans></button>
            {node.image && <button className="cancel-btn" onClick={() => onRemoveImage()}><Trans>Xoá ảnh</Trans></button>}
          </div>
          <div className="edit-hint"><Trans>Ctrl+Enter: lưu & tạo ý nối tiếp</Trans></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames.join(" ")}
      data-id={node.id}
      style={{
        left: node.x, top: node.y,
        ...(node.w ? { width: node.w } : {}),
        ...(node.color ? { borderLeftColor: colorVar(node.color), borderLeftWidth: 4 } : {})
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropImage}
    >
      {/* Nút nằm cùng hàng với tiêu đề, không absolute: absolute thì tiêu đề dài
          chạy xuống dưới ngôi sao và bị đè. Tiêu đề co lại, nút giữ nguyên. */}
      <div className="card-top">
        {node.locked && <span className="lock-badge">🔒</span>}
        <div className="title">{node.title}</div>
        <div className="card-actions">
          <button
            className={"icon-btn fav-btn" + ((node.favorites ?? []).includes(currentUser) ? " on" : "")}
            title={t`Yêu thích`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          >
            ★{(node.favorites?.length ?? 0) > 0 ? node.favorites.length : ""}
          </button>
          <button className="icon-btn" title={t`Sửa`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
          <button className="icon-btn" title={t`Xoá`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
        </div>
      </div>
      {node.image && (
        <div className="card-img-wrap">
          <img className="card-img" src={node.image} alt="" draggable={false} />
          {!node.locked && (
            <span className="img-resize" title={t`Kéo để đổi cỡ ảnh`} onMouseDown={onImageResize} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
      <div className="desc">{node.desc ? <MdLite text={node.desc} /> : null}</div>
      <div className="meta-row">
        {(() => {
          const s = statusById(board, node.statusId);
          return s ? <span className="status-pill" data-badge-kind="status" data-badge-id={s.id} style={{ background: colorVar(s.color) }}>{s.name}</span> : null;
        })()}
        {(() => {
          const tg = tagById(board, node.tagId);
          return tg ? (
            <span className="tag-pill" data-badge-kind="tag" data-badge-id={tg.id}>
              <span className="dot" style={{ background: colorVar(tg.color) }}></span>
              {tg.name}
            </span>
          ) : null;
        })()}
        {(node.comments?.length ?? 0) > 0 && (
          <button
            className="cmt-pill"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenComments(e); }}
          >
            💬 {node.comments.length}
          </button>
        )}
      </div>
      <span className="connector-zone top" onMouseDown={(e) => onConnectorMouseDown(e, "top")} onClick={(e) => e.stopPropagation()} title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot">+</span></span>
      <span className="connector-zone right" onMouseDown={(e) => onConnectorMouseDown(e, "right")} onClick={(e) => e.stopPropagation()} title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot">+</span></span>
      <span className="connector-zone bottom" onMouseDown={(e) => onConnectorMouseDown(e, "bottom")} onClick={(e) => e.stopPropagation()} title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot">+</span></span>
      <span className="connector-zone left" onMouseDown={(e) => onConnectorMouseDown(e, "left")} onClick={(e) => e.stopPropagation()} title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot">+</span></span>
    </div>
  );
}
