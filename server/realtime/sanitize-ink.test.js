import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeInk,
  MAX_LIVE_INK_NUMBERS,
  MAX_LIVE_ERASE_IDS,
  MAX_LIVE_INK_COLOR_LEN,
  MIN_LIVE_INK_W,
  MAX_LIVE_INK_W,
  MAX_LIVE_INK_COORD
} from "./sanitize-ink.js";

// Gói mở nét (seq 0) hợp lệ tối thiểu; từng ca chỉ đổi đúng chỗ cần kiểm.
const open = (extra = {}) => ({ strokeId: 1, seq: 0, pts: [0, 0, 10, 10], color: "pen-red", w: 4, ...extra });

test("ink: payload không phải object hoặc strokeId không phải số thì bỏ", () => {
  assert.equal(sanitizeInk(null), null);
  assert.equal(sanitizeInk("x"), null);
  assert.equal(sanitizeInk({ pts: [0, 0] }), null);
  assert.equal(sanitizeInk({ strokeId: "1", pts: [0, 0] }), null);
  assert.equal(sanitizeInk({ strokeId: Infinity, pts: [0, 0] }), null);
});

test("ink: cancel chỉ mang strokeId", () => {
  assert.deepEqual(sanitizeInk({ strokeId: 3, cancel: true, pts: [1, 2], color: "x" }), { strokeId: 3, cancel: true });
});

test("ink: moving đi qua sanitizeLiveMoves, kind phải nằm trong LIVE_INK_KINDS", () => {
  assert.deepEqual(
    sanitizeInk({ strokeId: 1, seq: 2, moving: [{ id: 5, pts: [0, 0, 1, 1], kind: "rect" }] }),
    { strokeId: 1, seq: 2, moving: [{ id: 5, pts: [0, 0, 1, 1], kind: "rect" }], done: false }
  );
  assert.equal(sanitizeInk({ strokeId: 1, moving: [{ id: 5, pts: [0, 0, 1, 1], kind: "hexagon" }] }), null);
  // moving được xét TRƯỚC nhánh pts: gói moving không cần pts ở cấp gói.
  assert.equal(sanitizeInk({ strokeId: 1, moving: [] }), null);
  // seq rác về 0.
  assert.equal(sanitizeInk({ strokeId: 1, seq: "x", moving: [{ id: 5, pts: [0, 0] }] }).seq, 0);
});

test("ink: erase lọc id không phải số và cắt ở MAX_LIVE_ERASE_IDS", () => {
  assert.deepEqual(sanitizeInk({ strokeId: 1, erase: [1, "2", NaN, 3], done: true }), { strokeId: 1, erase: [1, 3], done: true });
  const many = Array.from({ length: MAX_LIVE_ERASE_IDS + 50 }, (_, i) => i);
  assert.equal(sanitizeInk({ strokeId: 1, erase: many }).erase.length, MAX_LIVE_ERASE_IDS);
});

test("ink: gói done chỉ mang drawingId là số hoặc null", () => {
  assert.deepEqual(sanitizeInk({ strokeId: 1, done: true, drawingId: 9 }), { strokeId: 1, done: true, drawingId: 9 });
  assert.deepEqual(sanitizeInk({ strokeId: 1, done: true, drawingId: "9" }), { strokeId: 1, done: true, drawingId: null });
  // done phải đúng `true`.
  assert.equal(sanitizeInk({ strokeId: 1, done: 1 }), null);
});

test("ink: pts không phải mảng thì bỏ", () => {
  assert.equal(sanitizeInk(open({ pts: "0,0,1,1" })), null);
  assert.equal(sanitizeInk(open({ pts: undefined })), null);
});

test("ink: kind lạ hoặc không phải chuỗi thì bỏ", () => {
  assert.equal(sanitizeInk(open({ kind: "hexagon" })), null);
  assert.equal(sanitizeInk(open({ kind: 1 })), null);
});

