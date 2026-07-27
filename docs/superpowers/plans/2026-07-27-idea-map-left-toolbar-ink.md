# Thanh công cụ bên trái & vẽ tay bằng bút — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm thanh công cụ dọc bốn khu ở lề trái trang `/idea-map/:boardId`, và làm tool bút vẽ được thật — nét lưu vào board, mọi người thấy theo thời gian thực, hoàn tác được, xoá được bằng cục gôm.

**Architecture:** Ba module thuần không dính React (`lib/pen.js`, `lib/stroke.js`, `lib/ink-live.js`) gánh toàn bộ phần tính toán và được test bằng `node:test`. Hai hook (`lib/useInk.js` bắt chuột vẽ, `lib/useInkLive.js` phát/nhận socket) và ba component trình bày (`ToolRail`, `ToolOptions`, `InkLayer`) ghép chúng vào `IdeaMap.jsx`, vốn chỉ thêm state `mode` / `tool` / `penPrefs` và nối dây. Nét vẽ là một field mới `board.drawings` đi theo đúng đường lưu sẵn có (PUT cả board + `board:update`), cộng một kênh socket mới `live:ink` cho nét đang chạy.

**Tech Stack:** React 18, Vite 6, socket.io 4, Express + Mongoose (server), `@lingui/react/macro` cho i18n, `node:test` + `node:assert/strict` cho unit test, `npm run test:smoke` (jsdom) cho test ghép nối.

**Spec:** `docs/superpowers/specs/2026-07-27-idea-map-left-toolbar-ink-design.md`

## Global Constraints

- Thư mục làm việc của mọi lệnh `npm`: `game-tools/client` (client) và `game-tools/server` (server). Đường dẫn file trong plan này tính từ gốc repo.
- Unit test dùng `node:test` + `node:assert/strict`, **không** vitest. `npm test` chạy `node --test "src/lib/*.test.js"` — chỉ nhặt file trong `src/lib/`.
- Server **không có** bộ test nào; phần `server/` kiểm bằng tay và qua smoke test của client.
- Mọi chuỗi hiện cho người dùng phải đi qua `@lingui/react/macro`: `<Trans>` cho nội dung, `` t`…` `` cho `title` / `placeholder`. Ngôn ngữ nguồn là **tiếng Việt**; bản dịch tiếng Anh nằm ở `game-tools/client/src/locales/en/messages.po`.
- Màu lưu dưới dạng **token** (`"pen-red"`), không lưu hex. Biến CSS phải khai báo ở **cả bốn** khối theme trong `game-tools/client/src/index.css`: `:root`, `@media (prefers-color-scheme: dark) :root`, `:root[data-theme="dark"]`, `:root[data-theme="light"]`.
- Toạ độ nét vẽ là **số nguyên**, đơn vị toạ độ canvas, lưu trong **mảng số phẳng** `[x0,y0,x1,y1,…]`.
- Bộ màu bút cố định: `pen-red`, `pen-orange`, `pen-yellow`, `pen-green`, `pen-blue`, `pen-purple`, `pen-mono`. Độ dày cố định: `2`, `4`, `8`.
- Giá trị mode: `"select"` | `"draw"`. Giá trị tool: `"pen"` | `"eraser"`.
- Không sửa `lib/useLiveSync.js` và `lib/usePresence.js`. Kênh mới ở file riêng.
- Commit sau mỗi task. Thông điệp commit tiếng Việt, tiền tố `feat:` / `test:` / `refactor:` như lịch sử repo đang dùng.

---

- [x] ## Task 1: `lib/pen.js` — bộ màu bút, độ dày, prefs localStorage

**Files:**
- Create: `game-tools/client/src/lib/pen.js`
- Test: `game-tools/client/src/lib/pen.test.js`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces:
  - `PEN_COLORS: string[]` — 7 token theo đúng thứ tự hiện trên khu 4
  - `PEN_WIDTHS: number[]` — `[2, 4, 8]`
  - `PEN_DEFAULT: { color: string, w: number }` — `{ color: "pen-red", w: 4 }`
  - `penVar(token: string) -> string` — `"pen-red"` → `"var(--pen-red)"`
  - `loadPenPrefs(storage) -> { color: string, w: number }`
  - `savePenPrefs(storage, prefs: { color, w }) -> void`

- [ ] **Step 1: Viết test thất bại**

Tạo `game-tools/client/src/lib/pen.test.js`:

```js
// game-tools/client/src/lib/pen.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PEN_COLORS, PEN_WIDTHS, PEN_DEFAULT, penVar, loadPenPrefs, savePenPrefs } from "./pen.js";

// localStorage giả: chỉ cần getItem/setItem, không cần cả Storage API.
function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test("PEN_DEFAULT phải nằm trong danh sách hợp lệ", () => {
  assert.ok(PEN_COLORS.includes(PEN_DEFAULT.color));
  assert.ok(PEN_WIDTHS.includes(PEN_DEFAULT.w));
  assert.equal(PEN_COLORS.length, 7);
  assert.deepEqual(PEN_WIDTHS, [2, 4, 8]);
});

test("penVar: token thành biến CSS", () => {
  assert.equal(penVar("pen-red"), "var(--pen-red)");
  assert.equal(penVar("pen-mono"), "var(--pen-mono)");
});

test("loadPenPrefs: chưa có khoá thì trả mặc định", () => {
  assert.deepEqual(loadPenPrefs(fakeStorage()), PEN_DEFAULT);
});

test("loadPenPrefs: JSON hỏng thì trả mặc định chứ không nổ", () => {
  assert.deepEqual(loadPenPrefs(fakeStorage({ "ideamap.pen": "{{{" })), PEN_DEFAULT);
});

// Token cũ bị bỏ khỏi bộ màu không được làm người dùng kẹt với một giá trị
// không còn vẽ ra màu gì.
test("loadPenPrefs: giá trị lạ lùi về mặc định theo từng phần", () => {
  const bothBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-neon", w: 999 }) });
  assert.deepEqual(loadPenPrefs(bothBad), PEN_DEFAULT);

  const onlyWidthBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 999 }) });
  assert.deepEqual(loadPenPrefs(onlyWidthBad), { color: "pen-blue", w: PEN_DEFAULT.w });
});

test("savePenPrefs rồi loadPenPrefs trả lại đúng giá trị", () => {
  const s = fakeStorage();
  savePenPrefs(s, { color: "pen-green", w: 8 });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-green", w: 8 });
});

// Hết quota hoặc chế độ riêng tư — mất lựa chọn bút không đáng làm sập app.
test("savePenPrefs: storage ném lỗi thì im lặng bỏ qua", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.doesNotThrow(() => savePenPrefs(broken, PEN_DEFAULT));
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && node --test "src/lib/pen.test.js"
```

Kỳ vọng: FAIL với `Cannot find module './pen.js'`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `game-tools/client/src/lib/pen.js`:

```js
// Màu bút là HỆ MÀU RIÊNG, không dùng board.palette hay BADGE_PALETTE: đổi màu
// một cái thẻ không được kéo theo màu của nét vẽ tay. Tên token là "pen-" chứ
// không phải "ink-" để không lẫn với --ink / --ink-dim đang là màu chữ.
const KEY = "ideamap.pen";

export const PEN_COLORS = [
  "pen-red", "pen-orange", "pen-yellow",
  "pen-green", "pen-blue", "pen-purple", "pen-mono"
];

// Đơn vị toạ độ canvas, không phải pixel màn hình: zoom vào là nét dày ra như
// mực trên giấy.
export const PEN_WIDTHS = [2, 4, 8];

export const PEN_DEFAULT = { color: "pen-red", w: 4 };

export function penVar(token) {
  return `var(--${token})`;
}

export function loadPenPrefs(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEY));
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== "object") return { ...PEN_DEFAULT };
  // Lọc theo từng key: một giá trị hỏng không được làm mất luôn giá trị còn lại.
  return {
    color: PEN_COLORS.includes(saved.color) ? saved.color : PEN_DEFAULT.color,
    w: PEN_WIDTHS.includes(saved.w) ? saved.w : PEN_DEFAULT.w
  };
}

export function savePenPrefs(storage, prefs) {
  try {
    storage.setItem(KEY, JSON.stringify({ color: prefs.color, w: prefs.w }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn bút, không đáng làm sập app.
  }
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && node --test "src/lib/pen.test.js"
```

Kỳ vọng: PASS, 7 test.

- [ ] **Step 5: Chạy cả bộ test cho chắc**

```bash
cd game-tools/client && npm test
```

Kỳ vọng: PASS toàn bộ, không có test nào đang xanh bị đỏ.

- [ ] **Step 6: Commit**

```bash
git add game-tools/client/src/lib/pen.js game-tools/client/src/lib/pen.test.js
git commit -m "feat: bộ màu bút và prefs độ dày cho bản đồ ý tưởng"
```

---

- [x] ## Task 2: `lib/stroke.js` — giản lược nét, sinh path, hit-test

**Files:**
- Create: `game-tools/client/src/lib/stroke.js`
- Test: `game-tools/client/src/lib/stroke.test.js`

**Interfaces:**
- Consumes: không có
- Produces:
  - `simplifyStroke(pts: number[], minDist?: number, tolerance?: number) -> number[]` — mặc định `minDist = 2`, `tolerance = 1`. Làm tròn về số nguyên, bỏ điểm quá gần, rồi Ramer–Douglas–Peucker.
  - `strokePath(pts: number[]) -> string` — chuỗi `d` cho `<path>`. Mảng rỗng → `""`.
  - `strokesHitBy(drawings: Array<{id, w, pts}>, point: {x, y}, radius: number) -> number[]` — id các nét chạm, theo thứ tự trong `drawings`.

- [ ] **Step 1: Viết test thất bại**

Tạo `game-tools/client/src/lib/stroke.test.js`:

```js
// game-tools/client/src/lib/stroke.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { simplifyStroke, strokePath, strokesHitBy } from "./stroke.js";

test("simplifyStroke: bỏ điểm giữa thẳng hàng, giữ hai đầu", () => {
  assert.deepEqual(simplifyStroke([0, 0, 10, 0, 20, 0, 30, 0, 40, 0]), [0, 0, 40, 0]);
});

test("simplifyStroke: giữ điểm gãy góc", () => {
  assert.deepEqual(simplifyStroke([0, 0, 20, 0, 20, 20]), [0, 0, 20, 0, 20, 20]);
});

// Chuột bắn tới 1000 sự kiện/giây nên phần lớn điểm nằm sát điểm trước.
test("simplifyStroke: bỏ điểm cách điểm trước dưới 2px", () => {
  assert.deepEqual(simplifyStroke([0, 0, 1, 0, 20, 0]), [0, 0, 20, 0]);
});

test("simplifyStroke: làm tròn toạ độ về số nguyên", () => {
  assert.deepEqual(simplifyStroke([0.4, 0.6, 20.5, 0.2]), [0, 1, 21, 0]);
});

test("simplifyStroke: nét rỗng và nét một điểm không nổ", () => {
  assert.deepEqual(simplifyStroke([]), []);
  assert.deepEqual(simplifyStroke([5, 5]), [5, 5]);
});

// Một nét kéo dài thật sự phải co lại đáng kể — đây là lý do hàm này tồn tại.
test("simplifyStroke: nét dài rung nhẹ co lại còn rất ít điểm", () => {
  const pts = [];
  for (let i = 0; i <= 400; i++) pts.push(i, i % 2 === 0 ? 0 : 0.4);
  const out = simplifyStroke(pts);
  assert.ok(out.length / 2 < 30, "mong đợi dưới 30 điểm, có " + out.length / 2);
  assert.deepEqual(out.slice(0, 2), [0, 0], "phải giữ điểm đầu");
  assert.deepEqual(out.slice(-2), [400, 0], "phải giữ điểm cuối");
});

test("strokePath: sinh M/L đúng thứ tự", () => {
  assert.equal(strokePath([0, 0, 10, 5, 20, 0]), "M 0 0 L 10 5 L 20 0");
});

// Nét một điểm: chỉ có `M` thì SVG không vẽ gì cả. Thêm `L` về chính nó để
// stroke-linecap: round biến nó thành một dấu chấm.
test("strokePath: nét một điểm thành một dấu chấm", () => {
  assert.equal(strokePath([7, 8]), "M 7 8 L 7 8");
});

test("strokePath: nét rỗng trả chuỗi rỗng", () => {
  assert.equal(strokePath([]), "");
});

test("strokesHitBy: ngưỡng chạm là w/2 + radius", () => {
  const drawings = [{ id: 1, kind: "pen", color: "pen-red", w: 4, pts: [0, 0, 100, 0] }];
  // ngưỡng = 4/2 + 8 = 10
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 9 }, 8), [1]);
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 11 }, 8), []);
});

// Đo tới ĐOẠN THẲNG, không phải tới đỉnh: giữa một nét dài thì mọi đỉnh đều xa.
test("strokesHitBy: đo khoảng cách tới đoạn thẳng chứ không tới đỉnh", () => {
  const drawings = [{ id: 1, w: 2, pts: [0, 0, 100, 0] }];
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 0 }, 3), [1]);
});

test("strokesHitBy: trả nhiều id khi một điểm chạm nhiều nét", () => {
  const drawings = [
    { id: 1, w: 2, pts: [0, 0, 100, 0] },
    { id: 2, w: 2, pts: [50, -20, 50, 20] },
    { id: 3, w: 2, pts: [0, 500, 100, 500] }
  ];
  assert.deepEqual(strokesHitBy(drawings, { x: 50, y: 0 }, 3), [1, 2]);
});

test("strokesHitBy: nét một điểm vẫn hit-test được", () => {
  assert.deepEqual(strokesHitBy([{ id: 1, w: 4, pts: [10, 10] }], { x: 12, y: 10 }, 8), [1]);
});

test("strokesHitBy: danh sách rỗng hoặc thiếu pts trả mảng rỗng", () => {
  assert.deepEqual(strokesHitBy([], { x: 0, y: 0 }, 8), []);
  assert.deepEqual(strokesHitBy([{ id: 1, w: 4 }], { x: 0, y: 0 }, 8), []);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && node --test "src/lib/stroke.test.js"
```

