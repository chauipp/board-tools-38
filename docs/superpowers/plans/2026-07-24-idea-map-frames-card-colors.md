# Idea Map: Frames + Card Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a draggable/resizable "frame" that visually groups idea cards and can connect via edges to cards outside it, and let cards get a color (right-click swatch picker) alongside the existing edit flow.

**Architecture:** `board.groups` is a new flat array (parallel to `nodes`/`edges`) of `{ id, title, x, y, w, h, color }` rectangles. Frame membership is never stored — it's computed on demand from geometry (card center inside frame rect), so there's only one source of truth for card position. Edges gain optional `fromKind`/`toKind` (`"node"` default or `"group"`) so one edge model covers card↔card, card↔frame, and frame↔frame links.

**Tech Stack:** React 18 + Vite (client), Express + Mongoose (server), no test framework installed — pure logic gets a `node --test` self-check (Node's built-in test runner, zero new dependencies); interactive/rendering code gets a scripted manual browser check since there's no Playwright/Testing Library in this repo and adding one is out of scope for this feature.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-idea-map-frames-card-colors-design.md` — every requirement in it must map to a task below.
- No new npm dependencies. Reuse `BADGE_PALETTE`/`colorVar` (`client/src/lib/badges.js`) for all color pickers.
- Follow existing code style: plain `mousedown`/`mousemove`/`mouseup` drag pattern (see `handleNodeMouseDown` in `IdeaMap.jsx`), Vietnamese UI strings wrapped in `<Trans>`/`` t`...` `` (lingui), commit messages are short imperative sentences with no prefix (e.g. "Add wheel-to-zoom and page-wide native context-menu suppression to idea map" — see `git log`).
- Dev servers (start once, both auto-reload on save):
  ```bash
  cd game-tools/server && npm run dev   # http://localhost:3001 — needs server/.env with MONGODB_URI (already configured)
  cd game-tools/client && npm run dev   # http://localhost:5173 — proxies /api/* to :3001, route under test is /idea-map
  ```
- Node.js built-in test runner: `node --test <file>` (project uses Node v24, no config needed).

---

### Task 1: Pure geometry + edge-endpoint helpers

**Files:**
- Create: `game-tools/client/src/lib/board-geometry.js`
- Test: `game-tools/client/src/lib/board-geometry.test.js`

**Interfaces:**
- Produces:
  - `pointInRect(px, py, rect): boolean` — `rect = { x, y, w, h }`
  - `nodesInFrame(nodes, frame, sizeOf): number[]` — `nodes` is `board.nodes`, `frame` is `{x,y,w,h}`, `sizeOf(nodeId) => { w, h }`. Returns ids of nodes whose center point falls inside `frame`.
  - `edgeEndpoint(kind, id, nodes, groups, sizeOf): {x,y} | null` — `kind` is `"node"` or `"group"`. For `"node"` looks up `nodes` and uses `sizeOf(id)` for the card's measured size; for `"group"` looks up `groups` and uses its own `w`/`h`. Returns `null` if the id isn't found.
  - `edgesMatch(edge, a, aKind, b, bKind): boolean` — true if `edge` connects `(a,aKind)` and `(b,bKind)` in either direction. Treats a missing `edge.fromKind`/`edge.toKind` as `"node"` (back-compat with existing edges that predate this field).
- Consumes: nothing (pure, no imports beyond the language).

- [ ] **Step 1: Write the failing test**

```js
// game-tools/client/src/lib/board-geometry.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInRect, nodesInFrame, edgeEndpoint, edgesMatch } from "./board-geometry.js";

test("pointInRect: điểm trong và ngoài hình chữ nhật, biên tính là trong", () => {
  const rect = { x: 0, y: 0, w: 100, h: 50 };
  assert.equal(pointInRect(50, 25, rect), true);
  assert.equal(pointInRect(150, 25, rect), false);
  assert.equal(pointInRect(0, 0, rect), true);
  assert.equal(pointInRect(100, 50, rect), true);
});

test("nodesInFrame: chỉ trả về card có tâm nằm trong khung", () => {
  const frame = { x: 0, y: 0, w: 200, h: 200 };
  const nodes = [
    { id: 1, x: 10, y: 10 },  // tâm (30,30) khi w=h=40 -> trong
    { id: 2, x: 300, y: 10 }  // tâm (320,30) -> ngoài
  ];
  const sizeOf = () => ({ w: 40, h: 40 });
  assert.deepEqual(nodesInFrame(nodes, frame, sizeOf), [1]);
});

test("edgeEndpoint: tâm node và tâm group, null khi không tìm thấy", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }];
  const groups = [{ id: 1, x: 100, y: 100, w: 50, h: 50 }];
  const sizeOf = () => ({ w: 20, h: 20 });
  assert.deepEqual(edgeEndpoint("node", 1, nodes, groups, sizeOf), { x: 10, y: 10 });
  assert.deepEqual(edgeEndpoint("group", 1, nodes, groups, sizeOf), { x: 125, y: 125 });
  assert.equal(edgeEndpoint("node", 99, nodes, groups, sizeOf), null);
});

test("edgesMatch: phân biệt node và group dù trùng id số", () => {
  const e = { id: 1, from: 3, to: 3, fromKind: "node", toKind: "group" };
  assert.equal(edgesMatch(e, 3, "node", 3, "group"), true);
  assert.equal(edgesMatch(e, 3, "group", 3, "node"), true); // đối xứng
  assert.equal(edgesMatch(e, 3, "node", 3, "node"), false); // trùng id nhưng khác kind
});

