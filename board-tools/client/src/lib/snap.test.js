import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSnap } from "./snap.js";

test("hút mép trái vào mép trái đối tượng khác trong ngưỡng", () => {
  const moving = { x: 103, y: 0, w: 50, h: 50 };
  const others = [{ x: 100, y: 200, w: 50, h: 50 }];
  const r = computeSnap(moving, others, 6);
  assert.equal(r.dx, -3);
  assert.equal(r.guides.some((g) => g.axis === "v" && g.pos === 100), true);
});

test("hút tâm-với-tâm theo trục dọc", () => {
  const moving = { x: 0, y: 104, w: 50, h: 50 };   // tâm y = 129
  const others = [{ x: 200, y: 100, w: 50, h: 58 }]; // tâm y = 129 khi moving.y = 104? -> tính: 100+29=129; moving tâm 104+25=129 ✓ đã khớp
  const r0 = computeSnap(moving, others, 6);
  assert.equal(r0.dy, 0); // đã thẳng hàng thì không chỉnh
  const moving2 = { x: 0, y: 107, w: 50, h: 50 };  // tâm 132, lệch 3
  const r = computeSnap(moving2, others, 6);
  assert.equal(r.dy, -3);
});

test("ngoài ngưỡng thì không hút", () => {
  const r = computeSnap({ x: 110, y: 0, w: 50, h: 50 }, [{ x: 100, y: 200, w: 50, h: 50 }], 6);
  assert.equal(r.dx, 0);
  assert.equal(r.dy, 0);
  assert.equal(r.guides.length, 0);
});

test("chọn ứng viên gần nhất trên mỗi trục", () => {
  const moving = { x: 105, y: 0, w: 50, h: 50 };
  const others = [
    { x: 100, y: 200, w: 50, h: 50 },  // lệch 5
    { x: 104, y: 300, w: 50, h: 50 }   // lệch 1 → thắng
  ];
  const r = computeSnap(moving, others, 6);
  assert.equal(r.dx, -1);
});
