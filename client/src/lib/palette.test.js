import { test } from "node:test";
import assert from "node:assert/strict";
import { paletteCss, applyColorTo, applyColorToMany, removePaletteColor } from "./palette.js";

function makeBoard() {
  return {
    palette: [{ id: 1, hex: "#ff0000" }, { id: 2, hex: "#00ff00" }],
    nextPaletteId: 3,
    nodes: [{ id: 10, color: "pal-1" }, { id: 11, color: "dot-3" }],
    edges: [{ id: 20, color: "pal-1" }, { id: 21 }],
    statuses: [{ id: 30, name: "A", color: "pal-1" }, { id: 31, name: "B", color: "st-chosen" }],
    tags: [{ id: 40, name: "C", color: "pal-2" }],
    drawings: [{ id: 50, w: 4, pts: [0, 0, 10, 10], color: "pal-1" }, { id: 51, w: 4, pts: [0, 0], color: "pen-blue" }]
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

test("applyColorToMany tô mọi thẻ trong tập, chừa thẻ ngoài tập", () => {
  const next = applyColorToMany(makeBoard(), "node", [10, 11], "pal-2");
  assert.equal(next.nodes.find((n) => n.id === 10).color, "pal-2");
  assert.equal(next.nodes.find((n) => n.id === 11).color, "pal-2");
  assert.equal(next.edges.find((e) => e.id === 20).color, "pal-1", "dây không bị đụng");
});

test("applyColorToMany nhận cả Set và mảng", () => {
  const fromSet = applyColorToMany(makeBoard(), "node", new Set([11]), "pal-2");
  assert.equal(fromSet.nodes.find((n) => n.id === 11).color, "pal-2");
  assert.equal(fromSet.nodes.find((n) => n.id === 10).color, "pal-1");
});

test("applyColorToMany trên dây dùng đúng tập dây", () => {
  const next = applyColorToMany(makeBoard(), "edge", [20, 21], "dot-3");
  assert.equal(next.edges.find((e) => e.id === 20).color, "dot-3");
  assert.equal(next.edges.find((e) => e.id === 21).color, "dot-3");
  assert.equal(next.nodes.find((n) => n.id === 10).color, "pal-1", "thẻ không bị đụng");
});

// badge (status/tag) là định nghĩa dùng chung cho cả bảng, không phải đối tượng
// chọn được — không có "vùng chọn badge" nào để áp, nên đường này phải trả board
// nguyên vẹn thay vì âm thầm đổi màu một badge.
test("applyColorToMany với kind badge hoặc lạ → board nguyên vẹn", () => {
  const b = makeBoard();
  assert.equal(applyColorToMany(b, "status", [30], "pal-2"), b);
  assert.equal(applyColorToMany(b, "tag", [40], "pal-2"), b);
  assert.equal(applyColorToMany(b, "group", [1], "pal-2"), b);
});

test("applyColorToMany với tập rỗng → board nguyên vẹn", () => {
  const b = makeBoard();
  assert.equal(applyColorToMany(b, "node", [], "pal-2"), b);
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

// Nét bút, hình khối và chữ nằm chung trong board.drawings, và nhận màu BẢNG
// (dot-*/pal-*) chứ không riêng bảy màu bút: trên bảng chỉ có một hộp màu.
test("applyColorTo tô được nét vẽ, không đụng nét khác", () => {
  const b = makeBoard();
  const after = applyColorTo(b, { kind: "drawing", id: 51 }, "pal-2");
  assert.equal(after.drawings.find((d) => d.id === 51).color, "pal-2");
  assert.equal(after.drawings.find((d) => d.id === 50).color, "pal-1");
  assert.equal(after.nodes[0].color, "pal-1", "thẻ không bị đụng tới");
});

test("applyColorToMany tô cả cụm nét đang chọn", () => {
  const b = makeBoard();
  const after = applyColorToMany(b, "drawing", [50, 51], "dot-2");
  assert.deepEqual(after.drawings.map((d) => d.color), ["dot-2", "dot-2"]);
});

test("applyColorTo trên board chưa có drawings không nổ", () => {
  const b = makeBoard();
  delete b.drawings;
  assert.deepEqual(applyColorTo(b, { kind: "drawing", id: 1 }, "dot-2").drawings, []);
});

// Nét vẽ không được về null như thẻ: một nét màu var(--null) là nét vô hình.
test("removePaletteColor: nét vẽ mang màu vừa xoá lùi về mực đen, không mất màu", () => {
  const after = removePaletteColor(makeBoard(), 1);
  assert.equal(after.drawings.find((d) => d.id === 50).color, "pen-mono");
  assert.equal(after.drawings.find((d) => d.id === 51).color, "pen-blue", "nét màu khác giữ nguyên");
  assert.equal(after.nodes.find((n) => n.id === 10).color, null, "thẻ vẫn về không màu như cũ");
});
