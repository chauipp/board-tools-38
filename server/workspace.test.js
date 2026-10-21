import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import { requireAuth, signSession, SESSION_COOKIE_NAME } from "./auth.js";
import { createWorkspaceRouter } from "./workspace.js";
import { WorkspaceState } from "./models.js";

const ID = "abcdefabcdefabcdefabcdef";
const OTHER = "111111111111111111111111";
const empty = { version: 1, state: {}, updatedAt: null };
const savedEnv = { ...process.env };
before(() => {
  process.env.SESSION_SECRET = "workspace-contract-test-only";
  process.env.PUBLIC_MODE = "true";
  delete process.env.ALLOWED_EMAILS;
});
after(() => {
  for (const key of ["SESSION_SECRET", "PUBLIC_MODE", "ALLOWED_EMAILS"]) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function fixture(t, { duplicate = false, failure = false, delayedRead, arrived = () => {}, storageCall = () => {} } = {}) {
  const documents = new Map();
  const board = { _id: ID, ownerEmail: "owner@example.test", members: [
    { email: "viewer@example.test", role: "viewer" },
    { email: "editor@example.test", role: "editor" }
  ], nodes: [{ id: 1 }], updatedAt: new Date(0) };
  const original = structuredClone(board);
  const key = (q) => `${q.email}|${q.boardId}|${q.profile}`;
  const WorkspaceState = {
    async findOne(q) { storageCall(); return structuredClone(documents.get(key(q)) || null); },
    async findOneAndUpdate(q, update, options) {
      storageCall();
      if (failure) throw new Error("storage unavailable");
      // Yield to allow independent HTTP requests to overlap before the atomic write.
      await new Promise((resolve) => setImmediate(resolve));
      if (duplicate && options.upsert) {
        duplicate = false;
        documents.set(key(q), { ...q, state: { outlineOpen: true }, updatedAt: new Date() });
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      }
      const doc = documents.get(key(q)) || (options.upsert ? { ...q, state: {} } : null);
      if (!doc) return null;
      assert.deepEqual(Object.keys(update), ["$set"]);
      for (const [path, value] of Object.entries(update.$set)) {
        if (path.startsWith("state.")) doc.state[path.slice(6)] = structuredClone(value);
        else if (path === "updatedAt") doc.updatedAt = value;
        else assert.fail(`unexpected update path ${path}`);
      }
      documents.set(key(q), doc);
      return structuredClone(doc);
    },
    async deleteOne(q) { storageCall(); documents.delete(key(q)); }
  };
  let reads = 0;
  const Board = { findById(id) {
    storageCall();
    return { async select() {
      if (++reads === 1 && delayedRead) {
        delayedRead.started();
        await delayedRead.wait;
      }
      return Promise.resolve([ID, OTHER].includes(String(id).toLowerCase())
      ? { ...board, _id: String(id).toLowerCase() } : null); } };
  } };
  const app = express();
  app.set("io", new Proxy({}, { get() { assert.fail("workspace must never broadcast"); } }));
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => { arrived(); next(); });
  app.use("/api/boards", requireAuth, createWorkspaceRouter({ Board, WorkspaceState }));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: "request_error" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.deepEqual(board, original, "board data and timestamp unchanged");
  });
  return async (method = "GET", body, { email = "owner@example.test", expectedUser = email?.trim().toLowerCase(), profile = "desktop", id = ID, raw } = {}) => {
    const headers = { "content-type": "application/json" };
    if (expectedUser !== null && expectedUser !== undefined) headers["X-Workspace-User"] = expectedUser;
    if (email) headers.cookie = `${SESSION_COOKIE_NAME}=${signSession({ email })}`;
    const url = `/api/boards/${id}/workspace/${profile}`;
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { result = text; }
    // Actual HTTP evidence, without cookies or session tokens.
    if (process.env.WORKSPACE_HTTP_EVIDENCE) console.log(JSON.stringify({ method, url, actor: email || "anonymous", expectedUser, request: raw ?? body, status: response.status, body: result }));
    return { status: response.status, body: result };
  };
}

test("workspace HTTP: cookie B with header A rejects every verb before storage and preserves both documents", async (t) => {
  for (const method of ["GET", "PATCH", "DELETE"]) await t.test(method, async (t) => {
    let calls = 0;
    const request = await fixture(t, { storageCall: () => { calls++; } });
    const actorA = { email: "owner@example.test" };
    const actorB = { email: "viewer@example.test" };
    assert.equal((await request("PATCH", { changes: { miniOpen: true } }, actorA)).status, 200);
    assert.equal((await request("PATCH", { changes: { miniOpen: false } }, actorB)).status, 200);
    const beforeA = await request("GET", undefined, actorA);
    const beforeB = await request("GET", undefined, actorB);
    const beforeCalls = calls;
    const result = await request(method, method === "PATCH" ? { changes: { miniOpen: true } } : undefined,
      { ...actorB, expectedUser: actorA.email });
    assert.deepEqual(result, { status: 409, body: { error: "workspace_account_changed" } });
    assert.equal(calls, beforeCalls, "account mismatch must not read or write storage");
    assert.deepEqual(await request("GET", undefined, actorA), beforeA, "A document including timestamp unchanged");
    assert.deepEqual(await request("GET", undefined, actorB), beforeB, "B document including timestamp unchanged");
  });
});

