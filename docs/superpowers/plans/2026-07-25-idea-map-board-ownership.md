# Idea Map: multi-board ownership + invite collaborators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single global Idea Map board with a Figma/Miro-style multi-board model — users create boards, own the ones they create, and invite other allowlisted people by email with an `editor`/`viewer` role. Presence (live cursors) becomes scoped per board.

**Architecture:** New `User` and `Board` Mongoose collections replace the `IdeaBoard` singleton. Access control is a plain helper function (`getBoardRole`) comparing the requester's authenticated email against `Board.ownerEmail` / `Board.members[].email` — no populate/joins. REST routes move from `/api/ideas` to `/api/boards/:id` (+ `/members` sub-routes); Socket.IO switches from one global broadcast room to one room per board.

**Tech Stack:** Same as the existing app — Express, Mongoose, Socket.IO, React 18 + react-router-dom v6, `@lingui` for i18n. No new runtime dependencies.

## Global Constraints

- **Site-wide login gate unchanged:** `ALLOWED_EMAILS` still gates who can log in at all (`server/auth.js:isEmailAllowed`). Board membership is a second, independent layer on top of it — inviting an email not on `ALLOWED_EMAILS` is rejected at invite time (`400 { error: "not_allowed" }`).
- **Invite by email, not link:** membership is stored as `{ email, role }`, matched against the requester's JWT email at request time — no separate "accept invite" step, works even if the invitee has never logged in yet.
- **Two non-owner roles:** `editor` (edit cards, no member/board management) and `viewer` (read-only). Owner has full control including delete-board and member management.
- **Non-members get `404`, not `403`,** on `GET/PUT/DELETE /api/boards/:id` — board existence is never leaked to non-members. Viewers get `403 { error: "read_only" }` specifically on write attempts.
- **`Board.ownerEmail` is a plain lowercased string, not an `ObjectId` ref to `User`.** This is a deliberate simplification vs. the original design doc (which specified `ownerId: ObjectId ref User`): every other identity check in this app (`ALLOWED_EMAILS`, `members[].email`, JWT payload) is already email-based, so an `ObjectId` ref would be the only join in the entire app for no behavioral benefit (emails don't change; there's no in-app rename-email flow). `User` still exists as its own collection — it's just not what `Board` points to.
- **Calculator tool is untouched** — stays a global singleton, out of scope for this plan.
- **No new npm dependencies** in `server/package.json` or `client/package.json`. `mongodb-memory-server` is used only as an ad hoc, `--no-save` local testing tool for manual verification steps in this plan — never committed as a project dependency.
- **Client and server deploy together** (one Render web service per `render.yaml`, confirmed in the design doc's research) — no API versioning or backward-compat shims needed; old and new routes never need to coexist in production.
- **Testing approach deviates from the design doc's "integration-style tests against an in-memory Mongo harness" wording:** this codebase's existing test suite (`server/auth.test.js`, `client/src/lib/*.test.js`) only covers pure functions with `node --test`, with zero committed DB/route-level automated tests — everything DB-dependent (the original OAuth/presence work included) was verified manually instead. This plan follows that established precedent: `getBoardRole` gets real `node --test` unit tests (Task 1, pure function), while every DB- and route-touching task gets a documented manual `curl`/script verification recipe using an ad hoc, `--no-save` `mongodb-memory-server` instance instead of new committed integration-test infrastructure.

---

### Task 1: `User`/`Board` data models + `getBoardRole` access-check helper

**Files:**
- Create: `game-tools/server/models.js`
- Modify: `game-tools/server/auth.js` (add `getBoardRole`)
- Modify: `game-tools/server/index.js:1-17` (import `upsertUser`), `game-tools/server/index.js:202-226` (call it in the login route)
- Test: `game-tools/server/auth.test.js` (extend with `getBoardRole` cases)

**Interfaces:**
- Produces: `User` (Mongoose model), `Board` (Mongoose model), `async function upsertUser({ email, name, picture })` → resolves to the upserted `User` document, all exported from `server/models.js`.
- Produces: `function getBoardRole(board, email)` → `"owner" | "editor" | "viewer" | null`, exported from `server/auth.js`. `board` is any object with `ownerEmail` (string) and `members` (array of `{ email, role }}`) — works with both a Mongoose document and a plain object.
- Consumes (Task 2+): later tasks import `Board`/`User`/`upsertUser` from `server/models.js` and `getBoardRole` from `server/auth.js`.

- [ ] **Step 1: Write `server/models.js`**

```js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    picture: String,
    lastLoginAt: { type: Date, default: Date.now }
  },
  { minimize: false, versionKey: false }
);

export const User = mongoose.model("User", userSchema);

export async function upsertUser({ email, name, picture }) {
  const normalized = String(email).toLowerCase();
  return User.findOneAndUpdate(
    { email: normalized },
    { email: normalized, name, picture, lastLoginAt: new Date() },
    { upsert: true, new: true }
  );
}

const boardMemberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["editor", "viewer"], required: true },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: "Untitled board" },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    members: { type: [boardMemberSchema], default: [] },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    groups: { type: Array, default: [] },
    statuses: { type: Array, default: [] },
    tags: { type: Array, default: [] },
    palette: { type: Array, default: [] },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    nextGroupId: { type: Number, default: 1 },
    nextStatusId: { type: Number, default: 1 },
    nextTagId: { type: Number, default: 1 },
    nextPaletteId: { type: Number, default: 1 },
    view: { type: Object, default: () => ({ panX: 0, panY: 0, scale: 1 }) },
    updatedAt: { type: Date, default: Date.now }
  },
  { minimize: false, versionKey: false }
);

export const Board = mongoose.model("Board", boardSchema);
```

- [ ] **Step 2: Add `getBoardRole` to `server/auth.js`**

Append to `game-tools/server/auth.js` (after `isEmailAllowed`, before `signSession`):

```js
export function getBoardRole(board, email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized) return null;
  if (String(board.ownerEmail || "").toLowerCase() === normalized) return "owner";
  const member = (board.members || []).find(
    (m) => String(m.email || "").toLowerCase() === normalized
  );
  return member ? member.role : null;
}
```

- [ ] **Step 3: Write the failing tests for `getBoardRole`**

Append to `game-tools/server/auth.test.js` (add `getBoardRole` to the existing import list at the top):

```js
test("getBoardRole: owner email returns 'owner', case-insensitively", () => {
  const board = { ownerEmail: "owner@x.com", members: [] };
  assert.equal(getBoardRole(board, "owner@x.com"), "owner");
  assert.equal(getBoardRole(board, "OWNER@X.COM"), "owner");
});

test("getBoardRole: member email returns their stored role", () => {
  const board = {
    ownerEmail: "owner@x.com",
    members: [{ email: "ed@x.com", role: "editor" }, { email: "vw@x.com", role: "viewer" }]
  };
  assert.equal(getBoardRole(board, "ed@x.com"), "editor");
  assert.equal(getBoardRole(board, "vw@x.com"), "viewer");
});

test("getBoardRole: unrelated email returns null", () => {
  const board = { ownerEmail: "owner@x.com", members: [] };
  assert.equal(getBoardRole(board, "stranger@x.com"), null);
});

test("getBoardRole: empty or missing email returns null", () => {
  const board = { ownerEmail: "owner@x.com", members: [] };
  assert.equal(getBoardRole(board, ""), null);
  assert.equal(getBoardRole(board, undefined), null);
});
```

- [ ] **Step 4: Run the tests to verify they fail first, then pass**

Run: `node --test game-tools/server/auth.test.js`
Expected (before Step 2 is saved): `ReferenceError: getBoardRole is not defined` or an import error.
After Step 2 is saved: all tests, including the 4 new ones, pass.

- [ ] **Step 5: Wire `upsertUser` into the Google login route**

In `game-tools/server/index.js`, add `upsertUser` to the import list (near the top, alongside the existing `auth.js` import), then modify the `POST /api/auth/google` handler:

```js
import { User, Board, upsertUser } from "./models.js";
```

```js
app.post("/api/auth/google", async (req, res) => {
  let googleUser;
  try {
    googleUser = await verifyGoogleIdToken(req.body.idToken);
  } catch (e) {
    return res.status(401).json({ error: "invalid_token" });
  }
  if (!isEmailAllowed(googleUser.email)) {
    return res.status(403).json({ error: "not_allowed" });
  }
  try {
    await upsertUser(googleUser);
  } catch (e) {
    console.error("Không lưu được thông tin user:", e);
  }
  let token;
  try {
    token = signSession(googleUser);
  } catch (e) {
    console.error("signSession thất bại:", e);
    return res.status(500).json({ error: "session_error" });
  }
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_MS
  });
  res.json({ user: googleUser });
});
```

(Only the `upsertUser` try/catch block is new — the rest of the handler is unchanged, shown for placement context.)

- [ ] **Step 6: Manual verification of the data layer (throwaway script, do not commit)**

This installs a disposable test-only MongoDB into `node_modules` for local verification. `--no-save` keeps `package.json`/`package-lock.json` untouched — `git status` should show no changes to either after this step.

```bash
cd game-tools/server
npm i mongodb-memory-server --no-save
```

Create `game-tools/server/scripts/_verify-task1.mjs` (temporary — delete after running):

```js
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import { User, Board, upsertUser } from "../models.js";

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri());

await upsertUser({ email: "Alice@Gmail.com", name: "Alice", picture: "http://x/a.png" });
const updated = await upsertUser({ email: "alice@gmail.com", name: "Alice Nguyen", picture: "http://x/b.png" });
assert.equal(await User.countDocuments(), 1, "upsert must not create a duplicate for a different-case email");
assert.equal(updated.name, "Alice Nguyen");
assert.equal(updated.email, "alice@gmail.com");

const board = await Board.create({ ownerEmail: "Owner@X.com", members: [{ email: "ed@x.com", role: "editor" }] });
assert.equal(board.ownerEmail, "owner@x.com", "schema lowercase:true must normalize on write");
assert.equal(board.members[0].role, "editor");

console.log("PASS: User upsert is idempotent by lowercased email; Board stores members correctly");
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
```

Run: `node game-tools/server/scripts/_verify-task1.mjs`
Expected: `PASS: User upsert is idempotent by lowercased email; Board stores members correctly`, then delete `_verify-task1.mjs`.

- [ ] **Step 7: Commit**

```bash
git add game-tools/server/models.js game-tools/server/auth.js game-tools/server/auth.test.js game-tools/server/index.js
git commit -m "feat: add User/Board models and getBoardRole access-check helper"
```

---

### Task 2: Board CRUD REST routes

**Files:**
- Create: `game-tools/server/boards.js`
- Modify: `game-tools/server/index.js` (remove `IdeaBoard` schema + `/api/ideas` routes + related legacy helpers; mount the new router)

**Interfaces:**
- Consumes: `Board`, `User` from `server/models.js` (Task 1); `getBoardRole`, `isEmailAllowed` from `server/auth.js` (Task 1 + existing).
- Produces: default-exported Express `Router` from `server/boards.js`, mounted at `/api/boards` in `index.js`. Routes: `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`. Member routes (`/:id/members*`) are added in Task 3, in the same file.
- Produces: `loadBoardWithRole(req, res, minRole)` (not exported — module-private helper used by both this task's and Task 3's routes in the same file).

- [ ] **Step 1: Write `server/boards.js` with the board CRUD routes**

```js
import { Router } from "express";
import { Board, User } from "./models.js";
import { getBoardRole, isEmailAllowed } from "./auth.js";

const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];

const router = Router();

// Trả 404 (không phải 403) khi người gọi không có role nào trên board —
// tránh lộ việc board có tồn tại hay không cho người ngoài.
async function loadBoardWithRole(req, res, minRole) {
  const board = await Board.findById(req.params.id);
  if (!board) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  const role = getBoardRole(board, req.user.email);
  if (!role) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  if (minRole === "editor" && role === "viewer") {
    res.status(403).json({ error: "read_only" });
    return null;
  }
  if (minRole === "owner" && role !== "owner") {
    res.status(403).json({ error: "owner_only" });
    return null;
  }
  return { board, role };
}

router.get("/", async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    const boards = await Board.find({
      $or: [{ ownerEmail: email }, { "members.email": email }]
    })
      .select("name ownerEmail members updatedAt")
      .lean();
    res.json(
      boards.map((b) => ({
        id: String(b._id),
        name: b.name,
        role: getBoardRole(b, email),
        updatedAt: b.updatedAt
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Không đọc được danh sách board." });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim() || "Untitled board";
    const board = await Board.create({
      name,
      ownerEmail: req.user.email.toLowerCase(),
      members: [],
      statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
      nextStatusId: 6
    });
    res.status(201).json({ id: String(board._id) });
  } catch (e) {
    res.status(500).json({ error: "Không tạo được board." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "viewer");
    if (!found) return;
    const { board, role } = found;
    const obj = board.toObject();
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
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đọc được dữ liệu board." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor");
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

router.delete("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner");
    if (!found) return;
    await Board.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không xoá được board." });
  }
});

export default router;
```

- [ ] **Step 2: Remove the `IdeaBoard` singleton and `/api/ideas` routes from `server/index.js`, mount the new router**

In `game-tools/server/index.js`:
- Delete the `ideaBoardSchema` definition and `const IdeaBoard = mongoose.model("IdeaBoard", ...)` (was `index.js:55-73, 85`).
- Delete `DEFAULT_STATUSES`, `STATUS_KEY_TO_ID`, `defaultIdeas`, `DOT_COUNT`, `hashTagToken`, `migrateBoard` (was `index.js:88-180`) — these only existed to seed/migrate the old singleton; they're preserved standalone in Task 4's migration script for the one-time real-data migration, and are otherwise unused after this task.
- Keep `calculatorSchema`, `Calculator`, `defaultCalculator`, `stripMongoMeta` — untouched, still used by `/api/calculator`.
- Change `ensureSeed()` to only seed the calculator:

```js
async function ensureSeed() {
  const calcCount = await Calculator.countDocuments({ singleton: "main" });
  if (calcCount === 0) await Calculator.create({ singleton: "main", ...defaultCalculator });
}
await ensureSeed();
```

- Delete the `GET /api/ideas` and `PUT /api/ideas` route handlers entirely (was `index.js:237-273`).
- Add the import and mount, near the top with the other imports and after `app.use(cookieParser())`:

```js
import boardsRouter from "./boards.js";
```

```js
app.use("/api/boards", requireAuth, boardsRouter);
```

- [ ] **Step 3: Manual verification — board CRUD over HTTP**

Start a disposable Mongo (same tool installed in Task 1's Step 6; reinstall if you deleted `node_modules` since):

```bash
cd game-tools/server
node -e "
import('mongodb-memory-server').then(async ({ MongoMemoryServer }) => {
  const m = await MongoMemoryServer.create({ instance: { port: 27117 } });
  console.log('MONGO_READY ' + m.getUri('gt-verify'));
  await new Promise(() => {});
});
"
```

Leave that running. In a second terminal, start the server against it with dummy auth config (no real Google token needed for this verification — `VITE_GOOGLE_CLIENT_ID` just needs to be non-empty):

```bash
cd game-tools/server
MONGODB_URI="mongodb://127.0.0.1:27117/gt-verify" PORT=3099 VITE_GOOGLE_CLIENT_ID=test SESSION_SECRET=test-secret ALLOWED_EMAILS=owner@x.com,ed@x.com,vw@x.com,stranger@x.com node index.js
```

In a third terminal, mint session cookies directly (bypasses real Google verification, same technique as `server/auth.test.js`):

```bash
cd game-tools/server
node -e "
import('./auth.js').then(({ signSession }) => {
  for (const email of ['owner@x.com', 'stranger@x.com']) {
    console.log(email + '=' + signSession({ email, name: email, picture: null }));
  }
});
"
```

Copy the two printed tokens into shell variables, then:

```bash
OWNER="<paste owner@x.com token>"
STRANGER="<paste stranger@x.com token>"

# Create a board as owner
curl -s -X POST http://localhost:3099/api/boards -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$OWNER" -d '{"name":"Test board"}'
# Expected: {"id":"<some ObjectId>"}  — copy it into $BOARD_ID below.

BOARD_ID="<paste id from above>"

# Owner can read it, gets role "owner" and default statuses
curl -s http://localhost:3099/api/boards/$BOARD_ID -H "Cookie: gt_session=$OWNER"
# Expected: JSON with "role":"owner" and 5 default statuses.

# Owner can write to it
curl -s -X PUT http://localhost:3099/api/boards/$BOARD_ID -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$OWNER" -d '{"nodes":[{"id":1,"title":"x"}],"edges":[],"groups":[],"statuses":[],"tags":[],"palette":[],"nextNodeId":2,"nextEdgeId":1,"nextGroupId":1,"nextStatusId":1,"nextTagId":1,"nextPaletteId":1,"view":{"panX":0,"panY":0,"scale":1}}'
# Expected: {"ok":true}

# A non-member gets 404, not 403 (existence not leaked)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3099/api/boards/$BOARD_ID -H "Cookie: gt_session=$STRANGER"
# Expected: 404

# Board list shows it for owner, not for stranger
curl -s http://localhost:3099/api/boards -H "Cookie: gt_session=$OWNER"
# Expected: array with one board, "role":"owner"
curl -s http://localhost:3099/api/boards -H "Cookie: gt_session=$STRANGER"
# Expected: []

# Owner can delete it
curl -s -X DELETE http://localhost:3099/api/boards/$BOARD_ID -H "Cookie: gt_session=$OWNER"
# Expected: {"ok":true}
```

Stop the server (Ctrl+C) and the Mongo process when done.

- [ ] **Step 4: Commit**

```bash
git add game-tools/server/boards.js game-tools/server/index.js
git commit -m "feat: replace the singleton idea board with per-board CRUD routes"
```

---

### Task 3: Board member management routes

**Files:**
- Modify: `game-tools/server/boards.js` (append member routes)

**Interfaces:**
- Consumes: `loadBoardWithRole`, `Board`, `User`, `getBoardRole`, `isEmailAllowed` — all already in scope in `boards.js` from Task 2.
- Produces: `GET /:id/members`, `POST /:id/members`, `PATCH /:id/members/:email`, `DELETE /:id/members/:email`, added to the same router `boards.js` default-exports (no new export surface).

- [ ] **Step 1: Append the member routes to `server/boards.js`**

Add before `export default router;`:

```js
router.get("/:id/members", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner");
    if (!found) return;
    const { board } = found;
    const emails = board.members.map((m) => m.email);
    const users = await User.find({ email: { $in: emails } }).select("email name picture").lean();
    const byEmail = new Map(users.map((u) => [u.email, u]));
    res.json(
      board.members.map((m) => ({
        email: m.email,
        role: m.role,
        name: byEmail.get(m.email)?.name || null,
        picture: byEmail.get(m.email)?.picture || null
      }))
    );
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đọc được danh sách thành viên." });
  }
});

router.post("/:id/members", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner");
    if (!found) return;
    const { board } = found;
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = req.body.role;
    if (!email || !["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "invalid_input" });
    }
    if (!isEmailAllowed(email)) {
      return res.status(400).json({ error: "not_allowed" });
    }
    if (email === board.ownerEmail) {
      return res.status(400).json({ error: "already_owner" });
    }
    const existing = board.members.find((m) => m.email === email);
    if (existing) {
      existing.role = role;
    } else {
      board.members.push({ email, role, addedAt: new Date() });
    }
    await board.save();
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không mời được thành viên." });
  }
});

router.patch("/:id/members/:email", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner");
    if (!found) return;
    const { board } = found;
    const email = req.params.email.toLowerCase();
    const role = req.body.role;
    if (!["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const member = board.members.find((m) => m.email === email);
    if (!member) return res.status(404).json({ error: "not_found" });
    member.role = role;
    await board.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không đổi được vai trò." });
  }
});

router.delete("/:id/members/:email", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner");
    if (!found) return;
    const { board } = found;
    const email = req.params.email.toLowerCase();
    board.members = board.members.filter((m) => m.email !== email);
    await board.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không xoá được thành viên." });
  }
});
```

- [ ] **Step 2: Manual verification — member management over HTTP**

Reuse the Mongo + server + minted cookies from Task 2's Step 3 (restart both if you already stopped them; `ALLOWED_EMAILS` must include `owner@x.com,ed@x.com,vw@x.com,stranger@x.com`).

```bash
OWNER="<owner@x.com token — reuse or re-mint via the Task 2 Step 3 script>"
EDITOR="<mint one for ed@x.com the same way>"

# Create a fresh board as owner
BOARD_ID=$(curl -s -X POST http://localhost:3099/api/boards -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$OWNER" -d '{"name":"Member test"}' | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).id))")
echo $BOARD_ID

# Invite ed@x.com as editor
curl -s -X POST http://localhost:3099/api/boards/$BOARD_ID/members -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$OWNER" -d '{"email":"ed@x.com","role":"editor"}'
# Expected: {"ok":true} with 201

# Inviting an email not on ALLOWED_EMAILS is rejected
curl -s -X POST http://localhost:3099/api/boards/$BOARD_ID/members -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$OWNER" -d '{"email":"nobody@nowhere.com","role":"editor"}'
# Expected: {"error":"not_allowed"} with 400

# ed@x.com (now editor) can read+write the board but cannot invite others
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3099/api/boards/$BOARD_ID -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$EDITOR" -d '{"nodes":[],"edges":[],"groups":[],"statuses":[],"tags":[],"palette":[],"nextNodeId":1,"nextEdgeId":1,"nextGroupId":1,"nextStatusId":1,"nextTagId":1,"nextPaletteId":1,"view":{"panX":0,"panY":0,"scale":1}}'
# Expected: 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3099/api/boards/$BOARD_ID/members -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$EDITOR" -d '{"email":"vw@x.com","role":"viewer"}'
# Expected: 404 (editor has a role but not "owner" — loadBoardWithRole treats non-owner the same as non-member for owner-only routes... verify it's 404, matching every other owner-only route in this task)

# Change ed@x.com to viewer, then confirm write is now rejected
curl -s -X PATCH http://localhost:3099/api/boards/$BOARD_ID/members/ed@x.com -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$OWNER" -d '{"role":"viewer"}'
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3099/api/boards/$BOARD_ID -H "Content-Type: application/json" \
  -H "Cookie: gt_session=$EDITOR" -d '{"nodes":[],"edges":[],"groups":[],"statuses":[],"tags":[],"palette":[],"nextNodeId":1,"nextEdgeId":1,"nextGroupId":1,"nextStatusId":1,"nextTagId":1,"nextPaletteId":1,"view":{"panX":0,"panY":0,"scale":1}}'
# Expected: 403 {"error":"read_only"}

# Remove the member entirely
curl -s -X DELETE http://localhost:3099/api/boards/$BOARD_ID/members/ed@x.com -H "Cookie: gt_session=$OWNER"
# Expected: {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3099/api/boards/$BOARD_ID -H "Cookie: gt_session=$EDITOR"
# Expected: 404 (no longer a member at all)
```

Note the loadBoardWithRole/owner-only check above: confirm the 404 in the "editor tries to invite" step — if it comes back `403` instead, `loadBoardWithRole`'s owner check is distinguishing "member with wrong role" from "no role" in a way this plan didn't intend; treat that as a bug to fix before moving on (the spec requires 404 for anyone without the required role tier here, matching board-level routes).

- [ ] **Step 3: Commit**

```bash
git add game-tools/server/boards.js
git commit -m "feat: add board member invite/role/remove routes"
```

---

### Task 4: Migration script for the existing singleton board

**Files:**
- Create: `game-tools/server/scripts/migrate-to-boards.mjs`

**Interfaces:**
- Consumes: `User`, `Board` from `server/models.js` (Task 1). Reads the old `ideaboards` collection directly via the raw MongoDB driver (`mongoose.connection.collection("ideaboards")`) since the `IdeaBoard` Mongoose model itself was deleted in Task 2 — this script is self-contained and carries its own copy of the old migration logic.
- Produces: nothing consumed by other tasks — this is a one-off script the user runs once, manually, against the real Atlas database (not part of app startup, not committed test infrastructure).

- [ ] **Step 1: Write `server/scripts/migrate-to-boards.mjs`**

```js
// Chạy một lần, thủ công, sau khi Task 1-3 đã deploy:
//   cd game-tools/server && node scripts/migrate-to-boards.mjs
// Chuyển IdeaBoard singleton cũ (collection "ideaboards") thành Board đầu
// tiên, owner = chaupt2823@gmail.com. Idempotent: nếu đã có Board nào rồi
// thì dừng ngay, không tạo trùng.
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Board } from "../models.js";

dotenv.config();

const OWNER_EMAIL = "chaupt2823@gmail.com";

const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];
const STATUS_KEY_TO_ID = { idea: 1, considering: 2, chosen: 3, parked: 4, rejected: 5 };
const DOT_COUNT = 8;

function hashTagToken(name) {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "dot-" + ((h % DOT_COUNT) + 1);
}

// Bản sao một-lần-dùng của migrateBoard() cũ (đã xoá khỏi index.js ở Task 2)
// — chỉ để phòng trường hợp document thật vẫn còn ở định dạng cũ
// (status/tag kiểu chuỗi thay vì statusId/tagId keyed).
function migrateLegacyFormat(doc) {
  if (!Array.isArray(doc.statuses)) {
    doc.statuses = DEFAULT_STATUSES.map((s) => ({ ...s }));
    doc.nextStatusId = 6;
    (doc.nodes || []).forEach((n) => {
      n.statusId = STATUS_KEY_TO_ID[n.status] ?? null;
      delete n.status;
    });
  }
  if (!Array.isArray(doc.tags)) {
    const nameToId = new Map();
    const tags = [];
    let nextId = 1;
    (doc.nodes || []).forEach((n) => {
      const name = (n.tag || "").trim();
      if (name && !nameToId.has(name)) {
        nameToId.set(name, nextId);
        tags.push({ id: nextId, name, color: hashTagToken(name) });
        nextId++;
      }
    });
    doc.tags = tags;
    doc.nextTagId = nextId;
    (doc.nodes || []).forEach((n) => {
      const name = (n.tag || "").trim();
      n.tagId = name ? nameToId.get(name) : null;
      delete n.tag;
    });
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Thiếu MONGODB_URI trong server/.env — không thể chạy migration.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const existingBoardCount = await Board.countDocuments();
  if (existingBoardCount > 0) {
    console.log(`Đã có ${existingBoardCount} Board — migration có thể đã chạy rồi. Dừng lại, không tạo trùng.`);
    await mongoose.disconnect();
    return;
  }

  const legacy = await mongoose.connection.collection("ideaboards").findOne({ singleton: "main" });
  if (!legacy) {
    console.log("Không tìm thấy IdeaBoard cũ — không có gì để migrate.");
    await mongoose.disconnect();
    return;
  }

  migrateLegacyFormat(legacy);

  await User.findOneAndUpdate(
    { email: OWNER_EMAIL },
    { $setOnInsert: { email: OWNER_EMAIL, lastLoginAt: new Date() } },
    { upsert: true }
  );

  const board = await Board.create({
    name: "Board của Châu",
    ownerEmail: OWNER_EMAIL,
    members: [],
    nodes: legacy.nodes,
    edges: legacy.edges,
    groups: legacy.groups,
    statuses: legacy.statuses,
    tags: legacy.tags,
    palette: legacy.palette || [],
    nextNodeId: legacy.nextNodeId,
    nextEdgeId: legacy.nextEdgeId,
    nextGroupId: legacy.nextGroupId,
    nextStatusId: legacy.nextStatusId,
    nextTagId: legacy.nextTagId,
    nextPaletteId: legacy.nextPaletteId || 1,
    view: legacy.view
  });

  console.log(`Đã tạo Board "${board.name}" (id ${board._id}) với ${board.nodes.length} thẻ, owner ${OWNER_EMAIL}.`);
  console.log("Collection ideaboards cũ vẫn được giữ nguyên — có thể xoá thủ công sau khi xác nhận mọi thứ ổn.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Migration thất bại:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Verify against a disposable copy of realistic data (not the real database)**

```bash
cd game-tools/server
node -e "
import('mongodb-memory-server').then(async ({ MongoMemoryServer }) => {
  const m = await MongoMemoryServer.create({ instance: { port: 27118 } });
  console.log('MONGO_READY ' + m.getUri('gt-migrate-verify'));
  await new Promise(() => {});
});
"
```

In a second terminal, seed a fixture matching the real singleton shape, then run the script against it:

```bash
cd game-tools/server
MONGODB_URI="mongodb://127.0.0.1:27118/gt-migrate-verify" node -e "
import('mongoose').then(async (m) => {
  await m.default.connect(process.env.MONGODB_URI);
  await m.default.connection.collection('ideaboards').insertOne({
    singleton: 'main',
    nodes: [{ id: 1, title: 'Fixture card', statusId: 1, tagId: null, x: 0, y: 0 }],
    edges: [], groups: [],
    statuses: [{ id: 1, name: 'Ý tưởng mới', color: 'st-idea' }],
    tags: [], palette: [],
    nextNodeId: 2, nextEdgeId: 1, nextGroupId: 1, nextStatusId: 2, nextTagId: 1, nextPaletteId: 1,
    view: { panX: 0, panY: 0, scale: 1 }
  });
  console.log('fixture inserted');
  process.exit(0);
});
"
MONGODB_URI="mongodb://127.0.0.1:27118/gt-migrate-verify" node scripts/migrate-to-boards.mjs
```

Expected output: `Đã tạo Board "Board của Châu" (id ...) với 1 thẻ, owner chaupt2823@gmail.com.`

Run it a second time to confirm idempotency:

```bash
MONGODB_URI="mongodb://127.0.0.1:27118/gt-migrate-verify" node scripts/migrate-to-boards.mjs
```

Expected: `Đã có 1 Board — migration có thể đã chạy rồi. Dừng lại, không tạo trùng.`

Stop the Mongo process when done.

- [ ] **Step 3: Commit**

```bash
git add game-tools/server/scripts/migrate-to-boards.mjs
git commit -m "feat: add one-off migration script from the singleton board to the first Board doc"
```

*(Running this script against the real Atlas database is a manual, human-run deployment step — not something to automate as part of this plan. Do it once after Tasks 1-3 are deployed.)*

---

### Task 5: Socket.IO per-board room scoping

**Files:**
- Modify: `game-tools/server/index.js:310-341` (Socket.IO setup and connection handler)

**Interfaces:**
- Consumes: `Board`, `getBoardRole` (already imported into `index.js` by Tasks 1-2).
- Produces: no new exports — this changes runtime behavior only. Client-side changes (Task 7) depend on the server accepting a `boardId` query param on connect and scoping all presence events to `board:<id>` rooms.

- [ ] **Step 1: Replace the Socket.IO section in `server/index.js`**

Replace the existing block (from `io.use((socket, next) => {` through the end of `io.on("connection", ...)`) with:

```js
io.use(async (socket, next) => {
  const user = parseSessionFromCookieHeader(socket.handshake.headers.cookie);
  if (!user || !isEmailAllowed(user.email)) return next(new Error("unauthorized"));
  const boardId = socket.handshake.query.boardId;
  if (!boardId) return next(new Error("missing_board"));
  let board;
  try {
    board = await Board.findById(boardId).select("ownerEmail members").lean();
  } catch (e) {
    return next(new Error("forbidden"));
  }
  if (!board) return next(new Error("forbidden"));
  const role = getBoardRole(board, user.email);
  if (!role) return next(new Error("forbidden"));
  socket.data.user = user;
  socket.data.boardId = String(boardId);
  socket.data.role = role;
  next();
});

// boardId -> Map<socket.id, { socketId, email, name, picture, x, y }>
const presencePeers = new Map();

function peersForBoard(boardId) {
  let m = presencePeers.get(boardId);
  if (!m) {
    m = new Map();
    presencePeers.set(boardId, m);
  }
  return m;
}

io.on("connection", (socket) => {
  const room = "board:" + socket.data.boardId;
  socket.join(room);
  const peers = peersForBoard(socket.data.boardId);
  const peer = { socketId: socket.id, ...socket.data.user, x: 0, y: 0 };
  peers.set(socket.id, peer);
  socket.emit("presence:sync", Array.from(peers.values()));
  socket.to(room).emit("presence:join", peer);

  // Cursor position là presence, không phải chỉnh sửa dữ liệu — viewer vẫn
  // được thấy và được người khác thấy con trỏ, chỉ bị chặn ghi dữ liệu thật
  // ở PUT /api/boards/:id (403 read_only).
  socket.on("cursor:move", (payload) => {
    const { x, y } = payload || {};
    const p = peers.get(socket.id);
    if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = x;
    p.y = y;
    socket.to(room).emit("cursor:move", p);
  });

  socket.on("disconnect", () => {
    peers.delete(socket.id);
    if (peers.size === 0) presencePeers.delete(socket.data.boardId);
    socket.to(room).emit("presence:leave", { socketId: socket.id });
  });
});
```

(This is a deliberate, small deviation from the design doc, which grouped `cursor:move` with hypothetical future "card-edit socket events" under a role check. There are no card-edit socket events in this codebase — all board mutations go through `PUT /api/boards/:id`, not sockets — and cursor position isn't a data mutation, so gating it for viewers would just break the Figma/Miro-style "see everyone looking around" behavior for no security benefit. `PUT /api/boards/:id`'s existing `403 read_only` check, from Task 2, remains the actual enforcement point for viewers.)

- [ ] **Step 2: Manual verification — two sockets, same board vs. different boards**

Reuse the Mongo + server setup from Task 2 Step 3 (server running on port 3099 against the disposable Mongo). Mint two tokens for `owner@x.com` and `ed@x.com` (both on `ALLOWED_EMAILS`), create two boards as owner via curl (`POST /api/boards` twice, capturing `$BOARD_A` and `$BOARD_B`), invite `ed@x.com` as editor to `$BOARD_A` only.

`socket.io-client` only lives in `game-tools/client/node_modules` (it's a client dependency, not a server one) — run this from the client directory:

```bash
cd game-tools/client
node -e "
import('socket.io-client').then(async ({ io }) => {
  const OWNER_TOKEN = process.env.OWNER_TOKEN;
  const EDITOR_TOKEN = process.env.EDITOR_TOKEN;
  const BOARD_A = process.env.BOARD_A;
  const BOARD_B = process.env.BOARD_B;

  const a = io('http://localhost:3099', { extraHeaders: { Cookie: 'gt_session=' + OWNER_TOKEN }, query: { boardId: BOARD_A }, transports: ['websocket'] });
  const b = io('http://localhost:3099', { extraHeaders: { Cookie: 'gt_session=' + OWNER_TOKEN }, query: { boardId: BOARD_B }, transports: ['websocket'] });

  let bGotEvent = false;
  b.on('cursor:move', () => { bGotEvent = true; });

  a.on('connect', () => {
    setTimeout(() => a.emit('cursor:move', { x: 10, y: 20 }), 300);
  });

  setTimeout(() => {
    console.log(bGotEvent ? 'FAIL: board B received board A cursor event (room leak)' : 'PASS: board B never received board A cursor event');
    process.exit(0);
  }, 1200);
});
"
```

Run with `OWNER_TOKEN=... EDITOR_TOKEN=... BOARD_A=... BOARD_B=... node <above script>` (fill in from the curl steps). Expected: `PASS: board B never received board A cursor event`.

Also confirm the reject path: connecting with `boardId` set to a board the user has no role on (or omitted entirely) should fail the handshake — check for a `connect_error` event with message `forbidden` or `missing_board` instead of a successful `connect`.

- [ ] **Step 3: Commit**

```bash
git add game-tools/server/index.js
git commit -m "feat: scope Socket.IO presence to per-board rooms"
```

---

### Task 6: Client API layer + board list page + routing

**Files:**
- Modify: `game-tools/client/src/lib/api.js` (replace `getIdeas`/`saveIdeas` with board-scoped functions, add board/member CRUD)
- Create: `game-tools/client/src/pages/BoardList.jsx`
- Modify: `game-tools/client/src/main.jsx` (route change)

**Interfaces:**
- Produces (from `api.js`): `listBoards()`, `createBoard(name)`, `getBoard(boardId)`, `saveBoard(boardId, state)`, `deleteBoard(boardId)`, `getMembers(boardId)`, `inviteMember(boardId, email, role)`, `updateMemberRole(boardId, email, role)`, `removeMember(boardId, email)` — all `async`, all throw an `Error` with a `.code` string on failure (same pattern as the existing `apiError` helper). `inviteMember` specifically sets `.code` to the server's `error` field (`"not_allowed"`, `"already_owner"`, `"invalid_input"`) when the response isn't ok, not just a generic failure code — Task 7's `InviteModal` depends on this to show the right inline message.
- Consumes (Task 7): `getBoard`/`saveBoard` replace `getIdeas`/`saveIdeas` in `IdeaMap.jsx`; `getMembers`/`inviteMember`/`updateMemberRole`/`removeMember` are consumed by the new `InviteModal.jsx`.

- [ ] **Step 1: Rewrite `client/src/lib/api.js`**

```js
function apiError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function checkAuthExpired(res) {
  if (res.status === 401) window.dispatchEvent(new Event("auth:expired"));
}

async function parseErrorCode(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function listBoards() {
  const res = await fetch("/api/boards");
  checkAuthExpired(res);
  if (!res.ok) throw apiError("BOARDS_LOAD_FAILED");
  return res.json();
}

export async function createBoard(name) {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("BOARD_CREATE_FAILED");
  return res.json();
}

export async function getBoard(boardId) {
  const res = await fetch(`/api/boards/${boardId}`);
  checkAuthExpired(res);
  if (res.status === 404) throw apiError("BOARD_NOT_FOUND");
  if (!res.ok) throw apiError("BOARD_LOAD_FAILED");
  return res.json();
}

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

export async function deleteBoard(boardId) {
  const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("BOARD_DELETE_FAILED");
  return res.json();
}

export async function getMembers(boardId) {
  const res = await fetch(`/api/boards/${boardId}/members`);
  checkAuthExpired(res);
  if (!res.ok) throw apiError("MEMBERS_LOAD_FAILED");
  return res.json();
}

export async function inviteMember(boardId, email, role) {
  const res = await fetch(`/api/boards/${boardId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role })
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError(await parseErrorCode(res, "MEMBER_INVITE_FAILED"));
  return res.json();
}

export async function updateMemberRole(boardId, email, role) {
  const res = await fetch(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("MEMBER_UPDATE_FAILED");
  return res.json();
}

export async function removeMember(boardId, email) {
  const res = await fetch(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, {
    method: "DELETE"
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("MEMBER_REMOVE_FAILED");
  return res.json();
}

export async function getCalculator() {
  const res = await fetch("/api/calculator");
  checkAuthExpired(res);
  if (!res.ok) throw apiError("CALC_LOAD_FAILED");
  return res.json();
}

export async function saveCalculator(state) {
  const res = await fetch("/api/calculator", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("CALC_SAVE_FAILED");
  return res.json();
}
```

- [ ] **Step 2: Write `client/src/pages/BoardList.jsx`**

```jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { listBoards, createBoard } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import LocaleToggle from "../components/LocaleToggle.jsx";

const ROLE_LABEL = { owner: "Chủ sở hữu", editor: "Có thể sửa", viewer: "Chỉ xem" };

export default function BoardList() {
  const [boards, setBoards] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const toggleTheme = useTheme();
  const { t } = useLingui();

  useEffect(() => {
    let cancelled = false;
    listBoards()
      .then((data) => { if (!cancelled) setBoards(data); })
      .catch((e) => setLoadError(e.code || "UNKNOWN"));
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const { id } = await createBoard(t`Board mới`);
      navigate(`/idea-map/${id}`);
    } catch (e) {
      setLoadError(e.code || "UNKNOWN");
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 32 }}>
        <div>
          <div className="eyebrow"><Trans>Bản đồ ý tưởng</Trans></div>
          <h1 className="display" style={{ fontSize: "clamp(24px, 5vw, 32px)", margin: "6px 0 0" }}>
            <Trans>Board của bạn</Trans>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <LocaleToggle />
          <button className="btn ghost icon" onClick={toggleTheme} title={t`Đổi giao diện sáng/tối`}>◐</button>
        </div>
      </div>

      <button type="button" className="btn" onClick={handleCreate} disabled={creating} style={{ marginBottom: 20 }}>
        <Trans>+ Board mới</Trans>
      </button>

      {loadError && (
        <p style={{ color: "#c33" }}><Trans>Có lỗi xảy ra, thử tải lại trang.</Trans></p>
      )}
      {boards == null && !loadError && <p><Trans>Đang tải…</Trans></p>}
      {boards != null && boards.length === 0 && (
        <p style={{ color: "var(--ink-dim)" }}>
          <Trans>Chưa có board nào — bấm "+ Board mới" để bắt đầu.</Trans>
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {boards?.map((b) => (
          <Link
            key={b.id}
            to={`/idea-map/${b.id}`}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              textDecoration: "none", color: "var(--ink)",
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
              padding: "14px 16px", boxShadow: "var(--shadow)"
            }}
          >
            <span>{b.name}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-dim)", textTransform: "uppercase" }}>
              {ROLE_LABEL[b.role] || b.role}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update routing in `client/src/main.jsx`**

Add the `BoardList` import next to the existing `IdeaMap` import, and change the route table:

```js
import BoardList from "./pages/BoardList.jsx";
```

```jsx
<Route path="/idea-map" element={<BoardList />} />
<Route path="/idea-map/:boardId" element={<IdeaMap />} />
```

(Replaces the single existing `<Route path="/idea-map" element={<IdeaMap />} />` line.)

- [ ] **Step 4: Manual verification**

Run: `cd game-tools/client && npm run build`
Expected: build succeeds with no errors (confirms no syntax/import mistakes before wiring `IdeaMap.jsx` itself in Task 7, which is still reading `getIdeas`/`saveIdeas` at this point — that's fine, Task 7 fixes those call sites next; this step only proves `api.js`, `BoardList.jsx`, and `main.jsx` are self-consistent).

Note: `IdeaMap.jsx` still imports `getIdeas`/`saveIdeas` from `api.js` at this point in the plan, which Step 1 just deleted — **this task's build will fail** until Task 7 updates `IdeaMap.jsx`. That's expected and fine for a mid-plan checkpoint; Tasks 6 and 7 are reviewed independently but the working tree only needs to build again at the end of Task 7. Skip the build-success assertion above if it fails solely due to `IdeaMap.jsx`'s still-old imports — confirm instead by running `node --check client/src/lib/api.js client/src/pages/BoardList.jsx client/src/main.jsx` (syntax-only check) for each new/modified file individually.

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/lib/api.js game-tools/client/src/pages/BoardList.jsx game-tools/client/src/main.jsx
git commit -m "feat: add board list page and board-scoped API client functions"
```

---

### Task 7: `IdeaMap.jsx` board-scoping, read-only viewer mode, and Invite UI

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/lib/usePresence.js`
- Create: `game-tools/client/src/components/InviteModal.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css` (read-only styling)

**Interfaces:**
- Consumes: `getBoard`, `saveBoard` from `api.js` (Task 6); `getMembers`, `inviteMember`, `updateMemberRole`, `removeMember` from `api.js` (Task 6, consumed by `InviteModal.jsx`).
- Produces: no new exports outside the component tree — this is the final integration task.

- [ ] **Step 1: Modify `usePresence.js` to accept and use `boardId`**

In `game-tools/client/src/lib/usePresence.js`, change the hook signature and the `io()` call:

```js
export function usePresence(user, boardId) {
  const [peers, setPeers] = useState(new Map());
  const socketRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!user || !boardId) return;
    warnedRef.current = false;
    const socket = io({ query: { boardId } });
    socketRef.current = socket;
```

(Only the function signature line and the `io()` call change — the rest of the hook body, event listeners, and `sendCursor` are unchanged. The effect's dependency array at the bottom must also change from `[user]` to `[user, boardId]` so switching boards reconnects with the new room.)

- [ ] **Step 2: Write `client/src/components/InviteModal.jsx`**

```jsx
import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { getMembers, inviteMember, updateMemberRole, removeMember } from "../lib/api.js";

const ERROR_MESSAGES = {
  not_allowed: "Email này chưa được cấp quyền đăng nhập vào hệ thống.",
  already_owner: "Email này đã là chủ sở hữu board.",
  invalid_input: "Email hoặc vai trò không hợp lệ."
};

export default function InviteModal({ boardId, onClose }) {
  const { t } = useLingui();
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    getMembers(boardId).then(setMembers).catch(() => setMembers([]));
  }

  useEffect(() => { reload(); }, [boardId]);

  async function handleInvite(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await inviteMember(boardId, email.trim(), role);
      setEmail("");
      reload();
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || "Không mời được thành viên.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(memberEmail, newRole) {
    await updateMemberRole(boardId, memberEmail, newRole);
    reload();
  }

  async function handleRemove(memberEmail) {
    await removeMember(boardId, memberEmail);
    reload();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 20, width: 380, maxWidth: "90vw", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 className="display" style={{ fontSize: 15, margin: 0 }}><Trans>Mời thành viên</Trans></h2>
          <button type="button" className="btn ghost icon" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleInvite} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            type="email"
            required
            placeholder={t`Email`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: "7px 9px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 12.5 }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ padding: "7px 9px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 12.5 }}
          >
            <option value="editor">{t`Có thể sửa`}</option>
            <option value="viewer">{t`Chỉ xem`}</option>
          </select>
          <button type="submit" className="btn" disabled={submitting}><Trans>Mời</Trans></button>
        </form>

        {error && <p style={{ color: "#c33", fontSize: 12, margin: "0 0 10px" }}>{error}</p>}

        {members == null && <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></p>}
        {members?.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}><Trans>Chưa mời ai vào board này.</Trans></p>}

        <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {members?.map((m) => (
            <div key={m.email} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              {m.picture
                ? <img src={m.picture} alt="" referrerPolicy="no-referrer" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                : <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--line)", display: "inline-block" }} />}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.name || m.email}
              </span>
              <select
                value={m.role}
                onChange={(e) => handleRoleChange(m.email, e.target.value)}
                style={{ fontSize: 11.5, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
              >
                <option value="editor">{t`Có thể sửa`}</option>
                <option value="viewer">{t`Chỉ xem`}</option>
              </select>
              <button type="button" className="btn ghost icon" onClick={() => handleRemove(m.email)} title={t`Xoá khỏi board`}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add read-only CSS rules to `idea-map.css`**

Append to `game-tools/client/src/styles/idea-map.css`:

```css
.shell.readonly .topbar,
.shell.readonly .filterbar,
.shell.readonly .canvas { pointer-events: none; }
.shell.readonly .viewport { pointer-events: auto; }

.readonly-banner {
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
  padding: 5px 14px; font-size: 11.5px; color: var(--ink-dim); z-index: 50;
  box-shadow: var(--shadow); pointer-events: none;
}
```

(`.viewport` stays interactive so pan/zoom still work for a viewer; `.canvas` — the direct child that contains every card/group/edge — is explicitly re-disabled so drag/click/right-click on board content is blocked. `.topbar`/`.filterbar` cover every toolbar button. This blocks all *mouse* mutation paths; keyboard shortcuts like Delete/Ctrl+Z are a known gap this task doesn't chase down — `saveNow`/`saveDebounced` (Step 5 below) are the real chokepoint that blocks any mutation from ever reaching the server regardless of how it was triggered, and the server's own `403 read_only` check from Task 2 is the final backstop either way.)

- [ ] **Step 4: Update imports and add `boardId`/`role`/`inviteOpen` state in `IdeaMap.jsx`**

Replace the import line:
```js
import { getIdeas, saveIdeas } from "../lib/api.js";
```
with:
```js
import { getBoard, saveBoard } from "../lib/api.js";
```

Add to the existing imports (near the `react-router-dom` import at the top):
```js
import { useParams } from "react-router-dom";
```
(The existing `import { Link } from "react-router-dom";` becomes `import { Link, useParams } from "react-router-dom";`.)

Add the new component import:
```js
import InviteModal from "../components/InviteModal.jsx";
```

Inside the component body, add right after `const { user } = useAuth();`:
```js
const { boardId } = useParams();
const [role, setRole] = useState(null);
const [boardName, setBoardName] = useState("");
const [inviteOpen, setInviteOpen] = useState(false);
```

Change the presence hook call:
```js
const { peers: presencePeers, sendCursor } = usePresence(user, boardId);
```

- [ ] **Step 5: Update the board-loading effect and save functions**

Replace the load effect (`useEffect` calling `getIdeas()`):

```js
useEffect(() => {
  let cancelled = false;
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
    .catch((e) => setLoadError(e.code || "UNKNOWN"));
  return () => { cancelled = true; };
}, [boardId]);
```

Replace `saveNow`:

```js
function saveNow(next) {
  if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
  if (role === "viewer") return;
  saveBoard(boardId, next).then(() => setSaveError(null)).catch(() => setSaveError(true));
}
```

(`saveDebounced` is unchanged — it already just calls `saveNow` after a timeout, so the viewer guard inside `saveNow` covers both paths.)

- [ ] **Step 6: Add the read-only banner, viewer role class, back-link target, board name, and Invite UI to the JSX return**

Change the shell wrapper (was `"shell" + (presentIndex != null ? " presenting" : "")`):

```jsx
<div className={"shell" + (presentIndex != null ? " presenting" : "") + (role === "viewer" ? " readonly" : "")} onContextMenu={handlePageContextMenu}>
```

Right after that opening tag (before the existing `<style>{paletteCss(...)}</style>` line), add:

```jsx
{role === "viewer" && (
  <div className="readonly-banner"><Trans>Chỉ xem — bạn không có quyền chỉnh sửa board này.</Trans></div>
)}
```

In the `.topbar`, change the title and back-link, and add the Invite button, replacing:
```jsx
<h1 className="display" style={{ fontSize: 19, margin: 0 }}><Trans>Game Của Tôi</Trans></h1>
</div>
<Link to="/" className="btn ghost"><Trans>← Trang chủ</Trans></Link>
```
with:
```jsx
<h1 className="display" style={{ fontSize: 19, margin: 0 }}>{boardName}</h1>
</div>
<Link to="/idea-map" className="btn ghost"><Trans>← Danh sách board</Trans></Link>
{role === "owner" && (
  <button className="btn ghost" onClick={() => setInviteOpen(true)}><Trans>Mời thành viên</Trans></button>
)}
```

Near the other conditionally-rendered overlays at the end of the JSX (alongside `{badgeUI && ...}` blocks), add:

```jsx
{inviteOpen && role === "owner" && (
  <InviteModal boardId={boardId} onClose={() => setInviteOpen(false)} />
)}
```

- [ ] **Step 7: Manual verification**

```bash
cd game-tools/client && npm run build
```
Expected: build succeeds with no errors now that both `BoardList.jsx` and `IdeaMap.jsx` use the new `api.js` exports consistently.

Then run the app end-to-end against a disposable Mongo (same pattern as the server tasks) with the dev client:

1. Start disposable Mongo (`mongodb-memory-server`, port 27117, as in Task 2).
2. Start the server: `cd game-tools/server && MONGODB_URI="mongodb://127.0.0.1:27117/gt-verify" PORT=3001 VITE_GOOGLE_CLIENT_ID=test SESSION_SECRET=test-secret ALLOWED_EMAILS=owner@x.com,ed@x.com,vw@x.com COOKIE_SECURE= node index.js`.
3. Start the client: `cd game-tools/client && npm run dev`.
4. Since real Google sign-in can't be scripted, set the session cookie directly in the browser: open `http://localhost:5173`, open devtools console, mint a token server-side (`node -e "import('./auth.js').then(({signSession}) => console.log(signSession({email:'owner@x.com', name:'Owner', picture:null})))"` run from `game-tools/server`), then in the browser console run `document.cookie = "gt_session=<paste token>; path=/"` and reload.
5. Confirm `/idea-map` shows the board list (empty at first), click "+ Board mới", confirm it navigates to `/idea-map/<id>` with an empty board and the "Mời thành viên" button visible (you're the owner).
6. Click "Mời thành viên", invite `vw@x.com` as `viewer`, confirm it appears in the member list.
7. Open a second browser profile (or an incognito window), set `gt_session` to a token minted for `vw@x.com` the same way, navigate to the same `/idea-map/<id>` URL.
8. Confirm: the "Chỉ xem" banner is visible, dragging/creating cards has no effect, the "Mời thành viên" button is absent, but pan (drag background) and zoom (scroll wheel) still work, and the owner's live cursor (from the first window) is visible moving around.
9. Stop the client, server, and Mongo process when done.

- [ ] **Step 8: Commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/lib/usePresence.js game-tools/client/src/components/InviteModal.jsx game-tools/client/src/styles/idea-map.css
git commit -m "feat: board-scope IdeaMap, add read-only viewer mode and invite UI"
```
