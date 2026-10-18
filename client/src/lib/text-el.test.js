import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXT_SIZES, TEXT_LINE_H, textLines, textBox, textHitBy } from "./text-el.js";

// Hàm đo giả: mỗi ký tự rộng đúng 0.5 lần cỡ chữ. Nhờ tiêm hàm đo mà test không
// phụ thuộc font cài trên máy chạy test — cùng máy khác font là cùng kết quả.
const fakeMeasure = (line, size) => line.length * size * 0.5;

test("ba cỡ, tăng dần", () => {
  assert.deepEqual(TEXT_SIZES, [14, 20, 30]);
});

test("tách dòng: chịu cả \\r\\n, giữ dòng trống ở giữa", () => {
  assert.deepEqual(textLines("a\nb"), ["a", "b"]);
  assert.deepEqual(textLines("a\r\nb"), ["a", "b"]);
  assert.deepEqual(textLines("a\n\nb"), ["a", "", "b"]);
  assert.deepEqual(textLines(""), [""]);
  assert.deepEqual(textLines(null), [""]);
});

test("hộp: rộng theo dòng DÀI NHẤT, cao theo số dòng", () => {
  const box = textBox(["abc", "abcdef"], 20, fakeMeasure);
  assert.equal(box.w, 60);                        // 6 ký tự × 20 × 0.5
  assert.equal(box.h, Math.round(2 * 20 * TEXT_LINE_H));
});

// Một dòng trống vẫn chiếm chiều cao — nếu không thì gõ Enter hai lần rồi xoá
// hết chữ ở dòng cuối, hộp co lại và cục gôm hụt mất phần dưới.
test("dòng trống vẫn tính chiều cao", () => {
  assert.equal(textBox(["a", ""], 20, fakeMeasure).h, textBox(["a", "b"], 20, fakeMeasure).h);
});

test("hộp không bao giờ rộng 0 — text rỗng vẫn phải bấm trúng được", () => {
  assert.ok(textBox([""], 14, fakeMeasure).w > 0);
  assert.ok(textBox([], 14, fakeMeasure).h > 0);
});

test("hit-test: trong hộp trúng, ngoài hộp trượt", () => {
  const el = { pts: [100, 50], w: 60, h: 26 };
  assert.equal(textHitBy(el, { x: 110, y: 60 }, 0), true);
  assert.equal(textHitBy(el, { x: 300, y: 60 }, 0), false);
  assert.equal(textHitBy(el, { x: 110, y: 200 }, 0), false);
  assert.equal(textHitBy(el, { x: 100, y: 50 }, 0), true);     // đúng góc neo
  assert.equal(textHitBy(el, { x: 160, y: 76 }, 0), true);     // đúng góc đối
});

// Bán kính gôm nới hộp ra mọi phía: quét sát mép chữ vẫn phải ăn.
test("hit-test: bán kính nới hộp ra", () => {
  const el = { pts: [100, 50], w: 60, h: 26 };
  assert.equal(textHitBy(el, { x: 95, y: 60 }, 0), false);
  assert.equal(textHitBy(el, { x: 95, y: 60 }, 8), true);
  assert.equal(textHitBy(el, { x: 95, y: 60 }, 3), false);
});

test("hit-test: phần tử thiếu w/h thì trượt, không nổ", () => {
  assert.equal(textHitBy({ pts: [0, 0] }, { x: 0, y: 0 }, 5), false);
  assert.equal(textHitBy({}, { x: 0, y: 0 }, 5), false);
  assert.equal(textHitBy({ pts: [0], w: 10, h: 10 }, { x: 0, y: 0 }, 5), false);
});
