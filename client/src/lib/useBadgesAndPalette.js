import { useRef, useState } from "react";
import { applyColorTo, applyColorToMany, removePaletteColor } from "./palette.js";
import { drawingsHitBy } from "./shape.js";
import { pointInBounds } from "./selection-box.js";
import { PICK_RADIUS, SELECTION_DROP } from "./board-constants.js";
import { startDrag } from "./drag-session.js";

// Badge (trạng thái, nhãn), bảng màu riêng của board, nền/lưới/bộ màu; và hai
// cú kéo-thả: chip badge vào thẻ, ô màu vào thẻ/dây/nét/badge/vùng chọn.
// Trước nằm trong IdeaMap.jsx. dropIdsFor, clientToCanvas,
// applyColorToSelection gắn qua bind() mỗi lượt render.
export function useBadgesAndPalette({
  store, board, role, boardRef, selBounds, setDropTargetId, setFilterStatus, setFilterTags
}) {
  const depsRef = useRef({});
  const dropIdsFor = (...a) => depsRef.current.dropIdsFor(...a);
  const clientToCanvas = (...a) => depsRef.current.clientToCanvas(...a);
  const applyColorToSelection = (...a) => depsRef.current.applyColorToSelection(...a);

  const [chipDrag, setChipDrag] = useState(null);
  const [paletteUI, setPaletteUI] = useState(null); // { mode: "create"|"edit", id?, hex, x, y } | null
  const [colorDrag, setColorDrag] = useState(null); // { token, x, y } | null
  const [badgeUI, setBadgeUI] = useState(null); // { mode: "create"|"edit", kind, def?, x, y }
  function applyChipToNodes(nodeIds, kind, value) {
    const ids = new Set(nodeIds.filter((id) => board.nodes.some((n) => n.id === id)));
    if (ids.size === 0) return;
    const nextVal = value === "none" ? null : Number(value);
    const field = kind === "status" ? "statusId" : "tagId";
    // Mọi thẻ đã đúng giá trị thì không ghi gì: một cú thả vô nghĩa không nên
    // sinh ra một bước hoàn tác và một lượt PUT cả bảng.
    if (!board.nodes.some((n) => ids.has(n.id) && (n[field] ?? null) !== nextVal)) return;
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (ids.has(n.id) ? { ...n, [field]: nextVal } : n))
    });
  }

  // Chip trạng thái/nhãn: click = lọc (đọc, người chỉ xem vẫn dùng được), nhưng
  // kéo = gán badge vào thẻ và chuột phải = sửa badge, cả hai đều ghi dữ liệu.
  // CSS không tách được ba cử chỉ trên cùng một phần tử nên chặn ở đây.
  function handleChipMouseDown(e, kind, value) {
    if (role === "viewer") return;
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    function targetCardIdAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      const card = el && el.closest(".idea-card");
      return card ? Number(card.getAttribute("data-id")) : null;
    }

    const onMove = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setChipDrag({ kind, value, x: ev.clientX, y: ev.clientY });
      const id = targetCardIdAt(ev.clientX, ev.clientY);
      setDropTargetId(id != null ? { id, kind: "node" } : null);
    };
    function onUp(ev) {
      if (!dragging) return;
      const targetId = targetCardIdAt(ev.clientX, ev.clientY);
      setChipDrag(null);
      setDropTargetId(null);
      if (targetId !== null) applyChipToNodes(dropIdsFor("node", targetId), kind, value);
    }
    startDrag(e, { onMove, onEnd: onUp, release: "cancel" });
  }

  function openBadgeMenu(e, kind, def) {
    if (role === "viewer") return;
    e.preventDefault();
    e.stopPropagation();
    setBadgeUI({ mode: "edit", kind, def, x: e.clientX, y: e.clientY });
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
      store.commit({ ...board, statuses: [...board.statuses, { id, name, color }], nextStatusId: id + 1 });
    } else {
      const id = board.nextTagId;
      store.commit({ ...board, tags: [...board.tags, { id, name, color }], nextTagId: id + 1 });
    }
    setBadgeUI(null);
  }

  function updateBadge(kind, id, name, color) {
    if (kind === "status") {
      store.commit({ ...board, statuses: board.statuses.map((s) => (s.id === id ? { ...s, name, color } : s)) });
    } else {
      store.commit({ ...board, tags: board.tags.map((tg) => (tg.id === id ? { ...tg, name, color } : tg)) });
    }
    setBadgeUI(null);
  }

  function deleteBadge(kind, id) {
    if (kind === "status") {
      store.commit({
        ...board,
        statuses: board.statuses.filter((s) => s.id !== id),
        nodes: board.nodes.map((n) => (n.statusId === id ? { ...n, statusId: null } : n))
      });
      setFilterStatus((prev) => { const next = { ...prev }; delete next[String(id)]; return next; });
    } else {
      store.commit({
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

  // Nền và bộ màu đi qua đúng đường lưu của mọi thay đổi board khác, nên tự có
  // hoàn tác và tự phát realtime — không cần đường riêng.
  function setBoardBg(next) {
    if (board.bg === next) return;
    store.commit({ ...board, bg: next });
  }

  function setBoardGrid(next) {
    if ((board.grid ?? null) === next) return;
    store.commit({ ...board, grid: next });
  }

  function setBoardPack(next) {
    if (board.pack === next) return;
    store.commit({ ...board, pack: next });
  }

  function createPaletteColor(hex) {
    const id = board.nextPaletteId;
    store.commit({ ...board, palette: [...board.palette, { id, hex }], nextPaletteId: id + 1 });
    setPaletteUI(null);
  }

  // Popover ở lại sau khi đổi màu: sửa xong còn có thể chọn lại hoặc xoá luôn.
  function updatePaletteColor(id, hex) {
    store.commit({ ...board, palette: board.palette.map((c) => (c.id === id ? { ...c, hex } : c)) });
  }

  function deletePaletteColor(id) {
    store.commit(removePaletteColor(board, id));
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
      if (el) {
        const badge = el.closest("[data-badge-kind][data-badge-id]");
        if (badge) return { kind: badge.getAttribute("data-badge-kind"), id: Number(badge.getAttribute("data-badge-id")) };
        const card = el.closest(".idea-card[data-id]");
        if (card) return { kind: "node", id: Number(card.getAttribute("data-id")) };
        const edge = el.closest("[data-edge-id]");
        if (edge) return { kind: "edge", id: Number(edge.getAttribute("data-edge-id")) };
      }
      // Nét bút / hình khối / chữ không có nút DOM để elementFromPoint tìm ra
      // (cả lớp vẽ là một <svg> pointer-events: none), nên phải dò bằng hình học
      // trên toạ độ canvas — và dò ngoài nhánh `el` ở trên, không phụ thuộc vào
      // việc có tìm được nút DOM nào dưới con trỏ hay không. Xét SAU thẻ và dây:
      // thả màu lên chỗ một nét vẽ nằm đè lên thẻ thì cái người ta nhắm tới gần
      // như luôn là cái thẻ.
      const p = clientToCanvas(clientX, clientY);
      const hits = drawingsHitBy(boardRef.current?.drawings || [], p, PICK_RADIUS);
      if (hits.length) return { kind: "drawing", id: hits[hits.length - 1] };
      // Chỗ TRỐNG bên trong vùng chọn: cả cụm nhận màu. Xét CUỐI cùng, sau mọi
      // đích cụ thể — thả trúng một cái thẻ trong vùng chọn thì vẫn đi đường cũ
      // (dropIdsFor cũng đã tô cả vùng), còn đây là để không phải nhắm cho trúng
      // một cái gì cả.
      if (selBounds && pointInBounds(selBounds, p)) return { kind: "selection" };
      return null;
    }

    const onMove = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setColorDrag({ token, x: ev.clientX, y: ev.clientY });
      const target = colorTargetAt(ev.clientX, ev.clientY);
      // "selection" cũng phải sáng lên: thả vào chỗ trống mà không có phản hồi
      // nào thì người dùng không tin là nó sẽ ăn, và sẽ đi nhắm vào từng cái một
      // — đúng cái việc mà đích này sinh ra để khỏi phải làm.
      if (target && target.kind === "selection") setDropTargetId(SELECTION_DROP);
      else setDropTargetId(target && target.kind === "node" ? { id: target.id, kind: "node" } : null);
    };
    function onUp(ev) {
      if (!dragging) return;
      const target = colorTargetAt(ev.clientX, ev.clientY);
      setColorDrag(null);
      setDropTargetId(null);
      if (!target) return;
      // Thả vào chỗ trống trong vùng chọn: đi đúng hàm mà menu chuột phải đang
      // dùng cho "tô cả vùng chọn", nên hai lối vào không bao giờ cho hai kết
      // quả khác nhau.
      if (target.kind === "selection") { applyColorToSelection(token); return; }
      // Badge đi đường applyColorTo như cũ — nó không thuộc vùng chọn nào.
      if (target.kind === "node" || target.kind === "edge" || target.kind === "drawing") {
        store.commit(applyColorToMany(board, target.kind, dropIdsFor(target.kind, target.id), token));
      } else {
        store.commit(applyColorTo(board, target, token));
      }
    }
    startDrag(e, { onMove, onEnd: onUp, release: "cancel" });
  }

  return {
    chipDrag, colorDrag, badgeUI, setBadgeUI, paletteUI, setPaletteUI,
    applyChipToNodes, handleChipMouseDown, openBadgeMenu, openBadgeCreate, createBadge, updateBadge, deleteBadge,
    openPaletteEditor, setBoardBg, setBoardGrid, setBoardPack,
    createPaletteColor, updatePaletteColor, deletePaletteColor, handleColorMouseDown,
    bind: (d) => { depsRef.current = d; }
  };
}
