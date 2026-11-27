import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeLaser,
  MAX_LIVE_LASER_NUMBERS,
  MIN_LIVE_LASER_FADE,
  MAX_LIVE_LASER_FADE
} from "./sanitize-laser.js";
import { MAX_LIVE_INK_COLOR_LEN, MAX_LIVE_INK_W, MIN_LIVE_INK_W, MAX_LIVE_INK_COORD } from "./sanitize-ink.js";

const packet = (extra = {}) => ({ pts: [0, 0, 10, 10], color: "laser-red", w: 4, fade: 1500, ...extra });

test("laser: gói hợp lệ đi qua nguyên vẹn, KHÔNG mang socketId (server tự đính)", () => {
  assert.deepEqual(sanitizeLaser(packet({ reset: true, socketId: "fake", extra: 1 })), {
    pts: [0, 0, 10, 10], color: "laser-red", w: 4, fade: 1500, reset: true
  });
});

test("laser: thiếu pts hoặc pts không phải mảng thì bỏ", () => {
  assert.equal(sanitizeLaser(null), null);
  assert.equal(sanitizeLaser({ color: "c", w: 4 }), null);
  assert.equal(sanitizeLaser(packet({ pts: "0,0" })), null);
});

test("laser: pts độ dài lẻ hoặc dưới 2 số thì bỏ", () => {
  assert.equal(sanitizeLaser(packet({ pts: [0, 0, 1] })), null);
  assert.equal(sanitizeLaser(packet({ pts: [0] })), null);
  assert.equal(sanitizeLaser(packet({ pts: [] })), null);
});

test("laser: pts bị cắt ở MAX_LIVE_LASER_NUMBERS số", () => {
  const long = Array.from({ length: MAX_LIVE_LASER_NUMBERS + 20 }, (_, i) => i);
  assert.equal(sanitizeLaser(packet({ pts: long })).pts.length, MAX_LIVE_LASER_NUMBERS);
});

test("laser: toạ độ 1e9 bị chặn — vẫn là một vạch phủ ngang màn hình cả phòng", () => {
  assert.equal(sanitizeLaser(packet({ pts: [0, 0, 1e9, 0] })), null);
  assert.equal(sanitizeLaser(packet({ pts: [0, 0, NaN, 0] })), null);
  assert.ok(sanitizeLaser(packet({ pts: [0, 0, MAX_LIVE_INK_COORD, 0] })));
  assert.equal(sanitizeLaser(packet({ pts: [0, 0, MAX_LIVE_INK_COORD + 1, 0] })), null);
});

test("laser: màu phải là chuỗi ngắn, ở MỌI gói", () => {
  assert.equal(sanitizeLaser(packet({ color: undefined })), null);
  assert.equal(sanitizeLaser(packet({ color: 1 })), null);
  assert.equal(sanitizeLaser(packet({ color: "x".repeat(MAX_LIVE_INK_COLOR_LEN + 1) })), null);
});

test("laser: độ đậm phải trong biên độ, ở MỌI gói", () => {
  assert.equal(sanitizeLaser(packet({ w: undefined })), null);
  assert.equal(sanitizeLaser(packet({ w: MIN_LIVE_INK_W - 0.5 })), null);
  assert.equal(sanitizeLaser(packet({ w: MAX_LIVE_INK_W + 1 })), null);
});

test("laser: fade VẮNG MẶT vẫn cho gói qua (client bản cũ)", () => {
  const clean = sanitizeLaser(packet({ fade: undefined }));
  assert.ok(clean);
  assert.equal(clean.fade, undefined);
});

test("laser: fade rác chỉ bị bỏ RIÊNG field đó, gói vẫn qua", () => {
  for (const fade of [1e9, "1500", NaN, MIN_LIVE_LASER_FADE - 1, MAX_LIVE_LASER_FADE + 1]) {
    const clean = sanitizeLaser(packet({ fade }));
    assert.ok(clean, String(fade));
    assert.equal(clean.fade, undefined, String(fade));
    assert.deepEqual(clean.pts, [0, 0, 10, 10]);
  }
  assert.equal(sanitizeLaser(packet({ fade: MIN_LIVE_LASER_FADE })).fade, MIN_LIVE_LASER_FADE);
  assert.equal(sanitizeLaser(packet({ fade: MAX_LIVE_LASER_FADE })).fade, MAX_LIVE_LASER_FADE);
});

test("laser: reset chỉ là true khi client gửi đúng `true`", () => {
  assert.equal(sanitizeLaser(packet()).reset, false);
  assert.equal(sanitizeLaser(packet({ reset: "true" })).reset, false);
  assert.equal(sanitizeLaser(packet({ reset: true })).reset, true);
});
