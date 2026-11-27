import { test } from "node:test";
import assert from "node:assert/strict";
import { computeZoom, loadCamera, saveCamera } from "./camera.js";
import { MIN_SCALE, MAX_SCALE } from "./board-constants.js";

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


const rect = { left: 100, top: 50 };
const board = (view) => ({ nodes: [{ id: 1 }], view });

// Điểm canvas nằm dưới con trỏ trước và sau khi phóng phải trùng nhau: đó là
// toàn bộ ý nghĩa của "zoom quanh con trỏ".
function canvasPointUnder(view, screenX, screenY) {
  return { x: (screenX - rect.left - view.panX) / view.scale, y: (screenY - rect.top - view.panY) / view.scale };
}

test("phóng quanh con trỏ: điểm dưới con trỏ đứng yên", () => {
  const before = board({ panX: 30, panY: -20, scale: 1 });
  const after = computeZoom(before, rect, 400, 300, 1.5);
  assert.equal(after.view.scale, 1.5);
  const p0 = canvasPointUnder(before.view, 400, 300);
  const p1 = canvasPointUnder(after.view, 400, 300);
  assert.ok(Math.abs(p0.x - p1.x) < 1e-9 && Math.abs(p0.y - p1.y) < 1e-9);
});

test("kẹp scale trong [MIN_SCALE, MAX_SCALE]", () => {
  assert.equal(computeZoom(board({ panX: 0, panY: 0, scale: 2 }), rect, 0, 0, 10).view.scale, MAX_SCALE);
  assert.equal(computeZoom(board({ panX: 0, panY: 0, scale: 0.5 }), rect, 0, 0, 0.01).view.scale, MIN_SCALE);
});

test("chỉ đổi view, giữ nguyên phần còn lại của board", () => {
  const before = board({ panX: 0, panY: 0, scale: 1 });
  const after = computeZoom(before, rect, 200, 200, 1.2);
  assert.notEqual(after, before);
  assert.equal(after.nodes, before.nodes);
});
