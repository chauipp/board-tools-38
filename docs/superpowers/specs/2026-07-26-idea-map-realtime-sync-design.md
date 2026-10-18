# Idea Map: full real-time collaborative sync (Figma-style)

## Goal

Presence (live cursors) already exists. Extend it so board *content* — card
moves, resizes, text edits, link drags, selections — is visible to every
other viewer on the same board within a fraction of a second, without a
manual reload. Also make each viewer's own camera (pan/zoom) fully private,
since it currently rides along on the shared board document.

## Decisions (from brainstorming)

- **Live-preview during the gesture** (not just after release) for: dragging
  a card/frame, resizing an image or a frame, dragging a link endpoint.
- **Text edits (title/description) stream per keystroke**, last-write-wins.
  Explicitly **not** building operational transform / CRDT — two people
  editing the exact same field at the exact same second is rare on an idea
  board, and a dropped keystroke in that rare case is an acceptable
  trade-off against the cost of real conflict resolution.
- **Discrete one-shot actions** (add/delete card, change color/shape,
  lock/unlock, add/remove a link, etc.) sync through the existing
  save-then-broadcast path only — they're instant already, no in-progress
  state to preview.
- **Show other users' current selection** as a colored outline (their
  presence color) around the card(s) they have selected.
- **Camera (pan/zoom) becomes fully per-user**, stored locally, never
  shared. Today it's part of the saved board document, so opening a board
  can show you wherever the last person who saved happened to be scrolled —
  this goes away.
- **No cross-user undo/redo.** Undo stays local-only, exactly as today: it
  only ever reverts your own actions, not a remote user's.
- **No general conflict resolution.** The last save to reach the server
  always wins and becomes the truth everyone converges to — same model as
  today, just broadcast live instead of requiring a reload.

## Current state (established during research)

- `usePresence.js` + a per-board Socket.IO room (`"board:" + boardId`,
  joined in `server/index.js`'s `io.on("connection", ...)`) already deliver
  live cursors. No board *content* travels over the socket today.
- Every board mutation in `IdeaMap.jsx` goes through `commitAndSave(next)`
  (undo-tracked) or `saveNow(next)` (no undo entry) → `saveBoard(boardId,
  next)` → `PUT /api/boards/:id` (`server/boards.js`), which persists the
  **entire** board document (nodes, edges, groups, statuses, tags, palette,
  view, all the `next*Id` counters) and stamps `updatedAt`. There is no
  granular diffing anywhere — the whole object is always the unit of save.
- Continuous gestures (card drag, frame drag, image resize, frame resize,
  link-endpoint drag, marquee, panel drag, nudge, wheel zoom/pan — ~10
  independent `mousemove`/`mouseup` closures) all call `setBoard(prev =>
  next)` on every tick for local rendering, but only call `saveNow(latest)`
  **once, on mouseup**. Nothing is persisted or broadcastable mid-gesture
  today.
- Card title/description editing (`IdeaCard`, `editing` branch) holds
  `title`/`desc` in **local component state**, not in `board` — it only
  reaches `board` when "Lưu" commits via `saveNodeEdit`. Mid-typing state
  is invisible outside that one card today.
- Nodes embed images as base64 data URLs directly (`node.image`) — noted in
  `boards.js` as already expensive for auth checks. Any live channel that
  re-sends full node objects on every drag tick would repeatedly resend
  megabytes of image data; it must not do that.
- `board.view` (pan/zoom) is persisted and returned like any other board
  field — i.e. it's effectively a shared camera today.
- `client/src/lib/dock.js` already has the established pattern for
  per-board, client-only persisted UI state (`loadLayouts`/`saveLayouts` →
  `window.localStorage`) — the camera-locality fix reuses this pattern
  rather than inventing a new one.

## Architecture

### A. Committed sync (authoritative, low frequency)

Reuses the existing save path unchanged on the writer's side. On the
server, after `PUT /api/boards/:id` persists successfully, broadcast the
saved fields to everyone else in the board's room:

```js
req.app.get("io").in(room).except(clientId).emit("board:update", { ...savedFields, updatedAt });
```

- `app.set("io", io)` once at startup (`server/index.js`) so the REST
  router (`boards.js`, a separate file) can reach the same Socket.IO
  server.
- `clientId`: the client's own presence-socket `socket.id`, sent as a field
  in the `PUT` body. Socket.IO auto-joins every socket to a room named
  after its own id, so `.except(clientId)` excludes the sender with no
  server-side bookkeeping — the writer never receives an echo of its own
  save. If the presence socket hasn't connected yet (save fires before the
  handshake completes) `clientId` is simply omitted and the server
  broadcasts to the whole room unfiltered — the sender briefly re-applies
  its own already-current state, a harmless no-op, not worth guarding
  further. The same applies if a reconnect changes `socket.id` mid-session.