Kỳ vọng: FAIL với `Cannot find module './stroke.js'`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `game-tools/client/src/lib/stroke.js`:

```js
// Mọi phép tính về nét vẽ nằm ở đây, không dính React: nhờ vậy test được bằng
// node:test và IdeaMap không phải mang thêm logic hình học nào.
const MIN_DIST = 2;
const RDP_TOLERANCE = 1;

// Khoảng cách từ điểm P tới ĐOẠN AB (không phải tới đường thẳng AB): kẹp t vào
// [0,1] để điểm nằm ngoài hai đầu đoạn thì đo tới đầu gần nhất.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Ramer–Douglas–Peucker: giữ điểm lệch xa nhất khỏi dây cung, rồi lặp lại cho
// hai nửa. Ghi kết quả vào `keep` thay vì cắt mảng để không cấp phát trung gian.
function rdp(pts, first, last, tolerance, keep) {
  if (last - first < 2) return;
  const ax = pts[first * 2], ay = pts[first * 2 + 1];
  const bx = pts[last * 2], by = pts[last * 2 + 1];
  let maxD = -1, idx = -1;
  for (let i = first + 1; i < last; i++) {
    const d = distToSegment(pts[i * 2], pts[i * 2 + 1], ax, ay, bx, by);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (idx < 0 || maxD <= tolerance) return;
  keep[idx] = true;
  rdp(pts, first, idx, tolerance, keep);
  rdp(pts, idx, last, tolerance, keep);
}

export function simplifyStroke(pts, minDist = MIN_DIST, tolerance = RDP_TOLERANCE) {
  // Làm tròn TRƯỚC rồi mới lọc: toạ độ lưu vào board là số nguyên, nên phép đo
  // khoảng cách phải chạy trên đúng những con số sẽ được lưu.
  const rounded = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = Math.round(pts[i]), y = Math.round(pts[i + 1]);
    if (rounded.length >= 2) {
      const px = rounded[rounded.length - 2], py = rounded[rounded.length - 1];
      if (Math.hypot(x - px, y - py) < minDist) continue;
    }
    rounded.push(x, y);
  }
  const n = rounded.length / 2;
  if (n <= 2) return rounded;

  const keep = new Array(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  rdp(rounded, 0, n - 1, tolerance, keep);

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(rounded[i * 2], rounded[i * 2 + 1]);
  return out;
}

export function strokePath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0]} ${pts[1]} L ${pts[0]} ${pts[1]}`;
  let d = `M ${pts[0]} ${pts[1]}`;
  for (let i = 2; i + 1 < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;
  return d;
}

