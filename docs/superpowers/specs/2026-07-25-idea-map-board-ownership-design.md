# Idea Map: multi-board ownership + invite collaborators

## Goal

Turn the single global Idea Map board into a Figma/Miro-style multi-board model: each user
can create boards, owns the ones they create, and invites other allowlisted people into a
board by email with a view/edit role. Presence (live cursors) becomes scoped per board
instead of global.

## Decisions (from brainstorming)

- **Model:** multi-board dashboard, not a single shared board with an owner tacked on. Users
  see a list of "my boards" (owned + invited) and can create new ones.
- **Invite mechanism:** by email, not shareable link. The inviter enters an email; that
  person sees the board in their list next time they log in (no separate "accept invite"
  step — membership by email match is enough).
- **Roles:** two tiers below owner — `editor` (can edit cards, cannot manage members or
  delete the board) and `viewer` (read-only).
- **Relationship to the site-wide allowlist:** `ALLOWED_EMAILS` (existing, unchanged) still
  gates who can log in to the site at all. Board membership is a second, independent layer
  on top — you must clear both gates. Inviting an email not on `ALLOWED_EMAILS` is rejected
  at invite time with a clear error, so no "ghost" invite is ever created for someone who
  can't log in to use it.
- **Existing data:** the current singleton `IdeaBoard` document is migrated into the first
  real `Board`, owned by `chaupt2823@gmail.com`, not discarded.
- **Calculator tool:** explicitly out of scope. Stays a global singleton, untouched.

## Current state (established during research)

- No `models/` directory — `IdeaBoard` and `Calculator` are Mongoose schemas defined inline
  in `server/index.js:55-86`, each constrained to exactly one document via
  `singleton: { type: String, default: "main", unique: true }`.
- `nodes`/`edges`/`groups`/`statuses`/`tags`/`palette` are array fields embedded directly in
  the one `IdeaBoard` document — there is no separate Idea/Card collection.
- No `User` collection exists. "User" is only ever the Google ID token payload
  (`{ email, name, picture }`), verified per-request and never persisted (`server/auth.js`).
- `requireAuth` (`server/auth.js:51-59`) checks the JWT session cookie against the global
  `ALLOWED_EMAILS` allowlist only — no per-resource authorization anywhere today.
- REST routes (`GET/PUT /api/ideas`, `GET/PUT /api/calculator`) take no board/workspace
  identifier; they always operate on the one `{ singleton: "main" }` document.
