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

// ── Review vòng 2 ───────────────────────────────────────────────────────────
// Server giả có phiên bản: PUT kèm mốc cũ → 409 kèm bản đang giữ; PUT đúng mốc
// (hoặc không mốc) → ghi đè và cấp mốc mới. Timer do test điều khiển.
// Mốc dạng thời gian ISO như server thật (updatedAt), tăng dần theo phiên bản.
const iso = (v) => new Date(Date.UTC(2026, 0, 1, 0, 0, v)).toISOString();
async function realRebaseHarness(initial) {
  const { rebaseBoardDetailed } = await import("./rebase.js");
  let serverBoard = { ...initial, updatedAt: iso(0) };
  let version = 0;
  let base = initial, stamp = iso(0);
  const puts = [], adopted = [], timers = [];
  let display = initial; // board đang hiện trên màn hình
  let hold = null;      // giữ PUT kế tiếp lại TRƯỚC khi server ghi
  let holdReply = null; // server ghi ngay, nhưng giữ PHẢN HỒI lại
  let failNext = false; // PUT kế tiếp lỗi mạng, server không ghi
  const q = createSaveQueue({
    save: async (next, s) => {
      puts.push({ next, stamp: s });
      if (hold) await hold;
      await flush();
      if (failNext) { failNext = false; throw new Error("network"); }
      if (s !== undefined && s !== serverBoard.updatedAt) {
        const e = new Error("conflict"); e.code = "CONFLICT"; e.board = serverBoard; throw e;
      }
      version += 1;
      serverBoard = { ...next, updatedAt: iso(version) };
      const reply = { updatedAt: serverBoard.updatedAt };
      if (holdReply) { const wait = holdReply; holdReply = null; await wait; }
      return reply;
    },
    rebaseDetailed: rebaseBoardDetailed,
    adopt: (m) => { adopted.push(m); display = m; },
    getBase: () => base, setBase: (b) => { base = b; },
    getStamp: () => stamp, setStamp: (s) => { stamp = s; },
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: (id) => { timers[id - 1] = null; }
  });
  return {
    q, puts, adopted, timers,
    server: () => serverBoard,
    // Người khác lưu thẳng lên server (không qua hàng đợi này).
    remoteSave: (mutate) => { version += 1; serverBoard = { ...mutate(serverBoard), updatedAt: iso(version) }; return serverBoard; },
    // Gói board:update về tới máy mình, theo đúng thứ tự của store: useLiveSync
    // dời mốc trước; đang có PUT bay thì hàng đợi giữ gói lại (deferRemote),
    // không thì rebaseQueued rồi dời nền.
    deliver: (board) => {
      stamp = board.updatedAt;
      if (q.deferRemote(board)) return null;
      const shown = q.rebaseQueued(board); base = board; display = shown || board; return shown;
    },
    display: () => display,
    holdNext: () => { let release; hold = new Promise((r) => { release = r; }); return () => { hold = null; release(); }; },
    failNext: () => { failNext = true; },
    holdNextReply: () => { let release; holdReply = new Promise((r) => { release = r; }); return () => release(); },
    fireTimers: () => { const f = timers.filter(Boolean); timers.fill(null); f.forEach((fn) => fn()); }
  };
}
const boardOf = (nodes, extra = {}) => ({
  nodes, edges: [], groups: [], drawings: [], statuses: [], tags: [], palette: [],
  nextNodeId: 1, nextEdgeId: 1, nextGroupId: 1, nextStatusId: 1, nextTagId: 1, nextPaletteId: 1, nextDrawingId: 1, ...extra
});

test("hai người cùng tạo thẻ số 1: bản chờ sửa thẻ local phải đi theo id MỚI, thẻ remote nguyên vẹn", async () => {
  const h = await realRebaseHarness(boardOf([]));
  h.remoteSave((b) => ({ ...b, nodes: [{ id: 1, title: "Remote", x: 500, y: 0 }], nextNodeId: 2 }));
  // A: mình tạo thẻ 1 tên "A" (kèm một dây tự nối để kiểm cả tham chiếu).
  h.q.saveNow(boardOf([{ id: 1, title: "A", x: 0, y: 0 }], { nextNodeId: 2 }));
  // B (xếp hàng): đổi tên thẻ local thành "B", vẫn dùng id 1.
  h.q.saveNow(boardOf([{ id: 1, title: "B", x: 0, y: 0 }], { nextNodeId: 2 }));
  await settle(30);
  const nodes = h.server().nodes;
  const remote = nodes.find((n) => n.title === "Remote");
  assert.ok(remote && remote.id === 1 && remote.x === 500, "thẻ remote phải còn nguyên: " + JSON.stringify(nodes));
  const mine = nodes.filter((n) => n.title !== "Remote");
  assert.equal(mine.length, 1, "thẻ local không được nhân đôi: " + JSON.stringify(nodes));
  assert.equal(mine[0].title, "B");
  assert.notEqual(mine[0].id, 1);
});

