import { useEffect, useRef, useState } from "react";
import { nodesInFrame } from "./board-geometry.js";
import { buildTree, edgeKey } from "./tree-layout.js";
import { normalizeTreeLock, arrangeTree, arrangeLockedTrees, lockedTreeSiblings, swapLockedSiblings } from "./locked-tree.js";
import { startDrag } from "./drag-session.js";
import { TREE_OPTS } from "./board-constants.js";

// Xếp cây: bảng Xếp cây (mở/xem trước/chốt/đóng, luôn tính lại từ board lúc mở
// bảng), khoá cách xếp vào gốc cây, xếp nhanh theo một hướng, và kéo để đổi chỗ
// hai nhánh anh em trong cây đã khoá. Trước nằm trong IdeaMap.jsx.
export function useTreeLayout({
  store, board, boardRef, role, roleRef, workspace, treeUI, setTreeUI, frameCardSize, treeSizeRef, layoutOwners, cardDragClickGuardRef, recordHistory, saveNow, setColorMenu
}) {
  const depsRef = useRef({});

  const [treeOpts, setTreeOpts] = useState(TREE_OPTS);
  const treeBaseRef = useRef(null);
  const treeControllerRef = useRef(null);
  const treeMembersRef = useRef(null);
  const treeLastRef = useRef(null);
  const [treeSwap, setTreeSwap] = useState(null);
  const treeSwapCancelRef = useRef(null);
  const treeSwapClickUntilRef = useRef(0);
  useEffect(() => () => treeSwapCancelRef.current?.(), []);
  useEffect(() => {
    if (!treeUI || !board) return;
    const key = edgeKey(treeUI.kind, treeUI.id);
    if (treeControllerRef.current === workspace.controller && treeMembersRef.current?.rootKey === key && treeBaseRef.current) return;
    const root = (treeUI.kind === "group" ? board.groups : board.nodes).find((item) => item.id === treeUI.id);
    if (!root) return;
    const opts = normalizeTreeLock(root.treeLayoutLock) || TREE_OPTS;
    setTreeOpts({ ...opts, leaf: opts.breadth });
    treeBaseRef.current = board;
    treeControllerRef.current = workspace.controller;
    treeMembersRef.current = { rootKey: edgeKey(treeUI.kind, treeUI.id), members: opts.groupMembers || {} };
    treeLastRef.current = null;
  }, [treeUI?.kind, treeUI?.id, workspace.controller, board != null]);

  function startLockedTreeSwap(e, sourceKey) {
    if (roleRef.current === "viewer") return;
    treeSwapCancelRef.current?.();
    const candidates = new Set(lockedTreeSiblings(boardRef.current, sourceKey, treeSizeRef.current));
    if (!candidates.size) return;
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    function targetAt(ev) {
      const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
      for (const el of elements) {
        const card = el.closest(".idea-card[data-id]");
        const frame = el.closest(".frame-box[data-group-id]");
        const key = card ? edgeKey("node", card.dataset.id)
          : frame ? edgeKey("group", frame.dataset.groupId) : null;
        if (key && candidates.has(key)) return key;
      }
      return null;
    }
    function onMove(ev) {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      moved = true;
      cardDragClickGuardRef.current.markDragged();
      setTreeSwap({ source: sourceKey, candidates, target: targetAt(ev), x: ev.clientX, y: ev.clientY });
    }
    function cleanup() {
      treeSwapCancelRef.current = null;
      setTreeSwap(null);
      if (moved) treeSwapClickUntilRef.current = Date.now() + 250;
    }
    function onUp(ev) {
      const target = moved ? targetAt(ev) : null;
      cleanup();
      if (!target || roleRef.current === "viewer") return;
      const current = boardRef.current;
      const next = swapLockedSiblings(current, sourceKey, target, treeSizeRef.current);
      if (next !== current) {
        recordHistory(current);
        store.commit(next, { historical: false });
      }
    }
    // Esc hoặc mất focus: huỷ, không đổi chỗ gì. treeSwapCancelRef giữ hàm huỷ
    // để một lượt đổi chỗ mới (hoặc unmount) dọn lượt cũ còn dở.
    treeSwapCancelRef.current = startDrag(e, {
      onMove, onEnd: onUp, onCancel: cleanup, throttle: false, blur: "cancel", cancelOnEscape: true
    });
  }

  function treeSwapState(key) {
    if (!treeSwap) return undefined;
    return treeSwap.source === key ? "source" : treeSwap.target === key ? "target"
      : treeSwap.candidates.has(key) ? "candidate" : undefined;
  }

  // Xếp lại thẻ gốc + toàn bộ con cháu nối với nó thành hình cây. Gốc đứng yên
  // làm điểm neo; thẻ khoá giữ chỗ nhưng con cháu nó vẫn xếp quanh đúng chỗ đó.
  // Thuần một phép biến đổi board → board: bảng Xếp cây gọi lại nó mỗi lần kéo
  // thanh trượt để xem trước, nên nó không được tự ý ghi state hay lưu server.
  function treeArranged(base, rootKind, rootId, opts) {
    const bucket = rootKind === "group" ? "groups" : "nodes";
    const root = base[bucket].find((item) => item.id === rootId);
    if (!root) return base;
    const layoutOpts = { directions: opts.directions, depth: opts.depth, breadth: opts.breadth, leaf: opts.leaf };
    const existing = normalizeTreeLock(root.treeLayoutLock);
    const members = treeMembersRef.current?.rootKey === edgeKey(rootKind, rootId)
      ? treeMembersRef.current.members : null;
    const effectiveOpts = { ...existing, ...layoutOpts, ...(members ? { groupMembers: members } : {}) };
    const configured = existing ? {
      ...base,
      [bucket]: base[bucket].map((item) => item.id === rootId ? { ...item, treeLayoutLock: effectiveOpts } : item)
    } : base;
    return arrangeTree(configured, rootKind, rootId, effectiveOpts, frameCardSize);
  }

  function treeOwner(kind, id) {
    const owner = layoutOwners.get(edgeKey(kind, id));
    if (!owner) return { kind, id };
    const [ownerKind, ownerId] = owner.split(":");
    return { kind: ownerKind, id: Number(ownerId) };
  }

  // Bốn nút mũi tên trong menu chuột phải: bấm là xếp luôn một hướng, không mở
  // bảng. Giữ đúng khoảng cách mặc định cũ — lên/xuống dùng chiều cao thẻ (nhỏ)
  // làm khoảng cách tầng nên nhìn chật hơn trái/phải (dùng chiều rộng thẻ), phải
  // nới thêm cho hai hướng dọc.
  function arrangeAsTree(rootKind, rootId, direction) {
    if (role === "viewer") return;
    const owner = treeOwner(rootKind, rootId);
    rootKind = owner.kind; rootId = owner.id;
    const vertical = direction === "down" || direction === "up";
    const next = treeArranged(board, rootKind, rootId, {
      ...TREE_OPTS, directions: [direction], depth: vertical ? 110 : 70
    });
    setColorMenu(null);
    if (next) store.commit(next);
  }

  // Bảng Xếp cây. Cả phiên chỉnh (mở bảng → kéo thanh trượt chán chê → đóng) chỉ
  // ghi MỘT mốc hoàn tác, ghi ngay lúc mở: kéo thanh trượt mà mỗi nấc một mốc
  // thì Ctrl+Z sau đó phải bấm ba chục lần mới về được chỗ cũ.
  function openTreePanel(rootKind, rootId) {
    if (role === "viewer") return;
    const owner = treeOwner(rootKind, rootId);
    rootKind = owner.kind; rootId = owner.id;
    setColorMenu(null);
    const base = board;
    treeBaseRef.current = base;
    treeControllerRef.current = workspace.controller;
    const rootKey = edgeKey(rootKind, rootId);
    const memberKeys = new Set(buildTree(base.edges, rootKey).order);
    const stored = normalizeTreeLock((rootKind === "group" ? base.groups : base.nodes)
      .find((item) => item.id === rootId)?.treeLayoutLock)?.groupMembers;
    const members = Object.fromEntries(base.groups.filter((g) => memberKeys.has(edgeKey("group", g.id)))
      .map((g) => [g.id, stored?.[g.id] || nodesInFrame(base.nodes, g, frameCardSize)]));
    treeMembersRef.current = { rootKey, members };
    setTreeUI({ kind: rootKind, id: rootId });
    const root = (rootKind === "group" ? base.groups : base.nodes).find((item) => item.id === rootId);
    const savedOpts = normalizeTreeLock(root?.treeLayoutLock) || treeOpts;
    const opts = { ...savedOpts, leaf: savedOpts.breadth };
    setTreeOpts(opts);
    const next = treeArranged(base, rootKind, rootId, opts);
    treeLastRef.current = next;
    store.commit(next, { from: base });
  }

  function previewTree(opts) {
    if (role === "viewer") return;
    setTreeOpts(opts);
    const base = boardRef.current;
    if (!base || !treeUI) return;
    if (!treeLastRef.current) recordHistory(base);
    const next = treeArranged(base, treeUI.kind, treeUI.id, opts);
    if (!next) return;
    treeLastRef.current = next;
    store.preview(next);                      // chỉ trên máy mình, chưa lưu
  }

  function toggleTreeLock(enabled) {
    if (!treeUI || role === "viewer") return;
    const base = boardRef.current;
    const rootKey = edgeKey(treeUI.kind, treeUI.id);
    const descendants = new Set(buildTree(base.edges, rootKey).order);
    const update = (kind, item) => {
      const key = edgeKey(kind, item.id);
      if (key === rootKey) return { ...item, treeLayoutLock: enabled ? {
        ...normalizeTreeLock(item.treeLayoutLock),
        directions: [...treeOpts.directions], depth: treeOpts.depth, breadth: treeOpts.breadth, leaf: treeOpts.leaf,
        groupMembers: treeMembersRef.current?.members || {}
      } : null };
      if (enabled && descendants.has(key) && item.treeLayoutLock) return { ...item, treeLayoutLock: null };
      return item;
    };
    const next = arrangeLockedTrees({
      ...base,
      nodes: base.nodes.map((item) => update("node", item)),
      groups: base.groups.map((item) => update("group", item))
    }, frameCardSize);
    treeLastRef.current = next;
    store.commit(next);
  }

  // Nhả tay khỏi thanh trượt (hoặc bấm một hướng) mới lưu server + phát cho
  // người khác — kéo là gửi thì một cú kéo thành mấy chục lượt ghi.
  function commitTree() {
    const next = treeLastRef.current ? boardRef.current : null;
    if (next) saveNow(next);
  }

  function closeTreePanel() {
    commitTree();
    setTreeUI(null);
    treeBaseRef.current = null;
    treeMembersRef.current = null;
    treeLastRef.current = null;
  }

  return {
    treeOpts, treeSwap, treeSwapClickUntilRef, startLockedTreeSwap, treeSwapState, treeArranged, treeOwner, arrangeAsTree, openTreePanel, previewTree, toggleTreeLock, commitTree, closeTreePanel,
    bind: (d) => { depsRef.current = d; }
  };
}
