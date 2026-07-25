# Idea Map Color Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user-created color palette in the filterbar whose swatches can be edited in place (live-updating everywhere they're used) and dragged onto cards, edges, and badges — with the filterbar reorganised into three toggleable panels.

**Architecture:** Custom colors live in `board.palette: [{ id, hex }]` and are referenced by the token `"pal-<id>"`, exactly like the built-in `"dot-1"` tokens. One React-rendered `<style>` element declares `--pal-<id>` on `:root`, so editing a hex repaints every user of that token through CSS's own cascade — no reference-chasing code. Pure board transforms go in a new `lib/palette.js` with `node:test` coverage; the drag-drop mechanism reuses `handleChipMouseDown`'s existing pattern verbatim.

**Tech Stack:** React 18 + Vite, lingui, native `<input type="color">`, Node built-in test runner. No new npm dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-idea-map-color-palette-design.md`.
- No new npm dependencies. No color-picker library — native `<input type="color">` only.
- lingui for all user-facing strings (`<Trans>` in JSX, `` t`…` `` in attributes); run `npm run i18n:extract` and fill the `en` msgstr each commit.
- Custom color token format is exactly `pal-<id>` — matched in `lib/palette.js`, produced in the `<style>` block, consumed by the unchanged `colorVar()`.
- `board.palette` / `board.nextPaletteId` are new OPTIONAL fields — every read must survive an old board that lacks them (Task 1 normalises them at load so later tasks can assume they exist).
- One `commitAndSave` per discrete user action (one undo entry, one debounced save).
- Verify per task: `cd game-tools/client && npm run build` + `node --test src/lib/*.test.js` (25 green at plan start; grows in Task 1).
- Do NOT read `game-tools/server/.env` and never echo `MONGODB_URI`.
- Working tree already carries an uncommitted edge-menu redesign in `IdeaMap.jsx` + `idea-map.css`. Leave it alone; commit only the lines each task touches (`git add -p` if needed).

---

### Task 1: Palette data model + pure transforms

**Files:**
- Create: `game-tools/client/src/lib/palette.js`
- Create: `game-tools/client/src/lib/palette.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (the `getIdeas()` load effect, ~line 88)
- Modify: `game-tools/server/index.js` (`ideaBoardSchema` ~line 23, `PUT /api/ideas` ~line 193)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `paletteCss(palette) -> string` — the `:root { --pal-N: #hex; }` text (empty string for an empty palette).
  - `applyColorTo(board, target, color) -> board` — `target` is `{ kind: "node"|"edge"|"status"|"tag", id: number }`; unknown kinds return the board unchanged.
  - `removePaletteColor(board, id) -> board` — drops the entry and strips `"pal-<id>"` from every user (`node.color`/`edge.color` → `null`, `status.color`/`tag.color` → `BADGE_PALETTE[0]`).
  - `board.palette` and `board.nextPaletteId` exist on every loaded board.

- [ ] **Step 1: Write the failing test**

Create `game-tools/client/src/lib/palette.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { paletteCss, applyColorTo, removePaletteColor } from "./palette.js";

function makeBoard() {
  return {
    palette: [{ id: 1, hex: "#ff0000" }, { id: 2, hex: "#00ff00" }],
    nextPaletteId: 3,
    nodes: [{ id: 10, color: "pal-1" }, { id: 11, color: "dot-3" }],
    edges: [{ id: 20, color: "pal-1" }, { id: 21 }],
    statuses: [{ id: 30, name: "A", color: "pal-1" }, { id: 31, name: "B", color: "st-chosen" }],
    tags: [{ id: 40, name: "C", color: "pal-2" }]
  };
}

test("paletteCss khai báo biến cho từng màu", () => {
  assert.equal(
    paletteCss([{ id: 1, hex: "#ff0000" }, { id: 2, hex: "#00ff00" }]),
    ":root {\n  --pal-1: #ff0000;\n  --pal-2: #00ff00;\n}"
  );
});

test("paletteCss rỗng → chuỗi rỗng, không sinh block vô nghĩa", () => {
  assert.equal(paletteCss([]), "");
});

test("applyColorTo ghi màu đúng thực thể, không đụng thực thể khác", () => {
  const b = makeBoard();
  const afterNode = applyColorTo(b, { kind: "node", id: 11 }, "pal-2");
  assert.equal(afterNode.nodes.find((n) => n.id === 11).color, "pal-2");
  assert.equal(afterNode.nodes.find((n) => n.id === 10).color, "pal-1");

  assert.equal(applyColorTo(b, { kind: "edge", id: 21 }, "pal-2").edges.find((e) => e.id === 21).color, "pal-2");
  assert.equal(applyColorTo(b, { kind: "status", id: 31 }, "pal-1").statuses.find((s) => s.id === 31).color, "pal-1");
  assert.equal(applyColorTo(b, { kind: "tag", id: 40 }, "dot-5").tags.find((tg) => tg.id === 40).color, "dot-5");
  // board gốc không bị đổi
  assert.equal(b.nodes.find((n) => n.id === 11).color, "dot-3");
});

test("applyColorTo với kind lạ → trả board nguyên vẹn", () => {
  const b = makeBoard();
  assert.equal(applyColorTo(b, { kind: "group", id: 1 }, "pal-1"), b);
});

test("removePaletteColor gỡ token khỏi mọi chỗ đang dùng", () => {
  const next = removePaletteColor(makeBoard(), 1);
  assert.deepEqual(next.palette, [{ id: 2, hex: "#00ff00" }]);
  assert.equal(next.nodes.find((n) => n.id === 10).color, null);
  assert.equal(next.edges.find((e) => e.id === 20).color, null);
  // badge luôn cần màu để vẽ dot → lùi về token mặc định, không phải null
  assert.equal(next.statuses.find((s) => s.id === 30).color, "st-idea");
  // màu khác không bị ảnh hưởng
  assert.equal(next.nodes.find((n) => n.id === 11).color, "dot-3");
  assert.equal(next.statuses.find((s) => s.id === 31).color, "st-chosen");
  assert.equal(next.tags.find((tg) => tg.id === 40).color, "pal-2");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game-tools/client && node --test src/lib/palette.test.js`
Expected: FAIL — `Cannot find module './palette.js'`

- [ ] **Step 3: Write the implementation**

Create `game-tools/client/src/lib/palette.js`:

```js
import { BADGE_PALETTE } from "./badges.js";

// Màu tự tạo mang token "pal-<id>", dùng y như token cố định ("dot-1"): mọi chỗ
// vẽ đều đi qua colorVar() → var(--pal-<id>). Giá trị thật do paletteCss() khai
// báo trong một thẻ <style> duy nhất, nên sửa hex là cả bản đồ đổi theo.
export function paletteCss(palette) {
  if (!palette.length) return "";
  return `:root {\n${palette.map((c) => `  --pal-${c.id}: ${c.hex};`).join("\n")}\n}`;
}

export function applyColorTo(board, target, color) {
  const { kind, id } = target;
  const set = (o) => (o.id === id ? { ...o, color } : o);
  if (kind === "node") return { ...board, nodes: board.nodes.map(set) };
  if (kind === "edge") return { ...board, edges: board.edges.map(set) };
  if (kind === "status") return { ...board, statuses: board.statuses.map(set) };
  if (kind === "tag") return { ...board, tags: board.tags.map(set) };
  return board;
}

export function removePaletteColor(board, id) {
  const token = `pal-${id}`;
  // Để nguyên token đã chết thì swatch mới trùng id sẽ làm các thẻ cũ "sống lại"
  // với màu khác — nên gỡ sạch ngay trong cùng một commit.
  const clear = (o) => (o.color === token ? { ...o, color: null } : o);
  const fallback = (o) => (o.color === token ? { ...o, color: BADGE_PALETTE[0] } : o);
  return {
    ...board,
    palette: board.palette.filter((c) => c.id !== id),
    nodes: board.nodes.map(clear),
    edges: board.edges.map(clear),
    statuses: board.statuses.map(fallback),
    tags: board.tags.map(fallback)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game-tools/client && node --test src/lib/palette.test.js`
Expected: PASS — 5 tests

- [ ] **Step 5: Normalise the loaded board**

In `IdeaMap.jsx`, in the `getIdeas()` effect, replace `setBoard(data);` with:

```js
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...data });
```

- [ ] **Step 6: Persist on the server**

In `game-tools/server/index.js`, add to `ideaBoardSchema` after the `tags` line:

```js
    palette: { type: Array, default: [] },
```

and after `nextTagId`:

```js
    nextPaletteId: { type: Number, default: 1 },
```

In `PUT /api/ideas`, the route writes only explicitly-listed fields, so both must be added to the destructure AND the update object:

```js
    const { nodes, edges, groups, statuses, tags, palette, nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, view } = req.body;
    await IdeaBoard.findOneAndUpdate(
      { singleton: "main" },
      { nodes, edges, groups, statuses, tags, palette, nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, view },
      { upsert: true }
    );
```

- [ ] **Step 7: Verify and commit**

Run: `cd game-tools/client && npm run build && node --test src/lib/*.test.js`
Expected: build OK, 30 tests pass.

```bash
git add game-tools/client/src/lib/palette.js game-tools/client/src/lib/palette.test.js game-tools/client/src/pages/IdeaMap.jsx game-tools/server/index.js
git commit -m "Add the palette data model and its board transforms"
```

---

### Task 2: Filterbar as three toggleable panels

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (state block ~line 59; filterbar JSX lines 1566-1656)
- Modify: `game-tools/client/src/styles/idea-map.css` (`.filterbar` block lines 14-36; media block lines 234-238)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `panels` state `{ status: bool, tag: bool, palette: bool }` and `togglePanel(key)`; a `.fb-panel` container that Task 3 renders the palette into.

- [ ] **Step 1: Add panel state**

In `IdeaMap.jsx`, after `const [chipDrag, setChipDrag] = useState(null);`:

```js
  // Mặc định mở Trạng thái + Nhãn để giữ đúng hành vi cũ khi mới vào; Bảng màu
  // đóng. Chỉ giữ trong state — không lưu qua reload (spec).
  const [panels, setPanels] = useState({ status: true, tag: true, palette: false });
```

And next to `clearFilters` (~line 1418):

```js
  function togglePanel(key) {
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }
```

- [ ] **Step 2: Restructure the filterbar JSX**

Replace the whole `<div className="filterbar"> … </div>` block (lines 1566-1656) with:

```jsx
      <div className="filterbar">
        <div className="fb-tabs">
          <button className={"btn ghost toggle" + (panels.status ? " active" : "")} onClick={() => togglePanel("status")}><Trans>Trạng thái</Trans></button>
          <button className={"btn ghost toggle" + (panels.tag ? " active" : "")} onClick={() => togglePanel("tag")}><Trans>Nhãn</Trans></button>
          <button className={"btn ghost toggle" + (panels.palette ? " active" : "")} onClick={() => togglePanel("palette")}><Trans>Bảng màu</Trans></button>
          <span
            className={"chip-toggle" + (filterFav ? " on" : "")}
            onClick={() => setFilterFav((v) => !v)}
          >
            ★ <Trans>Yêu thích</Trans>
          </span>
          <div className="spacer" />
          {activeFilterCount > 0 && (
            <div className="fb-tail">
              <span className="fb-count mono" title={t`Số ý tưởng khớp bộ lọc`}>
                <Trans>Khớp {matchCount}/{board.nodes.length}</Trans>
              </span>
              <button className="fb-clear" onClick={clearFilters}><Trans>Xoá lọc</Trans></button>
            </div>
          )}
        </div>

        {panels.status && (
          <div className="fb-panel">
            <div className="fb-chips">
              {board.statuses.map((s) => {
                const key = String(s.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle status" + (filterStatus[key] ? " on" : "")}
                    onMouseDown={(e) => handleChipMouseDown(e, "status", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "status", s)}
                    onClick={() => setFilterStatus((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán trạng thái — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(s.color) }}></span>
                    {s.name}
                  </span>
                );
              })}
              {hasNoStatus && (
                <span
                  className={"chip-toggle status" + (filterStatus["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "status", "none")}
                  onClick={() => setFilterStatus((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa có trạng thái`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không trạng thái</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "status")} title={t`Thêm trạng thái`}>+</button>
            </div>
          </div>
        )}

        {panels.tag && (
          <div className="fb-panel">
            <div className="fb-chips">
              {board.tags.map((tg) => {
                const key = String(tg.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle tag" + (filterTags[key] ? " on" : "")}
                    onMouseDown={(e) => handleChipMouseDown(e, "tag", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "tag", tg)}
                    onClick={() => setFilterTags((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán nhãn — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(tg.color) }}></span>
                    {tg.name}
                  </span>
                );
              })}
              {hasNoTag && (
                <span
                  className={"chip-toggle tag" + (filterTags["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "tag", "none")}
                  onClick={() => setFilterTags((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa gắn nhãn`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không nhãn</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "tag")} title={t`Thêm nhãn`}>+</button>
            </div>
          </div>
        )}
      </div>
```

The `.fb-label` spans are gone — the tab button already names the panel.

- [ ] **Step 3: CSS**

In `idea-map.css`, delete the four `.filterbar .fb-group…` rules (lines 19-24) and the now-unused `.filterbar .fb-label` rule (lines 26-29). Keep `.filterbar .fb-chips` (line 25) and everything from `.fb-tail` down. In their place add:

```css
.filterbar { flex-direction: column; }
.filterbar .fb-tabs { display: flex; align-items: center; gap: 8px; padding: 7px 0; min-width: 0; flex-wrap: wrap; }
.filterbar .fb-tabs .btn { padding: 5px 11px; font-size: 10.5px; }
.filterbar .fb-panel {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 8px 0; border-top: 1px solid var(--line); min-width: 0;
}
```

Keep `.filterbar .fb-chips`, `.fb-tail`, `.fb-count`, `.fb-clear` as they are. Note `.filterbar` already declares `display: flex; align-items: stretch; flex-wrap: wrap;` on line 15 — adding `flex-direction: column` after it is enough; do not delete the original block.

Delete the two dead `.fb-group` lines from the `@media (max-width: 760px)` block (lines 235-236), keeping the `.fb-tail` line:

```css
@media (max-width: 760px) {
  .filterbar .fb-tail { width: 100%; padding-bottom: 8px; }
}
```

- [ ] **Step 4: lingui, build, verify, commit**

Run: `cd game-tools/client && npm run i18n:extract` — then fill the new `en` msgstrs in `src/locales/en/messages.po`: `Bảng màu` → `Palette`. (`Trạng thái`, `Nhãn`, `Yêu thích` already exist.)

Run: `npm run build && node --test src/lib/*.test.js`
Expected: build OK, 30 pass.

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Turn the filterbar into three toggleable panels"
```

---

### Task 3: The palette panel — create, edit, delete, live link

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (imports; state; handlers near `createBadge`; the `.filterbar` JSX from Task 2; popover render block near the `badgeUI` blocks ~line 1969; new `PaletteEditor` component next to `EdgeMenu` ~line 2089)
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `paletteCss`, `removePaletteColor` from Task 1; `panels.palette` / `.fb-panel` from Task 2.
- Produces: `createPaletteColor(hex)`, `updatePaletteColor(id, hex)`, `deletePaletteColor(id)`; `paletteUI` state `{ mode: "create"|"edit", id?, hex, x, y } | null`; a `.pal-swatch` element per color carrying `data-pal-id`.

- [ ] **Step 1: Import and state**

In `IdeaMap.jsx`, add after the `badges.js` import:

```js
import { paletteCss, applyColorTo, removePaletteColor } from "../lib/palette.js";
```

(`applyColorTo` is unused until Task 4 — importing it now keeps Task 4 to one concern. If your linter fails on unused imports, add it in Task 4 instead.)

Add after the `panels` state from Task 2:

```js
  const [paletteUI, setPaletteUI] = useState(null); // { mode: "create"|"edit", id?, hex, x, y } | null
```

- [ ] **Step 2: Handlers**

In `IdeaMap.jsx`, after `deleteBadge` (~line 1532):

```js
  function openPaletteEditor(e, entry) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setPaletteUI(entry
      ? { mode: "edit", id: entry.id, hex: entry.hex, x: r.left, y: r.bottom + 6 }
      : { mode: "create", hex: "#888888", x: r.left, y: r.bottom + 6 });
  }

  function createPaletteColor(hex) {
    const id = board.nextPaletteId;
    commitAndSave({ ...board, palette: [...board.palette, { id, hex }], nextPaletteId: id + 1 });
    setPaletteUI(null);
  }

  function updatePaletteColor(id, hex) {
    commitAndSave({ ...board, palette: board.palette.map((c) => (c.id === id ? { ...c, hex } : c)) });
  }

  function deletePaletteColor(id) {
    commitAndSave(removePaletteColor(board, id));
    setPaletteUI(null);
  }
```

`updatePaletteColor` deliberately leaves the popover open so the same swatch can be re-picked or deleted without reopening.

- [ ] **Step 3: The live-link style element**

In the `return`, as the first child inside `<div className={"shell" …}>` (immediately before `<div className="topbar">`):

```jsx
      {/* Khai báo màu tự tạo trong cây React: sửa hex là mọi card/dây/badge dùng
          var(--pal-N) repaint ngay, không cần đi ghi lại từng chỗ tham chiếu. */}
      <style>{paletteCss(board.palette)}</style>
