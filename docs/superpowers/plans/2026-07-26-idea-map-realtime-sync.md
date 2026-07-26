# Idea Map Real-Time Collaborative Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Idea Map board content (drags, resizes, link drags, text edits,
selections) visible to every other viewer on the same board within a
fraction of a second, and make each viewer's camera (pan/zoom) fully
private, per `docs/superpowers/specs/2026-07-26-idea-map-realtime-sync-design.md`.

**Architecture:** Reuse the single per-board Socket.IO connection
`usePresence.js` already owns. Layer three things on top of it: (1) a
low-frequency "committed" `board:update` broadcast the server fires after
every successful save, applied on receipt with staleness/edit-preserving
merge logic; (2) a high-frequency, content-stripped "live geometry" channel
for in-progress drag/resize, driven by one `useEffect` on `board` so none
of the ~10 existing drag handlers need to change; (3) presence-shaped
ephemeral extensions (selection ids, link-draft endpoint) alongside the
existing cursor broadcast. Camera (`view`) is removed from the synced
surface entirely and moves to `localStorage`, following the existing
`dock.js` per-board-local-state pattern.

**Tech Stack:** React 18 hooks, Socket.IO 4 (already a dependency both
sides), Node's built-in `node:test` runner (existing convention — run with
`node --test` from inside `client/` or `server/`, no test script needed).

## Global Constraints

- No operational transform / CRDT anywhere — last write (by `updatedAt`
  timestamp) always wins; text sync is a full-field value broadcast per
  keystroke, not a character-level merge.
- Live geometry payloads never include `image`, `title`, `desc`, or any
  other content field — position/size only (`id, x, y, w, h`) — images are
  base64 data URLs embedded in nodes and must never be re-sent on a drag
  tick.
- Throttle constants: live geometry ~80ms, live text ~150ms. Overlay
  expiry (TTL, no explicit "gesture ended" event needed): geometry 400ms,
  text 1800ms.
- Staleness guard for the committed channel reuses the existing `updatedAt`
  timestamp already stamped on every board save — no new schema field.
- `board.view` (pan/zoom) is never sent to the server and never applied
  from an incoming `board:update` — it lives only in
  `localStorage`, keyed per board, following the exact shape of
  `client/src/lib/dock.js`'s `loadLayouts`/`saveLayouts`.
- Undo/redo stays local-only: applying a remote `board:update` must never
  call `recordHistory`.
- One socket connection per board, not two: `usePresence.js` keeps owning
  the connection and exposes it; `useLiveSync.js` reuses that same socket
  instance, it never calls `io(...)` itself.
- Follow existing file conventions: Vietnamese comments explaining *why*
  (not what), `node:test` + `node:assert/strict` test files named
  `<file>.test.js` next to the source, no new npm dependencies.

---

### Task 1: Committed sync — `board:update` broadcast + apply on receipt

**Files:**
- Modify: `game-tools/server/index.js` (`app.set("io", io)`)
- Modify: `game-tools/server/boards.js` (`GET /:id` returns `updatedAt`;
  `PUT /:id` broadcasts `board:update` after a successful save)
- Modify: `game-tools/client/src/lib/api.js` (`saveBoard` takes a
  `clientId` param and returns the server's response body)
- Create: `game-tools/client/src/lib/useLiveSync.js`
- Test: `game-tools/client/src/lib/useLiveSync.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (wire the hook, track
  `editingIdRef`/`lastUpdatedAtRef`/`socketRef`, pass `clientId` into
  `saveNow`)

**Interfaces:**
- Produces: `isStaleUpdate(localUpdatedAt, incomingUpdatedAt) -> boolean`,
  `mergeRemoteBoard(local, incoming, editingId) -> board`,
  `useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard) -> void`
  (return value grows in Tasks 2–3; this task's version returns nothing).
  `saveBoard(boardId, state, clientId) -> Promise<{ ok: true, updatedAt: string }>`.
  These exact names/signatures are consumed by Tasks 2, 3 and 5.

- [ ] **Step 1: Write the failing tests for the two pure functions**

```js
// game-tools/client/src/lib/useLiveSync.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isStaleUpdate, mergeRemoteBoard } from "./useLiveSync.js";

test("isStaleUpdate: incoming with no timestamp is always stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:00.000Z", undefined), true);
});

test("isStaleUpdate: incoming newer than local is not stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z"), false);
});

test("isStaleUpdate: incoming equal to local is stale (already applied)", () => {
  const t = "2026-01-01T00:00:00.000Z";
  assert.equal(isStaleUpdate(t, t), true);
});

test("isStaleUpdate: incoming older than local is stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:01.000Z", "2026-01-01T00:00:00.000Z"), true);
});

test("isStaleUpdate: no local timestamp yet accepts any incoming update", () => {
  assert.equal(isStaleUpdate(null, "2026-01-01T00:00:00.000Z"), false);
});

test("mergeRemoteBoard: takes incoming content but keeps local view (camera stays private)", () => {
  const local = { nodes: [], edges: [], view: { panX: 10, panY: 20, scale: 1 } };
  const incoming = { nodes: [{ id: 1, title: "a" }], edges: [], view: { panX: 999, panY: 999, scale: 9 } };
  const merged = mergeRemoteBoard(local, incoming, null);
  assert.deepEqual(merged.nodes, [{ id: 1, title: "a" }]);
  assert.deepEqual(merged.view, { panX: 10, panY: 20, scale: 1 });
});

test("mergeRemoteBoard: preserves the node currently being edited locally, takes the rest", () => {
  const local = { nodes: [{ id: 1, title: "typing…" }, { id: 2, title: "old" }], view: {} };
  const incoming = { nodes: [{ id: 1, title: "SHOULD NOT WIN" }, { id: 2, title: "new from remote" }], view: {} };
  const merged = mergeRemoteBoard(local, incoming, 1);
  assert.deepEqual(merged.nodes, [{ id: 1, title: "typing…" }, { id: 2, title: "new from remote" }]);
});

