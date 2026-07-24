# Idea Map Wave 2 — Organize & Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Outline panel with click-to-jump + Markdown export, tidy-up grid layout, markdown-lite card descriptions, and a quick-capture bulk-entry modal.

**Architecture:** Pure logic in three new lib modules (`outline.js`, `layout.js`, `mdlite.js`), each `node --test` covered. UI wires into `IdeaMap.jsx`'s existing machinery (`commitAndSave`, `selectedIds`, `zoomToSelection`, `frameCardSize`, lingui). Zero server changes.

**Tech Stack:** React 18 + Vite, lingui (vi default/en catalog), Node built-in test runner. No new npm dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-idea-map-wave2-organize-design.md`.
- No new npm dependencies. No server changes. All UI strings in lingui; `npx lingui extract` + en msgstr filled, .po committed with the code.
- Pure lib modules take labels/callbacks as parameters — NO lingui imports inside `lib/` (established pattern: board-geometry.js, snap.js).
- One `recordHistory` entry per discrete user action (tidy-up = 1, quick-capture batch = 1).
- Verify: `node --test game-tools/client/src/lib/*.test.js` (all suites) + `cd game-tools/client && npm run build`. Dev servers already running (:3001/:5173, hot reload) — do NOT start new ones; browser clicking is the controller's job.
- Implementers Read `IdeaMap.jsx` around each anchor first — symbols are the anchors, not line numbers.
- Commit style: short imperative sentence, no prefix.

---

### Task 1: Outline + Markdown pure helpers

**Files:**
- Create: `game-tools/client/src/lib/outline.js`
- Create: `game-tools/client/src/lib/outline.test.js`

**Interfaces:**
- Consumes: `nodesInFrame` from `./board-geometry.js`.
- Produces:
  - `buildOutline(board, sizeOf): { frames: [{group, nodeIds}], byStatus: Map<statusId|"none", number[]> }` — frames in `board.groups` order with geometric member ids; cards in no frame grouped by `statusId` (null → key `"none"`). A card inside two overlapping frames appears under BOTH (matches drag semantics; do not dedupe).
  - `outlineToMarkdown(board, sizeOf, labels): string` — `labels = { other, links }` (translated strings passed by the caller).

- [ ] **Step 1: Write failing tests**

```js
// game-tools/client/src/lib/outline.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutline, outlineToMarkdown } from "./outline.js";

const sizeOf = () => ({ w: 100, h: 50 });
const board = {
  nodes: [
    { id: 1, title: "Trong khung", desc: "mô tả", statusId: 1, tagId: 1, x: 10, y: 10 },
    { id: 2, title: "Ngoài A", desc: "", statusId: 1, tagId: null, x: 500, y: 10 },
    { id: 3, title: "Ngoài B", desc: "hai\ndòng", statusId: null, tagId: null, x: 500, y: 200 }
  ],
  groups: [{ id: 1, title: "Khung 1", x: 0, y: 0, w: 200, h: 200, color: null }],
  edges: [
    { id: 1, from: 1, to: 2 },
    { id: 2, from: 1, fromKind: "group", to: 3, toKind: "node" }
  ],
  statuses: [{ id: 1, name: "Đã chọn", color: "st-chosen" }],
  tags: [{ id: 1, name: "Cơ chế", color: "dot-1" }]
};

test("buildOutline: card trong khung theo hình học, card ngoài nhóm theo status", () => {
  const o = buildOutline(board, sizeOf);
  assert.deepEqual(o.frames.map((f) => f.nodeIds), [[1]]);
  assert.deepEqual(o.byStatus.get(1), [2]);
  assert.deepEqual(o.byStatus.get("none"), [3]);
});

test("outlineToMarkdown: đủ section khung, status, Khác, Liên kết; desc xuống dòng thành 1 dòng", () => {
  const md = outlineToMarkdown(board, sizeOf, { other: "Khác", links: "Liên kết" });
  assert.equal(md.includes("## Khung 1"), true);
  assert.equal(md.includes("- Trong khung (Đã chọn, Cơ chế): mô tả"), true);
  assert.equal(md.includes("## Đã chọn"), true);
  assert.equal(md.includes("- Ngoài A (Đã chọn)"), true);
  assert.equal(md.includes("## Khác"), true);
  assert.equal(md.includes("- Ngoài B: hai dòng"), true);
  assert.equal(md.includes("## Liên kết"), true);
  assert.equal(md.includes("- Trong khung → Ngoài A"), true);
  assert.equal(md.includes("- Khung 1 → Ngoài B"), true);
});
```

- [ ] **Step 2: RED. Step 3: Implement**

```js
// game-tools/client/src/lib/outline.js
import { nodesInFrame } from "./board-geometry.js";

export function buildOutline(board, sizeOf) {
  const used = new Set();
  const frames = board.groups.map((g) => {
    const nodeIds = nodesInFrame(board.nodes, g, sizeOf);
    nodeIds.forEach((id) => used.add(id));
    return { group: g, nodeIds };
  });
  const byStatus = new Map();
  board.nodes.forEach((n) => {
    if (used.has(n.id)) return;
    const key = n.statusId ?? "none";
    if (!byStatus.has(key)) byStatus.set(key, []);
    byStatus.get(key).push(n.id);
  });
  return { frames, byStatus };
}

export function outlineToMarkdown(board, sizeOf, labels) {
  const { frames, byStatus } = buildOutline(board, sizeOf);
  const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
  const statusName = (id) => board.statuses.find((s) => s.id === id)?.name ?? null;
  const tagName = (id) => board.tags.find((t) => t.id === id)?.name ?? null;
  const cardLine = (n) => {
    const meta = [statusName(n.statusId), tagName(n.tagId)].filter(Boolean).join(", ");
    const desc = n.desc ? `: ${n.desc.replace(/\n+/g, " ")}` : "";
    return `- ${n.title}${meta ? ` (${meta})` : ""}${desc}`;
  };
  const lines = [];
  frames.forEach(({ group, nodeIds }) => {
    lines.push(`## ${group.title}`, "");
    nodeIds.forEach((id) => lines.push(cardLine(nodeById.get(id))));
    lines.push("");
  });
  byStatus.forEach((ids, key) => {
    lines.push(`## ${key === "none" ? labels.other : statusName(key) ?? labels.other}`, "");
    ids.forEach((id) => lines.push(cardLine(nodeById.get(id))));
    lines.push("");
  });
  const endpointName = (id, kind) => (kind === "group"
    ? board.groups.find((g) => g.id === id)?.title
    : nodeById.get(id)?.title);
  const edgeLines = board.edges
    .map((e) => {
      const a = endpointName(e.from, e.fromKind || "node");
      const b = endpointName(e.to, e.toKind || "node");
      return a && b ? `- ${a} → ${b}` : null;
    })
    .filter(Boolean);
  if (edgeLines.length) lines.push(`## ${labels.links}`, "", ...edgeLines, "");
  return lines.join("\n");
}
```

- [ ] **Step 4: GREEN (2/2 new; whole lib dir stays green). Step 5: Commit**

```bash
git add game-tools/client/src/lib/outline.js game-tools/client/src/lib/outline.test.js
git commit -m "Add pure outline grouping and markdown export helpers"
```

---

### Task 2: Outline panel + Export MD button

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `buildOutline`, `outlineToMarkdown` (Task 1), `frameCardSize`, `zoomToSelection`, `setSelectedIds`, `statusById`/`colorVar` (existing badges lib), lingui `t`.
- Produces: `outlineOpen` state + toolbar toggle; `jumpToCard(id)`; `jumpToGroup(group)`; `exportMarkdown()`.

- [ ] **Step 1: State + handlers**

`const [outlineOpen, setOutlineOpen] = useState(false);`

```js
function jumpToCard(id) {
  setSelectedIds(new Set([id]));
  zoomToSelectionFor([id]);
}
```

IMPORTANT: `zoomToSelection()` reads `selectedIds` from state — calling it right after `setSelectedIds` uses the STALE set (React batching). Refactor: extract the bbox+view math of `zoomToSelection` into `zoomToNodes(ids)` (takes explicit id array; empty/missing → no-op) and make `zoomToSelection` call `zoomToNodes(Array.from(selectedIds))`. Then `jumpToCard` calls `zoomToNodes([id])` directly — rename `zoomToSelectionFor` above accordingly.

```js
function jumpToGroup(group) {
  const rect = viewportRef.current.getBoundingClientRect();
  const pad = 60;
  const bboxW = group.w + pad * 2, bboxH = group.h + pad * 2;
  let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
  scale = Math.max(scale, MIN_SCALE);
  commitAndSave({
    ...board,
    view: {
      scale,
      panX: -(group.x - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(group.y - pad) * scale + (rect.height - bboxH * scale) / 2
    }
  }, { historical: false });
}

function exportMarkdown() {
  const md = outlineToMarkdown(board, frameCardSize, { other: t`Khác`, links: t`Liên kết` });
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "idea-map.md";
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Toolbar toggle + panel JSX**

Topbar, after the Nhập JSON button: `<button className={"btn ghost toggle" + (outlineOpen ? " active" : "")} onClick={() => setOutlineOpen((v) => !v)}><Trans>Mục lục</Trans></button>`.

Panel inside `.viewport` (sibling of `.zoom-ctrl`):

```jsx
{outlineOpen && (() => {
  const outline = buildOutline(board, frameCardSize);
  const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
  const row = (id) => {
    const n = nodeById.get(id);
    if (!n) return null;
    const s = statusById(board, n.statusId);
    return (
      <button key={id} className="op-row" onClick={() => jumpToCard(id)}>
        <span className="dot" style={{ background: s ? colorVar(s.color) : "transparent" }}></span>
        <span className="op-title">{n.title}</span>
      </button>
    );
  };
  return (
    <div className="outline-panel" onMouseDown={(e) => e.stopPropagation()}>
      <div className="op-head">
        <span className="op-count mono">{board.nodes.length}</span>
        <button className="btn ghost small" onClick={exportMarkdown}><Trans>Xuất MD</Trans></button>
        <button className="op-close" onClick={() => setOutlineOpen(false)}>×</button>
      </div>
      <div className="op-body">
        {outline.frames.map(({ group, nodeIds }) => (
          <div key={"g" + group.id} className="op-section">
            <button className="op-section-title" onClick={() => jumpToGroup(group)}>
              {group.title} <span className="mono op-n">{nodeIds.length}</span>
            </button>
            {nodeIds.map(row)}
          </div>
        ))}
        {Array.from(outline.byStatus.entries()).map(([key, ids]) => (
          <div key={"s" + key} className="op-section">
            <div className="op-section-title static">
              {key === "none" ? t`Khác` : (statusById(board, key)?.name ?? t`Khác`)}
              {" "}<span className="mono op-n">{ids.length}</span>
            </div>
            {ids.map(row)}
          </div>
        ))}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 3: CSS**

```css
.outline-panel {
  position: absolute; top: 12px; right: 12px; bottom: 12px; width: 240px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  box-shadow: var(--shadow); z-index: 45; display: flex; flex-direction: column;
}
.outline-panel .op-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--line); }
.outline-panel .op-count { font-size: 11px; color: var(--ink-dim); flex: 1; }
.outline-panel .op-close { background: none; border: none; cursor: pointer; color: var(--ink-dim); font-size: 15px; line-height: 1; padding: 0 2px; }
.outline-panel .op-body { overflow-y: auto; padding: 6px; flex: 1; }
.outline-panel .op-section { margin-bottom: 10px; }
.outline-panel .op-section-title {
  display: flex; align-items: center; justify-content: space-between; width: 100%;
  background: none; border: none; text-align: left; cursor: pointer;
  font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--ink-dim); padding: 4px 6px;
}
.outline-panel .op-section-title.static { cursor: default; }
.outline-panel .op-section-title:not(.static):hover { color: var(--ink); }
.outline-panel .op-n { font-size: 10px; }
.outline-panel .op-row {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: none; border: none; text-align: left; cursor: pointer;
  font-size: 11.5px; color: var(--ink); padding: 4px 6px; border-radius: 4px;
}
.outline-panel .op-row:hover { background: var(--surface-2); }
.outline-panel .op-row .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.outline-panel .op-row .op-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

(Note: the panel overlaps `.zoom-ctrl` bottom-right when open — move nothing; the panel's `bottom: 12px` leaves the zoom control underneath. Acceptable: z-index 45 > zoom-ctrl's default; the user closes the panel to use zoom buttons, wheel-zoom still works. If the reviewer flags it, an easy improvement is `bottom: 60px`.)

Use `bottom: 60px` from the start (avoids covering zoom-ctrl).

- [ ] **Step 4: lingui extract (new: "Mục lục", "Xuất MD", "Khác", "Liên kết" — en "Outline", "Export MD", "Other", "Links"); build; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Add outline panel with click-to-jump and markdown export"
```

---

### Task 3: Tidy up (grid layout)

**Files:**
- Create: `game-tools/client/src/lib/layout.js`
- Create: `game-tools/client/src/lib/layout.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Produces: `gridLayout(items, origin, cols, gapX = 24, gapY = 24): Map<id, {x, y}>` — `items = [{id, w, h}]` in desired reading order; column widths / row heights sized to the largest member. Also `tidySelection()` in IdeaMap + a "Xếp gọn" button in the bulk bar.
- Consumes: `selectedIds`, `frameCardSize`, `commitAndSave`.

- [ ] **Step 1: Tests**

```js
// game-tools/client/src/lib/layout.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { gridLayout } from "./layout.js";

test("xếp 4 item lưới 2 cột, cột/hàng theo item lớn nhất", () => {
  const items = [
    { id: 1, w: 100, h: 50 }, { id: 2, w: 120, h: 60 },
    { id: 3, w: 100, h: 40 }, { id: 4, w: 80, h: 50 }
  ];
  const pos = gridLayout(items, { x: 10, y: 20 }, 2, 24, 24);
  assert.deepEqual(pos.get(1), { x: 10, y: 20 });
  assert.deepEqual(pos.get(2), { x: 134, y: 20 });        // 10 + max(100,100)=100 + 24
  assert.deepEqual(pos.get(3), { x: 10, y: 104 });        // 20 + max(50,60)=60 + 24
  assert.deepEqual(pos.get(4), { x: 134, y: 104 });
});

test("1 cột khi cols=1", () => {
  const pos = gridLayout([{ id: 1, w: 50, h: 50 }, { id: 2, w: 50, h: 50 }], { x: 0, y: 0 }, 1);
  assert.deepEqual(pos.get(2), { x: 0, y: 74 });
});
```

- [ ] **Step 2: RED. Step 3: Implement**

```js
// game-tools/client/src/lib/layout.js
export function gridLayout(items, origin, cols, gapX = 24, gapY = 24) {
  const colW = [], rowH = [];
  items.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    colW[c] = Math.max(colW[c] || 0, it.w);
    rowH[r] = Math.max(rowH[r] || 0, it.h);
  });
  const positions = new Map();
  items.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    let x = origin.x, y = origin.y;
    for (let k = 0; k < c; k++) x += colW[k] + gapX;
    for (let k = 0; k < r; k++) y += rowH[k] + gapY;
    positions.set(it.id, { x, y });
  });
  return positions;
}
```

- [ ] **Step 4: GREEN. Step 5: `tidySelection` + button**

In IdeaMap (near `applyToSelection`):

```js
function tidySelection() {
  if (selectedIds.size < 2) return;
  const selected = board.nodes
    .filter((n) => selectedIds.has(n.id))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));       // thứ tự đọc
  const items = selected.map((n) => ({ id: n.id, ...frameCardSize(n.id) }));
  const origin = {
    x: Math.min(...selected.map((n) => n.x)),
    y: Math.min(...selected.map((n) => n.y))
  };
  const cols = Math.ceil(Math.sqrt(items.length));
  const pos = gridLayout(items, origin, cols);
  commitAndSave({
    ...board,
    nodes: board.nodes.map((n) => (pos.has(n.id) ? { ...n, ...pos.get(n.id) } : n))
  });
}
```

Bulk bar: add `<button className="bb-clear" onClick={tidySelection}><Trans>Xếp gọn</Trans></button>` right before the Bỏ chọn button.

- [ ] **Step 6: lingui (en "Tidy up"); build; commit**

```bash
git add game-tools/client/src/lib/layout.js game-tools/client/src/lib/layout.test.js game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/locales
git commit -m "Tidy selected cards into an even grid from the bulk bar"
```

---

### Task 4: Markdown-lite card descriptions

**Files:**
- Create: `game-tools/client/src/lib/mdlite.js`
- Create: `game-tools/client/src/lib/mdlite.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (IdeaCard desc render)
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Produces: `parseInline(text): [{type:"text"|"bold"|"link", value}]`, `parseDesc(desc): [{type:"bullet"|"para", inline:[...]}]` (pure); `MdLite` inline component in IdeaMap.jsx rendering them.
- Consumes: nothing new.

- [ ] **Step 1: Tests**

```js
// game-tools/client/src/lib/mdlite.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseDesc } from "./mdlite.js";

test("parseInline: text + bold + link", () => {
  assert.deepEqual(parseInline("xem **cái này** tại https://a.bc/x nhé"), [
    { type: "text", value: "xem " },
    { type: "bold", value: "cái này" },
    { type: "text", value: " tại " },
    { type: "link", value: "https://a.bc/x" },
    { type: "text", value: " nhé" }
  ]);
});

test("parseInline: chuỗi thuần không markup trả về 1 token text", () => {
  assert.deepEqual(parseInline("abc"), [{ type: "text", value: "abc" }]);
});

test("parseDesc: bullet và đoạn thường", () => {
  const out = parseDesc("- một\nhai");
  assert.equal(out[0].type, "bullet");
  assert.deepEqual(out[0].inline, [{ type: "text", value: "một" }]);
  assert.equal(out[1].type, "para");
});
```

- [ ] **Step 2: RED. Step 3: Implement**

```js
// game-tools/client/src/lib/mdlite.js
const INLINE_RE = /(\*\*([^*]+)\*\*)|(https?:\/\/[^\s]+)/g;

export function parseInline(text) {
  const tokens = [];
  let last = 0, m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    if (m[2] != null) tokens.push({ type: "bold", value: m[2] });
    else tokens.push({ type: "link", value: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length || tokens.length === 0) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

export function parseDesc(desc) {
  return desc.split("\n").map((line) =>
    line.startsWith("- ")
      ? { type: "bullet", inline: parseInline(line.slice(2)) }
      : { type: "para", inline: parseInline(line) }
  );
}
```

- [ ] **Step 4: GREEN. Step 5: Render in IdeaCard**

Add a small component above `IdeaCard` in IdeaMap.jsx:

```jsx
function MdLite({ text }) {
  const blocks = parseDesc(text);
  const renderInline = (tokens) => tokens.map((tk, i) => {
    if (tk.type === "bold") return <strong key={i}>{tk.value}</strong>;
    if (tk.type === "link") {
      return (
        <a key={i} href={tk.value} target="_blank" rel="noopener noreferrer"
           onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {tk.value}
        </a>
      );
    }
    return tk.value;
  });
  return (
    <>
      {blocks.map((b, i) => b.type === "bullet"
        ? <div key={i} className="md-bullet">{renderInline(b.inline)}</div>
        : <div key={i}>{renderInline(b.inline)}</div>)}
    </>
  );
}
```

In `IdeaCard`'s NON-editing return, change `<div className="desc">{node.desc}</div>` to `<div className="desc">{node.desc ? <MdLite text={node.desc} /> : null}</div>`. Import `parseDesc` from the lib.

CSS:

```css
.idea-card .desc a { color: var(--accent); text-decoration: underline; word-break: break-all; }
.idea-card .desc .md-bullet { padding-left: 10px; position: relative; }
.idea-card .desc .md-bullet::before { content: "•"; position: absolute; left: 0; }
```

(The desc container keeps its existing `-webkit-line-clamp: 4` — block children still clamp acceptably since the container stays `-webkit-box`. If clamp visually breaks with block children, fall back to `max-height: 4 * 1.35em; overflow: hidden;` on `.desc` — implementer judges by build + a quick DOM sanity reasoning, controller verifies visually later.)

- [ ] **Step 6: Build; no new strings (renderer only); commit**

```bash
git add game-tools/client/src/lib/mdlite.js game-tools/client/src/lib/mdlite.test.js game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css
git commit -m "Render links, bold, and bullets in card descriptions"
```

---

### Task 5: Quick capture modal

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `gridLayout` (Task 3), `commitAndSave`, `viewportRef`, `board.view`, `CARD_W`, lingui.
- Produces: `captureOpen`/`captureText` state, `confirmCapture()`, topbar button.

- [ ] **Step 1: State + handler**

```js
const [captureOpen, setCaptureOpen] = useState(false);
const [captureText, setCaptureText] = useState("");

function confirmCapture() {
  const titles = captureText.split("\n").map((s) => s.trim()).filter(Boolean);
  if (titles.length === 0) { setCaptureOpen(false); return; }
  const rect = viewportRef.current.getBoundingClientRect();
  const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
  const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
  const estH = 90;
  const cols = Math.ceil(Math.sqrt(titles.length));
  const items = titles.map((_, i) => ({ id: i, w: CARD_W, h: estH }));
  const gridW = cols * (CARD_W + 24) - 24;
  const rows = Math.ceil(titles.length / cols);
  const gridH = rows * (estH + 24) - 24;
  const pos = gridLayout(items, { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) }, cols);
  let nextId = board.nextNodeId;
  const newNodes = titles.map((title, i) => ({
    id: nextId + i,
    title,
    desc: "",
    tagId: null,
    statusId: board.statuses[0]?.id ?? null,
    x: pos.get(i).x,
    y: pos.get(i).y
  }));
  commitAndSave({ ...board, nodes: [...board.nodes, ...newNodes], nextNodeId: nextId + titles.length });
  setCaptureOpen(false);
  setCaptureText("");
}
```

- [ ] **Step 2: Topbar button + modal JSX**

Topbar, after `+ Khung`: `<button className="btn ghost" onClick={() => setCaptureOpen(true)}><Trans>Nhập nhanh</Trans></button>`.

Modal (sibling of the badge/color popovers at the end of the shell):

```jsx
{captureOpen && (
  <div className="capture-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCaptureOpen(false); }}>
    <div className="capture-modal">
      <div className="cm-note"><Trans>Mỗi dòng một ý tưởng — xác nhận để tạo hàng loạt thẻ.</Trans></div>
      <textarea
        autoFocus
        value={captureText}
        onChange={(e) => setCaptureText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); setCaptureOpen(false); }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); confirmCapture(); }
        }}
        placeholder={t`Ý tưởng 1\nÝ tưởng 2\n…`}
      />
      <div className="cm-actions">
        <button className="btn small" onClick={confirmCapture}><Trans>Tạo thẻ</Trans></button>
        <button className="btn ghost small" onClick={() => setCaptureOpen(false)}><Trans>Hủy</Trans></button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: CSS**

```css
.capture-overlay {
  position: fixed; inset: 0; z-index: 95;
  background: color-mix(in srgb, var(--ink) 25%, transparent);
  display: flex; align-items: center; justify-content: center;
}
.capture-modal {
  width: 380px; background: var(--surface); border: 1px solid var(--line);
  border-radius: 8px; box-shadow: var(--shadow); padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.capture-modal textarea {
  height: 160px; resize: vertical; background: var(--bg);
  border: 1px solid var(--line); border-radius: 4px; padding: 8px; font-size: 12px;
}
.capture-modal .cm-note { font-size: 11px; color: var(--ink-dim); }
.capture-modal .cm-actions { display: flex; gap: 6px; justify-content: flex-end; }
```

- [ ] **Step 4: lingui (new: "Nhập nhanh", "Mỗi dòng một ý tưởng — xác nhận để tạo hàng loạt thẻ.", "Tạo thẻ", placeholder — en: "Quick add", "One idea per line — confirm to create cards in bulk.", "Create cards", "Idea 1\nIdea 2\n…"); build; all lib tests green; commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Bulk-create cards from a quick capture modal"
```

---

## Self-Review Notes

- Task order: T1 → T2 (outline consumers), T3 → T5 (gridLayout). T4 independent.
- `jumpToCard` stale-selection hazard addressed by the `zoomToNodes(ids)` refactor in T2 Step 1 — the implementer must apply it, not call `zoomToSelection()` after `setSelectedIds`.
- Quick-capture uses estimated card height (90) for tiling — real heights vary; slight overlap possible, acceptable (user drags/tidies after).
- Escape in capture modal stops propagation so the global chain (focus/selection) doesn't also fire.
