import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeLiveText,
  MAX_LIVE_INK_TEXT_LEN,
  MIN_LIVE_INK_TEXT_SIZE,
  MAX_LIVE_INK_TEXT_SIZE,
  sanitizeLiveMoves
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

// ── sanitizeLiveMoves ───────────────────────────────────────────────────────
const anyKind = (k) => ["pen", "rect", "quad", "text"].includes(k);

test("danh sách hợp lệ đi qua nguyên vẹn", () => {
  const got = sanitizeLiveMoves([{ id: 1, pts: [0, 0, 10, 10] }], anyKind);
  assert.deepEqual(got, [{ id: 1, pts: [0, 0, 10, 10] }]);
});

test("kind hợp lệ được giữ, kind lạ thì LOẠI cả gói", () => {
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], kind: "quad" }], anyKind)[0].kind, "quad");
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], kind: "hexagon" }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], kind: 7 }], anyKind), null);
});

test("pts lẻ số hoặc rỗng là dữ liệu hỏng, LOẠI cả gói", () => {
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0, 5] }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [] }], anyKind), null);
});

// Number.isFinite một mình cho qua 1e9 — cùng bài học với MAX_LIVE_INK_COORD.
test("toạ độ khổng lồ bị LOẠI, không phủ kín màn hình cả phòng", () => {
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 1e9] }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, Infinity] }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, NaN] }], anyKind), null);
});

test("id thiếu hoặc sai kiểu thì LOẠI cả gói", () => {
  assert.equal(sanitizeLiveMoves([{ pts: [0, 0] }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: "1", pts: [0, 0] }], anyKind), null);
});

// LOẠI CẢ GÓI chứ không cắt bớt: nửa cụm nhúc nhích còn nửa kia đứng yên thì
// khó hiểu hơn hẳn việc cả cụm cùng đứng yên.
test("quá nhiều nét thì LOẠI cả gói, không cắt bớt danh sách", () => {
  const many = Array.from({ length: 61 }, (_, i) => ({ id: i, pts: [0, 0] }));
  assert.equal(sanitizeLiveMoves(many, anyKind), null);
});

test("tổng số toạ độ vượt trần thì LOẠI cả gói", () => {
  const heavy = Array.from({ length: 20 }, (_, i) => ({ id: i, pts: new Array(400).fill(1) }));
  assert.equal(sanitizeLiveMoves(heavy, anyKind), null);
});

test("cỡ chữ trong gói dời cũng bị kiểm, không lọt size khổng lồ", () => {
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], size: 1e9 }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], size: 24 }], anyKind)[0].size, 24);
});

test("w/h âm hoặc khổng lồ bị LOẠI", () => {
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], w: -5 }], anyKind), null);
  assert.equal(sanitizeLiveMoves([{ id: 1, pts: [0, 0], h: 1e9 }], anyKind), null);
});

test("field lạ không được chép sang gói sạch", () => {
  const got = sanitizeLiveMoves([{ id: 1, pts: [0, 0], evil: "<script>", locked: true }], anyKind);
  assert.deepEqual(Object.keys(got[0]), ["id", "pts"]);
});

test("danh sách rỗng hoặc rác không làm nổ", () => {
  assert.equal(sanitizeLiveMoves([], anyKind), null);
  assert.equal(sanitizeLiveMoves(null, anyKind), null);
  assert.equal(sanitizeLiveMoves("moving", anyKind), null);
  assert.equal(sanitizeLiveMoves([null], anyKind), null);
});