test("mergeRemoteBoard: editingId with no matching local node just takes incoming as-is", () => {
  const local = { nodes: [{ id: 2, title: "old" }], view: {} };
  const incoming = { nodes: [{ id: 2, title: "new" }], view: {} };
  const merged = mergeRemoteBoard(local, incoming, 999);
  assert.deepEqual(merged.nodes, [{ id: 2, title: "new" }]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `game-tools/client/`): `node --test src/lib/useLiveSync.test.js`
Expected: FAIL — `useLiveSync.js` does not exist yet.

- [ ] **Step 3: Create `useLiveSync.js` with the pure functions and the hook**

```js
// game-tools/client/src/lib/useLiveSync.js
import { useEffect } from "react";

// Gói board:update đến sau bản mới nhất mình đã áp dụng (mạng giao gói
// không theo thứ tự, hoặc gói lặp) bị bỏ qua thay vì đè lùi board về
// trạng thái cũ hơn. Tái dùng `updatedAt` server đã có sẵn trên mỗi lần
// lưu — không cần thêm field rev mới.
export function isStaleUpdate(localUpdatedAt, incomingUpdatedAt) {
  if (!incomingUpdatedAt) return true;
  if (!localUpdatedAt) return false;
  return new Date(incomingUpdatedAt).getTime() <= new Date(localUpdatedAt).getTime();
}

// Trộn board:update từ người khác vào board hiện tại:
// - Giữ nguyên đúng 1 thẻ đang được sửa tại chỗ (editingId) — tránh xoá
//   mất chữ đang gõ dở của chính người xem.
// - Giữ nguyên view (camera) — camera là riêng từng người, không đồng bộ.
export function mergeRemoteBoard(local, incoming, editingId) {
  const merged = { ...local, ...incoming, view: local.view };
  if (editingId != null) {
    const localNode = local.nodes.find((n) => n.id === editingId);
    if (localNode) {
      merged.nodes = merged.nodes.map((n) => (n.id === editingId ? localNode : n));
    }
  }
  return merged;
}

// Một socket cho mỗi board (usePresence.js sở hữu kết nối) — hook này chỉ
// lắng nghe thêm sự kiện trên socket có sẵn, không tự mở kết nối mới.
// boardRef/editingIdRef/lastUpdatedAtRef đọc qua ref để luôn lấy giá trị
// mới nhất trong closure của socket handler, cùng lý do các ref khác
// trong IdeaMap.jsx đã dùng (xem comment cạnh roleRef).
export function useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard) {
  useEffect(() => {
    if (!socket) return;
    function onBoardUpdate(incoming) {
      if (!boardRef.current) return;
      if (isStaleUpdate(lastUpdatedAtRef.current, incoming.updatedAt)) return;
      lastUpdatedAtRef.current = incoming.updatedAt;
      applyRemoteBoard(mergeRemoteBoard(boardRef.current, incoming, editingIdRef.current));
    }
    socket.on("board:update", onBoardUpdate);
    return () => socket.off("board:update", onBoardUpdate);
  }, [socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/lib/useLiveSync.test.js`
Expected: PASS, 7/7.

- [ ] **Step 5: Server — expose `io` to the REST router**

In `game-tools/server/index.js`, find:

```js
const server = http.createServer(app);
const io = new Server(server);
```

Replace with:

```js
const server = http.createServer(app);
const io = new Server(server);
// boards.js (router riêng, mount trước io tồn tại) cần phát board:update
// sau khi lưu REST thành công — lấy io qua app, không import vòng.
app.set("io", io);
```

- [ ] **Step 6: Server — return `updatedAt` from GET, broadcast it from PUT**

In `game-tools/server/boards.js`, find the `GET /:id` handler's response
object:

```js
    res.json({
      id: String(obj._id),
      name: obj.name,
      role,
      nodes: obj.nodes,
      edges: obj.edges,
      groups: obj.groups,
      statuses: obj.statuses,
      tags: obj.tags,
      palette: obj.palette,
      nextNodeId: obj.nextNodeId,
      nextEdgeId: obj.nextEdgeId,
      nextGroupId: obj.nextGroupId,
      nextStatusId: obj.nextStatusId,
      nextTagId: obj.nextTagId,
      nextPaletteId: obj.nextPaletteId,
      view: obj.view
    });
```

Replace with (adds `updatedAt` so a freshly-loaded client has a baseline to
compare incoming updates against):

```js
    res.json({
      id: String(obj._id),
      name: obj.name,
      role,
      nodes: obj.nodes,
      edges: obj.edges,
      groups: obj.groups,
      statuses: obj.statuses,
      tags: obj.tags,
      palette: obj.palette,
      nextNodeId: obj.nextNodeId,
      nextEdgeId: obj.nextEdgeId,
      nextGroupId: obj.nextGroupId,
      nextStatusId: obj.nextStatusId,
      nextTagId: obj.nextTagId,
      nextPaletteId: obj.nextPaletteId,
      view: obj.view,
      updatedAt: obj.updatedAt
    });
```

Then find the whole `PUT /:id` handler:

```js
router.put("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS);
    if (!found) return;
    const {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, view
    } = req.body;
    await Board.findByIdAndUpdate(req.params.id, {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId,
      view, updatedAt: new Date()
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không lưu được dữ liệu board." });
  }
});
```

Replace with:

```js
router.put("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS);
    if (!found) return;
    const {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, view,
      clientId
    } = req.body;
    const updatedAt = new Date();
    await Board.findByIdAndUpdate(req.params.id, {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId,
      view, updatedAt
    });
    // Phát cho người khác trong board ngay sau khi lưu thành công — không
    // gồm `view`: camera là riêng từng người, không đồng bộ qua kênh này.
    // clientId là socket.id của chính người lưu (nếu socket presence đã
    // kết nối) — .except() loại người gửi khỏi broadcast của chính họ.
    const io = req.app.get("io");
    const room = "board:" + req.params.id;
    const payload = {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId,
      updatedAt: updatedAt.toISOString()
    };
    if (clientId) io.in(room).except(clientId).emit("board:update", payload);
    else io.in(room).emit("board:update", payload);
    res.json({ ok: true, updatedAt: updatedAt.toISOString() });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không lưu được dữ liệu board." });
  }
});
```

- [ ] **Step 7: Client — `saveBoard` sends `clientId`, returns the response body**

In `game-tools/client/src/lib/api.js`, find:

```js
export async function saveBoard(boardId, state) {
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  checkAuthExpired(res);
  if (res.status === 403) throw apiError("READ_ONLY");
  if (!res.ok) throw apiError("BOARD_SAVE_FAILED");
  return res.json();
}
```

Replace with:

```js
export async function saveBoard(boardId, state, clientId) {
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...state, clientId })
  });
  checkAuthExpired(res);
  if (res.status === 403) throw apiError("READ_ONLY");
  if (!res.ok) throw apiError("BOARD_SAVE_FAILED");
  return res.json();
}
```

- [ ] **Step 8: Client — wire `useLiveSync` into `IdeaMap.jsx`**

Add the import near the other `lib` imports (right after the existing
`usePresence` import):

```js
import { usePresence, cursorColor } from "../lib/usePresence.js";
import { useLiveSync } from "../lib/useLiveSync.js";
```

Find:

```js
  const { user } = useAuth();
  const { boardId } = useParams();
  const [role, setRole] = useState(null);
  const [boardName, setBoardName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const { peers: presencePeers, sendCursor } = usePresence(user, boardId);

  const viewportRef = useRef(null);
  const fbDockRef = useRef(null);
  const canvasRef = useRef(null);
  const saveTimerRef = useRef(null);
  const boardRef = useRef(null);
  // Listener "paste" gắn-một-lần (deps: []) đóng gói `role` lúc mount, khi đó
  // board chưa tải xong nên role vẫn là null — phải đọc qua ref mới đúng.
  const roleRef = useRef(null);
```

Replace with:

```js
  const { user } = useAuth();
  const { boardId } = useParams();
  const [role, setRole] = useState(null);
  const [boardName, setBoardName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const { peers: presencePeers, sendCursor, socket } = usePresence(user, boardId);

  const viewportRef = useRef(null);
  const fbDockRef = useRef(null);
  const canvasRef = useRef(null);
  const saveTimerRef = useRef(null);
  const boardRef = useRef(null);
  // Listener "paste" gắn-một-lần (deps: []) đóng gói `role` lúc mount, khi đó
  // board chưa tải xong nên role vẫn là null — phải đọc qua ref mới đúng.
  const roleRef = useRef(null);
  const editingIdRef = useRef(null);
  // socket.id gửi kèm mỗi lần lưu để server loại chính mình khỏi broadcast
  // board:update; updatedAt của lần lưu/nhận gần nhất để so sánh gói đến
  // sau có mới hơn không (useLiveSync.js: isStaleUpdate).
  const socketRef = useRef(null);
  const lastUpdatedAtRef = useRef(null);
```

Find the ref-mirroring effects block:

```js
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
```

Replace with:

```js
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, setBoard);
```

Find the board-loading effect:

```js
    getBoard(boardId)
      .then((data) => {
        if (cancelled) return;
        if (initialCardParam && data.nodes.some((n) => n.id === Number(initialCardParam))) {
          pendingJumpRef.current = Number(initialCardParam);
        }
        const { id, name, role: r, ...boardData } = data;
        setRole(r);
        setBoardName(name);
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...boardData });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.code || "UNKNOWN"); });
```

Replace with:

```js
    getBoard(boardId)
      .then((data) => {
        if (cancelled) return;
        if (initialCardParam && data.nodes.some((n) => n.id === Number(initialCardParam))) {
          pendingJumpRef.current = Number(initialCardParam);
        }
        const { id, name, role: r, updatedAt, ...boardData } = data;
        setRole(r);
        setBoardName(name);
        lastUpdatedAtRef.current = updatedAt;
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...boardData });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.code || "UNKNOWN"); });
```

Find `saveNow`:

```js
  function saveNow(next) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (roleRef.current === "viewer") return;
    saveBoard(boardId, next).then(() => setSaveError(null)).catch(() => setSaveError(true));
  }
```

Replace with:

```js
  function saveNow(next) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (roleRef.current === "viewer") return;
    saveBoard(boardId, next, socketRef.current?.id)
      .then((res) => { lastUpdatedAtRef.current = res.updatedAt; setSaveError(null); })
      .catch(() => setSaveError(true));
  }
```

- [ ] **Step 9: Build the client and run the full client test suite**

Run: `npm run build` (from `game-tools/client/`)
Expected: builds cleanly, no errors.

Run: `node --test` (from `game-tools/client/`)
Expected: all tests pass (60 pre-existing + 7 new = 67).

- [ ] **Step 10: Run the server test suite**

Run: `node --test` (from `game-tools/server/`)
Expected: 11/11 pass (unchanged — this task's server changes have no pure
logic to unit test; verified manually in Step 11).

- [ ] **Step 11: Manual two-tab verification**

Start the dev server (`npm run dev` in both `game-tools/server` and
`game-tools/client`, or the project's usual dev workflow). Using the
JWT-cookie technique already established for this app (sign a token with
the local `SESSION_SECRET`, inject as the `gt_session` cookie via
Playwright — see `usePresence` manual-testing precedent), open the **same**
board in two browser contexts logged in as two different allowed emails.

- In tab A, add a card ("+ Ý tưởng"). Confirm it appears in tab B within
  about a second, **without reloading tab B**.
- In tab A, edit a card's title and save. Confirm tab B's card title
  updates live.
- Close tab A, reopen, confirm the board still shows both changes (persisted
  correctly, not just broadcast).

- [ ] **Step 12: Commit**

```bash
git add game-tools/server/index.js game-tools/server/boards.js \
  game-tools/client/src/lib/api.js game-tools/client/src/lib/useLiveSync.js \
  game-tools/client/src/lib/useLiveSync.test.js game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: broadcast board saves live to other viewers on the same board"
```

---

### Task 2: Live geometry — drag/resize preview

**Files:**
- Modify: `game-tools/server/index.js` (`live:geom` relay handler)
- Modify: `game-tools/client/src/lib/useLiveSync.js` (`projectGeometry`,
  throttled sender, TTL overlay, extended return value)
- Modify: `game-tools/client/src/lib/useLiveSync.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (consume
  `geomOverlay` when rendering nodes/groups)

**Interfaces:**
- Consumes: `useLiveSync(...)` signature from Task 1 (grows an extra
  argument is **not** needed — geometry sending is internal to the hook,
  driven by the same `boardRef`/`socket` it already receives).
- Produces: `projectGeometry(board) -> { nodes: [{id,x,y,w}], groups: [{id,x,y,w,h}] }`.
  `useLiveSync(...)` now returns `{ geomOverlay }` where `geomOverlay` is a
  `Map` keyed `"node:"+id` / `"group:"+id` → `{x,y,w,h}`. Consumed by
  Task 3 (which adds `textOverlay` to the same returned object) and by
  `IdeaMap.jsx` in this task.

- [ ] **Step 1: Write the failing test for `projectGeometry`**

Add to `game-tools/client/src/lib/useLiveSync.test.js`:

```js
import { isStaleUpdate, mergeRemoteBoard, projectGeometry } from "./useLiveSync.js";

test("projectGeometry strips content fields, keeps only position/size", () => {
  const board = {
    nodes: [{ id: 1, x: 10, y: 20, w: 210, title: "t", desc: "d", image: "data:image/png;base64,xxxx" }],
    groups: [{ id: 5, x: 0, y: 0, w: 300, h: 200, title: "frame" }]
  };
  assert.deepEqual(projectGeometry(board), {
    nodes: [{ id: 1, x: 10, y: 20, w: 210 }],
    groups: [{ id: 5, x: 0, y: 0, w: 300, h: 200 }]
  });
});

test("projectGeometry handles empty board content", () => {
  assert.deepEqual(projectGeometry({ nodes: [], groups: [] }), { nodes: [], groups: [] });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --test src/lib/useLiveSync.test.js`
Expected: FAIL — `projectGeometry` is not exported yet.

- [ ] **Step 3: Extend `useLiveSync.js` with geometry projection, a TTL overlay, and the throttled live channel**

Add near the top of `game-tools/client/src/lib/useLiveSync.js` (after the
existing `import`):

```js
import { useCallback, useEffect, useRef, useState } from "react";

const GEOM_THROTTLE_MS = 80;
const GEOM_TTL_MS = 400;
```

(Replace the existing `import { useEffect } from "react";` line with the
one above — it now needs `useCallback`, `useRef`, `useState` too.)

Add after `mergeRemoteBoard`:

```js
// Chỉ gửi vị trí/kích thước — KHÔNG BAO GIỜ gửi ảnh/tiêu đề/mô tả. Ảnh nhúng
// base64 thẳng trong node; gửi lại nguyên node mỗi ~80ms lúc đang kéo sẽ
// rất nặng nếu thẻ có ảnh lớn.
export function projectGeometry(board) {
  return {
    nodes: board.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w })),
    groups: board.groups.map((g) => ({ id: g.id, x: g.x, y: g.y, w: g.w, h: g.h }))
  };
}

// Map<key, value> tự xoá entry sau `ttlMs` không có cập nhật mới — không
// cần sự kiện "kết thúc kéo" riêng: nếu người kéo mất kết nối giữa chừng,
// overlay tự hết hạn thay vì treo vị trí cũ mãi. upsert nhận value hoặc
// updater (prev) => value, giống setState, để caller merge từng phần (vd
// live text chỉ có 1 field mỗi lần) mà không cần đọc `map` trực tiếp.
function useTtlOverlay(ttlMs) {
  const [map, setMap] = useState(new Map());
  const timersRef = useRef(new Map());

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
  }, []);

  const upsert = useCallback((key, valueOrUpdater) => {
    setMap((prev) => {
      const value = typeof valueOrUpdater === "function" ? valueOrUpdater(prev.get(key)) : valueOrUpdater;
      return new Map(prev).set(key, value);
    });
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      timersRef.current.delete(key);
      setMap((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }, ttlMs);
    timersRef.current.set(key, timer);
  }, [ttlMs]);

  return { map, upsert };
}
```

Replace the `useLiveSync` function with:

```js
export function useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard) {
  const geom = useTtlOverlay(GEOM_TTL_MS);
  const lastGeomSentRef = useRef(0);
  const geomTimerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    function onBoardUpdate(incoming) {
      if (!boardRef.current) return;
      if (isStaleUpdate(lastUpdatedAtRef.current, incoming.updatedAt)) return;
      lastUpdatedAtRef.current = incoming.updatedAt;
      applyRemoteBoard(mergeRemoteBoard(boardRef.current, incoming, editingIdRef.current));
    }
    socket.on("board:update", onBoardUpdate);
    return () => socket.off("board:update", onBoardUpdate);
  }, [socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard]);

  useEffect(() => {
    if (!socket) return;
    function onLiveGeom(payload) {
      const at = Date.now();
      for (const n of payload.nodes || []) geom.upsert("node:" + n.id, { x: n.x, y: n.y, w: n.w, at });
      for (const g of payload.groups || []) geom.upsert("group:" + g.id, { x: g.x, y: g.y, w: g.w, h: g.h, at });
    }
    socket.on("live:geom", onLiveGeom);
    return () => socket.off("live:geom", onLiveGeom);
  }, [socket, geom.upsert]);

  // Một effect DUY NHẤT theo dõi `board` — không cần sửa từng handler kéo
  // (card, khung, resize ảnh, resize khung...) vì tất cả đều đã tự cập
  // nhật `board` mỗi mousemove để vẽ cho chính người kéo thấy. Effect này
  // "ăn theo" đúng cơ chế đó, throttle riêng ở đầu gửi.
  const boardForGeom = boardRef.current;
  useEffect(() => {
    if (!socket || !boardForGeom) return;
    const projected = projectGeometry(boardForGeom);
    const elapsed = Date.now() - lastGeomSentRef.current;
    function send() {
      lastGeomSentRef.current = Date.now();
      socket.emit("live:geom", projected);
    }
    if (elapsed >= GEOM_THROTTLE_MS) {
      send();
    } else {
      if (geomTimerRef.current) clearTimeout(geomTimerRef.current);
      geomTimerRef.current = setTimeout(send, GEOM_THROTTLE_MS - elapsed);
    }
    return () => { if (geomTimerRef.current) clearTimeout(geomTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, boardForGeom]);

  return { geomOverlay: geom.map };
}
```

**Note for the implementer:** `boardForGeom` is read from `boardRef.current`
at render time (not inside the effect) specifically so the effect's
dependency array can react to board *content* changes — `IdeaMap.jsx`
already re-renders on every `setBoard` call (that's how the card visually
moves for the local dragger), so `boardRef.current` is fresh on every
render this hook participates in.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/lib/useLiveSync.test.js`
Expected: PASS, 9/9.

- [ ] **Step 5: Server — relay `live:geom`**

In `game-tools/server/index.js`, find:

```js
  socket.on("cursor:move", (payload) => {
    const { x, y } = payload || {};
    const p = peers.get(socket.id);
    if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = x;
    p.y = y;
    socket.to(room).emit("cursor:move", p);
  });
```

Add directly after it:

```js
  // Vị trí/kích thước tạm thời lúc đang kéo — không lưu DB, không giữ
  // state trên server, chỉ relay nguyên payload cho người khác trong room.
  socket.on("live:geom", (payload) => {
    socket.to(room).emit("live:geom", payload || {});
  });
```

- [ ] **Step 6: Client — render nodes/groups through the geometry overlay**

In `game-tools/client/src/pages/IdeaMap.jsx`, find:

```js
  const { peers: presencePeers, sendCursor, socket } = usePresence(user, boardId);
```

Leave as-is, but change the `useLiveSync` call (added in Task 1) to capture
the return value:

```js
  const { geomOverlay } = useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, setBoard);
```

Find the group-rendering loop:

```js
          {board.groups.map((group) => (
            <FrameBox
              key={group.id}
              group={group}
```

Replace with:

```js
          {board.groups.map((group) => {
            const live = geomOverlay.get("group:" + group.id);
            const renderGroup = live ? { ...group, x: live.x, y: live.y, w: live.w, h: live.h } : group;
            return (
            <FrameBox
              key={group.id}
              group={renderGroup}
```

...and find the closing of that `FrameBox` element:

```js
              dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
            />
          ))}
```

Replace with:

```js
              dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
            />
            );
          })}
```

Find the node-rendering loop:

```js
          {board.nodes.map((node) => (
            <IdeaCard
              key={node.id}
              node={node}
```

Replace with:

```js
          {board.nodes.map((node) => {
            const live = geomOverlay.get("node:" + node.id);
            const renderNode = live ? { ...node, x: live.x, y: live.y, ...(live.w != null ? { w: live.w } : {}) } : node;
            return (
            <IdeaCard
              key={node.id}
              node={renderNode}
```

...and find the closing of that `IdeaCard` element:

```js
              onImageResize={(e) => handleImageResizeMouseDown(e, node)}
            />
          ))}
```

Replace with:

```js
              onImageResize={(e) => handleImageResizeMouseDown(e, node)}
            />
            );
          })}
```

**Note for the implementer:** every other prop in both loops (`onMouseDown`,
`onClick`, `selected`, etc.) still reads from the original `node`/`group`
loop variable, which is correct — only position/size should reflect the
live overlay; interaction handlers must keep acting on the real board
object (e.g. `handleNodeMouseDown(e, node)`, not `renderNode`) so drag math
and IDs stay correct.

- [ ] **Step 7: Build and run tests**

Run: `npm run build` (from `game-tools/client/`) — expect clean build.
Run: `node --test` (from `game-tools/client/`) — expect all pass.
Run: `node --test` (from `game-tools/server/`) — expect 11/11 (unchanged,
the relay handler has no extractable pure logic).

- [ ] **Step 8: Manual two-tab verification**

Same two-tab setup as Task 1. In tab A, `mousedown` on a card and
`mousemove` several times **without** releasing the mouse button. Confirm
the card visibly moves in tab B before tab A's mouse button is released.
Repeat for: dragging a frame, resizing an image (drag the resize handle),
resizing a frame.

- [ ] **Step 9: Commit**

```bash
git add game-tools/server/index.js game-tools/client/src/lib/useLiveSync.js \
  game-tools/client/src/lib/useLiveSync.test.js game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: live-preview card/frame drag and resize for other viewers"
```

---

### Task 3: Live text — per-keystroke title/description sync

**Files:**
- Modify: `game-tools/server/index.js` (`live:text` relay handler)
- Modify: `game-tools/client/src/lib/useLiveSync.js` (`sendLiveText`,
  text overlay, extended return value)
- Modify: `game-tools/client/src/lib/useLiveSync.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (`IdeaCard`'s edit-form
  `onChange` handlers call `sendLiveText`; non-editing render prefers the
  text overlay)

**Interfaces:**
- Consumes: `useLiveSync(...)` from Task 2.
- Produces: `useLiveSync(...)` now returns
  `{ geomOverlay, textOverlay, sendLiveText }` where `textOverlay` is a
  `Map<nodeId (as string), { title?, desc?, at }>` and
  `sendLiveText({ nodeId, field, value })` is a stable (throttled)
  function. Consumed only by `IdeaMap.jsx` in this task.

- [ ] **Step 1: Write the failing test**

Add to `game-tools/client/src/lib/useLiveSync.test.js`. This exercises the
overlay behavior through the exported `useLiveSync` shape is hook-only
(needs React + a fake socket) — cover it with a focused test of the
throttle math instead, which is the one piece of real logic:

```js
test("projectGeometry: node without a w (no explicit width set) omits w as undefined-passthrough", () => {
  const board = { nodes: [{ id: 2, x: 1, y: 2 }], groups: [] };
  assert.deepEqual(projectGeometry(board), { nodes: [{ id: 2, x: 1, y: 2, w: undefined }], groups: [] });
});
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `node --test src/lib/useLiveSync.test.js`
Expected: FAIL only if `w` handling differs — this pins down the existing
`projectGeometry` behavior (a node with no `w` field maps to `w: undefined`,
which `JSON.stringify`/socket.io drops on the wire — documented so a
future change to this function trips the test instead of silently changing
wire behavior). If it already passes, that's fine — proceed; this step is
a regression pin, not new functionality.

- [ ] **Step 3: Extend `useLiveSync.js` with the text channel**

Add near the geometry constants:

```js
const TEXT_THROTTLE_MS = 150;
const TEXT_TTL_MS = 1800;
```

Inside `useLiveSync`, after the `geom` overlay declaration, add:

```js
  const text = useTtlOverlay(TEXT_TTL_MS);
  const lastTextSentRef = useRef(0);
  const textTimerRef = useRef(null);

  const sendLiveText = useCallback((payload) => {
    if (!socket) return;
    const elapsed = Date.now() - lastTextSentRef.current;
    function send() {
      lastTextSentRef.current = Date.now();
      socket.emit("live:text", payload);
    }
    if (elapsed >= TEXT_THROTTLE_MS) {
      send();
    } else {
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
      textTimerRef.current = setTimeout(send, TEXT_THROTTLE_MS - elapsed);
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    function onLiveText(payload) {
      const { nodeId, field, value } = payload || {};
      if (nodeId == null || !field) return;
      text.upsert(String(nodeId), (prev) => ({ ...(prev || {}), [field]: value, at: Date.now() }));
    }
    socket.on("live:text", onLiveText);
    return () => socket.off("live:text", onLiveText);
  }, [socket, text.upsert]);
```

Change the `return` statement at the bottom of `useLiveSync` to:

```js
  return { geomOverlay: geom.map, textOverlay: text.map, sendLiveText };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/lib/useLiveSync.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Server — relay `live:text`**

In `game-tools/server/index.js`, directly after the `live:geom` handler
added in Task 2, add:

```js
  // Nội dung đang gõ dở — không lưu DB, chỉ relay để người khác thấy chữ
  // chạy gần real-time; bản chính thức vẫn qua saveNodeEdit → PUT như cũ.
  socket.on("live:text", (payload) => {
    socket.to(room).emit("live:text", payload || {});
  });
```

- [ ] **Step 6: Client — send on keystroke, render the overlay**

In `game-tools/client/src/pages/IdeaMap.jsx`, update the `useLiveSync` call
(from Task 2) to capture the new fields:

```js
  const { geomOverlay, textOverlay, sendLiveText } = useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, setBoard);
