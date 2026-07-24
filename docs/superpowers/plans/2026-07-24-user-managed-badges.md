# Trạng thái & Nhãn do người dùng tự quản — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng tự tạo/đổi tên/đổi màu/xoá các badge trạng thái và nhãn (chuột phải chip để sửa, nút "+" để tạo), thay cho danh sách trạng thái cứng trong code.

**Architecture:** Trạng thái và nhãn trở thành mảng định nghĩa keyed lưu trong document board (`board.statuses`, `board.tags`); thẻ trỏ `node.statusId`/`node.tagId`. Server di trú board cũ một lần, idempotent. Client bỏ hằng số cứng, đọc định nghĩa từ board; thêm popover sửa badge gắn trên chip lọc.

**Tech Stack:** Express + Mongoose (server), React 18 + Vite 6 + Lingui 6.5.0 (client). Không có test framework.

**Spec:** `docs/superpowers/specs/2026-07-24-user-managed-badges-design.md`

## Global Constraints

Mọi task tuân thủ, không nhắc lại:

- **Nhánh:** `feature/user-managed-badges` (đã tạo từ main). Client trong `game-tools/client/`, server trong `game-tools/server/`.
- **KHÔNG dịch tên badge** — là dữ liệu người dùng. Không bọc `<Trans>`/`t` quanh `def.name`, `node.title/desc`. Các chuỗi UI thuần (nhãn "Không trạng thái", "Không nhãn", tooltip, nút) **có** dịch như phần i18n đã làm: `<Trans>` trong JSX, `` t`...` `` (macro từ `@lingui/react/macro` cho `useLingui`, hoặc `@lingui/core/macro` cho helper ngoài component) trong thuộc tính.
- **Lingui đúng 6.5.0**, macro từ `@lingui/react/macro` và `@lingui/core/macro`, không dùng `@lingui/macro`.
- **KHÔNG dựng test framework.** Verify mỗi task: `npm run i18n:extract` (0 thiếu) + `npm run build` + kiểm bằng mắt. Không viết file test.
- **Màu lưu dạng token = tên CSS var không có `--`** (ví dụ `"st-chosen"`, `"dot-3"`), resolve `var(--${token})`. Không lưu hex.
- **Không đụng:** `client/src/lib/useTheme.js`, `client/src/lib/i18n.js`, `client/src/pages/Home.jsx`, `client/src/pages/Calculator.jsx`.
- **Commit sau mỗi task**, không gộp. Kết thúc git commit bằng:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Mô hình dữ liệu (tham chiếu chung)

```
board.statuses = [{ id: <int>, name: <string>, color: <token> }, …]   // có thứ tự
board.tags     = [{ id: <int>, name: <string>, color: <token> }, …]
board.nextStatusId = <int>
board.nextTagId    = <int>
node.statusId = <int> | null     // thay node.status (key string)
node.tagId    = <int> | null     // thay node.tag (name string)
```

5 trạng thái mặc định (id 1–5, giữ nguyên tên + màu hiện tại):

| id | name | color token |
|----|------|-------------|
| 1 | Ý tưởng mới | `st-idea` |
| 2 | Đang cân nhắc | `st-considering` |
| 3 | Đã chọn | `st-chosen` |
| 4 | Gác lại | `st-parked` |
| 5 | Đã loại | `st-rejected` |

Ánh xạ key cũ → id: `idea→1, considering→2, chosen→3, parked→4, rejected→5`.

Bảng màu chọn được (13 token): `st-idea, st-considering, st-chosen, st-parked, st-rejected, dot-1 … dot-8`.

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `game-tools/server/index.js` | **Sửa.** Thêm 4 field vào schema, PUT lưu chúng, hàm `migrateBoard`, cập nhật `defaultIdeas` |
| `game-tools/client/src/lib/badges.js` | **Tạo.** Hằng số `BADGE_PALETTE` + helper `colorVar`/`statusById`/`tagById` |
| `game-tools/client/src/components/BadgeEditor.jsx` | **Tạo.** Popover nhập tên + chọn màu, dùng cho cả tạo và sửa |
| `game-tools/client/src/pages/IdeaMap.jsx` | **Sửa.** Bỏ hằng số cứng, đọc định nghĩa từ board; thêm nút "+", chuột phải sửa badge |
| `game-tools/client/src/styles/idea-map.css` | **Sửa.** Style `.fb-add`, `.badge-editor`, swatch |

---

## Task 1: Server — schema, lưu field mới, di trú, seed

- [x] **HOÀN THÀNH TASK 1** — tick sau khi xong và pass review

**Files:**
- Modify: `game-tools/server/index.js`

**Interfaces:**
- Produces: `GET /api/ideas` trả board có `statuses`, `tags`, `nextStatusId`, `nextTagId`; mỗi node có `statusId`/`tagId` (không còn `status`/`tag`). `PUT /api/ideas` lưu đủ 9 field.

