import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as api from "./api.js";

// fetch giả: mỗi bài đặt sẵn phản hồi kế tiếp, và ghi lại mọi lời gọi để soi
// URL / method / thân. window giả chỉ cần dispatchEvent để đếm auth:expired.
let calls;
let nextResponse;
let expiredEvents;

function respond(status, body, { badJson = false } = {}) {
  nextResponse = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (badJson) throw new SyntaxError("Unexpected token");
      return body;
    }
  };
}

beforeEach(() => {
  calls = [];
  expiredEvents = 0;
  nextResponse = null;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return nextResponse;
  };
  globalThis.window = {
    dispatchEvent: (e) => { if (e.type === "auth:expired") expiredEvents++; }
  };
});

async function rejectsWith(promise, code) {
  const err = await promise.then(
    () => assert.fail(`mong ném ${code} nhưng lại thành công`),
    (e) => e
  );
  assert.equal(err.code, code);
  assert.equal(err.message, code);
  return err;
}

// ─── request() ────────────────────────────────────────────────────────────

test("request: GET không init thì gọi fetch(path) đúng một tham số", async () => {
  respond(200, { a: 1 });
  assert.deepEqual(await api.request("/api/x"), { a: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init, undefined);
});

test("request: có body thì gửi JSON kèm Content-Type", async () => {
  respond(200, {});
  await api.request("/api/x", { method: "POST", body: { n: 1 } });
  assert.deepEqual(calls[0].init, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ n: 1 })
  });
});

test("request: 401 phát auth:expired, trừ khi authExpired: false", async () => {
  respond(401, {});
  await rejectsWith(api.request("/api/x", { errors: { default: "X" } }), "X");
  assert.equal(expiredEvents, 1);
  respond(401, {});
  await rejectsWith(api.request("/api/x", { authExpired: false, errors: { default: "X" } }), "X");
  assert.equal(expiredEvents, 1);
});

test("request: không có default thì lỗi HTTP vẫn ném REQUEST_FAILED", async () => {
  respond(500, {});
  await rejectsWith(api.request("/api/x"), "REQUEST_FAILED");
});

test("request: handler trả giá trị không phải Error thì thành kết quả", async () => {
  respond(404, {});
  assert.equal(await api.request("/api/x", { errors: { 404: () => "fallback" } }), "fallback");
});

// ─── Board ────────────────────────────────────────────────────────────────

test("listBoards: ok trả JSON; lỗi → BOARDS_LOAD_FAILED", async () => {
  respond(200, [{ id: "b1" }]);
  assert.deepEqual(await api.listBoards(), [{ id: "b1" }]);
  assert.equal(calls[0].url, "/api/boards");
  respond(500, {});
  await rejectsWith(api.listBoards(), "BOARDS_LOAD_FAILED");
});

test("createBoard: gửi name/kind/template; mã lỗi lấy từ server, rơi về BOARD_CREATE_FAILED", async () => {
  respond(200, { id: "b1" });
  await api.createBoard("Tên");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: "Tên", kind: "idea", template: "" });
  respond(400, { error: "board_limit_reached" });
  await rejectsWith(api.createBoard("x"), "board_limit_reached");
  respond(500, {});
  await rejectsWith(api.createBoard("x"), "BOARD_CREATE_FAILED");
  respond(500, null, { badJson: true });
  await rejectsWith(api.createBoard("x"), "BOARD_CREATE_FAILED");
});

test("getBoard: 404 → BOARD_NOT_FOUND, lỗi khác → BOARD_LOAD_FAILED", async () => {
  respond(200, { id: "b1" });
  assert.deepEqual(await api.getBoard("b1"), { id: "b1" });
  assert.equal(calls[0].url, "/api/boards/b1");
  respond(404, {});
  await rejectsWith(api.getBoard("b1"), "BOARD_NOT_FOUND");
  respond(500, {});
  await rejectsWith(api.getBoard("b1"), "BOARD_LOAD_FAILED");
});

test("saveBoard: bỏ view, gửi clientId/baseUpdatedAt", async () => {
  respond(200, { ok: true });
  await api.saveBoard("b1", { nodes: [], view: { zoom: 2 } }, "c1", null);
  assert.equal(calls[0].init.method, "PUT");
  // baseUpdatedAt null → undefined → JSON.stringify bỏ hẳn khoá.
  assert.deepEqual(JSON.parse(calls[0].init.body), { nodes: [], clientId: "c1" });
});

