# Idea Map Wave 3 — Extras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock, favorites, deep links, edge styles/labels, comments, images on cards, PNG export, and a frame-by-frame presentation mode.

**Architecture:** All data rides the existing `nodes`/`edges`/`groups` arrays (Mongoose Mixed — no schema change except one body-size limit bump). New pure helpers where logic is testable (`lib/user.js` tiny, `lib/png-export.js` drawing, `lib/image-utils.js` compression is DOM-dependent → manual verify). UI wires into `IdeaMap.jsx` patterns established in waves 1-2.

**Tech Stack:** React 18 + Vite, lingui, Node built-in test runner. No new npm dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-idea-map-wave3-extras-design.md`.
- No new npm dependencies. Server change is EXACTLY one line (Task 6: `express.json` limit `"2mb"` → `"10mb"`).
- lingui for all strings; extract + en msgstr each commit. One `recordHistory` per discrete action. `{historical:false}` for view-only changes (deep-link jump, presentation).
- Kind/`{id,kind}` invariants and `fromKind/toKind || "node"` defaults hold everywhere.
- `locked`/`favorites`/`comments`/`image`/`style`/`label` are OPTIONAL fields — all reads null-safe (old cards lack them).
- Verify per task: `cd game-tools/client && npm run build` + full lib test sweep `node --test game-tools/client/src/lib/*.test.js` (22 green at wave start; grows with new suites). Dev servers hot on :3001/:5173 — do NOT restart or start new ones (Task 6's server edit auto-reloads via node --watch).
- Implementers Read `IdeaMap.jsx` around each named anchor. Commit style unchanged.

---

### Task 1: Lock (cards + frames)

**Files:** Modify `IdeaMap.jsx`, `ColorMenu.jsx`, `FrameBox.jsx`, `idea-map.css`.

**Interfaces:**
- Consumes: card/group drag handlers, resize handler, `tidySelection`, popover blocks.
- Produces: `toggleNodeLock(id)`, `toggleGroupLock(id)`; `ColorMenu` optional `onToggleLock` + `locked` props (button label switches Khoá/Mở khoá); `FrameBox` renders 🔒 when `group.locked`.

- [ ] **Step 1: Handlers in IdeaMap** (near `applyNodeColor`)

```js
function toggleNodeLock(id) {
  commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, locked: !n.locked } : n)) });
  setColorMenu(null);
}
function toggleGroupLock(id) {
  commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g)) });
  setColorMenu(null);
}
```

- [ ] **Step 2: Guards**

- `handleNodeMouseDown`: after the space-pan branch, add `if (node.locked) return;` (left-drag blocked; right-pan above still works). In the group-drag path (`handleGroupMouseDown`), when collecting member start positions, SKIP locked members (they stay put while the frame moves): filter `memberIds` by `!board.nodes.find((n) => n.id === id)?.locked`. Also `if (group.locked) return;` at the top (after pan branches).
- `handleGroupResizeMouseDown`: `if (group.locked) return;` first line.
- `tidySelection`: filter the selected list by `!n.locked` before sorting (locked cards keep positions; if fewer than 2 remain, no-op).
- `nudgeSelection`: map only unlocked selected nodes (`selectedIds.has(n.id) && !n.locked`).
- Alt-drag duplicate of a locked card is ALLOWED (clones are new unlocked cards) — no change needed; verify the alt path doesn't hit the `node.locked` return before the alt branch. Order the guard AFTER the alt-clone branch decision: alt-drag on locked card clones and drags clones (originals locked anyway); plain drag on locked card returns. Concretely: place `if (node.locked && !e.altKey) return;`.

- [ ] **Step 3: UI**

`ColorMenu` new optional props `locked`, `onToggleLock` → button after Tập trung: `{onToggleLock && <button className="save-btn" onClick={onToggleLock}>{locked ? <Trans>Mở khoá</Trans> : <Trans>Khoá</Trans>}</button>}`. Pass from BOTH card block (`locked={node.locked ?? false}` / `onToggleLock={() => toggleNodeLock(node.id)}`) and group block (likewise with group).

Card lock icon: in `IdeaCard` non-editing return, after `.card-actions`: `{node.locked && <span className="lock-badge">🔒</span>}`. FrameBox: `{group.locked && <span className="lock-badge frame-lock">🔒</span>}` next to the title.

CSS: `.lock-badge { position: absolute; top: 8px; left: 8px; font-size: 10px; opacity: 0.7; } .frame-box .frame-lock { top: -13px; left: auto; right: 30px; background: var(--bg); border: 1px solid var(--line); border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }`

- [ ] **Step 4: lingui ("Khoá"/"Mở khoá" — en "Lock"/"Unlock"); build; tests; commit**

```bash
git commit -m "Lock cards and frames against dragging and resizing"
```

---

### Task 2: Favorites

**Files:** Create `game-tools/client/src/lib/user.js`; modify `IdeaMap.jsx`, `idea-map.css`.

**Interfaces:**
- Produces: `getUserName(promptFn): string|null` in lib (reads localStorage `idea-map-user`, else calls promptFn, stores trimmed non-empty); `toggleFavorite(nodeId)`; ⭐ button on card; filter chip "⭐ Yêu thích" wired into `passesFilter` via new `filterFav` state.

- [ ] **Step 1: lib/user.js** (pure enough to test with a fake promptFn + fake storage — inject both)

```js
export function getUserName(storage, promptFn) {
  const existing = storage.getItem("idea-map-user");
  if (existing) return existing;
  const name = (promptFn() || "").trim();
  if (!name) return null;
  storage.setItem("idea-map-user", name);
  return name;
}
```

Test (`lib/user.test.js`): existing name returned without prompting; empty prompt → null, nothing stored; entered name trimmed + stored. (3 tests, fake storage = Map-backed object with getItem/setItem.)

- [ ] **Step 2: IdeaMap wiring**

```js
function toggleFavorite(nodeId) {
  const user = getUserName(window.localStorage, () => window.prompt(t`Tên của bạn (hiện cạnh ⭐ và comment):`));
  if (!user) return;
  commitAndSave({
    ...board,
    nodes: board.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const favs = n.favorites ?? [];
      return { ...n, favorites: favs.includes(user) ? favs.filter((f) => f !== user) : [...favs, user] };
    })
  });
}
```

Card UI: in `.card-actions` (before ✎): `<button className={"icon-btn fav-btn" + ((node.favorites ?? []).includes(currentUser) ? " on" : "")} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>★{(node.favorites?.length ?? 0) > 0 ? node.favorites.length : ""}</button>` — `currentUser` read once per render in IdeaMap: `const currentUser = window.localStorage.getItem("idea-map-user");` passed as prop. CSS: `.fav-btn.on { color: #D9A514; }`.

Filter: `const [filterFav, setFilterFav] = useState(false);` — in `passesFilter`, after tag check: `if (filterFav && !(node.favorites?.length > 0)) return false;`. Chip in filterbar (own `fb-group` at the end): `<span className={"chip-toggle" + (filterFav ? " on" : "")} onClick={() => setFilterFav((v) => !v)}>★ <Trans>Yêu thích</Trans></span>`. Include `filterFav` in `activeFilterCount` and reset in `clearFilters`.

- [ ] **Step 3: lingui (prompt string, "Yêu thích" — en "Your name (shown next to ⭐ and comments):", "Favorites"); build; tests (25 total); commit**

```bash
git commit -m "Star favorite cards per person with a favorites filter"
```

---

### Task 3: Deep link

**Files:** Modify `IdeaMap.jsx`, `idea-map.css`, `ColorMenu.jsx`.

**Interfaces:** `?card=<id>` URL param; `flashId` state; ColorMenu optional `onCopyLink`.

- [ ] **Step 1: Sync selection → URL** (effect after the boardRef effect)

```js
useEffect(() => {
  const url = new URL(window.location.href);
  if (selectedIds.size === 1) url.searchParams.set("card", String(Array.from(selectedIds)[0]));
  else url.searchParams.delete("card");
  window.history.replaceState(null, "", url);
}, [selectedIds]);
```

- [ ] **Step 2: On load** — in the existing `getIdeas().then` chain, after `setBoard(data)`, read the param, and if the card exists: set selection, set `flashId`, and schedule the jump. `zoomToNodes` needs the board RENDERED (frameCardSize falls back to defaults pre-render — acceptable: use data coords + default size). Implement a `pendingJumpRef` consumed by a `useEffect` on `board` becoming non-null:

```js
const pendingJumpRef = useRef(null);
// trong .then(data): 
//   const cardParam = new URLSearchParams(window.location.search).get("card");
//   if (cardParam && data.nodes.some((n) => n.id === Number(cardParam))) pendingJumpRef.current = Number(cardParam);
useEffect(() => {
  if (!board || pendingJumpRef.current == null) return;
  const id = pendingJumpRef.current;
  pendingJumpRef.current = null;
  setSelectedIds(new Set([id]));
  setFlashId(id);
  zoomToNodes([id]);
  setTimeout(() => setFlashId(null), 1600);
}, [board != null]);
```

`const [flashId, setFlashId] = useState(null);` — IdeaCard gets `flash={flashId === node.id}` prop → classNames push `"flash"`. CSS: `.idea-card.flash { animation: card-flash 1.5s ease; } @keyframes card-flash { 0%, 60% { outline: 3px solid var(--accent); outline-offset: 4px; } 100% { outline: 0 solid transparent; } }`.

- [ ] **Step 3: Copy link** — ColorMenu optional `onCopyLink` → button (before Đóng): `<Trans>Chép liên kết</Trans>`. Card block passes: `onCopyLink={() => { const url = new URL(window.location.href); url.searchParams.set("card", String(node.id)); navigator.clipboard.writeText(url.toString()); setColorMenu(null); }}`.

- [ ] **Step 4: lingui ("Chép liên kết" — en "Copy link"); build; tests; commit**

```bash
git commit -m "Deep-link to a card via the card URL param"
```

---

### Task 4: Edge style + label

**Files:** Modify `IdeaMap.jsx`, `idea-map.css`.

**Interfaces:** `edgeMenu` state `{id, x, y} | null`; edge click opens menu INSTEAD of deleting; menu: toggle style, label input, delete button.

- [ ] **Step 1: Handlers**

```js
const [edgeMenu, setEdgeMenu] = useState(null);
function updateEdge(id, patch) {
  commitAndSave({ ...board, edges: board.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
}
function deleteEdge(id) {
  commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== id) });
  setEdgeMenu(null);
}
```

- [ ] **Step 2: Edge render changes** — in the edge map block: `.hit` line's `onClick` becomes `onClick={(e) => setEdgeMenu({ id: edge.id, x: e.clientX, y: e.clientY })}` (REPLACES delete-on-click). `.visible` line gains `strokeDasharray={edge.style === "dashed" ? "6 5" : undefined}`. After the two lines, label render:

```jsx
{edge.label && (
  <text className="edge-label" x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 4} textAnchor="middle">{edge.label}</text>
)}
```

CSS: `.edge-layer .edge-label { font-size: 10px; fill: var(--ink-dim); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; pointer-events: none; }`

- [ ] **Step 3: Menu popover** — reuse `.badge-editor` styling; render near the color popovers:

```jsx
{edgeMenu && (() => {
  const edge = board.edges.find((e) => e.id === edgeMenu.id);
  if (!edge) return null;
  return (
    <EdgeMenu
      key={edge.id}
      x={edgeMenu.x} y={edgeMenu.y}
      edge={edge}
      onStyleToggle={() => updateEdge(edge.id, { style: (edge.style === "dashed" ? "solid" : "dashed") })}
      onLabel={(label) => updateEdge(edge.id, { label: label.trim() || undefined })}
      onDelete={() => deleteEdge(edge.id)}
      onClose={() => setEdgeMenu(null)}
    />
  );
})()}
```

`EdgeMenu` component (new, in IdeaMap.jsx above IdeaCard — small): `useCloseOnOutside`; input defaultValue `edge.label ?? ""` committed on Enter/blur via `onLabel`; style-toggle button shows `<Trans>Nét đứt</Trans>` / `<Trans>Nét liền</Trans>` (target state); delete uses `.be-delete` trash. Escape closes (the hook handles it).

- [ ] **Step 4: lingui ("Nét đứt", "Nét liền", "Nhãn edge…" placeholder — en "Dashed", "Solid", "Edge label…"); build; tests; commit**

```bash
git commit -m "Style, label, and delete edges from a click popover"
```

---

### Task 5: Comments

**Files:** Modify `IdeaMap.jsx`, `idea-map.css`.

**Interfaces:** `commentsFor` state (`nodeId | null`); 💬 badge on card; popover list + add + per-item delete; author via `getUserName` (Task 2 lib).

- [ ] **Step 1: Handlers**

```js
const [commentsFor, setCommentsFor] = useState(null); // { id, x, y } | null
function addComment(nodeId, text) {
  const user = getUserName(window.localStorage, () => window.prompt(t`Tên của bạn (hiện cạnh ⭐ và comment):`));
  if (!user || !text.trim()) return;
  commitAndSave({
    ...board,
    nodes: board.nodes.map((n) => (n.id === nodeId
      ? { ...n, comments: [...(n.comments ?? []), { text: text.trim(), author: user, at: new Date().toISOString() }] }
      : n))
  });
}
function deleteComment(nodeId, index) {
  commitAndSave({
    ...board,
    nodes: board.nodes.map((n) => (n.id === nodeId
      ? { ...n, comments: (n.comments ?? []).filter((_, i) => i !== index) }
      : n))
  });
}
```

- [ ] **Step 2: Badge + popover** — badge in `IdeaCard` meta-row: `{(node.comments?.length ?? 0) > 0 && <button className="cmt-pill" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onOpenComments(e); }}>💬 {node.comments.length}</button>}`; also always available via ColorMenu new optional `onComments` button `<Trans>Bình luận</Trans>`. Both set `setCommentsFor({ id: node.id, x: e.clientX, y: e.clientY })`.

`CommentsPopover` component (in IdeaMap.jsx): `useCloseOnOutside`; list `.cmt-item` rows (author bold, relative time via simple helper `timeAgo(iso)` — minutes/hours/days, no lib), delete ×, textarea + Gửi button (Ctrl+Enter submits). Width 260, `.badge-editor`-style shell with own class `.comments-pop`.

`timeAgo` — small inline function (component scope): diff ms → `vừa xong` (<60s), `X phút trước`, `X giờ trước`, `X ngày trước`. lingui-wrapped with plural-free approximation (`` t`${x} phút trước` `` extracts with placeholder).

- [ ] **Step 3: CSS** (`.cmt-pill` like `.tag-pill`; `.comments-pop { width: 260px; max-height: 300px; }` list scroll, item layout).

- [ ] **Step 4: lingui (strings: "Bình luận", "Gửi", "vừa xong", time strings, textarea placeholder "Viết bình luận…" — en equivalents); build; tests; commit**

```bash
git commit -m "Comment on cards with author names and relative times"
```

---

### Task 6: Images on cards

**Files:** Create `game-tools/client/src/lib/image-utils.js`; modify `IdeaMap.jsx`, `idea-map.css`, `game-tools/server/index.js` (ONE line).

**Interfaces:** `compressImage(file, maxW = 480, quality = 0.8): Promise<string>` (data URL); paste/drop wiring; `node.image` render; remove button in edit form.

- [ ] **Step 1: lib/image-utils.js** (DOM-dependent — no node test; keep tiny)

```js
export function compressImage(file, maxW = 480, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}
```

- [ ] **Step 2: Paste + drop wiring in IdeaMap**

```js
function applyImageToNode(nodeId, dataUrl) {
  commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, image: dataUrl } : n)) });
}
useEffect(() => {
  function onPaste(e) {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    const current = boardRef.current;
    if (!current) return;
    const sel = selectedIdsRef.current;               // see note below
    if (sel.size !== 1) return;
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    compressImage(item.getAsFile()).then((dataUrl) => applyImageToNode(Array.from(sel)[0], dataUrl)).catch(() => {});
  }
  window.addEventListener("paste", onPaste);
  return () => window.removeEventListener("paste", onPaste);
}, []);
```

NOTE: this mount-once effect needs a ref mirror of `selectedIds` (`selectedIdsRef`, kept in sync by a tiny effect like `boardRef`) and `applyImageToNode` reading `boardRef.current` instead of `board` (stale closure). Adjust `applyImageToNode` to build from `boardRef.current`.

Drop on a card: in `IdeaCard`'s non-editing div add `onDragOver={(e) => e.preventDefault()}` and `onDrop` prop → parent handler: `(e, nodeId) => { e.preventDefault(); const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/")); if (f) compressImage(f).then((d) => applyImageToNode(nodeId, d)).catch(() => {}); }`.

Render in card (between title row and desc): `{node.image && <img className="card-img" src={node.image} alt="" draggable={false} />}`. CSS: `.idea-card .card-img { width: 100%; border-radius: 4px; margin-top: 6px; max-height: 140px; object-fit: cover; }`.

Edit form: `{node.image && <button className="cancel-btn" onClick={() => onRemoveImage()}><Trans>Xoá ảnh</Trans></button>}` in the actions row → parent `saveNodeEdit`-style handler clearing `image: undefined` (map spread with `image` removed: `const { image, ...rest } = n; return rest;`).

- [ ] **Step 3: Server limit bump** — `game-tools/server/index.js`: `app.use(express.json({ limit: "2mb" }))` → `"10mb"`. Nothing else.

- [ ] **Step 4: lingui ("Xoá ảnh" — en "Remove image"); build; tests; commit**

```bash
git commit -m "Paste or drop compressed images onto cards"
```

---

### Task 7: PNG export

**Files:** Create `game-tools/client/src/lib/png-export.js`; modify `IdeaMap.jsx`.

**Interfaces:** `drawBoardToCanvas(board, sizeOf, theme): HTMLCanvasElement` — simplified snapshot; `exportPng()` button in outline panel head next to Xuất MD.

- [ ] **Step 1: lib/png-export.js** — pure-ish (document.createElement("canvas") only):

```js
import { clipToRect, rectForEndpoint } from "./board-geometry.js";

const PAD = 60, SCALE = 2;

export function drawBoardToCanvas(board, sizeOf, theme) {
  // theme: { bg, surface, line, ink, inkDim, accent, colorOf(token) -> css color }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  board.nodes.forEach((n) => {
    const { w, h } = sizeOf(n.id);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  });
  board.groups.forEach((g) => {
    minX = Math.min(minX, g.x); minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w); maxY = Math.max(maxY, g.y + g.h);
  });
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  const w = Math.ceil(maxX - minX + PAD * 2), h = Math.ceil(maxY - minY + PAD * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w * SCALE; canvas.height = h * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.translate(PAD - minX, PAD - minY);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(minX - PAD, minY - PAD, w, h);

  ctx.font = "11px sans-serif";
  board.groups.forEach((g) => {
    ctx.strokeStyle = g.color ? theme.colorOf(g.color) : theme.line;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.setLineDash([]);
    ctx.fillStyle = theme.inkDim;
    ctx.fillText(g.title || "", g.x + 10, g.y - 6);
  });

  board.edges.forEach((e) => {
    const r1 = rectForEndpoint(e.fromKind || "node", e.from, board.nodes, board.groups, sizeOf);
    const r2 = rectForEndpoint(e.toKind || "node", e.to, board.nodes, board.groups, sizeOf);
    if (!r1 || !r2) return;
    const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
    const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
    ctx.strokeStyle = theme.inkDim;
    ctx.lineWidth = 1.4;
    if (e.style === "dashed") ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - 8 * Math.cos(ang - 0.4), p2.y - 8 * Math.sin(ang - 0.4));
    ctx.lineTo(p2.x - 8 * Math.cos(ang + 0.4), p2.y - 8 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = theme.inkDim;
    ctx.fill();
    if (e.label) {
      ctx.fillStyle = theme.inkDim;
      ctx.fillText(e.label, (p1.x + p2.x) / 2 - ctx.measureText(e.label).width / 2, (p1.y + p2.y) / 2 - 5);
    }
  });

  board.nodes.forEach((n) => {
    const { w: cw, h: ch } = sizeOf(n.id);
    ctx.fillStyle = theme.surface;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(n.x, n.y, cw, ch, 6);
    ctx.fill(); ctx.stroke();
    if (n.color) {
      ctx.fillStyle = theme.colorOf(n.color);
      ctx.fillRect(n.x, n.y + 1, 4, ch - 2);
    }
    ctx.fillStyle = theme.ink;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(n.title, n.x + 10, n.y + 18, cw - 20);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = theme.inkDim;
    const desc = (n.desc || "").replace(/\n/g, " ");
    if (desc) ctx.fillText(desc.length > 60 ? desc.slice(0, 57) + "…" : desc, n.x + 10, n.y + 34, cw - 20);
  });

  return canvas;
}
```

- [ ] **Step 2: exportPng in IdeaMap**

```js
function exportPng() {
  const styles = getComputedStyle(document.documentElement);
  const v = (name) => styles.getPropertyValue(name).trim();
  const theme = {
    bg: v("--bg"), surface: v("--surface-2"), line: v("--line"),
    ink: v("--ink"), inkDim: v("--ink-dim"), accent: v("--accent"),
    colorOf: (token) => v(`--${token}`)
  };
  const canvas = drawBoardToCanvas(board, frameCardSize, theme);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "idea-map.png"; a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
```

Button in outline panel head next to Xuất MD: `<button className="btn ghost small" onClick={exportPng}><Trans>Xuất PNG</Trans></button>`.

- [ ] **Step 3: lingui ("Xuất PNG" — en "Export PNG"); build; tests; commit** (note: `ctx.roundRect` — Chrome 99+/FF 112+, fine for this team; if the implementer worries, a rect fallback `if (!ctx.roundRect)` is 3 lines — allowed).

```bash
git commit -m "Export a simplified PNG snapshot of the board"
```

---

### Task 8: Presentation mode

**Files:** Modify `IdeaMap.jsx`, `idea-map.css`.

**Interfaces:** `presentIndex` state (`null` = off); topbar button (disabled when no groups); ←/→/Esc handling; view restore on exit.

- [ ] **Step 1: State + logic**

```js
const [presentIndex, setPresentIndex] = useState(null);
const prePresentViewRef = useRef(null);

function startPresentation() {
  if (board.groups.length === 0) return;
  prePresentViewRef.current = board.view;
  setPresentIndex(0);
  jumpToGroup(board.groups[0]);
}
function stepPresentation(delta) {
  setPresentIndex((i) => {
    const next = Math.min(board.groups.length - 1, Math.max(0, i + delta));
    if (next !== i) jumpToGroup(board.groups[next]);
    return next;
  });
}
function exitPresentation() {
  setPresentIndex(null);
  if (prePresentViewRef.current) {
    commitAndSave({ ...board, view: prePresentViewRef.current }, { historical: false });
    prePresentViewRef.current = null;
  }
}
```

CAREFUL: `stepPresentation`'s updater calls `jumpToGroup` (a setState-triggering function) INSIDE a setState updater — not allowed (side effects in updater). Restructure: compute next from current `presentIndex` state directly (it's in the keydown effect's deps):

```js
function stepPresentation(delta) {
  const next = Math.min(board.groups.length - 1, Math.max(0, presentIndex + delta));
  if (next !== presentIndex) { setPresentIndex(next); jumpToGroup(board.groups[next]); }
}
```

- [ ] **Step 2: Keys + UI** — keydown effect additions (presenting takes PRIORITY, before the ctrl/meta block): `if (presentIndex != null) { if (key === "arrowright") { e.preventDefault(); stepPresentation(1); } else if (key === "arrowleft") { e.preventDefault(); stepPresentation(-1); } else if (key === "escape") { exitPresentation(); } return; }` — add `presentIndex` to deps.

Topbar: `<button className="btn ghost" disabled={board.groups.length === 0} onClick={startPresentation}><Trans>Trình chiếu</Trans></button>`.

Present overlay (inside `.shell`, after the viewport div): when `presentIndex != null`, render `.present-bar`: fixed bottom-center, `{presentIndex + 1}/{board.groups.length}` + frame title + exit ×. Hide topbar/filterbar via a `presenting` class on `.shell`: `{className={"shell" + (presentIndex != null ? " presenting" : "")}}` and CSS `.shell.presenting .topbar, .shell.presenting .filterbar { display: none; }` (viewport fills; canvas interactions stay live — acceptable).

```css
.present-bar {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 96;
  background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
  box-shadow: var(--shadow); padding: 6px 16px; display: flex; gap: 12px; align-items: center;
  font-size: 12px;
}
```

- [ ] **Step 3: lingui ("Trình chiếu" — en "Present"); build; tests; commit**

```bash
git commit -m "Present frames one by one in a fullscreen walkthrough"
```

---

## Self-Review Notes

- Task 2's `lib/user.js` takes storage+prompt as params — testable without DOM.
- Task 6 paste effect is mount-once → needs `selectedIdsRef` mirror + boardRef reads (explicitly called out; reviewer should verify no stale closure).
- Task 8's original stepPresentation had a side-effect-in-updater bug — corrected inline; implementer uses the corrected version.
- Edge click behavior CHANGES (delete-on-click → menu) — this is a deliberate UX improvement (safer); noted for the final review as an intentional behavior change.
- PNG export uses `frameCardSize` (DOM-measured) — cards not yet rendered fall back to defaults; snapshot is simplified by design.
