import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_HISTORY, emptyHistory, record, undo, redo, beginNudge, flushNudge } from "./history.js";

const b = (v) => ({ v });

test("trần MAX_HISTORY: bước cũ nhất rơi ra", () => {
  let h = emptyHistory();
  for (let i = 0; i < MAX_HISTORY + 5; i++) h = record(h, b(i));
  assert.equal(MAX_HISTORY, 50);
  assert.equal(h.past.length, MAX_HISTORY);
  assert.equal(h.past[0].v, 5);
  assert.equal(h.past[h.past.length - 1].v, MAX_HISTORY + 4);
});

test("record xoá future", () => {
  let h = record(emptyHistory(), b(0));
  const u = undo(h, b(1));
  assert.equal(u.history.future.length, 1);
  h = record(u.history, b(0));
  assert.deepEqual(h.future, []);
});

test("undo / redo đi qua lại đúng bản", () => {
  let h = record(emptyHistory(), b(0)); // đang ở b(1)
  const u = undo(h, b(1));
  assert.deepEqual(u.board, b(0));
  assert.deepEqual(u.history.future, [b(1)]);
  const r = redo(u.history, b(0));
  assert.deepEqual(r.board, b(1));
  assert.deepEqual(r.history.past, [b(0)]);
  assert.deepEqual(r.history.future, []);
});

test("không có gì để lùi / làm lại thì trả null", () => {
  assert.equal(undo(emptyHistory(), b(0)), null);
  assert.equal(redo(emptyHistory(), b(0)), null);
});

test("undo giữa loạt nhích: về mốc TRƯỚC loạt, past không đổi", () => {
  let h = record(emptyHistory(), b("trước nữa"));
  h = beginNudge(h, b("trước loạt"));
  h = beginNudge(h, b("nhịp 2")); // nhịp sau không ghi đè mốc
  const u = undo(h, b("nhịp 3"));
  assert.deepEqual(u.board, b("trước loạt"));
  assert.equal(u.history.nudgeBase, null);
  assert.deepEqual(u.history.past, [b("trước nữa")]);
  assert.deepEqual(u.history.future, [b("nhịp 3")]);
});

test("redo khi đang có loạt nhích: chỉ chốt loạt, không đổi màn hình", () => {
  let h = beginNudge(emptyHistory(), b("trước loạt"));
  h = { ...h, future: [b("cũ")] };
  const r = redo(h, b("nhịp 3"));
  assert.equal(r.board, null);
  assert.deepEqual(r.history.past, [b("trước loạt")]);
  assert.deepEqual(r.history.future, []);
  assert.equal(r.history.nudgeBase, null);
});

test("record khi đang có loạt nhích: loạt thành một bước riêng nằm dưới", () => {
  let h = beginNudge(emptyHistory(), b("trước loạt"));
  h = record(h, b("sau loạt"));
  assert.deepEqual(h.past, [b("trước loạt"), b("sau loạt")]);
  assert.equal(h.nudgeBase, null);
});

test("flushNudge không có loạt thì trả nguyên object", () => {
  const h = record(emptyHistory(), b(0));
  assert.equal(flushNudge(h), h);
});