test("workspace HTTP: missing or invalid account header rejects every verb before storage; auth remains first", async (t) => {
  let calls = 0;
  const request = await fixture(t, { storageCall: () => { calls++; } });
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const body = method === "PATCH" ? { changes: { miniOpen: true } } : undefined;
    for (const expectedUser of [null, "", "bad", "owner @example.test", "owner@@example.test", "owner@example.test,viewer@example.test"]) {
      assert.deepEqual(await request(method, body, { expectedUser }),
        { status: 400, body: { error: "invalid_workspace" } });
    }
    for (const expectedUser of [null, "bad", "owner@example.test"]) {
      assert.deepEqual(await request(method, body, { email: null, expectedUser }),
        { status: 401, body: { error: "unauthorized" } });
    }
  }
  assert.equal(calls, 0, "invalid headers and anonymous requests must not access storage");
});

test("workspace HTTP: owner/viewer/editor, normalized session and isolated user/board/profile", async (t) => {
  const request = await fixture(t);
  assert.deepEqual(await request(), { status: 200, body: empty });
  for (const email of ["owner@example.test", "viewer@example.test", "editor@example.test"]) {
    const result = await request("PATCH", { changes: { miniOpen: true } }, { email });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.state, { miniOpen: true });
    assert.equal(result.body.version, 1);
    assert.equal(new Date(result.body.updatedAt).toISOString(), result.body.updatedAt);
  }
  await request("PATCH", { changes: { miniOpen: false } });
  assert.deepEqual((await request("GET", undefined, { email: "viewer@example.test" })).body.state, { miniOpen: true });
  assert.deepEqual((await request("GET", undefined, { email: " OWNER@EXAMPLE.TEST ", id: ID.toUpperCase() })).body.state, { miniOpen: false });
  assert.deepEqual((await request("GET", undefined, { profile: "mobile" })).body, empty);
  assert.deepEqual((await request("GET", undefined, { id: OTHER })).body, empty);
});

test("workspace HTTP: strangers 404, no session 401 and invalid route 400 for every verb", async (t) => {
  const request = await fixture(t);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const body = method === "PATCH" ? { changes: { miniOpen: true } } : undefined;
    for (const [options, status] of [
      [{ email: "stranger@example.test" }, 404], [{ email: null }, 401],
      [{ id: "bad" }, 400], [{ id: "000000000000000000000000" }, 404],
      [{ profile: "tablet" }, 400]
    ]) assert.equal((await request(method, body, options)).status, status);
  }
});

