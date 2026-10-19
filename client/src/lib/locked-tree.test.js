import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTreeLock, treeLockOwners, arrangeTree, arrangeLockedTrees } from "./locked-tree.js";

const opts = (directions = ["down"]) => ({ directions, depth: 70, breadth: 28, leaf: 20 });
const size = () => ({ w: 100, h: 40 });
const node = (id, extra = {}) => ({ id, x: 500, y: 300, ...extra });
const edge = (from, to, extra = {}) => ({ from, to, ...extra });
const board = (nodes, edges = [], groups = []) => ({ nodes, edges, groups });
const xy = (n) => ({ x: n.x, y: n.y });
const find = (b, id) => b.nodes.find((n) => n.id === id);

function noOverlap(nodes, sizeOf = size) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = { ...nodes[i], ...sizeOf(nodes[i].id) };
      const b = { ...nodes[j], ...sizeOf(nodes[j].id) };
      assert.equal(a.x < b.x + b.w && b.x < a.x + a.w &&
        a.y < b.y + b.h && b.y < a.y + a.h, false, `${a.id} overlaps ${b.id}`);
    }
  }
}

test("normalizeTreeLock bounds finite gaps, deduplicates directions and copies input", () => {
  const input = { directions: ["left", "down", "left"], depth: 999, breadth: -3, leaf: 0, ignored: true };
  assert.deepEqual(normalizeTreeLock(input), { directions: ["left", "down"], depth: 400, breadth: 8, leaf: 4 });
  assert.deepEqual(input.directions, ["left", "down", "left"]);
  const normalized = normalizeTreeLock(opts());
  assert.deepEqual(normalized, opts());
  assert.notEqual(normalized.directions, input.directions);
});

test("invalid configurations are ignored without changing the board", () => {
  const invalid = [null, false, [], {}, { ...opts(), directions: [] },
    { ...opts(), directions: "down" }, { ...opts(), directions: ["diagonal"] },
    { ...opts(), directions: ["down", "invalid"] }, { ...opts(), depth: NaN },
    { ...opts(), breadth: Infinity }, { ...opts(), leaf: "20" }, { directions: ["down"] }];
  for (const config of invalid) {
    assert.equal(normalizeTreeLock(config), null);
    const b = board([node(1, { treeLayoutLock: config }), node(2)], [edge(1, 2)]);
    assert.equal(treeLockOwners(b, size).size, 0);
    assert.equal(arrangeLockedTrees(b, size), b);
    assert.equal(arrangeTree(b, "node", 1, config, size), b);
  }
});

for (const direction of ["down", "up", "right", "left"]) {
  test(`adding descendants reflows without overlap: ${direction}`, () => {
    const unrelated = node(90, { x: 9000, y: 9000 });
    const b = board([node(1, { treeLayoutLock: opts([direction]) }), node(2), node(3), unrelated, node(91)],
      [edge(1, 2), edge(1, 3), edge(90, 91)]);
    const first = arrangeLockedTrees(b, size);
    const added = { ...first, nodes: [...first.nodes, node(4), node(5)],
      edges: [...first.edges, edge(2, 4), edge(2, 5)] };
    const saved = structuredClone(added);
    const result = arrangeLockedTrees(added, size);
    noOverlap(result.nodes.filter((n) => n.id < 90));
    assert.deepEqual(xy(find(result, 1)), { x: 500, y: 300 });
    assert.notDeepEqual(xy(find(result, 3)), xy(find(first, 3)));
    assert.equal(find(result, 90), unrelated);
    assert.equal(find(result, 91), find(first, 91));
    assert.equal(result.edges, added.edges);
    assert.deepEqual(added, saved);
    assert.equal(arrangeLockedTrees(result, size), result);
    const child = find(result, 2);
    assert.equal(direction === "down" ? child.y > 300 : direction === "up" ? child.y < 300 :
      direction === "right" ? child.x > 500 : child.x < 500, true);
  });
}

