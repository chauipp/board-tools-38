// game-tools/client/src/lib/place-node.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeLinkedNode, parentNodeId } from "./place-node.js";

const ANCHOR = { x: 0, y: 0, w: 200, h: 100 };
const SIZE = { w: 200, h: 180 };

// Tâm thẻ mới cách tâm anchor đúng (anchor/2 + gap + size/2) theo trục đã bấm;
// trục còn lại hai tâm thẳng hàng.
test("placeLinkedNode: không vật cản thì đặt sát anchor theo đúng hướng", () => {
  const base = { anchor: ANCHOR, size: SIZE, obstacles: [], gap: 70 };
  assert.deepEqual(placeLinkedNode({ ...base, direction: "right" }), { x: 270, y: -40, panTo: null });
  assert.deepEqual(placeLinkedNode({ ...base, direction: "left" }), { x: -270, y: -40, panTo: null });
  assert.deepEqual(placeLinkedNode({ ...base, direction: "bottom" }), { x: 0, y: 170, panTo: null });
  assert.deepEqual(placeLinkedNode({ ...base, direction: "top" }), { x: 0, y: -250, panTo: null });
});

// Đây là lỗi cũ của createLinkedNode: bước đẩy cộng thêm STEP vào trục vuông
// góc, nên bấm ↓ thì thẻ trôi chéo sang phải.
test("placeLinkedNode: đẩy qua vật cản giữ nguyên trục vuông góc", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "bottom",
    obstacles: [{ x: 0, y: 170, w: 200, h: 180 }],
    gap: 70,
    step: 60
  });
  assert.equal(res.x, 0, "x không được đổi khi đẩy theo trục dọc");
  assert.ok(res.y > 170, "phải đẩy xuống khỏi vật cản");
});

test("placeLinkedNode: đẩy nhiều bước liên tiếp qua chuỗi vật cản", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "right",
    // Chắn liên tục từ 270 tới 570 — chỗ trống đầu tiên là 570 trở đi.
    obstacles: [
      { x: 270, y: -40, w: 200, h: 180 },
      { x: 330, y: -40, w: 200, h: 180 },
      { x: 390, y: -40, w: 200, h: 180 }
    ],
    gap: 70,
    step: 60
  });
  assert.equal(res.y, -40);
  assert.equal(res.x, 630);
});

test("placeLinkedNode: vật cản lệch trục không chặn vị trí đầu tiên", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "right",
    obstacles: [{ x: 270, y: 400, w: 200, h: 180 }],
    gap: 70,
    step: 60
  });
  assert.deepEqual(res, { x: 270, y: -40, panTo: null });
});

// Board dày đặc: thà trả vị trí chồng còn hơn quét lưới rồi ném thẻ vào chỗ
// chẳng liên quan gì tới hướng đã bấm.
test("placeLinkedNode: chạm maxSteps thì nhận vị trí cuối cùng", () => {
  const obstacles = [];
  for (let i = 0; i < 50; i++) obstacles.push({ x: 270 + i * 60, y: -40, w: 200, h: 180 });
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "right",
    obstacles,
    gap: 70,
    step: 60,
    maxSteps: 3
  });
  assert.equal(res.y, -40);
  assert.equal(res.x, 270 + 3 * 60);
});

test("placeLinkedNode: nằm gọn trong khung nhìn thì không cần pan", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "right",
    obstacles: [],
    viewport: { x0: -1000, y0: -1000, x1: 1000, y1: 1000 },
    gap: 70
  });
  assert.equal(res.panTo, null);
});

// panTo là tâm thẻ mới trong toạ độ canvas; IdeaMap tự quy ra panX/panY.
test("placeLinkedNode: ra ngoài khung nhìn thì trả tâm thẻ để pan tới", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "right",
    obstacles: [],
    viewport: { x0: -100, y0: -100, x1: 300, y1: 300 },
    gap: 70
  });
  assert.equal(res.x, 270);
  assert.deepEqual(res.panTo, { x: 270 + 100, y: -40 + 90 });
});

test("placeLinkedNode: thẻ ló một phần ra ngoài cũng phải pan", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "bottom",
    obstacles: [],
    // Thẻ chiếm y 170..350, khung nhìn cắt ở 300.
    viewport: { x0: -1000, y0: -1000, x1: 1000, y1: 300 },
    gap: 70
  });
  assert.notEqual(res.panTo, null);
  assert.deepEqual(res.panTo, { x: 100, y: 260 });
});

test("placeLinkedNode: không truyền viewport thì không bao giờ pan", () => {
  const res = placeLinkedNode({
    anchor: ANCHOR,
    size: SIZE,
    direction: "top",
    obstacles: [],
    gap: 70
  });
  assert.equal(res.panTo, null);
});

test("placeLinkedNode: hướng lạ coi như sang phải", () => {
  const res = placeLinkedNode({ anchor: ANCHOR, size: SIZE, direction: "nowhere", obstacles: [], gap: 70 });
  assert.deepEqual(res, { x: 270, y: -40, panTo: null });
});

test("parentNodeId: lấy đầu `from` của dây trỏ vào thẻ", () => {
  const edges = [{ id: 1, from: 1, to: 2 }, { id: 2, from: 2, to: 3 }];
  assert.equal(parentNodeId(edges, 2), 1);
  assert.equal(parentNodeId(edges, 3), 2);
});

test("parentNodeId: thẻ gốc không có cha", () => {
  const edges = [{ id: 1, from: 1, to: 2 }];
  assert.equal(parentNodeId(edges, 1), null);
  assert.equal(parentNodeId(edges, 99), null);
});

// Thẻ nằm trong một khung có dây khung→thẻ, nhưng khung không phải một cấp
// trong cây ý tưởng — Shift+Enter ở thẻ đó phải coi như không có cha.
test("parentNodeId: bỏ qua dây đi từ khung", () => {
  const edges = [{ id: 1, from: 7, to: 2, fromKind: "group" }];
  assert.equal(parentNodeId(edges, 2), null);
});

test("parentNodeId: bỏ qua dây trỏ vào một khung trùng số hiệu", () => {
  const edges = [{ id: 1, from: 1, to: 2, toKind: "group" }];
  assert.equal(parentNodeId(edges, 2), null);
});

test("parentNodeId: nhiều cha thì lấy dây đầu tiên", () => {
  const edges = [{ id: 1, from: 5, to: 9 }, { id: 2, from: 6, to: 9 }];
  assert.equal(parentNodeId(edges, 9), 5);
});

test("placeLinkedNode: toạ độ trả về luôn là số nguyên", () => {
  const res = placeLinkedNode({
    anchor: { x: 0.5, y: 0.5, w: 201, h: 101 },
    size: { w: 200, h: 180 },
    direction: "right",
    obstacles: [],
    gap: 70
  });
  assert.equal(Number.isInteger(res.x), true);
  assert.equal(Number.isInteger(res.y), true);
});