- **Staleness guard:** reuse the existing `updatedAt` timestamp (already
  stamped on every save) instead of adding a new field. Each client
  remembers the `updatedAt` of the board state it currently has; an
  incoming `board:update` older than or equal to that is dropped. Guards
  against out-of-order delivery, no schema change needed.
- **Applying an incoming update:** replace `board`'s content fields
  wholesale **except** any single node the local user is actively editing
  (`editingId`) — that one node keeps the local in-progress copy so a
  remote update can never wipe out text you're mid-typing. Does **not**
  call `recordHistory` — a remote change never enters your local undo
  stack, consistent with undo staying local-only.

### B. Live geometry (ephemeral, high frequency, position/size only)

One throttled effect, not ten separate call sites:

```js
useEffect(() => {
  sendLiveGeom(projectGeometry(board)); // internally throttled ~80ms, leading+trailing
}, [board]);
```

`projectGeometry` strips every field down to `{ id, x, y, w, h }` for nodes
and groups, plus the in-progress link-draft endpoint if one exists. This
fires on *every* board change (including discrete ones — harmless, just a
redundant small packet, absorbed by the throttle) but **never includes
`image`, `title`, `desc`, or any other heavy/content field**, which is what
keeps a 4-megabyte card cheap to drag. Because this hooks the single
`board` state instead of each of the ~10 drag/resize closures individually,
none of those closures need to change.

Server: pure relay, no persistence, same shape as the existing
`cursor:move` handler — `socket.on("live:geom", p => socket.to(room).emit("live:geom", { ...p, socketId: socket.id }))`.

Client receiving it keeps a `Map<nodeId, { x, y, w, h, at }>` overlay.
Render prefers the overlay value over `board`'s own value when present.
Entries **expire after ~400ms** of no update (TTL, checked at render time)
so a missed final packet (dropped connection mid-drag, tab closed) can
never leave a card stuck at a stale live position — it just falls back to
`board`'s own value, which section A will have brought up to date shortly
after via the committed save. No explicit "drag ended" event needed.

### C. Live text (ephemeral, per keystroke)

The two `onChange` handlers in `IdeaCard`'s `editing` branch (title input,
desc textarea) additionally call a throttled `sendLiveText({ nodeId, field,
value })` (~150ms). Server relays the same way as `live:geom`. Receiving
clients keep a `Map<"nodeId:field", { value, at }>` overlay, rendered
instead of the card's committed text, for any node **other** than one the
local viewer is themselves editing.

Same TTL approach as geometry (~1.5–2s after the last keystroke) instead of
a explicit end-of-edit event — covers the "user cancels without saving"
case for free: the overlay simply expires and the card reverts to its real
saved text shortly after, rather than needing `Cancel`/unmount to reliably
signal over the network. A brief (<2s) stale-text flicker after a cancelled
edit is an accepted minor rough edge, not worth the extra event plumbing.

### D. Selection presence

Extends the existing presence peer object (`usePresence.js`) with
`selectedIds: number[]`. A new low-frequency event, `selection:update`,
sent whenever the local `selectedIds` set changes (not continuous — there's
no dragging involved in selecting). Server stores it alongside the peer's
entry in the existing `presencePeers` map, so a newly-connecting client's
`presence:sync` also carries everyone's current selection, not just their
cursor.

Render: for each peer with a non-empty `selectedIds`, draw a colored
outline (their existing `cursorColor(email)`) around each selected
card/group — same visual language Figma uses, reusing the color system
that already exists for cursors.

