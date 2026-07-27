// game-tools/client/src/lib/stroke.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { simplifyStroke, strokePath, strokesHitBy } from "./stroke.js";

test("simplifyStroke: bỏ điểm giữa thẳng hàng, giữ hai đầu", () => {
  assert.deepEqual(simplifyStroke([0, 0, 10, 0, 20, 0, 30, 0, 40, 0]), [0, 0, 40, 0]);
});

test("simplifyStroke: giữ điểm gãy góc", () => {
  assert.deepEqual(simplifyStroke([0, 0, 20, 0, 20, 20]), [0, 0, 20, 0, 20, 20]);
});

// Chuột bắn tới 1000 sự kiện/giây nên phần lớn điểm nằm sát điểm trước.
test("simplifyStroke: bỏ điểm cách điểm trước dưới 2px", () => {
  assert.deepEqual(simplifyStroke([0, 0, 1, 0, 20, 0]), [0, 0, 20, 0]);
});

test("simplifyStroke: làm tròn toạ độ về số nguyên", () => {
  assert.deepEqual(simplifyStroke([0.4, 0.6, 20.5, 0.2]), [0, 1, 21, 0]);
});

test("simplifyStroke: nét rỗng và nét một điểm không nổ", () => {
  assert.deepEqual(simplifyStroke([]), []);
  assert.deepEqual(simplifyStroke([5, 5]), [5, 5]);
});

// Một nét kéo dài thật sự phải co lại đáng kể — đây là lý do hàm này tồn tại.
test("simplifyStroke: nét dài rung nhẹ co lại còn rất ít điểm", () => {
  const pts = [];
  for (let i = 0; i <= 400; i++) pts.push(i, i % 2 === 0 ? 0 : 0.4);
  const out = simplifyStroke(pts);
  assert.ok(out.length / 2 < 30, "mong đợi dưới 30 điểm, có " + out.length / 2);
  assert.deepEqual(out.slice(0, 2), [0, 0], "phải giữ điểm đầu");
  assert.deepEqual(out.slice(-2), [400, 0], "phải giữ điểm cuối");
});

test("strokePath: sinh M/L đúng thứ tự", () => {
  assert.equal(strokePath([0, 0, 10, 5, 20, 0]), "M 0 0 L 10 5 L 20 0");
});

// Nét một điểm: chỉ có `M` thì SVG không vẽ gì cả. Thêm `L` về chính nó để
// stroke-linecap: round biến nó thành một dấu chấm.
test("strokePath: nét một điểm thành một dấu chấm", () => {
  assert.equal(strokePath([7, 8]), "M 7 8 L 7 8");
});

test("strokePath: nét rỗng trả chuỗi rỗng", () => {
  assert.equal(strokePath([]), "");
});

test("strokesHitBy: ngưỡng chạm là w/2 + radius", () => {
  const drawings = [{ id: 1, kind: "pen", color: "pen-red", w: 4, pts: [0, 0, 100, 0] }];
  // ngưỡng = 4/2 + 8 = 10
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 9 }, 8), [1]);
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 11 }, 8), []);
});

// Đo tới ĐOẠN THẲNG, không phải tới đỉnh: giữa một nét dài thì mọi đỉnh đều xa.
test("strokesHitBy: đo khoảng cách tới đoạn thẳng chứ không tới đỉnh", () => {
  const drawings = [{ id: 1, w: 2, pts: [0, 0, 100, 0] }];
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 0 }, 3), [1]);
});

test("strokesHitBy: trả nhiều id khi một điểm chạm nhiều nét", () => {
  const drawings = [
    { id: 1, w: 2, pts: [0, 0, 100, 0] },
    { id: 2, w: 2, pts: [50, -20, 50, 20] },
    { id: 3, w: 2, pts: [0, 500, 100, 500] }
  ];
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 0 }, 3), [1, 2]);
});

test("strokesHitBy: nét một điểm vẫn hit-test được", () => {
  assert.deepEqual(strokesHitBy([{ id: 1, w: 4, pts: [10, 10] }], { x: 12, y: 10 }, 8), [1]);
});

test("strokesHitBy: danh sách rỗng hoặc thiếu pts trả mảng rỗng", () => {
  assert.deepEqual(strokesHitBy([], { x: 0, y: 0 }, 8), []);
  assert.deepEqual(strokesHitBy([{ id: 1, w: 4 }], { x: 0, y: 0 }, 8), []);
});