- [ ] **Step 1: Thêm 4 field vào `ideaBoardSchema`**

Trong `game-tools/server/index.js`, thay khối schema (dòng 23–33) thành:

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

`default: undefined` để `migrateBoard` phân biệt "chưa có" (cần di trú) với "đã có mảng rỗng".

- [ ] **Step 2: Cập nhật `defaultIdeas` sang mô hình mới**

Thay khối `defaultIdeas` (dòng 48–62) thành:

```js
const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];
const STATUS_KEY_TO_ID = { idea: 1, considering: 2, chosen: 3, parked: 4, rejected: 5 };

const defaultIdeas = {
  nodes: [
    { id: 1, title: "Ngân sách điểm chiến đấu", desc: "500 điểm chia vào Máu / Giáp / Xuyên giáp / Tấn công. Đây là cốt lõi giữ chân người chơi.", tagId: 1, statusId: 3, x: 60, y: 40 },
    { id: 2, title: "Hệ vũ khí (tam giác)", desc: "3 loại khắc chế vòng tròn, kiểu Fire Emblem. Làm trước hệ nguyên tố.", tagId: 1, statusId: 2, x: 360, y: 40 },
    { id: 3, title: "5 phe", desc: "Đề xuất bắt đầu 2-3 phe để giảm khối lượng cân bằng ban đầu.", tagId: 2, statusId: 4, x: 60, y: 260 },
    { id: 4, title: "Leo hạng / Elo online", desc: "Chỉ thêm sau khi core loop đã vui và có đủ người chơi để ghép trận.", tagId: 3, statusId: 4, x: 360, y: 260 }
  ],
  edges: [
    { id: 1, from: 1, to: 2 },
    { id: 2, from: 1, to: 3 }
  ],
  statuses: DEFAULT_STATUSES,
  tags: [
    { id: 1, name: "Cơ chế", color: "dot-1" },
    { id: 2, name: "Nội dung", color: "dot-2" },
    { id: 3, name: "Kỹ thuật", color: "dot-3" }
  ],
  nextNodeId: 5,
  nextEdgeId: 3,
  nextStatusId: 6,
  nextTagId: 4,
  view: { panX: 60, panY: 60, scale: 1 }
};
```

- [ ] **Step 3: Thêm hàm `hashTagToken` và `migrateBoard`**

Ngay trước `async function ensureSeed()` (dòng 75), thêm:

```js
const DOT_COUNT = 8;
function hashTagToken(name) {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "dot-" + ((h % DOT_COUNT) + 1);
}

// Di trú một board cũ (node.status key + node.tag string) sang mô hình keyed.
// Idempotent: chỉ chạy phần còn thiếu. Trả về true nếu có thay đổi.
function migrateBoard(doc) {
  let changed = false;

  if (!Array.isArray(doc.statuses)) {
    doc.statuses = DEFAULT_STATUSES.map((s) => ({ ...s }));
    doc.nextStatusId = 6;
    (doc.nodes || []).forEach((n) => {
      n.statusId = STATUS_KEY_TO_ID[n.status] ?? null;
      delete n.status;
    });
    changed = true;
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
    changed = true;
  }

  return changed;
}
```

- [ ] **Step 4: Chạy di trú trong `GET /api/ideas` và lưu lại**

Thay handler GET (dòng 94–101) thành:

```js
app.get("/api/ideas", async (req, res) => {
  try {
    const doc = await IdeaBoard.findOne({ singleton: "main" });
    const obj = doc.toObject();
    if (migrateBoard(obj)) {
      await IdeaBoard.findOneAndUpdate(
        { singleton: "main" },
        {
          nodes: obj.nodes,
          statuses: obj.statuses,
          tags: obj.tags,
          nextStatusId: obj.nextStatusId,
          nextTagId: obj.nextTagId
        }
      );
    }
    delete obj._id;
    delete obj.singleton;
    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu ý tưởng." });
  }
});
```

- [ ] **Step 5: Lưu field mới trong `PUT /api/ideas`**

Thay handler PUT (dòng 103–115) thành:

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

- [ ] **Step 6: Kiểm chứng — server chạy, GET trả mô hình mới**

Cần MongoDB. Nếu `server/.env` có `MONGODB_URI`:

```bash
cd game-tools/server
node --check index.js && echo "cú pháp OK"
```

Kỳ vọng: "cú pháp OK". Nếu server đang chạy được (có Mongo), khởi động và gọi:

```bash
curl -s http://localhost:3001/api/ideas | head -c 400
```

Kỳ vọng: JSON có `"statuses":[...]`, `"tags":[...]`, và các node có `"statusId"`/`"tagId"`, **không còn** `"status"`/`"tag"` chuỗi. Nếu không chạy được Mongo trong môi trường, báo rõ đã kiểm `node --check` và để lại verify runtime cho controller.

