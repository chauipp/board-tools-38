import { test } from "node:test";
import assert from "node:assert/strict";
import { gridLayout } from "./layout.js";

test("xếp 4 item lưới 2 cột, cột/hàng theo item lớn nhất", () => {
  const items = [
    { id: 1, w: 100, h: 50 }, { id: 2, w: 120, h: 60 },
    { id: 3, w: 100, h: 40 }, { id: 4, w: 80, h: 50 }
  ];
  const pos = gridLayout(items, { x: 10, y: 20 }, 2, 24, 24);
  assert.deepEqual(pos.get(1), { x: 10, y: 20 });
  assert.deepEqual(pos.get(2), { x: 134, y: 20 });        // 10 + max(100,100)=100 + 24
  assert.deepEqual(pos.get(3), { x: 10, y: 104 });        // 20 + max(50,60)=60 + 24
  assert.deepEqual(pos.get(4), { x: 134, y: 104 });
});

test("1 cột khi cols=1", () => {
  const pos = gridLayout([{ id: 1, w: 50, h: 50 }, { id: 2, w: 50, h: 50 }], { x: 0, y: 0 }, 1);
  assert.deepEqual(pos.get(2), { x: 0, y: 74 });
});
