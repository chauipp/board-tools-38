# Idea Map Tree Layout (4 Directions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a right-clicked root card (or frame), rearrange it and everything wired to it into a tidy tree opening in whichever of four directions (down/up/right/left) the user clicks.

**Architecture:** Two pure functions in a new `client/src/lib/tree-layout.js` do all the thinking — `buildTree` walks the edge list breadth-first from the root (treating every edge as undirected) to produce a parent→children map, and `treeLayout` turns that map plus a caller-supplied `sizeOf` callback into absolute `{x, y}` coordinates. Neither touches React state or the DOM, so both are testable with `node:test`. `IdeaMap.jsx` supplies the DOM-measuring `sizeOf`, calls them from a new `arrangeAsTree(rootKind, rootId, direction)`, and persists the result through the existing `commitAndSave` path (which already handles undo history, server save, and realtime broadcast). `ColorMenu.jsx` grows a row of four arrow buttons, rendered for both the card and frame context menus.

**Tech Stack:** React 19 (hooks, no class components), Vite, `@lingui/react/macro` for i18n (`t` template tag + `<Trans>`), `node:test` + `node:assert/strict` for tests (no vitest/jest), plain ES modules.

## Global Constraints

- New feature is **independent** of the existing "Xếp gọn" (`tidySelection` / `layerLayout` in `lib/layout.js`) — do not modify, reuse, or refactor those. They stay exactly as they are.
- Edges are treated as **undirected** when building the tree: arrow direction and which endpoint is `from` vs `to` are both irrelevant.
- The root card/frame **keeps its current `x`/`y`**; every other node in the tree moves relative to it.
- Nodes and frames with `locked: true` **keep their position** but still participate in the tree so their descendants lay out around their fixed spot.
- Both nodes (`kind: "node"`) and frames (`kind: "group"`) can be tree members; edges carry `fromKind`/`toKind` which may be absent, in which case they default to `"node"`.
- Viewers (`role === "viewer"`) must not see or be able to trigger the action, matching every other board-mutating control.
- Comments in source files are written in Vietnamese, explaining *why* (matching the surrounding code style).
- Every new user-facing string goes through `t`/`<Trans>` and must be added to **both** `src/locales/vi/messages.po` and `src/locales/en/messages.po` (run `npx lingui extract` and fill in the English side so the missing count is 0).
- Tests are run with a bare `node --test` from inside `game-tools/client/` (no path argument — Windows path globbing fails).

---

### Task 1: `buildTree` — walk the edge list from a root

**Files:**
- Create: `game-tools/client/src/lib/tree-layout.js`
- Test: `game-tools/client/src/lib/tree-layout.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `buildTree(edges, rootKey)` → `{ order: string[], children: Map<string, string[]> }`
  - A "key" is the string `"<kind>:<id>"`, e.g. `"node:3"` or `"group:1"`. Task 2 and Task 3 both use this same key format.
  - `order` is every reachable key in breadth-first order, starting with `rootKey`.
  - `children` maps a key to its child keys (in the order they were discovered). Keys with no children are absent from the map.
  - Also produces the exported helper `edgeKey(kind, id)` → `"<kind>:<id>"`, used by Task 3 to build lookups.

- [ ] **Step 1: Write the failing test**

Create `game-tools/client/src/lib/tree-layout.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, edgeKey } from "./tree-layout.js";

test("edgeKey ghép kind và id thành khoá chuỗi", () => {
  assert.equal(edgeKey("node", 3), "node:3");
  assert.equal(edgeKey("group", 1), "group:1");
});

test("buildTree: chuỗi thẳng 1→2→3 ra ba tầng", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 2, to: 3, fromKind: "node", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2", "node:3"]);
  assert.deepEqual(children.get("node:1"), ["node:2"]);
  assert.deepEqual(children.get("node:2"), ["node:3"]);
  assert.equal(children.has("node:3"), false);
});