- [ ] **Step 7: Commit**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add game-tools/server/index.js
git commit -m "Store status and tag definitions in the board and migrate old data

Statuses and tags become keyed arrays on the board document; nodes carry
statusId/tagId. GET migrates an old board once (idempotent) — status key
-> statusId, tag string -> tagId — preserving each badge's name and
colour, and persists the result. PUT now saves the new fields (it
silently dropped anything outside its destructure before).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Client foundation — đọc định nghĩa từ board (không đổi giao diện)

- [ ] **HOÀN THÀNH TASK 2** — tick sau khi xong và pass review

Refactor mọi chỗ dùng `STATUS`/`STATUS_ORDER`/`DOT_PALETTE`/`hashTag`/`node.status`/`node.tag` sang đọc `board.statuses`/`board.tags` theo id. **Cuối task app trông y hệt hiện tại** — đây là mốc verify quan trọng nhất.

**Files:**
- Create: `game-tools/client/src/lib/badges.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Consumes từ Task 1: board có `statuses`/`tags`/`nextStatusId`/`nextTagId`, node có `statusId`/`tagId`.
- Produces cho Task 3–4:
  - `lib/badges.js` xuất `BADGE_PALETTE: string[]`, `colorVar(token): string`, `statusById(board, id): def|null`, `tagById(board, id): def|null`
  - Filter state `filterStatus`/`filterTags` keyed bằng `String(id)` và khoá đặc biệt `"none"`
  - Node mới tạo: `statusId = board.statuses[0]?.id ?? null`, `tagId = null`

- [ ] **Step 1: Tạo `src/lib/badges.js`**

```js
export const BADGE_PALETTE = [
  "st-idea", "st-considering", "st-chosen", "st-parked", "st-rejected",
  "dot-1", "dot-2", "dot-3", "dot-4", "dot-5", "dot-6", "dot-7", "dot-8"
];

export function colorVar(token) {
  return `var(--${token})`;
}

export function statusById(board, id) {
  return board.statuses.find((s) => s.id === id) || null;
}

export function tagById(board, id) {
  return board.tags.find((t) => t.id === id) || null;
}
```

- [ ] **Step 2: Sửa import và bỏ hằng số cứng trong `IdeaMap.jsx`**

Thay dòng import (1–9) — thêm import badges, **bỏ dòng `import { t } from "@lingui/core/macro"`** vì chỗ duy nhất dùng nó (`tagLabel` ở cấp module) bị xoá ở Step 2; `t` trong component vẫn có từ `useLingui()`:

```jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { getIdeas, saveIdeas } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import { BADGE_PALETTE, colorVar, statusById, tagById } from "../lib/badges.js";
import LoadError from "../components/LoadError.jsx";
import LocaleToggle from "../components/LocaleToggle.jsx";
import "../styles/idea-map.css";
```

Xoá hẳn khối hằng số cứng (dòng 11–33 hiện tại): `STATUS`, `STATUS_ORDER`, `TAG_SUGGESTIONS`, `DOT_PALETTE`, `hashTag`, `tagLabel`. Giữ lại `CARD_W`, `MIN_SCALE`, `MAX_SCALE`, `computeZoom`. Sau khi xoá, phần đầu file còn:

```jsx
const CARD_W = 210;
const MIN_SCALE = 0.3, MAX_SCALE = 2.4;

function computeZoom(currentBoard, rect, screenX, screenY, factor) {
```

- [ ] **Step 3: Sửa `passesFilter` — lọc theo id + khoá "none"**

Thay hàm `passesFilter`:

```jsx
  function passesFilter(node) {
    const statusKeys = Object.keys(filterStatus).filter((k) => filterStatus[k]);
    if (statusKeys.length) {
      const key = node.statusId == null ? "none" : String(node.statusId);
      if (!filterStatus[key]) return false;
    }
    const tagKeys = Object.keys(filterTags).filter((k) => filterTags[k]);
    if (tagKeys.length) {
      const key = node.tagId == null ? "none" : String(node.tagId);
      if (!filterTags[key]) return false;
    }
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = (node.title + " " + node.desc).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }
```

- [ ] **Step 4: Sửa `createNode` và `createLinkedNode` — dùng statusId/tagId**

Trong `createNode`, thay dòng tạo `node`:

```jsx
    const node = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: board.statuses[0]?.id ?? null, x: Math.round(x), y: Math.round(y) };
```

Trong `createLinkedNode`, thay dòng tạo `newNode`:

```jsx
    const newNode = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: board.statuses[0]?.id ?? null, x: Math.round(x), y: Math.round(y) };