test("ink: pts độ dài lẻ hoặc dưới 2 số thì bỏ", () => {
  assert.equal(sanitizeInk(open({ pts: [0, 0, 1] })), null);
  assert.equal(sanitizeInk(open({ pts: [0] })), null);
  assert.equal(sanitizeInk(open({ pts: [] })), null);
});

test("ink: hình khối phải đúng 4 số, hoặc đúng số đỉnh của dạng đó", () => {
  assert.equal(sanitizeInk(open({ kind: "rect", pts: [0, 0, 1, 1, 2, 2] })), null);
  assert.deepEqual(sanitizeInk(open({ kind: "triangle", pts: [0, 0, 1, 1, 2, 0] })).pts, [0, 0, 1, 1, 2, 0]);
  assert.deepEqual(sanitizeInk(open({ kind: "triangle", pts: [0, 0, 1, 1] })).pts, [0, 0, 1, 1]);
  assert.equal(sanitizeInk(open({ kind: "triangle", pts: [0, 0, 1, 1, 2, 2, 3, 3] })), null);
  assert.deepEqual(sanitizeInk(open({ kind: "quad", pts: [0, 0, 1, 0, 1, 1, 0, 1] })).pts, [0, 0, 1, 0, 1, 1, 0, 1]);
  assert.equal(sanitizeInk(open({ kind: "rect", pts: [0, 0, 1, 0, 1, 1, 0, 1] })), null);
});

test("ink: kiểm độ dài GỐC trước khi cắt — mảng 4000 số kèm kind hình khối không lọt nhờ bị cắt", () => {
  const huge = Array.from({ length: 4000 }, () => 1);
  assert.equal(sanitizeInk(open({ kind: "rect", pts: huge })), null);
});

test("ink: nét bút bị cắt ở MAX_LIVE_INK_NUMBERS số", () => {
  const long = Array.from({ length: MAX_LIVE_INK_NUMBERS + 40 }, (_, i) => i % 100);
  assert.equal(sanitizeInk(open({ pts: long })).pts.length, MAX_LIVE_INK_NUMBERS);
});

test("ink: chữ neo bằng đúng một điểm (2 số)", () => {
  assert.equal(sanitizeInk(open({ kind: "text", pts: [0, 0, 1, 1], size: 20 })), null);
  const clean = sanitizeInk({ strokeId: 1, seq: 0, kind: "text", pts: [5, 6], color: "pen-red", size: 20, text: "hi" });
  assert.deepEqual(clean, { strokeId: 1, seq: 0, pts: [5, 6], kind: "text", text: "hi", size: 20, editId: null, color: "pen-red", dashed: false });
});

test("ink: chữ không có `w` — cỡ chữ do sanitizeLiveText kiểm", () => {
  assert.equal(Object.hasOwn(sanitizeInk({ strokeId: 1, seq: 0, kind: "text", pts: [5, 6], color: "c", size: 20, w: 4 }), "w"), false);
  // Cỡ chữ khổng lồ thì bỏ cả gói.
  assert.equal(sanitizeInk({ strokeId: 1, seq: 0, kind: "text", pts: [5, 6], color: "c", size: 1e9 }), null);
  // Gói giữa chừng chỉ mang chữ.
  assert.deepEqual(sanitizeInk({ strokeId: 1, seq: 3, kind: "text", pts: [5, 6], text: "abc" }), { strokeId: 1, seq: 3, pts: [5, 6], kind: "text", text: "abc" });
});

