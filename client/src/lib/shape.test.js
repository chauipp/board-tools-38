// client/src/lib/shape.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHAPE_KINDS, SHAPE_CLOSED, SHAPE_MIN_DIAGONAL,
  normalizeBox, shapePath, shapeOutline, drawingsHitBy,
  drawingBox, drawingsInRect, moveDrawing, shapeVertices, VERTEX_NUMBERS,
  SHAPE_TOOL_KINDS, ptsFromBox, shapeKindOf, shapeHandles, moveShapeHandle, HANDLE_VERTEX, HANDLE_EDGE
} from "./shape.js";

test("SHAPE_KINDS: mọi kind hợp lệ, kể cả kind không vẽ trực tiếp được", () => {
  assert.deepEqual(SHAPE_KINDS, ["rect", "ellipse", "line", "arrow", "triangle", "diamond", "quad"]);
});

test("SHAPE_CLOSED: hình có vùng trong — hai hình mở đứng ngoài", () => {
  assert.deepEqual([...SHAPE_CLOSED].sort(), ["diamond", "ellipse", "quad", "rect", "triangle"]);
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

// ── Hộp bao, quét vùng và dời chỗ ────────────────────────────────────────────

test("drawingBox: nét bút ôm hết các điểm và nới ra nửa độ dày nét", () => {
  const pen = { id: 1, w: 4, pts: [10, 20, 50, 60, 30, 40] };
  assert.deepEqual(drawingBox(pen), { x: 8, y: 18, w: 44, h: 44 });
});

test("drawingBox: hình khối lấy hộp đã chuẩn hoá, vẽ ngược chiều cũng đúng", () => {
  const box = { id: 2, kind: "rect", w: 2, pts: [100, 80, 20, 10] };
  assert.deepEqual(drawingBox(box), { x: 19, y: 9, w: 82, h: 72 });
});

test("drawingBox: text dùng thẳng hộp chữ đã lưu, không nới theo w", () => {
  const el = { id: 3, kind: "text", pts: [40, 50], w: 120, h: 26, text: "xin chào" };
  assert.deepEqual(drawingBox(el), { x: 40, y: 50, w: 120, h: 26 });
});

test("drawingBox: dữ liệu thiếu trả null chứ không trả hộp rỗng", () => {
  assert.equal(drawingBox(null), null);
  assert.equal(drawingBox({ id: 1, w: 4, pts: [] }), null);
  assert.equal(drawingBox({ id: 1, kind: "rect", w: 4, pts: [0, 0] }), null);
  assert.equal(drawingBox({ id: 1, kind: "text", pts: [0, 0] }), null, "text thiếu w/h");
});

test("drawingsInRect: dính khi CHẠM vùng quét, không đòi trùm kín", () => {
  const drawings = [
    { id: 1, w: 2, pts: [0, 0, 100, 100] },
    { id: 2, w: 2, pts: [500, 500, 600, 600] }
  ];
  assert.deepEqual(drawingsInRect(drawings, { x: 90, y: 90, w: 20, h: 20 }), [1], "chỉ chạm góc");
  assert.deepEqual(drawingsInRect(drawings, { x: -10, y: -10, w: 700, h: 700 }), [1, 2]);
  assert.deepEqual(drawingsInRect(drawings, { x: 200, y: 200, w: 50, h: 50 }), []);
});

test("drawingsInRect: nét hỏng bị bỏ qua, không nổ và không dính oan", () => {
  const drawings = [{ id: 1, w: 2 }, { id: 2, kind: "text", pts: [0, 0] }];
  assert.deepEqual(drawingsInRect(drawings, { x: -100, y: -100, w: 999, h: 999 }), []);
});

test("moveDrawing: cộng dx/dy vào đúng cặp toạ độ, làm tròn về số nguyên", () => {
  const pen = { id: 1, w: 4, pts: [10, 20, 30, 40] };
  assert.deepEqual(moveDrawing(pen, 5.4, -3.6).pts, [15, 16, 35, 36]);
});

test("moveDrawing: một phép cộng chạy đúng cho cả text và hình khối", () => {
  const el = { id: 3, kind: "text", pts: [40, 50], w: 120, h: 26, text: "a" };
  const box = { id: 2, kind: "rect", w: 2, pts: [0, 0, 80, 60] };
  assert.deepEqual(moveDrawing(el, 10, 10).pts, [50, 60]);
  assert.deepEqual(moveDrawing(box, -5, 5).pts, [-5, 5, 75, 65]);
});

test("moveDrawing: giữ nguyên mọi thuộc tính khác, không đụng nét gốc", () => {
  const el = { id: 3, kind: "text", pts: [40, 50], w: 120, h: 26, text: "a", color: "pen-red" };
  const out = moveDrawing(el, 1, 1);
  assert.equal(out.text, "a");
  assert.equal(out.color, "pen-red");
  assert.equal(out.w, 120);
  assert.deepEqual(el.pts, [40, 50], "nét gốc không bị sửa tại chỗ");
});

// ── Tam giác BA ĐỈNH ────────────────────────────────────────────────────────
// Hộp bao chỉ tả được tam giác cân (đỉnh luôn ở giữa cạnh trên). Tam giác nhận
// ra từ nét vẽ tay mang 6 số — ba đỉnh thật — nên giữ nguyên dáng đã vẽ: vuông,
// tù, bè, nghiêng. Hai dạng cùng một kind, mọi hàm phải đọc được cả hai.

test("shapeVertices: đủ số thì là đỉnh thật, thiếu thì là hộp bao", () => {
  assert.deepEqual(shapeVertices("triangle", [0, 0, 100, 0, 50, 80]), [0, 0, 100, 0, 50, 80]);
  assert.equal(shapeVertices("triangle", [0, 0, 100, 80]), null);
  assert.equal(shapeVertices("triangle", [0, 0, 100, 0, 50, NaN]), null);
  assert.deepEqual(VERTEX_NUMBERS, { triangle: 6, quad: 8 });
});

test("shapeVertices: kind KHÔNG có dạng đỉnh thật thì luôn null, dù pts dài", () => {
  // Chữ nhật, ê-líp, hình thoi định nghĩa bằng hộp — "bốn đỉnh tự do" không có
  // nghĩa với chúng (một ê-líp bốn đỉnh là cái gì?).
  assert.equal(shapeVertices("rect", [0, 0, 100, 0, 50, 80, 10, 10]), null);
  assert.equal(shapeVertices("ellipse", [0, 0, 100, 0, 50, 80, 10, 10]), null);
});

test("bảng chọn ở khu 4: tám nút, và mỗi nút phải quy về một kind hợp lệ", () => {
  assert.deepEqual(SHAPE_TOOL_KINDS,
    ["rect", "ellipse", "line", "arrow", "triangle", "diamond", "parallelogram", "trapezoid"]);
  for (const tool of SHAPE_TOOL_KINDS) {
    assert.ok(SHAPE_KINDS.includes(shapeKindOf(tool)), `${tool} → ${shapeKindOf(tool)}`);
  }
});

test("hình bình hành và hình thang cùng lưu ra kind quad", () => {
  // Kéo một cái góc là hình hết còn là hình thang; một kind tên "trapezoid" sẽ
  // thành cái tên nói dối ngay ở thao tác đầu tiên. "quad" thì đúng mãi mãi.
  assert.equal(shapeKindOf("parallelogram"), "quad");
  assert.equal(shapeKindOf("trapezoid"), "quad");
  assert.ok(!SHAPE_KINDS.includes("parallelogram"));
  assert.ok(!SHAPE_KINDS.includes("trapezoid"));
  // Nút nào không phải hai cái đó thì tên nút CHÍNH LÀ kind.
  for (const k of ["rect", "ellipse", "line", "arrow", "triangle", "diamond"]) {
    assert.equal(shapeKindOf(k), k);
  }
  // Và cả hai đều tô được — hỏi SHAPE_CLOSED bằng tên nút thì chúng rơi ra ngoài.
  assert.ok(SHAPE_CLOSED.has(shapeKindOf("parallelogram")));
  assert.ok(SHAPE_CLOSED.has(shapeKindOf("trapezoid")));
});

test("ptsFromBox: hộp kéo được → BỐN ĐỈNH, xiên sẵn", () => {
  const para = ptsFromBox("parallelogram", [0, 0, 200, 100]);
  assert.equal(para.length, 8, "phải là bốn đỉnh, không phải cái hộp");
  assert.deepEqual(para, [50, 0, 200, 0, 150, 100, 0, 100]);

  const trap = ptsFromBox("trapezoid", [0, 0, 200, 100]);
  assert.deepEqual(trap, [44, 0, 156, 0, 200, 100, 0, 100]);

  // Hình bình hành: cạnh trên NGẮN BẰNG cạnh dưới, chỉ lệch đi. Hình thang:
  // cạnh trên NGẮN HƠN. Đó là toàn bộ khác biệt giữa hai nút.
  const width = (p) => [p[2] - p[0], p[4] - p[6]];
  const [paraTop, paraBottom] = width(para);
  assert.equal(paraTop, paraBottom);
  const [trapTop, trapBottom] = width(trap);
  assert.ok(trapTop < trapBottom, `${trapTop} phải nhỏ hơn ${trapBottom}`);
});

test("ptsFromBox: kéo ngược từ dưới-phải lên vẫn ra đúng hình đó", () => {
  for (const tool of ["parallelogram", "trapezoid"]) {
    assert.deepEqual(ptsFromBox(tool, [200, 100, 0, 0]), ptsFromBox(tool, [0, 0, 200, 100]), tool);
  }
});

test("ptsFromBox: mọi nút khác trả nguyên cái hộp, không đụng vào", () => {
  // Tam giác ở dạng hộp bao ĐÃ là một hình đúng — tam giác cân — nên nó không
  // được đi qua đây, dù nó cũng có dạng đỉnh thật.
  for (const kind of ["rect", "ellipse", "line", "arrow", "triangle", "diamond", "quad"]) {
    assert.deepEqual(ptsFromBox(kind, [0, 0, 200, 100]), [0, 0, 200, 100], kind);
  }
});

// ── Tứ giác bốn đỉnh ────────────────────────────────────────────────────────

test("shapePath: tứ giác vẽ đúng bốn đỉnh (hình bình hành giữ nguyên độ xiên)", () => {
  assert.equal(shapePath("quad", [40, 0, 140, 0, 100, 80, 0, 80]), "M 40 0 L 140 0 L 100 80 L 0 80 Z");
});

test("drawingBox / hit-test của tứ giác chạy trên ĐÚNG bốn đỉnh", () => {
  const q = { id: 5, kind: "quad", w: 2, pts: [40, 0, 140, 0, 100, 80, 0, 80] };
  assert.deepEqual(drawingBox(q), { x: -1, y: -1, w: 142, h: 82 });
  // Trung điểm cạnh xiên trái: (40,0)–(0,80).
  assert.deepEqual(drawingsHitBy([q], { x: 20, y: 40 }, 3), [5]);
  // Góc trên trái của HỘP BAO — nằm ngoài hình bình hành.
  assert.deepEqual(drawingsHitBy([q], { x: 2, y: 2 }, 3), []);
});

// ── Tay cầm sửa hình ────────────────────────────────────────────────────────

const handlesOf = (d, t) => shapeHandles(d).filter((h) => h.t === t);

test("hình đỉnh thật: mỗi đỉnh một tay cầm góc, mỗi cạnh một tay cầm cạnh", () => {
  const q = { id: 1, kind: "quad", w: 2, pts: [40, 0, 140, 0, 100, 80, 0, 80] };
  assert.equal(handlesOf(q, HANDLE_VERTEX).length, 4);
  assert.equal(handlesOf(q, HANDLE_EDGE).length, 4);
  // Tay cầm cạnh ở trung điểm — kể cả CẠNH KHÉP KÍN (đỉnh cuối → đỉnh đầu), bỏ
  // sót nó thì đúng một cạnh của hình không dời được.
  const mids = handlesOf(q, HANDLE_EDGE).map((h) => [h.x, h.y]);
  assert.deepEqual(mids[3], [20, 40]);
});

test("kéo tay cầm góc của tứ giác chỉ dời ĐÚNG đỉnh đó", () => {
  const q = { id: 1, kind: "quad", w: 2, pts: [40, 0, 140, 0, 100, 80, 0, 80] };
  const h = handlesOf(q, HANDLE_VERTEX)[1];
  assert.deepEqual(moveShapeHandle(q, h, 200, -30), {
    kind: "quad", pts: [40, 0, 200, -30, 100, 80, 0, 80]
  });
});

test("kéo tay cầm cạnh dời CẢ HAI đỉnh của cạnh đó, đúng lượng tay đi", () => {
  const q = { id: 1, kind: "quad", w: 2, pts: [40, 0, 140, 0, 100, 80, 0, 80] };
  const h = handlesOf(q, HANDLE_EDGE)[0];        // cạnh trên, trung điểm (90, 0)
  assert.deepEqual(moveShapeHandle(q, h, h.x + 10, h.y - 25), {
    kind: "quad", pts: [50, -25, 150, -25, 100, 80, 0, 80]
  });
});

test("chữ nhật: kéo một góc chỉ dời ĐÚNG góc đó — hình thành tứ giác", () => {
  const r = { id: 2, kind: "rect", w: 2, pts: [0, 0, 100, 60] };
  assert.equal(handlesOf(r, HANDLE_VERTEX).length, 4);
  assert.equal(handlesOf(r, HANDLE_EDGE).length, 4);
  const nw = handlesOf(r, HANDLE_VERTEX)[0];
  assert.deepEqual([nw.x, nw.y], [0, 0]);
  // Ba góc kia đứng NGUYÊN CHỖ. Muốn vậy thì phải bỏ dạng hộp: một hộp hai góc
  // đối không tả nổi "một góc đi lệch còn ba góc ở yên".
  assert.deepEqual(moveShapeHandle(r, nw, -20, 10), {
    kind: "quad", pts: [-20, 10, 100, 0, 100, 60, 0, 60]
  });
});

test("tam giác cân: kéo một đỉnh ra thành tam giác thường, vẫn là kind triangle", () => {
  const tri = { id: 6, kind: "triangle", w: 2, pts: [0, 0, 100, 60] };
  // Ba tay cầm góc, không phải bốn: đặt ở góc hộp thì hai cái treo ngoài hình.
  const vs = handlesOf(tri, HANDLE_VERTEX);
  assert.equal(vs.length, 3);
  assert.deepEqual(vs.map((h) => [h.x, h.y]), [[50, 0], [100, 60], [0, 60]]);
  assert.deepEqual(moveShapeHandle(tri, vs[0], 10, -30), {
    kind: "triangle", pts: [10, -30, 100, 60, 0, 60]
  });
});

test("hình thoi: bốn tay cầm nằm ở bốn ĐỈNH của nó, không ở góc hộp", () => {
  const dia = { id: 7, kind: "diamond", w: 2, pts: [0, 0, 100, 60] };
  assert.deepEqual(handlesOf(dia, HANDLE_VERTEX).map((h) => [h.x, h.y]),
    [[50, 0], [100, 30], [50, 60], [0, 30]]);
  assert.equal(moveShapeHandle(dia, handlesOf(dia, HANDLE_VERTEX)[2], 70, 90).kind, "quad");
});

test("hình thoi / tam giác cân: tay cầm cạnh KHÔNG được chồng lên tay cầm góc", () => {
  // Trung điểm mép hộp của hai hình này rơi đúng vào đỉnh của chúng — mép trên
  // của tam giác cân trùng chóp, cả bốn mép hộp của hình thoi trùng cả bốn đỉnh.
  // Nên tay cầm cạnh phải bám cạnh THẬT, không bám mép hộp.
  for (const kind of ["diamond", "triangle"]) {
    const d = { id: 10, kind, w: 2, pts: [0, 0, 100, 60] };
    const vs = handlesOf(d, HANDLE_VERTEX);
    const es = handlesOf(d, HANDLE_EDGE);
    assert.equal(es.length, vs.length, kind);
    for (const e of es) {
      for (const v of vs) {
        assert.ok(Math.hypot(e.x - v.x, e.y - v.y) > 1, `${kind}: tay cầm cạnh đè lên đỉnh ${v.x},${v.y}`);
      }
    }
  }
});

test("hình thoi: kéo tay cầm cạnh dời hai đỉnh của cạnh đó, hình thành tứ giác", () => {
  const dia = { id: 11, kind: "diamond", w: 2, pts: [0, 0, 100, 60] };
  const e0 = handlesOf(dia, HANDLE_EDGE)[0];      // cạnh chóp → phải, trung điểm (75, 15)
  assert.deepEqual([e0.x, e0.y], [75, 15]);
  assert.deepEqual(moveShapeHandle(dia, e0, e0.x + 20, e0.y), {
    kind: "quad", pts: [70, 0, 120, 30, 50, 60, 0, 30]
  });
});

test("ê-líp là ngoại lệ: không có góc nào, nên góc hộp giữ nghĩa co giãn", () => {
  const el = { id: 8, kind: "ellipse", w: 2, pts: [0, 0, 100, 60] };
  const nw = handlesOf(el, HANDLE_VERTEX)[0];
  assert.deepEqual([nw.x, nw.y], [0, 0]);
  assert.deepEqual(moveShapeHandle(el, nw, -20, 10), { kind: "ellipse", pts: [-20, 10, 100, 60] });
});

test("hình hộp bao: kéo tay cầm mép chỉ đổi ĐÚNG một mép, hình giữ nguyên kind", () => {
  const r = { id: 2, kind: "rect", w: 2, pts: [0, 0, 100, 60] };
  const east = handlesOf(r, HANDLE_EDGE)[1];
  assert.deepEqual([east.x, east.y], [100, 30]);
  // Đây là đường CO GIÃN còn lại của hình hộp sau khi góc đã thành góc tự do.
  assert.deepEqual(moveShapeHandle(r, east, 160, 999), { kind: "rect", pts: [0, 0, 160, 60] });
});

test("đường thẳng / mũi tên: hai tay cầm là hai ĐẦU, không có tay cầm cạnh", () => {
  const line = { id: 3, kind: "arrow", w: 2, pts: [10, 10, 90, 50] };
  assert.equal(handlesOf(line, HANDLE_EDGE).length, 0);
  const tip = handlesOf(line, HANDLE_VERTEX)[1];
  assert.deepEqual([tip.x, tip.y], [90, 50]);
  // Ngọn mũi tên phải dời tự do, KHÔNG bị quy về một góc hộp — hướng của mũi tên
  // chính là thứ nó nói.
  assert.deepEqual(moveShapeHandle(line, tip, 5, 200), { kind: "arrow", pts: [10, 10, 5, 200] });
});

test("nét bút và chữ không có tay cầm sửa hình", () => {
  assert.deepEqual(shapeHandles({ id: 4, kind: "pen", w: 4, pts: [0, 0, 10, 10, 20, 5] }), []);
  assert.deepEqual(shapeHandles({ id: 5, kind: "text", pts: [0, 0], w: 80, h: 20 }), []);
  assert.deepEqual(shapeHandles(null), []);
});

test("moveShapeHandle: dữ liệu rác trả lại hình cũ, không nổ và không sinh NaN", () => {
  const r = { id: 2, kind: "rect", w: 2, pts: [0, 0, 100, 60] };
  assert.deepEqual(moveShapeHandle(r, null, 10, 10), { kind: "rect", pts: r.pts });
  assert.deepEqual(moveShapeHandle({ kind: "pen", pts: [0, 0] }, { t: "v", i: 0, x: 0, y: 0 }, 5, 5),
    { kind: "pen", pts: [0, 0] });
  // Tay cầm cũ còn sót lại từ hình trước (chỉ số vượt số đỉnh) không được đẻ ra
  // toạ độ thứ năm cho một tứ giác.
  const q = { id: 9, kind: "quad", w: 2, pts: [0, 0, 10, 0, 10, 10, 0, 10] };
  assert.deepEqual(moveShapeHandle(q, { t: "v", i: 7, x: 0, y: 0 }, 5, 5), { kind: "quad", pts: q.pts });
});

test("shapePath: tam giác ba đỉnh vẽ ĐÚNG ba đỉnh đó, không nắn về cân", () => {
  // Tam giác vuông: đỉnh trên nằm sát mép trái (x = 0), không ở giữa hộp (x = 50).
  const d = shapePath("triangle", [0, 0, 100, 80, 0, 80]);
  assert.equal(d, "M 0 0 L 100 80 L 0 80 Z");
});

test("shapePath: tam giác hộp bao (tool Hình khối) vẫn là tam giác CÂN như cũ", () => {
  assert.equal(shapePath("triangle", [0, 0, 100, 80]), "M 50 0 L 100 80 L 0 80 Z");
});

test("shapeOutline: tam giác ba đỉnh khép kín đúng ba đỉnh", () => {
  const out = shapeOutline("triangle", [0, 0, 100, 80, 0, 80]);
  // Ba đỉnh + lặp lại điểm đầu ở cuối để cạnh khép kín cũng bắt được chuột.
  assert.deepEqual(out, [0, 0, 100, 80, 0, 80, 0, 0]);
});

test("drawingBox: hộp bao của tam giác ba đỉnh ôm cả ĐỈNH THỨ BA", () => {
  // Đỉnh thứ ba ở (50, 200) nằm ngoài hộp của hai đỉnh đầu — quét min/max chỉ
  // trên hai số đầu sẽ cắt cụt mất nó.
  const box = drawingBox({ id: 1, kind: "triangle", w: 0, pts: [0, 0, 100, 0, 50, 200] });
  assert.deepEqual(box, { x: 0, y: 0, w: 100, h: 200 });
});

test("cục gôm bắt được tam giác ba đỉnh trên đúng cạnh nghiêng của nó", () => {
  const tri = { id: 7, kind: "triangle", w: 2, pts: [0, 0, 100, 80, 0, 80] };
  // Trung điểm cạnh huyền (0,0)–(100,80).
  assert.deepEqual(drawingsHitBy([tri], { x: 50, y: 40 }, 4), [7]);
  // Chỗ mà tam giác CÂN cùng hộp bao sẽ có cạnh, còn tam giác này thì không.
  assert.deepEqual(drawingsHitBy([tri], { x: 75, y: 20 }, 4), []);
});

test("moveDrawing: tam giác ba đỉnh dời đủ cả ba đỉnh", () => {
  const tri = { id: 1, kind: "triangle", w: 2, pts: [0, 0, 100, 80, 0, 80] };
  assert.deepEqual(moveDrawing(tri, 10, -5).pts, [10, -5, 110, 75, 10, 75]);
});