test("saveBoard: 403 → READ_ONLY, 500 → BOARD_SAVE_FAILED", async () => {
  respond(403, {});
  await rejectsWith(api.saveBoard("b1", {}, "c1"), "READ_ONLY");
  respond(500, {});
  await rejectsWith(api.saveBoard("b1", {}, "c1"), "BOARD_SAVE_FAILED");
});

test("saveBoard: 409 → CONFLICT kèm err.board; thân hỏng → err.board = null", async () => {
  respond(409, { error: "conflict", board: { nodes: [1] } });
  const err = await rejectsWith(api.saveBoard("b1", {}, "c1"), "CONFLICT");
  assert.deepEqual(err.board, { nodes: [1] });
  respond(409, null, { badJson: true });
  const err2 = await rejectsWith(api.saveBoard("b1", {}, "c1"), "CONFLICT");
  assert.equal(err2.board, null);
});

test("listBoardSnapshots: lỗi → SNAPSHOTS_LOAD_FAILED", async () => {
  respond(200, []);
  assert.deepEqual(await api.listBoardSnapshots("b1"), []);
  assert.equal(calls[0].url, "/api/boards/b1/snapshots");
  respond(500, {});
  await rejectsWith(api.listBoardSnapshots("b1"), "SNAPSHOTS_LOAD_FAILED");
});

test("createBoardSnapshot: 403 → READ_ONLY, lỗi khác → SNAPSHOT_CREATE_FAILED", async () => {
  respond(200, { id: "s1" });
  await api.createBoardSnapshot("b1", "nhãn");
  assert.deepEqual(JSON.parse(calls[0].init.body), { label: "nhãn" });
  respond(403, {});
  await rejectsWith(api.createBoardSnapshot("b1"), "READ_ONLY");
  respond(500, {});
  await rejectsWith(api.createBoardSnapshot("b1"), "SNAPSHOT_CREATE_FAILED");
});

test("restoreBoardSnapshot: POST không thân; 403/404/khác", async () => {
  respond(200, {});
  await api.restoreBoardSnapshot("b1", "s1");
  assert.equal(calls[0].url, "/api/boards/b1/snapshots/s1/restore");
  assert.deepEqual(calls[0].init, { method: "POST" });
  respond(403, {});
  await rejectsWith(api.restoreBoardSnapshot("b1", "s1"), "READ_ONLY");
  respond(404, {});
  await rejectsWith(api.restoreBoardSnapshot("b1", "s1"), "SNAPSHOT_NOT_FOUND");
  respond(500, {});
  await rejectsWith(api.restoreBoardSnapshot("b1", "s1"), "SNAPSHOT_RESTORE_FAILED");
});

test("deleteBoard: DELETE; lỗi → BOARD_DELETE_FAILED", async () => {
  respond(200, {});
  await api.deleteBoard("b1");
  assert.deepEqual(calls[0].init, { method: "DELETE" });
  respond(500, {});
  await rejectsWith(api.deleteBoard("b1"), "BOARD_DELETE_FAILED");
});

// ─── Thành viên ───────────────────────────────────────────────────────────

test("getMembers: lỗi → MEMBERS_LOAD_FAILED", async () => {
  respond(500, {});
  await rejectsWith(api.getMembers("b1"), "MEMBERS_LOAD_FAILED");
});

test("inviteMember: mã server hoặc MEMBER_INVITE_FAILED", async () => {
  respond(400, { error: "invalid_email" });
  await rejectsWith(api.inviteMember("b1", "a@b.c", "editor"), "invalid_email");
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: "a@b.c", role: "editor" });
  respond(500, {});
  await rejectsWith(api.inviteMember("b1", "a@b.c", "editor"), "MEMBER_INVITE_FAILED");
});

test("updateMemberRole: PATCH, email được encode; mã server hoặc MEMBER_UPDATE_FAILED", async () => {
  respond(200, {});
  await api.updateMemberRole("b1", "a+b@c.d", "viewer");
  assert.equal(calls[0].url, "/api/boards/b1/members/a%2Bb%40c.d");
  assert.equal(calls[0].init.method, "PATCH");
  respond(403, { error: "forbidden" });
  await rejectsWith(api.updateMemberRole("b1", "a@b.c", "viewer"), "forbidden");
  respond(500, {});
  await rejectsWith(api.updateMemberRole("b1", "a@b.c", "viewer"), "MEMBER_UPDATE_FAILED");
});

