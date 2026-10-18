// game-tools/client/src/lib/board-geometry.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInRect, nodesInFrame, edgeEndpoint, edgesMatch } from "./board-geometry.js";
import { clipToRect, rectForEndpoint } from "./board-geometry.js";

test("pointInRect: điểm trong và ngoài hình chữ nhật, biên tính là trong", () => {
  const rect = { x: 0, y: 0, w: 100, h: 50 };
  assert.equal(pointInRect(50, 25, rect), true);
  assert.equal(pointInRect(150, 25, rect), false);
  assert.equal(pointInRect(0, 0, rect), true);
  assert.equal(pointInRect(100, 50, rect), true);
});

test("nodesInFrame: chỉ trả về card có tâm nằm trong khung", () => {
  const frame = { x: 0, y: 0, w: 200, h: 200 };
  const nodes = [
    { id: 1, x: 10, y: 10 },  // tâm (30,30) khi w=h=40 -> trong
    { id: 2, x: 300, y: 10 }  // tâm (320,30) -> ngoài
  ];
  const sizeOf = () => ({ w: 40, h: 40 });
  assert.deepEqual(nodesInFrame(nodes, frame, sizeOf), [1]);
});

test("edgeEndpoint: tâm node và tâm group, null khi không tìm thấy", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }];
  const groups = [{ id: 1, x: 100, y: 100, w: 50, h: 50 }];
  const sizeOf = () => ({ w: 20, h: 20 });
  assert.deepEqual(edgeEndpoint("node", 1, nodes, groups, sizeOf), { x: 10, y: 10 });
  assert.deepEqual(edgeEndpoint("group", 1, nodes, groups, sizeOf), { x: 125, y: 125 });
  assert.equal(edgeEndpoint("node", 99, nodes, groups, sizeOf), null);
});

test("edgesMatch: phân biệt node và group dù trùng id số", () => {
  const e = { id: 1, from: 3, to: 3, fromKind: "node", toKind: "group" };
  assert.equal(edgesMatch(e, 3, "node", 3, "group"), true);
  assert.equal(edgesMatch(e, 3, "group", 3, "node"), true); // đối xứng
  assert.equal(edgesMatch(e, 3, "node", 3, "node"), false); // trùng id nhưng khác kind
});

test("edgesMatch: edge cũ không có fromKind/toKind mặc định hiểu là node", () => {
  const e = { id: 1, from: 5, to: 6 };
  assert.equal(edgesMatch(e, 5, "node", 6, "node"), true);
  assert.equal(edgesMatch(e, 5, "group", 6, "node"), false);
});

test("clipToRect: cắt đúng biên phải khi đích nằm ngang bên phải", () => {
  // rect tâm (0,0) rộng 100 cao 50; đích (200, 0) → giao tại (50, 0)
  assert.deepEqual(clipToRect(0, 0, 100, 50, 200, 0), { x: 50, y: 0 });
});

test("clipToRect: cắt biên dưới khi đích thẳng đứng bên dưới", () => {
  assert.deepEqual(clipToRect(0, 0, 100, 50, 0, 200), { x: 0, y: 25 });
});

test("clipToRect: đường chéo cắt cạnh gần hơn", () => {
  // đích (100, 100): t theo x = 50/100, theo y = 25/100 → y chạm trước → giao (25, 25)
  assert.deepEqual(clipToRect(0, 0, 100, 50, 100, 100), { x: 25, y: 25 });
});

test("clipToRect: đích trùng tâm trả về tâm (không chia 0)", () => {
  assert.deepEqual(clipToRect(0, 0, 100, 50, 0, 0), { x: 0, y: 0 });
});

test("rectForEndpoint: node dùng sizeOf, group dùng w/h, null khi không thấy", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }];
  const groups = [{ id: 1, x: 100, y: 100, w: 50, h: 50 }];
  const sizeOf = () => ({ w: 20, h: 20 });
  assert.deepEqual(rectForEndpoint("node", 1, nodes, groups, sizeOf), { cx: 10, cy: 10, w: 20, h: 20 });
  assert.deepEqual(rectForEndpoint("group", 1, nodes, groups, sizeOf), { cx: 125, cy: 125, w: 50, h: 50 });
  assert.equal(rectForEndpoint("node", 99, nodes, groups, sizeOf), null);
});
