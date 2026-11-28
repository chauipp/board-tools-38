import { test } from "node:test";
import assert from "node:assert/strict";
import { eraseCursorFor } from "./erase-cursor.js";
import { ERASE_PART } from "./erase.js";

const part = { erase: ERASE_PART, ew: 20 };

test("chỉ có con trỏ tròn khi đang cầm cục tẩy THEO ĐỘ RỘNG ở mode vẽ", () => {
  assert.equal(eraseCursorFor({ mode: "select", tool: "eraser", penPrefs: part, scale: 1 }), undefined);
  assert.equal(eraseCursorFor({ mode: "draw", tool: "pen", penPrefs: part, scale: 1 }), undefined);
  assert.equal(eraseCursorFor({ mode: "draw", tool: "eraser", penPrefs: { ...part, erase: "whole" }, scale: 1 }), undefined);
  assert.match(eraseCursorFor({ mode: "draw", tool: "eraser", penPrefs: part, scale: 1 }), /^url\("data:image\/svg\+xml,.*crosshair$/);
});

test("đường kính theo cỡ tẩy × zoom, kẹp trong [6, 120] px", () => {
  const sizeOf = (ew, scale) => Number(/width%3D%22(\d+)/.exec(eraseCursorFor({ mode: "draw", tool: "eraser", penPrefs: { ...part, ew }, scale }))[1]);
  assert.equal(sizeOf(20, 2), 44);     // 40 + 4 viền
  assert.equal(sizeOf(1, 1), 10);      // kẹp dưới 6 + 4
  assert.equal(sizeOf(200, 3), 124);   // kẹp trên 120 + 4
});
