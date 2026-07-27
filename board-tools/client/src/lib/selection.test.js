import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceIdSet } from "./selection.js";

test("replaceIdSet: cùng nội dung → trả về CHÍNH Set cũ (không kích hoạt effect oan)", () => {
  const prev = new Set([1, 2, 3]);
  assert.equal(replaceIdSet(prev, [3, 2, 1]), prev, "thứ tự không quan trọng");
});

test("replaceIdSet: thêm một id → Set mới", () => {
  const prev = new Set([1, 2]);
  const next = replaceIdSet(prev, [1, 2, 3]);
  assert.notEqual(next, prev);
  assert.deepEqual(Array.from(next), [1, 2, 3]);
});

test("replaceIdSet: cùng số lượng nhưng khác phần tử → Set mới", () => {
  const prev = new Set([1, 2]);
  const next = replaceIdSet(prev, [1, 9]);
  assert.notEqual(next, prev);
  assert.deepEqual(Array.from(next), [1, 9]);
});

test("replaceIdSet: bỏ chọn hết → Set rỗng mới", () => {
  const prev = new Set([1]);
  const next = replaceIdSet(prev, []);
  assert.notEqual(next, prev);
  assert.equal(next.size, 0);
});

test("replaceIdSet: rỗng → rỗng giữ nguyên tham chiếu", () => {
  const prev = new Set();
  assert.equal(replaceIdSet(prev, []), prev);
});
