import { test } from "node:test";
import assert from "node:assert/strict";
import { paletteCss, applyColorTo, removePaletteColor } from "./palette.js";

function makeBoard() {
  return {
    palette: [{ id: 1, hex: "#ff0000" }, { id: 2, hex: "#00ff00" }],
    nextPaletteId: 3,
    nodes: [{ id: 10, color: "pal-1" }, { id: 11, color: "dot-3" }],
    edges: [{ id: 20, color: "pal-1" }, { id: 21 }],
    statuses: [{ id: 30, name: "A", color: "pal-1" }, { id: 31, name: "B", color: "st-chosen" }],
    tags: [{ id: 40, name: "C", color: "pal-2" }]
  };
}

test("paletteCss khai báo biến cho từng màu", () => {
  assert.equal(
    paletteCss([{ id: 1, hex: "#ff0000" }, { id: 2, hex: "#00ff00" }]),
    ":root {\n  --pal-1: #ff0000;\n  --pal-2: #00ff00;\n}"
  );
});

test("paletteCss rỗng → chuỗi rỗng, không sinh block vô nghĩa", () => {
  assert.equal(paletteCss([]), "");
});

test("applyColorTo ghi màu đúng thực thể, không đụng thực thể khác", () => {
  const b = makeBoard();
  const afterNode = applyColorTo(b, { kind: "node", id: 11 }, "pal-2");
  assert.equal(afterNode.nodes.find((n) => n.id === 11).color, "pal-2");
  assert.equal(afterNode.nodes.find((n) => n.id === 10).color, "pal-1");

  assert.equal(applyColorTo(b, { kind: "edge", id: 21 }, "pal-2").edges.find((e) => e.id === 21).color, "pal-2");
  assert.equal(applyColorTo(b, { kind: "status", id: 31 }, "pal-1").statuses.find((s) => s.id === 31).color, "pal-1");
  assert.equal(applyColorTo(b, { kind: "tag", id: 40 }, "dot-5").tags.find((tg) => tg.id === 40).color, "dot-5");
  // board gốc không bị đổi
  assert.equal(b.nodes.find((n) => n.id === 11).color, "dot-3");
});

test("applyColorTo với kind lạ → trả board nguyên vẹn", () => {
  const b = makeBoard();
  assert.equal(applyColorTo(b, { kind: "group", id: 1 }, "pal-1"), b);
});

test("removePaletteColor gỡ token khỏi mọi chỗ đang dùng", () => {
  const next = removePaletteColor(makeBoard(), 1);
  assert.deepEqual(next.palette, [{ id: 2, hex: "#00ff00" }]);
  assert.equal(next.nodes.find((n) => n.id === 10).color, null);
  assert.equal(next.edges.find((e) => e.id === 20).color, null);
  // badge luôn cần màu để vẽ dot → lùi về token mặc định, không phải null
  assert.equal(next.statuses.find((s) => s.id === 30).color, "st-idea");
  // màu khác không bị ảnh hưởng
  assert.equal(next.nodes.find((n) => n.id === 11).color, "dot-3");
  assert.equal(next.statuses.find((s) => s.id === 31).color, "st-chosen");
  assert.equal(next.tags.find((tg) => tg.id === 40).color, "pal-2");
});