test("ink: toạ độ 1e9 bị chặn — Number.isFinite một mình không đủ", () => {
  assert.equal(sanitizeInk(open({ pts: [0, 0, 1e9, 1e9] })), null);
  // Gói {kind:"rect", fill:true} toạ độ khổng lồ là cách đi vòng qua MAX_LIVE_INK_W.
  assert.equal(sanitizeInk(open({ kind: "rect", fill: true, pts: [-1e9, -1e9, 1e9, 1e9] })), null);
  assert.equal(sanitizeInk(open({ pts: [0, 0, NaN, 1] })), null);
  assert.equal(sanitizeInk(open({ pts: [0, 0, "1", 1] })), null);
  assert.ok(sanitizeInk(open({ pts: [-MAX_LIVE_INK_COORD, 0, MAX_LIVE_INK_COORD, 0] })));
  assert.equal(sanitizeInk(open({ pts: [0, 0, MAX_LIVE_INK_COORD + 1, 0] })), null);
});

test("ink: nét bút không mang kind, hình khối thì mang", () => {
  assert.equal(Object.hasOwn(sanitizeInk(open()), "kind"), false);
  assert.equal(Object.hasOwn(sanitizeInk(open({ kind: "pen" })), "kind"), false);
  assert.equal(sanitizeInk(open({ kind: "ellipse" })).kind, "ellipse");
});

test("ink: gói mở phải có màu là chuỗi ngắn", () => {
  assert.equal(sanitizeInk(open({ color: undefined })), null);
  assert.equal(sanitizeInk(open({ color: 5 })), null);
  assert.equal(sanitizeInk(open({ color: "x".repeat(MAX_LIVE_INK_COLOR_LEN + 1) })), null);
  assert.equal(sanitizeInk(open({ color: "x".repeat(MAX_LIVE_INK_COLOR_LEN) })).color, "x".repeat(MAX_LIVE_INK_COLOR_LEN));
});

test("ink: gói mở phải có w trong biên độ — w khổng lồ là vệt phủ kín màn hình", () => {
  assert.equal(sanitizeInk(open({ w: undefined })), null);
  assert.equal(sanitizeInk(open({ w: MIN_LIVE_INK_W - 0.5 })), null);
  assert.equal(sanitizeInk(open({ w: MAX_LIVE_INK_W + 1 })), null);
  assert.equal(sanitizeInk(open({ w: 1e9 })), null);
  assert.equal(sanitizeInk(open({ w: MAX_LIVE_INK_W })).w, MAX_LIVE_INK_W);
});

test("ink: gói giữa chừng (seq > 0) không cần và không mang màu/w/fill/dashed", () => {
  assert.deepEqual(
    sanitizeInk({ strokeId: 1, seq: 4, pts: [1, 2, 3, 4], color: "x".repeat(500), w: 1e9, fill: true, dashed: true }),
    { strokeId: 1, seq: 4, pts: [1, 2, 3, 4] }
  );
});

test("ink: {kind:\"arrow\", fill:true} không mang `fill` — chỉ hình ĐÓNG mới tô được", () => {
  for (const kind of ["arrow", "line", "pen"]) {
    assert.equal(Object.hasOwn(sanitizeInk(open({ kind, fill: true })), "fill"), false, kind);
  }
  for (const kind of ["rect", "ellipse", "diamond"]) {
    assert.equal(sanitizeInk(open({ kind, fill: true })).fill, true, kind);
  }
  // Không tin kiểu client gửi: chỉ đúng `true` mới là tô đặc.
  assert.equal(sanitizeInk(open({ kind: "rect", fill: "yes" })).fill, false);
  assert.equal(sanitizeInk(open({ kind: "rect" })).fill, false);
});

test("ink: dashed áp cho mọi kind kể cả nét bút, chỉ đúng `true`", () => {
  assert.equal(sanitizeInk(open({ dashed: true })).dashed, true);
  assert.equal(sanitizeInk(open({ kind: "arrow", dashed: true })).dashed, true);
  assert.equal(sanitizeInk(open({ dashed: "true" })).dashed, false);
});

test("ink: seq rác coi như 0 (gói mở)", () => {
  assert.equal(sanitizeInk(open({ seq: "abc" })).seq, 0);
  assert.equal(sanitizeInk(open({ seq: "abc", color: undefined })), null);
});
