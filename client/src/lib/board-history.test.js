import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileHistory } from "./board-history.js";

const beforeDrag = { nodes: [{ id: 1, x: 0, title: "Dash" }] };
const afterDrag = { nodes: [{ id: 1, x: 50, title: "Dash" }] };

test("a peer's edit and new card survive local undo after a drag", () => {
  const remote = { nodes: [{ id: 1, x: 50, title: "Air Dash" }, { id: 2, x: 100, title: "VFX" }] };
  const [undoTarget] = reconcileHistory([beforeDrag], afterDrag, remote);
  assert.deepEqual(undoTarget.nodes, [{ id: 1, x: 0, title: "Air Dash" }, remote.nodes[1]]);
});

test("an unsafe snapshot and every older snapshot are discarded", () => {
  const remote = { nodes: [{ id: 1, x: 70, title: "Dash" }] };
  assert.deepEqual(reconcileHistory([beforeDrag, afterDrag], afterDrag, remote).map((board) => board.nodes), [remote.nodes]);
});

test("undo cannot remove a card that a peer just linked to", () => {
  const beforeAdd = { nodes: [{ id: 1 }], edges: [] };
  const afterAdd = { nodes: [{ id: 1 }, { id: 2 }], edges: [] };
  const remote = { ...afterAdd, edges: [{ id: 1, from: 1, to: 2 }] };
  assert.deepEqual(reconcileHistory([beforeAdd], afterAdd, remote), []);
});