test("A đang gửi, B đang chờ, C đang debounce: rút B khỏi hàng đợi không được huỷ timer của C", async () => {
  for (const conflict of [false, true]) {
    const h = await realRebaseHarness(boardOf([{ id: 1, title: "n", x: 0, y: 0 }], { nextNodeId: 2 }));
    if (conflict) h.remoteSave((b) => ({ ...b, nodes: [...b.nodes, { id: 7, title: "Remote", x: 9, y: 9 }], nextNodeId: 8 }));
    const at = (x) => boardOf([{ id: 1, title: "n", x, y: 0 }], { nextNodeId: 2 });
    h.q.saveNow(at(1));            // A
    h.q.saveNow(at(2));            // B chờ
    h.q.saveDebounced(at(3), 500); // C hẹn giờ, mới nhất
    await settle(30);
    assert.equal(h.timers.filter(Boolean).length, 1, `timer của C phải còn (conflict=${conflict})`);
    h.fireTimers();
    await settle(30);
    assert.equal(h.server().nodes.find((n) => n.id === 1).x, 3, `C phải được lưu (conflict=${conflict})`);
    if (conflict) assert.ok(h.server().nodes.some((n) => n.id === 7), "và thẻ remote vẫn còn");
  }
});

test("board:update về trong lúc một cú nhích đang debounce: timer không được gửi bản cũ kèm mốc mới", async () => {
  // Đúng ca end-to-end của review: mình nhích B (hẹn giờ), người kia lưu A = 10
  // và gói board:update về TRƯỚC khi timer nổ.
  const start = boardOf([{ id: 1, title: "A", x: 0, y: 0 }, { id: 2, title: "B", x: 0, y: 0 }], { nextNodeId: 3 });
  const h = await realRebaseHarness(start);
  h.q.saveDebounced(boardOf([{ id: 1, title: "A", x: 0, y: 0 }, { id: 2, title: "B", x: 0, y: 10 }], { nextNodeId: 3 }), 500);
  const remote = h.remoteSave((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === 1 ? { ...n, x: 10 } : n)) }));
  const shown = h.deliver(remote);
  // Màn hình phải giữ cú nhích chưa lưu CỘNG thay đổi của người kia.
  assert.equal(shown.nodes.find((n) => n.id === 1).x, 10);
  assert.equal(shown.nodes.find((n) => n.id === 2).y, 10);
  h.fireTimers();
  await settle(30);
  const saved = h.server().nodes;
  assert.equal(saved.find((n) => n.id === 1).x, 10, "thay đổi của người kia không được lùi về 0");
  assert.equal(saved.find((n) => n.id === 2).y, 10, "cú nhích của mình phải được lưu");
});

test("phản hồi của một PUT cũ về SAU board:update mới hơn: không được lùi mốc và bản nền", async () => {
  const h = await realRebaseHarness(boardOf([{ id: 1, title: "n", x: 0, y: 0 }], { nextNodeId: 2 }));
  const release = h.holdNext();
  h.q.saveNow(boardOf([{ id: 1, title: "n", x: 1, y: 0 }], { nextNodeId: 2 })); // A, bị giữ
  await flush();
  // Coi như A đã vào server rồi người kia lưu tiếp; gói của họ về trước phản hồi của A.
  const newer = { ...boardOf([{ id: 1, title: "n", x: 1, y: 0 }, { id: 5, title: "R", x: 0, y: 0 }], { nextNodeId: 6 }), updatedAt: iso(9) };
  h.deliver(newer);
  release();
  await settle(30);
  // Lần lưu kế tiếp phải dùng mốc của gói mới hơn chứ không phải mốc cũ của A.
  h.q.saveNow(boardOf([{ id: 1, title: "n", x: 2, y: 0 }, { id: 5, title: "R", x: 0, y: 0 }], { nextNodeId: 6 }));
  // Đọc ngay lúc gửi (save() ghi nhận đồng bộ), trước khi có vòng thử lại nào.
  assert.equal(h.puts[h.puts.length - 1].stamp, iso(9));
});

