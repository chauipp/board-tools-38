// game-tools/client/src/lib/shape.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHAPE_KINDS, SHAPE_CLOSED, SHAPE_MIN_DIAGONAL,
  normalizeBox, shapePath, shapeOutline, drawingsHitBy
} from "./shape.js";

test("SHAPE_KINDS: sáu hình, đúng thứ tự hiện ở khu 4", () => {
  assert.deepEqual(SHAPE_KINDS, ["rect", "ellipse", "line", "arrow", "triangle", "diamond"]);
});

test("SHAPE_CLOSED: đúng bốn hình có vùng trong", () => {
  assert.deepEqual([...SHAPE_CLOSED].sort(), ["diamond", "ellipse", "rect", "triangle"]);
  assert.equal(SHAPE_CLOSED.has("line"), false);
  assert.equal(SHAPE_CLOSED.has("arrow"), false);
});

// KHÔNG sắp lại thứ tự hai góc: đường thẳng và mũi tên cần biết đâu là đầu,
// đâu là cuối. Việc lấy min/max là việc của shapePath cho bốn hình đóng.
test("normalizeBox: giữ nguyên thứ tự hai góc, chỉ làm tròn", () => {
  assert.deepEqual(normalizeBox(100.4, 50.6, 20.2, 10.5), [100, 51, 20, 11]);
});

test("normalizeBox: square ép |dx| = |dy| và giữ dấu", () => {
  // kéo sang phải 100, xuống 30 → cạnh 100
  assert.deepEqual(normalizeBox(0, 0, 100, 30, { square: true }), [0, 0, 100, 100]);
  // kéo sang trái 20, lên 80 → cạnh 80, giữ cả hai dấu âm
  assert.deepEqual(normalizeBox(0, 0, -20, -80, { square: true }), [0, 0, -80, -80]);
});

test("normalizeBox: snap ép hướng về 0/45/90 độ, giữ độ dài", () => {
  // gần ngang → thành ngang, độ dài giữ nguyên 100
  assert.deepEqual(normalizeBox(0, 0, 100, 8, { snap: true }), [0, 0, 100, 0]);
  // gần dọc → thành dọc
  assert.deepEqual(normalizeBox(0, 0, 6, 100, { snap: true }), [0, 0, 0, 100]);
  // gần chéo 45 độ → thành chéo đúng 45 độ
  assert.deepEqual(normalizeBox(0, 0, 100, 90, { snap: true }), [0, 0, 95, 95]);
});

test("normalizeBox: hộp suy biến không nổ", () => {
  assert.deepEqual(normalizeBox(5, 5, 5, 5, { square: true }), [5, 5, 5, 5]);
  assert.deepEqual(normalizeBox(5, 5, 5, 5, { snap: true }), [5, 5, 5, 5]);
});

test("shapePath: chữ nhật là bốn cạnh khép kín, thứ tự góc nào cũng ra một hình", () => {
  const a = shapePath("rect", [10, 20, 110, 70]);
  const b = shapePath("rect", [110, 70, 10, 20]);
  assert.equal(a, "M 10 20 L 110 20 L 110 70 L 10 70 Z");
  assert.equal(a, b, "kéo từ góc dưới-phải lên phải ra cùng một hình");
});

test("shapePath: đường thẳng giữ đúng chiều", () => {
  assert.equal(shapePath("line", [10, 20, 110, 70]), "M 10 20 L 110 70");
  assert.equal(shapePath("line", [110, 70, 10, 20]), "M 110 70 L 10 20");
});

test("shapePath: ê-líp dùng cung A nên zoom vào vẫn mịn", () => {
  const d = shapePath("ellipse", [0, 0, 100, 60]);
  assert.ok(d.startsWith("M "), d);
  assert.ok(d.includes(" A "), "phải dùng cung tròn, không phải đa giác: " + d);
  assert.ok(d.trimEnd().endsWith("Z"), d);
});

test("shapePath: bốn hình đóng kết bằng Z, hai hình mở thì không", () => {
  for (const kind of ["rect", "ellipse", "triangle", "diamond"]) {
    assert.ok(shapePath(kind, [0, 0, 100, 60]).trimEnd().endsWith("Z"), kind + " phải khép kín");
  }
  for (const kind of ["line", "arrow"]) {
    assert.ok(!shapePath(kind, [0, 0, 100, 60]).includes("Z"), kind + " không được khép kín");
  }
});

test("shapePath: mũi tên có đầu mũi ngoài phần thân", () => {
  const d = shapePath("arrow", [0, 0, 100, 0]);
  assert.ok(d.startsWith("M 0 0 L 100 0"), "phần thân phải là đoạn gốc → ngọn: " + d);
  // Đầu mũi vẽ bằng một lệnh M thứ hai, nên chuỗi phải có 2 chữ M.
  assert.equal((d.match(/M /g) || []).length, 2, "phải có đúng 2 lệnh M: " + d);
});

test("shapePath: kind lạ hoặc pts thiếu thì trả chuỗi rỗng chứ không nổ", () => {
  assert.equal(shapePath("star", [0, 0, 10, 10]), "");
  assert.equal(shapePath("rect", [0, 0]), "");
  assert.equal(shapePath("rect", []), "");
});

