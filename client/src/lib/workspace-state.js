const FLAGS = { miniOpen: true, outlineOpen: false, statusOpen: true, tagOpen: true, paletteOpen: false };
const INSPECTORS = new Set(["brief", "flow", "balance", "handoff", "decisions", "insights", "impact", "playtests", "reports", "snapshots"]);
const finite = (n, max) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max;
export const workspaceProfile = (width) => width < 768 ? "mobile" : "desktop";

export function normalizeWorkspace(input = {}) {
  const state = { ...FLAGS, camera: null, inspector: null };
  for (const key of Object.keys(FLAGS)) if (typeof input?.[key] === "boolean") state[key] = input[key];
  const camera = input?.camera;
  if (camera && finite(camera.x, 1e8) && finite(camera.y, 1e8) && finite(camera.scale, 4) && camera.scale >= 0.1) state.camera = { x: camera.x, y: camera.y, scale: camera.scale };
  const panel = input?.inspector;
  const validId = Number.isSafeInteger(panel?.id) && panel.id > 0;
  if (panel?.type === "tree" && validId && ["node", "group"].includes(panel.kind)) state.inspector = { type: "tree", kind: panel.kind, id: panel.id };
  else if (panel?.type === "design" && validId) state.inspector = { type: "design", id: panel.id };
  else if (INSPECTORS.has(panel?.type)) state.inspector = { type: panel.type, ...(panel.type === "impact" && validId ? { id: panel.id } : {}) };
  return state;
}

export function cameraToCenter(view, size) {
  return { x: (size.w / 2 - view.panX) / view.scale, y: (size.h / 2 - view.panY) / view.scale, scale: view.scale };
}

export function centerToCamera(camera, size) {
  return { panX: size.w / 2 - camera.x * camera.scale, panY: size.h / 2 - camera.y * camera.scale, scale: camera.scale };
}

export function createWorkspaceController({ email, boardId, profile, storage, fetcher = globalThis.fetch, delay = 1000 }) {
  const key = `board-workspace:v1:${encodeURIComponent(email.toLowerCase())}:${encodeURIComponent(boardId)}:${profile}`;
  const url = `/api/boards/${encodeURIComponent(boardId)}/workspace/${profile}`;
  let cached;
  try { cached = JSON.parse(storage?.getItem(key)); } catch { cached = null; }
  let state = normalizeWorkspace(cached?.state);
  let pending = {};
  const revisions = {};
  for (const field of Object.keys(cached?.pending || {})) {
    if (Object.hasOwn(state, field) && !(field === "camera" && !state.camera)) { pending[field] = state[field]; revisions[field] = 1; }
  }
  let hydration = 0, accountChanged = false;
  let snapshot = { state, ready: false, status: "loading", hydration };
  const listeners = new Set();
  let timer, loading, sending, busy = false, loaded = false, disposed = false;
  const persist = () => { try { storage?.setItem(key, JSON.stringify({ state, pending })); } catch { /* Storage unavailable: server sync still works. */ } };
  const publish = (status = snapshot.status, ready = snapshot.ready) => {
    snapshot = { state, ready, status, hydration };
    for (const listener of listeners) listener();
  };
  const schedule = (ms = delay) => { clearTimeout(timer); if (!disposed && !accountChanged) timer = setTimeout(() => { void flush(); }, ms); };
  const headers = { "X-Workspace-User": email.toLowerCase() };
  async function start() {
    disposed = false;
    if (accountChanged) return;
    if (loading) return loading;
    if (loaded || !email) { publish(Object.keys(pending).length ? "pending" : "saved", true); return; }
    loading = (async () => {
      try {
        const res = await fetcher(url, { headers });
        if (res.status === 409) { accountChanged = true; publish("account-changed", true); return; }
        if (!res.ok) throw Error(`workspace:${res.status}`);
        const data = await res.json();
        state = normalizeWorkspace({ ...normalizeWorkspace(data.state), ...pending });
        loaded = true; hydration++; persist(); publish(Object.keys(pending).length ? "pending" : "saved", true);
        if (Object.keys(pending).length) schedule();
      } catch { publish("local", true); schedule(5000); }
      finally { loading = null; }
    })();
    return loading;
  }
  async function flush() {
    clearTimeout(timer);
    if (busy) return sending;
    if (accountChanged) return;
    busy = true;
    sending = (async () => {
      try {
        if (!loaded) { await start(); if (!loaded) return; }
        do {
          if (!Object.keys(pending).length) return;
          const changes = { ...pending }, sentRevisions = { ...revisions };
          publish("saving");
          const res = await fetcher(url, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ changes }), keepalive: true });
          if (res.status === 409) { accountChanged = true; publish("account-changed", true); return; }
          if (!res.ok) throw Error(`workspace:${res.status}`);
          for (const field of Object.keys(changes)) if (revisions[field] === sentRevisions[field]) delete pending[field];
          persist(); publish(Object.keys(pending).length ? "pending" : "saved");
        } while (disposed && Object.keys(pending).length);
      } catch { persist(); publish("local"); }
      finally { busy = false; sending = null; if (Object.keys(pending).length) schedule(snapshot.status === "local" ? 5000 : delay); }
    })();
    return sending;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    start, flush,
    update(changes) {
      const normalized = normalizeWorkspace({ ...state, ...changes });
      let changed = false;
      for (const field of Object.keys(changes)) {
        if (!Object.hasOwn(normalized, field) || (field === "camera" && !normalized.camera) || JSON.stringify(normalized[field]) === JSON.stringify(state[field])) continue;
        state = { ...state, [field]: normalized[field] }; pending[field] = normalized[field]; revisions[field] = (revisions[field] || 0) + 1; changed = true;
      }
      if (changed) { persist(); publish(accountChanged ? "account-changed" : "pending"); schedule(); }
    },
    dispose() { disposed = true; clearTimeout(timer); listeners.clear(); }
  };
}