```

In the node-rendering loop (modified in Task 2 Step 6), extend the
`renderNode` computation to also apply the text overlay whenever the local
viewer isn't the one editing that node:

```js
          {board.nodes.map((node) => {
            const live = geomOverlay.get("node:" + node.id);
            const liveText = editingId === node.id ? null : textOverlay.get(String(node.id));
            const renderNode = (live || liveText) ? {
              ...node,
              ...(live ? { x: live.x, y: live.y, ...(live.w != null ? { w: live.w } : {}) } : {}),
              ...(liveText ? { title: liveText.title ?? node.title, desc: liveText.desc ?? node.desc } : {})
            } : node;
            return (
            <IdeaCard
              key={node.id}
              node={renderNode}
```

Pass `sendLiveText` down to `IdeaCard` — find:

```js
              onSave={(fields) => saveNodeEdit(node.id, fields)}
              onSaveAndNext={(fields) => saveNodeEditAndNext(node.id, fields)}
```

Add right before it:

```js
              onLiveTextChange={(field, value) => sendLiveText({ nodeId: node.id, field, value })}
```

In `IdeaCard`'s function signature, find:

```js
function IdeaCard({ node, board, currentUser, editing, dimmed, linkPending, dropTarget, selected, flash, onMouseDown, onClick, onContextMenu, onConnectorMouseDown, onEdit, onDelete, onToggleFavorite, onOpenComments, onSave, onSaveAndNext, onCancel, onDropImage, onRemoveImage, onImageResize }) {
```

Replace with:

```js
function IdeaCard({ node, board, currentUser, editing, dimmed, linkPending, dropTarget, selected, flash, onMouseDown, onClick, onContextMenu, onConnectorMouseDown, onEdit, onDelete, onToggleFavorite, onOpenComments, onSave, onSaveAndNext, onCancel, onDropImage, onRemoveImage, onImageResize, onLiveTextChange }) {
```

In the `editing` branch's form, find:

```js
          <input type="text" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t`Tên ý tưởng`} onKeyDown={handleEditKeyDown} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t`Mô tả ngắn`} onKeyDown={handleEditKeyDown} />
```

Replace with:

```js
          <input type="text" autoFocus value={title} onChange={(e) => { setTitle(e.target.value); onLiveTextChange("title", e.target.value); }} placeholder={t`Tên ý tưởng`} onKeyDown={handleEditKeyDown} />
          <textarea value={desc} onChange={(e) => { setDesc(e.target.value); onLiveTextChange("desc", e.target.value); }} placeholder={t`Mô tả ngắn`} onKeyDown={handleEditKeyDown} />
```

- [ ] **Step 7: Build and run tests**

Run: `npm run build` (from `game-tools/client/`) — expect clean build.
Run: `node --test` (from `game-tools/client/`) — expect all pass.

- [ ] **Step 8: Manual two-tab verification**

In tab A, open a card for editing (✎) and type in the title. Confirm tab B
(which is **not** editing that card) shows the title updating live,
character by character, before tab A saves. Cancel the edit in tab A
without saving; confirm tab B's card reverts to the original title within
about 2 seconds (TTL expiry, not an explicit cancel signal).

- [ ] **Step 9: Commit**

```bash
git add game-tools/server/index.js game-tools/client/src/lib/useLiveSync.js \
  game-tools/client/src/lib/useLiveSync.test.js game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: stream title/description edits live to other viewers"
```

---

### Task 4: Peer presence extensions — selection highlight + link-drag preview

**Files:**
- Modify: `game-tools/server/index.js` (peer shape gains `selectedIds`,
  `edgeDraft`; `selection:update` and `edge-draft:update` relay handlers)
- Modify: `game-tools/client/src/lib/usePresence.js` (`sendSelection`,
  `sendEdgeDraft`, incoming handlers, expose `socket`)
- Modify: `game-tools/client/src/lib/usePresence.test.js`
- Modify: `game-tools/client/src/styles/idea-map.css` (`.peer-select-badge`)
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (send on
  selection/link-draft change; render badges + peer draft lines)

**Interfaces:**
- Consumes: `usePresence(user, boardId)` from Task 1 (already returns
  `socket` — this task adds fields to what it returns without breaking
  that).
- Produces: `usePresence(user, boardId) -> { peers, sendCursor, sendSelection, sendEdgeDraft, socket }`.
  Each peer in `peers` now has `selectedIds: number[]` and
  `edgeDraft: null | { fromKind, fromId, x, y }` alongside the existing
  `x, y, email, name, picture, socketId`.

- [ ] **Step 1: Write the failing tests**

Add to `game-tools/client/src/lib/usePresence.test.js`:

```js
test("excludeSelf preserves selectedIds and edgeDraft fields on remaining peers", () => {
  const list = [
    { socketId: "self-1", email: "me@x.com" },
    { socketId: "peer-2", email: "other@x.com", selectedIds: [3, 4], edgeDraft: { fromKind: "node", fromId: 3, x: 1, y: 2 } }
  ];
  assert.deepEqual(excludeSelf(list, "self-1"), [
    { socketId: "peer-2", email: "other@x.com", selectedIds: [3, 4], edgeDraft: { fromKind: "node", fromId: 3, x: 1, y: 2 } }
  ]);
});
```

(`excludeSelf` is a pure array filter that already passes objects through
unchanged — this test documents/pins that the new fields survive it
untouched, since nothing about `excludeSelf` itself needs to change.)

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `node --test src/lib/usePresence.test.js`
Expected: this specific test should already PASS (no code change needed
for `excludeSelf` itself) — if it fails, `excludeSelf`'s filter logic has
changed unexpectedly; stop and investigate before continuing. This step is
a safety pin, not new red-green work.

- [ ] **Step 3: Server — extend the peer shape and add two relay handlers**

In `game-tools/server/index.js`, find:

```js
  const peer = { socketId: socket.id, ...socket.data.user, x: 0, y: 0 };
```

Replace with:

```js
  const peer = { socketId: socket.id, ...socket.data.user, x: 0, y: 0, selectedIds: [], edgeDraft: null };
```

Find the `live:text` handler added in Task 3 and add directly after it:

```js
  // Vùng đang chọn của người này — presence nhẹ, không phải chỉnh sửa dữ
  // liệu, viewer vẫn gửi/nhận được như cursor.
  socket.on("selection:update", (payload) => {
    const ids = Array.isArray(payload) ? payload.filter((id) => Number.isFinite(id)) : [];
    const p = peers.get(socket.id);
    if (!p) return;
    p.selectedIds = ids;
    socket.to(room).emit("selection:update", { socketId: socket.id, selectedIds: ids });
  });

  // Đầu dây đang được kéo (link mới hoặc kéo lại đầu dây có sẵn) — cùng
  // bản chất với cursor: điểm bám theo chuột, không phải dữ liệu board.
  socket.on("edge-draft:update", (payload) => {
    const p = peers.get(socket.id);
    if (!p) return;
    p.edgeDraft = payload && Number.isFinite(payload.x) && Number.isFinite(payload.y) ? payload : null;
    socket.to(room).emit("edge-draft:update", { socketId: socket.id, edgeDraft: p.edgeDraft });
  });
```

- [ ] **Step 4: Client — extend `usePresence.js`**

In `game-tools/client/src/lib/usePresence.js`, find the import line:

```js
import { useEffect, useRef, useState } from "react";
```

Replace with:

```js
import { useCallback, useEffect, useRef, useState } from "react";
```

Find the `cursor:move` listener registration inside the connection effect:

```js
    socket.on("cursor:move", (peer) => {
      if (peer.socketId === socket.id) return;
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    });
```

Add directly after it:

```js
    socket.on("selection:update", ({ socketId, selectedIds }) => {
      setPeers((prev) => {
        const p = prev.get(socketId);
        if (!p) return prev;
        return new Map(prev).set(socketId, { ...p, selectedIds });
      });
    });
    socket.on("edge-draft:update", ({ socketId, edgeDraft }) => {
      setPeers((prev) => {
        const p = prev.get(socketId);
        if (!p) return prev;
        return new Map(prev).set(socketId, { ...p, edgeDraft });
      });
    });
```

Find the `sendCursor` function and the hook's `return` statement:

```js
  function sendCursor(getXY) {
    const socket = socketRef.current;
    if (!socket) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < CURSOR_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    const { x, y } = getXY();
    socket.emit("cursor:move", { x, y });
  }

  return { peers, sendCursor };
}
```

Replace with:

```js
  // useCallback (không phải hàm thường): IdeaMap.jsx sẽ dùng sendSelection
  // trong deps của một useEffect theo dõi selectedIds — nếu hàm đổi định
  // danh mỗi lần render, effect đó chạy lại mỗi render thay vì chỉ khi
  // selectedIds thực sự đổi.
  const sendCursor = useCallback((getXY) => {
    const socket = socketRef.current;
    if (!socket) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < CURSOR_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    const { x, y } = getXY();
    socket.emit("cursor:move", { x, y });
  }, []);

  const sendSelection = useCallback((ids) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("selection:update", ids);
  }, []);

  const sendEdgeDraft = useCallback((draft) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("edge-draft:update", draft);
  }, []);

  return { peers, sendCursor, sendSelection, sendEdgeDraft, socket: socketRef.current };
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test src/lib/usePresence.test.js`
Expected: PASS, all tests (6 existing + 1 new).

- [ ] **Step 6: Client — wire selection + link-draft sending, and render both overlays**

In `game-tools/client/src/pages/IdeaMap.jsx`, find:

```js
  const { peers: presencePeers, sendCursor, socket } = usePresence(user, boardId);
```

Replace with:

```js
  const { peers: presencePeers, sendCursor, sendSelection, sendEdgeDraft, socket } = usePresence(user, boardId);
```

Find the ref-mirroring effects block (as extended in Task 1):

```js
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
```

Add directly after it:

```js
  useEffect(() => { sendSelection(Array.from(selectedIds)); }, [selectedIds, sendSelection]);
  useEffect(() => {
    const draft = linkDraft
      ? { fromKind: linkDraft.fromKind || "node", fromId: linkDraft.fromId, x: linkDraft.x, y: linkDraft.y }
      : edgeDrag
      ? { fromKind: edgeDrag.fixedKind, fromId: edgeDrag.fixedId, x: edgeDrag.x, y: edgeDrag.y }
      : null;
    sendEdgeDraft(draft);
  }, [linkDraft, edgeDrag, sendEdgeDraft]);
```

Find the existing local draft-line rendering inside the `<svg
className="edge-layer">`:

```js
            {edgeDrag && (() => {
              const fixed = edgeEndpoint(edgeDrag.fixedKind, edgeDrag.fixedId, board.nodes, board.groups, frameCardSize);
              if (!fixed) return null;
              return <line className="draft" x1={fixed.x} y1={fixed.y} x2={edgeDrag.x} y2={edgeDrag.y} />;
            })()}
          </svg>
```

Replace with:

```js
            {edgeDrag && (() => {
              const fixed = edgeEndpoint(edgeDrag.fixedKind, edgeDrag.fixedId, board.nodes, board.groups, frameCardSize);
              if (!fixed) return null;
              return <line className="draft" x1={fixed.x} y1={fixed.y} x2={edgeDrag.x} y2={edgeDrag.y} />;
            })()}
            {Array.from(presencePeers.values()).map((peer) => {
              if (!peer.edgeDraft) return null;
              const from = edgeEndpoint(peer.edgeDraft.fromKind || "node", peer.edgeDraft.fromId, board.nodes, board.groups, frameCardSize);
              if (!from) return null;
              return (
                <line
                  key={"peer-draft-" + peer.socketId}
                  className="draft"
                  x1={from.x} y1={from.y} x2={peer.edgeDraft.x} y2={peer.edgeDraft.y}
                  style={{ stroke: cursorColor(peer.email) }}
                />
              );
            })}
          </svg>
```

Find the peer-cursor rendering block:

```js
          {Array.from(presencePeers.values()).map((peer) => (
            <div
              key={peer.socketId}
              className="peer-cursor"
              style={{ left: peer.x, top: peer.y, "--peer-color": cursorColor(peer.email) }}
            >
              <svg viewBox="0 0 20 20" width="16" height="16">
                <path d="M2 2 L18 9 L10 11 L8 18 Z" fill="var(--peer-color)" stroke="var(--bg)" strokeWidth="1" />
              </svg>
              <span className="peer-cursor-label" style={{ background: "var(--peer-color)" }}>{peer.name}</span>
            </div>
          ))}
```

Add directly after it:

```js
          {Array.from(presencePeers.values()).flatMap((peer) =>
            (peer.selectedIds || []).map((id) => {
              const n = board.nodes.find((x) => x.id === id);
              if (!n) return null;
              return (
                <div
                  key={peer.socketId + ":sel:" + id}
                  className="peer-select-badge"
                  style={{ left: n.x + (n.w || CARD_W) - 10, top: n.y - 10, background: cursorColor(peer.email) }}
                  title={peer.name}
                />
              );
            })
          )}
```

- [ ] **Step 7: CSS — add the selection badge style**

In `game-tools/client/src/styles/idea-map.css`, find `.peer-cursor-label`
and add directly after its rule block:

```css
.peer-select-badge {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--bg);
  pointer-events: none;
  z-index: 5;
}
```

- [ ] **Step 8: Build and run tests**

Run: `npm run build` (from `game-tools/client/`) — expect clean build.
Run: `node --test` (from `game-tools/client/`) — expect all pass.

- [ ] **Step 9: Manual two-tab verification**

In tab A, click a card to select it. Confirm a small colored dot appears
on that card in tab B, in tab A's presence color, within about a second.
In tab A, start dragging a new link from one card toward another
**without releasing**. Confirm tab B shows a colored line following tab
A's cursor before the link is dropped.

- [ ] **Step 10: Commit**

```bash
git add game-tools/server/index.js game-tools/client/src/lib/usePresence.js \
  game-tools/client/src/lib/usePresence.test.js game-tools/client/src/styles/idea-map.css \
  game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: show other viewers' selection and in-progress link drags"