```

- [ ] **Step 4: The palette panel**

In the `.filterbar` block from Task 2, after the `{panels.tag && …}` block:

```jsx
        {panels.palette && (
          <div className="fb-panel">
            <div className="fb-chips">
              {board.palette.map((c) => (
                <button
                  key={c.id}
                  className="pal-swatch"
                  data-pal-id={c.id}
                  style={{ background: colorVar(`pal-${c.id}`) }}
                  onMouseDown={(e) => handleColorMouseDown(e, `pal-${c.id}`)}
                  onClick={(e) => openPaletteEditor(e, c)}
                  title={t`Bấm để sửa màu — kéo thả vào thẻ / dây / badge để tô màu`}
                />
              ))}
              <button className="fb-add" onClick={(e) => openPaletteEditor(e, null)} title={t`Thêm màu`}>+</button>
            </div>
            {board.palette.length === 0 && (
              <span className="fb-count"><Trans>Chưa có màu nào — bấm + để tạo.</Trans></span>
            )}
          </div>
        )}
```

`handleColorMouseDown` doesn't exist yet — Task 4 adds it. To keep this task independently runnable, add the stub now and let Task 4 fill the body:

```js
  function handleColorMouseDown(e, token) {
    // Task 4 gắn kéo-thả vào đây.
  }
