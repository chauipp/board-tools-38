import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNodeFilter, focusNeighborhood } from "./board-filters.js";

const none = { filterStatus: {}, filterTags: {}, filterFav: false, search: "" };

test("buildNodeFilter: không bật gì thì mọi thẻ đều qua", () => {
  const passes = buildNodeFilter(none);
  assert.equal(passes({ title: "a", desc: "", statusId: null, tagId: null }), true);
});

test("buildNodeFilter: lọc theo trạng thái, kể cả khoá none", () => {
  const passes = buildNodeFilter({ ...none, filterStatus: { 2: true, none: true, 3: false } });
  assert.equal(passes({ title: "", desc: "", statusId: 2 }), true);
  assert.equal(passes({ title: "", desc: "", statusId: null }), true);
  assert.equal(passes({ title: "", desc: "", statusId: 3 }), false);
});

test("buildNodeFilter: nhãn, yêu thích và từ khoá (không phân biệt hoa thường, cả mô tả)", () => {
  const passes = buildNodeFilter({ ...none, filterTags: { 1: true }, filterFav: true, search: "  Rồng " });
  assert.equal(passes({ title: "Con rồng", desc: "", tagId: 1, favorites: ["x"] }), true);
  assert.equal(passes({ title: "Mèo", desc: "có RỒNG", tagId: 1, favorites: ["x"] }), true);
  assert.equal(passes({ title: "Con rồng", desc: "", tagId: 2, favorites: ["x"] }), false);
  assert.equal(passes({ title: "Con rồng", desc: "", tagId: 1, favorites: [] }), false);
  assert.equal(passes({ title: "Mèo", desc: "", tagId: 1, favorites: ["x"] }), false);
});

test("focusNeighborhood: thẻ cách ≤2 bước, bỏ qua dây dính khung", () => {
  const nodes = [1, 2, 3, 4, 5].map((id) => ({ id }));
  const edges = [
    { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 },
    { from: 1, to: 5, toKind: "group" }
  ];
  assert.deepEqual([...focusNeighborhood(nodes, edges, 1)].sort(), [1, 2, 3]);
});

test("focusNeighborhood: không tập trung hoặc thẻ đã mất → null", () => {
  assert.equal(focusNeighborhood([{ id: 1 }], [], null), null);
  assert.equal(focusNeighborhood([{ id: 1 }], [], 9), null);
});