- Socket.IO (`server/index.js:310-341`) has no rooms — one process-wide `presencePeers` Map,
  every event is `socket.broadcast.emit(...)` (all connected clients, regardless of what
  they're viewing).
- Client router (`client/src/main.jsx:61-65`) has a fixed `/idea-map` route, no `:boardId`
  param. `usePresence.js` connects `io()` with no room/namespace argument.

## Architecture

### Data model

**`User`** (new collection):
```js
{
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: String,
  picture: String,
  lastLoginAt: Date,
}
```
Upserted by email on every successful `/api/auth/google` login (name/picture refreshed from
the Google token each time). This is the first place the app persists a User at all — it's
what gives `Board.ownerId` something stable to reference.

**`Board`** (replaces the `IdeaBoard` singleton):
```js
{
  name: { type: String, required: true, default: "Untitled board" },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["editor", "viewer"], required: true },
    addedAt: { type: Date, default: Date.now },
  }],
  nodes: { type: Array, default: [] },
  edges: { type: Array, default: [] },
  groups: { type: Array, default: [] },
  statuses: { type: Array, default: [] },
  tags: { type: Array, default: [] },
  palette: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}
```
No `singleton` field, no uniqueness constraint — many documents now. `members` stores email
+ role directly (not a `userId` ref) because an invitee may never have logged in yet; at
access-check time the server compares the requester's authenticated email (from their JWT)
against `ownerId`'s email or `members[].email`, so invites work regardless of login order.

**Access check helper** (`server/auth.js`, new function `getBoardRole(board, email)`):
returns `"owner"`, `"editor"`, `"viewer"`, or `null`. Used by every board route and by the
Socket.IO connection handler.

### REST API

All under `requireAuth` (unchanged site-wide gate) plus a new per-route board-access check:

- `GET /api/boards` — boards where the current user is owner or a member. Returns
  `{ id, name, role, updatedAt }[]`, no card data (list view only).
- `POST /api/boards` — body `{ name }`. Creates a board, current user becomes owner.
  Returns the new board's `id`.
- `GET /api/boards/:id` — full board payload (cards/groups/edges/etc), any role ≥ viewer.
  `404` if the board doesn't exist or the user has no role on it (never leak existence).
- `PUT /api/boards/:id` — full-document upsert of card data, same shape as today's
  `PUT /api/ideas`. Requires role `owner` or `editor`; `viewer` gets `403`.
- `DELETE /api/boards/:id` — owner only.
- `GET /api/boards/:id/members` — owner only. Returns `members[]` enriched with `name`/
  `picture` from `User` where a matching login exists (email-only for those who haven't
  logged in yet).
- `POST /api/boards/:id/members` — body `{ email, role }`. Owner only. Rejects with
  `400 { error: "not_allowed" }` if `email` isn't on the site-wide `ALLOWED_EMAILS`. Rejects
  `400 { error: "already_owner" }` if `email` matches the board's own owner.
- `PATCH /api/boards/:id/members/:email` — body `{ role }`. Owner only, changes an existing
  member's role.
- `DELETE /api/boards/:id/members/:email` — owner only, removes a member.

`GET/PUT /api/calculator` are untouched — still the singleton pattern, no board scoping.

### Socket.IO (per-board rooms)

1. Client connects with the target board id: `io({ query: { boardId } })`.
2. `io.use(...)` (extends the existing session-cookie check) additionally loads the board and
   calls `getBoardRole`; rejects the handshake (`next(new Error("forbidden"))`) if the role is
   `null`. Attaches `{ user, boardId, role }` to `socket.data`.
3. On connect, `socket.join('board:' + boardId)`. `presencePeers` becomes keyed by boardId
   (`Map<boardId, Map<socketId, peerInfo>>`) instead of one flat map.
4. `presence:sync`, `presence:join`, `presence:leave`, `cursor:move` all switch from
   `socket.broadcast.emit(...)` to `socket.to('board:' + boardId).emit(...)` — a cursor move
   on board A is never sent to anyone viewing board B.
5. `cursor:move` (and any future card-edit socket events) additionally check
   `socket.data.role !== "viewer"` server-side before relaying — a viewer's client should not
   emit edit events, but the server enforces it regardless of client behavior.

### Client

- `/idea-map` becomes a **board list** page (new `client/src/pages/BoardList.jsx`): fetches
  `GET /api/boards`, renders a card per board (name, your role, last updated), a "New board"
  button (`POST /api/boards` then navigate), click-through to `/idea-map/:boardId`.
- `/idea-map/:boardId` is the existing canvas page, modified to read `boardId` from
  `useParams()` and pass it through `api.js` calls and `usePresence(boardId)`.
- `client/src/lib/api.js` — `getIdeas`/`saveIdeas` become `getBoard(boardId)`/
  `saveBoard(boardId, data)`, hitting `/api/boards/:id`; new `listBoards()`,
  `createBoard(name)`, `deleteBoard(boardId)`, `getMembers(boardId)`, `inviteMember(boardId,
  email, role)`, `updateMemberRole(...)`, `removeMember(...)`.
- New `client/src/components/InviteModal.jsx`: opened from a header button visible only when
  `role === "owner"` (role comes back from `GET /api/boards/:id`, stored in board page state).
  Lists current members with a role dropdown + remove button, plus an email input + role
  select to add a new one. Surfaces the `not_allowed` error inline ("Email này chưa được cấp
  quyền đăng nhập vào hệ thống").
- Viewer role: canvas renders read-only — existing drag/edit handlers short-circuit when
  `role === "viewer"`; toolbar buttons that mutate state are disabled/hidden.

## Migration (existing singleton data)

One-off script (`server/scripts/migrate-to-boards.mjs`, run manually once against the real
Atlas database — not part of app startup):
1. Upsert a `User` with `email: "chaupt2823@gmail.com"` (name/picture left blank; filled in
   on their next real login).
2. Read the existing singleton `IdeaBoard` document.
3. Create a new `Board` document: `name: "Board của Châu"`, `ownerId` = that user's `_id`,
   `members: []`, copying `nodes`/`edges`/`groups`/`statuses`/`tags`/`palette` verbatim.
4. Leave the old `IdeaBoard` collection in place (do not drop it) until the migration is
   confirmed working in production — cheap safety net, cleaned up in a later pass.
5. `server/index.js` drops the `GET/PUT /api/ideas` routes and the `IdeaBoard` schema/
   `ensureSeed`/`migrateBoard` singleton logic entirely once `/api/boards/*` replaces them.

## Files touched

**Server**
- `server/index.js` — remove `IdeaBoard` schema + singleton routes/seed/migration logic; add
  `User`/`Board` schemas, `/api/boards*` routes, per-board Socket.IO room logic.
- `server/auth.js` — add `getBoardRole(board, email)` helper; extend socket auth middleware
  to check board access.
- `server/scripts/migrate-to-boards.mjs` — new, one-off migration script.

**Client**
- `client/src/main.jsx` — route change: `/idea-map` → `BoardList`, add `/idea-map/:boardId`
  → `IdeaMap`.
- `client/src/pages/BoardList.jsx` — new.
- `client/src/pages/IdeaMap.jsx` — modify: read `boardId` param, thread through to API calls
  and `usePresence`, read-only mode when `role === "viewer"`, show Invite button when owner.
- `client/src/components/InviteModal.jsx` — new.
- `client/src/lib/api.js` — replace `getIdeas`/`saveIdeas` with board-scoped equivalents; add
  board/member CRUD functions.
- `client/src/lib/usePresence.js` — accept `boardId`, pass as socket connection query param.

## Error handling

- `GET/PUT /api/boards/:id` for a board the user has no role on → `404` (not `403`) so
  board existence isn't leaked to non-members.
- `PUT /api/boards/:id` by a `viewer` → `403 { error: "read_only" }`; client shows a toast
  and does not lose the user's in-progress edit (keeps it in local state, does not clear).
- `POST /api/boards/:id/members` with an email not on `ALLOWED_EMAILS` → `400
  { error: "not_allowed" }`; `InviteModal` shows the inline message from the Decisions
  section above.
- Socket handshake rejected for board access → same as today's presence-only degradation:
  client logs a console warning, canvas still works over REST for whatever role the REST
  check independently grants (or shows read-only if the REST check also failed).
- Deleting a board the user isn't the owner of → `403`, defensive check even though the UI
  never shows the delete button to non-owners.

## Testing

- `getBoardRole` — pure function, Node built-in test runner: owner/editor/viewer/no-access
  cases.
- REST route access control — integration-style tests against the existing in-memory Mongo
  test harness pattern (`mongodb-memory-server`, as used for the OAuth/presence e2e work):
  create a board, assert owner can `PUT`, editor can `PUT`, viewer gets `403` on `PUT` but
  `200` on `GET`, a non-member gets `404`.
- Socket room isolation — two-browser-context Playwright test (extends the existing
  `test-03-live-cursor.mjs` pattern): open board A and board B in separate contexts, move the
  cursor in A, assert board B's client never receives the event.
- Migration script — run once against a throwaway copy of real data (or the in-memory Mongo
  seeded with a fixture singleton doc) and assert the resulting `Board` document matches the
  original card data exactly.