// ── R3-1 (Codex, review vòng 3) ─────────────────────────────────────────────
// Mình tạo thẻ 1 (PUT đã vào server, phản hồi chưa về), nhích nó tới x=10 (bản
// chờ), rồi người kia lưu thêm thẻ 2 TRÊN bản đã có thẻ 1. Gói board:update của
// họ về trước phản hồi HTTP: bản chờ không được coi thẻ 1 là thẻ của người khác.
// Kỳ vọng sau cùng đúng 2 thẻ: 1@x=10 và 2@x=20, theo mọi thứ tự socket/HTTP.
test("R3-1: gói socket đã gồm PUT đang bay, về trước hay sau phản hồi HTTP, không nhân đôi thẻ", async () => {
  const card1 = (x) => ({ id: 1, title: "Mine", x, y: 0 });
  for (const order of ["socket-first", "http-first"]) {
    for (const via of ["saveNow", "debounce"]) {
      const label = `${order}/${via}`;
      const h = await realRebaseHarness(boardOf([]));
      const release = h.holdNextReply();
      h.q.saveNow(boardOf([card1(0)], { nextNodeId: 2 }));
      await settle(5);
      assert.equal(h.server().nodes.length, 1, label + ": PUT đầu phải đã vào server");
      const nudged = boardOf([card1(10)], { nextNodeId: 2 });
      if (via === "saveNow") h.q.saveNow(nudged); else h.q.saveDebounced(nudged, 500);
      const addTwo = (b) => ({ ...b, nodes: [...b.nodes, { id: 2, title: "Theirs", x: 20, y: 0 }], nextNodeId: 3 });
      if (order === "socket-first") {
        h.deliver(h.remoteSave(addTwo));
        release();
        await settle(30);
      } else {
        release();
        await settle(5);
        h.deliver(h.remoteSave(addTwo));
        await settle(30);
      }
      h.fireTimers();
      await settle(30);
      const nodes = h.server().nodes;
      assert.equal(nodes.length, 2, label + ": đúng 2 thẻ: " + JSON.stringify(nodes));
      assert.equal(nodes.find((n) => n.id === 1)?.x, 10, label + ": thẻ 1 phải ở x=10");
      assert.equal(nodes.find((n) => n.id === 2)?.x, 20, label + ": thẻ của người kia phải còn");
      assert.deepEqual(h.display().nodes.map((n) => [n.id, n.x]).sort(), [[1, 10], [2, 20]], label + ": màn hình");
    }
  }
});

test("R3-1: gói socket về lúc PUT đang bay mà PUT bị 409: vẫn ghép đủ thẻ của cả hai", async () => {
  const h = await realRebaseHarness(boardOf([]));
  const release = h.holdNext(); // giữ PUT TRƯỚC khi ghi: người kia ghi trước
  h.q.saveNow(boardOf([{ id: 1, title: "Mine", x: 0, y: 0 }], { nextNodeId: 2 }));
  h.q.saveNow(boardOf([{ id: 1, title: "Mine", x: 10, y: 0 }], { nextNodeId: 2 }));
  h.deliver(h.remoteSave((b) => ({ ...b, nodes: [{ id: 1, title: "Theirs", x: 20, y: 0 }], nextNodeId: 2 })));
  release();
  await settle(40);
  const nodes = h.server().nodes;
  assert.equal(nodes.length, 2, JSON.stringify(nodes));
  assert.ok(nodes.some((n) => n.id === 1 && n.title === "Theirs" && n.x === 20), "thẻ người kia giữ id 1");
  const mine = nodes.find((n) => n.title === "Mine");
  assert.ok(mine && mine.id !== 1 && mine.x === 10, "thẻ của mình đổi id và giữ cú nhích: " + JSON.stringify(nodes));
});

test("R3-1: gói socket về lúc PUT đang bay mà PUT lỗi mạng: bản chờ được ghép lên gói đó", async () => {
  const start = boardOf([{ id: 1, title: "A", x: 0, y: 0 }], { nextNodeId: 2 });
  const h = await realRebaseHarness(start);
  const release = h.holdNext();
  h.failNext(); // PUT đầu: lỗi mạng, server không ghi gì
  h.q.saveNow(boardOf([{ id: 1, title: "A", x: 5, y: 0 }], { nextNodeId: 2 }));
  h.q.saveNow(boardOf([{ id: 1, title: "A", x: 7, y: 0 }], { nextNodeId: 2 }));
  h.deliver(h.remoteSave((b) => ({ ...b, nodes: [...b.nodes, { id: 2, title: "R", x: 20, y: 0 }], nextNodeId: 3 })));
  release();
  await settle(40);
  const nodes = h.server().nodes;
  assert.equal(nodes.length, 2, JSON.stringify(nodes));
  assert.equal(nodes.find((n) => n.id === 1).x, 7, "cú nhích của mình phải được lưu");
  assert.ok(nodes.some((n) => n.id === 2), "thẻ người kia không được bị xoá");
});