```

---

### Task 5: Camera (pan/zoom) goes fully local

**Files:**
- Create: `game-tools/client/src/lib/camera.js`
- Test: `game-tools/client/src/lib/camera.test.js`
- Modify: `game-tools/client/src/lib/api.js` (`saveBoard` stops sending
  `view`)
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (seed `view` from
  `localStorage` on load; the wheel handler writes to `localStorage`
  instead of triggering a server save)

**Interfaces:**
- Consumes: `saveBoard(boardId, state, clientId)` from Task 1.
- Produces: `loadCamera(storage, boardId) -> {panX,panY,scale} | null`,
  `saveCamera(storage, boardId, view) -> void`. Not consumed by any later
  task — this is the last task in the plan.

- [ ] **Step 1: Write the failing tests**

```js
// game-tools/client/src/lib/camera.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCamera, saveCamera } from "./camera.js";

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v)
  };
}

test("saveCamera then loadCamera round-trips the view for a board", () => {
  const storage = fakeStorage();
  saveCamera(storage, "board-1", { panX: 10, panY: -5, scale: 1.5 });
  assert.deepEqual(loadCamera(storage, "board-1"), { panX: 10, panY: -5, scale: 1.5 });
});

test("loadCamera returns null when nothing saved for that board", () => {
  assert.equal(loadCamera(fakeStorage(), "board-1"), null);
});

