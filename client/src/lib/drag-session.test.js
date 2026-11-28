import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startDrag } from "./drag-session.js";

// Khung hình giả: requestAnimationFrame chỉ chạy khi test gọi frame().
let frames = new Map();
let nextFrame = 1;
beforeEach(() => {
  frames = new Map();
  globalThis.requestAnimationFrame = (cb) => { const id = nextFrame++; frames.set(id, cb); return id; };
  globalThis.cancelAnimationFrame = (id) => { frames.delete(id); };
});
function frame() { const cbs = [...frames.values()]; frames.clear(); cbs.forEach((cb) => cb()); }

function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener: (type, fn) => { listeners.get(type)?.delete(fn); },
    fire: (type, ev = {}) => { [...(listeners.get(type) || [])].forEach((fn) => fn({ type, ...ev })); },
    count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0)
  };
}
const down = { clientX: 100, clientY: 100 };

test("gộp nhịp di theo khung hình, luôn dùng vị trí mới nhất", () => {
  const target = fakeTarget();
  const seen = [];
  startDrag(down, { target, onMove: (ev) => seen.push(ev.clientX) });
  target.fire("mousemove", { clientX: 110, clientY: 100 });
  target.fire("mousemove", { clientX: 120, clientY: 100 });
  assert.deepEqual(seen, []);
  frame();
  assert.deepEqual(seen, [120]);
});

test("nhả chuột: gỡ hết listener, chạy nốt nhịp treo RỒI mới gọi onEnd", () => {
  const target = fakeTarget();
  const order = [];
  startDrag(down, { target, onMove: (ev) => order.push("move " + ev.clientX), onEnd: (ev, s) => order.push("end " + s.moved) });
  target.fire("mousemove", { clientX: 130, clientY: 100 });
  target.fire("mouseup", { clientX: 130, clientY: 100 });
  assert.deepEqual(order, ["move 130", "end true"]);
  assert.equal(target.count(), 0);
  target.fire("mousemove", { clientX: 200, clientY: 100 });
  frame();
  assert.equal(order.length, 2);
});

test("release: cancel bỏ nhịp còn treo", () => {
  const target = fakeTarget();
  const seen = [];
  startDrag(down, { target, release: "cancel", onMove: (ev) => seen.push(ev.clientX), onEnd: () => seen.push("end") });
  target.fire("mousemove", { clientX: 130, clientY: 100 });
  target.fire("mouseup", {});
  frame();
  assert.deepEqual(seen, ["end"]);
});

test("ngưỡng: chưa đi xa hơn threshold thì chưa phải kéo", () => {
  const target = fakeTarget();
  const seen = [];
  let ended = null;
  startDrag(down, { target, threshold: 5, onMove: (ev) => seen.push(ev.clientX), onEnd: (ev, s) => { ended = s.moved; } });
  target.fire("mousemove", { clientX: 105, clientY: 100 }); frame(); // đúng bằng ngưỡng: chưa
  assert.deepEqual(seen, []);
  target.fire("mousemove", { clientX: 106, clientY: 100 }); frame();
  assert.deepEqual(seen, [106]);
  target.fire("mouseup", {});
  assert.equal(ended, true);
});

test("bấm-không-kéo: onEnd nhận moved = false", () => {
  const target = fakeTarget();
  let moved = null;
  startDrag(down, { target, threshold: 4, onEnd: (ev, s) => { moved = s.moved; } });
  target.fire("mousemove", { clientX: 101, clientY: 101 }); frame();
  target.fire("mouseup", {});
  assert.equal(moved, false);
});

test("không throttle: onMove chạy ngay từng nhịp", () => {
  const target = fakeTarget();
  const seen = [];
  startDrag(down, { target, throttle: false, onMove: (ev) => seen.push(ev.clientX) });
  target.fire("mousemove", { clientX: 1, clientY: 0 });
  target.fire("mousemove", { clientX: 2, clientY: 0 });
  assert.deepEqual(seen, [1, 2]);
});

test("cancel(): gỡ listener, bỏ nhịp treo, gọi onCancel, không gọi onEnd", () => {
  const target = fakeTarget();
  const log = [];
  const cancel = startDrag(down, { target, onMove: () => log.push("move"), onEnd: () => log.push("end"), onCancel: () => log.push("cancel") });
  target.fire("mousemove", { clientX: 150, clientY: 100 });
  cancel();
  frame();
  target.fire("mouseup", {});
  cancel();
  assert.deepEqual(log, ["cancel"]);
  assert.equal(target.count(), 0);
});

test("blur: end chốt lượt kéo, cancel huỷ nó", () => {
  const t1 = fakeTarget();
  let endType = null;
  startDrag(down, { target: t1, blur: "end", onEnd: (ev) => { endType = ev.type; } });
  t1.fire("blur");
  assert.equal(endType, "blur");
  assert.equal(t1.count(), 0);

  const t2 = fakeTarget();
  const log = [];
  startDrag(down, { target: t2, blur: "cancel", onEnd: () => log.push("end"), onCancel: () => log.push("cancel") });
  t2.fire("blur");
  assert.deepEqual(log, ["cancel"]);
  assert.equal(t2.count(), 0);
});

test("Esc huỷ lượt kéo và chặn phím lan tiếp; phím khác thì không", () => {
  const target = fakeTarget();
  const log = [];
  startDrag(down, { target, cancelOnEscape: true, onCancel: () => log.push("cancel") });
  let stopped = false;
  target.fire("keydown", { key: "a", preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.deepEqual(log, []);
  target.fire("keydown", { key: "Escape", preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.deepEqual(log, ["cancel"]);
  assert.equal(stopped, true);
  assert.equal(target.count(), 0);
});