### E. Camera goes fully local

`view` (pan/zoom) is removed from what the client treats as synced truth:

- Client never includes `view` in outgoing `saveBoard` calls, and never
  applies an incoming `view` from a `board:update`.
- Instead, camera position is read/written through the same
  `localStorage`-per-board pattern `dock.js` already established for panel
  layouts — on board load, seed from `localStorage` if present, else fall
  back to whatever `view` the server still happens to return (harmless
  legacy value, just a reasonable starting point for a board nobody has
  opened locally before).
- Server/schema untouched — `Board.view` keeps existing as a column, it
  just stops being written to or read from after this change. No
  migration needed.

### Connection reuse

One socket per board, not two. `usePresence.js` keeps owning the
connection (cursor + selection — "who's here"); it returns the connected
`socket` alongside its existing `{ peers, sendCursor }`. A new
`useLiveSync.js` takes that same `socket` plus `boardId`/`board`/
`editingId` and owns geometry + text + committed-update wiring ("what's
changing") — two small, single-purpose files sharing one connection,
instead of one large file or two sockets.

## Files touched

**Server**
- `server/index.js` — modify: `app.set("io", io)`; new `live:geom`,
  `live:text`, `selection:update` relay handlers alongside the existing
  `cursor:move` one; `presencePeers` entries grow a `selectedIds` field.
- `server/boards.js` — modify: `PUT /:id` broadcasts `board:update` via
  `req.app.get("io")` after a successful save, `.except(clientId)`; reads
  `clientId` from the request body (not persisted, relay-only).

**Client**
- `client/src/lib/usePresence.js` — modify: peer shape gains
  `selectedIds`; add `sendSelection(ids)`; expose the underlying `socket`.
- `client/src/lib/useLiveSync.js` — new: `sendLiveGeom`/`sendLiveText`
  (throttled), `projectGeometry(board)`, the `board:update` listener +
  staleness check, and the two `Map`-based overlays (geometry, text) with
  TTL expiry.
- `client/src/lib/api.js` — modify: `saveBoard` sends `clientId` (the
  presence socket's id) and stops sending `view`.
- `client/src/lib/dock.js` — modify (or a small sibling helper): add a
  per-board camera get/set pair following the existing
  `loadLayouts`/`saveLayouts` shape.
- `client/src/pages/IdeaMap.jsx` — modify: wire `useLiveSync`; apply
  incoming `board:update` (preserving the actively-edited node); read
  card position/size from the geometry overlay when present; stop
  persisting `view` to the server, read/write it via the new local-camera
  helper instead; render selection outlines for peers'
  `selectedIds`; the two `onChange` handlers in `IdeaCard`'s edit form call
  `sendLiveText`.

## Error handling

- Socket disconnected mid-drag: geometry/text overlays simply age out via
  their TTL (section B/C) — no special-case cleanup code needed.
- `board:update` arrives out of order or duplicated: dropped by the
  `updatedAt` staleness check, idempotent either way.
- REST save fails (network error, `403 read_only`, etc.): unchanged from
  today (`saveError` state) — no broadcast happens because the server
  broadcast only fires after a successful persist.
- A node referenced by an incoming `live:geom`/`live:text` packet no longer
  exists locally (deleted concurrently): overlay lookup by id simply finds
  nothing to render against; packet is a harmless no-op.

## Testing

- `projectGeometry` and the staleness/TTL comparison functions: pure
  functions, Node test runner, same pattern as `usePresence.test.js`'s
  `cursorColor`/`excludeSelf`.
- Server relay handlers (`live:geom`, `live:text`, `selection:update`,
  `board:update` broadcast-and-except): manual two-browser-tab
  verification, same reasoning as the original presence spec — a real
  Socket.IO round trip across two authenticated sessions isn't worth
  faithfully mocking.
- Manual verification pass: two logged-in sessions on the same board —
  drag a card and confirm the other tab sees it move before mouseup; type
  in a title and confirm live text appears elsewhere; select a card and
  confirm the other tab shows the colored outline; pan/zoom in one tab and
  confirm the other tab's camera does *not* move; reload one tab and
  confirm its camera stays where that tab last left it (not the other
  tab's last position).