export function strokesHitBy(drawings, point, radius) {
  const out = [];
  for (const d of drawings || []) {
    const pts = d.pts || [];
    if (pts.length < 2) continue;
    const limit = (d.w || 0) / 2 + radius;
    let hit = false;
    if (pts.length === 2) {
      hit = Math.hypot(point.x - pts[0], point.y - pts[1]) <= limit;
    } else {
      for (let i = 0; i + 3 < pts.length && !hit; i += 2) {
        hit = distToSegment(point.x, point.y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= limit;
      }
    }
    if (hit) out.push(d.id);
  }
  return out;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && node --test "src/lib/stroke.test.js"
```

Kỳ vọng: PASS, 13 test.

- [ ] **Step 5: Chạy cả bộ test**

```bash
cd game-tools/client && npm test
```

Kỳ vọng: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add game-tools/client/src/lib/stroke.js game-tools/client/src/lib/stroke.test.js
git commit -m "feat: module thuần giản lược nét vẽ, sinh path và hit-test"
```

---

- [x] ## Task 3: `lib/ink-live.js` — trộn gói live và đối chiếu overlay

**Files:**
- Create: `game-tools/client/src/lib/ink-live.js`
- Test: `game-tools/client/src/lib/ink-live.test.js`

**Interfaces:**
- Consumes: không có
- Produces:
  - `INK_LIVE_TTL_MS = 1200`, `INK_SETTLE_TTL_MS = 6000`
  - `inkKey(packet: {socketId, strokeId}) -> string` — `"s1:1"`
  - `mergeInkPacket(prev: Map, packet: object, now: number) -> Map` — trả **chính** `prev` khi không có gì đổi, để React bỏ qua trọn một lượt render.
  - `reconcileInkOverlay(prev: Map, board: {drawings}) -> Map` — trả **chính** `prev` khi không có gì đổi.
  - Entry của Map: `{ color, w, pts, drawingId, erase, expiresAt }`. Nét đang vẽ có `pts` và `erase: null`; lượt gôm có `erase: number[]` và `pts: null`.

**Vì sao TTL hai mức** (chép lại bài học đã ghi trong `lib/useLiveSync.js`): gói giữa chừng hết hạn nhanh để người vẽ rớt mạng thì nét tạm tự dọn; gói `done` phải sống lâu hơn hẳn vì nó cầm cự cho tới khi `board:update` chính thức về — bỏ nó sớm là nét biến mất rồi mới hiện lại, đúng hiện tượng nháy.

- [ ] **Step 1: Viết test thất bại**

Tạo `game-tools/client/src/lib/ink-live.test.js`:

```js
// game-tools/client/src/lib/ink-live.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INK_LIVE_TTL_MS, INK_SETTLE_TTL_MS, inkKey, mergeInkPacket, reconcileInkOverlay
} from "./ink-live.js";

const NOW = 1000;
// socketId do SERVER đính vào, không phải client tự đặt.
function pkt(o) { return { socketId: "s1", strokeId: 1, ...o }; }

test("inkKey: khoá theo socketId + strokeId", () => {
  assert.equal(inkKey({ socketId: "abc", strokeId: 7 }), "abc:7");
});

test("mergeInkPacket: gói đầu tạo entry đủ màu, độ dày, điểm", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0, 10, 10] }), NOW);
  assert.deepEqual(m.get("s1:1"), {
    color: "pen-red", w: 4, pts: [0, 0, 10, 10],
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});

test("mergeInkPacket: gói sau nối điểm mới vào đuôi và gia hạn TTL", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  m = mergeInkPacket(m, pkt({ seq: 2, pts: [20, 20] }), NOW + 80);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10, 20, 20]);
  assert.equal(m.get("s1:1").expiresAt, NOW + 80 + INK_LIVE_TTL_MS);
});

// Vào board giữa lúc người khác đang vẽ: không có gói seq 0 nên không biết màu
// và độ dày. Bỏ qua, đừng vẽ một nét vô màu.
test("mergeInkPacket: thiếu gói đầu thì bỏ qua và trả đúng map cũ", () => {
  const prev = new Map();
  assert.equal(mergeInkPacket(prev, pkt({ seq: 3, pts: [1, 1] }), NOW), prev);
});

test("mergeInkPacket: gói done ghi drawingId, đổi sang TTL dài, giữ nguyên điểm", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-blue", w: 2, pts: [0, 0, 5, 5] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW + 100);
  const e = m.get("s1:1");
  assert.equal(e.drawingId, 37);
  assert.equal(e.expiresAt, NOW + 100 + INK_SETTLE_TTL_MS);
  assert.deepEqual(e.pts, [0, 0, 5, 5], "gói done không được xoá điểm đã nhận");
});

test("mergeInkPacket: gói cancel bỏ hẳn entry", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ cancel: true }), NOW + 50);
  assert.equal(m.has("s1:1"), false);
});

test("mergeInkPacket: gói erase gom id, không trùng lặp", () => {
  let m = mergeInkPacket(new Map(), pkt({ erase: [3, 7] }), NOW);
  m = mergeInkPacket(m, pkt({ erase: [7, 12] }), NOW + 40);
  assert.deepEqual(m.get("s1:1").erase, [3, 7, 12]);
  assert.equal(m.get("s1:1").pts, null);
});

test("mergeInkPacket: hai người vẽ cùng lúc là hai entry riêng", () => {
  let m = mergeInkPacket(new Map(), { socketId: "s1", strokeId: 1, seq: 0, color: "pen-red", w: 4, pts: [0, 0] }, NOW);
  m = mergeInkPacket(m, { socketId: "s2", strokeId: 1, seq: 0, color: "pen-blue", w: 8, pts: [9, 9] }, NOW);
  assert.equal(m.size, 2);
  assert.equal(m.get("s2:1").color, "pen-blue");
});

test("mergeInkPacket: gói rác trả đúng map cũ, không nổ", () => {
  const prev = new Map();
  assert.equal(mergeInkPacket(prev, null, NOW), prev);
  assert.equal(mergeInkPacket(prev, { seq: 0, pts: [0, 0] }, NOW), prev, "thiếu socketId");
  assert.equal(mergeInkPacket(prev, pkt({ seq: 0, pts: [] }), NOW), prev, "pts rỗng");
});

test("reconcileInkOverlay: bỏ ngay entry mà board đã có nét thật", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW);
  const board = { drawings: [{ id: 37, kind: "pen", color: "pen-red", w: 4, pts: [0, 0] }] };
  assert.equal(reconcileInkOverlay(m, board).has("s1:1"), false);
});

test("reconcileInkOverlay: giữ entry mà board chưa bắt kịp", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [] }).has("s1:1"), true);
});

test("reconcileInkOverlay: nét đang vẽ chưa done thì không bị bỏ, trả map cũ", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 1 }] }), m);
});

test("reconcileInkOverlay: entry gôm bỏ khi mọi nét đã thật sự mất khỏi board", () => {
  const m = mergeInkPacket(new Map(), pkt({ erase: [3, 7], done: true }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 9 }] }).has("s1:1"), false);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 3 }] }).has("s1:1"), true);
});

test("reconcileInkOverlay: overlay rỗng hoặc board null trả map cũ", () => {
  const empty = new Map();
  assert.equal(reconcileInkOverlay(empty, { drawings: [] }), empty);
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(reconcileInkOverlay(m, null), m);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && node --test "src/lib/ink-live.test.js"
```

Kỳ vọng: FAIL với `Cannot find module './ink-live.js'`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `game-tools/client/src/lib/ink-live.js`:

```js
// Overlay nét vẽ đang chạy của NGƯỜI KHÁC. Cùng bài học TTL hai mức với
// lib/useLiveSync.js: gói giữa chừng hết hạn nhanh (người vẽ rớt mạng thì nét
// tạm tự dọn), gói CUỐI sống lâu hơn hẳn vì nó phải cầm cự cho tới khi
// board:update chính thức của lần lưu đó về — bỏ sớm là nét biến mất rồi hiện
// lại, đúng hiện tượng nháy.
export const INK_LIVE_TTL_MS = 1200;
export const INK_SETTLE_TTL_MS = 6000;

export function inkKey(packet) {
  return packet.socketId + ":" + packet.strokeId;
}

export function mergeInkPacket(prev, packet, now) {
  if (!packet || typeof packet !== "object") return prev;
  // socketId do server đính vào; strokeId là số đếm cục bộ của người vẽ. Thiếu
  // một trong hai thì không khoá được entry.
  if (typeof packet.socketId !== "string" || !Number.isFinite(packet.strokeId)) return prev;

  const key = inkKey(packet);
  const cur = prev.get(key);

  if (packet.cancel === true) {
    if (!cur) return prev;
    const next = new Map(prev);
    next.delete(key);
    return next;
  }

  // Lượt gôm: gói mang danh sách id đang bị đánh dấu xoá, cộng dồn qua các gói.
  if (Array.isArray(packet.erase)) {
    const merged = cur && cur.erase ? cur.erase.slice() : [];
    for (const id of packet.erase) {
      if (Number.isFinite(id) && !merged.includes(id)) merged.push(id);
    }
    const next = new Map(prev);
    next.set(key, {
      color: null, w: null, pts: null, drawingId: null, erase: merged,
      expiresAt: now + (packet.done === true ? INK_SETTLE_TTL_MS : INK_LIVE_TTL_MS)
    });
    return next;
  }

  if (packet.done === true) {
    if (!cur) return prev;
    const next = new Map(prev);
    next.set(key, {
      ...cur,
      drawingId: Number.isFinite(packet.drawingId) ? packet.drawingId : null,
      expiresAt: now + INK_SETTLE_TTL_MS
    });
    return next;
  }

  const pts = Array.isArray(packet.pts) ? packet.pts : null;
  if (!pts || pts.length < 2) return prev;
  // Vào giữa nét: không có gói seq 0 nên thiếu màu và độ dày, bỏ qua.
  if (!cur && packet.seq !== 0) return prev;

  const next = new Map(prev);
  if (packet.seq === 0) {
    next.set(key, {
      color: packet.color, w: packet.w, pts: pts.slice(),
      drawingId: null, erase: null, expiresAt: now + INK_LIVE_TTL_MS
    });
  } else {
    next.set(key, { ...cur, pts: cur.pts.concat(pts), expiresAt: now + INK_LIVE_TTL_MS });
  }
  return next;
}

// Sau khi áp một board:update chính thức: overlay nào đã được board thật bắt
// kịp phải bỏ NGAY, giữ lại nghĩa là tiếp tục vẽ một bản tạm đè lên dữ liệu
// thật vừa nhận. Cùng vai trò reconcileGeomOverlay trong useLiveSync.js.
export function reconcileInkOverlay(prev, board) {
  if (!prev.size || !board) return prev;
  const ids = new Set((board.drawings || []).map((d) => d.id));
  let next = null;
  for (const [key, e] of prev) {
    let settled = false;
    if (e.erase) settled = e.erase.every((id) => !ids.has(id));
    else if (e.drawingId != null) settled = ids.has(e.drawingId);
    if (!settled) continue;
    if (!next) next = new Map(prev);
    next.delete(key);
  }
  return next || prev;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && node --test "src/lib/ink-live.test.js"
```

Kỳ vọng: PASS, 14 test.

- [ ] **Step 5: Chạy cả bộ test**

```bash
cd game-tools/client && npm test
```

Kỳ vọng: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add game-tools/client/src/lib/ink-live.js game-tools/client/src/lib/ink-live.test.js
git commit -m "feat: module thuần trộn gói live:ink và đối chiếu overlay"
```

---

- [x] ## Task 4: Server nhận `drawings` và chuyển tiếp kênh `live:ink`

**Files:**
- Modify: `game-tools/server/models.js:38-51` (thêm 2 field vào `boardSchema`)
- Modify: `game-tools/server/boards.js:118-141` (3 chỗ liệt kê field)
- Modify: `game-tools/server/index.js:211-234` (hằng số + `sanitizeInk`), `game-tools/server/index.js:281` (thêm handler sau `live:geom`)

**Interfaces:**
- Consumes: không có
- Produces:
  - Board document có `drawings: Array` (mặc định `[]`) và `nextDrawingId: Number` (mặc định `1`)
  - `PUT /api/boards/:id` lưu và phát lại hai field đó trong `board:update`
  - Sự kiện socket `live:ink`: client gửi `{ strokeId, seq, color, w, pts }` | `{ strokeId, done, drawingId }` | `{ strokeId, cancel }` | `{ strokeId, erase, done }`; server phát lại **cùng payload đã lọc, đính thêm `socketId`**, cho mọi người trong phòng trừ người gửi.

**Vì sao không `volatile`:** `live:geom` volatile được vì mỗi gói mang vị trí tuyệt đối, mất một gói thì gói sau tự sửa. Gói `live:ink` mang **điểm mới thêm** — mất một gói là nét khuyết hẳn một khúc và không bao giờ tự lành.

- [ ] **Step 1: Thêm hai field vào schema**

Trong `game-tools/server/models.js`, thêm vào `boardSchema` ngay sau dòng `palette:`:

```js
    palette: { type: Array, default: [] },
    drawings: { type: Array, default: [] },
```

và ngay sau dòng `nextPaletteId:`:

```js
    nextPaletteId: { type: Number, default: 1 },
    nextDrawingId: { type: Number, default: 1 },
```

- [ ] **Step 2: Thêm field vào cả ba chỗ trong `PUT /:id`**

Trong `game-tools/server/boards.js`, handler `router.put("/:id", ...)`. Field board được **liệt kê tay ở ba chỗ**; bỏ sót chỗ nào là nét vẽ bị âm thầm rụng mà không có lỗi nào báo.

Chỗ 1 — destructure (khoảng dòng 118):

```js
    const {
      nodes, edges, groups, statuses, tags, palette, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view,
      clientId
    } = req.body;
```

Chỗ 2 — câu update (khoảng dòng 124):

```js
    await Board.findByIdAndUpdate(req.params.id, {
      nodes, edges, groups, statuses, tags, palette, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view, updatedAt
    });
```

Chỗ 3 — payload broadcast (khoảng dòng 137):

```js
    const payload = {
      nodes, edges, groups, statuses, tags, palette, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      updatedAt: updatedAt.toISOString()
    };
```

- [ ] **Step 3: Thêm hằng số và `sanitizeInk` vào `index.js`**

Trong `game-tools/server/index.js`, thêm ngay sau `const MAX_LIVE_TEXT_LEN = 20000;`:

```js
// Gói live:ink mang ĐIỂM MỚI THÊM của một nét đang vẽ. Trần này để một client
// lỗi (hoặc cố tình) không bơm được mảng khổng lồ rồi bắt server phát cho cả
// phòng — cùng lý do với MAX_LIVE_GEOM_ITEMS.
const MAX_LIVE_INK_NUMBERS = 200;
const MAX_LIVE_ERASE_IDS = 200;

function sanitizeInk(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!Number.isFinite(payload.strokeId)) return null;
  const strokeId = payload.strokeId;
  const done = payload.done === true;

  if (payload.cancel === true) return { strokeId, cancel: true };

  if (Array.isArray(payload.erase)) {
    const erase = payload.erase
      .filter((id) => Number.isFinite(id))
      .slice(0, MAX_LIVE_ERASE_IDS);
    return { strokeId, erase, done };
  }

  if (done) {
    return {
      strokeId, done: true,
      drawingId: Number.isFinite(payload.drawingId) ? payload.drawingId : null
    };
  }

  // pts phải là mảng số ĐỘ DÀI CHẴN: nó là [x0,y0,x1,y1,…], lẻ một số là dữ
  // liệu hỏng chứ không phải thiếu điểm cuối.
  if (!Array.isArray(payload.pts)) return null;
  const pts = payload.pts.slice(0, MAX_LIVE_INK_NUMBERS);
  if (pts.length < 2 || pts.length % 2 !== 0) return null;
  if (!pts.every((v) => Number.isFinite(v))) return null;

  const clean = { strokeId, seq: Number.isFinite(payload.seq) ? payload.seq : 0, pts };
  if (clean.seq === 0) {
    if (typeof payload.color !== "string" || !Number.isFinite(payload.w)) return null;
    clean.color = payload.color;
    clean.w = payload.w;
  }
  return clean;
}
```

- [ ] **Step 4: Thêm handler `live:ink`**

Trong `game-tools/server/index.js`, thêm ngay sau block `socket.on("live:geom", …)` (kết thúc khoảng dòng 281):

```js
  // Nét đang vẽ dở — không lưu DB, chỉ relay. Khác cursor/geom/text: vẽ là GHI
  // dữ liệu chứ không phải presence, nên chặn viewer ngay tại đây. Middleware
  // trên đã đặt socket.data.role.
  //
  // KHÔNG dùng .volatile: gói này mang ĐIỂM MỚI THÊM, mất một gói là nét khuyết
  // hẳn một khúc và không bao giờ tự lành (khác live:geom, nơi gói sau mang vị
  // trí tuyệt đối và tự sửa cho gói bị mất).
  socket.on("live:ink", (payload) => {
    if (socket.data.role === "viewer") return;
    const clean = sanitizeInk(payload);
    if (!clean) return;
    // socketId do SERVER đính vào, không tin id do client tự đặt — cùng cách
    // selection:update và edge-draft:update đang làm.
    socket.to(room).emit("live:ink", { ...clean, socketId: socket.id });
  });
```

- [ ] **Step 5: Chạy server và kiểm nó khởi động sạch**

```bash
cd game-tools/server && node --check index.js && node --check boards.js && node --check models.js
```

Kỳ vọng: không in gì (cú pháp hợp lệ). Server chưa có bộ test nào nên đây là mức kiểm tự động khả dụng; hành vi thật sẽ được smoke test của client và bước kiểm tay ở Task 8 phủ.

- [ ] **Step 6: Commit**

```bash
git add game-tools/server/models.js game-tools/server/boards.js game-tools/server/index.js
git commit -m "feat: server lưu drawings và chuyển tiếp kênh live:ink"
```

---

- [x] ## Task 5: `ToolRail` + `ToolOptions` — thanh công cụ bốn khu

**Files:**
- Create: `game-tools/client/src/components/ToolRail.jsx`
- Create: `game-tools/client/src/components/ToolOptions.jsx`
- Modify: `game-tools/client/src/index.css:1-45` (thêm `--pen-*` vào 4 khối theme)
- Modify: `game-tools/client/src/styles/idea-map.css` (thêm class `.tool-rail`, `.tool-options` ở cuối file)
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (state, gỡ topbar, render, phím tắt)
- Modify: `game-tools/client/src/locales/en/messages.po` (bản dịch chuỗi mới)
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (kiểm thanh công cụ)
- Modify: `game-tools/client/smoke-run.mjs` (fixture board có `drawings`)

**Interfaces:**
- Consumes: `PEN_COLORS`, `PEN_WIDTHS`, `PEN_DEFAULT`, `penVar`, `loadPenPrefs`, `savePenPrefs` từ `lib/pen.js` (Task 1)
- Produces:
  - `<ToolRail mode tool canEdit linkMode onMode onTool onAddNode onAddRootNode onAddGroup onToggleLink onCapture />`
    - `mode: "select" | "draw"`, `tool: "pen" | "eraser"`, `canEdit: boolean`, `linkMode: boolean`
    - `onMode(next: "select" | "draw")`, `onTool(next: "pen" | "eraser")`, bốn callback còn lại không tham số
  - `<ToolOptions tool prefs onPrefs />` với `prefs: { color, w }`, `onPrefs(next: { color, w })`
  - `IdeaMap` có state `mode`, `tool`, `penPrefs` dùng cho Task 6–8

- [x] **Step 1: Thêm biến màu bút vào `index.css`**

Trong `game-tools/client/src/index.css`, thêm một dòng `--pen-*` vào **cả bốn** khối theme. Bỏ sót khối `[data-theme]` nào là bấm nút `◐` xong nét vẽ giữ nguyên màu của theme cũ.

Vào khối `:root` (sau dòng `--dot-5 … --dot-8`):

```css
  /* Màu bút vẽ tay — hệ màu RIÊNG, không dùng --dot-* của nhãn/thẻ. Giá trị
     mượn từ --danger / --accent / --st-* đã được duyệt cho hai theme. */
  --pen-red: #A43F32; --pen-orange: #9C5A22; --pen-yellow: #8A6D14;
  --pen-green: #3C7A5A; --pen-blue: #35618A; --pen-purple: #6B5B8A;
  --pen-mono: #24261D;
```

Vào khối `@media (prefers-color-scheme: dark) :root` **và** khối `:root[data-theme="dark"]`, thêm y hệt hai dòng sau:

```css
    --pen-red: #E2685A; --pen-orange: #E3A455; --pen-yellow: #D4B451;
    --pen-green: #74C79B; --pen-blue: #86B8E8; --pen-purple: #B9A6DE;
    --pen-mono: #ECE7D2;
```

Vào khối `:root[data-theme="light"]`, thêm y hệt bộ giá trị sáng:

```css
  --pen-red: #A43F32; --pen-orange: #9C5A22; --pen-yellow: #8A6D14;
  --pen-green: #3C7A5A; --pen-blue: #35618A; --pen-purple: #6B5B8A;
  --pen-mono: #24261D;
```

- [x] **Step 2: Thêm CSS cho thanh công cụ**

Thêm vào cuối `game-tools/client/src/styles/idea-map.css`:

```css
/* Thanh công cụ bên trái NỔI trên canvas chứ không chiếm chỗ trong layout:
   đổi mode không làm khung nhìn co giãn, nên thẻ trên bảng không xê dịch.
   z-index 30: trên mọi thứ trong .canvas (cao nhất ở đó là 7), dưới panel neo
   (45) và menu popover (90). */
.tool-rail, .tool-options {
  position: absolute; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px; border-radius: 12px;
  background: var(--surface); border: 1px solid var(--line);
  box-shadow: var(--shadow); z-index: 30;
}
.tool-rail { left: 12px; width: 46px; }
.tool-options { left: 66px; width: 54px; }

.tool-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; margin: 0 auto; padding: 0;
  background: none; border: 1px solid transparent; border-radius: 8px;
  color: var(--ink-dim); cursor: pointer;
}
.tool-btn:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.tool-btn.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.tool-btn:disabled { opacity: 0.35; cursor: default; }

.tool-sep { height: 1px; margin: 3px 2px; background: var(--line); }

/* Ô màu và nút độ dày xếp 2 cột cho khu 4 khỏi dài quá một màn hình. */
.tool-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
.pen-swatch {
  width: 18px; height: 18px; margin: 0 auto; padding: 0;
  border: 2px solid transparent; border-radius: 50%; cursor: pointer;
}
.pen-swatch.on { border-color: var(--ink); }
.pen-width { display: flex; align-items: center; justify-content: center; height: 22px; }
.pen-width .bar { width: 22px; border-radius: 99px; background: currentColor; }
```

- [x] **Step 3: Tạo `ToolRail.jsx`**

Tạo `game-tools/client/src/components/ToolRail.jsx`:

```jsx
import { useLingui } from "@lingui/react/macro";