test("workspace HTTP: closed v1 schema accepts all variants and camera boundaries", async (t) => {
  const request = await fixture(t);
  const changes = { camera: { x: -1e8, y: 1e8, scale: 0.1 }, miniOpen: false,
    outlineOpen: true, statusOpen: false, tagOpen: true, paletteOpen: false, inspector: null };
  assert.deepEqual((await request("PATCH", { changes })).body.state, changes);
  const inspectors = [null, { type: "tree", kind: "node", id: 1 }, { type: "tree", kind: "group", id: 2 },
    { type: "design", id: 3 }, { type: "impact", id: 4 },
    ...["brief", "flow", "balance", "handoff", "decisions", "insights", "impact", "playtests", "reports", "snapshots"].map(type => ({ type }))];
  for (const inspector of inspectors) {
    const result = await request("PATCH", { changes: { inspector, camera: { x: 1e8, y: -1e8, scale: 4 } } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.state.inspector, inspector);
    assert.equal(result.body.state.outlineOpen, true);
  }
});

test("workspace HTTP: rejects malformed, unknown, prototype and nested injection without writes", async (t) => {
  const request = await fixture(t);
  const bodies = [null, [], {}, { changes: {} }, { changes: [] }, { changes: null },
    { changes: { miniOpen: true }, email: "viewer@example.test" },
    ...["miniOpen", "outlineOpen", "statusOpen", "tagOpen", "paletteOpen"].map(key => ({ changes: { [key]: 1 } })),
    ...[{ unknown: true }, { "camera.x": 1 }, { $set: {} }, { camera: null },
      { camera: { x: 0, y: 0 } }, { camera: { x: "0", y: 0, scale: 1 } },
      ...[{ x: 1e8 + 1, y: 0, scale: 1 }, { x: 0, y: -1e8 - 1, scale: 1 },
        { x: 0, y: 0, scale: 0.09 }, { x: 0, y: 0, scale: 4.01 },
        { x: 0, y: 0, scale: 1, extra: 1 }].map(camera => ({ camera })),
      ...[{}, [], { type: "nope" }, { type: "tree", kind: "edge", id: 1 },
        { type: "tree", kind: "node" }, { type: "design", id: 0 }, { type: "design", id: 1.5 },
        { type: "impact", id: -1 }, { type: "brief", id: 1 }, { type: "flow", extra: 1 },
        { type: "design", id: { $gt: 0 } }].map(inspector => ({ inspector }))
    ].map(changes => ({ changes }))];
  for (const body of bodies) assert.equal((await request("PATCH", body)).status, 400, JSON.stringify(body));
  for (const raw of ['{"changes":{"__proto__":{"polluted":true}}}',
    '{"changes":{"constructor":{}}}', '{"changes":{"inspector":{"type":"brief","__proto__":{}}}}',
    '{"changes":{"camera":{"x":1e309,"y":0,"scale":1}}}', '{bad']) {
    assert.equal((await request("PATCH", undefined, { raw })).status, 400, raw);
  }
  assert.deepEqual((await request()).body, empty);
  assert.equal({}.polluted, undefined);
});

test("workspace HTTP: atomic independent patches survive, last patch wins same field", async (t) => {
  const request = await fixture(t);
  const results = await Promise.all([
    request("PATCH", { changes: { camera: { x: 2, y: 3, scale: 1 } } }),
    request("PATCH", { changes: { miniOpen: true } })
  ]);
  for (const result of results) assert.equal(result.status, 200);
  assert.deepEqual((await request()).body.state, { camera: { x: 2, y: 3, scale: 1 }, miniOpen: true });
  await request("PATCH", { changes: { miniOpen: false } });
  assert.equal((await request()).body.state.miniOpen, false);
});

test("workspace HTTP: duplicate upsert retries without losing concurrent fields", async (t) => {
  const request = await fixture(t, { duplicate: true });
  const result = await request("PATCH", { changes: { miniOpen: true } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.state, { outlineOpen: true, miniOpen: true });
});

test("workspace HTTP: reset affects only own selected profile and is idempotent", async (t) => {
  const request = await fixture(t);
  for (const options of [{}, { profile: "mobile" }, { email: "viewer@example.test" }, { id: OTHER }]) {
    await request("PATCH", { changes: { tagOpen: true } }, options);
  }
  for (let i = 0; i < 2; i++) assert.deepEqual(await request("DELETE"), { status: 200, body: empty });
  assert.deepEqual((await request()).body, empty);
  for (const options of [{ profile: "mobile" }, { email: "viewer@example.test" }, { id: OTHER }]) {
    assert.deepEqual((await request("GET", undefined, options)).body.state, { tagOpen: true });
  }
});

test("workspace HTTP: storage failure returns 500 without leaking details", async (t) => {
  const request = await fixture(t, { failure: true });
  const result = await request("PATCH", { changes: { miniOpen: true } });
  assert.equal(result.status, 500);
  assert.doesNotMatch(JSON.stringify(result.body), /storage unavailable/);
});

test("workspace HTTP: last received patch wins even when first authorization read is delayed", async (t) => {
  let started, release, secondArrived;
  let arrivals = 0;
  const secondRequest = new Promise(resolve => { secondArrived = resolve; });
  const firstRead = new Promise(resolve => { started = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const request = await fixture(t, { delayedRead: { started, wait },
    arrived: () => { if (++arrivals === 2) secondArrived(); } });
  const first = request("PATCH", { changes: { miniOpen: false } });
  await firstRead;
  const last = request("PATCH", { changes: { miniOpen: true } });
  // Keep the first authorization pending while the second request reaches the server.
  await secondRequest;
  release();
  for (const result of await Promise.all([first, last])) assert.equal(result.status, 200);
  assert.equal((await request()).body.state.miniOpen, true);
});

test("workspace model: normalized email, ObjectId, profile and compound unique index", async () => {
  const doc = new WorkspaceState({ email: " OWNER@EXAMPLE.TEST ", boardId: ID, profile: "mobile", updatedAt: new Date() });
  await doc.validate();
  assert.equal(doc.email, "owner@example.test");
  assert.equal(doc.boardId.toHexString(), ID);
  assert.ok(WorkspaceState.schema.indexes().some(([keys, options]) => options.unique &&
    JSON.stringify(keys) === JSON.stringify({ email: 1, boardId: 1, profile: 1 })));
  for (const changes of [{ boardId: "invalid" }, { profile: "tablet" }, { email: " " }]) {
    await assert.rejects(new WorkspaceState({ email: "owner@example.test", boardId: ID,
      profile: "desktop", updatedAt: new Date(), ...changes }).validate());
  }
});
