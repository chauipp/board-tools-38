import { nodesInFrame } from "./board-geometry.js";
import { buildTree, carryGroupMembers, edgeKey, treeLayout, TREE_DIRECTIONS } from "./tree-layout.js";

// Keep persisted gaps within the ranges offered by TreePanel. Malformed data
// must not silently enable a lock using defaults.
export function normalizeTreeLock(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !Array.isArray(value.directions) || value.directions.length === 0 ||
      !value.directions.every((dir) => TREE_DIRECTIONS.includes(dir)) ||
      ![value.depth, value.breadth, value.leaf].every(Number.isFinite)) return null;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const groupMembers = value.groupMembers && typeof value.groupMembers === "object" && !Array.isArray(value.groupMembers)
    ? Object.fromEntries(Object.entries(value.groupMembers)
      .filter(([key, ids]) => key.length > 0 && Array.isArray(ids) && ids.every((id) => Number.isFinite(id) || typeof id === "string"))
      .map(([key, ids]) => [key, [...new Set(ids)]])) : null;
  return {
    directions: [...new Set(value.directions)],
    depth: clamp(value.depth, 20, 400),
    breadth: clamp(value.breadth, 8, 320),
    leaf: clamp(value.leaf, 4, 320),
    ...(groupMembers ? { groupMembers } : {})
  };
}

const positive = (value) => Number.isFinite(value) && value > 0;
const compareKeys = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function context(board, nodeSize) {
  const nodes = board.nodes || [];
  const groups = board.groups || [];
  const items = new Map([
    ...nodes.map((n) => [edgeKey("node", n.id), n]),
    ...groups.map((g) => [edgeKey("group", g.id), g])
  ]);
  const sizes = new Map(nodes.map((n) => {
    const measured = nodeSize?.(n.id) || {};
    return [n.id, {
      w: positive(n.w) ? n.w : positive(measured.w) ? measured.w : 210,
      // PDF content height is a lower bound; measured height includes chrome.
      h: Math.max(positive(measured.h) ? measured.h : 110, positive(n.pdfH) ? n.pdfH : 0)
    }];
  }));
  const edges = (board.edges || []).filter((e) => e &&
    items.has(edgeKey(e.fromKind || "node", e.from)) &&
    items.has(edgeKey(e.toKind || "node", e.to)));
  return { nodes, groups, items, edges, nodeSize: (id) => sizes.get(id), sizeOf: (key) => {
    const item = items.get(key);
    return key.startsWith("group:") ? { w: item.w, h: item.h } : sizes.get(item.id);
  } };
}

function ownersIn(ctx) {
  const roots = [];
  for (const [key, item] of ctx.items) {
    const opts = normalizeTreeLock(item.treeLayoutLock);
    if (!opts) continue;
    const members = new Set(buildTree(ctx.edges, key).order);
    for (const group of ctx.groups) {
      if (!members.has(edgeKey("group", group.id))) continue;
      const ids = opts.groupMembers?.[group.id] ?? nodesInFrame(ctx.nodes, group, ctx.nodeSize);
      for (const id of ids) if (ctx.items.has(edgeKey("node", id))) members.add(edgeKey("node", id));
    }
    roots.push({ key, members });
  }
  // Strict ancestors precede descendants. Mutually reachable roots (cycles)
  // tie by endpoint key, as do otherwise independent trees sharing a child.
  for (const root of roots) {
    root.ancestors = roots.filter((other) => other.members.has(root.key) && !root.members.has(other.key)).length;
  }
  roots.sort((a, b) => a.ancestors - b.ancestors || compareKeys(a.key, b.key));
  const owners = new Map();
  for (const root of roots) {
    if (owners.has(root.key)) continue;
    for (const key of root.members) if (!owners.has(key)) owners.set(key, root.key);
  }
  return owners;
}

export function treeLockOwners(board, nodeSize) {
  if (![...(board.nodes || []), ...(board.groups || [])].some((item) => normalizeTreeLock(item.treeLayoutLock))) return new Map();
  return ownersIn(context(board, nodeSize));
}