test("edgesMatch: edge cũ không có fromKind/toKind mặc định hiểu là node", () => {
  const e = { id: 1, from: 5, to: 6 };
  assert.equal(edgesMatch(e, 5, "node", 6, "node"), true);
  assert.equal(edgesMatch(e, 5, "group", 6, "node"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test game-tools/client/src/lib/board-geometry.test.js`
Expected: FAIL — `Cannot find module './board-geometry.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// game-tools/client/src/lib/board-geometry.js
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

export function nodesInFrame(nodes, frame, sizeOf) {
  return nodes
    .filter((n) => {
      const { w, h } = sizeOf(n.id);
      return pointInRect(n.x + w / 2, n.y + h / 2, frame);
    })
    .map((n) => n.id);
}

export function edgeEndpoint(kind, id, nodes, groups, sizeOf) {
  if (kind === "group") {
    const g = groups.find((gr) => gr.id === id);
    return g ? { x: g.x + g.w / 2, y: g.y + g.h / 2 } : null;
  }
  const n = nodes.find((nn) => nn.id === id);
  if (!n) return null;
  const { w, h } = sizeOf(id);
  return { x: n.x + w / 2, y: n.y + h / 2 };
}

export function edgesMatch(edge, a, aKind, b, bKind) {
  const fromKind = edge.fromKind || "node";
  const toKind = edge.toKind || "node";
  return (
    (edge.from === a && fromKind === aKind && edge.to === b && toKind === bKind) ||
    (edge.from === b && fromKind === bKind && edge.to === a && toKind === aKind)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test game-tools/client/src/lib/board-geometry.test.js`
Expected: PASS — 5 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/lib/board-geometry.js game-tools/client/src/lib/board-geometry.test.js
git commit -m "Add pure geometry helpers for frame membership and node/group edge endpoints"
```

---

### Task 2: Server — persist `groups` and `nextGroupId`

**Files:**
- Modify: `game-tools/server/index.js:23-37` (`ideaBoardSchema`)
- Modify: `game-tools/server/index.js:61-83` (`defaultIdeas`)
- Modify: `game-tools/server/index.js:187-199` (`PUT /api/ideas`)

**Interfaces:**
- Produces: `GET/PUT /api/ideas` round-trips `groups: []` (default) and `nextGroupId: number` (default `1`) like every other board field.
- Consumes: nothing new.

- [ ] **Step 1: Add `groups`/`nextGroupId` to the schema**

In `game-tools/server/index.js`, change:

```js
const ideaBoardSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    statuses: { type: Array, default: undefined },
    tags: { type: Array, default: undefined },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    nextStatusId: { type: Number, default: 1 },
    nextTagId: { type: Number, default: 1 },
    view: { type: Object, default: () => ({ panX: 0, panY: 0, scale: 1 }) }
  },
  { minimize: false, versionKey: false }
);
```

to:

```js
const ideaBoardSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    groups: { type: Array, default: [] },
    statuses: { type: Array, default: undefined },
    tags: { type: Array, default: undefined },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    nextGroupId: { type: Number, default: 1 },
    nextStatusId: { type: Number, default: 1 },
    nextTagId: { type: Number, default: 1 },
    view: { type: Object, default: () => ({ panX: 0, panY: 0, scale: 1 }) }
  },
  { minimize: false, versionKey: false }
);
```

(Mongoose applies a path's `default` at document hydration whenever that key is missing from the stored document — this covers the existing board already in Mongo with zero migration code.)

- [ ] **Step 2: Add `groups`/`nextGroupId` to the seed default**

Change:

```js
  nextNodeId: 5,
  nextEdgeId: 3,
  nextStatusId: 6,
  nextTagId: 4,
  view: { panX: 60, panY: 60, scale: 1 }
};
```

to:

```js
  nextNodeId: 5,
  nextEdgeId: 3,
  nextGroupId: 1,
  nextStatusId: 6,
  nextTagId: 4,
  view: { panX: 60, panY: 60, scale: 1 }
};
```

and add `groups: [],` right after the `edges: [...]` block in the same `defaultIdeas` object.

- [ ] **Step 3: Whitelist `groups`/`nextGroupId` on save**

Change:

```js
app.put("/api/ideas", async (req, res) => {
  try {
    const { nodes, edges, statuses, tags, nextNodeId, nextEdgeId, nextStatusId, nextTagId, view } = req.body;
    await IdeaBoard.findOneAndUpdate(
      { singleton: "main" },
      { nodes, edges, statuses, tags, nextNodeId, nextEdgeId, nextStatusId, nextTagId, view },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không lưu được dữ liệu ý tưởng." });
  }
});
```

to:

```js
app.put("/api/ideas", async (req, res) => {
  try {
    const { nodes, edges, groups, statuses, tags, nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, view } = req.body;
    await IdeaBoard.findOneAndUpdate(
      { singleton: "main" },
      { nodes, edges, groups, statuses, tags, nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, view },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không lưu được dữ liệu ý tưởng." });
  }
});
```

This step matters on its own: without it, saving the board from the client would silently drop any frame the user created (Mongoose only persists fields explicitly passed to `findOneAndUpdate`).

- [ ] **Step 4: Verify with the running dev server**

With `cd game-tools/server && npm run dev` running (auto-reloads on save):

```bash
curl -s http://localhost:3001/api/ideas -o /tmp/board-before.json
node -e "
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('/tmp/board-before.json', 'utf8'));
console.log('has groups array:', Array.isArray(b.groups));
console.log('has nextGroupId:', typeof b.nextGroupId === 'number');
"
```

Expected:
```
has groups array: true
has nextGroupId: true
```

Then confirm a round trip actually persists, and clean up afterwards so the user's real board isn't left with test data:

```bash
node -e "
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('/tmp/board-before.json', 'utf8'));
b.groups.push({ id: b.nextGroupId, title: 'Test Frame', x: 0, y: 0, w: 100, h: 100, color: null });
b.nextGroupId += 1;
fs.writeFileSync('/tmp/board-with-group.json', JSON.stringify(b));
"
curl -s -X PUT -H "Content-Type: application/json" -d @/tmp/board-with-group.json http://localhost:3001/api/ideas
curl -s http://localhost:3001/api/ideas | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log('group persisted:', d.groups.some((g) => g.title === 'Test Frame'));
"
curl -s -X PUT -H "Content-Type: application/json" -d @/tmp/board-before.json http://localhost:3001/api/ideas
```

Expected: `group persisted: true`, then the final `curl PUT` restores the board to its original state (verify with `curl -s http://localhost:3001/api/ideas | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).groups.length)"` → `0`, matching the count before this step).

- [ ] **Step 5: Commit**

```bash
git add game-tools/server/index.js
git commit -m "Persist idea-board groups and nextGroupId on the server"
```

---

### Task 3: Shared close-on-outside-click hook

**Files:**
- Create: `game-tools/client/src/lib/useCloseOnOutside.js`
- Modify: `game-tools/client/src/components/BadgeEditor.jsx`

**Interfaces:**
- Produces: `useCloseOnOutside(ref, onClose): void` — React hook; calls `onClose()` on a `mousedown` outside `ref.current` or on `Escape`.
- Consumes: nothing new. `BadgeEditor.jsx` is refactored to use it instead of its inline `useEffect`, so Task 4's `ColorMenu` can reuse the same behavior without duplicating it.

- [ ] **Step 1: Create the hook**

```js
// game-tools/client/src/lib/useCloseOnOutside.js
import { useEffect } from "react";

export function useCloseOnOutside(ref, onClose) {
  useEffect(() => {
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose]);
}
```

- [ ] **Step 2: Refactor `BadgeEditor.jsx` to use it**

Change the top of `game-tools/client/src/components/BadgeEditor.jsx` from:

```jsx
import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";

export default function BadgeEditor({ x, y, initialName, initialColor, submitLabel, onSubmit, onClose, onDelete }) {
  const { t } = useLingui();
  const [name, setName] = useState(initialName || "");
  const [color, setColor] = useState(initialColor || BADGE_PALETTE[0]);
  const ref = useRef(null);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
```

to:

```jsx
import { useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function BadgeEditor({ x, y, initialName, initialColor, submitLabel, onSubmit, onClose, onDelete }) {
  const { t } = useLingui();
  const [name, setName] = useState(initialName || "");
  const [color, setColor] = useState(initialColor || BADGE_PALETTE[0]);
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);
```

Leave the rest of the file (the `submit` function and the JSX return) unchanged.

- [ ] **Step 3: Manual verification**

With both dev servers running, open `http://localhost:5173/idea-map`, right-click any status or tag chip in the filter bar (opens `BadgeEditor`), confirm:
1. Clicking outside the popover closes it (unchanged behavior).
2. Pressing `Escape` closes it (unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add game-tools/client/src/lib/useCloseOnOutside.js game-tools/client/src/components/BadgeEditor.jsx
git commit -m "Extract close-on-outside-click into a shared hook"
```

---

### Task 4: Card color — right-click swatch popover

**Files:**
- Create: `game-tools/client/src/components/ColorMenu.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Produces:
  - `ColorMenu` component, props `{ x, y, color, onPick(color), onEdit?, onClose }` — renders a swatch grid (`BADGE_PALETTE` + a "no color" swatch) plus a **Sửa** button only when `onEdit` is passed (Task 6 reuses this component for frames without `onEdit`).
  - In `IdeaMap.jsx`: `colorMenu` state (`{ kind: "card"|"group", id, x, y } | null`), `openColorMenu(e, kind, id)`, `applyNodeColor(nodeId, color)`. Node objects gain a `color` field (nullable, a `BADGE_PALETTE` token).
- Consumes: `useCloseOnOutside` (Task 3), `BADGE_PALETTE`/`colorVar` (existing `lib/badges.js`).

- [ ] **Step 1: Create `ColorMenu`**

```jsx
// game-tools/client/src/components/ColorMenu.jsx
import { useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function ColorMenu({ x, y, color, onPick, onEdit, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);

  return (
    <div className="badge-editor" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="be-swatches">
        <button
          className={"be-swatch dot-empty" + (color == null ? " on" : "")}
          onClick={() => onPick(null)}
          title={t`Không màu`}
        />
        {BADGE_PALETTE.map((token) => (
          <button
            key={token}
            className={"be-swatch" + (token === color ? " on" : "")}
            style={{ background: colorVar(token) }}
            onClick={() => onPick(token)}
            title={token}
          />
        ))}
      </div>
      <div className="be-actions">
        {onEdit && <button className="save-btn" onClick={onEdit}><Trans>Sửa</Trans></button>}
        <button className="cancel-btn" onClick={onClose}><Trans>Đóng</Trans></button>
      </div>
    </div>
  );
}
```

(Reuses the existing `.badge-editor`/`.be-swatches`/`.be-swatch`/`.be-actions`/`.dot-empty` CSS classes already defined in `idea-map.css` — no new styles needed.)

- [ ] **Step 2: Wire state + handlers into `IdeaMap.jsx`**

Add the import near the top of `game-tools/client/src/pages/IdeaMap.jsx` (alongside the existing `BadgeEditor` import):

```js
import ColorMenu from "../components/ColorMenu.jsx";
```

Add state near the other `useState` declarations (next to `badgeUI`):

```js
const [colorMenu, setColorMenu] = useState(null); // { kind: "card"|"group", id, x, y }
```

Add handlers near `openBadgeMenu`/`openBadgeCreate`:

```js
function openColorMenu(e, kind, id) {
  e.preventDefault();
  e.stopPropagation();
  setColorMenu({ kind, id, x: e.clientX, y: e.clientY });
}

function applyNodeColor(nodeId, color) {
  commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)) });
  setColorMenu(null);
}
```

- [ ] **Step 3: Wire the card's right-click and color stripe**

`IdeaCard`'s function signature currently is:

```js
function IdeaCard({ node, board, editing, dimmed, linkPending, dropTarget, selected, onMouseDown, onClick, onConnectorMouseDown, onEdit, onDelete, onSave, onCancel }) {
```

Change it to accept `onContextMenu`:

```js
function IdeaCard({ node, board, editing, dimmed, linkPending, dropTarget, selected, onMouseDown, onClick, onContextMenu, onConnectorMouseDown, onEdit, onDelete, onSave, onCancel }) {
```

In the same function, the non-editing return currently starts:

```jsx
  return (
    <div
      className={classNames.join(" ")}
      data-id={node.id}
      style={{ left: node.x, top: node.y }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
```

Change to:

```jsx
  return (
    <div
      className={classNames.join(" ")}
      data-id={node.id}
      style={{
        left: node.x, top: node.y,
        ...(node.color ? { borderLeftColor: colorVar(node.color), borderLeftWidth: 4 } : {})
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
```

Then update the `<IdeaCard .../>` call site inside the main `return` of `IdeaMap` (in the `board.nodes.map(...)` block) to pass the new prop — add `onContextMenu={(e) => openColorMenu(e, "card", node.id)}` alongside the existing `onClick`/`onConnectorMouseDown`/etc props.

- [ ] **Step 4: Render the popover**

In the main `IdeaMap` return, right after the existing `{chipDrag && (...)}` block and before the `{badgeUI && ...}` blocks, add:

```jsx
{colorMenu && colorMenu.kind === "card" && (() => {
  const node = board.nodes.find((n) => n.id === colorMenu.id);
  if (!node) return null;
  return (
    <ColorMenu
      x={colorMenu.x}
      y={colorMenu.y}
      color={node.color ?? null}
      onPick={(color) => applyNodeColor(node.id, color)}
      onEdit={() => { setColorMenu(null); setEditingId(node.id); }}
      onClose={() => setColorMenu(null)}
    />
  );
})()}
```

- [ ] **Step 5: Manual verification**

With both dev servers running, open `http://localhost:5173/idea-map`:
1. Right-click a card → a swatch popover opens at the cursor (not the browser's native menu).
2. Click a color swatch → popover stays open, card immediately gets a colored left stripe (~4px), no page reload needed.
3. Right-click the same card again, click the "no color" swatch (dashed circle, leftmost) → stripe disappears.
4. Right-click a card, click **Sửa** → popover closes and the existing inline edit form opens (same as clicking the ✎ button).
5. Reload the page → the color stripe persists (confirms it saved to the server).
6. Click the ✎ button directly (not via right-click) → inline edit still opens as before (unchanged).

- [ ] **Step 6: Commit**

```bash
git add game-tools/client/src/components/ColorMenu.jsx game-tools/client/src/pages/IdeaMap.jsx
git commit -m "Add right-click color picker for idea cards"
```

---

### Task 5: Frame creation, drag-with-members, resize, rename, delete, color

**Files:**
- Create: `game-tools/client/src/components/FrameBox.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Produces:
  - `FrameBox` component, props `{ group, editingTitle, dropTarget, onMouseDown, onResizeMouseDown, onContextMenu, onTitleDoubleClick, onTitleSave, onTitleCancel, onDelete }` (connector props added in Task 7).
  - In `IdeaMap.jsx`: `createGroup()`, `handleGroupMouseDown(e, group)`, `handleGroupResizeMouseDown(e, group)`, `saveGroupTitle(groupId, title)`, `deleteGroup(id)` (edge cleanup added in Task 7), `applyGroupColor(groupId, color)`, `frameCardSize(nodeId): {w,h}`, `editingGroupTitleId` state.
  - `colorMenu` render block extended for `kind === "group"`.
- Consumes: `nodesInFrame` from `lib/board-geometry.js` (Task 1), `ColorMenu` (Task 4).

- [ ] **Step 1: Create `FrameBox` (no connectors yet — Task 7 adds them)**

```jsx
// game-tools/client/src/components/FrameBox.jsx
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { colorVar } from "../lib/badges.js";

export default function FrameBox({
  group, editingTitle, onMouseDown, onResizeMouseDown, onContextMenu,
  onTitleDoubleClick, onTitleSave, onTitleCancel, onDelete
}) {
  const { t } = useLingui();
  const [title, setTitle] = useState(group.title);

  useEffect(() => {
    if (editingTitle) setTitle(group.title);
  }, [editingTitle, group.title]);

  return (
    <div
      className="frame-box"
      data-group-id={group.id}
      style={{
        left: group.x, top: group.y, width: group.w, height: group.h,
        borderColor: group.color ? colorVar(group.color) : undefined
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      <button
        className="icon-btn frame-delete"
        title={t`Xoá khung`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        ×
      </button>
      {editingTitle ? (
        <input
          className="frame-title-input"
          autoFocus
          value={title}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onTitleSave(title)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onTitleSave(title);
            if (e.key === "Escape") onTitleCancel();
          }}
        />
      ) : (
        <span className="frame-title" onDoubleClick={() => onTitleDoubleClick()}>
          {group.title || t`Khung`}
        </span>
      )}
      <div
        className="frame-resize-handle"
        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add frame CSS**

Append to `game-tools/client/src/styles/idea-map.css`:

```css
.frame-box {
  position: absolute; border: 2px dashed var(--line); border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  cursor: grab;
}
.frame-box:active { cursor: grabbing; }
.frame-title {
  position: absolute; top: -13px; left: 10px; max-width: calc(100% - 44px);
  background: var(--bg); border: 1px solid var(--line); border-radius: 4px;
  padding: 1px 8px; font-size: 11px; color: var(--ink-dim); cursor: text;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.frame-title-input {
  position: absolute; top: -13px; left: 10px; width: 160px;
  background: var(--bg); border: 1px solid var(--accent); border-radius: 4px;
  padding: 1px 8px; font-size: 11px; color: var(--ink);
}
.frame-delete {
  position: absolute; top: -13px; right: 6px; background: var(--bg);
  border: 1px solid var(--line); border-radius: 50%; width: 20px; height: 20px;
}
.frame-resize-handle {
  position: absolute; right: -6px; bottom: -6px; width: 16px; height: 16px;
  border-radius: 3px; background: var(--surface); border: 1.5px solid var(--ink-dim);
  cursor: nwse-resize;
}
```

- [ ] **Step 3: Add group state + handlers to `IdeaMap.jsx`**

Add the import:

```js
import FrameBox from "../components/FrameBox.jsx";
import { nodesInFrame } from "../lib/board-geometry.js";
```

Add state next to `colorMenu`:

```js
const [editingGroupTitleId, setEditingGroupTitleId] = useState(null);
```

Add handlers near `handleAddClick`/`handleNodeMouseDown`:

```js
function frameCardSize(nodeId) {
  const card = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${nodeId}"]`);
  return { w: card ? card.offsetWidth : CARD_W, h: card ? card.offsetHeight : 110 };
}

function createGroup() {
  const rect = viewportRef.current.getBoundingClientRect();
  const w = 480, h = 320;
  const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
  const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
  const id = board.nextGroupId;
  const group = { id, title: t`Khung mới`, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, color: null };
  commitAndSave({ ...board, groups: [...board.groups, group], nextGroupId: id + 1 });
}

function handleGroupMouseDown(e, group) {
  if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
  if (e.button !== 0) return;
  e.stopPropagation();

  const startX = e.clientX, startY = e.clientY;
  const scale = board.view.scale;
  const boardBeforeDrag = board;
  const memberIds = nodesInFrame(board.nodes, group, frameCardSize);
  const startGroupPos = { x: group.x, y: group.y };
  const startNodePositions = new Map(
    memberIds.map((id) => {
      const n = board.nodes.find((nn) => nn.id === id);
      return [id, { x: n.x, y: n.y }];
    })
  );
  let latest = board;
  let moved = false;

  function onMove(ev) {
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
    setBoard((prev) => {
      const next = {
        ...prev,
        groups: prev.groups.map((g) => (g.id === group.id
          ? { ...g, x: Math.round(startGroupPos.x + dx), y: Math.round(startGroupPos.y + dy) }
          : g)),
        nodes: prev.nodes.map((n) => {
          const start = startNodePositions.get(n.id);
          if (!start) return n;
          return { ...n, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
        })
      };
      latest = next;
      return next;
    });
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (moved) recordHistory(boardBeforeDrag);
    saveNow(latest);
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function handleGroupResizeMouseDown(e, group) {
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const scale = board.view.scale;
  const boardBeforeDrag = board;
  const startW = group.w, startH = group.h;
  const MIN_W = 160, MIN_H = 120;
  let latest = board;
  let moved = false;

  function onMove(ev) {
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
    setBoard((prev) => {
      const next = {
        ...prev,
        groups: prev.groups.map((g) => (g.id === group.id
          ? { ...g, w: Math.max(MIN_W, Math.round(startW + dx)), h: Math.max(MIN_H, Math.round(startH + dy)) }
          : g))
      };
      latest = next;
      return next;
    });
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (moved) recordHistory(boardBeforeDrag);
    saveNow(latest);
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function saveGroupTitle(groupId, title) {
  setEditingGroupTitleId(null);
  commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, title: title.trim() || t`Khung` } : g)) });
}

function deleteGroup(id) {
  commitAndSave({ ...board, groups: board.groups.filter((g) => g.id !== id) });
}

function applyGroupColor(groupId, color) {
  commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, color } : g)) });
  setColorMenu(null);
}
```

- [ ] **Step 4: Fix JSON import to backfill `groups`/`nextGroupId`**

`handleImportConfirm` currently is:

```js
function handleImportConfirm() {
  try {
    const parsed = JSON.parse(ioText);
    if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
    commitAndSave(parsed);
    setIoOpen(false);
  } catch (e) {
    alert(t`JSON không hợp lệ — kiểm tra lại nội dung đã dán.`);
  }
}
```

Change to:

```js
function handleImportConfirm() {
  try {
    const parsed = JSON.parse(ioText);
    if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
    if (!Array.isArray(parsed.groups)) parsed.groups = [];
    if (typeof parsed.nextGroupId !== "number") parsed.nextGroupId = 1;
    commitAndSave(parsed);
    setIoOpen(false);
  } catch (e) {
    alert(t`JSON không hợp lệ — kiểm tra lại nội dung đã dán.`);
  }
}
```

(Without this, importing a JSON export made before this feature existed would crash on `board.groups.map` below.)

- [ ] **Step 5: Render frames and add the toolbar button**

In the topbar, right after the existing `<button className="btn" onClick={handleAddClick}><Trans>+ Ý tưởng</Trans></button>`, add:

```jsx
<button className="btn ghost" onClick={createGroup}><Trans>+ Khung</Trans></button>
```

Inside `.canvas`, insert the frame layer right before the existing `<svg className="edge-layer">` (so frames paint below both edges and cards):

```jsx
{board.groups.map((group) => (
  <FrameBox
    key={group.id}
    group={group}
    editingTitle={editingGroupTitleId === group.id}
    onMouseDown={(e) => handleGroupMouseDown(e, group)}
    onResizeMouseDown={(e) => handleGroupResizeMouseDown(e, group)}
    onContextMenu={(e) => openColorMenu(e, "group", group.id)}
    onTitleDoubleClick={() => setEditingGroupTitleId(group.id)}
    onTitleSave={(title) => saveGroupTitle(group.id, title)}
    onTitleCancel={() => setEditingGroupTitleId(null)}
    onDelete={() => deleteGroup(group.id)}
  />
))}
```

- [ ] **Step 6: Render the group color popover**

Right after the `{colorMenu && colorMenu.kind === "card" && ...}` block added in Task 4, add:

```jsx
{colorMenu && colorMenu.kind === "group" && (() => {
  const group = board.groups.find((g) => g.id === colorMenu.id);
  if (!group) return null;
  return (
    <ColorMenu
      x={colorMenu.x}
      y={colorMenu.y}
      color={group.color ?? null}
      onPick={(color) => applyGroupColor(group.id, color)}
      onClose={() => setColorMenu(null)}
    />
  );
})()}
```

- [ ] **Step 7: Manual verification**

With both dev servers running, open `http://localhost:5173/idea-map`:
1. Click **+ Khung** → a dashed rectangle appears centered in the viewport, titled "Khung mới".
2. Drag two existing cards fully inside the frame's rectangle.
3. Drag the frame by its border/body (not the title, delete button, or resize handle) → both cards move together with the frame. A third card left outside the frame does not move.
4. Drag the small handle at the frame's bottom-right corner → only the frame's size changes; the two cards inside stay put (may now poke outside the shrunk frame — expected).
5. Double-click the frame's title → it becomes an editable input; type a new name and press Enter → title updates and stays after clicking elsewhere.
6. Right-click the frame → a swatch popover opens (no "Sửa" button, unlike the card one); pick a color → the frame's border changes color.
7. Click the frame's `×` button → the frame disappears; both cards that were inside it remain exactly where they were.
8. Reload the page → recreate a frame with cards inside, reload again, confirm the frame position/size/title/color and card positions all persisted.

- [ ] **Step 8: Commit**

```bash
git add game-tools/client/src/components/FrameBox.jsx game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css
git commit -m "Add frame creation, drag-with-members, resize, rename, delete, and color"
```

---

### Task 6: Generalize connector-zone CSS for reuse on frames

**Files:**
- Modify: `game-tools/client/src/styles/idea-map.css:86-103`

**Interfaces:**
- Produces: bare `.connector-zone`/`.connector-dot` selectors usable by both `.idea-card` and `.frame-box` (previously scoped only to `.idea-card`).
- Consumes: nothing new.

- [ ] **Step 1: Rename the selectors**

Change:

```css
.idea-card .connector-zone {
  position: absolute; width: 46px; height: 46px;
  display: flex; align-items: center; justify-content: center;
  cursor: crosshair; z-index: 5;
}
.idea-card .connector-zone.top { top: -8px; left: 50%; transform: translate(-50%, -50%); }
.idea-card .connector-zone.right { top: 50%; left: calc(100% + 8px); transform: translate(-50%, -50%); }
.idea-card .connector-zone.bottom { top: calc(100% + 8px); left: 50%; transform: translate(-50%, -50%); }
.idea-card .connector-zone.left { top: 50%; left: -8px; transform: translate(-50%, -50%); }
.idea-card .connector-dot {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface); border: 1.5px solid var(--accent); color: var(--accent);
  font-size: 12px; font-weight: 700; line-height: 1;
  opacity: 0; transform: scale(0.8); transition: opacity 0.12s ease, transform 0.12s ease;
}
.idea-card .connector-zone:hover .connector-dot { opacity: 1; transform: scale(1); }
.idea-card.dim .connector-zone { display: none; }
```

to:

```css
.connector-zone {
  position: absolute; width: 46px; height: 46px;
  display: flex; align-items: center; justify-content: center;
  cursor: crosshair; z-index: 5;
}
.connector-zone.top { top: -8px; left: 50%; transform: translate(-50%, -50%); }
.connector-zone.right { top: 50%; left: calc(100% + 8px); transform: translate(-50%, -50%); }
.connector-zone.bottom { top: calc(100% + 8px); left: 50%; transform: translate(-50%, -50%); }
.connector-zone.left { top: 50%; left: -8px; transform: translate(-50%, -50%); }
.connector-dot {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface); border: 1.5px solid var(--accent); color: var(--accent);
  font-size: 12px; font-weight: 700; line-height: 1;
  opacity: 0; transform: scale(0.8); transition: opacity 0.12s ease, transform 0.12s ease;
}
.connector-zone:hover .connector-dot { opacity: 1; transform: scale(1); }
.idea-card.dim .connector-zone { display: none; }
```

Also add, right after `.frame-box:active { cursor: grabbing; }` (added in Task 5):

```css
.frame-box.drop-target { outline: 2px dashed var(--accent); outline-offset: 3px; }
```

- [ ] **Step 2: Manual verification**

Open `http://localhost:5173/idea-map`, hover a card → the four `+` connector dots at its edges still appear exactly as before (unchanged visuals, since the class names on `IdeaCard`'s JSX didn't change — only the CSS selector prefix did).

- [ ] **Step 3: Commit**

```bash
git add game-tools/client/src/styles/idea-map.css
git commit -m "Generalize connector-zone CSS so frames can reuse it"
```

---

### Task 7: Frame ↔ card edges

**Files:**
- Modify: `game-tools/client/src/components/FrameBox.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Produces:
  - `entityAtPoint(clientX, clientY): {id, kind} | null` — resolves whatever `.idea-card` or `.frame-box` is under a point.
  - `toggleEdge(a, aKind, b, bKind)` (generalized from the existing 2-arg `toggleEdge(a, b)`).
  - `handleGroupConnectorMouseDown(e, group)`.
  - `dropTargetId` state now holds `{ id, kind } | null` instead of a bare number.
  - `deleteGroup` (Task 5) extended to also drop edges referencing the deleted group.
  - `FrameBox` gains 4 connector-zone spans + a `dropTarget` prop.
- Consumes: `edgeEndpoint`, `edgesMatch` from `lib/board-geometry.js` (Task 1); `.connector-zone`/`.frame-box.drop-target` CSS (Task 6); `frameCardSize`, `deleteGroup` (Task 5).

- [ ] **Step 1: Add connector zones to `FrameBox`**

In `game-tools/client/src/components/FrameBox.jsx`, add `onConnectorMouseDown` and `dropTarget` to the destructured props:

```jsx
export default function FrameBox({
  group, editingTitle, dropTarget, onMouseDown, onResizeMouseDown, onContextMenu,
  onTitleDoubleClick, onTitleSave, onTitleCancel, onDelete, onConnectorMouseDown
}) {
```

Change the outer `<div className="frame-box" ...>` to include the drop-target class:

```jsx
    <div
      className={"frame-box" + (dropTarget ? " drop-target" : "")}
      data-group-id={group.id}
      style={{
        left: group.x, top: group.y, width: group.w, height: group.h,
        borderColor: group.color ? colorVar(group.color) : undefined
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
```

Add the four connector spans right before the closing `</div>` of the component (after `.frame-resize-handle`):

```jsx
      <span className="connector-zone top" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
      <span className="connector-zone right" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
      <span className="connector-zone bottom" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
      <span className="connector-zone left" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
```

- [ ] **Step 2: Add `entityAtPoint` and generalize `toggleEdge` in `IdeaMap.jsx`**

Add the import:

```js
import { nodesInFrame, edgeEndpoint, edgesMatch } from "../lib/board-geometry.js";
```

(replacing the Task-5 import of just `nodesInFrame` from the same module).

Add near the top of the component body (a plain helper, not inside another closure):

```js
function entityAtPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const card = el && el.closest(".idea-card");
  if (card) return { id: Number(card.getAttribute("data-id")), kind: "node" };
  const frame = el && el.closest(".frame-box");
  if (frame) return { id: Number(frame.getAttribute("data-group-id")), kind: "group" };
  return null;
}
```

Replace the existing `toggleEdge`:

```js
function toggleEdge(a, b) {
  const existing = board.edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  if (existing) {
    commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== existing.id) });
  } else {
    commitAndSave({ ...board, edges: [...board.edges, { id: board.nextEdgeId, from: a, to: b }], nextEdgeId: board.nextEdgeId + 1 });
  }
}
```

with:

```js
function toggleEdge(a, aKind, b, bKind) {
  const existing = board.edges.find((e) => edgesMatch(e, a, aKind, b, bKind));
  if (existing) {
    commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== existing.id) });
  } else {
    const edge = { id: board.nextEdgeId, from: a, fromKind: aKind, to: b, toKind: bKind };
    commitAndSave({ ...board, edges: [...board.edges, edge], nextEdgeId: board.nextEdgeId + 1 });
  }
}
```

Update the two existing call sites:

In `handleCardClick`, change `toggleEdge(pendingSource, node.id);` to `toggleEdge(pendingSource, "node", node.id, "node");`.

In `handleConnectorMouseDown`'s `onUp`, change `if (targetId !== null) toggleEdge(node.id, targetId);` to `if (targetId !== null) toggleEdge(node.id, "node", targetId, "node");` (this line moves inside the broader rewrite of `handleConnectorMouseDown` in the next step).

- [ ] **Step 3: Extend the card connector handler to also target frames**

Replace `handleConnectorMouseDown` entirely:

```js
function handleConnectorMouseDown(e, node, direction) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = viewportRef.current.getBoundingClientRect();
  const startX = e.clientX, startY = e.clientY;
  let dragging = false;
  const THRESHOLD = 5;

  function toCanvas(clientX, clientY) {
    const view = boardRef.current.view;
    return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
  }
  function targetAt(clientX, clientY) {
    const t = entityAtPoint(clientX, clientY);
    if (!t) return null;
    if (t.kind === "node" && t.id === node.id) return null;
    return t;
  }

  function onMove(ev) {
    if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
    if (!dragging) return;
    const p = toCanvas(ev.clientX, ev.clientY);
    setLinkDraft({ fromId: node.id, fromKind: "node", x: p.x, y: p.y });
    const t = targetAt(ev.clientX, ev.clientY);
    setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
  }
  function onUp(ev) {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (dragging) {
      setLinkDraft(null);
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(null);
      if (t) toggleEdge(node.id, "node", t.id, t.kind);
    } else {
      createLinkedNode(node.id, direction);
    }
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
```

- [ ] **Step 4: Add `handleGroupConnectorMouseDown`**

Add near `handleConnectorMouseDown`:

```js
function handleGroupConnectorMouseDown(e, group) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = viewportRef.current.getBoundingClientRect();

  function toCanvas(clientX, clientY) {
    const view = boardRef.current.view;
    return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
  }
  function targetAt(clientX, clientY) {
    const t = entityAtPoint(clientX, clientY);
    if (!t) return null;
    if (t.kind === "group" && t.id === group.id) return null;
    return t;
  }

  function onMove(ev) {
    const p = toCanvas(ev.clientX, ev.clientY);
    setLinkDraft({ fromId: group.id, fromKind: "group", x: p.x, y: p.y });
    const t = targetAt(ev.clientX, ev.clientY);
    setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
  }
  function onUp(ev) {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    setLinkDraft(null);
    setDropTargetId(null);
    const t = targetAt(ev.clientX, ev.clientY);
    if (t) toggleEdge(group.id, "group", t.id, t.kind);
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
```

Wire it into the `<FrameBox .../>` call site (added in Task 5) by adding a prop:

```jsx
onConnectorMouseDown={(e) => handleGroupConnectorMouseDown(e, group)}
```

and a `dropTarget` prop:

```jsx
dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
```

- [ ] **Step 5: Fix up the other two `dropTargetId` producers/consumers for the new `{id,kind}` shape**

In the `<IdeaCard .../>` call site, change `dropTarget={dropTargetId === node.id}` to:

```jsx
dropTarget={!!dropTargetId && dropTargetId.kind === "node" && dropTargetId.id === node.id}
```

In `handleChipMouseDown`'s `onMove`, change `setDropTargetId(targetCardIdAt(ev.clientX, ev.clientY));` to:

```js
const id = targetCardIdAt(ev.clientX, ev.clientY);
setDropTargetId(id != null ? { id, kind: "node" } : null);
```

(`handleChipMouseDown`'s `onUp` already just calls `setDropTargetId(null)`, which needs no change.)

- [ ] **Step 6: Resolve edge endpoints for both kinds in the SVG layer**

Replace the edge-rendering block inside `<svg className="edge-layer">`:

```jsx
{board.edges.map((edge) => {
  const a = board.nodes.find((n) => n.id === edge.from);
  const b = board.nodes.find((n) => n.id === edge.to);
  if (!a || !b) return null;
  const cardA = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${a.id}"]`);
  const cardB = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${b.id}"]`);
  const aw = cardA ? cardA.offsetWidth : CARD_W, ah = cardA ? cardA.offsetHeight : 100;
  const bw = cardB ? cardB.offsetWidth : CARD_W, bh = cardB ? cardB.offsetHeight : 100;
  const x1 = a.x + aw / 2, y1 = a.y + ah / 2;
  const x2 = b.x + bw / 2, y2 = b.y + bh / 2;
  return (
    <g key={edge.id}>
      <line
        className="hit"
        x1={x1} y1={y1} x2={x2} y2={y2}
        onClick={() => commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== edge.id) })}
      />
      <line className="visible" x1={x1} y1={y1} x2={x2} y2={y2} />
    </g>
  );
})}
```

with:

```jsx
{board.edges.map((edge) => {
  const p1 = edgeEndpoint(edge.fromKind || "node", edge.from, board.nodes, board.groups, frameCardSize);
  const p2 = edgeEndpoint(edge.toKind || "node", edge.to, board.nodes, board.groups, frameCardSize);
  if (!p1 || !p2) return null;
  return (
    <g key={edge.id}>
      <line
        className="hit"
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        onClick={() => commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== edge.id) })}
      />
      <line className="visible" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
    </g>
  );
})}
```

And replace the draft-line block right after it:

```jsx
{linkDraft && (() => {
  const a = board.nodes.find((n) => n.id === linkDraft.fromId);
  if (!a) return null;
  const cardA = canvasRef.current && canvasRef.current.querySelector(`.idea-card[data-id="${a.id}"]`);
  const aw = cardA ? cardA.offsetWidth : CARD_W, ah = cardA ? cardA.offsetHeight : 100;
  return <line className="draft" x1={a.x + aw / 2} y1={a.y + ah / 2} x2={linkDraft.x} y2={linkDraft.y} />;
})()}
```

with:

```jsx
{linkDraft && (() => {
  const from = edgeEndpoint(linkDraft.fromKind || "node", linkDraft.fromId, board.nodes, board.groups, frameCardSize);
  if (!from) return null;
  return <line className="draft" x1={from.x} y1={from.y} x2={linkDraft.x} y2={linkDraft.y} />;
})()}
```

- [ ] **Step 7: Clean up a group's edges when it's deleted**

Replace the `deleteGroup` added in Task 5:

```js
function deleteGroup(id) {
  commitAndSave({ ...board, groups: board.groups.filter((g) => g.id !== id) });
}
```

with:

```js
function deleteGroup(id) {
  commitAndSave({
    ...board,
    groups: board.groups.filter((g) => g.id !== id),
    edges: board.edges.filter((e) => !(
      (e.from === id && (e.fromKind || "node") === "group") ||
      (e.to === id && (e.toKind || "node") === "group")
    ))
  });
}
```

- [ ] **Step 8: Run the Task 1 tests again**

Run: `node --test game-tools/client/src/lib/board-geometry.test.js`
Expected: PASS — 5 tests, 0 failures (confirms this task's wiring didn't require touching the pure helpers; a failure here would mean a signature mismatch between what `IdeaMap.jsx` now calls and what Task 1 produced).

- [ ] **Step 9: Manual verification**

With both dev servers running, open `http://localhost:5173/idea-map` (with at least one frame and a card outside it, from Task 5's verification):
1. Hover a frame's border → four `+` connector dots appear, same as on a card.
2. Drag from one of the frame's connector dots to a card outside the frame → a line is drawn between the frame and the card on mouse-up; the frame's `drop-target` dashed outline appears while hovering the card mid-drag.
3. Reload the page → the frame↔card edge is still there.
4. Click that edge's line → it's deleted (line disappears, confirm by reload it stays gone).
5. Now drag from a **card's** connector dot onto a **frame** → this also creates an edge (confirms the reverse direction works, not just frame→card).
6. Create two frames, drag from one frame's connector to the other → a frame↔frame edge is created and renders correctly.
7. Delete a frame that has an edge to a card → the edge disappears along with the frame; the card itself is untouched.
8. Sanity-check nothing on cards broke: click-drag from a card's connector dot to empty space with no target under the cursor → releasing creates nothing (unchanged); a plain click (no drag) on a card's connector dot still creates a new linked card in that direction (unchanged, existing `createLinkedNode` behavior).

