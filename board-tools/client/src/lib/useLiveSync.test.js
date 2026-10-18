import { test } from "node:test";
import assert from "node:assert/strict";
import { isStaleUpdate, mergeRemoteBoard, projectGeometry, applyGeomOverlay } from "./useLiveSync.js";

test("isStaleUpdate: incoming with no timestamp is always stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:00.000Z", undefined), true);
});

test("isStaleUpdate: incoming newer than local is not stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z"), false);
});

test("isStaleUpdate: incoming equal to local is stale (already applied)", () => {
  const t = "2026-01-01T00:00:00.000Z";
  assert.equal(isStaleUpdate(t, t), true);
});

test("isStaleUpdate: incoming older than local is stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:01.000Z", "2026-01-01T00:00:00.000Z"), true);
});

test("isStaleUpdate: no local timestamp yet accepts any incoming update", () => {
  assert.equal(isStaleUpdate(null, "2026-01-01T00:00:00.000Z"), false);
});

test("mergeRemoteBoard: takes incoming content but keeps local view (camera stays private)", () => {
  const local = { nodes: [], edges: [], view: { panX: 10, panY: 20, scale: 1 } };
  const incoming = { nodes: [{ id: 1, title: "a" }], edges: [], view: { panX: 999, panY: 999, scale: 9 } };
  const merged = mergeRemoteBoard(local, incoming, null);
  assert.deepEqual(merged.nodes, [{ id: 1, title: "a" }]);
  assert.deepEqual(merged.view, { panX: 10, panY: 20, scale: 1 });
});

test("mergeRemoteBoard: preserves the node currently being edited locally, takes the rest", () => {
  const local = { nodes: [{ id: 1, title: "typing…" }, { id: 2, title: "old" }], view: {} };
  const incoming = { nodes: [{ id: 1, title: "SHOULD NOT WIN" }, { id: 2, title: "new from remote" }], view: {} };
  const merged = mergeRemoteBoard(local, incoming, 1);
  assert.deepEqual(merged.nodes, [{ id: 1, title: "typing…" }, { id: 2, title: "new from remote" }]);
});

test("mergeRemoteBoard: editingId with no matching local node just takes incoming as-is", () => {
  const local = { nodes: [{ id: 2, title: "old" }], view: {} };
  const incoming = { nodes: [{ id: 2, title: "new" }], view: {} };
  const merged = mergeRemoteBoard(local, incoming, 999);
  assert.deepEqual(merged.nodes, [{ id: 2, title: "new" }]);
});

test("projectGeometry strips content fields, keeps only position/size", () => {
  const board = {
    nodes: [{ id: 1, x: 10, y: 20, w: 210, title: "t", desc: "d", image: "data:image/png;base64,xxxx" }],
    groups: [{ id: 5, x: 0, y: 0, w: 300, h: 200, title: "frame" }]
  };
  assert.deepEqual(projectGeometry(board), {
    nodes: [{ id: 1, x: 10, y: 20, w: 210 }],
    groups: [{ id: 5, x: 0, y: 0, w: 300, h: 200 }]
  });
});

test("projectGeometry handles empty board content", () => {
  assert.deepEqual(projectGeometry({ nodes: [], groups: [] }), { nodes: [], groups: [] });
});

test("projectGeometry: node without a w (no explicit width set) omits w as undefined-passthrough", () => {
  const board = { nodes: [{ id: 2, x: 1, y: 2 }], groups: [] };
  assert.deepEqual(projectGeometry(board), { nodes: [{ id: 2, x: 1, y: 2, w: undefined }], groups: [] });
});

test("applyGeomOverlay returns the very same array when nothing is live", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }];
  assert.equal(applyGeomOverlay(nodes, new Map(), "node:"), nodes);
});

test("applyGeomOverlay moves only the items the overlay mentions", () => {
  const nodes = [{ id: 1, x: 0, y: 0, title: "a" }, { id: 2, x: 5, y: 5, title: "b" }];
  const out = applyGeomOverlay(nodes, new Map([["node:1", { x: 100, y: 200 }]]), "node:");
  assert.deepEqual(out[0], { id: 1, x: 100, y: 200, title: "a" });
  assert.equal(out[1], nodes[1], "untouched items keep their identity");
});

test("applyGeomOverlay takes w and h when the overlay carries them (frame resize)", () => {
  const groups = [{ id: 7, x: 0, y: 0, w: 10, h: 10, title: "f" }];
  const out = applyGeomOverlay(groups, new Map([["group:7", { x: 1, y: 2, w: 300, h: 200 }]]), "group:");
  assert.deepEqual(out[0], { id: 7, x: 1, y: 2, w: 300, h: 200, title: "f" });
});

test("applyGeomOverlay keeps the committed w when the overlay carries none", () => {
  const nodes = [{ id: 1, x: 0, y: 0, w: 210 }];
  const out = applyGeomOverlay(nodes, new Map([["node:1", { x: 9, y: 9, w: undefined }]]), "node:");
  assert.equal(out[0].w, 210);
});

test("applyGeomOverlay ignores overlay entries for a different kind (node vs group ids collide)", () => {
  const nodes = [{ id: 7, x: 0, y: 0 }];
  const out = applyGeomOverlay(nodes, new Map([["group:7", { x: 999, y: 999 }]]), "node:");
  assert.equal(out[0], nodes[0]);
});
