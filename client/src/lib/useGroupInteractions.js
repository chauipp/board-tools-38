import { useState, useRef } from "react";
import { computeSnap } from "./snap.js";
import { edgeKey } from "./tree-layout.js";
import { rafThrottle } from "./raf-throttle.js";
import { startDrag } from "./drag-session.js";
import { toggleId } from "./selection.js";
import { MIN_GROUP_W, EMPTY_ARRAY, EMPTY_SET, MIN_GROUP_H } from "./board-constants.js";
import { useLingui } from "@lingui/react/macro";

// Khung (nhóm) trên bảng: tô khung mới, gom thẻ đang chọn vào khung, kéo khung
// (kèm thẻ bên trong), co giãn, sửa tiêu đề, đổi màu, khoá, xoá. Trước nằm trong
// IdeaMap.jsx. Những hàm IdeaMap khai báo sau hook gắn qua bind() mỗi lượt
// render.
export function useGroupInteractions({
  store, board, boardRef, view, frameCardSize, layoutOwners, selectedIds, selectedGroupIds, selectionDragSet, setBoard, recordHistory, saveNow, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSnapGuides, setColorMenu, spacePanRef
}) {
  const depsRef = useRef({});
  const { t } = useLingui();
  const commitStroke = (...a) => depsRef.current.commitStroke(...a);
  const enterMode = (...a) => depsRef.current.enterMode(...a);
  const finishGeom = (...a) => depsRef.current.finishGeom(...a);
  const publishGeom = (...a) => depsRef.current.publishGeom(...a);
  const handleNodeMouseDown = (...a) => depsRef.current.handleNodeMouseDown(...a);
  const startLockedTreeSwap = (...a) => depsRef.current.startLockedTreeSwap(...a);
  const startPan = (...a) => depsRef.current.startPan(...a);
  const toCanvasPoint = (...a) => depsRef.current.toCanvasPoint(...a);

  const [placeDraft, setPlaceDraft] = useState(null); // khung đang tô: {x,y,w,h}
  const [editingGroupTitleId, setEditingGroupTitleId] = useState(null);
  // Tô một vùng để ra khung. Bấm-không-tô (hoặc tô một vệt bé tí vì trượt tay)
  // vẫn ra khung, nhưng ở cỡ mặc định và lấy chỗ bấm làm tâm — không ai muốn
  // một cái khung 4x6 pixel. Vệt tô lớn hơn ngưỡng này thì lấy đúng vùng đã tô,
  // nhưng vẫn bị createGroupAt kẹp lên cỡ nhỏ nhất cho phép.
  const MIN_DRAWN_GROUP = 60;

  // Cùng kỷ luật refs-only như commitStroke (xem ghi chú dài ở đó): tô một cái
  // khung mất vài giây, board:update của người khác về giữa chừng mà mình dựng
  // `next` từ `board` đóng gói lúc mousedown thì cú PUT sau đó đè mất thay đổi
  // của họ.
  function createGroupAt({ x, y, w, h }) {
    const current = boardRef.current;
    if (!current) return;
    const id = current.nextGroupId;
    const group = {
      id, title: t`Khung mới`, color: null,
      x: Math.round(x), y: Math.round(y),
      w: Math.max(MIN_GROUP_W, Math.round(w)), h: Math.max(MIN_GROUP_H, Math.round(h))
    };
    const next = { ...current, groups: [...current.groups, group], nextGroupId: id + 1 };
    store.commit(next, { from: current });
  }

  function startPlaceGroup(e) {
    e.preventDefault();
    const a = toCanvasPoint(e.clientX, e.clientY);
    let last = null;
    // Chỉ việc VẼ khung nháp bị bóp theo khung hình; `last` cập nhật ở mọi nhịp
    // chuột nên lúc thả không mất vị trí cuối dù có cancel() lần vẽ còn treo.
    const paint = rafThrottle((rect) => setPlaceDraft(rect));
    function onMove(ev) {
      const b = toCanvasPoint(ev.clientX, ev.clientY);
      last = {
        x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
      };
      paint(last);
    }
    function onUp() {
      paint.cancel();
      setPlaceDraft(null);
      const drawn = last && last.w >= MIN_DRAWN_GROUP && last.h >= MIN_DRAWN_GROUP;
      createGroupAt(drawn ? last : { x: a.x - 240, y: a.y - 160, w: 480, h: 320 });
      enterMode("select");
    }
    startDrag(e, { onMove, onEnd: onUp, throttle: false });
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
    store.commit({ ...board, groups: [...board.groups, group], nextGroupId: id + 1 });
  }

  function handleGroupMouseDown(e, groupId) {
    if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }
    if (e.button !== 0) return;
    const group = board.groups.find((g) => g.id === groupId);
    if (!group) return;
    e.stopPropagation();

    // Ctrl/Cmd+click = thêm/bớt khung khỏi vùng chọn, và KHÔNG kéo — cùng luật
    // với thẻ (xem handleNodeMouseDown). Đặt TRƯỚC nhánh `locked`: khung khoá
    // vẫn phải cộng/trừ được khỏi vùng chọn, khoá chỉ chặn di chuyển.
    if (e.ctrlKey || e.metaKey) {
      setSelectedGroupIds((prev) => toggleId(prev, group.id));
      return;
    }
    if (group.locked || layoutOwners.has(edgeKey("group", group.id))) {
      setSelectedGroupIds(new Set([group.id])); setSelectedIds(new Set());
      if (!group.locked && !e.altKey) startLockedTreeSwap(e, edgeKey("group", group.id));
      return;
    }

    // Kéo một khung ĐANG nằm trong vùng chọn nhiều thứ thì mang cả vùng chọn đi;
    // kéo một khung ngoài vùng chọn thì thu vùng chọn về đúng khung đó, y như
    // cách bấm vào một cái thẻ đang làm.
    const inSelection = selectedGroupIds.has(group.id);
    const many = inSelection && (selectedGroupIds.size > 1 || selectedIds.size > 0);
    const dragSet = many
      ? selectionDragSet(board, selectedGroupIds, selectedIds)
      : selectionDragSet(board, new Set([group.id]), EMPTY_SET);
    if (!many) { setSelectedGroupIds(new Set([group.id])); setSelectedIds(new Set()); setSelectedEdgeIds(new Set()); }

    const dragGroupIds = dragSet.groupIds;
    const memberIds = dragSet.nodeIds;
    if (dragGroupIds.length === 0) return;

    const startX = e.clientX, startY = e.clientY;
    const scale = view.scale;
    const boardBeforeDrag = board;
    const movingGroupIds = new Set(dragGroupIds);
    const startGroupPositions = new Map(
      dragGroupIds.map((id) => {
        const g = board.groups.find((gg) => gg.id === id);
        return [id, { x: g.x, y: g.y, w: g.w, h: g.h }];
      })
    );
    const startNodePositions = new Map(
      memberIds.map((id) => {
        const n = board.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    // Kích thước thẻ trong khung và các hình chữ nhật để bắt dính đều KHÔNG đổi
    // trong suốt cú kéo — dựng sẵn một lần thay vì dựng lại ở mỗi nhịp chuột.
    const memberSizes = new Map(memberIds.map((id) => [id, frameCardSize(id)]));
    const nodeWidths = new Map(board.nodes.map((n) => [n.id, n.w]));
    const otherRects = [
      ...board.nodes.filter((n) => !startNodePositions.has(n.id)).map((n) => {
        const { w, h } = frameCardSize(n.id);
        return { x: n.x, y: n.y, w, h };
      }),
      ...board.groups.filter((g) => !movingGroupIds.has(g.id)).map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))
    ];
    let latest = board;
    let moved = false;

    const onMove = (ev) => {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      startGroupPositions.forEach((start) => {
        const gx = start.x + dx, gy = start.y + dy;
        minX = Math.min(minX, gx); minY = Math.min(minY, gy);
        maxX = Math.max(maxX, gx + start.w); maxY = Math.max(maxY, gy + start.h);
      });
      memberIds.forEach((id) => {
        const start = startNodePositions.get(id);
        const { w, h } = memberSizes.get(id);
        const nx = start.x + dx, ny = start.y + dy;
        minX = Math.min(minX, nx); minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx + w); maxY = Math.max(maxY, ny + h);
      });
      const movingRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      if (ev.altKey) {
        setSnapGuides(EMPTY_ARRAY);
      } else {
        const snap = computeSnap(movingRect, otherRects, 6 / scale);
        dx += snap.dx; dy += snap.dy;
        setSnapGuides(snap.guides);
      }

      setBoard((prev) => {
        const next = {
          ...prev,
          groups: prev.groups.map((g) => {
            const start = startGroupPositions.get(g.id);
            if (!start) return g;
            return { ...g, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
          }),
          nodes: prev.nodes.map((n) => {
            const start = startNodePositions.get(n.id);
            if (!start) return n;
            return { ...n, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
          })
        };
        latest = next;
        return next;
      });
      // Chỉ phát khi thật sự có dịch chuyển: bấm-không-kéo không được sinh
      // ra gói nào, để bên người xem không phải dựng overlay rồi lại nhả ra.
      if (moved) publishGeom(movingItems(dx, dy));
    };

    function movingItems(dx, dy) {
      return {
        groups: dragGroupIds.map((id) => {
          const start = startGroupPositions.get(id);
          return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: start.w, h: start.h };
        }),
        nodes: memberIds.map((id) => {
          const start = startNodePositions.get(id);
          return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: nodeWidths.get(id) };
        })
      };
    }

    function onUp() {
      setSnapGuides(EMPTY_ARRAY);
      // Bấm vào khung mà không kéo thì không có gì để ghi: lần PUT ở đây đẩy cả
      // board (kèm ảnh) lên server rồi phát board:update cho mọi người, chỉ để
      // lưu lại đúng trạng thái cũ.
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({
        groups: latest.groups.filter((g) => movingGroupIds.has(g.id)),
        nodes: latest.nodes.filter((n) => startNodePositions.has(n.id))
      });
      saveNow(latest);
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  function handleGroupResizeMouseDown(e, groupId) {
    const group = board.groups.find((g) => g.id === groupId);
    if (!group || group.locked) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const scale = view.scale;
    const boardBeforeDrag = board;
    const startW = group.w, startH = group.h;
    const MIN_W = MIN_GROUP_W, MIN_H = MIN_GROUP_H;
    let latest = board;
    let moved = false;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
      const w = Math.max(MIN_W, Math.round(startW + dx));
      const h = Math.max(MIN_H, Math.round(startH + dy));
      setBoard((prev) => {
        const next = {
          ...prev,
          groups: prev.groups.map((g) => (g.id === group.id ? { ...g, w, h } : g))
        };
        latest = next;
        return next;
      });
      if (moved) publishGeom({ groups: [{ id: group.id, x: group.x, y: group.y, w, h }] });
    };
    function onUp() {
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({ groups: latest.groups.filter((g) => g.id === group.id) });
      saveNow(latest);
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  function saveGroupTitle(groupId, title) {
    setEditingGroupTitleId(null);
    store.commit({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, title: title.trim() || t`Khung` } : g)) });
  }

  function deleteGroup(id) {
    store.commit({
      ...board,
      groups: board.groups.filter((g) => g.id !== id),
      edges: board.edges.filter((e) => !(
        (e.from === id && (e.fromKind || "node") === "group") ||
        (e.to === id && (e.toKind || "node") === "group")
      ))
    });
  }

  function applyGroupColor(groupId, color) {
    store.commit({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, color } : g)) });
    setColorMenu(null);
  }

  function toggleGroupLock(id) {
    store.commit({ ...board, groups: board.groups.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g)) });
    setColorMenu(null);
  }

  return {
    placeDraft, editingGroupTitleId, setEditingGroupTitleId, createGroupAt, startPlaceGroup, groupSelectedCards, handleGroupMouseDown, handleGroupResizeMouseDown, saveGroupTitle, deleteGroup, applyGroupColor, toggleGroupLock,
    bind: (d) => { depsRef.current = d; }
  };
}
