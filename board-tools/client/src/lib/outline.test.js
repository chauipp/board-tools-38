import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutline, outlineToMarkdown } from "./outline.js";

const sizeOf = () => ({ w: 100, h: 50 });
const board = {
  nodes: [
    { id: 1, title: "Trong khung", desc: "mô tả", statusId: 1, tagId: 1, x: 10, y: 10 },
    { id: 2, title: "Ngoài A", desc: "", statusId: 1, tagId: null, x: 500, y: 10 },
    { id: 3, title: "Ngoài B", desc: "hai\ndòng", statusId: null, tagId: null, x: 500, y: 200 }
  ],
  groups: [{ id: 1, title: "Khung 1", x: 0, y: 0, w: 200, h: 200, color: null }],
  edges: [
    { id: 1, from: 1, to: 2 },
    { id: 2, from: 1, fromKind: "group", to: 3, toKind: "node" }
  ],
  statuses: [{ id: 1, name: "Đã chọn", color: "st-chosen" }],
  tags: [{ id: 1, name: "Cơ chế", color: "dot-1" }]
};

test("buildOutline: card trong khung theo hình học, card ngoài nhóm theo status", () => {
  const o = buildOutline(board, sizeOf);
  assert.deepEqual(o.frames.map((f) => f.nodeIds), [[1]]);
  assert.deepEqual(o.byStatus.get(1), [2]);
  assert.deepEqual(o.byStatus.get("none"), [3]);
});

test("outlineToMarkdown: đủ section khung, status, Khác, Liên kết; desc xuống dòng thành 1 dòng", () => {
  const md = outlineToMarkdown(board, sizeOf, { other: "Khác", links: "Liên kết" });
  assert.equal(md.includes("## Khung 1"), true);
  assert.equal(md.includes("- Trong khung (Đã chọn, Cơ chế): mô tả"), true);
  assert.equal(md.includes("## Đã chọn"), true);
  assert.equal(md.includes("- Ngoài A (Đã chọn)"), true);
  assert.equal(md.includes("## Khác"), true);
  assert.equal(md.includes("- Ngoài B: hai dòng"), true);
  assert.equal(md.includes("## Liên kết"), true);
  assert.equal(md.includes("- Trong khung → Ngoài A"), true);
  assert.equal(md.includes("- Khung 1 → Ngoài B"), true);
});
