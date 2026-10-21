import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraToCenter, centerToCamera, normalizeWorkspace, workspaceProfile, createWorkspaceController } from "./workspace-state.js";

const memory = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const response = (state) => ({ ok: true, json: async () => ({ version: 1, state }) });
const tick = () => new Promise((r) => setTimeout(r, 0));

test("design toolbar defaults open and remembers a collapsed setting across devices", async () => {
  assert.equal(normalizeWorkspace().toolsOpen, true);
  const sent = [];
  const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    if (opts?.method) sent.push(JSON.parse(opts.body)); return response({ toolsOpen: false });
  } });
  try {
    await controller.start(); assert.equal(controller.getSnapshot().state.toolsOpen, false);
    controller.update({ toolsOpen: true }); await controller.flush();
    assert.deepEqual(sent, [{ changes: { toolsOpen: true } }]);
  } finally { controller.dispose(); }
});

test("camera restores the same board center on a smaller screen without changing zoom", () => {
  const center = cameraToCenter({ panX: -100, panY: 50, scale: 2 }, { w: 1200, h: 800 });
  assert.deepEqual(center, { x: 350, y: 175, scale: 2 });
  assert.deepEqual(centerToCamera(center, { w: 600, h: 400 }), { panX: -400, panY: -150, scale: 2 });
  assert.equal(workspaceProfile(767), "mobile"); assert.equal(workspaceProfile(768), "desktop");
});

test("invalid saved state cannot introduce unknown fields or a broken camera", () => {
  const state = normalizeWorkspace({ camera: { x: Infinity, y: 0, scale: 0 }, miniOpen: "false", inspector: { type: "tree", kind: "node", id: -1 }, nodes: [{ id: 1 }] });
  assert.equal(state.camera, null); assert.equal(state.miniOpen, true); assert.equal(state.inspector, null); assert.equal("nodes" in state, false);
});

test("hydrate keeps pending local edits while taking untouched fields from the server", async () => {
  let resolveGet; const patches = [];
  const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    if (!opts?.method) return new Promise((resolve) => { resolveGet = resolve; });
    patches.push(JSON.parse(opts.body)); return response({});
  } });
  const loading = controller.start(); controller.update({ miniOpen: false });
  resolveGet(response({ miniOpen: true, outlineOpen: true })); await loading;
  assert.equal(controller.getSnapshot().state.miniOpen, false); assert.equal(controller.getSnapshot().state.outlineOpen, true);
  await controller.flush(); assert.deepEqual(patches, [{ changes: { miniOpen: false } }]); controller.dispose();
});

test("a slow patch acknowledgement cannot erase a newer change in the same tab", async () => {
  let resolvePatch; const patches = [];
  const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    if (!opts?.method) return response({}); patches.push(JSON.parse(opts.body));
    if (patches.length === 1) return new Promise((resolve) => { resolvePatch = resolve; }); return response({});
  } });
  await controller.start(); controller.update({ miniOpen: false }); const first = controller.flush();
  controller.update({ miniOpen: true, outlineOpen: true }); resolvePatch(response({ miniOpen: false })); await first; await controller.flush();
  assert.deepEqual(patches[1], { changes: { miniOpen: true, outlineOpen: true } }); assert.equal(controller.getSnapshot().state.miniOpen, true); controller.dispose();
});

test("offline edits survive a remount and cannot leak to another user or screen profile", async () => {
  const storage = memory(); const offline = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage, delay: 60000, fetcher: async () => { throw Error("offline"); } });
  await offline.start(); offline.update({ miniOpen: false }); await offline.flush(); offline.dispose();
  const sent = []; const options = { boardId: "b", storage, delay: 60000, fetcher: async (_url, opts) => { if (opts?.method) sent.push(JSON.parse(opts.body)); return response({}); } };
  const restored = createWorkspaceController({ ...options, email: "a@example.com", profile: "desktop" }); await restored.start(); await restored.flush();
  assert.equal(restored.getSnapshot().state.miniOpen, false); assert.deepEqual(sent[0], { changes: { miniOpen: false } });
  const other = createWorkspaceController({ ...options, email: "b@example.com", profile: "desktop" }); assert.equal(other.getSnapshot().state.miniOpen, true);
  const mobile = createWorkspaceController({ ...options, email: "a@example.com", profile: "mobile" }); assert.equal(mobile.getSnapshot().state.miniOpen, true);
  restored.dispose(); other.dispose(); mobile.dispose(); await tick();
});

test("concurrent flushes waiting for hydration send only one PATCH at a time", async () => {
  let resolveGet, resolvePatch; let count = 0;
  const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    if (!opts?.method) return new Promise((resolve) => { resolveGet = resolve; });
    count++; return new Promise((resolve) => { resolvePatch = resolve; });
  } });
  const loading = controller.start(); controller.update({ miniOpen: false });
  const first = controller.flush(), second = controller.flush(); resolveGet(response({})); await loading; await tick();
  assert.equal(count, 1); resolvePatch(response({})); await Promise.all([first, second]); controller.dispose();
});

test("leaving the page drains newer pending edits after an in-flight PATCH", async () => {
  let resolvePatch; const patches = [];
  const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    if (!opts?.method) return response({}); patches.push(JSON.parse(opts.body));
    if (patches.length === 1) return new Promise((resolve) => { resolvePatch = resolve; }); return response({});
  } });
  await controller.start(); controller.update({ miniOpen: false }); const first = controller.flush();
  controller.update({ outlineOpen: true }); controller.dispose(); resolvePatch(response({})); await first; await tick();
  assert.deepEqual(patches, [{ changes: { miniOpen: false } }, { changes: { outlineOpen: true } }]);
});

test("requests bind the expected account and stop retrying when cookie identity changed", async () => {
  let calls = 0;
  const controller = createWorkspaceController({ email: "A@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    calls++; assert.equal(opts.headers["X-Workspace-User"], "a@example.com"); return { ok: false, status: 409 };
  } });
  await controller.start(); controller.update({ miniOpen: false }); await controller.flush(); await controller.flush();
  assert.equal(controller.getSnapshot().status, "account-changed"); assert.equal(calls, 1); controller.dispose();
});

test("retry hydration uses server camera unless a camera was changed offline", async () => {
  for (const edited of [false, true]) {
    let attempts = 0;
    const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
      if (!opts?.method && attempts++ === 0) throw Error("offline");
      return response({ camera: { x: 900, y: 700, scale: 2 } });
    } });
    await controller.start();
    if (edited) controller.update({ camera: { x: 100, y: 200, scale: 1 } });
    await controller.flush();
    assert.deepEqual(controller.getSnapshot().state.camera, edited ? { x: 100, y: 200, scale: 1 } : { x: 900, y: 700, scale: 2 });
    assert.equal(controller.getSnapshot().hydration, 1); controller.dispose();
  }
});

test("empty flush and StrictMode-style disposal cannot disable later synchronization", async () => {
  const sent = [];
  const controller = createWorkspaceController({ email: "a@example.com", boardId: "b", profile: "desktop", storage: memory(), delay: 60000, fetcher: async (_url, opts) => {
    if (opts?.method) sent.push(JSON.parse(opts.body)); return response({});
  } });
  await controller.start(); await controller.flush(); controller.dispose(); await controller.start();
  controller.update({ tagOpen: false }); await controller.flush();
  assert.deepEqual(sent, [{ changes: { tagOpen: false } }]); controller.dispose();
});