test("multiple persisted directions and independent locked roots use their own options", () => {
  const b = board([node(1, { treeLayoutLock: opts(["down", "up", "right", "left"]) }),
    ...[2, 3, 4, 5].map((id) => node(id)),
    node(10, { x: 4000, treeLayoutLock: { ...opts(["right"]), depth: 200 } }), node(11)],
  [edge(1, 2), edge(1, 3), edge(1, 4), edge(1, 5), edge(10, 11)]);
  const result = arrangeLockedTrees(b, size);
  assert.deepEqual([2, 3, 4, 5].map((id) => xy(find(result, id))),
    [{ x: 500, y: 410 }, { x: 500, y: 190 }, { x: 670, y: 300 }, { x: 330, y: 300 }]);
  assert.deepEqual(xy(find(result, 11)), { x: 4300, y: 300 });
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("deletion reflows surviving siblings and dangling edges cannot bridge missing nodes", () => {
  const b = arrangeLockedTrees(board([node(1, { treeLayoutLock: opts() }), node(2), node(3), node(4)],
    [edge(1, 2), edge(1, 3), edge(2, 4)]), size);
  const deleted = { ...b, nodes: b.nodes.filter((n) => n.id !== 2) };
  const result = arrangeLockedTrees(deleted, size);
  assert.deepEqual(xy(find(result, 3)), { x: 500, y: 410 });
  assert.equal(find(result, 4), find(deleted, 4));
  assert.equal(treeLockOwners(result, size).has("node:4"), false);
  assert.equal(result.edges, deleted.edges);
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("outermost root wins even when nested root sorts first", () => {
  const b = board([node(1, { treeLayoutLock: opts(["left"]) }),
    node(9, { treeLayoutLock: opts(["right"]) }), node(2)], [edge(9, 1), edge(1, 2)]);
  assert.deepEqual([...treeLockOwners(b, size).values()], ["node:9", "node:9", "node:9"]);
  const result = arrangeLockedTrees(b, size);
  assert.deepEqual(xy(find(result, 1)), { x: 670, y: 300 });
  assert.deepEqual(xy(find(result, 2)), { x: 840, y: 300 });
  assert.equal(find(result, 1).treeLayoutLock, find(b, 1).treeLayoutLock);
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("cycles elect a stable root independent of node and edge order", () => {
  const b = board([node(2, { treeLayoutLock: opts(["left"]) }),
    node(1, { treeLayoutLock: opts(["right"]) }), node(3)],
  [edge(2, 3), edge(3, 1), edge(1, 2), edge(1, 1)]);
  const owners = treeLockOwners(b, size);
  assert.equal(owners.size, 3);
  assert.equal([...owners.values()].every((owner) => owner === "node:1"), true);
  const reversed = { ...b, nodes: [...b.nodes].reverse(), edges: [...b.edges].reverse() };
  assert.deepEqual(treeLockOwners(reversed, size), owners);
  const result = arrangeLockedTrees(b, size);
  assert.deepEqual(xy(find(result, 3)), { x: 840, y: 300 });
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("overlapping trees move shared descendants only under their elected owner", () => {
  const b = board([node(9, { x: 3000, treeLayoutLock: opts(["left"]) }),
    node(1, { treeLayoutLock: opts(["right"]) }), node(3), node(4), node(10)],
  [edge(9, 3), edge(1, 3), edge(3, 4), edge(9, 10)]);
  const owners = treeLockOwners(b, size);
  assert.equal(owners.get("node:3"), "node:1");
  assert.equal(owners.get("node:4"), "node:1");
  assert.equal(owners.get("node:10"), "node:9");
  const result = arrangeLockedTrees(b, size);
  assert.deepEqual(xy(find(result, 3)), { x: 670, y: 300 });
  assert.deepEqual(xy(find(result, 4)), { x: 840, y: 300 });
  assert.deepEqual(xy(find(result, 10)), { x: 2830, y: 300 });
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("groups carry unconnected members, preserve explicit positions and manual node locks", () => {
  const group = { id: "g", x: 0, y: 0, w: 300, h: 200 };
  const b = board([node("root", { treeLayoutLock: opts(["right"]) }),
    node(2, { x: 20, y: 20 }), node(3, { x: 30, y: 30, locked: true }),
    node(4, { x: 40, y: 40 }), node(5, { x: 1000, locked: true })],
  [edge("root", "g", { toKind: "group" }), edge("g", 4, { fromKind: "group" }), edge(4, 5)], [group]);
  const owners = treeLockOwners(b, size);
  assert.equal(owners.get("group:g"), "node:root");
  assert.equal(owners.get("node:2"), "node:root");
  assert.equal(owners.get("node:3"), "node:root");
  const result = arrangeLockedTrees(b, size);
  assert.deepEqual(xy(result.groups[0]), { x: 670, y: 220 });
  assert.deepEqual(xy(find(result, 2)), { x: 690, y: 240 });
  assert.deepEqual(xy(find(result, 4)), { x: 1040, y: 300 });
  assert.equal(find(result, 3), find(b, 3));
  assert.equal(find(result, 5), find(b, 5));
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("manually locked group does not move or carry members", () => {
  const group = { id: 1, x: 0, y: 0, w: 300, h: 200, locked: true };
  const b = board([node(1, { treeLayoutLock: opts() }), node(2, { x: 20, y: 20 })],
    [edge(1, 1, { toKind: "group" })], [group]);
  assert.equal(treeLockOwners(b, size).get("node:2"), "node:1");
  assert.equal(arrangeLockedTrees(b, size), b);
});

test("group root is anchored exactly, including fractional coordinates and contained root", () => {
  const group = { id: "frame", x: 0.25, y: 0.75, w: 300, h: 200, treeLayoutLock: opts(["right"]) };
  const b = board([node(1, { x: 20, y: 20, treeLayoutLock: opts(["down"]) }), node(2)],
    [edge("frame", 2, { fromKind: "group" })], [group]);
  assert.equal(treeLockOwners(b, size).get("node:1"), "group:frame");
  const result = arrangeLockedTrees(b, size);
  assert.deepEqual(xy(result.groups[0]), xy(group));
  assert.equal(find(result, 1), find(b, 1));
  assert.deepEqual(xy(find(result, 2)), { x: 370, y: 81 });
  assert.equal(arrangeLockedTrees(result, size), result);
});

test("reflowing a group never captures an independent tree it moves over", () => {
  const b = board([
    node(1, { treeLayoutLock: opts(["right"]) }),
    node(2, { x: 700, y: 250, treeLayoutLock: opts(["right"]) }),
    node(3, { x: 870, y: 250 })
  ], [edge(1, 1, { toKind: "group" }), edge(2, 3)],
  [{ id: 1, x: 0, y: 0, w: 300, h: 200 }]);
  const first = arrangeLockedTrees(b, size);
  assert.equal(treeLockOwners(first, size).get("node:2"), "node:2");
  assert.equal(treeLockOwners(first, size).get("node:3"), "node:2");
  assert.equal(arrangeLockedTrees(first, size), first);
  const changed = { ...first, nodes: first.nodes.map((n) => n.id === 1
    ? { ...n, treeLayoutLock: { ...n.treeLayoutLock, depth: 170 } } : n) };
  const result = arrangeLockedTrees(changed, size);
  assert.deepEqual(xy(find(result, 2)), xy(find(first, 2)));
  assert.deepEqual(xy(find(result, 3)), xy(find(first, 3)));
  assert.deepEqual(xy(result.groups[0]), { x: 770, y: 220 });
});

test("arrangeTree honors measured sizes and newly created card width/PDF height", () => {
  const b = board([node(1, { w: 420, pdfH: 500, type: "pdf" }), node(2), node(3, { w: 300 })],
    [edge(1, 2), edge(1, 3)]);
  const result = arrangeTree(b, "node", 1, opts(), (id) => ({ w: 100, h: id === 1 ? 550 : 40 }));
  assert.equal(find(result, 2).y, 920);
  assert.equal(find(result, 3).x - find(result, 2).x, 120);
  const added = arrangeTree(b, "node", 1, opts(), size);
  assert.equal(find(added, 2).y, 870);
  noOverlap(added.nodes, (id) => id === 1 ? { w: 420, h: 500 } : { w: id === 3 ? 300 : 100, h: 40 });
});

test("missing roots, isolated fractional roots and empty boards preserve identity", () => {
  const b = board([node(1, { x: 0.25, y: -0.75 })]);
  assert.equal(arrangeTree(b, "node", 1, opts(), size), b);
  assert.equal(arrangeTree(b, "node", 99, opts(), size), b);
  assert.equal(arrangeTree(b, "invalid", 1, opts(), size), b);
  const empty = board([]);
  assert.equal(arrangeLockedTrees(empty, size), empty);
});

test("undirected and incoming edges do not grant ownership or move items", () => {
  const b = board([node(1, { treeLayoutLock: opts() }), node(2), node(3)],
    [edge(1, 2, { arrow: "none" }), edge(3, 1)]);
  assert.deepEqual([...treeLockOwners(b, size)], [["node:1", "node:1"]]);
  assert.equal(arrangeLockedTrees(b, size), b);
});