// Icon là inline SVG, không phải emoji: nó theo được currentColor nên tự đúng ở
// nền sáng và nền tối, cùng cách ColorMenu.jsx đang làm.
function IconCursor() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 3 L4 15 L7.5 11.8 L10 17 L12.2 16 L9.7 11 L14 10.6 Z" fill="currentColor" /></svg>;
}
function IconEdit() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 17 L4 13 L13.5 3.5 L16.5 6.5 L7 16 Z M12.5 4.5 L15.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconPen() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 16 C6 16 6 11 9 11 C12 11 12 15 15 15 C16.5 15 17 14 17 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconEraser() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M7 16 L3.5 12.5 L11 5 L16.5 10.5 L11 16 Z M8 16 L16.5 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconCard() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="5" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M16 6.5 L16 12 M13.3 9.2 L18.7 9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconRootCard() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="8" width="15" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4.5 6 L6.5 3.5 L8.5 6 L10 3 L11.5 6 L13.5 3.5 L15.5 6 Z" fill="currentColor" /></svg>;
}
function IconFrame() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.4" /></svg>;
}
function IconLink() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="5" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="15" cy="15" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6.9 6.9 L13.1 13.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconCapture() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 5.5 L16 5.5 M4 10 L16 10 M4 14.5 L11 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

export default function ToolRail({
  mode, tool, canEdit, linkMode,
  onMode, onTool, onAddNode, onAddRootNode, onAddGroup, onToggleLink, onCapture
}) {
  const { t } = useLingui();
  return (
    // Bấm vào thanh không được lọt xuống canvas thành một cú quét chọn.
    <div className="tool-rail" onMouseDown={(e) => e.stopPropagation()}>
      {/* Khu 1 — mode */}
      <button
        type="button"
        className={"tool-btn" + (mode === "select" ? " on" : "")}
        title={t`Chuột — chọn và di chuyển (V)`}
        onClick={() => onMode("select")}
      ><IconCursor /></button>
      <button
        type="button"
        className={"tool-btn" + (mode === "draw" ? " on" : "")}
        title={t`Sửa — vẽ lên bảng (B)`}
        disabled={!canEdit}
        onClick={() => onMode("draw")}
      ><IconEdit /></button>

      {/* Khu 2 — tool của mode Sửa. Mode Chuột thì ẩn hẳn, không phải làm mờ:
          mọi thao tác trên bảng khi đó giữ nguyên như trước khi có thanh này. */}
      {mode === "draw" && (
        <>
          <div className="tool-sep" />
          <button
            type="button"
            className={"tool-btn" + (tool === "pen" ? " on" : "")}
            title={t`Bút (B)`}
            disabled={!canEdit}
            onClick={() => onTool("pen")}
          ><IconPen /></button>
          <button
            type="button"
            className={"tool-btn" + (tool === "eraser" ? " on" : "")}
            title={t`Cục gôm (E)`}
            disabled={!canEdit}
            onClick={() => onTool("eraser")}
          ><IconEraser /></button>
        </>
      )}

      {/* Khu 3 — thêm. Luôn hiện, kể cả ở mode Sửa. */}
      <div className="tool-sep" />
      <button type="button" className="tool-btn" title={t`Thêm ý tưởng (N)`} disabled={!canEdit} onClick={onAddNode}><IconCard /></button>
      <button type="button" className="tool-btn" title={t`Thêm thẻ gốc (Shift+N)`} disabled={!canEdit} onClick={onAddRootNode}><IconRootCard /></button>
      <button type="button" className="tool-btn" title={t`Thêm khung`} disabled={!canEdit} onClick={onAddGroup}><IconFrame /></button>
      <button
        type="button"
        className={"tool-btn" + (linkMode ? " on" : "")}
        title={t`Nối ý tưởng (L)`}
        disabled={!canEdit}
        onClick={onToggleLink}
      ><IconLink /></button>
      <button type="button" className="tool-btn" title={t`Nhập nhanh`} disabled={!canEdit} onClick={onCapture}><IconCapture /></button>
    </div>
  );
}
```

- [x] **Step 4: Tạo `ToolOptions.jsx`**

Tạo `game-tools/client/src/components/ToolOptions.jsx`:

```jsx
import { useLingui } from "@lingui/react/macro";
import { PEN_COLORS, PEN_WIDTHS, penVar } from "../lib/pen.js";

export default function ToolOptions({ tool, prefs, onPrefs }) {
  const { t } = useLingui();
  // Cục gôm không có tuỳ chọn nào, và mode Chuột thì IdeaMap không render
  // component này — nên chỉ còn đúng một trường hợp phải vẽ.
  if (tool !== "pen") return null;

  return (
    <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
      <div className="tool-grid">
        {PEN_COLORS.map((token) => (
          <button
            key={token}
            type="button"
            className={"pen-swatch" + (prefs.color === token ? " on" : "")}
            style={{ background: penVar(token) }}
            title={t`Màu bút`}
            onClick={() => onPrefs({ ...prefs, color: token })}
          />
        ))}
      </div>
      <div className="tool-sep" />
      {PEN_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          className={"tool-btn pen-width" + (prefs.w === w ? " on" : "")}
          title={t`Độ dày nét`}
          onClick={() => onPrefs({ ...prefs, w })}
        >
          <span className="bar" style={{ height: w }} />
        </button>
      ))}
    </div>
  );
}
```

- [x] **Step 5: Thêm state và handler vào `IdeaMap.jsx`**

Thêm import (cạnh các import component khác, khoảng dòng 19):

```jsx
import ToolRail from "../components/ToolRail.jsx";
import ToolOptions from "../components/ToolOptions.jsx";
```

và cạnh import `lib` (khoảng dòng 32):

```jsx
import { PEN_DEFAULT, loadPenPrefs, savePenPrefs } from "../lib/pen.js";
```

Thêm state, cạnh `const [layouts, setLayouts] = useState(...)` (khoảng dòng 108):

```jsx
  // mode: "select" (thao tác thẻ như cũ) | "draw" (vẽ lên bảng).
  // KHÔNG nhớ qua lần mở sau: mở board ra mà con trỏ đang là cây bút là điều
  // gây bất ngờ vô cớ. Riêng màu bút và độ dày thì nhớ.
  const [mode, setMode] = useState("select");
  const [tool, setTool] = useState("pen");
  const [penPrefs, setPenPrefs] = useState(() => loadPenPrefs(window.localStorage));
```

Thêm effect ghi prefs, cạnh effect đang ghi `layouts`:

```jsx
  useEffect(() => { savePenPrefs(window.localStorage, penPrefs); }, [penPrefs]);
```

Thêm ba hàm, ngay sau `createGroup()` (khoảng dòng 667):

```jsx
  // Đổi sang mode Sửa thì bỏ lựa chọn và tắt nối dây: để lại một thẻ đang chọn
  // trong lúc vẽ nghĩa là bấm Delete sẽ xoá thẻ đó, trong khi người dùng đang
  // nghĩ mình xoá nét vẽ.
  function enterMode(next) {
    setMode(next);
    if (next === "draw") {
      setSelectedIds(new Set());
      setSelectedEdgeIds(new Set());
      setLinkMode(false);
      setPendingSource(null);
    }
  }

  function addCenteredNode(extra) {
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
    const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
    createNode(cx - CARD_W / 2, cy - 40, extra);
  }
```

Sửa `createNode` để nhận thuộc tính thêm (khoảng dòng 644):

```jsx
  function createNode(x, y, extra) {
    const id = board.nextNodeId;
    const node = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: null, x: Math.round(x), y: Math.round(y), ...extra };
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: id + 1 };
    setEditingId(id);
    commitAndSave(next);
  }
```

Sửa `handleAddClick` thành hai hàm không tham số. **Quan trọng:** `handleAddClick` hiện được truyền thẳng làm `onClick`, tức nó nhận sự kiện chuột làm tham số đầu — nếu để nó nhận `extra` thì `onClick={handleAddClick}` sẽ đổ cả `MouseEvent` vào node mới.

```jsx
  function handleAddClick() { addCenteredNode(null); }
  function handleAddRootClick() { addCenteredNode({ isRoot: true }); }
```

- [x] **Step 6: Gỡ menu THÊM và nút Nối ý tưởng khỏi topbar**

Trong `game-tools/client/src/pages/IdeaMap.jsx`, **xoá** khối `<TopMenu label={t`Thêm`}>…</TopMenu>` (khoảng dòng 2101–2105) và **xoá** khối `<button className={"btn ghost toggle" + (linkMode ? " active" : "")} …>Nối ý tưởng</button>` (khoảng dòng 2109–2115).

Giữ nguyên: `TopMenu label={t`Board`}`, hai nút hoàn tác/làm lại `↶` `↷`, `.search-box`, `TopMenu Dữ liệu`, `TopMenu Xem`, `.topbar-prefs`. Sau khi xoá, `.topbar` còn: tiêu đề → Board → ↶ ↷ → ô tìm kiếm → spacer → Dữ liệu → Xem → ngôn ngữ/sáng-tối.

- [x] **Step 7: Render thanh công cụ trong `.viewport`**

Trong `game-tools/client/src/pages/IdeaMap.jsx`, thêm ngay **sau** thẻ mở `<div className={"viewport" …}>` và **trước** `<div className="canvas" …>`:

```jsx
        <ToolRail
          mode={mode}
          tool={tool}
          canEdit={role !== "viewer"}
          linkMode={linkMode}
          onMode={enterMode}
          onTool={(next) => { setMode("draw"); setTool(next); }}
          onAddNode={handleAddClick}
          onAddRootNode={handleAddRootClick}
          onAddGroup={createGroup}
          onToggleLink={() => { setLinkMode((v) => !v); setPendingSource(null); }}
          onCapture={() => setCaptureOpen(true)}
        />
        {mode === "draw" && (
          <ToolOptions tool={tool} prefs={penPrefs} onPrefs={setPenPrefs} />
        )}
```

- [x] **Step 8: Thêm phím tắt**

Trong handler `onKeyDown` của `IdeaMap.jsx`, thêm các nhánh sau. Chèn nhánh `escape` **mới** vào **đầu** nhánh `escape` đang có — đang vẽ mà bấm Esc thì ý người dùng là "thoát cây bút", không phải "bỏ chọn thẻ".

```jsx
      else if (key === "escape") {
        if (mode === "draw") setMode("select");
        else if (colorMenu) setColorMenu(null);
        else if (badgeUI) setBadgeUI(null);
        // …các nhánh còn lại giữ nguyên
      }
```

Thêm bốn nhánh mới, đặt ngay sau nhánh `else if (key === "n")`:

```jsx
      // v chỉ đổi mode, không ghi gì — người chỉ xem vẫn dùng được.
      else if (key === "v") { e.preventDefault(); setMode("select"); }
      else if (key === "b") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("pen"); }
      else if (key === "e") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("eraser"); }
      else if (key === "l") { if (role === "viewer") return; e.preventDefault(); setLinkMode((v) => !v); setPendingSource(null); }
```

Sửa nhánh `n` để `Shift+N` tạo thẻ gốc:

```jsx
      else if (key === "n") {
        if (role === "viewer") return;
        e.preventDefault();
        if (e.shiftKey) handleAddRootClick();
        else handleAddClick();
      }
```

Thêm `mode` vào mảng dependency của `useEffect` chứa handler này (cuối mảng, cạnh `editingId`).

- [x] **Step 9: Thêm `drawings` vào fixture của smoke test**

Trong `game-tools/client/smoke-run.mjs`, thêm vào object `board`:

```js
  palette: [{ id: 1, hex: "#ff0000" }],
  drawings: [],
```

và sửa dòng `nextNodeId: 4, …`:

```js
  nextNodeId: 4, nextEdgeId: 3, nextGroupId: 2, nextStatusId: 3, nextTagId: 2, nextPaletteId: 2, nextDrawingId: 1,