test("loadCamera keeps cameras for different boards independent", () => {
  const storage = fakeStorage();
  saveCamera(storage, "board-1", { panX: 1, panY: 2, scale: 1 });
  saveCamera(storage, "board-2", { panX: 9, panY: 9, scale: 2 });
  assert.deepEqual(loadCamera(storage, "board-1"), { panX: 1, panY: 2, scale: 1 });
  assert.deepEqual(loadCamera(storage, "board-2"), { panX: 9, panY: 9, scale: 2 });
});

test("loadCamera returns null for malformed JSON instead of throwing", () => {
  const storage = fakeStorage();
  storage.setItem("idea-map-camera:board-1", "{not json");
  assert.equal(loadCamera(storage, "board-1"), null);
});

test("loadCamera returns null for a value missing required numeric fields", () => {
  const storage = fakeStorage();
  storage.setItem("idea-map-camera:board-1", JSON.stringify({ panX: 1 }));
  assert.equal(loadCamera(storage, "board-1"), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `game-tools/client/`): `node --test src/lib/camera.test.js`
Expected: FAIL — `camera.js` does not exist yet.

- [ ] **Step 3: Create `camera.js`**

```js
// game-tools/client/src/lib/camera.js

// Camera (pan/zoom) là riêng từng người xem — không còn đồng bộ qua server
// (xem docs/superpowers/specs/2026-07-26-idea-map-realtime-sync-design.md,
// mục E). Lưu local theo từng board, cùng cách dock.js lưu vị trí panel.
const PREFIX = "idea-map-camera:";

export function loadCamera(storage, boardId) {
  let v = null;
  try {
    v = JSON.parse(storage.getItem(PREFIX + boardId));
  } catch {
    return null;
  }
  if (typeof v?.panX !== "number" || typeof v?.panY !== "number" || typeof v?.scale !== "number") return null;
  return { panX: v.panX, panY: v.panY, scale: v.scale };
}

export function saveCamera(storage, boardId, view) {
  try {
    storage.setItem(PREFIX + boardId, JSON.stringify({ panX: view.panX, panY: view.panY, scale: view.scale }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất vị trí camera, không đáng làm sập app.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/lib/camera.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Client — `saveBoard` stops sending `view`**

In `game-tools/client/src/lib/api.js`, find (as left by Task 1):

```js
export async function saveBoard(boardId, state, clientId) {
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...state, clientId })
  });
