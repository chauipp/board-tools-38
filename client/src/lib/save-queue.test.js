import { test } from "node:test";
import assert from "node:assert/strict";
import { createSaveQueue, MAX_REBASE_TRIES } from "./save-queue.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

// Server giả: mỗi cú PUT được ghi lại; `plan` quyết định từng cú trả gì.
function harness({ plan = [], role = "editor", rebase } = {}) {
  const puts = [];
  const states = [];
  const adopted = [];
  let base = { v: 0 };
  let stamp = "t0";
  let n = 0;
  const q = createSaveQueue({
    canSave: () => role !== "viewer",
    save: (next, s) => {
      puts.push({ next, stamp: s });
      const step = plan[n++] || "ok";
      return new Promise((resolve, reject) => setTimeout(() => {
        if (step === "ok") resolve({ updatedAt: "t" + puts.length });
        else if (step === "conflict") {
          const err = new Error("conflict"); err.code = "CONFLICT"; err.board = { v: "server", updatedAt: "s" + puts.length };
          reject(err);
        } else if (step === "conflict-no-board") {
          const err = new Error("conflict"); err.code = "CONFLICT"; reject(err);
        } else reject(new Error("network"));
      }, 0));
    },
    rebase: rebase || ((server, b, next) => ({ ...next, rebasedOnto: server.v })),
    merge: (rebased) => ({ ...rebased, merged: true }),
    adopt: (m) => adopted.push(m),
    getBase: () => base,
    setBase: (b) => { base = b; },
    getStamp: () => stamp,
    setStamp: (s) => { stamp = s; },
    onState: (s) => states.push(s.error)
  });
  return { q, puts, states, adopted, get base() { return base; }, get stamp() { return stamp; } };
}

async function settle(times = 10) { for (let i = 0; i < times; i++) await flush(); }

test("lưu thường: một PUT kèm mốc, xong thì cập nhật base + mốc", async () => {
  const h = harness();
  h.q.saveNow({ v: 1 });
  await settle();
  assert.equal(h.puts.length, 1);
  assert.equal(h.puts[0].stamp, "t0");
  assert.deepEqual(h.base, { v: 1 });
  assert.equal(h.stamp, "t1");
  assert.deepEqual(h.states, [null]);
});

test("gọi liên tiếp khi đang bay: chỉ 2 PUT, cú sau mang bản MỚI NHẤT", async () => {
  const h = harness();
  h.q.saveNow({ v: 1 });
  h.q.saveNow({ v: 2 });
  h.q.saveNow({ v: 3 });
  await settle();
  assert.equal(h.puts.length, 2);
  assert.deepEqual(h.puts.map((p) => p.next.v), [1, 3]);
  // Cú thứ hai chốt mốc SAU khi cú đầu về.
  assert.equal(h.puts[1].stamp, "t1");
});

test("409 một lần rồi thành công: ghép lại, đưa lên màn hình, lưu kèm mốc của server", async () => {
  const h = harness({ plan: ["conflict", "ok"] });
  h.q.saveNow({ v: 1 });
  await settle();
  assert.equal(h.puts.length, 2);
  assert.deepEqual(h.puts[1].next, { v: 1, rebasedOnto: "server", merged: true });
  assert.equal(h.puts[1].stamp, "s1");
  assert.equal(h.adopted.length, 1);
  assert.deepEqual(h.states, [null]);
});

test("409 quá số lần: đi đường dự phòng ghi đè, không kèm mốc", async () => {
  const conflicts = Array(MAX_REBASE_TRIES + 1).fill("conflict");
  const h = harness({ plan: [...conflicts, "ok"] });
  h.q.saveNow({ v: 1 });
  await settle(30);
  assert.equal(h.puts.length, MAX_REBASE_TRIES + 2);
  assert.equal(h.puts[h.puts.length - 1].stamp, undefined);
  assert.deepEqual(h.states, [null]);
});

test("rebase trả null: ghi đè ngay, không kèm mốc", async () => {
  const h = harness({ plan: ["conflict", "ok"], rebase: () => null });
  h.q.saveNow({ v: 1 });
  await settle();
  assert.equal(h.puts.length, 2);
  assert.deepEqual(h.puts[1].next, { v: 1 });
  assert.equal(h.puts[1].stamp, undefined);
  assert.equal(h.adopted.length, 0);
});

test("409 không kèm bản server: coi như ghép hỏng → ghi đè", async () => {
  const h = harness({ plan: ["conflict-no-board", "ok"] });
  h.q.saveNow({ v: 1 });
  await settle();
  assert.equal(h.puts.length, 2);
  assert.equal(h.puts[1].stamp, undefined);
});

test("lỗi mạng: báo error, hàng đợi vẫn chạy tiếp cú đang chờ", async () => {
  const h = harness({ plan: ["network", "ok"] });
  h.q.saveNow({ v: 1 });
  h.q.saveNow({ v: 2 });
  await settle();
  assert.deepEqual(h.states, [true, null]);
  assert.deepEqual(h.puts.map((p) => p.next.v), [1, 2]);
  // Lỗi thì không dời base.
  assert.deepEqual(h.base, { v: 2 });
});

test("viewer: không bao giờ PUT", async () => {
  const h = harness({ role: "viewer" });
  h.q.saveNow({ v: 1 });
  h.q.saveDebounced({ v: 2 }, 1);
  await new Promise((r) => setTimeout(r, 10));
  await settle();
  assert.equal(h.puts.length, 0);
});

test("saveDebounced gộp nhiều cú thành một; saveNow huỷ cú đang chờ", async () => {
  const h = harness();
  h.q.saveDebounced({ v: 1 }, 5);
  h.q.saveDebounced({ v: 2 }, 5);
  await new Promise((r) => setTimeout(r, 20));
  await settle();
  assert.deepEqual(h.puts.map((p) => p.next.v), [2]);

  h.q.saveDebounced({ v: 3 }, 5);
  h.q.saveNow({ v: 4 });
  await new Promise((r) => setTimeout(r, 20));
  await settle();
  assert.deepEqual(h.puts.map((p) => p.next.v), [2, 4]);
});

test("prepare chạy trước khi gửi, ở cả vòng ghép lại", async () => {
  const prepared = [];
  const puts = [];
  let n = 0;
  const q = createSaveQueue({
    prepare: (next) => { prepared.push(next); return { ...next, arranged: true }; },
    save: (next) => {
      puts.push(next);
      if (n++ === 0) { const e = new Error("c"); e.code = "CONFLICT"; e.board = { updatedAt: "s" }; return Promise.reject(e); }
      return Promise.resolve({ updatedAt: "t" });
    },
    rebase: (server, base, next) => next,
    getBase: () => null, setBase: () => {}, getStamp: () => null, setStamp: () => {}
  });
  q.saveNow({ v: 1 });
  await settle();
  assert.equal(prepared.length, 2);
  assert.ok(puts.every((p) => p.arranged));
});