test("shapePath: hộp suy biến không nổ", () => {
  for (const kind of SHAPE_KINDS) {
    assert.doesNotThrow(() => shapePath(kind, [7, 7, 7, 7]), kind);
  }
});

// Đường bao của hình ĐÓNG lặp lại điểm đầu ở cuối, để đoạn khép kín cũng được
// đo trong hit-test — thiếu nó thì cạnh trái chữ nhật không bắt được chuột.
test("shapeOutline: hình đóng lặp lại điểm đầu ở cuối", () => {
  const rect = shapeOutline("rect", [0, 0, 100, 60]);
  assert.equal(rect.length, 10, "4 góc + điểm đầu lặp lại = 5 điểm");
  assert.deepEqual(rect.slice(0, 2), rect.slice(-2));
  assert.equal(shapeOutline("triangle", [0, 0, 100, 60]).length, 8);
  assert.equal(shapeOutline("diamond", [0, 0, 100, 60]).length, 10);
});

test("shapeOutline: ê-líp lấy 32 mẫu cộng điểm đầu lặp lại", () => {
  const out = shapeOutline("ellipse", [0, 0, 100, 60]);
  assert.equal(out.length, 66);
  assert.deepEqual(out.slice(0, 2), out.slice(-2));
});

// Đầu mũi nhỏ và nằm sát thân, nên đường bao của mũi tên chỉ là phần thân.
test("shapeOutline: đường thẳng và mũi tên là hai điểm", () => {
  assert.deepEqual(shapeOutline("line", [10, 20, 110, 70]), [10, 20, 110, 70]);
  assert.deepEqual(shapeOutline("arrow", [10, 20, 110, 70]), [10, 20, 110, 70]);
});

test("shapeOutline: mọi điểm nằm trong hộp bao", () => {
  for (const kind of SHAPE_KINDS) {
    const out = shapeOutline(kind, [10, 20, 110, 70]);
    assert.equal(out.length % 2, 0, kind + ": mảng phải có độ dài chẵn");
    for (let i = 0; i + 1 < out.length; i += 2) {
      assert.ok(out[i] >= 9.5 && out[i] <= 110.5, kind + ": x ngoài hộp: " + out[i]);
      assert.ok(out[i + 1] >= 19.5 && out[i + 1] <= 70.5, kind + ": y ngoài hộp: " + out[i + 1]);
    }
  }
});

test("shapeOutline: kind lạ hoặc pts thiếu thì trả mảng rỗng", () => {
  assert.deepEqual(shapeOutline("star", [0, 0, 10, 10]), []);
  assert.deepEqual(shapeOutline("rect", [0, 0]), []);
});

test("drawingsHitBy: nét bút — ngưỡng chạm là w/2 + radius", () => {
  const drawings = [{ id: 1, kind: "pen", color: "pen-red", w: 4, pts: [0, 0, 100, 0] }];
  // ngưỡng = 4/2 + 8 = 10
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 9 }, 8), [1]);
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 11 }, 8), []);
});

test("drawingsHitBy: nét bút — đo khoảng cách tới đoạn thẳng chứ không tới đỉnh", () => {
  const drawings = [{ id: 1, w: 2, pts: [0, 0, 100, 0] }];
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 0 }, 3), [1]);
});

test("drawingsHitBy: trả nhiều id khi một điểm chạm nhiều nét", () => {
  const drawings = [
    { id: 1, w: 2, pts: [0, 0, 100, 0] },
    { id: 2, w: 2, pts: [50, -20, 50, 20] },
    { id: 3, w: 2, pts: [0, 500, 100, 500] }
  ];
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 0 }, 3), [1, 2]);
});

test("drawingsHitBy: nét bút một điểm vẫn hit-test được", () => {
  assert.deepEqual(drawingsHitBy([{ id: 1, w: 4, pts: [10, 10] }], { x: 12, y: 10 }, 8), [1]);
});

test("drawingsHitBy: danh sách rỗng hoặc thiếu pts trả mảng rỗng", () => {
  assert.deepEqual(drawingsHitBy([], { x: 0, y: 0 }, 8), []);
  assert.deepEqual(drawingsHitBy([{ id: 1, w: 4 }], { x: 0, y: 0 }, 8), []);
});