```

Replace with:

```js
export async function saveBoard(boardId, state, clientId) {
  // Camera (pan/zoom) không còn là dữ liệu đồng bộ — xem lib/camera.js.
  const { view, ...rest } = state;
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, clientId })
  });
```

- [ ] **Step 6: Client — seed `view` from `localStorage` on load**

In `game-tools/client/src/pages/IdeaMap.jsx`, add the import near the
other `lib` imports:

```js
import { loadCamera, saveCamera } from "../lib/camera.js";
```

Find the board-loading effect (as left by Task 1):

```js
        const { id, name, role: r, updatedAt, ...boardData } = data;
        setRole(r);
        setBoardName(name);
        lastUpdatedAtRef.current = updatedAt;
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...boardData });
```

Replace with:

```js
        const { id, name, role: r, updatedAt, ...boardData } = data;
        setRole(r);
        setBoardName(name);
        lastUpdatedAtRef.current = updatedAt;
        // Camera riêng từng người: ưu tiên vị trí đã lưu local của chính
        // trình duyệt này, bỏ qua `view` server trả về (giá trị cũ, không
        // còn được ghi từ khi camera tách riêng — xem lib/camera.js).
        const camera = loadCamera(window.localStorage, boardId);
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...boardData, ...(camera ? { view: camera } : {}) });
```

- [ ] **Step 7: Client — wheel handler writes to `localStorage`, stops saving to server**

Find the wheel handler:

```js
      if (e.shiftKey) {
        const next = { ...current, view: { ...current.view, panX: current.view.panX - e.deltaX, panY: current.view.panY - e.deltaY } };
        setBoard(next);
        saveDebounced(next);
      } else {
        const factor = Math.pow(1.0015, -e.deltaY);
        const next = computeZoom(current, el.getBoundingClientRect(), e.clientX, e.clientY, factor);
        setBoard(next);
        saveDebounced(next);
      }