```

- [ ] **Step 5: The popover render block**

After the `{badgeUI && badgeUI.mode === "edit" && …}` block (~line 1969):

```jsx
      {paletteUI && (
        <PaletteEditor
          key={paletteUI.mode + "-" + (paletteUI.id ?? "new")}
          x={paletteUI.x}
          y={paletteUI.y}
          hex={paletteUI.hex}
          onPick={(hex) => (paletteUI.mode === "create" ? createPaletteColor(hex) : updatePaletteColor(paletteUI.id, hex))}
          onDelete={paletteUI.mode === "edit" ? () => deletePaletteColor(paletteUI.id) : undefined}
          onClose={() => setPaletteUI(null)}
        />
      )}
```

- [ ] **Step 6: The PaletteEditor component**

Add before `function EdgeMenu(` (~line 2089):

```jsx
function PaletteEditor({ x, y, hex, onPick, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);

  return (
    <div className="badge-editor pal-editor" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="eyebrow">{onDelete ? t`Sửa màu` : t`Màu mới`}</div>
      {/* Ghi ở "change", không phải "input": hộp chọn màu của Windows là modal nên
          preview realtime vô nghĩa, mà mỗi bước kéo lại thành một entry undo. */}
      <input className="pal-input" type="color" defaultValue={hex} onChange={(e) => onPick(e.target.value)} />
      {onDelete && (
        <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá màu</Trans></button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: CSS**

Append to `idea-map.css` after the `.badge-editor .em-delete:hover` rule:

```css
.pal-swatch {
  width: 22px; height: 22px; border-radius: 50%; padding: 0;
  border: 1px solid var(--line); cursor: grab; flex-shrink: 0;
}
.pal-swatch:active { cursor: grabbing; }
.pal-swatch:hover { border-color: var(--ink); }
.badge-editor.pal-editor { width: 150px; }
.badge-editor .pal-input {
  width: 100%; height: 34px; padding: 0; cursor: pointer;
  background: var(--bg); border: 1px solid var(--line); border-radius: 4px;
}
```

- [ ] **Step 8: lingui, build, verify, commit**

Run: `cd game-tools/client && npm run i18n:extract` — fill the `en` msgstrs: `Thêm màu` → `Add color`, `Xoá màu` → `Delete color`, `Sửa màu` → `Edit color`, `Màu mới` → `New color`, `Bấm để sửa màu — kéo thả vào thẻ / dây / badge để tô màu` → `Click to edit — drag onto a card / edge / badge to color it`, `Chưa có màu nào — bấm + để tạo.` → `No colors yet — press + to create one.`

Run: `npm run build && node --test src/lib/*.test.js`
Expected: build OK, 30 pass.

Manual check (dev server on :5173 if already running — do NOT start a second one): open Bảng màu, press `+`, pick a color, confirm the swatch appears; click the swatch, pick a different color, confirm the swatch changes; press 🗑, confirm it disappears.

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Add the color palette panel with live-linked custom colors"
```

---

### Task 4: Drag a color onto a card, edge, or badge

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (state; `handleColorMouseDown` stub from Task 3; the `.hit` edge line ~line 1704; the filterbar status/tag chips from Task 2; the chip-ghost block ~line 1885; `IdeaCard` pills ~line 2316)

**Interfaces:**
- Consumes: `applyColorTo` from Task 1; `handleColorMouseDown` stub and `.pal-swatch` from Task 3; `chipDrag`/`dropTargetId`/`.chip-ghost` pattern from `handleChipMouseDown`.
- Produces: `colorDrag` state `{ token, x, y } | null`; `data-edge-id` on every edge hit line; `data-badge-kind` + `data-badge-id` on filterbar chips and card pills.

- [ ] **Step 1: State**

After the `paletteUI` state from Task 3:

```js
  const [colorDrag, setColorDrag] = useState(null); // { token, x, y } | null
```

- [ ] **Step 2: Fill in the drag handler**

Replace the `handleColorMouseDown` stub from Task 3 with:

```js
  function handleColorMouseDown(e, token) {
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    // Badge phải kiểm TRƯỚC thẻ: .status-pill nằm bên trong .idea-card, nếu xét
    // thẻ trước thì thả vào pill sẽ tô thẻ chứ không đổi màu badge.
    function colorTargetAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const badge = el.closest("[data-badge-kind][data-badge-id]");
      if (badge) return { kind: badge.getAttribute("data-badge-kind"), id: Number(badge.getAttribute("data-badge-id")) };
      const card = el.closest(".idea-card[data-id]");
      if (card) return { kind: "node", id: Number(card.getAttribute("data-id")) };
      const edge = el.closest("[data-edge-id]");
      if (edge) return { kind: "edge", id: Number(edge.getAttribute("data-edge-id")) };
      return null;
    }

    function onMove(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setColorDrag({ token, x: ev.clientX, y: ev.clientY });
      const target = colorTargetAt(ev.clientX, ev.clientY);
      setDropTargetId(target && target.kind === "node" ? { id: target.id, kind: "node" } : null);
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragging) return;
      const target = colorTargetAt(ev.clientX, ev.clientY);
      setColorDrag(null);
      setDropTargetId(null);
      if (target) commitAndSave(applyColorTo(board, target, token));
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
```

If Task 3's linter forced you to skip the `applyColorTo` import, add it now:
`import { paletteCss, applyColorTo, removePaletteColor } from "../lib/palette.js";`

- [ ] **Step 3: The drag ghost**

After the existing `{chipDrag && ( … )}` block (~line 1899):

```jsx
      {colorDrag && (
        <div className="chip-ghost" style={{ left: colorDrag.x, top: colorDrag.y }}>
          <span className="dot" style={{ background: colorVar(colorDrag.token) }}></span>
        </div>
      )}
```

`.chip-ghost` already has `pointer-events: none`, so it never occludes `elementFromPoint`.

- [ ] **Step 4: Drop-target attributes**

Edge hit line (~line 1704) — add `data-edge-id`:

```jsx
                  <line
                    className="hit"
                    data-edge-id={edge.id}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    onClick={(e) => { setColorMenu(null); setCommentsFor(null); setEdgeMenu({ id: edge.id, x: e.clientX, y: e.clientY }); }}
                  />
```

Filterbar status chip (Task 2's block) — add two attributes to the `<span className={"chip-toggle status" …}>` that renders a real status (NOT the "Không trạng thái" chip, which has no definition):

```jsx
                    data-badge-kind="status"
                    data-badge-id={s.id}
```

Same for the tag chip:

```jsx
                    data-badge-kind="tag"
                    data-badge-id={tg.id}
```

Card pills in `IdeaCard` (~line 2316) — replace the two IIFEs in `.meta-row`:

```jsx
        {(() => {
          const s = statusById(board, node.statusId);
          return s ? <span className="status-pill" data-badge-kind="status" data-badge-id={s.id} style={{ background: colorVar(s.color) }}>{s.name}</span> : null;
        })()}
        {(() => {
          const tg = tagById(board, node.tagId);
          return tg ? (
            <span className="tag-pill" data-badge-kind="tag" data-badge-id={tg.id}>
              <span className="dot" style={{ background: colorVar(tg.color) }}></span>
              {tg.name}
            </span>
          ) : null;
        })()}
```

- [ ] **Step 5: Build, verify, commit**

Run: `cd game-tools/client && npm run build && node --test src/lib/*.test.js`
Expected: build OK, 30 pass.

Manual check: drag a swatch onto a card (left stripe takes the color), onto an edge line (stroke and arrowhead take it), onto a filterbar chip and onto a card pill (both recolor the badge definition, so every card carrying it changes). Then edit that swatch's hex and confirm all three change at once.

```bash
git add game-tools/client/src/pages/IdeaMap.jsx
git commit -m "Apply palette colors by dragging them onto cards, edges, and badges"
```

---

## Out of scope (spec §Ngoài phạm vi)

Free-drag / rotate / snap panel docking (phase 2, separate spec); adding custom colors to the existing swatch rows in `ColorMenu` / `BadgeEditor` / `EdgeMenu` / `bulk-bar`; group color via drag-drop; persisting panel open state across reload; color count limits or color names.