```

- [x] **Step 10: Thêm kiểm thanh công cụ vào smoke test**

Trong `game-tools/client/src/__smoke__/entry.jsx`, thêm ngay **trước** `return true;` ở cuối hàm `run`:

```jsx
  // Thanh công cụ bên trái: khu 1 và khu 3 luôn hiện, khu 2 và khu 4 chỉ hiện ở
  // mode Sửa. Đây là bất biến dễ vỡ nhất của vỏ giao diện này.
  const railBtns = () => document.querySelectorAll(".tool-rail .tool-btn").length;
  log(`thanh công cụ: ${railBtns()} nút ở mode Chuột`);
  if (railBtns() !== 7) throw new Error("mode Chuột phải có 7 nút (2 mode + 5 thêm), có " + railBtns());
  if (document.querySelector(".tool-options")) throw new Error("mode Chuột không được hiện khu 4");

  // Menu THÊM và nút Nối ý tưởng phải đã rời khỏi topbar — mỗi việc một chỗ bấm.
  const topbarText = document.querySelector(".topbar").textContent;
  if (topbarText.includes("Nối ý tưởng")) throw new Error("nút Nối ý tưởng vẫn còn trên topbar");

  const drawBtn = document.querySelectorAll(".tool-rail .tool-btn")[1];
  await act(async () => { drawBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  log(`sau khi bật mode Sửa: ${railBtns()} nút, khu 4 = ${document.querySelectorAll(".tool-options .pen-swatch").length} ô màu`);
  if (railBtns() !== 9) throw new Error("mode Sửa phải có 9 nút (2 mode + 2 tool + 5 thêm), có " + railBtns());
  if (document.querySelectorAll(".tool-options .pen-swatch").length !== 7) throw new Error("khu 4 phải có 7 ô màu");
  if (document.querySelectorAll(".tool-options .pen-width").length !== 3) throw new Error("khu 4 phải có 3 nút độ dày");
```

- [x] **Step 11: Chạy test và smoke test**

```bash
cd game-tools/client && npm test && npm run test:smoke
```

Kỳ vọng: `npm test` PASS toàn bộ; smoke in `✅ SMOKE PASS` kèm dòng `thanh công cụ: 7 nút ở mode Chuột` và `sau khi bật mode Sửa: 9 nút, khu 4 = 7 ô màu`.

- [x] **Step 12: Trích chuỗi i18n và dịch tiếng Anh**

```bash
cd game-tools/client && npm run i18n:extract
```

Rồi mở `game-tools/client/src/locales/en/messages.po`, tìm các `msgid` mới và điền `msgstr`:

```
msgid "Chuột — chọn và di chuyển (V)"
msgstr "Cursor — select and move (V)"

msgid "Sửa — vẽ lên bảng (B)"
msgstr "Edit — draw on the board (B)"

msgid "Bút (B)"
msgstr "Pen (B)"

msgid "Cục gôm (E)"
msgstr "Eraser (E)"

msgid "Thêm ý tưởng (N)"
msgstr "Add idea (N)"

msgid "Thêm thẻ gốc (Shift+N)"
msgstr "Add root card (Shift+N)"

msgid "Thêm khung"
msgstr "Add frame"

msgid "Nối ý tưởng (L)"
msgstr "Link ideas (L)"

msgid "Nhập nhanh"
msgstr "Quick capture"

msgid "Màu bút"
msgstr "Pen colour"

msgid "Độ dày nét"
msgstr "Stroke width"
```

Chuỗi nào `--clean` gỡ đi vì không còn dùng thì để nguyên kết quả của lệnh.

- [x] **Step 13: Kiểm tay trên app đang chạy**

Chạy server (`cd game-tools/server && npm run dev`) và client (`cd game-tools/client && npm run dev`), mở một board, kiểm:

- Thanh dọc nổi ở lề trái, canh giữa theo chiều dọc, không đè lên thanh lọc.
- `.topbar` không còn menu THÊM và không còn nút NỐI Ý TƯỞNG.
- Bấm nút mode Sửa → khu 2 và khu 4 hiện ra; bấm về Chuột → cả hai biến mất.
- Chọn màu và độ dày → ô đang chọn có viền/nền nổi bật; tải lại trang thì lựa chọn còn nguyên.
- Năm nút khu 3 làm đúng việc: thêm thẻ, thêm thẻ gốc (có badge 👑), thêm khung, bật/tắt nối dây, mở hộp nhập nhanh.
- Phím `v` / `b` / `e` / `l` / `Shift+N` / `Esc`.
- Bấm nút `◐` đổi sáng/tối → 7 ô màu ở khu 4 đổi màu theo, vẫn phân biệt được.
- Mở board bằng tài khoản chỉ xem → nút mode Sửa và cả khu 3 mờ, bấm không ăn.

- [x] **Step 14: Commit**

```bash
git add game-tools/client/src/components/ToolRail.jsx game-tools/client/src/components/ToolOptions.jsx \
        game-tools/client/src/index.css game-tools/client/src/styles/idea-map.css \
        game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/locales \
        game-tools/client/src/__smoke__/entry.jsx game-tools/client/smoke-run.mjs
git commit -m "feat: thanh công cụ bên trái bốn khu cho bản đồ ý tưởng"
```

---

- [x] ## Task 6: `InkLayer` + `useInk` — vẽ bằng bút, lưu, hoàn tác

**Files:**
- Create: `game-tools/client/src/components/InkLayer.jsx`
- Create: `game-tools/client/src/lib/useInk.js`
- Modify: `game-tools/client/src/styles/idea-map.css` (thêm `.ink-layer`, `.ink-capture`)
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (nối hook, render lớp vẽ và lớp bắt chuột)
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (kiểm vẽ ra nét và lưu)

**Interfaces:**
- Consumes: `simplifyStroke`, `strokePath` từ `lib/stroke.js` (Task 2); `penVar` từ `lib/pen.js` (Task 1); state `mode` / `tool` / `penPrefs` từ Task 5
- Produces:
  - `<InkLayer drawings={} draft={} eraseIds={} liveStrokes={} />`
    - `drawings: Array<{id, kind, color, w, pts}>`
    - `draft: { color, w, pts } | null` — nét mình đang kéo
    - `eraseIds: number[]` — id đang bị đánh dấu xoá (Task 7 dùng; Task 6 truyền `[]`)
    - `liveStrokes: Map` — overlay của người khác (Task 8 dùng; Task 6 truyền `EMPTY_MAP`)
  - `useInk({ tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, live }) -> { draft, eraseIds, handleMouseDown }`
    - `onStrokeDone(stroke: { kind: "pen", color, w, pts })` — **không** có `id`; `IdeaMap` cấp id từ `nextDrawingId`
    - `onEraseDone(ids: number[])` — Task 7 dùng
    - `live` — object từ Task 8; Task 6 truyền `null` và hook phải chịu được `null`

- [ ] **Step 1: Thêm CSS cho lớp vẽ và lớp bắt chuột**

Thêm vào cuối `game-tools/client/src/styles/idea-map.css`:

```css
/* .canvas có width/height = 0 nên lớp con phải tự khai kích thước và
   overflow: visible — cùng khuôn với .edge-handle-layer ở trên.
   z-index 7 là cao nhất trong .canvas: trên .marquee-box (4),
   .edge-handle-layer (5), .connector-zone (5) và .peer-cursor (6).
   .idea-card không đặt z-index nên vẽ theo thứ tự DOM, cũng nằm dưới. */
.ink-layer {
  position: absolute; left: 0; top: 0; width: 4200px; height: 3200px;
  overflow: visible; pointer-events: none; z-index: 7;
}
.ink-layer path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.ink-layer path.erasing { opacity: 0.25; }

/* Lớp bắt chuột phủ toàn khung nhìn, CHỈ tồn tại ở mode Sửa. Đây là lý do kéo
   ngang qua trên một thẻ vẫn ra nét chứ không bị thẻ ăn mất chuột. z-index 8
   nằm dưới .tool-rail (30) nên thanh công cụ vẫn bấm được. */
.ink-capture { position: absolute; inset: 0; z-index: 8; cursor: crosshair; }
```

- [ ] **Step 2: Tạo `InkLayer.jsx`**

Tạo `game-tools/client/src/components/InkLayer.jsx`:

```jsx
import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { penVar } from "../lib/pen.js";

// Một đường vẽ duy nhất cho cả ba nguồn: nét đã lưu trong board, nét mình đang
// kéo, và nét người khác đang vẽ. Không có code path thứ hai để lệch nhau.
function Stroke({ color, w, pts, erasing }) {
  const d = strokePath(pts);
  if (!d) return null;
  // Không dùng vector-effect: non-scaling-stroke — muốn zoom vào là nét dày ra
  // như mực trên giấy.
  return <path className={erasing ? "erasing" : undefined} d={d} stroke={penVar(color)} strokeWidth={w} />;
}

function InkLayer({ drawings, draft, eraseIds, liveStrokes }) {
  // Nét bị đánh dấu xoá: của mình đang quét, hoặc của người khác đang quét.
  const dimmed = new Set(eraseIds);
  for (const e of liveStrokes.values()) {
    if (e.erase) for (const id of e.erase) dimmed.add(id);
  }

  return (
    <svg className="ink-layer">
      {drawings.map((d) => (
        <Stroke key={d.id} color={d.color} w={d.w} pts={d.pts} erasing={dimmed.has(d.id)} />
      ))}
      {Array.from(liveStrokes.entries()).map(([key, e]) => (
        e.pts ? <Stroke key={"live-" + key} color={e.color} w={e.w} pts={e.pts} /> : null
      ))}
      {draft && <Stroke color={draft.color} w={draft.w} pts={draft.pts} />}
    </svg>
  );
}

export default memo(InkLayer);
```

- [ ] **Step 3: Tạo `lib/useInk.js`**

Tạo `game-tools/client/src/lib/useInk.js`:

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { simplifyStroke, strokesHitBy } from "./stroke.js";
import { rafThrottle } from "./raf-throttle.js";

// Bán kính gôm, đơn vị toạ độ canvas. Cộng thêm w/2 của từng nét trong
// strokesHitBy, nên nét dày dễ chạm hơn nét mảnh — đúng cảm giác mong đợi.
const ERASE_RADIUS = 8;

// Chuột → toạ độ canvas. Camera nằm trong board.view, đọc qua ref để handler
// gắn vào window không bị bám vào một bản chụp cũ.
function toCanvas(e, viewportEl, view) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - view.panX) / view.scale,
    y: (e.clientY - rect.top - view.panY) / view.scale
  };
}

export function useInk({ tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, live }) {
  const [draft, setDraft] = useState(null);
  const [eraseIds, setEraseIds] = useState([]);

  // `live` qua ref: effect nghe `blur` chỉ cần gắn MỘT lần, không phải gỡ/gắn
  // lại mỗi khi object live được dựng lại.
  const liveRef = useRef(live);
  liveRef.current = live;

  // Điểm thô nằm trong ref, KHÔNG trong state: setState cho mỗi mousemove là
  // dựng lại cây React 100+ lần/giây rồi vứt đi phần lớn.
  const ptsRef = useRef([]);
  // Điểm chưa gửi lên kênh live — gói mang ĐIỂM MỚI THÊM, không phải cả nét.
  const unsentRef = useRef([]);
  const eraseSetRef = useRef(new Set());
  const activeRef = useRef(null);   // "pen" | "eraser" | null

  const pushDraft = useRef(null);
  if (!pushDraft.current) {
    pushDraft.current = rafThrottle((color, w, pts) => setDraft({ color, w, pts }));
  }
  const pushErase = useRef(null);
  if (!pushErase.current) {
    pushErase.current = rafThrottle((ids) => setEraseIds(ids));
  }

  useEffect(() => () => {
    pushDraft.current?.cancel();
    pushErase.current?.cancel();
  }, []);

  const handleMouseDown = useCallback((e) => {
    const viewportEl = viewportRef.current;
    const board = boardRef.current;
    if (!viewportEl || !board) return;

    const start = toCanvas(e, viewportEl, board.view);

    if (tool === "eraser") {
      activeRef.current = "eraser";
      eraseSetRef.current = new Set(strokesHitBy(board.drawings || [], start, ERASE_RADIUS));
      pushErase.current(Array.from(eraseSetRef.current));
      // Gọi cả khi rỗng: beginErase phải tăng strokeId để lượt quét này có khoá
      // overlay riêng, không nối tiếp vào lượt trước.
      live?.beginErase(Array.from(eraseSetRef.current));
    } else {
      activeRef.current = "pen";
      ptsRef.current = [start.x, start.y];
      unsentRef.current = [];
      pushDraft.current(penPrefs.color, penPrefs.w, ptsRef.current.slice());
      live?.beginStroke(penPrefs.color, penPrefs.w, [Math.round(start.x), Math.round(start.y)]);
    }

    function onMove(ev) {
      const b = boardRef.current;
      if (!b) return;
      const p = toCanvas(ev, viewportEl, b.view);

      if (activeRef.current === "eraser") {
        const hit = strokesHitBy(b.drawings || [], p, ERASE_RADIUS);
        let added = null;
        for (const id of hit) {
          if (eraseSetRef.current.has(id)) continue;
          eraseSetRef.current.add(id);
          (added || (added = [])).push(id);
        }
        if (added) {
          pushErase.current(Array.from(eraseSetRef.current));
          live?.pushErase(added);
        }
        return;
      }

      ptsRef.current.push(p.x, p.y);
      unsentRef.current.push(Math.round(p.x), Math.round(p.y));
      pushDraft.current(penPrefs.color, penPrefs.w, ptsRef.current.slice());
      // Gói mang đúng những điểm chưa gửi; trailingThrottle bên useInkLive gộp
      // các lần gọi trong cùng 40ms nên phải xả `unsent` ở ĐÓ, không phải ở đây.
      live?.pushPoints(unsentRef.current);
    }

    function finish() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", finish);
      const wasPen = activeRef.current === "pen";
      activeRef.current = null;

      if (!wasPen) {
        const ids = Array.from(eraseSetRef.current);
        eraseSetRef.current = new Set();
        pushErase.current.cancel();
        setEraseIds([]);
        // Quét mà không chạm nét nào: không commit, không tạo entry hoàn tác rác.
        if (ids.length) onEraseDone(ids);
        live?.endErase();
        return;
      }

      pushDraft.current.cancel();
      setDraft(null);
      const pts = simplifyStroke(ptsRef.current);
      ptsRef.current = [];
      unsentRef.current = [];
      // Bấm rồi nhả mà không di: một điểm, không phải nét. Bỏ.
      if (pts.length < 4) { live?.cancelStroke(); return; }
      const drawingId = onStrokeDone({ kind: "pen", color: penPrefs.color, w: penPrefs.w, pts });
      live?.endStroke(drawingId);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", finish);
  }, [tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, live]);

  // Cửa sổ mất focus giữa nét: mouseup sẽ không bao giờ tới, nên phải tự huỷ —
  // nếu không, nét treo lại trên màn hình mình và trên màn hình người khác.
  useEffect(() => {
    function onBlur() {
      if (!activeRef.current) return;
      activeRef.current = null;
      ptsRef.current = [];
      unsentRef.current = [];
      eraseSetRef.current = new Set();
      pushDraft.current.cancel();
      pushErase.current.cancel();
      setDraft(null);
      setEraseIds([]);
      liveRef.current?.cancelStroke();
    }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return { draft, eraseIds, handleMouseDown };
}
```

- [ ] **Step 4: Nối hook vào `IdeaMap.jsx`**

Thêm import:

```jsx
import InkLayer from "../components/InkLayer.jsx";
import { useInk } from "../lib/useInk.js";
```

Thêm hàm commit nét, đặt cạnh `createGroup()`:

```jsx
  // Trả về id đã cấp để useInk gửi kèm vào gói live `done` — người xem cần id
  // thật mới đối chiếu được overlay với board:update sắp về.
  function commitStroke(stroke) {
    const id = board.nextDrawingId;
    commitAndSave({
      ...board,
      drawings: [...board.drawings, { id, ...stroke }],
      nextDrawingId: id + 1
    });
    return id;
  }

  function commitErase(ids) {
    const kill = new Set(ids);
    commitAndSave({ ...board, drawings: board.drawings.filter((d) => !kill.has(d.id)) });
  }
```

Gọi hook, đặt sau `const { cardSize: frameCardSize, observeCard } = useCardSizes();`:

```jsx
  const ink = useInk({
    tool, penPrefs, boardRef, viewportRef,
    onStrokeDone: commitStroke,
    onEraseDone: commitErase,
    live: null            // Task 8 thay bằng object từ useInkLive
  });
```

Thêm handler cho lớp bắt chuột, cạnh `handleViewportMouseDown`:

```jsx
  // Nhường đường cho lia bảng TRƯỚC khi nghĩ tới việc vẽ — đúng thứ tự
  // handleViewportMouseDown đang dùng, nên chuột phải và Space+trái vẫn lia
  // bảng bình thường ở mode Sửa.
  function handleInkCaptureMouseDown(e) {
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    ink.handleMouseDown(e);
  }
```

- [ ] **Step 5: Render lớp vẽ và lớp bắt chuột**

Trong `game-tools/client/src/pages/IdeaMap.jsx`, thêm `<InkLayer>` vào **cuối** `<div className="canvas">`, ngay sau `<PeerLayer … />`:

```jsx
          <InkLayer
            drawings={board.drawings}
            draft={ink.draft}
            eraseIds={ink.eraseIds}
            liveStrokes={EMPTY_MAP}
          />
```

Thêm lớp bắt chuột ngay **sau** `<ToolOptions …>` (tức trong `.viewport`, ngoài `.canvas`):

```jsx
        {mode === "draw" && (
          <div className="ink-capture" onMouseDown={handleInkCaptureMouseDown} />
        )}
```

`EMPTY_MAP` đã có sẵn ở đầu file (dòng 42).

- [ ] **Step 6: Mặc định `drawings` cho board cũ**

Board đã lưu từ trước không có field `drawings`. Chỗ này đã có sẵn khuôn mẫu cho đúng tình huống đó — `game-tools/client/src/pages/IdeaMap.jsx:184`, trong `.then()` của `getBoard`:

```jsx
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        setBoard({ palette: [], nextPaletteId: 1, ...boardData, ...(camera ? { view: camera } : {}) });
```

Thêm hai mặc định mới vào **trước** `...boardData` (thứ tự này quan trọng: board có field thật thì giá trị thật thắng mặc định):

```jsx
        setBoard({ palette: [], nextPaletteId: 1, drawings: [], nextDrawingId: 1, ...boardData, ...(camera ? { view: camera } : {}) });
```

`mergeRemoteBoard` trong `lib/useLiveSync.js` **không** cần sửa: nó dùng `{ ...local, ...incoming }` nên gói `board:update` từ server cũ (chưa có `drawings`) không xoá mất `drawings` của local.

- [ ] **Step 7: Thêm kiểm vẽ vào smoke test**

Trong `game-tools/client/src/__smoke__/entry.jsx`, thêm ngay sau khối kiểm thanh công cụ của Task 5 (mode Sửa đang bật):

```jsx
  // Vẽ một nét: kéo chuột trên lớp bắt chuột phải ra path trong .ink-layer và
  // đúng MỘT lần lưu.
  const capture = document.querySelector(".ink-capture");
  if (!capture) throw new Error("mode Sửa phải có lớp bắt chuột .ink-capture");
  const putsBeforeDraw = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 400, 400, capture);
    mouse("mousemove", 440, 420);
    mouse("mousemove", 480, 400);
    mouse("mousemove", 520, 430);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 520, 430); await new Promise((r) => setTimeout(r, 40)); });

  const paths = document.querySelectorAll(".ink-layer path");
  log(`sau khi vẽ: ${paths.length} path trong .ink-layer · PUT thêm ${globalThis.__puts.length - putsBeforeDraw} lần`);
  if (paths.length !== 1) throw new Error("mong đợi 1 nét đã lưu, có " + paths.length);
  if (globalThis.__puts.length - putsBeforeDraw !== 1) throw new Error("một nét phải đúng 1 lần lưu");
  const saved = globalThis.__puts[globalThis.__puts.length - 1];
  if (saved.drawings.length !== 1) throw new Error("payload lưu phải có 1 nét");
  if (saved.nextDrawingId !== 2) throw new Error("nextDrawingId phải tăng lên 2");
  if (saved.drawings[0].color !== "pen-red" || saved.drawings[0].w !== 4) throw new Error("nét phải mang màu và độ dày đang chọn");
  if (saved.drawings[0].pts.some((v) => !Number.isInteger(v))) throw new Error("toạ độ nét phải là số nguyên");

  // Bấm rồi nhả không di chuyển: một điểm, không phải nét — không được lưu.
  const putsBeforeClick = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 700, 700, capture);
    mouse("mouseup", 700, 700);
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`bấm-nhả không di: PUT thêm ${globalThis.__puts.length - putsBeforeClick} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeClick) throw new Error("bấm rồi nhả không được tạo nét rác");
```

- [ ] **Step 8: Chạy test và smoke test**

```bash
cd game-tools/client && npm test && npm run test:smoke
```

Kỳ vọng: `npm test` PASS; smoke in `✅ SMOKE PASS` kèm `sau khi vẽ: 1 path trong .ink-layer · PUT thêm 1 lần` và `bấm-nhả không di: PUT thêm 0 lần (phải là 0)`.

- [ ] **Step 9: Kiểm tay trên app đang chạy**

- Bật mode Sửa, chọn bút → con trỏ thành hình chữ thập, kéo chuột ra nét đúng màu và độ dày đã chọn.
- Kéo ngang qua trên một thẻ → ra nét, thẻ **không** bị kéo theo.
- Chuột phải kéo và Space+trái kéo trong mode Sửa → vẫn lia bảng, không ra nét.
- Cuộn chuột zoom vào/ra → nét dày mỏng theo, không lệch khỏi thẻ.
- Tải lại trang → nét còn nguyên.
- Ctrl+Z → mất đúng nét vừa vẽ; Ctrl+Shift+Z → nét về.
- Về mode Chuột → bấm và kéo thẻ bình thường, nét vẽ không chặn đường.
- Đổi sáng/tối → nét đổi màu theo.

- [ ] **Step 10: Commit**

```bash
git add game-tools/client/src/components/InkLayer.jsx game-tools/client/src/lib/useInk.js \
        game-tools/client/src/styles/idea-map.css game-tools/client/src/pages/IdeaMap.jsx \
        game-tools/client/src/__smoke__/entry.jsx
git commit -m "feat: vẽ tay bằng bút trên bản đồ ý tưởng"
```

---

- [x] ## Task 7: Cục gôm

Phần lớn logic đã nằm trong `useInk` từ Task 6 (nhánh `tool === "eraser"`). Task này bật nó lên, kiểm nó chạy, và chốt bất biến "một lần quét = một bước hoàn tác".

**Files:**
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (kiểm gôm)

**Interfaces:**
- Consumes: `useInk` với `onEraseDone` (Task 6), `strokesHitBy` (Task 2), `commitErase` (Task 6)
- Produces: không có interface mới

- [ ] **Step 1: Thêm kiểm gôm vào smoke test**

Trong `game-tools/client/src/__smoke__/entry.jsx`, thêm ngay sau khối kiểm vẽ của Task 6:

```jsx
  // Vẽ thêm hai nét nữa để có ba nét, rồi quét gôm qua cả ba.
  for (const y of [600, 620]) {
    await act(async () => {
      mouse("mousedown", 400, y, capture);
      mouse("mousemove", 500, y);
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => { mouse("mouseup", 500, y); await new Promise((r) => setTimeout(r, 30)); });
  }
  if (document.querySelectorAll(".ink-layer path").length !== 3) throw new Error("mong đợi 3 nét trước khi gôm");

  // Bật cục gôm: nút thứ 4 trên thanh (2 mode + bút + gôm).
  const eraserBtn = document.querySelectorAll(".tool-rail .tool-btn")[3];
  await act(async () => { eraserBtn.click(); await new Promise((r) => setTimeout(r, 20)); });

  const putsBeforeErase = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 420, 600, capture);
    mouse("mousemove", 450, 610);
    mouse("mousemove", 470, 620);
    await new Promise((r) => setTimeout(r, 60));
  });
  // Trong lúc quét, nét bị đánh dấu phải mờ đi để thấy trước khi mất.
  const dimmed = document.querySelectorAll(".ink-layer path.erasing").length;
  log(`đang quét gôm: ${dimmed} nét đang mờ đi`);
  if (dimmed < 2) throw new Error("quét qua 2 nét thì phải có ít nhất 2 nét mờ, có " + dimmed);

  await act(async () => { mouse("mouseup", 470, 620); await new Promise((r) => setTimeout(r, 40)); });
  const left = document.querySelectorAll(".ink-layer path").length;
  log(`sau khi gôm: còn ${left} nét · PUT thêm ${globalThis.__puts.length - putsBeforeErase} lần`);
  if (left !== 1) throw new Error("phải còn đúng 1 nét (nét đầu ở y≈400), có " + left);
  if (globalThis.__puts.length - putsBeforeErase !== 1) throw new Error("một lần quét gôm phải đúng 1 lần lưu");

  // Quét chỗ trống: không được tạo entry hoàn tác rác.
  const putsBeforeEmpty = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1500, 1500, capture);
    mouse("mousemove", 1560, 1560);
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => { mouse("mouseup", 1560, 1560); await new Promise((r) => setTimeout(r, 30)); });
  log(`quét gôm chỗ trống: PUT thêm ${globalThis.__puts.length - putsBeforeEmpty} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeEmpty) throw new Error("quét chỗ trống không được tạo bước hoàn tác");
```

- [ ] **Step 2: Chạy smoke test để xem nó thất bại ở đâu**

```bash
cd game-tools/client && npm run test:smoke
```

Nếu Task 6 đã cài `useInk` đúng thì bài này xanh ngay. Nếu đỏ, sửa `useInk.js` (nhánh `eraser`) hoặc `commitErase` trong `IdeaMap.jsx` cho tới khi xanh — **không** sửa bài kiểm để nó xanh.

- [ ] **Step 3: Chạy cả bộ test**

```bash
cd game-tools/client && npm test && npm run test:smoke
```

Kỳ vọng: cả hai PASS, smoke in `sau khi gôm: còn 1 nét · PUT thêm 1 lần` và `quét gôm chỗ trống: PUT thêm 0 lần (phải là 0)`.

- [ ] **Step 4: Kiểm tay trên app đang chạy**

- Vẽ vài nét, bật cục gôm, quét qua nhiều nét → chúng mờ dần trong lúc quét rồi mất khi thả chuột.
- Một lần quét xoá 5 nét → bấm Ctrl+Z một lần thì cả 5 nét về.
- Quét chỗ trống → Ctrl+Z vẫn lùi về thao tác trước đó chứ không "lùi một bước rỗng".
- Nét dày dễ chạm hơn nét mảnh (ngưỡng có cộng `w/2`).
- Phím `e` bật cục gôm, phím `b` về bút.

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/__smoke__/entry.jsx
git commit -m "test: chốt cục gôm xoá cả nét và một lần quét là một bước hoàn tác"
```

---

- [x] ## Task 8: `useInkLive` — nét chạy theo thời gian thực

**Files:**
- Create: `game-tools/client/src/lib/useInkLive.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx` (gọi hook, truyền `live` vào `useInk`, truyền `liveStrokes` vào `InkLayer`, đối chiếu sau `board:update`)
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (kiểm phát và nhận gói)

**Interfaces:**
- Consumes: `mergeInkPacket`, `reconcileInkOverlay` từ `lib/ink-live.js` (Task 3 — `inkKey` và hai hằng TTL chỉ dùng nội bộ trong đó, không import ở đây); `sweepExpired` đã export sẵn từ `lib/useLiveSync.js`; `trailingThrottle` từ `lib/raf-throttle.js`; `socket` từ `usePresence`; `live` được `useInk` (Task 6) gọi qua `live?.…`
- Produces: `useInkLive(socket) -> live`, với `live` là object:
  - `liveStrokes: Map` — truyền vào `InkLayer`
  - `beginStroke(color, w, pts)` — phát gói `seq 0`
  - `pushPoints(unsent: number[])` — phát gói `seq n`; hook tự xả mảng `unsent` sau khi gửi
  - `endStroke(drawingId: number)` — phát `{ done: true, drawingId }`
  - `cancelStroke()` — phát `{ cancel: true }`
  - `beginErase(ids: number[])` — mở lượt gôm: tăng `strokeId` rồi phát `{ erase: ids }` nếu `ids` không rỗng
  - `pushErase(ids: number[])` — phát `{ erase: ids }` (chỉ id **mới** chạm)
  - `endErase()` — phát `{ erase: [], done: true }`
  - `reconcile(board)` — bỏ overlay đã có mặt trong `board.drawings`

- [ ] **Step 1: Tạo `lib/useInkLive.js`**

Tạo `game-tools/client/src/lib/useInkLive.js`:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trailingThrottle } from "./raf-throttle.js";
import { sweepExpired } from "./useLiveSync.js";
import { mergeInkPacket, reconcileInkOverlay } from "./ink-live.js";

// Nhịp phát: ~25 gói/giây. Nhanh hơn nhịp 60ms của kéo thẻ vì mắt bắt nét vẽ
// nhạy hơn bắt thẻ chạy. Một người vẽ liên tục tốn chừng 1KB/giây.
const INK_SEND_MS = 40;
const SWEEP_MS = 300;
const EMPTY_MAP = new Map();

// QUAN TRỌNG — chỉ người ĐANG THẬT SỰ vẽ mới được phát; người nhận không bao
// giờ phát lại. Đây đúng cái bẫy mà ghi chú dài trong useLiveSync.js mô tả: nếu
// người nhận phát lại thì A → B → A thành vòng vọng và nét nhảy đi nhảy lại.
// Hook này chỉ phát từ trong các hàm được handler chuột gọi tay, không có effect
// nào theo dõi board rồi phát lại.
export function useInkLive(socket) {
  const [liveStrokes, setLiveStrokes] = useState(EMPTY_MAP);
  const socketRef = useRef(socket);
  const strokeIdRef = useRef(0);       // số đếm cục bộ; server đính socketId
  const seqRef = useRef(0);

  useEffect(() => {
    socketRef.current = socket;
    return () => { socketRef.current = null; };
  }, [socket]);

  // QUAN TRỌNG — vì sao phải có bộ tích luỹ riêng thay vì throttle thẳng lời
  // gọi: trailingThrottle THAY tham số đang chờ (`pending = args`). Gói này mang
  // ĐIỂM MỚI THÊM, nên nếu ba lần gọi rơi vào cùng một cửa sổ 40ms thì hai lô
  // điểm đầu bị ghi đè và mất vĩnh viễn — đúng cái "nét khuyết khúc" mà cả thiết
  // kế này sinh ra để tránh. Điểm phải cộng dồn vào `pendingPtsRef`, và throttle
  // chỉ quyết định LÚC NÀO xả, không quyết định xả cái gì.
  const pendingPtsRef = useRef([]);
  const pendingEraseRef = useRef([]);

  const emitNow = useCallback((payload) => {
    socketRef.current?.emit("live:ink", payload);
  }, []);

  const flushPtsRef = useRef(null);
  if (!flushPtsRef.current) {
    flushPtsRef.current = trailingThrottle(() => {
      if (!pendingPtsRef.current.length) return;
      const pts = pendingPtsRef.current;
      pendingPtsRef.current = [];
      // seq chỉ tăng khi THẬT SỰ phát: nó đánh số gói đã gửi, không đánh số lần
      // chuột nhích.
      seqRef.current += 1;
      socketRef.current?.emit("live:ink", { strokeId: strokeIdRef.current, seq: seqRef.current, pts });
    }, INK_SEND_MS);
  }

  const flushEraseRef = useRef(null);
  if (!flushEraseRef.current) {
    flushEraseRef.current = trailingThrottle(() => {
      if (!pendingEraseRef.current.length) return;
      const erase = pendingEraseRef.current;
      pendingEraseRef.current = [];
      socketRef.current?.emit("live:ink", { strokeId: strokeIdRef.current, erase });
    }, INK_SEND_MS);
  }

  useEffect(() => () => {
    flushPtsRef.current?.cancel();
    flushEraseRef.current?.cancel();
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onInk(packet) {
      setLiveStrokes((prev) => mergeInkPacket(prev, packet, Date.now()));
    }
    socket.on("live:ink", onInk);
    return () => socket.off("live:ink", onInk);
  }, [socket]);

  // Một bộ quét theo nhịp, cùng cách useLiveSync.js làm: người vẽ rớt mạng giữa
  // nét thì nét tạm tự dọn sau INK_LIVE_TTL_MS.
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveStrokes((prev) => sweepExpired(prev, Date.now()));
    }, SWEEP_MS);
    return () => clearInterval(timer);
  }, []);

  // Gói đầu phải đi NGAY, không nằm chờ trong throttle: nó mang màu và độ dày,
  // thiếu nó thì mọi gói sau bị người nhận bỏ (xem mergeInkPacket).
  const beginStroke = useCallback((color, w, pts) => {
    flushPtsRef.current.cancel();
    pendingPtsRef.current = [];
    strokeIdRef.current += 1;
    seqRef.current = 0;
    emitNow({ strokeId: strokeIdRef.current, seq: 0, color, w, pts });
  }, [emitNow]);

  const pushPoints = useCallback((unsent) => {
    if (!unsent.length) return;
    for (const v of unsent) pendingPtsRef.current.push(v);
    // Xả mảng của người gọi: mỗi điểm chỉ được gửi đúng một lần, vì người nhận
    // NỐI THÊM chứ không thay cả nét.
    unsent.length = 0;
    flushPtsRef.current();
  }, []);

  // Xả nốt điểm còn treo TRƯỚC gói done, không thì đuôi nét bị cắt trên màn hình
  // người khác cho tới khi board:update về.
  const endStroke = useCallback((drawingId) => {
    flushPtsRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, done: true, drawingId: drawingId ?? null });
  }, [emitNow]);

  const cancelStroke = useCallback(() => {
    flushPtsRef.current.cancel();
    pendingPtsRef.current = [];
    emitNow({ strokeId: strokeIdRef.current, cancel: true });
  }, [emitNow]);

  // Lượt gôm cũng chiếm một strokeId riêng, vì các gói erase của cùng một lần
  // quét phải gom vào MỘT entry overlay. Tăng số đếm ở đầu lượt (kể cả khi cú
  // bấm đầu chưa chạm nét nào) để lần quét sau không nối tiếp vào lần trước.
  const beginErase = useCallback((ids) => {
    flushEraseRef.current.cancel();
    pendingEraseRef.current = [];
    strokeIdRef.current += 1;
    if (ids.length) emitNow({ strokeId: strokeIdRef.current, erase: ids.slice() });
  }, [emitNow]);

  const pushErase = useCallback((ids) => {
    if (!ids.length) return;
    for (const id of ids) pendingEraseRef.current.push(id);
    flushEraseRef.current();
  }, []);

  const endErase = useCallback(() => {
    flushEraseRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, erase: [], done: true });
  }, [emitNow]);

  const reconcile = useCallback((board) => {
    setLiveStrokes((prev) => reconcileInkOverlay(prev, board));
  }, []);

  // useMemo: object này là dependency của useInk và của applyRemoteBoard. Trả
  // một object mới mỗi render là bắt chúng dựng lại theo, kể cả khi không có gì
  // thật sự đổi.
  return useMemo(
    () => ({ liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke, beginErase, pushErase, endErase, reconcile }),
    [liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke, beginErase, pushErase, endErase, reconcile]
  );
}
```

- [ ] **Step 2: Nối `useInkLive` vào `IdeaMap.jsx`**

Thêm import:

```jsx
import { useInkLive } from "../lib/useInkLive.js";
```

Gọi hook **trước** `useInk` (vì `useInk` nhận nó làm tham số), đặt ngay sau dòng `const { sendCursor, sendSelection, sendEdgeDraft, socket } = usePresence(user, boardId);`:

```jsx
  const inkLive = useInkLive(socket);
```

Sửa lời gọi `useInk`, thay `live: null`:

```jsx
    live: inkLive
```

Sửa `<InkLayer>`, thay `liveStrokes={EMPTY_MAP}`:

```jsx
            liveStrokes={inkLive.liveStrokes}
```

- [ ] **Step 3: Đối chiếu overlay sau mỗi `board:update`**

`game-tools/client/src/pages/IdeaMap.jsx:227` hiện truyền thẳng `setBoard` làm `applyRemoteBoard`:

```jsx
    useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, setBoard);
```

Thay bằng một hàm bọc. Nó **phải** ổn định qua các lần render vì `useLiveSync` có `applyRemoteBoard` trong mảng dependency của effect nghe socket (`lib/useLiveSync.js:264`) — truyền một hàm mới mỗi render là gỡ và gắn lại listener 60 lần/giây. `inkLive.reconcile` là `useCallback` deps `[]` nên bản thân nó đã ổn định.

Thêm `useCallback` vào import React ở đầu file (hiện chỉ có `useEffect, useMemo, useRef, useState`), rồi khai báo trước lời gọi `useLiveSync`:

```jsx
  // Overlay nào đã được board thật bắt kịp phải bỏ NGAY. Giữ lại nghĩa là tiếp
  // tục vẽ một bản tạm đè lên dữ liệu thật vừa nhận — nét nhấp nháy.
  const applyRemoteBoard = useCallback((next) => {
    setBoard(next);
    inkLive.reconcile(next);
  }, [inkLive.reconcile]);
```

và sửa lời gọi:

```jsx
    useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard);
```

- [ ] **Step 4: Thêm kiểm realtime vào smoke test**

Trong `game-tools/client/src/__smoke__/entry.jsx`, thêm ngay sau khối kiểm gôm của Task 7:

```jsx
  // PHÁT: một nét bút phải ra gói seq 0 mang màu/độ dày, rồi các gói mang ĐIỂM
  // MỚI THÊM, rồi đúng một gói done mang drawingId.
  const penBtn = document.querySelectorAll(".tool-rail .tool-btn")[2];
  await act(async () => { penBtn.click(); await new Promise((r) => setTimeout(r, 20)); });

  const emittedBeforeInk = globalThis.__emitted.length;
  await act(async () => {
    mouse("mousedown", 900, 200, capture);
    mouse("mousemove", 930, 220);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 960, 200);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 960, 200); await new Promise((r) => setTimeout(r, 40)); });

  const inkPkts = globalThis.__emitted.slice(emittedBeforeInk).filter((e) => e[0] === "live:ink").map((e) => e[1]);
  log(`live:ink đã phát: ${inkPkts.length} gói; seq = ${inkPkts.map((p) => (p.done ? "done" : p.seq)).join(",")}`);
  if (inkPkts.length < 2) throw new Error("phải phát ít nhất gói đầu và gói done");
  const first = inkPkts[0];
  if (first.seq !== 0 || first.color !== "pen-red" || first.w !== 4) throw new Error("gói đầu phải mang seq 0, màu và độ dày");
  const last = inkPkts[inkPkts.length - 1];
  if (last.done !== true || !Number.isFinite(last.drawingId)) throw new Error("gói cuối phải là done kèm drawingId");
  if (inkPkts.filter((p) => p.done).length !== 1) throw new Error("một nét chỉ được có đúng 1 gói done");
  // Điểm không được gửi lặp: tổng số điểm đã phát phải bằng số điểm nét thô,
  // không phải bằng tổng luỹ tiến của cả nét ở mỗi gói.
  const sentNumbers = inkPkts.filter((p) => p.pts).reduce((n, p) => n + p.pts.length, 0);
  if (sentNumbers > 10) throw new Error("gói phải mang điểm MỚI THÊM, không mang lại cả nét (đã gửi " + sentNumbers + " số)");

  // NHẬN: gói của người khác phải hiện thành nét ngay, và biến mất khi
  // board:update mang nét thật về.
  const pathsBeforePeer = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer1", strokeId: 1, seq: 0, color: "pen-blue", w: 8, pts: [100, 900, 140, 940] });
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`nét của người khác đang vẽ: ${document.querySelectorAll(".ink-layer path").length} path (trước đó ${pathsBeforePeer})`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsBeforePeer + 1) throw new Error("gói live:ink của người khác không hiện ra");

  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer1", strokeId: 1, seq: 1, pts: [180, 900] });
    await new Promise((r) => setTimeout(r, 30));
  });
  const peerPath = Array.from(document.querySelectorAll(".ink-layer path")).find((p) => (p.getAttribute("d") || "").startsWith("M 100 900"));
  if (!peerPath) throw new Error("không tìm thấy nét của người khác");
  if (!peerPath.getAttribute("d").includes("L 180 900")) throw new Error("gói sau phải NỐI THÊM điểm vào nét đang vẽ");

  // Bản lưu chính thức về, mang đúng nét đó → overlay phải bỏ ngay, không nháy.
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer1", strokeId: 1, done: true, drawingId: 99 });
    await new Promise((r) => setTimeout(r, 30));
  });
  const emittedBeforeUpdate = globalThis.__emitted.length;
  const boardNow = globalThis.__puts[globalThis.__puts.length - 1];
  await act(async () => {
    globalThis.__deliver("board:update", {
      ...boardNow,
      drawings: [...boardNow.drawings, { id: 99, kind: "pen", color: "pen-blue", w: 8, pts: [100, 900, 140, 940, 180, 900] }],
      nextDrawingId: 100,
      updatedAt: new Date(Date.now() + 20000).toISOString()
    });
    await new Promise((r) => setTimeout(r, 30));
  });
  const dCount = Array.from(document.querySelectorAll(".ink-layer path")).filter((p) => (p.getAttribute("d") || "").startsWith("M 100 900")).length;
  log(`sau board:update mang nét thật: ${dCount} bản của nét đó (phải là 1 — 2 là overlay chưa bỏ, 0 là nháy mất)`);
  if (dCount !== 1) throw new Error("overlay không được đối chiếu với board:update");

  const inkAfterUpdate = globalThis.__emitted.slice(emittedBeforeUpdate).filter((e) => e[0] === "live:ink");
  log(`gói live:ink phát ra do NHẬN board:update: ${inkAfterUpdate.length} (phải là 0 — đây là vòng vọng)`);
  if (inkAfterUpdate.length !== 0) throw new Error("nhận board:update mà vẫn phát live:ink → vòng vọng");
```

- [ ] **Step 5: Chạy test và smoke test**

```bash
cd game-tools/client && npm test && npm run test:smoke
```

Kỳ vọng: cả hai PASS. Nếu `sentNumbers` vượt trần, `pushPoints` đang gửi lại cả nét thay vì điểm mới thêm — sửa `useInk.js` / `useInkLive.js`, không sửa bài kiểm.

- [ ] **Step 6: Kiểm tay hai tab cùng board**

Chạy server và client, mở **hai** tab cùng một board (hai tài khoản khác nhau nếu được):

- Vẽ ở tab A → tab B thấy nét **chạy theo** trong lúc kéo, không khuyết khúc.
- Thả chuột ở tab A → tab B **không** nháy: nét không được biến mất rồi hiện lại.
- Gôm ở tab A → tab B thấy nét mờ dần rồi mất.
- Vẽ đồng thời ở cả hai tab → hai nét chạy song song, không trộn vào nhau.
- Đóng tab A giữa lúc đang kéo → nét tạm ở tab B tự mất sau khoảng một giây.
- Đăng nhập tab B bằng tài khoản chỉ xem → tab B thấy nét của A; tab B không vẽ được.
- Tải lại cả hai tab → cả hai thấy cùng một bộ nét.

- [ ] **Step 7: Commit**

```bash
git add game-tools/client/src/lib/useInkLive.js \
        game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/__smoke__/entry.jsx
git commit -m "feat: nét vẽ chạy theo thời gian thực qua kênh live:ink"
```

---

## Kiểm tra cuối cùng

- [x] `cd game-tools/client && npm test` — PASS toàn bộ (203/203)
- [x] `cd game-tools/client && npm run test:smoke` — `✅ SMOKE PASS`
- [x] `cd game-tools/client && npm run build` — build sạch, không cảnh báo mới
- [x] `git log --oneline` — 11 commit trên nhánh (8 task + 3 commit vá lỗi review), `git status` sạch ngoài `vite.config.js` (đổi cổng cục bộ, có từ trước)
- [ ] Đọc lại mục **Kiểm thử** của spec và chạy hết danh sách kiểm tay ở đó — **CHƯA CHẠY**, xem mục "Còn dở" dưới đây

---

## Summary

### Đã làm gì

- Trang `/idea-map/:boardId` có thanh công cụ dọc nổi ở lề trái, chia bốn khu: chọn mode (Chuột / Sửa), chọn dụng cụ vẽ (Bút / Cục gôm, chỉ hiện ở mode Sửa), năm nút thêm (thẻ, thẻ gốc, khung, nối dây, nhập nhanh), và tuỳ chọn bút (7 màu + 3 độ dày, chỉ hiện khi đang cầm bút). Menu THÊM và nút NỐI Ý TƯỞNG đã rời khỏi topbar — mỗi việc còn đúng một chỗ bấm.
- Vẽ tay bằng bút chạy thật: kéo chuột ở mode Sửa ra nét theo màu và độ dày đang chọn, nét lưu vào `board.drawings` đi theo đúng đường lưu sẵn có nên hoàn tác/làm lại (Ctrl+Z) hoạt động không cần code riêng. Kéo ngang qua thẻ vẫn ra nét; chuột phải và Space+trái vẫn lia bảng.
- Cục gôm quét qua nhiều nét: nét bị chạm mờ dần trong lúc quét rồi mất khi thả chuột. Một lần quét xoá 5 nét thì một lần Ctrl+Z lấy lại cả 5. Quét chỗ trống không tạo bước hoàn tác rỗng.
- Nét chạy theo thời gian thực qua kênh socket mới `live:ink`: người khác thấy nét đang được vẽ dần ra, không khuyết khúc; khi bản lưu chính thức về thì bản tạm bỏ ngay nên không nháy. Người chỉ xem thấy nét của người khác nhưng không vẽ được (server chặn ngay tại socket).
- Màu bút và độ dày nhớ qua `localStorage`; mode thì không nhớ (mở board ra luôn ở Chuột). Bảy màu bút có bộ giá trị riêng cho theme sáng và tối.
- Phím tắt: `v` (Chuột), `b` (Bút), `e` (Gôm), `l` (nối dây), `Shift+N` (thẻ gốc), `Esc` (thoát mode Sửa trước khi làm việc khác).

### File chính

**Module thuần (test bằng `node:test`)**
- `game-tools/client/src/lib/pen.js` — bộ màu bút, độ dày, đọc/ghi prefs localStorage chịu được JSON hỏng và storage ném lỗi.
- `game-tools/client/src/lib/stroke.js` — giản lược nét (làm tròn → lọc điểm gần → Ramer–Douglas–Peucker), sinh chuỗi `d` cho `<path>`, hit-test cục gôm đo tới đoạn thẳng chứ không tới đỉnh.
- `game-tools/client/src/lib/ink-live.js` — trộn gói `live:ink` vào một Map overlay (TTL hai mức) và đối chiếu overlay với board thật; trả chính map cũ khi không có gì đổi để React bỏ qua render.

**Hook và component**
- `game-tools/client/src/lib/useInk.js` — bắt chuột vẽ/gôm; điểm thô nằm trong ref chứ không trong state, đẩy vào state qua rafThrottle; tự huỷ nét khi cửa sổ mất focus.
- `game-tools/client/src/lib/useInkLive.js` — phát và nhận `live:ink`; điểm cộng dồn vào ref rồi throttle chỉ quyết định *lúc nào* xả (throttle thay tham số nên không được throttle thẳng lời gọi, sẽ mất điểm).
- `game-tools/client/src/components/InkLayer.jsx` — một đường vẽ duy nhất cho cả ba nguồn nét: đã lưu, mình đang kéo, người khác đang vẽ.
- `game-tools/client/src/components/ToolRail.jsx`, `ToolOptions.jsx` — thanh công cụ và tuỳ chọn bút, icon là inline SVG theo `currentColor`.

**Nối dây và server**
- `game-tools/client/src/pages/IdeaMap.jsx` — state `mode`/`tool`/`penPrefs`, `commitStroke`/`commitErase`, lớp bắt chuột `.ink-capture`, phím tắt, gỡ hai mục khỏi topbar.
- `game-tools/server/models.js`, `boards.js`, `index.js` — hai field board mới, bốn chỗ liệt kê field, và handler `live:ink` có sanitize + chặn viewer + đính `socketId` phía server.
- `game-tools/client/src/index.css`, `src/styles/idea-map.css` — biến `--pen-*` ở cả bốn khối theme; class cho thanh công cụ, lớp vẽ, lớp bắt chuột.
- `game-tools/client/src/__smoke__/entry.jsx`, `smoke-run.mjs` — 13 nhóm kiểm ghép nối mới (thanh công cụ theo mode, vẽ ra nét và lưu đúng một lần, gôm, phát/nhận gói live, chống vòng vọng, không mất cập nhật của người khác giữa nét).

### Khác với plan

Ba chỗ lệch, tất cả đều là plan bỏ sót chứ không phải đổi thiết kế:

1. **`GET /api/boards/:id` cũng phải liệt kê field mới** (commit `2bee01d`). Plan nói field board được liệt kê tay ở *ba* chỗ trong `boards.js`; thực tế có *bốn* — allowlist của route GET là chỗ thứ tư. Thiếu nó thì tải lại trang xong lần lưu kế tiếp xoá sạch nét đã lưu, vì client mặc định `drawings: []` cho board "không có" field đó.
2. **`.zoom-ctrl` phải được nâng z-index** (commit `9c9bbe3`). Plan tính z-index của `.ink-capture` (8) sao cho nằm dưới thanh công cụ (30), nhưng `.zoom-ctrl` vốn không khai z-index nên bị lớp bắt chuột che — ở mode Sửa không bấm được nút zoom. Cho nó `z-index: 40` bằng với `.focus-banner` cạnh nó.
3. **`commitStroke`/`commitErase` phải đọc `boardRef.current`** (commit `3f51ea8`, cùng năm sửa nhỏ khác). Plan viết hai hàm này dùng biến `board` của closure. Nhưng `useInk` gắn `finish` làm listener `mouseup` trên `window` từ lúc mousedown, nên nếu `board:update` của người khác về *giữa lúc đang kéo nét*, lúc nhả chuột sẽ PUT bản board cũ kèm nét mới — âm thầm revert thay đổi vừa lưu của người kia. Sửa theo đúng kỷ luật refs-only mà `applyImageToNode` trong cùng file đã ghi chú sẵn cho tình huống này. Đã thêm một bài kiểm smoke bắn `board:update` vào giữa nét để chốt.

Ngoài ra: lời gọi `useInk(...)` phải đặt sau khi `boardRef`/`viewportRef` khai báo, không phải ngay sau `useCardSizes()` như plan chỉ — vị trí plan nêu gây `ReferenceError`.

### Còn dở / cần lưu ý

- **Chưa chạy danh sách kiểm tay của spec.** Mọi bước "Kiểm tay trên app đang chạy" trong Task 5/6/7/8 và mục **Kiểm thử** của spec đều bị hoãn: cần mở app thật, hai tab cùng board, kiểm nét chạy realtime không khuyết khúc, không nháy khi thả chuột, gôm hiện mờ rồi mất, đóng tab giữa nét thì nét tạm tự dọn, tài khoản chỉ xem không vẽ được, đổi sáng/tối, zoom. **`game-tools/server` không có bộ test nào** — mức kiểm tự động duy nhất cho phần server là `node --check`, nên toàn bộ hành vi relay (`sanitizeInk`, chặn viewer, truncate) hiện chỉ được phủ gián tiếp qua smoke test của client. Đây là lớp xác minh còn thiếu quan trọng nhất.
- `game-tools/client/vite.config.js` đang có thay đổi chưa commit (đổi cổng dev 5173→7155 và 3001→3345). Có từ trước phiên này, đã chủ ý không commit.
- Nợ nhỏ đã ghi nhận, không chặn merge: `rdp()` đệ quy không giới hạn độ sâu (cần phân bố điểm bệnh lý mới đụng); nhánh erase trong `ink-live.js` cấp phát Map mới cả khi gói trùng; `sanitizeInk` nhận id không nguyên (`Number.isFinite`) — giống khuôn `sanitizeGeom` sẵn có, nếu sửa thì sửa cả hai; smoke test chọn nút gôm theo chỉ số vị trí; smoke output có 4 cảnh báo React `act(...)` (base đã có 3, nhánh này thêm 1 — cùng loại, do timer/effect cập nhật state ngoài `act`).
- `IdeaMap` re-render mỗi gói ink nhận từ người khác (~25 lần/giây mỗi người đang vẽ) vì state `liveStrokes` nằm ở component này — cùng hạng với overlay `live:geom` sẵn có. Chỉ cần xem lại nếu thực tế thường có 3 người vẽ cùng lúc.
- Schema để `drawings: Array` không kiểu và `PUT` ghi thẳng những gì client gửi, tức server tin hoàn toàn client có quyền sửa. Đã ghi trong "Hạn chế đã biết" của spec; nên validate phía server một thể khi làm spec hình khối.