- [ ] **Step 10: Commit**

```bash
git add game-tools/client/src/components/FrameBox.jsx game-tools/client/src/pages/IdeaMap.jsx
git commit -m "Connect frames to cards and other frames with edges"
```

---

### Task 8: Group selected cards into a new frame

**Files:**
- Modify: `game-tools/client/src/components/ColorMenu.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Consumes: `frameCardSize(nodeId)` (Task 5), `selectedIds` state (existing), `colorMenu` state + card render block (Task 4), `createGroup`-style group construction (Task 5).
- Produces: `ColorMenu` gains an optional `onGroup` prop (button labeled "Gom nhóm", rendered only when passed); `groupSelectedCards()` in `IdeaMap.jsx`.

- [ ] **Step 1: Add optional `onGroup` action to `ColorMenu`**

In `game-tools/client/src/components/ColorMenu.jsx`, change the signature:

```jsx
export default function ColorMenu({ x, y, color, onPick, onEdit, onGroup, onClose }) {
```

and in the `be-actions` div, add the button before the `onEdit` one:

```jsx
      <div className="be-actions">
        {onGroup && <button className="save-btn" onClick={onGroup}><Trans>Gom nhóm</Trans></button>}
        {onEdit && <button className="save-btn" onClick={onEdit}><Trans>Sửa</Trans></button>}
        <button className="cancel-btn" onClick={onClose}><Trans>Đóng</Trans></button>
      </div>
```

- [ ] **Step 2: Add `groupSelectedCards` to `IdeaMap.jsx`**

Add near `createGroup` (Task 5):

```js
function groupSelectedCards() {
  const PAD = 28, TITLE_ROOM = 20;
  const ids = Array.from(selectedIds);
  if (ids.length < 2) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  ids.forEach((id) => {
    const n = board.nodes.find((nn) => nn.id === id);
    if (!n) return;
    const { w, h } = frameCardSize(id);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  });
  if (minX === Infinity) return;
  const id = board.nextGroupId;
  const group = {
    id, title: t`Khung mới`, color: null,
    x: Math.round(minX - PAD), y: Math.round(minY - PAD - TITLE_ROOM),
    w: Math.round(maxX - minX + PAD * 2), h: Math.round(maxY - minY + PAD * 2 + TITLE_ROOM)
  };
  setColorMenu(null);
  commitAndSave({ ...board, groups: [...board.groups, group], nextGroupId: id + 1 });
}
```

- [ ] **Step 3: Pass `onGroup` from the card color popover only for multi-selection**

In the `{colorMenu && colorMenu.kind === "card" && ...}` render block (Task 4), add to the `<ColorMenu ...>` props:

```jsx
onGroup={selectedIds.size >= 2 && selectedIds.has(node.id) ? groupSelectedCards : undefined}
```

- [ ] **Step 4: lingui extract + build**

Run: `cd game-tools/client && npx lingui extract && npm run build`
Expected: 1 new msgid ("Gom nhóm"), build passes. Commit .po changes with the code.

- [ ] **Step 5: Manual verification**

1. Marquee-select 3 cards → right-click one of them → popover shows a "Gom nhóm" button.
2. Click it → a new frame appears snugly around the 3 cards (padding ~28px, extra room at top for the title); cards did not move; popover closed.
3. Drag the new frame → the 3 cards move with it (membership is geometric — confirms the fit is correct).
4. Right-click a card NOT in the selection → no "Gom nhóm" button.
5. Select only 1 card → right-click it → no "Gom nhóm" button.

- [ ] **Step 6: Commit**

```bash
git add game-tools/client/src/components/ColorMenu.jsx game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/locales
git commit -m "Group selected cards into a new frame from the right-click menu"
```

---

## Self-Review Notes

- **Spec coverage:** khung bao quanh + kéo card vào (Task 5), khung kéo-theo-card (Task 5 step 3 drag), khung nối edge với card ngoài (Task 7), card color qua chuột phải + vẫn giữ nút Sửa (Task 4) — all covered.
- **Corrected while planning:** the spec's "khung không chặn pointer-event ở vùng giữa" line would, if implemented literally as `pointer-events: none` on the frame body, make it impossible to drag the frame by its body — contradicting the same spec's drag requirement. Resolved by NOT setting `pointer-events: none` anywhere: since cards render after frames in the DOM (Task 5 Step 5 renders frames before the edge layer, cards render last), cards naturally receive clicks over any frame beneath them via normal browser stacking — no `pointer-events` trick needed, and the frame body stays draggable.
- **Id-collision fix folded into Task 7:** nodes and groups have independent id counters (`nextNodeId` vs `nextGroupId`), so a node and a group can share the same numeric id. `dropTargetId` and edge matching both had to carry `kind` alongside `id` from the start of Task 7 to avoid a card and an unrelated frame highlighting together, or an edge accidentally matching the wrong entity.