```

- [ ] **Step 5: Sửa `applyChipToNode` — gán theo id, "none" = null**

Thay hàm:

```jsx
  function applyChipToNode(nodeId, kind, value) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const nextVal = value === "none" ? null : Number(value);
    if (kind === "status") {
      if (node.statusId === nextVal) return;
      commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, statusId: nextVal } : n)) });
    } else {
      if ((node.tagId ?? null) === nextVal) return;
      commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, tagId: nextVal } : n)) });
    }
  }
```

`handleChipMouseDown(e, kind, value)` giữ nguyên chữ ký — nhưng `value` giờ là `String(id)` hoặc `"none"` (do chỗ gọi truyền vào ở Step 7).

- [ ] **Step 6: Sửa `saveNodeEdit` — không đổi (nhận fields từ IdeaCard)**

`saveNodeEdit` giữ nguyên; IdeaCard (Step 9) sẽ truyền `{ title, desc, tagId, statusId }`.

- [ ] **Step 7: Thay thanh lọc — chip từ `board.statuses`/`board.tags` + chip "none"**

Trước khối `return`, thay các biến dẫn xuất. Xoá dòng `distinctTags` cũ, thay bằng:

```jsx
  const hasNoStatus = board.nodes.some((n) => n.statusId == null);
  const hasNoTag = board.nodes.some((n) => n.tagId == null);
  const activeFilterCount =
    Object.values(filterStatus).filter(Boolean).length +
    Object.values(filterTags).filter(Boolean).length +
    (search.trim() ? 1 : 0);
  const matchCount = board.nodes.filter(passesFilter).length;
```

Thay toàn bộ khối `<div className="filterbar">…</div>` (dòng 632–681) thành:

```jsx
      <div className="filterbar">
        <div className="fb-group">
          <span className="fb-label"><Trans>Trạng thái</Trans></span>
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

        <div className="fb-group">
          <span className="fb-label"><Trans>Nhãn</Trans></span>
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
```

> Ghi chú: `openBadgeMenu`, `openBadgeCreate` được thêm ở Task 3–4. Trong Task 2, thêm **bản rỗng tạm** để build chạy: `function openBadgeMenu() {}` và `function openBadgeCreate() {}` đặt cạnh `clearFilters`. Task 3–4 sẽ thay bằng bản thật.

- [ ] **Step 8: Sửa chip-ghost và bỏ `<datalist>`**

Thay khối chip-ghost (dòng 781–786):

```jsx
      {chipDrag && (
        <div className="chip-ghost" style={{ left: chipDrag.x, top: chipDrag.y }}>
          {(() => {
            const def = chipDrag.value === "none"
              ? null
              : (chipDrag.kind === "status" ? statusById(board, Number(chipDrag.value)) : tagById(board, Number(chipDrag.value)));
            return (
              <>
                <span className="dot" style={{ background: def ? colorVar(def.color) : "transparent" }}></span>
                {def ? def.name : (chipDrag.kind === "status" ? t`Không trạng thái` : t`Không nhãn`)}
              </>
            );
          })()}
        </div>
      )}