test("buildTree: dây ngược chiều vẫn tính là quan hệ cha-con", () => {
  // Dây vẽ từ 2 sang 1, nhưng gốc là 1 → 2 vẫn phải là con của 1.
  const edges = [{ id: 1, from: 2, to: 1, fromKind: "node", toKind: "node" }];
  const { children } = buildTree(edges, "node:1");
  assert.deepEqual(children.get("node:1"), ["node:2"]);
});

test("buildTree: edge thiếu fromKind/toKind hiểu là node", () => {
  const edges = [{ id: 1, from: 1, to: 2 }];
  const { order } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
});

test("buildTree: nhiều con giữ đúng thứ tự phát hiện", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 1, to: 3, fromKind: "node", toKind: "node" },
    { id: 3, from: 1, to: 4, fromKind: "node", toKind: "node" }
  ];
  const { children } = buildTree(edges, "node:1");
  assert.deepEqual(children.get("node:1"), ["node:2", "node:3", "node:4"]);
});

test("buildTree: chu trình không làm treo, mỗi thẻ chỉ ghé một lần", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 2, to: 3, fromKind: "node", toKind: "node" },
    { id: 3, from: 3, to: 1, fromKind: "node", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2", "node:3"]);
  assert.equal(children.has("node:3"), false);   // dây 3→1 bị bỏ, 1 đã ghé rồi
});

test("buildTree: thẻ có hai cha chỉ nhận cha gặp trước", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 1, to: 3, fromKind: "node", toKind: "node" },
    { id: 3, from: 2, to: 4, fromKind: "node", toKind: "node" },
    { id: 4, from: 3, to: 4, fromKind: "node", toKind: "node" }
  ];
  const { children } = buildTree(edges, "node:1");
  assert.deepEqual(children.get("node:2"), ["node:4"]);
  assert.equal(children.has("node:3"), false);
});

test("buildTree: dây không liên quan tới gốc không bị lôi vào cây", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 8, to: 9, fromKind: "node", toKind: "node" }
  ];
  const { order } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
});

test("buildTree: khung (group) cũng là thành viên cây", () => {
  const edges = [
    { id: 1, from: 1, to: 5, fromKind: "node", toKind: "group" },
    { id: 2, from: 5, to: 2, fromKind: "group", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "group:5", "node:2"]);
  assert.deepEqual(children.get("group:5"), ["node:2"]);
});

