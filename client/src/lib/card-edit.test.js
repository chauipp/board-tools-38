import test from "node:test";
import assert from "node:assert/strict";
import { cardEditConflicts } from "./card-edit.js";

test("a draft title conflicts with a newer different title but not with peer geometry", () => {
  const original = { title: "Original", x: 0, desc: "" };
  const current = { title: "Server name", x: 50, desc: "Server description" };
  assert.deepEqual(cardEditConflicts(original, current, { title: "Draft name" }), [
    { field: "title", server: "Server name", draft: "Draft name" }
  ]);
  assert.deepEqual(cardEditConflicts(original, current, { title: "Server name" }), []);
  assert.deepEqual(cardEditConflicts(original, { ...original, x: 50 }, { title: "Draft name" }), []);
});

test("Game Design edits compare changed design fields individually", () => {
  const base = { design: { goal: "Original goal", rules: "" } };
  const current = { design: { goal: "Server goal", rules: "Server rule" } };
  assert.deepEqual(cardEditConflicts(base, current, { design: { goal: "Draft goal" } }), [
    { field: "design.goal", server: "Server goal", draft: "Draft goal" }
  ]);
  assert.deepEqual(cardEditConflicts(base, current, { desc: "Draft description" }), []);
});