function positionsFor(ctx, rootKey, opts, owners) {
  const root = ctx.items.get(rootKey);
  const allowed = (key) => !owners || owners.get(key) === rootKey;
  const edges = ctx.edges.filter((e) => allowed(edgeKey(e.fromKind || "node", e.from)) &&
    allowed(edgeKey(e.toKind || "node", e.to)));
  const positions = treeLayout({ edges, rootKey, rootPos: root, sizeOf: ctx.sizeOf,
    directions: opts.directions, gap: opts });
  // treeLayout rounds coordinates; the anchor must retain its exact position.
  positions.set(rootKey, { x: root.x, y: root.y });
  const groups = ctx.groups.filter((g) => allowed(edgeKey("group", g.id)))
    .sort((a, b) => compareKeys(edgeKey("group", a.id), edgeKey("group", b.id)));
  const nodes = ctx.nodes.filter((n) => allowed(edgeKey("node", n.id)));
  const carried = carryGroupMembers(positions, groups, nodes, ctx.nodeSize);
  if (opts.groupMembers) {
    carried.clear();
    for (const group of groups) {
      const p = positions.get(edgeKey("group", group.id));
      if (!p || group.locked) continue;
      for (const id of opts.groupMembers[group.id] || []) {
        const item = ctx.items.get(edgeKey("node", id));
        if (!item || item.locked || !allowed(edgeKey("node", id)) || positions.has(edgeKey("node", id)) || carried.has(id)) continue;
        carried.set(id, { x: item.x + p.x - group.x, y: item.y + p.y - group.y });
      }
    }
  }
  for (const [id, position] of carried) positions.set(edgeKey("node", id), position);
  return positions;
}

function applyPositions(board, positions) {
  let changed = false;
  const move = (kind, item) => {
    const p = positions.get(edgeKey(kind, item.id));
    if (!p || item.locked || (item.x === p.x && item.y === p.y)) return item;
    changed = true;
    return { ...item, x: p.x, y: p.y };
  };
  const nodes = (board.nodes || []).map((n) => move("node", n));
  const groups = (board.groups || []).map((g) => move("group", g));
  return changed ? { ...board, nodes, groups } : board;
}

export function arrangeTree(board, kind, id, opts, nodeSize) {
  const normalized = normalizeTreeLock(opts);
  if (!normalized || (kind !== "node" && kind !== "group")) return board;
  const ctx = context(board, nodeSize);
  const rootKey = edgeKey(kind, id);
  if (!ctx.items.has(rootKey)) return board;
  return applyPositions(board, positionsFor(ctx, rootKey, normalized));
}

export function arrangeLockedTrees(board, nodeSize) {
  if (![...(board.nodes || []), ...(board.groups || [])].some((item) => normalizeTreeLock(item.treeLayoutLock))) return board;
  let ctx = context(board, nodeSize);
  const captures = new Map();
  for (const [key, item] of ctx.items) {
    const opts = normalizeTreeLock(item.treeLayoutLock);
    if (!opts) continue;
    const tree = new Set(buildTree(ctx.edges, key).order);
    const missing = ctx.groups.filter((g) => !g.locked && tree.has(edgeKey("group", g.id)) && !Object.hasOwn(opts.groupMembers || {}, g.id));
    if (!missing.length) continue;
    const groupMembers = { ...opts.groupMembers };
    for (const group of missing) groupMembers[group.id] = nodesInFrame(ctx.nodes, group, ctx.nodeSize);
    captures.set(key, { ...item, treeLayoutLock: { ...opts, groupMembers } });
  }
  if (captures.size) {
    board = { ...board,
      nodes: ctx.nodes.map((n) => captures.get(edgeKey("node", n.id)) || n),
      groups: ctx.groups.map((g) => captures.get(edgeKey("group", g.id)) || g)
    };
    ctx = context(board, nodeSize);
  }
  const owners = ownersIn(ctx);
  const positions = new Map();
  // Calculate against one snapshot so moving a group cannot capture cards
  // from another tree midway through this operation.
  for (const rootKey of new Set(owners.values())) {
    const opts = normalizeTreeLock(ctx.items.get(rootKey).treeLayoutLock);
    for (const [key, pos] of positionsFor(ctx, rootKey, opts, owners)) positions.set(key, pos);
  }
  return applyPositions(board, positions);
}