test("removeMember: DELETE; mã server hoặc MEMBER_REMOVE_FAILED", async () => {
  respond(200, {});
  await api.removeMember("b1", "a@b.c");
  assert.deepEqual(calls[0].init, { method: "DELETE" });
  respond(404, { error: "not_member" });
  await rejectsWith(api.removeMember("b1", "a@b.c"), "not_member");
  respond(500, {});
  await rejectsWith(api.removeMember("b1", "a@b.c"), "MEMBER_REMOVE_FAILED");
});

// ─── Calculator ───────────────────────────────────────────────────────────

test("getCalculator: lỗi → CALC_LOAD_FAILED", async () => {
  respond(500, {});
  await rejectsWith(api.getCalculator(), "CALC_LOAD_FAILED");
});

test("saveCalculator: chỉ gửi bốn trường; lỗi → CALC_SAVE_FAILED", async () => {
  respond(200, {});
  await api.saveCalculator({ budget: 1, nextStatId: 2, stats: [], extra: true }, 123);
  assert.deepEqual(JSON.parse(calls[0].init.body), { budget: 1, nextStatId: 2, stats: [], savedAt: 123 });
  respond(500, {});
  await rejectsWith(api.saveCalculator({}), "CALC_SAVE_FAILED");
});

// ─── PDF ──────────────────────────────────────────────────────────────────

test("getPdfUsage: credentials include; lỗi HTTP → null, không phát auth:expired", async () => {
  respond(200, { usedText: "1 MB" });
  assert.deepEqual(await api.getPdfUsage(), { usedText: "1 MB" });
  assert.deepEqual(calls[0].init, { credentials: "include" });
  respond(401, {});
  assert.equal(await api.getPdfUsage(), null);
  assert.equal(expiredEvents, 0);
});

// ─── Đăng nhập ────────────────────────────────────────────────────────────

test("getMe: trả user; 401 → null (không auth:expired); lỗi khác → AUTH_ME_FAILED", async () => {
  respond(200, { user: { name: "A" } });
  assert.deepEqual(await api.getMe(), { name: "A" });
  respond(401, {});
  assert.equal(await api.getMe(), null);
  assert.equal(expiredEvents, 0);
  respond(500, {});
  await rejectsWith(api.getMe(), "AUTH_ME_FAILED");
});

test("loginWithGoogle: 403 → NOT_ALLOWED, lỗi khác → LOGIN_FAILED", async () => {
  respond(200, { user: { name: "A" } });
  assert.deepEqual(await api.loginWithGoogle("tok"), { name: "A" });
  assert.deepEqual(JSON.parse(calls[0].init.body), { idToken: "tok" });
  respond(403, {});
  await rejectsWith(api.loginWithGoogle("tok"), "NOT_ALLOWED");
  respond(500, {});
  await rejectsWith(api.loginWithGoogle("tok"), "LOGIN_FAILED");
});

test("loginWithPassword: 400/401 → INVALID_CREDENTIALS, 429 → TOO_MANY_ATTEMPTS, khác → LOGIN_FAILED", async () => {
  respond(200, { user: { name: "A" } });
  assert.deepEqual(await api.loginWithPassword("u", "p"), { name: "A" });
  respond(400, {});
  await rejectsWith(api.loginWithPassword("u", "p"), "INVALID_CREDENTIALS");
  respond(401, {});
  await rejectsWith(api.loginWithPassword("u", "p"), "INVALID_CREDENTIALS");
  assert.equal(expiredEvents, 0);
  respond(429, {});
  await rejectsWith(api.loginWithPassword("u", "p"), "TOO_MANY_ATTEMPTS");
  respond(500, {});
  await rejectsWith(api.loginWithPassword("u", "p"), "LOGIN_FAILED");
});

test("logout: POST, không ném khi server trả lỗi", async () => {
  respond(500, {});
  await api.logout();
  assert.equal(calls[0].url, "/api/auth/logout");
  assert.deepEqual(calls[0].init, { method: "POST" });
});

test("401 ở API board phát auth:expired trước khi ném mã lỗi", async () => {
  respond(401, {});
  await rejectsWith(api.getBoard("b1"), "BOARD_LOAD_FAILED");
  assert.equal(expiredEvents, 1);
});