test("buildTree: dây tự nối không tạo con của chính nó", () => {
  const edges = [
    { id: 1, from: 1, to: 1, fromKind: "node", toKind: "node" },
    { id: 2, from: 1, to: 2, fromKind: "node", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
  assert.deepEqual(children.get("node:1"), ["node:2"]);
});

test("buildTree: gốc không có dây nào thì cây chỉ có một thẻ", () => {
  const { order, children } = buildTree([], "node:1");
  assert.deepEqual(order, ["node:1"]);
  assert.equal(children.size, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `game-tools/client/`: `node --test src/lib/tree-layout.test.js`
Expected: FAIL — `Cannot find module './tree-layout.js'`

- [ ] **Step 3: Write minimal implementation**

Create `game-tools/client/src/lib/tree-layout.js`:

```js
// Cây dựng từ dây nối, không phải từ toạ độ: một thẻ là con của thẻ nào phụ
// thuộc vào đường đi ngắn nhất từ gốc, nên duyệt theo chiều rộng (BFS).
export function edgeKey(kind, id) {
  return kind + ":" + id;
}

export function buildTree(edges, rootKey) {
  // Dây coi là hai chiều: mũi tên chỉ hướng nào không nói gì về quan hệ cha-con
  // trên bản đồ ý tưởng — nối là có quan hệ.
  const neighbors = new Map();
  function link(a, b) {
    if (a === b) return;                      // dây tự nối: không phải quan hệ
    if (!neighbors.has(a)) neighbors.set(a, []);
    neighbors.get(a).push(b);
  }
  edges.forEach((e) => {
    const a = edgeKey(e.fromKind || "node", e.from);
    const b = edgeKey(e.toKind || "node", e.to);
    link(a, b);
    link(b, a);
  });

  const order = [rootKey];
  const children = new Map();
  const visited = new Set([rootKey]);
  // BFS: thẻ đã ghé thì bỏ qua, nên chu trình tự dừng và thẻ có hai "cha" chỉ
  // thuộc về cha gặp trước — không cần dò vòng lặp riêng.
  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    (neighbors.get(key) || []).forEach((next) => {
      if (visited.has(next)) return;
      visited.add(next);
      order.push(next);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(next);
    });
  }
  return { order, children };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `game-tools/client/`: `node --test src/lib/tree-layout.test.js`
Expected: PASS — 11 tests pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/lib/tree-layout.js game-tools/client/src/lib/tree-layout.test.js
git commit -m "feat: add buildTree to walk idea-map edges from a root card"
```

---

### Task 2: `treeLayout` — turn the tree into coordinates, four directions

**Files:**
- Modify: `game-tools/client/src/lib/tree-layout.js` (append; keep `edgeKey` and `buildTree` unchanged)
- Test: `game-tools/client/src/lib/tree-layout.test.js` (append)

**Interfaces:**
- Consumes: `buildTree(edges, rootKey)` → `{ order, children }` and `edgeKey(kind, id)` → `"<kind>:<id>"` from Task 1.
- Produces:
  - `treeLayout({ edges, rootKey, rootPos, sizeOf, direction, gap })` → `Map<string, {x, y}>` keyed by `"<kind>:<id>"`, containing every key in the tree including the root.
  - `sizeOf` is a caller-supplied `(key: string) => { w: number, h: number }`.
  - `rootPos` is `{ x, y }` — the root's current position; the returned map always has exactly this value for `rootKey`.
  - `direction` is one of the four string literals `"down"`, `"up"`, `"right"`, `"left"`.
  - `gap` is optional, defaults to `{ depth: 70, breadth: 28 }` — `depth` separates levels, `breadth` separates siblings.
  - Task 3 calls `treeLayout` with exactly these argument names.

- [ ] **Step 1: Write the failing test**

Append to `game-tools/client/src/lib/tree-layout.test.js` (and extend the existing import line at the top of the file from `import { buildTree, edgeKey } from "./tree-layout.js";` to `import { buildTree, edgeKey, treeLayout } from "./tree-layout.js";`):

```js
// Thẻ vuông 100x40 cho dễ tính tay; gap mặc định depth 70, breadth 28.
const SIZE = () => ({ w: 100, h: 40 });
const E = (from, to) => ({ id: from * 100 + to, from, to, fromKind: "node", toKind: "node" });

test("treeLayout: gốc luôn giữ đúng toạ độ truyền vào, cả bốn hướng", () => {
  const edges = [E(1, 2), E(1, 3)];
  ["down", "up", "right", "left"].forEach((direction) => {
    const pos = treeLayout({
      edges, rootKey: "node:1", rootPos: { x: 500, y: 300 }, sizeOf: SIZE, direction
    });
    assert.deepEqual(pos.get("node:1"), { x: 500, y: 300 }, direction);
  });
});

test("treeLayout hướng xuống: cha nằm giữa hai con, con cách nhau đúng gap", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  // Hai con rộng 100, cách nhau 28 → khối con rộng 228, tâm khối trùng tâm cha (50).
  assert.deepEqual(pos.get("node:2"), { x: -64, y: 110 });   // 50 - 228/2 = -64
  assert.deepEqual(pos.get("node:3"), { x: 64, y: 110 });    // -64 + 100 + 28
  // Tầng 1 cách tầng 0: 40 (cao thẻ) + 70 (gap depth)
});

test("treeLayout hướng xuống: nhánh một con thì con nằm thẳng dưới cha", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(2, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  assert.deepEqual(pos.get("node:2"), { x: 0, y: 110 });
  assert.deepEqual(pos.get("node:3"), { x: 0, y: 220 });
});

test("treeLayout: mọi thẻ cùng tầng thẳng hàng theo trục sâu", () => {
  // 1 → (2, 3); 2 → 4. Thẻ 3 và 2 cùng tầng 1, thẻ 4 tầng 2.
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(2, 4)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  assert.equal(pos.get("node:2").y, pos.get("node:3").y);
  assert.equal(pos.get("node:4").y, 220);
});

test("treeLayout: nhánh nhiều con chiếm chỗ ngang rộng hơn nhánh một con", () => {
  // 1 → (2, 3); 2 → (4, 5); 3 → 6.
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(2, 4), E(2, 5), E(3, 6)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  const spanOf = (a, b) => Math.abs(pos.get(b).x - pos.get(a).x);
  // Nhánh 2 có hai con nên bề ngang của nó lớn hơn nhánh 3 (một con, bề ngang 0).
  assert.equal(spanOf("node:4", "node:5"), 128);
  assert.equal(pos.get("node:6").x, pos.get("node:3").x);   // một con: thẳng dưới cha
});

test("treeLayout: kích thước thẻ thật quyết định khoảng cách", () => {
  const wide = (key) => (key === "node:2" ? { w: 300, h: 40 } : { w: 100, h: 40 });
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: wide, direction: "down"
  });
  // Thẻ 2 rộng 300 nên thẻ 3 phải đứng cách nó 300 + 28, không phải 100 + 28.
  assert.equal(pos.get("node:3").x - pos.get("node:2").x, 328);
});

test("treeLayout: thẻ cao quyết định khoảng cách tầng khi xếp dọc", () => {
  const tall = (key) => (key === "node:1" ? { w: 100, h: 200 } : { w: 100, h: 40 });
  const pos = treeLayout({
    edges: [E(1, 2)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: tall, direction: "down"
  });
  assert.equal(pos.get("node:2").y, 270);   // 200 (cao gốc) + 70 (gap)
});

test("treeLayout hướng lên là ảnh gương của hướng xuống theo trục dọc", () => {
  const args = {
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE
  };
  const down = treeLayout({ ...args, direction: "down" });
  const up = treeLayout({ ...args, direction: "up" });
  assert.equal(up.get("node:2").x, down.get("node:2").x);     // trục ngang không đổi
  assert.equal(up.get("node:2").y, -down.get("node:2").y);
  assert.equal(up.get("node:2").y, -110);
});

test("treeLayout hướng phải: tầng đi theo trục ngang, con xếp theo trục dọc", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "right"
  });
  // Tầng cách nhau theo bề ngang thẻ: 100 + 70 = 170.
  assert.equal(pos.get("node:2").x, 170);
  assert.equal(pos.get("node:3").x, 170);
  // Con xếp dọc, cách nhau theo chiều cao: 40 + 28 = 68; tâm khối trùng tâm cha (20).
  assert.deepEqual(pos.get("node:2"), { x: 170, y: -34 });    // 20 - 68/2 = -34
  assert.deepEqual(pos.get("node:3"), { x: 170, y: 34 });
});

test("treeLayout hướng trái là ảnh gương của hướng phải theo trục ngang", () => {
  const args = {
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE
  };
  const right = treeLayout({ ...args, direction: "right" });
  const left = treeLayout({ ...args, direction: "left" });
  assert.equal(left.get("node:2").y, right.get("node:2").y);   // trục dọc không đổi
  assert.equal(left.get("node:2").x, -right.get("node:2").x);
  assert.equal(left.get("node:2").x, -170);
});

test("treeLayout: cha to hơn tổng các con thì con dồn vào giữa dưới cha", () => {
  const bigRoot = (key) => (key === "node:1" ? { w: 500, h: 40 } : { w: 100, h: 40 });
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: bigRoot, direction: "down"
  });
  // Gốc rộng 500 (tâm 250); khối hai con rộng 228 → dồn vào giữa: 250 - 114 = 136.
  assert.deepEqual(pos.get("node:2"), { x: 136, y: 110 });
  assert.deepEqual(pos.get("node:3"), { x: 264, y: 110 });
});

test("treeLayout: gốc không có dây nào thì map chỉ chứa gốc", () => {
  const pos = treeLayout({
    edges: [], rootKey: "node:1", rootPos: { x: 7, y: 9 }, sizeOf: SIZE, direction: "down"
  });
  assert.equal(pos.size, 1);
  assert.deepEqual(pos.get("node:1"), { x: 7, y: 9 });
});

test("treeLayout: cây nhiều tầng nhiều nhánh không có hai thẻ nào chồng nhau", () => {
  const edges = [
    E(1, 2), E(1, 3), E(1, 4),
    E(2, 5), E(2, 6),
    E(3, 7),
    E(4, 8), E(4, 9), E(4, 10),
    E(5, 11), E(9, 12)
  ];
  ["down", "up", "right", "left"].forEach((direction) => {
    const pos = treeLayout({
      edges, rootKey: "node:1", rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction
    });
    assert.equal(pos.size, 12, direction);
    const rects = Array.from(pos.entries()).map(([key, p]) => {
      const { w, h } = SIZE(key);
      return { key, x: p.x, y: p.y, w, h };
    });
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w &&
          a.y < b.y + b.h && b.y < a.y + a.h;
        assert.equal(overlap, false, `${direction}: ${a.key} chồng ${b.key}`);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `game-tools/client/`: `node --test src/lib/tree-layout.test.js`
Expected: FAIL — `treeLayout is not a function` (the 11 Task 1 tests still pass)

- [ ] **Step 3: Write minimal implementation**

Append to `game-tools/client/src/lib/tree-layout.js`:

```js
// Xếp cây trên hai trục trừu tượng rồi mới đổ ra x/y: "depth" là tầng (số bước
// từ gốc), "breadth" là chỗ đứng trong hàng anh em. Nhờ vậy một cách tính dùng
// được cho cả bốn hướng, chỉ khác nhau ở bước ánh xạ cuối.
const DEFAULT_GAP = { depth: 70, breadth: 28 };

// Hướng dọc thì bề ngang thẻ nằm trên trục breadth, chiều cao nằm trên trục
// depth; hướng ngang thì đổi vai.
function axisSize(size, vertical) {
  return vertical
    ? { breadth: size.w, depth: size.h }
    : { breadth: size.h, depth: size.w };
}

export function treeLayout({ edges, rootKey, rootPos, sizeOf, direction, gap }) {
  const g = { ...DEFAULT_GAP, ...(gap || {}) };
  const vertical = direction === "down" || direction === "up";
  const { order, children } = buildTree(edges, rootKey);
  const size = new Map(order.map((key) => [key, axisSize(sizeOf(key), vertical)]));

  // Tầng: mọi thẻ cùng tầng dùng chung một mốc depth, mốc sau = mốc trước +
  // thẻ dày nhất của tầng trước + gap. Đó là điều kiện để chúng thẳng hàng dù
  // cao thấp khác nhau.
  const depthOf = new Map([[rootKey, 0]]);
  order.forEach((key) => {
    (children.get(key) || []).forEach((child) => depthOf.set(child, depthOf.get(key) + 1));
  });
  const thickest = [];
  order.forEach((key) => {
    const d = depthOf.get(key);
    thickest[d] = Math.max(thickest[d] || 0, size.get(key).depth);
  });
  const depthStart = [0];
  for (let d = 1; d < thickest.length; d++) {
    depthStart[d] = depthStart[d - 1] + thickest[d - 1] + g.depth;
  }

  // Bề rộng nhánh tính từ dưới lên: lá chiếm đúng cỡ của nó, thẻ có con chiếm
  // phần lớn hơn giữa (cỡ chính nó) và (tổng các nhánh con + gap) — nên nhánh
  // ít con không chiếm chỗ thừa.
  const span = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const key = order[i];
    const kids = children.get(key) || [];
    const own = size.get(key).breadth;
    if (kids.length === 0) { span.set(key, own); continue; }
    const kidsSpan = kids.reduce((sum, k) => sum + span.get(k), 0) + g.breadth * (kids.length - 1);
    span.set(key, Math.max(own, kidsSpan));
  }

  // Rải theo trục breadth từ trên xuống: mỗi thẻ nằm giữa khoảng đã cấp cho
  // nhánh của nó, các con chia nhau khoảng đó theo đúng span của từng đứa.
  const breadthOf = new Map();
  function place(key, start) {
    const own = size.get(key).breadth;
    const mine = span.get(key);
    breadthOf.set(key, start + (mine - own) / 2);
    const kids = children.get(key) || [];
    if (kids.length === 0) return;
    const kidsSpan = kids.reduce((sum, k) => sum + span.get(k), 0) + g.breadth * (kids.length - 1);
    let at = start + (mine - kidsSpan) / 2;   // cha to hơn con: con dồn vào giữa
    kids.forEach((k) => { place(k, at); at += span.get(k) + g.breadth; });
  }
  place(rootKey, 0);

  // Đổ hai trục ra x/y theo hướng, rồi dịch cả cây một lần sao cho gốc rơi đúng
  // chỗ nó đang đứng — người dùng thấy gốc bất động, cây mọc ra quanh nó.
  const sign = direction === "up" || direction === "left" ? -1 : 1;
  const raw = new Map();
  order.forEach((key) => {
    const b = breadthOf.get(key);
    const d = depthStart[depthOf.get(key)] * sign;
    raw.set(key, vertical ? { x: b, y: d } : { x: d, y: b });
  });
  const rootRaw = raw.get(rootKey);
  const dx = rootPos.x - rootRaw.x, dy = rootPos.y - rootRaw.y;
  const positions = new Map();
  raw.forEach((p, key) => {
    positions.set(key, { x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
  });
  return positions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `game-tools/client/`: `node --test src/lib/tree-layout.test.js`
Expected: PASS — 24 tests pass (11 from Task 1 + 13 new), 0 fail

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/lib/tree-layout.js game-tools/client/src/lib/tree-layout.test.js
git commit -m "feat: add treeLayout to place a card tree in any of four directions"
```

---

### Task 3: Wire it into the board — direction buttons and `arrangeAsTree`

**Files:**
- Modify: `game-tools/client/src/components/ColorMenu.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/locales/vi/messages.po`, `game-tools/client/src/locales/en/messages.po` (via `npx lingui extract`)

**Interfaces:**
- Consumes:
  - `treeLayout({ edges, rootKey, rootPos, sizeOf, direction, gap })` → `Map<"<kind>:<id>", {x, y}>` from Task 2. `gap` is omitted here (defaults are what we want).
  - `edgeKey(kind, id)` → `"<kind>:<id>"` from Task 1.
  - `direction` values are the string literals `"down"`, `"up"`, `"right"`, `"left"`.
- Produces: nothing further (last task).

Existing things in `IdeaMap.jsx` this task uses, already present in the file:
- `frameCardSize(nodeId)` → `{ w, h }` — measures a card's real rendered size from the DOM.
- `commitAndSave(nextBoard)` — pushes onto the undo stack, saves to the server, and broadcasts to other viewers.
- `board.nodes` (each `{ id, x, y, locked?, ... }`), `board.groups` (each `{ id, x, y, w, h, locked?, ... }`), `board.edges` (each `{ id, from, to, fromKind?, toKind? }`).
- `setColorMenu(null)` — closes the context menu.
- `role` — `"viewer"` for read-only users.
- The `ColorMenu` render blocks for `colorMenu.kind === "card"` (around line 2374) and `colorMenu.kind === "group"` (around line 2421).
- The `one = (fn) => (multi ? undefined : fn)` helper inside the card block, which hides single-card-only actions while multiple cards are selected.

- [ ] **Step 1: Add the four arrow buttons to `ColorMenu`**

In `game-tools/client/src/components/ColorMenu.jsx`, add four icon components next to the existing `ShapeRectIcon`/`BorderDashedIcon` definitions (after `BorderDashedIcon`, before the `export default`):

```jsx
// Mũi tên chỉ hướng cây sẽ mọc ra, không phải nút trạng thái — bấm là chạy luôn.
function ArrowIcon({ rotate }) {
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M10 2 L10 11 M6 7.5 L10 11.5 L14 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
```

Add `onArrangeTree` to the destructured props (append it to the existing list):

```jsx
export default function ColorMenu({ x, y, color, count = 1, onPick, onEdit, onGroup, onTidy, onFocus, onDuplicate, onComments, onCopyLink, onDelete, onClose, locked, onToggleLock, shape, onSetShape, dashed, onSetDashed, isRoot, onToggleRoot, onArrangeTree }) {
```

Then insert this block immediately after the `onSetDashed && (...)` section and before `<div className="cm-items">`:

```jsx
      {onArrangeTree && (
        <div className="em-section">
          <div className="em-toggle-group">
            <button className="em-icon-btn" onClick={() => onArrangeTree("down")} title={t`Xếp cây xuống dưới`}>
              <ArrowIcon rotate={0} />
            </button>
            <button className="em-icon-btn" onClick={() => onArrangeTree("up")} title={t`Xếp cây lên trên`}>
              <ArrowIcon rotate={180} />
            </button>
            <button className="em-icon-btn" onClick={() => onArrangeTree("right")} title={t`Xếp cây sang phải`}>
              <ArrowIcon rotate={-90} />
            </button>
            <button className="em-icon-btn" onClick={() => onArrangeTree("left")} title={t`Xếp cây sang trái`}>
              <ArrowIcon rotate={90} />
            </button>
          </div>
        </div>
      )}
```

No CSS change is needed — `.em-section`, `.em-toggle-group` and `.em-icon-btn` already exist in `styles/idea-map.css` and `.em-icon-btn` uses `flex: 1`, so four buttons share the row evenly.

- [ ] **Step 2: Add `arrangeAsTree` to `IdeaMap.jsx`**

Extend the import at the top of `game-tools/client/src/pages/IdeaMap.jsx` — the file already has `import { gridLayout, layerLayout } from "../lib/layout.js";` on line 19; add a new line right after it:

```jsx
import { treeLayout, edgeKey } from "../lib/tree-layout.js";
```

Then add this function immediately after the existing `tidySelection` function (which ends around line 1444, just before `function zoomToNodes(ids)`):

```jsx
  // Xếp lại thẻ gốc + toàn bộ con cháu nối với nó thành hình cây. Gốc đứng yên
  // làm điểm neo; thẻ khoá giữ chỗ nhưng con cháu nó vẫn xếp quanh đúng chỗ đó.
  function arrangeAsTree(rootKind, rootId, direction) {
    if (role === "viewer") return;
    const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
    const groupById = new Map(board.groups.map((g) => [g.id, g]));
    const rootKey = edgeKey(rootKind, rootId);
    const root = rootKind === "group" ? groupById.get(rootId) : nodeById.get(rootId);
    if (!root) return;

    function sizeOf(key) {
      const [kind, rawId] = key.split(":");
      const id = Number(rawId);
      if (kind === "group") {
        const g = groupById.get(id);
        return g ? { w: g.w, h: g.h } : { w: CARD_W, h: 110 };
      }
      return frameCardSize(id);
    }

    const pos = treeLayout({
      edges: board.edges, rootKey, rootPos: { x: root.x, y: root.y }, sizeOf, direction
    });
    if (pos.size < 2) return;                 // gốc trơ trọi: không có gì để xếp

    function moved(kind, item) {
      const p = pos.get(edgeKey(kind, item.id));
      if (!p || item.locked) return item;     // thẻ khoá vẫn tính vào cây, chỉ không dời
      return { ...item, x: p.x, y: p.y };
    }
    setColorMenu(null);
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => moved("node", n)),
      groups: board.groups.map((g) => moved("group", g))
    });
  }
```

- [ ] **Step 3: Pass `onArrangeTree` to both context menus**

In the `colorMenu.kind === "card"` block, add the prop right after the existing `onToggleRoot={one(() => toggleNodeRoot(node.id))}` line:

```jsx
            onArrangeTree={one((direction) => arrangeAsTree("node", node.id, direction))}
```

In the `colorMenu.kind === "group"` block, add it after the existing `onToggleLock={() => toggleGroupLock(group.id)}` line:

```jsx
            onArrangeTree={(direction) => arrangeAsTree("group", group.id, direction)}
```

The card version goes through `one(...)`, so the button row is hidden when several cards are selected — a tree needs exactly one root. Viewers never reach `arrangeAsTree`'s body because of its `role === "viewer"` guard.

- [ ] **Step 4: Extract the new strings into both i18n catalogs**

Run from `game-tools/client/`:

```bash
npx lingui extract
```

This adds the four new `msgid`s ("Xếp cây xuống dưới", "Xếp cây lên trên", "Xếp cây sang phải", "Xếp cây sang trái") to both catalogs, with the Vietnamese side auto-filled (it is the source locale) and the English side empty. Open `game-tools/client/src/locales/en/messages.po` and fill in each one:

```
msgid "Xếp cây lên trên"
msgstr "Arrange tree upward"

msgid "Xếp cây sang phải"
msgstr "Arrange tree rightward"

msgid "Xếp cây sang trái"
msgstr "Arrange tree leftward"

msgid "Xếp cây xuống dưới"
msgstr "Arrange tree downward"
```

Re-run `npx lingui extract` and confirm the table prints `Missing: 0` for `en`. A non-zero missing count is what makes production render raw hashed message ids instead of labels.

- [ ] **Step 5: Run the full test suite and build**

Run from `game-tools/client/`:

```bash
node --test
npm run build
```

Expected: all tests pass (86 existing + 24 from Tasks 1–2 = 110), and the build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add game-tools/client/src/components/ColorMenu.jsx game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/locales/vi/messages.po game-tools/client/src/locales/en/messages.po
git commit -m "feat: arrange a card tree in four directions from the context menu"
```

---

## Self-Review Notes

**Spec coverage** — every section of `docs/superpowers/specs/2026-07-26-idea-map-tree-layout-design.md` maps to a task:

| Spec section | Task |
|---|---|
| A. Dựng cây từ gốc (`buildTree`, BFS, undirected, cycles, multi-parent) | Task 1 |
| B. Tính toạ độ (`treeLayout`, breadth/depth axes, per-direction size roles, mirroring, root anchoring) | Task 2 |
| C. Áp dụng vào board (`arrangeAsTree`, `sizeOf`, locked skipping, viewer guard, `commitAndSave`) | Task 3 |
| Files touched: new `lib/tree-layout.js` + test | Tasks 1–2 |
| Files touched: `ColorMenu.jsx` four arrow buttons | Task 3, Step 1 |
| Files touched: `IdeaMap.jsx` wiring for card **and** group menus | Task 3, Steps 2–3 |
| Files touched: i18n catalogs | Task 3, Step 4 |
| Edge case: cycles / multi-parent | Task 1 tests |
| Edge case: locked root (no-op — root never moves anyway) | Covered by Task 3's `moved()` returning the item unchanged; root's own position is what `rootPos` was seeded from |
| Edge case: locked child keeps position, descendants still arrange | Task 3, `moved()` |
| Edge case: root with no edges → action does nothing | Task 2 test (`pos.size === 1`) + Task 3's `if (pos.size < 2) return;` |
| Testing: `buildTree` cases | Task 1, Step 1 |
| Testing: `treeLayout` alignment / centering / compaction / size-driven spacing / four directions / no-overlap | Task 2, Step 1 |

**Type consistency check** — the `"<kind>:<id>"` key format is introduced by `edgeKey` in Task 1 and is the key type for `children`, `order` (Task 1), `sizeOf`'s parameter and `treeLayout`'s return map (Task 2), and the `pos.get(edgeKey(kind, item.id))` lookups in Task 3. `treeLayout`'s single-object parameter uses the same property names (`edges`, `rootKey`, `rootPos`, `sizeOf`, `direction`, `gap`) in its Task 2 definition, its Task 2 tests, and its Task 3 call site. `direction` is the same four literals throughout. `sizeOf` returns `{ w, h }` in Task 2's tests and in Task 3's implementation (both the `frameCardSize` passthrough and the group branch).

**Placeholder scan** — no TBD/TODO markers; every code step carries complete code; no step says "similar to Task N"; no referenced function is undefined (`frameCardSize`, `commitAndSave`, `setColorMenu`, `role`, `CARD_W`, `one` all pre-exist in `IdeaMap.jsx`, verified by reading the file).