```

Xoá hẳn khối `<datalist id="tagOptions">…</datalist>` (dòng 788–790).

- [ ] **Step 9: Sửa `IdeaCard` — pill theo id, form dùng dropdown**

Thay chữ ký state và effect trong `IdeaCard` (dòng 795–807):

```jsx
function IdeaCard({ node, board, editing, dimmed, linkPending, dropTarget, selected, onMouseDown, onClick, onConnectorMouseDown, onEdit, onDelete, onSave, onCancel }) {
  const { t } = useLingui();
  const [title, setTitle] = useState(node.title);
  const [desc, setDesc] = useState(node.desc);
  const [tagId, setTagId] = useState(node.tagId ?? null);
  const [statusId, setStatusId] = useState(node.statusId ?? null);

  useEffect(() => {
    if (editing) {
      setTitle(node.title); setDesc(node.desc); setTagId(node.tagId ?? null); setStatusId(node.statusId ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
```

Thay khối form sửa (dòng 818–831) — ô Nhãn và Trạng thái thành `<select>` từ board:

```jsx
        <div className="edit-form">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t`Tên ý tưởng`} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t`Mô tả ngắn`} />
          <div className="edit-row">
            <select value={tagId ?? ""} onChange={(e) => setTagId(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t`Không nhãn`}</option>
              {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </select>
            <select value={statusId ?? ""} onChange={(e) => setStatusId(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t`Không trạng thái`}</option>
              {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="edit-actions">
            <button className="save-btn" onClick={() => onSave({ title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId })}><Trans>Lưu</Trans></button>
            <button className="cancel-btn" onClick={onCancel}><Trans>Hủy</Trans></button>
          </div>
        </div>
```

Thay khối `.meta-row` (dòng 852–860) — pill theo id, null → không hiện:

```jsx
      <div className="meta-row">
        {(() => {
          const s = statusById(board, node.statusId);
          return s ? <span className="status-pill" style={{ background: colorVar(s.color) }}>{s.name}</span> : null;
        })()}
        {(() => {
          const tg = tagById(board, node.tagId);
          return tg ? (
            <span className="tag-pill">
              <span className="dot" style={{ background: colorVar(tg.color) }}></span>
              {tg.name}
            </span>
          ) : null;
        })()}
      </div>
```

- [ ] **Step 10: Truyền `board` xuống `IdeaCard`**

Trong danh sách render (dòng 729–746), thêm prop `board={board}`:

```jsx
            <IdeaCard
              key={node.id}
              node={node}
              board={board}
              editing={editingId === node.id}
```

(giữ nguyên các prop còn lại)

- [ ] **Step 11: Kiểm chứng — extract 0 thiếu, build**

```bash
cd game-tools/client
npm run i18n:extract
npm run build
```

Kỳ vọng: `Missing` = 0 cả vi/en; build `✓ built in ...`. Sửa mọi lỗi biên dịch (thường do sót một chỗ còn `STATUS[`/`hashTag(`/`node.status`/`node.tag`).

- [ ] **Step 12: Kiểm chứng bằng mắt — KHÔNG hồi quy**

Cần server (Mongo) chạy với dữ liệu đã di trú từ Task 1. Build rồi `npx vite preview --port 4173` (proxy `/api` sang :3001), dump headless:

```bash
/opt/google/chrome/chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/claude-1038/-home-chaupt-Documents-untitled-folder-my-g/a52b3dcb-59a4-49db-97f0-5668d9965cc2/scratchpad/t2b-prof --virtual-time-budget=9000 --dump-dom http://localhost:PORT/idea-map > /tmp/dump.html
grep -oE 'Đã chọn|Đang cân nhắc|Cơ chế|Nội dung' /tmp/dump.html | sort -u
```

Kỳ vọng: các trạng thái/nhãn hiện đúng tên tiếng Việt như trước, đúng màu, đúng vị trí. Thẻ, lọc, kéo-thả chip vẫn hoạt động. Nếu không chạy được Mongo, báo rõ và để controller kiểm.

- [ ] **Step 13: Commit**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add game-tools/client/src/lib/badges.js game-tools/client/src/pages/IdeaMap.jsx
git commit -m "Read status and tag definitions from the board instead of constants

Drops the hardcoded STATUS/DOT_PALETTE/hashTag/TAG_SUGGESTIONS and reads
board.statuses/board.tags by id everywhere: filter chips, card pills,
edit form (now dropdowns), chip-ghost, drag-assign. Nodes reference
statusId/tagId; null renders as no pill and a 'no status'/'no tag'
filter chip. Purely data-driven — the UI is unchanged this task.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Client — tạo badge qua nút "+"

- [x] **HOÀN THÀNH TASK 3** — tick sau khi xong và pass review

**Files:**
- Create: `game-tools/client/src/components/BadgeEditor.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `BADGE_PALETTE`, `colorVar` từ `lib/badges.js`; board có `nextStatusId`/`nextTagId`.
- Produces cho Task 4: component `BadgeEditor` (popover nhập tên + màu); state `badgeUI` mô tả popover đang mở; hàm `createBadge(kind, name, color)`.

- [ ] **Step 1: Tạo `src/components/BadgeEditor.jsx`**

Popover dùng chung cho tạo và sửa. Nhận giá trị ban đầu, gọi `onSubmit(name, color)`.

```jsx
import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";

export default function BadgeEditor({ x, y, initialName, initialColor, submitLabel, onSubmit, onClose }) {
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

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  }

  return (
    <div className="badge-editor" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="be-name"
        type="text"
        autoFocus
        value={name}
        placeholder={t`Tên badge`}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      />
      <div className="be-swatches">
        {BADGE_PALETTE.map((token) => (
          <button
            key={token}
            className={"be-swatch" + (token === color ? " on" : "")}
            style={{ background: colorVar(token) }}
            onClick={() => setColor(token)}
            title={token}
          />
        ))}
      </div>
      <div className="be-actions">
        <button className="save-btn" onClick={submit}>{submitLabel}</button>
        <button className="cancel-btn" onClick={onClose}><Trans>Hủy</Trans></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Thêm state `badgeUI` và import BadgeEditor trong IdeaMap**

Thêm import sau `LocaleToggle`:

```jsx
import BadgeEditor from "../components/BadgeEditor.jsx";
```

Thêm state cạnh các `useState` khác (sau `marquee`):

```jsx
  const [badgeUI, setBadgeUI] = useState(null); // { mode: "create"|"edit", kind, def?, x, y }
```

- [ ] **Step 3: Thay bản rỗng `openBadgeCreate` bằng bản thật; thêm `createBadge`**

Thay `function openBadgeCreate() {}` (bản tạm từ Task 2) bằng:

```jsx
  function openBadgeCreate(e, kind) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setBadgeUI({ mode: "create", kind, x: r.left, y: r.bottom + 4 });
  }

  function createBadge(kind, name, color) {
    if (kind === "status") {
      const id = board.nextStatusId;
      commitAndSave({ ...board, statuses: [...board.statuses, { id, name, color }], nextStatusId: id + 1 });
    } else {
      const id = board.nextTagId;
      commitAndSave({ ...board, tags: [...board.tags, { id, name, color }], nextTagId: id + 1 });
    }
    setBadgeUI(null);
  }
```

- [ ] **Step 4: Render BadgeEditor khi `badgeUI.mode === "create"`**

Ngay trước `<datalist>`… — thực ra datalist đã xoá — thêm ngay trước dòng đóng `</div>` cuối cùng của component (sau khối chip-ghost):

```jsx
      {badgeUI && badgeUI.mode === "create" && (
        <BadgeEditor
          x={badgeUI.x}
          y={badgeUI.y}
          initialName=""
          initialColor={BADGE_PALETTE[0]}
          submitLabel={t`Tạo`}
          onSubmit={(name, color) => createBadge(badgeUI.kind, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
```

- [ ] **Step 5: Thêm CSS cho `.fb-add` và `.badge-editor`**

Thêm vào cuối `src/styles/idea-map.css`:

```css
.fb-add {
  border: 1px dashed var(--line); border-radius: 999px; background: none;
  color: var(--ink-dim); width: 22px; height: 22px; line-height: 1; cursor: pointer;
  font-size: 14px; display: inline-flex; align-items: center; justify-content: center;
}
.fb-add:hover { color: var(--ink); border-color: var(--ink-dim); }
.dot-empty { border: 1px dashed var(--ink-dim); background: transparent !important; }

.badge-editor {
  position: fixed; z-index: 90; width: 220px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  box-shadow: var(--shadow); padding: 10px; display: flex; flex-direction: column; gap: 8px;
}
.badge-editor .be-name {
  width: 100%; background: var(--bg); border: 1px solid var(--line);
  border-radius: 4px; padding: 5px 7px; font-size: 12px;
}
.badge-editor .be-swatches { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.badge-editor .be-swatch {
  width: 100%; aspect-ratio: 1; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0;
}
.badge-editor .be-swatch.on { border-color: var(--ink); }
.badge-editor .be-actions { display: flex; gap: 6px; }
.badge-editor .be-actions button { flex: 1; font-size: 11px; padding: 5px; border-radius: 4px; cursor: pointer; }
.badge-editor .save-btn { background: var(--accent); color: var(--accent-ink); border: none; }
.badge-editor .cancel-btn { background: transparent; color: var(--ink-dim); border: 1px solid var(--line); }
```

- [ ] **Step 6: Kiểm chứng — extract, build**

```bash
cd game-tools/client
npm run i18n:extract
npm run build
```

Kỳ vọng: Missing 0; build pass. Bản dịch EN cho các chuỗi mới (`Tên badge`, `Tạo`, `Thêm trạng thái`, `Thêm nhãn`, `Không trạng thái`, `Không nhãn`, `Lọc thẻ chưa có trạng thái`, `Lọc thẻ chưa gắn nhãn`, và tooltip chip có "chuột phải để sửa") điền vào `src/locales/en/messages.po`:

| msgid | msgstr |
|---|---|
| `Tên badge` | `Badge name` |
| `Tạo` | `Create` |
| `Thêm trạng thái` | `Add status` |
| `Thêm nhãn` | `Add tag` |
| `Không trạng thái` | `No status` |
| `Không nhãn` | `No tag` |
| `Lọc thẻ chưa có trạng thái` | `Filter cards with no status` |
| `Lọc thẻ chưa gắn nhãn` | `Filter cards with no tag` |
| `Bấm để lọc — kéo thả vào thẻ để gán trạng thái — chuột phải để sửa` | `Click to filter — drag onto a card to assign — right-click to edit` |
| `Bấm để lọc — kéo thả vào thẻ để gán nhãn — chuột phải để sửa` | `Click to filter — drag onto a card to assign — right-click to edit` |

Chạy lại `npm run i18n:extract` xác nhận Missing 0.

- [ ] **Step 7: Kiểm chứng bằng mắt — controller click thật**

Headless không click được. Báo rõ: build pass + cấu trúc đúng; nhờ controller/người dùng bấm nút "+" tạo badge và xác nhận nó xuất hiện ở chip lọc và dropdown form.

- [ ] **Step 8: Commit**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add game-tools/client/src/components/BadgeEditor.jsx game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Add badge creation via a per-group + button

Each filter group gets a + that opens a small popover (name field plus a
colour-swatch palette). Submitting appends a new status/tag definition
to the board with a fresh id. The popover component is shared so the
edit flow in the next task reuses it.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Client — chuột phải sửa badge (đổi tên / đổi màu / xoá)

- [x] **HOÀN THÀNH TASK 4** — tick sau khi xong và pass review

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `BadgeEditor`, `badgeUI` state, `openBadgeMenu` (bản rỗng từ Task 2).
- Produces: hàm `updateBadge`/`deleteBadge` mutate `board.statuses`/`board.tags` và gỡ khỏi node khi xoá.

- [ ] **Step 1: Thay bản rỗng `openBadgeMenu` bằng bản thật**

Thay `function openBadgeMenu() {}` (bản tạm từ Task 2) bằng:

```jsx
  function openBadgeMenu(e, kind, def) {
    e.preventDefault();
    e.stopPropagation();
    setBadgeUI({ mode: "edit", kind, def, x: e.clientX, y: e.clientY });
  }
```

- [ ] **Step 2: Thêm `updateBadge` và `deleteBadge`**

Thêm cạnh `createBadge`:

```jsx
  function updateBadge(kind, id, name, color) {
    if (kind === "status") {
      commitAndSave({ ...board, statuses: board.statuses.map((s) => (s.id === id ? { ...s, name, color } : s)) });
    } else {
      commitAndSave({ ...board, tags: board.tags.map((t) => (t.id === id ? { ...t, name, color } : t)) });
    }
    setBadgeUI(null);
  }

  function deleteBadge(kind, id) {
    if (kind === "status") {
      commitAndSave({
        ...board,
        statuses: board.statuses.filter((s) => s.id !== id),
        nodes: board.nodes.map((n) => (n.statusId === id ? { ...n, statusId: null } : n))
      });
    } else {
      commitAndSave({
        ...board,
        tags: board.tags.filter((t) => t.id !== id),
        nodes: board.nodes.map((n) => (n.tagId === id ? { ...n, tagId: null } : n))
      });
    }
    setBadgeUI(null);
  }
```

- [ ] **Step 3: Render BadgeEditor ở chế độ "edit" với nút Xoá**

Thay khối render BadgeEditor (từ Task 3) để xử lý cả hai chế độ:

```jsx
      {badgeUI && badgeUI.mode === "create" && (
        <BadgeEditor
          x={badgeUI.x}
          y={badgeUI.y}
          initialName=""
          initialColor={BADGE_PALETTE[0]}
          submitLabel={t`Tạo`}
          onSubmit={(name, color) => createBadge(badgeUI.kind, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
      {badgeUI && badgeUI.mode === "edit" && (
        <BadgeEditor
          x={badgeUI.x}
          y={badgeUI.y}
          initialName={badgeUI.def.name}
          initialColor={badgeUI.def.color}
          submitLabel={t`Lưu`}
          onDelete={() => deleteBadge(badgeUI.kind, badgeUI.def.id)}
          onSubmit={(name, color) => updateBadge(badgeUI.kind, badgeUI.def.id, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
```

- [ ] **Step 4: Thêm nút Xoá vào `BadgeEditor` khi có `onDelete`**

Trong `BadgeEditor.jsx`, thêm `onDelete` vào props và render nút xoá. Thay khối `.be-actions`:

```jsx
      <div className="be-actions">
        {onDelete && <button className="be-delete" onClick={onDelete} title={t`Xoá badge`}>🗑</button>}
        <button className="save-btn" onClick={submit}>{submitLabel}</button>
        <button className="cancel-btn" onClick={onClose}><Trans>Hủy</Trans></button>
      </div>
```

Cập nhật dòng khai báo props: `export default function BadgeEditor({ x, y, initialName, initialColor, submitLabel, onSubmit, onClose, onDelete })`.

- [ ] **Step 5: CSS nút xoá**

Thêm vào `src/styles/idea-map.css`:

```css
.badge-editor .be-delete {
  background: transparent; border: 1px solid var(--line); color: var(--danger);
  border-radius: 4px; padding: 5px 8px; font-size: 12px; cursor: pointer; flex: 0 0 auto;
}
.badge-editor .be-delete:hover { border-color: var(--danger); }
```

- [ ] **Step 6: Kiểm chứng — extract, build, điền dịch**

```bash
cd game-tools/client
npm run i18n:extract
npm run build
```

Điền EN cho chuỗi mới vào `src/locales/en/messages.po`:

| msgid | msgstr |
|---|---|
| `Xoá badge` | `Delete badge` |

(`Lưu`, `Hủy` đã có từ trước.) Chạy lại extract, Missing 0.

- [ ] **Step 7: Kiểm chứng bằng mắt — controller/người dùng click thật**

Headless không click/chuột phải được. Báo rõ build pass + cấu trúc đúng; nhờ kiểm: chuột phải chip → popover; đổi tên → mọi thẻ đổi theo; đổi màu → pill + chip đổi; xoá badge đang dùng → thẻ về "không trạng thái"/"không nhãn".

- [ ] **Step 8: Commit**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add game-tools/client/src/components/BadgeEditor.jsx game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/src/locales
git commit -m "Edit and delete badges by right-clicking a filter chip

Right-clicking a status/tag chip opens the shared popover pre-filled for
rename and recolour; a trash button deletes the definition and unassigns
it from every node that used it (statusId/tagId -> null), which is why a
card can now show no status pill. Rename/recolour never touch a node
because nodes reference the definition by id.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Rà soát cuối và kiểm chứng toàn diện

- [ ] **HOÀN THÀNH TASK 5** — tick sau khi xong và pass review

**Files:**
- Modify: file còn sót (nếu có)

- [ ] **Step 1: Quét tham chiếu cũ còn sót**

```bash
cd game-tools/client/src
grep -rn "STATUS\[\|STATUS_ORDER\|DOT_PALETTE\|hashTag\|TAG_SUGGESTIONS\|node\.status\b\|node\.tag\b\|tagOptions\|tagLabel" pages/ components/ lib/ --include="*.jsx" --include="*.js"
```

Kỳ vọng: **không dòng nào**. Còn sót nghĩa là chưa refactor hết — sửa rồi chạy lại.

- [ ] **Step 2: Quét chuỗi tiếng Việt chưa bọc**

```bash
cd game-tools/client/src
grep -rn "[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]" pages/ components/ lib/ --include="*.jsx" --include="*.js" | grep -v "Trans>" | grep -v "t\`"
```

Mỗi dòng in ra phải là: chuỗi trong catalog `.po`, hoặc chú thích. Không được có chuỗi UI chưa bọc. (Không còn `STATUS`/`TAG_SUGGESTIONS` vì đã xoá.)

- [ ] **Step 3: Kiểm chứng tự động**

```bash
cd game-tools/client
npm run i18n:extract
npm run build
```

Kỳ vọng: Missing 0 cả hai ngữ; build pass.

- [ ] **Step 4: Kiểm chứng bằng mắt toàn diện (server + client)**

Cần Mongo. Checklist:

| Việc | Kỳ vọng |
|---|---|
| Mở board đã di trú | Mọi thẻ đúng trạng thái/nhãn, màu, tên như trước |
| Tạo badge mới ("+") | Hiện ở chip lọc và dropdown form |
| Đổi tên badge (chuột phải) | Mọi thẻ dùng nó đổi tên tức thì |
| Đổi màu | Pill + chip đổi màu, đúng sáng/tối |
| Xoá badge đang dùng | Thẻ về "không trạng thái"/"không nhãn"; chip biến mất |
| Lọc "Không trạng thái"/"Không nhãn" | Chỉ hiện thẻ tương ứng |
| Kéo-thả chip gán badge | Vẫn hoạt động (gán theo id) |
| Đổi ngữ VI/EN | Chữ UI đổi; tên badge (dữ liệu) giữ nguyên |

Nếu không chạy được Mongo, báo rõ đã kiểm phần nào, để controller/người dùng kiểm phần click.

- [ ] **Step 5: Commit (nếu có sửa ở Step 1–2)**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add -A game-tools/client/src
git commit -m "Sweep for leftover hardcoded badge references and verify end to end

Greps the source for any surviving STATUS/hashTag/node.status/node.tag
references and unwrapped Vietnamese, and runs the full manual checklist
across both locales after the migration.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Đã tự rà lại

- **Phủ spec:** mục 3 mô hình → Task 1–2; mục 4 di trú → Task 1; mục 5 tầng nền → Task 2; mục 6 tính năng sửa → Task 3–4; mục 7 tương tác code cũ (không dịch tên badge, popover chỉ ở filterbar) → Global Constraints + Task 3–4; mục 8 thứ tự → Task 1→2→3→4→5; mục 9 kiểm chứng → bước cuối mỗi task + Task 5.
- **Không placeholder:** mọi step có code hoặc lệnh cụ thể; bản dịch EN cho chuỗi mới liệt kê đầy đủ.
- **Nhất quán tên gọi:** `board.statuses`/`board.tags`/`statusId`/`tagId`/`nextStatusId`/`nextTagId` dùng thống nhất server↔client; `colorVar`/`statusById`/`tagById`/`BADGE_PALETTE` từ `lib/badges.js` dùng ở IdeaMap + BadgeEditor; `badgeUI`/`openBadgeCreate`/`openBadgeMenu`/`createBadge`/`updateBadge`/`deleteBadge` khớp giữa Task 2 (bản rỗng) → Task 3–4 (bản thật); màu token khớp giữa server seed (`st-*`/`dot-*`) và `BADGE_PALETTE`.
