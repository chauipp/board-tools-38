// client/src/lib/stroke.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { simplifyStroke, strokePath, polylineHitBy, pointInPolygon } from "./stroke.js";

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

test("polylineHitBy: đo tới ĐOẠN THẲNG chứ không tới đỉnh", () => {
  // giữa một nét dài thì mọi đỉnh đều xa, chỉ khoảng cách tới đoạn mới đúng
  assert.equal(polylineHitBy([0, 0, 100, 0], { x: 50, y: 2 }, 3), true);
  assert.equal(polylineHitBy([0, 0, 100, 0], { x: 50, y: 4 }, 3), false);
});

test("polylineHitBy: đường một điểm đo bằng khoảng cách tới điểm đó", () => {
  assert.equal(polylineHitBy([10, 10], { x: 12, y: 10 }, 10), true);
  assert.equal(polylineHitBy([10, 10], { x: 30, y: 10 }, 10), false);
});

test("polylineHitBy: mảng rỗng không chạm gì", () => {
  assert.equal(polylineHitBy([], { x: 0, y: 0 }, 100), false);
});

test("pointInPolygon: phân biệt trong và ngoài", () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100, 0, 0];
  assert.equal(pointInPolygon(square, 50, 50), true);
  assert.equal(pointInPolygon(square, 150, 50), false);
  assert.equal(pointInPolygon(square, -1, 50), false);
  assert.equal(pointInPolygon(square, 50, 150), false);
});

// Đường bao hình đóng do shapeOutline sinh ra LUÔN lặp lại điểm đầu ở cuối, nên
// hàm này phải chịu được cạnh có độ dài 0.
test("pointInPolygon: chịu được điểm đầu lặp lại ở cuối", () => {
  const tri = [0, 0, 100, 0, 50, 80, 0, 0];
  assert.equal(pointInPolygon(tri, 50, 20), true);
  assert.equal(pointInPolygon(tri, 5, 70), false);
});

test("pointInPolygon: đa giác dưới 3 đỉnh luôn là ngoài", () => {
  assert.equal(pointInPolygon([0, 0, 10, 10], 5, 5), false);
  assert.equal(pointInPolygon([], 0, 0), false);
});