// Chỉ viền: chạm viền thì trúng, giữa hình thì KHÔNG — không thì kéo gôm ngang
// qua một khung rỗng sẽ xoá nó dù người dùng chỉ đi qua vùng trống.
test("drawingsHitBy: chữ nhật chỉ viền — trúng viền, không trúng giữa", () => {
  const rect = [{ id: 1, kind: "rect", w: 2, fill: false, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(rect, { x: 50, y: 1 }, 3), [1], "cạnh trên");
  assert.deepEqual(drawingsHitBy(rect, { x: 0, y: 30 }, 3), [1], "cạnh trái — cạnh khép kín");
  assert.deepEqual(drawingsHitBy(rect, { x: 50, y: 30 }, 3), [], "giữa hình rỗng");
});

test("drawingsHitBy: chữ nhật tô cả hình — chạm giữa cũng trúng", () => {
  const rect = [{ id: 1, kind: "rect", w: 2, fill: true, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(rect, { x: 50, y: 30 }, 3), [1]);
  assert.deepEqual(drawingsHitBy(rect, { x: 200, y: 30 }, 3), [], "ngoài hình vẫn không trúng");
});

test("drawingsHitBy: ê-líp phân biệt trong và ngoài", () => {
  const el = [{ id: 1, kind: "ellipse", w: 2, fill: true, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(el, { x: 50, y: 30 }, 3), [1], "tâm");
  // Góc trên-trái của hộp bao nằm NGOÀI ê-líp
  assert.deepEqual(drawingsHitBy(el, { x: 3, y: 3 }, 3), [], "góc hộp bao");
});

test("drawingsHitBy: w lớn nới ngưỡng chạm của hình khối", () => {
  const thin = [{ id: 1, kind: "rect", w: 2, fill: false, pts: [0, 0, 100, 60] }];
  const thick = [{ id: 1, kind: "rect", w: 20, fill: false, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(thin, { x: 50, y: 8 }, 3), []);
  assert.deepEqual(drawingsHitBy(thick, { x: 50, y: 8 }, 3), [1]);
});

test("drawingsHitBy: đường thẳng và mũi tên hit-test theo thân", () => {
  const l = [{ id: 1, kind: "line", w: 2, pts: [0, 0, 100, 100] }];
  assert.deepEqual(drawingsHitBy(l, { x: 50, y: 50 }, 3), [1]);
  assert.deepEqual(drawingsHitBy(l, { x: 50, y: 90 }, 3), []);
});

test("drawingsHitBy: hình khối thiếu số hoặc kind lạ thì bỏ qua, không nổ", () => {
  assert.deepEqual(drawingsHitBy([{ id: 1, kind: "rect", w: 2, pts: [0, 0] }], { x: 0, y: 0 }, 8), []);
  assert.deepEqual(drawingsHitBy([{ id: 1, kind: "star", w: 2, pts: [0, 0, 9, 9] }], { x: 5, y: 5 }, 8), []);
});

test("SHAPE_MIN_DIAGONAL: ngưỡng bỏ hình suy biến là 4", () => {
  assert.equal(SHAPE_MIN_DIAGONAL, 4);
});

test("drawingsHitBy: quét trúng text theo hộp chữ đã lưu", () => {
  const drawings = [{ id: 7, kind: "text", pts: [100, 50], text: "chú thích", w: 60, h: 26 }];
  assert.deepEqual(drawingsHitBy(drawings, { x: 110, y: 60 }, 8), [7]);
  assert.deepEqual(drawingsHitBy(drawings, { x: 400, y: 60 }, 8), []);
});

// Vùng chạm của text KHÔNG được phình theo bề rộng chữ: với text, `w` là bề rộng
// hộp chứ không phải độ dày nét, nên nhánh text cố ý không cộng w/2 như nét bút.
// Không có chốt này thì một dòng chữ dài 400 có vùng chạm rộng thêm 200 mỗi phía
// và cục gôm ăn oan mọi thứ quanh nó.
test("drawingsHitBy: bề rộng text không nới vùng chạm ra", () => {
  const drawings = [{ id: 7, kind: "text", pts: [0, 0], text: "x", w: 400, h: 26 }];
  assert.deepEqual(drawingsHitBy(drawings, { x: -50, y: 13 }, 8), []);
  assert.deepEqual(drawingsHitBy(drawings, { x: -5, y: 13 }, 8), [7]);
});

// Canh gác: thêm nhánh text không được làm hỏng ba nhánh đã có. Một danh sách
// trộn cả ba loại, mỗi loại phải được bắt đúng loại của nó.
test("drawingsHitBy: pen, hình khối và text sống chung không giẫm chân nhau", () => {
  const drawings = [
    { id: 1, kind: "pen", w: 4, pts: [0, 0, 100, 0] },
    { id: 2, kind: "rect", w: 2, pts: [200, 0, 300, 60] },
    { id: 3, kind: "text", pts: [400, 0], text: "a", w: 40, h: 26 }
  ];
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 0 }, 3), [1]);
  assert.deepEqual(drawingsHitBy(drawings, { x: 200, y: 30 }, 3), [2]);
  assert.deepEqual(drawingsHitBy(drawings, { x: 410, y: 10 }, 3), [3]);
  assert.deepEqual(drawingsHitBy(drawings, { x: 1000, y: 1000 }, 3), []);
});

// Text thiếu w/h (dữ liệu cũ hoặc gói realtime lỗi) không được làm nổ cục gôm.
test("drawingsHitBy: text thiếu hộp thì bỏ qua, không nổ", () => {
  const drawings = [{ id: 9, kind: "text", pts: [0, 0], text: "a" }];
  assert.deepEqual(drawingsHitBy(drawings, { x: 0, y: 0 }, 8), []);
});
