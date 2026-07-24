# Idea Map Wave 1 — Canvas Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the idea-map canvas *move* like Figma/Miro/Excalidraw: clipped arrows, a full keyboard suite, alt-drag duplicate, snapping with guides, keyboard quick-create, focus mode, and bulk property editing.

**Architecture:** All client-side; zero server/schema changes (nodes/edges/groups already round-trip freely). Pure geometry goes in `lib/board-geometry.js` (extend) and new `lib/snap.js`, both covered by `node --test`. Everything else wires into `IdeaMap.jsx`'s existing state machinery (`commitAndSave`, `recordHistory`, `saveNow`/`saveDebounced`, `selectedIds`, `boardRef`, the single global keydown effect).

**Tech Stack:** React 18 + Vite, lingui i18n (vi default, en catalog), Node built-in test runner for pure helpers. No new npm dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-idea-map-wave1-canvas-feel-design.md`.
- No new npm dependencies. No server changes.
- All new user-facing strings wrapped in lingui (`<Trans>`/`` t`...` ``); run `npx lingui extract` in `game-tools/client` after UI-string changes and commit .po updates in the same commit; fill en msgstr (see existing entries for style).
- Keyboard handlers must ignore events when typing: `const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;` — same guard the existing handler uses, extended with contentEditable.
- Nodes and groups have independent id counters — any id crossing node/group boundaries carries `kind` (established invariant; edges use `fromKind`/`toKind` with `"node"` default).
- Undo semantics: every discrete user action = exactly one `recordHistory` entry (drags record once on mouseup only if moved; nudge bursts record once per burst).
- Verify commands: `node --test game-tools/client/src/lib/*.test.js` (from repo root) and `cd game-tools/client && npm run build`. Dev servers already run on :3001/:5173 with hot reload — do NOT start new ones; browser click-testing is the controller's job.
- Commit style: short imperative sentence, no prefix.
- Implementers MUST Read the current `IdeaMap.jsx` around each anchor before editing — line numbers in this plan are approximate; the named symbols are the real anchors.

---

### Task 1: Edge clipping + arrowheads

**Files:**
- Modify: `game-tools/client/src/lib/board-geometry.js`
- Modify: `game-tools/client/src/lib/board-geometry.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (edge-layer SVG block, ~line 1006)
- Modify: `game-tools/client/src/styles/idea-map.css` (edge-layer rules)

**Interfaces:**
- Consumes: `edgeEndpoint(kind, id, nodes, groups, sizeOf)` (existing — returns center `{x,y}`); the edge render block already maps `board.edges` resolving `p1`/`p2` via `edgeEndpoint`.
- Produces: `clipToRect(cx, cy, w, h, tx, ty): {x,y}` — the point where the segment from rect-center `(cx,cy)` toward `(tx,ty)` crosses the boundary of the axis-aligned rect of width `w`/height `h` centered at `(cx,cy)`. Also `rectForEndpoint(kind, id, nodes, groups, sizeOf): {cx, cy, w, h} | null`.

- [ ] **Step 1: Write failing tests**

Append to `game-tools/client/src/lib/board-geometry.test.js`:

```js
import { clipToRect, rectForEndpoint } from "./board-geometry.js";

test("clipToRect: cắt đúng biên phải khi đích nằm ngang bên phải", () => {
  // rect tâm (0,0) rộng 100 cao 50; đích (200, 0) → giao tại (50, 0)
  assert.deepEqual(clipToRect(0, 0, 100, 50, 200, 0), { x: 50, y: 0 });
});

test("clipToRect: cắt biên dưới khi đích thẳng đứng bên dưới", () => {
  assert.deepEqual(clipToRect(0, 0, 100, 50, 0, 200), { x: 0, y: 25 });
});

test("clipToRect: đường chéo cắt cạnh gần hơn", () => {
  // đích (100, 100): t theo x = 50/100, theo y = 25/100 → y chạm trước → giao (25, 25)
  assert.deepEqual(clipToRect(0, 0, 100, 50, 100, 100), { x: 25, y: 25 });
});

test("clipToRect: đích trùng tâm trả về tâm (không chia 0)", () => {
  assert.deepEqual(clipToRect(0, 0, 100, 50, 0, 0), { x: 0, y: 0 });
});

test("rectForEndpoint: node dùng sizeOf, group dùng w/h, null khi không thấy", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }];
  const groups = [{ id: 1, x: 100, y: 100, w: 50, h: 50 }];
  const sizeOf = () => ({ w: 20, h: 20 });
  assert.deepEqual(rectForEndpoint("node", 1, nodes, groups, sizeOf), { cx: 10, cy: 10, w: 20, h: 20 });
  assert.deepEqual(rectForEndpoint("group", 1, nodes, groups, sizeOf), { cx: 125, cy: 125, w: 50, h: 50 });
  assert.equal(rectForEndpoint("node", 99, nodes, groups, sizeOf), null);
});
```

- [ ] **Step 2: Run tests, expect the new ones to FAIL** (`clipToRect is not a function`)

- [ ] **Step 3: Implement in `board-geometry.js`**

```js
export function clipToRect(cx, cy, w, h, tx, ty) {
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tCandidates = [];
  if (dx !== 0) tCandidates.push((w / 2) / Math.abs(dx));
  if (dy !== 0) tCandidates.push((h / 2) / Math.abs(dy));
  const t = Math.min(...tCandidates);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function rectForEndpoint(kind, id, nodes, groups, sizeOf) {
  if (kind === "group") {
    const g = groups.find((gr) => gr.id === id);
    return g ? { cx: g.x + g.w / 2, cy: g.y + g.h / 2, w: g.w, h: g.h } : null;
  }
  const n = nodes.find((nn) => nn.id === id);
  if (!n) return null;
  const { w, h } = sizeOf(id);
  return { cx: n.x + w / 2, cy: n.y + h / 2, w, h };
}
```

- [ ] **Step 4: Run tests → all pass (10/10)**

- [ ] **Step 5: Wire into the edge render**

In `IdeaMap.jsx`, import `rectForEndpoint, clipToRect` (extend the existing board-geometry import). In the `<svg className="edge-layer">` block, add a `<defs>` right after the opening tag:

```jsx
<defs>
  <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-dim)" />
  </marker>
</defs>
```

Replace the per-edge endpoint resolution: instead of `edgeEndpoint(...)` for `p1`/`p2`, resolve `r1 = rectForEndpoint(edge.fromKind || "node", edge.from, board.nodes, board.groups, frameCardSize)` and `r2` likewise; `if (!r1 || !r2) return null;` then:

```js
const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
```

and add `markerEnd="url(#edge-arrow)"` to the `.visible` line only (hit line unchanged). Leave the linkDraft block as-is (center-to-cursor is correct while dragging).

In `idea-map.css`, raise `.edge-layer .visible` opacity from 0.6 to 0.75 (arrowheads read badly at 0.6; keep stroke color unchanged).

- [ ] **Step 6: Build passes; commit**

```bash
git add game-tools/client/src/lib/board-geometry.js game-tools/client/src/lib/board-geometry.test.js game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css
git commit -m "Clip edges to card boundaries and add arrowheads"
```

---

### Task 2: Keyboard suite

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Consumes: existing `deleteNode`-style kind-aware edge filter, `createNode`, `handleAddClick` math, `fitToView` math, `startPan`, `handleViewportMouseDown`, `selectedIds`, `commitAndSave`, `recordHistory`, `saveDebounced`, `boardRef`.
- Produces (used by Task 3): `duplicateNodes(ids: number[], offset = 24): {next, cloneIds}` — pure-ish helper returning the next board state with clones + their new ids (does NOT commit; callers decide). Also `deleteSelection()`, `zoomToSelection()`, `nudgeSelection(dx, dy)`; `spacePanRef`.

- [ ] **Step 1: Add `duplicateNodes` helper** (near `groupSelectedCards`)

```js
function duplicateNodes(ids, offset = 24) {
  let nextId = board.nextNodeId;
  const idMap = new Map();
  const clones = [];
  ids.forEach((id) => {
    const n = board.nodes.find((nn) => nn.id === id);
    if (!n) return;
    idMap.set(id, nextId);
    clones.push({ ...n, id: nextId, x: n.x + offset, y: n.y + offset });
    nextId++;
  });
  let nextEdgeId = board.nextEdgeId;
  const clonedEdges = [];
  board.edges.forEach((e) => {
    if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
    if (idMap.has(e.from) && idMap.has(e.to)) {
      clonedEdges.push({ ...e, id: nextEdgeId++, from: idMap.get(e.from), to: idMap.get(e.to) });
    }
  });
  return {
    next: {
      ...board,
      nodes: [...board.nodes, ...clones],
      edges: [...board.edges, ...clonedEdges],
      nextNodeId: nextId,
      nextEdgeId
    },
    cloneIds: Array.from(idMap.values())
  };
}
```

- [ ] **Step 2: Add the action helpers**

```js
function deleteSelection() {
  const ids = selectedIds;
  if (ids.size === 0) return;
  commitAndSave({
    ...board,
    nodes: board.nodes.filter((n) => !ids.has(n.id)),
    edges: board.edges.filter((e) => !(
      (ids.has(e.from) && (e.fromKind || "node") === "node") ||
      (ids.has(e.to) && (e.toKind || "node") === "node")
    ))
  });
  setSelectedIds(new Set());
}

function duplicateSelection() {
  if (selectedIds.size === 0) return;
  const { next, cloneIds } = duplicateNodes(Array.from(selectedIds));
  commitAndSave(next);
  setSelectedIds(new Set(cloneIds));
}

function zoomToSelection() {
  const targets = selectedIds.size > 0
    ? board.nodes.filter((n) => selectedIds.has(n.id))
    : board.nodes;
  if (targets.length === 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  targets.forEach((n) => {
    const { w, h } = frameCardSize(n.id);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  });
  const rect = viewportRef.current.getBoundingClientRect();
  const pad = 60;
  const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
  let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
  scale = Math.max(scale, MIN_SCALE);
  commitAndSave({
    ...board,
    view: {
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    }
  }, { historical: false });
}
```

(`zoomToSelection` deliberately mirrors `fitToView`'s math — read that function first and keep the two consistent.)

- [ ] **Step 3: Nudge with burst history**

Add refs near the other refs: `const nudgeTimerRef = useRef(null);` and `const nudgeBaseRef = useRef(null);`

```js
function nudgeSelection(dx, dy) {
  if (selectedIds.size === 0) return;
  if (nudgeBaseRef.current == null) {
    nudgeBaseRef.current = board;   // history recorded once per burst, at burst end
  }
  const next = {
    ...board,
    nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n))
  };
  setBoard(next);
  saveDebounced(next);
  if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
  nudgeTimerRef.current = setTimeout(() => {
    recordHistory(nudgeBaseRef.current);
    nudgeBaseRef.current = null;
  }, 600);
}
```

- [ ] **Step 4: Space-pan**

Add `const spacePanRef = useRef(false);` and a mount-once effect:

```js
useEffect(() => {
  function down(e) {
    if (e.code !== "Space") return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    e.preventDefault();            // chặn page scroll
    spacePanRef.current = true;
  }
  function up(e) { if (e.code === "Space") spacePanRef.current = false; }
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
}, []);
```

In `handleViewportMouseDown`, before the marquee branch: `if (e.button === 0 && spacePanRef.current) { startPan(e); return; }`. Also in `handleNodeMouseDown` and `handleGroupMouseDown`, at the top (after the button-2 branch): `if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }` so space-drag pans even when the cursor is over a card/frame.

- [ ] **Step 5: Extend the global keydown handler**

Replace the existing keydown effect body (keep the effect structure and deps, adding `selectedIds`):

```js
useEffect(() => {
  function onKeyDown(e) {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    const key = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (key === "z") { e.preventDefault(); undo(); }
      else if (key === "y") { e.preventDefault(); redo(); }
      else if (key === "d") { e.preventDefault(); duplicateSelection(); }
      return;
    }
    if (key === "delete" || key === "backspace") { e.preventDefault(); deleteSelection(); }
    else if (key === "escape") {
      if (colorMenu) setColorMenu(null);
      else if (badgeUI) setBadgeUI(null);
      else if (linkMode) { setLinkMode(false); setPendingSource(null); }
      else if (selectedIds.size > 0) setSelectedIds(new Set());
    }
    else if (key === "n") { e.preventDefault(); handleAddClick(); }
    else if (key === "f") { e.preventDefault(); zoomToSelection(); }
    else if (key === "arrowleft") { e.preventDefault(); nudgeSelection(e.shiftKey ? -10 : -1, 0); }
    else if (key === "arrowright") { e.preventDefault(); nudgeSelection(e.shiftKey ? 10 : 1, 0); }
    else if (key === "arrowup") { e.preventDefault(); nudgeSelection(0, e.shiftKey ? -10 : -1); }
    else if (key === "arrowdown") { e.preventDefault(); nudgeSelection(0, e.shiftKey ? 10 : 1); }
  }
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [board, past, future, selectedIds, linkMode, colorMenu, badgeUI]);
```

(Note: `deleteNode` still exists for the per-card × button — do not remove it. Escape's focus-mode branch is added in Task 6.)

- [ ] **Step 6: Build passes; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx
git commit -m "Add keyboard suite: delete, duplicate, nudge, zoom-to-selection, space-pan"
```

---

### Task 3: Alt-drag duplicate + popover actions

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/components/ColorMenu.jsx`

**Interfaces:**
- Consumes: `duplicateNodes` (Task 2), `deleteNode`, the card `ColorMenu` render block, `handleNodeMouseDown`.
- Produces: `ColorMenu` gains optional `onDuplicate` and `onDelete` props.

- [ ] **Step 1: Alt-drag in `handleNodeMouseDown`**

Read the current function first. After the early-return guards and BEFORE computing `groupIds`, insert: if `e.altKey`, determine the ids to clone (`selectedIds.has(node.id) && selectedIds.size > 1 ? Array.from(selectedIds) : [node.id]`), call `duplicateNodes(cloneSourceIds, 0)` (offset 0 — clones start exactly under the originals), then:

```js
const boardBeforeDrag = board;                 // history base = trước khi có bản sao
setBoard(dup.next);
boardRef.current = dup.next;
setSelectedIds(new Set(dup.cloneIds));
```

and make the drag operate on `dup.cloneIds` against `dup.next` (start positions read from `dup.next.nodes`). On `onUp`: if `moved`, `recordHistory(boardBeforeDrag)` + `saveNow(latest)` (existing pattern); if NOT moved (alt-click without drag), roll back by `setBoard(boardBeforeDrag)` so a plain alt-click doesn't silently duplicate in place. The non-alt path stays byte-identical — restructure carefully so both paths share the move/up closures (parameterize `startPositions` and the base board instead of duplicating the whole handler).

- [ ] **Step 2: Popover buttons**

`ColorMenu.jsx`: add optional `onDuplicate`, `onDelete` props; in `be-actions`, render (order: Gom nhóm, Nhân bản, Sửa, Xoá, Đóng):

```jsx
{onDuplicate && <button className="save-btn" onClick={onDuplicate}><Trans>Nhân bản</Trans></button>}
...
{onDelete && <button className="be-delete" onClick={onDelete} title={t`Xoá thẻ`}>🗑</button>}
```

(`.be-delete` CSS already exists scoped under `.badge-editor .be-actions`.) In the card ColorMenu render block in `IdeaMap.jsx`, pass:

```jsx
onDuplicate={() => { setColorMenu(null); const { next, cloneIds } = duplicateNodes([node.id]); commitAndSave(next); setSelectedIds(new Set(cloneIds)); }}
onDelete={() => { setColorMenu(null); deleteNode(node.id); }}
```

Do NOT pass these to the group ColorMenu block.

- [ ] **Step 3: lingui extract (new strings "Nhân bản", "Xoá thẻ" — en: "Duplicate", "Delete card"); build passes; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/components/ColorMenu.jsx game-tools/client/src/locales
git commit -m "Add alt-drag duplicate and duplicate/delete popover actions"
```

---

### Task 4: Snapping + alignment guides

**Files:**
- Create: `game-tools/client/src/lib/snap.js`
- Create: `game-tools/client/src/lib/snap.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Produces: `computeSnap(movingRect, otherRects, threshold): { dx, dy, guides }` — `movingRect`/`otherRects` are `{x, y, w, h}`; returns the correction `{dx, dy}` to apply (0 when no snap) and `guides` as an array of `{ axis: "v"|"h", pos, start, end }` line segments in canvas coordinates for rendering.
- Consumes: card drag `onMove` in `handleNodeMouseDown`, group drag `onMove` in `handleGroupMouseDown`.

- [ ] **Step 1: Write failing tests** (`snap.test.js`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSnap } from "./snap.js";

test("hút mép trái vào mép trái đối tượng khác trong ngưỡng", () => {
  const moving = { x: 103, y: 0, w: 50, h: 50 };
  const others = [{ x: 100, y: 200, w: 50, h: 50 }];
  const r = computeSnap(moving, others, 6);
  assert.equal(r.dx, -3);
  assert.equal(r.guides.some((g) => g.axis === "v" && g.pos === 100), true);
});

test("hút tâm-với-tâm theo trục dọc", () => {
  const moving = { x: 0, y: 104, w: 50, h: 50 };   // tâm y = 129
  const others = [{ x: 200, y: 100, w: 50, h: 58 }]; // tâm y = 129 khi moving.y = 104? -> tính: 100+29=129; moving tâm 104+25=129 ✓ đã khớp
  const r0 = computeSnap(moving, others, 6);
  assert.equal(r0.dy, 0); // đã thẳng hàng thì không chỉnh
  const moving2 = { x: 0, y: 107, w: 50, h: 50 };  // tâm 132, lệch 3
  const r = computeSnap(moving2, others, 6);
  assert.equal(r.dy, -3);
});

test("ngoài ngưỡng thì không hút", () => {
  const r = computeSnap({ x: 110, y: 0, w: 50, h: 50 }, [{ x: 100, y: 200, w: 50, h: 50 }], 6);
  assert.equal(r.dx, 0);
  assert.equal(r.dy, 0);
  assert.equal(r.guides.length, 0);
});

test("chọn ứng viên gần nhất trên mỗi trục", () => {
  const moving = { x: 105, y: 0, w: 50, h: 50 };
  const others = [
    { x: 100, y: 200, w: 50, h: 50 },  // lệch 5
    { x: 104, y: 300, w: 50, h: 50 }   // lệch 1 → thắng
  ];
  const r = computeSnap(moving, others, 6);
  assert.equal(r.dx, -1);
});
```

- [ ] **Step 2: Run → FAIL. Step 3: Implement `snap.js`**

```js
// Ứng viên mỗi trục: trái/giữa/phải (dọc) và trên/giữa/dưới (ngang) của bbox đang kéo
// so với cùng bộ mốc của mọi bbox khác. Trong ngưỡng → chỉnh theo ứng viên lệch ít nhất.
function anchors1D(pos, size) { return [pos, pos + size / 2, pos + size]; }

export function computeSnap(moving, others, threshold) {
  let best = { v: null, h: null };
  const mv = anchors1D(moving.x, moving.w);
  const mh = anchors1D(moving.y, moving.h);
  others.forEach((o) => {
    anchors1D(o.x, o.w).forEach((op) => {
      mv.forEach((mp) => {
        const d = op - mp;
        if (Math.abs(d) <= threshold && (best.v == null || Math.abs(d) < Math.abs(best.v.d))) {
          best.v = { d, pos: op, other: o };
        }
      });
    });
    anchors1D(o.y, o.h).forEach((op) => {
      mh.forEach((mp) => {
        const d = op - mp;
        if (Math.abs(d) <= threshold && (best.h == null || Math.abs(d) < Math.abs(best.h.d))) {
          best.h = { d, pos: op, other: o };
        }
      });
    });
  });
  const guides = [];
  if (best.v && best.v.d !== 0) {
    guides.push({
      axis: "v", pos: best.v.pos,
      start: Math.min(moving.y, best.v.other.y),
      end: Math.max(moving.y + moving.h, best.v.other.y + best.v.other.h)
    });
  }
  if (best.h && best.h.d !== 0) {
    guides.push({
      axis: "h", pos: best.h.pos,
      start: Math.min(moving.x, best.h.other.x),
      end: Math.max(moving.x + moving.w, best.h.other.x + best.h.other.w)
    });
  }
  // d === 0 (đã khớp) → không chỉnh, không vẽ guide (tránh guide nhấp nháy khi đứng yên)
  return { dx: best.v && best.v.d !== 0 ? best.v.d : 0, dy: best.h && best.h.d !== 0 ? best.h.d : 0, guides };
}
```

NOTE for implementer: the second test asserts aligned-already → `dy: 0`; the guide push is skipped for `d === 0` — if the test disagrees with the code, the TEST is the contract; reconcile the implementation.

- [ ] **Step 4: Run → PASS. Step 5: Integrate into drags**

In `IdeaMap.jsx`: `const [snapGuides, setSnapGuides] = useState([]);` and import `computeSnap`.

In `handleNodeMouseDown`'s `onMove` (both normal and alt-drag paths — they share the closure after Task 3), after computing raw `dx`/`dy` and BEFORE `setBoard`: build `movingRect` as the bbox of all dragged cards at their prospective positions (min x/y, max x+w/y+h via `frameCardSize`), build `otherRects` from all non-dragged cards and all groups, then unless `ev.altKey`:

```js
const snap = computeSnap(movingRect, otherRects, 6 / scale);
dx += snap.dx; dy += snap.dy;
setSnapGuides(snap.guides);
```

(`ev.altKey` disables snap live during the drag; when disabled, `setSnapGuides([])`.) In `onUp`: `setSnapGuides([])`.

Same integration in `handleGroupMouseDown`'s `onMove` (movingRect = the frame rect + its member cards' bbox at prospective position; others = non-member cards + other groups).

Render the guides inside the edge-layer SVG (after the edges, before linkDraft):

```jsx
{snapGuides.map((g, i) => g.axis === "v"
  ? <line key={i} className="snap-guide" x1={g.pos} y1={g.start} x2={g.pos} y2={g.end} />
  : <line key={i} className="snap-guide" x1={g.start} y1={g.pos} x2={g.end} y2={g.pos} />)}
```

CSS: `.edge-layer .snap-guide { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 4 3; pointer-events: none; }`

- [ ] **Step 6: Build passes; run all lib tests (both files) — pass; commit**

```bash
git add game-tools/client/src/lib/snap.js game-tools/client/src/lib/snap.test.js game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css
git commit -m "Snap dragged cards and frames to neighbors with alignment guides"
```

---

### Task 5: Quick-create from the edit form

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Consumes: `saveNodeEdit(id, fields)`, `createLinkedNode(sourceId, direction)` (already sets `editingId` to the new card), `IdeaCard`'s edit-form JSX (title input + desc textarea + selects).
- Produces: `IdeaCard` gains optional `onSaveAndNext(fields)` prop.

- [ ] **Step 1: Parent handler** (near `saveNodeEdit`)

```js
function saveNodeEditAndNext(id, fields) {
  saveNodeEdit(id, fields);          // commit 1: lưu nội dung
  createLinkedNode(id, "right");     // commit 2: card mới + edge, editingId chuyển sang card mới
}
```

(Two history entries — acceptable: mỗi bước là một hành động hoàn chỉnh, Ctrl+Z lùi từng nấc tự nhiên.)

- [ ] **Step 2: Wire into the edit form**

`IdeaCard` signature gains `onSaveAndNext`. In the editing return block, add to BOTH the title `<input>` and the desc `<textarea>` an `onKeyDown`:

```jsx
onKeyDown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    onSaveAndNext({ title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId });
  }
}}
```

(The title input currently has no onKeyDown; the textarea neither — plain Enter behavior unchanged.) Call site passes `onSaveAndNext={(fields) => saveNodeEditAndNext(node.id, fields)}`.

Add a hint line inside the edit form under the actions (small, dim): `<div className="edit-hint"><Trans>Ctrl+Enter: lưu & tạo ý nối tiếp</Trans></div>` with CSS `.edit-form .edit-hint { font-size: 9px; color: var(--ink-dim); }`.

- [ ] **Step 3: lingui extract (1 new string; en: "Ctrl+Enter: save & create next idea"); build passes; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Chain new linked cards from the edit form with Ctrl+Enter"
```

---

### Task 6: Focus mode

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/components/ColorMenu.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `board.edges` (undirected adjacency, node-kind endpoints only), the `dimmed` prop pipeline (`<IdeaCard dimmed={!passesFilter(node)} ...>`), card ColorMenu block, keyboard Escape branch (Task 2).
- Produces: `focusId` state; `focusSet` (computed); `ColorMenu` gains optional `onFocus` prop.

- [ ] **Step 1: State + neighborhood computation**

```js
const [focusId, setFocusId] = useState(null);
```

After `passesFilter` (component scope, plain function):

```js
function computeFocusSet(rootId) {
  // BFS ≤2 hop trên edge node↔node (bỏ qua edge dính group)
  const adj = new Map();
  board.edges.forEach((e) => {
    if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  });
  const seen = new Set([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < 2; hop++) {
    const nextFrontier = [];
    frontier.forEach((id) => (adj.get(id) || []).forEach((nb) => {
      if (!seen.has(nb)) { seen.add(nb); nextFrontier.push(nb); }
    }));
    frontier = nextFrontier;
  }
  return seen;
}
const focusSet = focusId != null && board.nodes.some((n) => n.id === focusId)
  ? computeFocusSet(focusId)
  : null;
```

(Recomputed each render — fine at this board's scale; guard clears stale focus if the card was deleted.)

- [ ] **Step 2: Dim pipeline + banner + Escape**

`<IdeaCard dimmed={...}>` call site: `dimmed={!passesFilter(node) || (focusSet != null && !focusSet.has(node.id))}`.

Banner inside `.viewport` (next to the empty-hint block):

```jsx
{focusSet != null && (
  <div className="focus-banner">
    <Trans>Đang tập trung — Esc để thoát</Trans>
    <button onClick={() => setFocusId(null)}>×</button>
  </div>
)}
```

CSS: `.focus-banner { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 5px 8px 5px 14px; font-size: 11px; color: var(--ink-dim); box-shadow: var(--shadow); display: flex; gap: 8px; align-items: center; z-index: 40; } .focus-banner button { background: none; border: none; cursor: pointer; color: var(--ink-dim); font-size: 13px; line-height: 1; padding: 0 4px; }`

Task 2's Escape chain: add `else if (focusId != null) setFocusId(null);` after the linkMode branch (before the clear-selection branch), and add `focusId` to the effect deps.

- [ ] **Step 3: Trigger from popover**

`ColorMenu` gains optional `onFocus` prop → button `{onFocus && <button className="save-btn" onClick={onFocus}><Trans>Tập trung</Trans></button>}` (before Nhân bản). Card block passes `onFocus={() => { setColorMenu(null); setFocusId(node.id); }}`. Not passed for groups.

- [ ] **Step 4: lingui extract (2 new strings; en: "Focusing — Esc to exit", "Focus"); build passes; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/components/ColorMenu.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Add focus mode dimming everything beyond two hops of a card"
```

---

### Task 7: Bulk-edit bar for multi-select

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `selectedIds`, `board.statuses`/`board.tags`, `BADGE_PALETTE`/`colorVar`, `commitAndSave`, `deleteSelection` (Task 2).
- Produces: `applyToSelection(patchFn)` helper + `.bulk-bar` UI.

- [ ] **Step 1: Helper + bar**

```js
function applyToSelection(patch) {
  commitAndSave({
    ...board,
    nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, ...patch } : n))
  });
}
```

JSX inside `.viewport`, after the zoom-ctrl block:

```jsx
{selectedIds.size >= 2 && (
  <div className="bulk-bar" onMouseDown={(e) => e.stopPropagation()}>
    <span className="bb-count mono"><Trans>{selectedIds.size} thẻ</Trans></span>
    <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ statusId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
      <option value="">{t`Trạng thái…`}</option>
      <option value="none">{t`Không trạng thái`}</option>
      {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ tagId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
      <option value="">{t`Nhãn…`}</option>
      <option value="none">{t`Không nhãn`}</option>
      {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
    </select>
    <div className="bb-swatches">
      <button className="be-swatch dot-empty" onClick={() => applyToSelection({ color: null })} title={t`Không màu`} />
      {BADGE_PALETTE.map((token) => (
        <button key={token} className="be-swatch" style={{ background: colorVar(token) }} onClick={() => applyToSelection({ color: token })} title={token} />
      ))}
    </div>
    <button className="bb-clear" onClick={() => setSelectedIds(new Set())}><Trans>Bỏ chọn</Trans></button>
  </div>
)}
```

(Selects use a placeholder-reset pattern: value pinned to `""` so the same option can be re-picked; each change is one commitAndSave = one undo step.)

- [ ] **Step 2: CSS**

```css
.bulk-bar {
  position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; z-index: 40;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  box-shadow: var(--shadow); padding: 8px 12px;
}
.bulk-bar select { background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: 4px 6px; font-size: 11px; }
.bulk-bar .bb-count { font-size: 11px; color: var(--ink-dim); white-space: nowrap; }
.bulk-bar .bb-swatches { display: flex; gap: 4px; }
.bulk-bar .be-swatch { width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
.bulk-bar .bb-clear { background: none; border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 10.5px; color: var(--ink-dim); cursor: pointer; }
.bulk-bar .bb-clear:hover { color: var(--ink); border-color: var(--ink-dim); }
```

(`.be-swatch` base rule is scoped `.badge-editor .be-swatch` — the `.bulk-bar .be-swatch` rule above re-declares what it needs; `.dot-empty` is global already.)

- [ ] **Step 3: lingui extract (new strings: "{...} thẻ", "Trạng thái…", "Nhãn…", "Bỏ chọn" — en: "{n} cards", "Status…", "Tag…", "Clear selection"); build passes; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Add bulk status/tag/color editing bar for multi-selected cards"
```

---

## Self-Review Notes

- Task order is dependency-driven: 2 → 3 (duplicateNodes), 2 → 6 (Escape chain), 2 → 7 (deleteSelection exists but unused by 7 — fine). Tasks 1, 4, 5 independent.
- Snap threshold divides by scale (6 screen px feels constant at any zoom).
- Alt has two meanings by design (Figma convention): Alt at mousedown = duplicate-drag; Alt during move = disable snap. They compose: alt-drag clones AND has snap disabled while Alt stays held — acceptable, releasing Alt mid-drag re-enables snap.
- `nudgeSelection` history: base captured at burst start, recorded at burst end — one Ctrl+Z undoes the whole burst.
- Bulk bar and zoom-ctrl both sit at viewport bottom: zoom-ctrl is bottom-right, bulk-bar bottom-center — no overlap at sane widths.