```

Replace with:

```js
      if (e.shiftKey) {
        const next = { ...current, view: { ...current.view, panX: current.view.panX - e.deltaX, panY: current.view.panY - e.deltaY } };
        setBoard(next);
        saveCamera(window.localStorage, boardId, next.view);
      } else {
        const factor = Math.pow(1.0015, -e.deltaY);
        const next = computeZoom(current, el.getBoundingClientRect(), e.clientX, e.clientY, factor);
        setBoard(next);
        saveCamera(window.localStorage, boardId, next.view);
      }
```

**Note for the implementer:** this is the *only* place in the file that
called `saveDebounced` purely to persist a `view`-only change (zoom/pan
never touches any other board field) — removing it here is intentional,
not an oversight, and stops a REST write firing on every mouse-wheel tick.
Every other `saveDebounced`/`saveNow` call site in the file is for actual
content changes (node drag, edits, etc.) and must NOT be touched by this
task.

- [ ] **Step 8: Build and run tests**

Run: `npm run build` (from `game-tools/client/`) — expect clean build.
Run: `node --test` (from `game-tools/client/`) — expect all pass.

- [ ] **Step 9: Manual two-tab verification**

In tab A, scroll/zoom to pan the canvas somewhere. Confirm tab B's camera
does **not** move. Reload tab A; confirm tab A's camera stays exactly where
tab A last left it (not wherever tab B's camera happens to be, and not
reset to the board's original default).

- [ ] **Step 10: Commit**

```bash
git add game-tools/client/src/lib/camera.js game-tools/client/src/lib/camera.test.js \
  game-tools/client/src/lib/api.js game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: make board camera (pan/zoom) private per viewer"
```

---

## Self-Review Notes

- **Spec coverage:** Section A (committed sync) → Task 1. Section B (live
  geometry) → Task 2. Section C (live text) → Task 3. Section D (selection)
  and the link-drag-preview decision from brainstorming → Task 4. Section E
  (camera locality) → Task 5. "Connection reuse" (one socket, not two) is
  satisfied by every task consuming the same `socket` returned from
  `usePresence` — no task calls `io(...)` a second time.
- **Type consistency check:** `useLiveSync`'s signature
  `(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard)` is
  introduced in Task 1 and never changes shape across Tasks 2–3 (only its
  return value grows) — confirmed consistent across all three tasks' code
  blocks above. `usePresence`'s return value grows from
  `{peers, sendCursor}` (pre-existing) → `{peers, sendCursor, socket}`
  (Task 1) → `{peers, sendCursor, sendSelection, sendEdgeDraft, socket}`
  (Task 4) — each task's code block reflects the shape as of that task,
  confirmed consistent.
