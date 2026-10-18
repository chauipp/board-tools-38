import { test } from "node:test";
import assert from "node:assert/strict";
import { gridLayout, layerLayout } from "./layout.js";

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

const CARD = (id) => ({ id, w: 100, h: 40 });
const O = { x: 0, y: 0 };

test("chuỗi 1→2→3 ra ba cột, mỗi dây vượt đúng một cột", () => {
  const pos = layerLayout([CARD(1), CARD(2), CARD(3)], [{ from: 1, to: 2 }, { from: 2, to: 3 }], O, 90, 28);
  assert.deepEqual(pos.get(1), { x: 0, y: 0 });
  assert.deepEqual(pos.get(2), { x: 190, y: 0 });
  assert.deepEqual(pos.get(3), { x: 380, y: 0 });
});

test("hai con cùng một cha xếp dọc trong một cột, không thẻ nào đứng trên dây", () => {
  const pos = layerLayout([CARD(1), CARD(2), CARD(3)], [{ from: 1, to: 2 }, { from: 1, to: 3 }], O, 90, 28);
  assert.deepEqual(pos.get(2), { x: 190, y: 0 });
  assert.deepEqual(pos.get(3), { x: 190, y: 68 });
});

test("đường dài quyết định cột: 1→3 và 1→2→3 thì 3 sang cột 2", () => {
  const pos = layerLayout([CARD(1), CARD(2), CARD(3)],
    [{ from: 1, to: 3 }, { from: 1, to: 2 }, { from: 2, to: 3 }], O, 90, 28);
  assert.deepEqual(pos.get(3), { x: 380, y: 0 });
});

test("chu trình không làm treo, vẫn ra vị trí cho mọi thẻ", () => {
  const pos = layerLayout([CARD(1), CARD(2), CARD(3)],
    [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 1 }], O, 90, 28);
  assert.equal(pos.size, 3);
});

test("thẻ rời thành khối lưới dưới phần có dây", () => {
  const pos = layerLayout([CARD(1), CARD(2), CARD(3), CARD(4)],
    [{ from: 1, to: 2 }], O, 90, 28);
  // cột 0 cao 40 → khối rời bắt đầu ở 40 + 90
  assert.deepEqual(pos.get(3), { x: 0, y: 130 });
  assert.deepEqual(pos.get(4), { x: 128, y: 130 });
});

test("không có dây nào thì y như lưới vuông tại gốc", () => {
  const items = [CARD(1), CARD(2), CARD(3), CARD(4)];
  assert.deepEqual(layerLayout(items, [], O, 90, 28), gridLayout(items, O, 2, 28, 28));
});

test("bỏ qua cạnh trỏ ra ngoài tập đang xếp", () => {
  const pos = layerLayout([CARD(1), CARD(2)], [{ from: 1, to: 99 }, { from: 7, to: 2 }], O, 90, 28);
  assert.deepEqual(layerLayout([CARD(1), CARD(2)], [], O, 90, 28), pos);
});

test("cạnh tự nối không đẩy thẻ sang cột khác", () => {
  const pos = layerLayout([CARD(1), CARD(2)], [{ from: 1, to: 1 }, { from: 1, to: 2 }], O, 90, 28);
  assert.deepEqual(pos.get(1), { x: 0, y: 0 });
  assert.deepEqual(pos.get(2), { x: 190, y: 0 });
});
