// game-tools/client/src/lib/ink-live.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INK_LIVE_TTL_MS, INK_SETTLE_TTL_MS, inkKey, mergeInkPacket, reconcileInkOverlay
} from "./ink-live.js";

const NOW = 1000;
// socketId do SERVER đính vào, không phải client tự đặt.
function pkt(o) { return { socketId: "s1", strokeId: 1, ...o }; }

test("inkKey: khoá theo socketId + strokeId", () => {
  assert.equal(inkKey({ socketId: "abc", strokeId: 7 }), "abc:7");
});

test("mergeInkPacket: gói đầu tạo entry đủ màu, độ dày, điểm", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0, 10, 10] }), NOW);
  assert.deepEqual(m.get("s1:1"), {
    kind: "pen", fill: false,
    color: "pen-red", w: 4, pts: [0, 0, 10, 10],
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});

test("mergeInkPacket: gói sau nối điểm mới vào đuôi và gia hạn TTL", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  m = mergeInkPacket(m, pkt({ seq: 2, pts: [20, 20] }), NOW + 80);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10, 20, 20]);
  assert.equal(m.get("s1:1").expiresAt, NOW + 80 + INK_LIVE_TTL_MS);
});

// Vào board giữa lúc người khác đang vẽ: không có gói seq 0 nên không biết màu
// và độ dày. Bỏ qua, đừng vẽ một nét vô màu.
test("mergeInkPacket: thiếu gói đầu thì bỏ qua và trả đúng map cũ", () => {
  const prev = new Map();
  assert.equal(mergeInkPacket(prev, pkt({ seq: 3, pts: [1, 1] }), NOW), prev);
});

test("mergeInkPacket: gói done ghi drawingId, đổi sang TTL dài, giữ nguyên điểm", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-blue", w: 2, pts: [0, 0, 5, 5] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW + 100);
  const e = m.get("s1:1");
  assert.equal(e.drawingId, 37);
  assert.equal(e.expiresAt, NOW + 100 + INK_SETTLE_TTL_MS);
  assert.deepEqual(e.pts, [0, 0, 5, 5], "gói done không được xoá điểm đã nhận");
});

test("mergeInkPacket: gói cancel bỏ hẳn entry", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ cancel: true }), NOW + 50);
  assert.equal(m.has("s1:1"), false);
});

test("mergeInkPacket: gói erase gom id, không trùng lặp", () => {
  let m = mergeInkPacket(new Map(), pkt({ erase: [3, 7] }), NOW);
  m = mergeInkPacket(m, pkt({ erase: [7, 12] }), NOW + 40);
  assert.deepEqual(m.get("s1:1").erase, [3, 7, 12]);
  assert.equal(m.get("s1:1").pts, null);
});

test("mergeInkPacket: hai người vẽ cùng lúc là hai entry riêng", () => {
  let m = mergeInkPacket(new Map(), { socketId: "s1", strokeId: 1, seq: 0, color: "pen-red", w: 4, pts: [0, 0] }, NOW);
  m = mergeInkPacket(m, { socketId: "s2", strokeId: 1, seq: 0, color: "pen-blue", w: 8, pts: [9, 9] }, NOW);
  assert.equal(m.size, 2);
  assert.equal(m.get("s2:1").color, "pen-blue");
});

test("mergeInkPacket: gói rác trả đúng map cũ, không nổ", () => {
  const prev = new Map();
  assert.equal(mergeInkPacket(prev, null, NOW), prev);
  assert.equal(mergeInkPacket(prev, { seq: 0, pts: [0, 0] }, NOW), prev, "thiếu socketId");
  assert.equal(mergeInkPacket(prev, pkt({ seq: 0, pts: [] }), NOW), prev, "pts rỗng");
});

test("reconcileInkOverlay: bỏ ngay entry mà board đã có nét thật", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW);
  const board = { drawings: [{ id: 37, kind: "pen", color: "pen-red", w: 4, pts: [0, 0] }] };
  assert.equal(reconcileInkOverlay(m, board).has("s1:1"), false);
});

test("reconcileInkOverlay: giữ entry mà board chưa bắt kịp", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [] }).has("s1:1"), true);
});

test("reconcileInkOverlay: nét đang vẽ chưa done thì không bị bỏ, trả map cũ", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 1 }] }), m);
});

test("reconcileInkOverlay: entry gôm bỏ khi mọi nét đã thật sự mất khỏi board", () => {
  const m = mergeInkPacket(new Map(), pkt({ erase: [3, 7], done: true }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 9 }] }).has("s1:1"), false);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 3 }] }).has("s1:1"), true);
});

test("reconcileInkOverlay: overlay rỗng hoặc board null trả map cũ", () => {
  const empty = new Map();
  assert.equal(reconcileInkOverlay(empty, { drawings: [] }), empty);
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(reconcileInkOverlay(m, null), m);
});

test("mergeInkPacket: gói đầu của hình khối giữ kind và fill", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: true, pts: [0, 0, 100, 60] }),
    NOW
  );
  assert.deepEqual(m.get("s1:1"), {
    kind: "rect", fill: true,
    color: "pen-blue", w: 8, pts: [0, 0, 100, 60],
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});

// ĐÂY là điểm khác nhau cốt lõi giữa hai loại gói: gói hình khối mang CẢ hộp
// nên phải THAY, không nối. Nối thì hộp dài ra thành 6, 8, 10 số và shapePath
// đọc sai hình.
test("mergeInkPacket: gói sau của hình khối THAY hộp chứ không nối", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: false, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "rect", pts: [0, 0, 50, 40] }), NOW + 40);
  m = mergeInkPacket(m, pkt({ seq: 2, kind: "rect", pts: [0, 0, 90, 70] }), NOW + 80);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 90, 70]);
  assert.equal(m.get("s1:1").kind, "rect", "kind phải giữ qua các gói");
  assert.equal(m.get("s1:1").fill, false, "fill phải giữ qua các gói");
  assert.equal(m.get("s1:1").expiresAt, NOW + 80 + INK_LIVE_TTL_MS);
});

test("mergeInkPacket: gói done của hình khối giữ hộp và mang drawingId", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "ellipse", color: "pen-green", w: 2, fill: true, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 42 }), NOW + 50);
  const e = m.get("s1:1");
  assert.equal(e.drawingId, 42);
  assert.equal(e.kind, "ellipse");
  assert.deepEqual(e.pts, [0, 0, 10, 10]);
  assert.equal(e.expiresAt, NOW + 50 + INK_SETTLE_TTL_MS);
});

test("mergeInkPacket: gói không có kind vẫn là nét bút và vẫn NỐI điểm", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  assert.equal(m.get("s1:1").kind, "pen");
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10]);
});

// Fix round 1: gói seq > 0 của hình khối mà THIẾU kind (client cũ, hoặc field
// bị rơi trên đường truyền) phải vẫn được nhận ra là hình khối qua kind của
// entry đã lưu (cur.kind), không được mặc định về "pen" — mặc định sai sẽ rơi
// vào nhánh NỐI và làm hộp phình từ 4 lên 8 số.
test("mergeInkPacket: gói sau của hình khối THIẾU kind vẫn phải THAY hộp, không nối", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: false, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [0, 0, 50, 40] }), NOW + 40); // không có kind
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 50, 40]);
});

// Bài chốt hồi quy: nét bút vốn không mang kind ở gói nào cả (kể cả seq 0), nên
// bản sửa fallback về cur.kind không được đổi hành vi NỐI của nét bút.
test("mergeInkPacket: gói sau của nét bút (không kind) vẫn NỐI như cũ sau khi sửa fallback", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10]);
});
