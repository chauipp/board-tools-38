import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceIdSet, toggleId, unionIdSet } from "./selection.js";

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

test("toggleId: chưa có → thêm vào, không đụng phần còn lại", () => {
  const prev = new Set([1, 2]);
  const next = toggleId(prev, 3);
  assert.notEqual(next, prev);
  assert.deepEqual(Array.from(next).sort(), [1, 2, 3]);
  assert.deepEqual(Array.from(prev).sort(), [1, 2], "Set cũ không bị sửa tại chỗ");
});

test("toggleId: đã có → bớt ra", () => {
  const next = toggleId(new Set([1, 2, 3]), 2);
  assert.deepEqual(Array.from(next).sort(), [1, 3]);
});

test("toggleId: bớt id cuối cùng → Set rỗng", () => {
  assert.equal(toggleId(new Set([7]), 7).size, 0);
});

test("toggleId: bật rồi tắt → về đúng tập ban đầu", () => {
  const prev = new Set([1, 2]);
  const back = toggleId(toggleId(prev, 5), 5);
  assert.deepEqual(Array.from(back).sort(), [1, 2]);
});

test("unionIdSet: cộng thẻ mới quét được vào lựa chọn cũ", () => {
  const next = unionIdSet(new Set([1]), new Set([1]), [2, 3]);
  assert.deepEqual(Array.from(next).sort(), [1, 2, 3]);
});

// Đây là lý do unionIdSet nhận `base` rời chứ không cộng dồn vào `prev`: khung
// quét co lại thì thẻ vừa rời khỏi khung phải nhả ra, chỉ những thẻ thuộc lựa
// chọn CŨ mới được giữ. Cộng dồn vào prev thì mọi thẻ từng lướt qua sẽ dính luôn.
test("unionIdSet: khung quét co lại → nhả thẻ đã rời khung, giữ lựa chọn cũ", () => {
  const base = new Set([1]);
  const wide = unionIdSet(new Set([1]), base, [2, 3]);
  assert.deepEqual(Array.from(wide).sort(), [1, 2, 3]);
  const narrow = unionIdSet(wide, base, [2]);
  assert.deepEqual(Array.from(narrow).sort(), [1, 2], "3 đã ra khỏi khung thì phải nhả");
});

test("unionIdSet: kết quả y như nhịp trước → trả về CHÍNH Set cũ", () => {
  const prev = new Set([1, 2]);
  assert.equal(unionIdSet(prev, new Set([1]), [2]), prev);
});

test("unionIdSet: base rỗng → hệt replaceIdSet (quét thường, không giữ Ctrl)", () => {
  const next = unionIdSet(new Set([9]), new Set(), [1, 2]);
  assert.deepEqual(Array.from(next).sort(), [1, 2]);
});
