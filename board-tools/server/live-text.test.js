import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeLiveText,
  MAX_LIVE_INK_TEXT_LEN,
  MIN_LIVE_INK_TEXT_SIZE,
  MAX_LIVE_INK_TEXT_SIZE
} from "./live-text.js";

test("gói mở hợp lệ: giữ chữ, cỡ chữ và id đang sửa", () => {
  const got = sanitizeLiveText({ text: "xin chào", size: 20, editId: 7 }, true);
  assert.deepEqual(got, { text: "xin chào", size: 20, editId: 7 });
});

test("gói giữa chừng chỉ mang chữ — cỡ chữ đã chốt ở gói mở", () => {
  const got = sanitizeLiveText({ text: "gõ tiếp", size: 999999, editId: 3 }, false);
  assert.deepEqual(got, { text: "gõ tiếp" });
});

test("tạo mới thì editId là null, không phải undefined", () => {
  assert.equal(sanitizeLiveText({ text: "", size: 20 }, true).editId, null);
});

test("editId sai kiểu bị quy về null chứ không lọt qua", () => {
  assert.equal(sanitizeLiveText({ text: "", size: 20, editId: "7" }, true).editId, null);
  assert.equal(sanitizeLiveText({ text: "", size: 20, editId: NaN }, true).editId, null);
});

// Đây là lý do cả file này tồn tại: gói chữ là gói DUY NHẤT trên live:ink chở dữ
// liệu người dùng gõ tự do, và server phát nó cho cả phòng ~25 lần/giây.
test("đoạn văn khổng lồ bị CẮT chứ không bơm cho cả phòng", () => {
  const got = sanitizeLiveText({ text: "a".repeat(500000), size: 20 }, true);
  assert.equal(got.text.length, MAX_LIVE_INK_TEXT_LEN);
});

// Cắt chứ không loại: người gõ vượt trần vẫn phải thấy mình gõ được.
test("vượt trần độ dài vẫn là gói HỢP LỆ, không bị loại", () => {
  assert.notEqual(sanitizeLiveText({ text: "a".repeat(500000), size: 20 }, true), null);
});

test("thiếu text thì thành chuỗi rỗng, không thành \"undefined\"", () => {
  assert.equal(sanitizeLiveText({ size: 20 }, true).text, "");
  assert.equal(sanitizeLiveText({ text: null, size: 20 }, true).text, "");
});

// Cỡ chữ khổng lồ là một chữ cái phủ kín màn hình cả phòng tới khi hết TTL, mà
// chữ đang gõ chưa có id nên không ai gôm nó đi được.
test("cỡ chữ ngoài dải bị LOẠI cả gói", () => {
  assert.equal(sanitizeLiveText({ text: "x", size: 1e9 }, true), null);
  assert.equal(sanitizeLiveText({ text: "x", size: MAX_LIVE_INK_TEXT_SIZE + 1 }, true), null);
  assert.equal(sanitizeLiveText({ text: "x", size: MIN_LIVE_INK_TEXT_SIZE - 1 }, true), null);
  assert.equal(sanitizeLiveText({ text: "x", size: -20 }, true), null);
});

test("cỡ chữ thiếu hoặc sai kiểu bị LOẠI — người nhận không đoán được", () => {
  assert.equal(sanitizeLiveText({ text: "x" }, true), null);
  assert.equal(sanitizeLiveText({ text: "x", size: "20" }, true), null);
  assert.equal(sanitizeLiveText({ text: "x", size: NaN }, true), null);
  assert.equal(sanitizeLiveText({ text: "x", size: Infinity }, true), null);
});

test("hai biên của dải cỡ chữ đều được chấp", () => {
  assert.equal(sanitizeLiveText({ text: "x", size: MIN_LIVE_INK_TEXT_SIZE }, true).size, MIN_LIVE_INK_TEXT_SIZE);
  assert.equal(sanitizeLiveText({ text: "x", size: MAX_LIVE_INK_TEXT_SIZE }, true).size, MAX_LIVE_INK_TEXT_SIZE);
});

// Gói rác không được làm nổ server — nó tới thẳng từ mạng.
test("payload rác không làm nổ", () => {
  assert.doesNotThrow(() => sanitizeLiveText(null, false));
  assert.doesNotThrow(() => sanitizeLiveText(undefined, true));
  assert.equal(sanitizeLiveText(null, false).text, "");
  assert.equal(sanitizeLiveText(null, true), null);
});

// text không phải chuỗi: ép về chuỗi chứ không để lọt một object xuống client.
test("text sai kiểu bị ép về chuỗi", () => {
  assert.equal(typeof sanitizeLiveText({ text: { a: 1 }, size: 20 }, true).text, "string");
  assert.equal(typeof sanitizeLiveText({ text: 12345, size: 20 }, true).text, "string");
});
