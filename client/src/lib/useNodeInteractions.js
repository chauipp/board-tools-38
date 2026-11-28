import { useRef } from "react";
import { moveDrawing } from "./shape.js";
import { computeSnap } from "./snap.js";
import { placeLinkedNode, parentNodeId } from "./place-node.js";
import { edgeKey } from "./tree-layout.js";
import { treeLockOwners, arrangeLockedTrees } from "./locked-tree.js";
import { startDrag } from "./drag-session.js";
import { toggleId } from "./selection.js";
import { CARD_LEVEL_W, levelPatch } from "./card-levels.js";
import { CARD_W, EMPTY_ARRAY, EMPTY_SET } from "./board-constants.js";
import { useLingui } from "@lingui/react/macro";

// Thao tác trên thẻ: tạo thẻ (tự do, nối tiếp, cùng cấp), nhân bản, kéo thẻ (kèm
// vùng chọn, Alt để nhân bản), bấm thẻ khi đang nối dây, sửa nội dung, xoá,
// màu/hình/nét đứt/bậc, khoá, yêu thích, bình luận. Trước nằm trong IdeaMap.jsx.
// Những hàm IdeaMap khai báo sau hook gắn qua bind() mỗi lượt render.
export function useNodeInteractions({
  store, board, user, camera, view, setView, viewRef, viewportRef, cardDragClickGuardRef, cardLevelPref, editingId, setEditingId, frameCardSize, layoutOwners, linkMode, pendingSource, setPendingSource, toggleEdge, recordHistory, saveNow, selectedIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, setBoard, setColorMenu, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds, setSnapGuides, spacePanRef
}) {
  const depsRef = useRef({});
  // Trước là `user.name` tính sau nhánh `if (!board) return`; ở đây hook chạy cả
  // trước khi board tải xong nên đọc an toàn — giá trị như nhau khi đã đăng nhập.
  const currentUser = user?.name;
  const { t } = useLingui();
  const enterMode = (...a) => depsRef.current.enterMode(...a);
  const finishGeom = (...a) => depsRef.current.finishGeom(...a);
  const publishGeom = (...a) => depsRef.current.publishGeom(...a);
  const startLockedTreeSwap = (...a) => depsRef.current.startLockedTreeSwap(...a);
  const startPan = (...a) => depsRef.current.startPan(...a);
  const toCanvasPoint = (...a) => depsRef.current.toCanvasPoint(...a);

  function createNode(x, y, extra) {
    const id = board.nextNodeId;
    const node = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: null, x: Math.round(x), y: Math.round(y), ...extra };
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: id + 1 };
    setEditingId(id);
    store.commit(next);
  }

  // Thẻ canh giữa theo con trỏ chứ không lấy điểm bấm làm góc trên-trái: bậc 1
  // rộng 260px, nếu neo góc thì thẻ mọc lệch hẳn sang phải chỗ vừa bấm.
  // `- 40` là nửa chiều cao ước lượng của thẻ, giữ nguyên con số mà nút "thêm ở
  // giữa màn hình" cũ đang dùng.
  function placeNodeAt(clientX, clientY) {
    const p = toCanvasPoint(clientX, clientY);
    createNode(p.x - CARD_LEVEL_W[cardLevelPref] / 2, p.y - 40, levelPatch(cardLevelPref));
    enterMode("select");
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

  // `sourceId` quyết định dây nối, `anchorId` quyết định chỗ đặt. Hai thứ này
  // tách nhau vì Shift+Enter tạo thẻ CÙNG CẤP: dây đi từ thẻ cha, nhưng vị trí
  // phải nằm ngay dưới thẻ đang chọn chứ không phải dưới cha.
  function createLinkedNode(sourceId, direction, base = board, { anchorId = sourceId } = {}) {
    const source = base.nodes.find((n) => n.id === sourceId);
    const anchor = base.nodes.find((n) => n.id === anchorId);
    if (!source || !anchor) return;

    // Thẻ chưa tồn tại nên chưa đo được: 180 là chiều cao ước lượng của một thẻ
    // có tiêu đề + mô tả, dùng làm ô giữ chỗ khi kiểm va chạm.
    const NEW_SIZE = { w: CARD_W, h: 180 };
    const MARGIN = 24;

    const rect = viewportRef.current.getBoundingClientRect();
    const view = viewRef.current;
    const { x, y, panTo } = placeLinkedNode({
      anchor: { x: anchor.x, y: anchor.y, ...frameCardSize(anchor.id) },
      size: NEW_SIZE,
      direction,
      obstacles: base.nodes.map((n) => ({ x: n.x, y: n.y, ...frameCardSize(n.id) })),
      viewport: {
        x0: (-view.panX + MARGIN) / view.scale,
        y0: (-view.panY + MARGIN) / view.scale,
        x1: (rect.width - view.panX - MARGIN) / view.scale,
        y1: (rect.height - view.panY - MARGIN) / view.scale
      }
    });

    // Chỗ trống rơi ra ngoài màn hình là chuyện thường khi board dày — dời
    // camera theo thẻ mới thay vì đặt thẻ ở chỗ khác cho vừa khung nhìn.
    let nextView = panTo
      ? {
          scale: view.scale,
          panX: rect.width / 2 - panTo.x * view.scale,
          panY: rect.height / 2 - panTo.y * view.scale
        }
      : view;

    const id = base.nextNodeId;
    const newNode = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: null, x, y };
    let next = {
      ...base,
      nodes: [...base.nodes, newNode],
      edges: [...base.edges, { id: base.nextEdgeId, from: sourceId, to: id }],
      nextNodeId: id + 1,
      nextEdgeId: base.nextEdgeId + 1
    };
    if (treeLockOwners(base, frameCardSize).has(edgeKey("node", sourceId))) {
      next = arrangeLockedTrees(next, frameCardSize);
      const placed = next.nodes.find((n) => n.id === id);
      const sx = placed.x * view.scale + view.panX;
      const sy = placed.y * view.scale + view.panY;
      const visible = sx >= MARGIN && sy >= MARGIN
        && sx + CARD_W * view.scale <= rect.width - MARGIN
        && sy + NEW_SIZE.h * view.scale <= rect.height - MARGIN;
      nextView = visible ? view : {
        scale: view.scale,
        panX: rect.width / 2 - (placed.x + CARD_W / 2) * view.scale,
        panY: rect.height / 2 - (placed.y + NEW_SIZE.h / 2) * view.scale
      };
    }
    setEditingId(id);
    store.commit(next);
    setView(nextView);
  }

  // Thẻ cùng cấp = cùng cha. Không có cha (thẻ gốc) thì không có "cùng cấp"
  // nào để tạo — bỏ qua, chứ không âm thầm tạo thẻ rời.
  function createSiblingNode(nodeId) {
    const parentId = parentNodeId(board.edges, nodeId);
    if (parentId == null) return;
    createLinkedNode(parentId, "bottom", board, { anchorId: nodeId });
  }

  function deleteNode(id) {
    store.commit({
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
    store.commit({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) });
  }

  function saveNodeEditAndNext(id, fields) {
    setEditingId(null);
    const edited = { ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) };
    createLinkedNode(id, "right", edited);
  }

  function handleCardClick(nodeId) {
    if (!linkMode) return;
    if (pendingSource === null) setPendingSource(nodeId);
    else if (pendingSource === nodeId) setPendingSource(null);
    else { toggleEdge(pendingSource, "node", nodeId, "node"); setPendingSource(null); }
  }

  function handleNodeMouseDown(e, nodeId) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (!node || linkMode || editingId === node.id) return;
    if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }
    if (e.button !== 0) return;
    cardDragClickGuardRef.current.begin();
    e.stopPropagation();

    // Ctrl/Cmd+click = thêm/bớt thẻ khỏi vùng chọn, và KHÔNG kéo: không gắn
    // mousemove/mouseup nào, nên nhích tay lúc bấm cũng không xê dịch thẻ.
    // Nhận cả Cmd vì trên macOS, Ctrl+click bị hệ điều hành biến thành chuột
    // phải (button 2) và nhánh này không bao giờ chạy tới.
    // Đặt TRƯỚC nhánh `locked`: thẻ khoá vẫn chọn được (khoá chỉ chặn di
    // chuyển), nên nó cũng phải cộng/trừ được khỏi vùng chọn như thẻ thường.
    // Alt được ưu tiên hơn, vì Alt-kéo là nhân bản — một việc khác hẳn.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      setSelectedIds((prev) => toggleId(prev, node.id));
      return;
    }

    if (layoutOwners.has(edgeKey("node", node.id)) || (node.locked && !e.altKey)) {
      setSelectedIds(new Set([node.id])); setSelectedDrawingIds(EMPTY_SET);
      setSelectedGroupIds(EMPTY_SET); setSelectedEdgeIds(EMPTY_SET);
      if (!node.locked && !e.altKey) startLockedTreeSwap(e, edgeKey("node", node.id));
      return;
    }

    const boardBeforeDrag = board;
    let dragIds, baseBoard, isAlt = false, selectedIdsBeforeDrag;
    // Khung cùng đi theo khi kéo một thẻ nằm trong vùng chọn có cả khung. Riêng
    // Alt-kéo (nhân bản) thì KHÔNG: nhân bản là việc của thẻ, kéo theo một cái
    // khung không được nhân bản sẽ làm khung rời khỏi ruột của nó.
    let dragGroupIds = [];
    // Nét vẽ đi theo cú kéo này. Phải là biến riêng chứ không đọc thẳng
    // `selectedDrawingIds` ở dưới: nhánh "bấm vào thẻ ngoài vùng chọn" gọi
    // setSelectedDrawingIds(rỗng), mà setState chỉ có hiệu lực ở lượt render
    // sau — đọc thẳng là vẫn thấy vùng chọn cũ và kéo theo nét không liên quan.
    let carryDrawingIds = EMPTY_SET;

    if (e.altKey) {
      isAlt = true;
      selectedIdsBeforeDrag = selectedIds;
      const cloneSourceIds = selectedIds.has(node.id) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [node.id];
      const dup = duplicateNodes(cloneSourceIds, 0);
      store.preview(dup.next);
      setSelectedIds(new Set(dup.cloneIds));
      dragIds = dup.cloneIds;
      baseBoard = dup.next;
    } else {
      // "Nhiều" tính cả nét vẽ: quét trúng một thẻ và một hình vẽ chú thích rồi
      // kéo cái thẻ — nếu chỉ đếm thẻ với khung thì đây là "một mình một thẻ",
      // vùng chọn bị đặt lại và cái hình bị bỏ lại phía sau.
      const many = selectedIds.has(node.id)
        && (selectedIds.size > 1 || selectedGroupIds.size > 0 || selectedDrawingIds.size > 0);
      if (many) {
        const set = selectionDragSet(board, selectedGroupIds, selectedIds);
        dragIds = set.nodeIds;
        dragGroupIds = set.groupIds;
        carryDrawingIds = selectedDrawingIds;
      } else {
        dragIds = [node.id];
        setSelectedIds(new Set([node.id]));
        setSelectedGroupIds(new Set());
        // Cả nét vẽ nữa: bấm vào một thẻ ngoài vùng chọn là bắt đầu lại từ đầu.
        // Bỏ sót dòng này thì một nét còn sót trong vùng chọn cũ sẽ lặng lẽ đi
        // theo cú kéo thẻ này, dù người dùng không hề thấy nó liên quan.
        setSelectedDrawingIds(EMPTY_SET);
      }
      baseBoard = board;
    }

    const startX = e.clientX, startY = e.clientY;
    const scale = view.scale;
    const startPositions = new Map(
      dragIds.map((id) => {
        const n = baseBoard.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    // Ba bảng tra dựng SẴN một lần cho cả cú kéo. Bản cũ dựng lại `otherRects`
    // — một mảng chứa MỌI thẻ khác, mỗi phần tử kèm một phép đo DOM — ở mỗi
    // nhịp chuột; với bảng 100 thẻ đó là 100 lần buộc trình duyệt tính lại
    // layout cho một lần nhích chuột, và là nguyên nhân giật nặng nhất khi bảng
    // to. Không có gì trong số đó đổi giữa chừng: thẻ khác đứng yên.
    const dragSizes = new Map(dragIds.map((id) => [id, frameCardSize(id)]));
    const dragWidths = new Map(dragIds.map((id) => [id, baseBoard.nodes.find((n) => n.id === id)?.w]));
    const movingGroupIds = new Set(dragGroupIds);
    const startGroupPositions = new Map(
      dragGroupIds.map((id) => {
        const g = baseBoard.groups.find((gg) => gg.id === id);
        return [id, { x: g.x, y: g.y, w: g.w, h: g.h }];
      })
    );
    // Nét vẽ / hình / chữ quét trúng cùng vùng chọn thì phải đi theo cú kéo:
    // quét một cụm gồm thẻ và mấy hình vẽ chú thích quanh nó rồi kéo, mà chỉ
    // thẻ chạy còn chú thích ở lại, là hỏng đúng cái cụm vừa gom. Chốt toạ độ
    // gốc một lần ở đây, mỗi nhịp chuột tính lại TỪ MỐC ĐÓ (không cộng dồn) —
    // cùng kỷ luật với startPositions của thẻ.
    // Alt+kéo (nhân bản) không có nét nào trong carryDrawingIds: nhân bản là
    // việc của thẻ, không nhân nét vẽ.
    const startDrawingPts = new Map(
      (baseBoard.drawings || [])
        .filter((d) => carryDrawingIds.has(d.id))
        .map((d) => [d.id, d.pts])
    );
    const otherRects = [
      ...baseBoard.nodes.filter((n) => !startPositions.has(n.id)).map((n) => {
        const { w, h } = frameCardSize(n.id);
        return { x: n.x, y: n.y, w, h };
      }),
      // Khung đang bị kéo theo không được tự làm mốc bắt dính cho chính nó.
      ...baseBoard.groups.filter((g) => !movingGroupIds.has(g.id)).map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))
    ];
    let latest = baseBoard;
    let moved = false;

    const onMove = (ev) => {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        moved = true;
        cardDragClickGuardRef.current.markDragged();
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      dragIds.forEach((id) => {
        const start = startPositions.get(id);
        const { w, h } = dragSizes.get(id);
        const nx = start.x + dx, ny = start.y + dy;
        minX = Math.min(minX, nx); minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx + w); maxY = Math.max(maxY, ny + h);
      });
      startGroupPositions.forEach((start) => {
        const gx = start.x + dx, gy = start.y + dy;
        minX = Math.min(minX, gx); minY = Math.min(minY, gy);
        maxX = Math.max(maxX, gx + start.w); maxY = Math.max(maxY, gy + start.h);
      });
      const movingRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      if (ev.altKey) {
        setSnapGuides(EMPTY_ARRAY);
      } else {
        const snap = computeSnap(movingRect, otherRects, 6 / scale);
        dx += snap.dx; dy += snap.dy;
        setSnapGuides(snap.guides);
      }

      const moving = dragIds.map((id) => {
        const start = startPositions.get(id);
        return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: dragWidths.get(id) };
      });
      const movingById = new Map(moving.map((m) => [m.id, m]));
      const movingGroups = dragGroupIds.map((id) => {
        const start = startGroupPositions.get(id);
        return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: start.w, h: start.h };
      });
      const movingGroupById = new Map(movingGroups.map((g) => [g.id, g]));
      setBoard((prev) => {
        const next = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const m = movingById.get(n.id);
            return m ? { ...n, x: m.x, y: m.y } : n;
          }),
          groups: movingGroups.length === 0 ? prev.groups : prev.groups.map((g) => {
            const m = movingGroupById.get(g.id);
            return m ? { ...g, x: m.x, y: m.y } : g;
          }),
          drawings: startDrawingPts.size === 0 ? prev.drawings : prev.drawings.map((d) => {
            const from = startDrawingPts.get(d.id);
            // Dời từ toạ độ GỐC: `moveDrawing` cộng vào pts được truyền vào, nên
            // đưa nó bản có pts lúc bắt đầu kéo thay vì bản đang hiển thị.
            return from ? moveDrawing({ ...d, pts: from }, dx, dy) : d;
          })
        };
        latest = next;
        return next;
      });
      // Chỉ phát ĐÚNG những thứ đang bị kéo, không phát cả bảng.
      if (moved) publishGeom(movingGroups.length ? { nodes: moving, groups: movingGroups } : { nodes: moving });
    };
    function onUp() {
      setSnapGuides(EMPTY_ARRAY);
      if (moved) {
        recordHistory(boardBeforeDrag);
        // Gói geom cuối được gửi TRƯỚC khi PUT trả về, và nó giữ vị trí mới bên
        // máy người khác cho tới khi board:update chính thức tới nơi — không còn
        // khoảng hở nào để thẻ nhảy về chỗ cũ rồi nhảy lại.
        finishGeom(movingGroupIds.size
          ? { nodes: latest.nodes.filter((n) => startPositions.has(n.id)), groups: latest.groups.filter((g) => movingGroupIds.has(g.id)) }
          : { nodes: latest.nodes.filter((n) => startPositions.has(n.id)) });
        saveNow(latest);
      } else if (isAlt) {
        // Alt-click without drag: roll back the clone so nothing is silently duplicated.
        store.preview(boardBeforeDrag);
        setSelectedIds(selectedIdsBeforeDrag);
      }
      // Bấm-không-kéo: không lưu. Bản cũ vẫn PUT cả board (kèm ảnh base64) rồi
      // bắt server phát board:update cho mọi người, chỉ vì một cú click chọn thẻ.
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  function duplicateSelection() {
    if (selectedIds.size === 0) return;
    const { next, cloneIds } = duplicateNodes(Array.from(selectedIds));
    store.commit(next);
    setSelectedIds(new Set(cloneIds));
  }

  function applyNodeColor(nodeId, color) {
    store.commit({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)) });
    setColorMenu(null);
  }

  function toggleNodeLock(id) {
    store.commit({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, locked: !n.locked } : n)) });
    setColorMenu(null);
  }

  function applyNodeShape(nodeId, shape) {
    store.commit({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, shape } : n)) });
  }

  function applyNodeDashed(nodeId, dashed) {
    store.commit({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, dashed } : n)) });
  }

  function applyNodeLevel(nodeId, level) {
    store.commit({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, ...levelPatch(level) } : n)) });
  }

  function toggleFavorite(nodeId) {
    store.commit({
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
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: [...(n.comments ?? []), { text: text.trim(), author: currentUser, at: new Date().toISOString() }] }
        : n))
    });
    return true;
  }

  function deleteComment(nodeId, index) {
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: (n.comments ?? []).filter((_, i) => i !== index) }
        : n))
    });
  }

  return {
    createNode, placeNodeAt, duplicateNodes, createLinkedNode, createSiblingNode, deleteNode, saveNodeEdit, saveNodeEditAndNext, handleCardClick, handleNodeMouseDown, duplicateSelection, applyNodeColor, toggleNodeLock, applyNodeShape, applyNodeDashed, applyNodeLevel, toggleFavorite, addComment, deleteComment,
    bind: (d) => { depsRef.current = d; }
  };
}
