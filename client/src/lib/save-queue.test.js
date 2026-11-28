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

// ── Review PR #7: thay đổi đồng thời trong lúc một PUT đang bị 409 ───────────
// rebase giả: đắp mọi khoá mà `next` đổi so với `base` lên bản server.
function deltaRebase(server, base, next) {
  const out = { ...server };
  for (const k of Object.keys(next)) if (next[k] !== base[k]) out[k] = next[k];
  return out;
}
function conflictHarness() {
  const puts = [];
  const adopted = [];
  let base = { v: 0 };
  let stamp = "t0";
  let n = 0;
  const timers = [];
  const q = createSaveQueue({
    save: (next, s) => {
      puts.push({ next, stamp: s });
      const i = n++;
      return new Promise((resolve, reject) => setTimeout(() => {
        if (i === 0) {
          const err = new Error("conflict"); err.code = "CONFLICT";
          err.board = { v: 0, remote: true, updatedAt: "s1" };
          reject(err);
        } else resolve({ updatedAt: "t" + puts.length });
      }, 0));
    },
    rebase: deltaRebase,
    adopt: (m) => adopted.push(m),
    getBase: () => base, setBase: (b) => { base = b; },
    getStamp: () => stamp, setStamp: (s) => { stamp = s; },
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: (id) => { timers[id - 1] = null; }
  });
  return { q, puts, adopted, timers };
}

test("409 khi đã có cú lưu xếp hàng: cú xếp hàng được ghép lên bản server, không xoá thay đổi từ xa", async () => {
  const h = conflictHarness();
  h.q.saveNow({ v: 0, a: 1 });          // A bay
  h.q.saveNow({ v: 0, a: 2 });          // B xếp hàng, dựng TRƯỚC khi ghép
  await settle();
  const last = h.puts[h.puts.length - 1].next;
  assert.equal(last.remote, true, "PUT cuối phải giữ thay đổi từ xa");
  assert.equal(last.a, 2, "PUT cuối phải mang thay đổi của B");
  // Màn hình cũng phải hiện cả hai.
  const shown = h.adopted[h.adopted.length - 1];
  assert.equal(shown.remote, true);
  assert.equal(shown.a, 2);
});

test("409 trong lúc một cú lưu hẹn giờ đang chờ: cú hẹn giờ không bị huỷ và được ghép", async () => {
  const h = conflictHarness();
  h.q.saveNow({ v: 0, a: 1 });          // A bay
  h.q.saveDebounced({ v: 0, a: 2 }, 500); // nhích phím: hẹn 500ms
  await settle();                        // 409 về + retry xong, timer chưa nổ
  const fire = h.timers.filter(Boolean);
  assert.equal(fire.length, 1, "retry không được huỷ cú lưu hẹn giờ");
  fire[0]();
  await settle();
  const last = h.puts[h.puts.length - 1].next;
  assert.equal(last.a, 2, "vị trí mới phải được lưu");
  assert.equal(last.remote, true, "và không xoá thay đổi từ xa");
});

test("với rebaseBoard thật: thẻ từ xa và cú nhích đang chờ đều còn trong PUT cuối", async () => {
  const { rebaseBoard } = await import("./rebase.js");
  const mk = (nodes, extra = {}) => ({
    nodes, edges: [], groups: [], drawings: [], statuses: [], tags: [], palette: [],
    nextNodeId: 10, nextEdgeId: 1, nextGroupId: 1, nextStatusId: 1, nextTagId: 1, nextPaletteId: 1, nextDrawingId: 1, ...extra
  });
  const base0 = mk([{ id: 1, title: "A", x: 0, y: 0 }]);
  const remote = mk([{ id: 1, title: "A", x: 0, y: 0 }, { id: 5, title: "Từ xa", x: 300, y: 0 }], { nextNodeId: 10, updatedAt: "s1" });
  let base = base0, stamp = "t0", n = 0;
  const puts = [];
  const q = createSaveQueue({
    save: (next) => {
      puts.push(next);
      const i = n++;
      return new Promise((resolve, reject) => setTimeout(() => {
        if (i === 0) { const e = new Error("c"); e.code = "CONFLICT"; e.board = remote; reject(e); }
        else resolve({ updatedAt: "t" + puts.length });
      }, 0));
    },
    rebase: rebaseBoard,
    getBase: () => base, setBase: (b) => { base = b; },
    getStamp: () => stamp, setStamp: (s) => { stamp = s; }
  });
  q.saveNow(mk([{ id: 1, title: "A đổi tên", x: 0, y: 0 }]));        // A
  q.saveNow(mk([{ id: 1, title: "A đổi tên", x: 40, y: 0 }]));       // B: nhích thêm
  await settle(20);
  const last = puts[puts.length - 1];
  const n1 = last.nodes.find((x) => x.id === 1);
  assert.ok(last.nodes.some((x) => x.id === 5), "thẻ từ xa phải còn");
  assert.equal(n1.x, 40);
  assert.equal(n1.title, "A đổi tên");
});
