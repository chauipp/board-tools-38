// game-tools/client/src/lib/board-geometry.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInRect, nodesInFrame, edgeEndpoint, edgesMatch } from "./board-geometry.js";

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
