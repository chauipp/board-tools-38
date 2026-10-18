import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCamera, saveCamera } from "./camera.js";

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v)
  };
}

test("saveCamera then loadCamera round-trips the view for a board", () => {
  const storage = fakeStorage();
  saveCamera(storage, "board-1", { panX: 10, panY: -5, scale: 1.5 });
  assert.deepEqual(loadCamera(storage, "board-1"), { panX: 10, panY: -5, scale: 1.5 });
});

test("loadCamera returns null when nothing saved for that board", () => {
  assert.equal(loadCamera(fakeStorage(), "board-1"), null);
});

test("loadCamera keeps cameras for different boards independent", () => {
  const storage = fakeStorage();
  saveCamera(storage, "board-1", { panX: 1, panY: 2, scale: 1 });
  saveCamera(storage, "board-2", { panX: 9, panY: 9, scale: 2 });
  assert.deepEqual(loadCamera(storage, "board-1"), { panX: 1, panY: 2, scale: 1 });
  assert.deepEqual(loadCamera(storage, "board-2"), { panX: 9, panY: 9, scale: 2 });
});

test("loadCamera returns null for malformed JSON instead of throwing", () => {
  const storage = fakeStorage();
  storage.setItem("idea-map-camera:board-1", "{not json");
  assert.equal(loadCamera(storage, "board-1"), null);
});

test("loadCamera returns null for a value missing required numeric fields", () => {
  const storage = fakeStorage();
  storage.setItem("idea-map-camera:board-1", JSON.stringify({ panX: 1 }));
  assert.equal(loadCamera(storage, "board-1"), null);
});
