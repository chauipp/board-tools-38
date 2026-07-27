# Tool hình khối — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tool hình khối vào thanh công cụ bên trái của `/idea-map/:boardId` — kéo chuột ra một trong sáu hình (chữ nhật, ê-líp, đường thẳng, mũi tên, tam giác, hình thoi), viền hoặc tô cả hình, lưu vào board, đồng bộ realtime, xoá được bằng cục gôm, hoàn tác được.

**Architecture:** Một module thuần mới `lib/shape.js` gánh toàn bộ hình học (danh sách kind, chuẩn hoá hộp, sinh path SVG, sinh đường bao, hit-test) và được test bằng `node:test`. Hình khối **không có kiểu dữ liệu riêng**: nó là một phần tử `board.drawings` như nét bút, chỉ khác `kind` và `pts` chỉ có 4 số là hai góc đối — nhờ vậy `commitStroke`, `commitErase`, hoàn tác, và bốn chỗ liệt kê field ở GET/PUT không phải sửa dòng nào. Kênh realtime dùng lại `live:ink` với một ngữ nghĩa mới: gói hình khối mang **cả hộp** và người nhận **thay** thay vì nối thêm.

**Tech Stack:** React 18, Vite 6, socket.io 4, Express + Mongoose (server), `@lingui/react/macro` cho i18n, `node:test` + `node:assert/strict` cho unit test, `npm run test:smoke` (jsdom) cho test ghép nối.

**Spec:** [`docs/superpowers/specs/2026-07-28-idea-map-shape-tool-design.md`](../specs/2026-07-28-idea-map-shape-tool-design.md)

## Global Constraints

- Thư mục làm việc của mọi lệnh `npm`: `game-tools/client` (client) và `game-tools/server` (server). Đường dẫn file trong plan này tính từ gốc repo.
- Unit test dùng `node:test` + `node:assert/strict`, **không** vitest. `npm test` chạy `node --test "src/lib/*.test.js"` — chỉ nhặt file trong `src/lib/`.
- Server **không có** bộ test nào; phần `server/` kiểm bằng `node --check` và qua smoke test của client.
- Mọi chuỗi hiện cho người dùng phải đi qua `@lingui/react/macro`: `<Trans>` cho nội dung, `` t`…` `` cho `title`. Ngôn ngữ nguồn là **tiếng Việt**; bản dịch tiếng Anh nằm ở `game-tools/client/src/locales/en/messages.po`.
- Toạ độ là **số nguyên**, đơn vị toạ độ canvas, lưu trong **mảng số phẳng**.
- Sáu `kind` hình khối, đúng thứ tự này ở mọi nơi: `"rect"`, `"ellipse"`, `"line"`, `"arrow"`, `"triangle"`, `"diamond"`. Cộng `"pen"` là bảy giá trị `kind` hợp lệ.
- Bốn hình **đóng** (có vùng trong, tô được): `rect`, `ellipse`, `triangle`, `diamond`. Hai hình **mở**: `line`, `arrow`.
- Giá trị mode: `"select"` | `"draw"`. Giá trị tool: `"pen"` | `"eraser"` | `"shape"`.
- Bộ màu bút và độ dày **không đổi**: 7 token `pen-*`, ba độ dày `2` / `4` / `8`. Không thêm biến CSS mới trong đợt này.
- Không sửa `lib/useLiveSync.js`, `lib/usePresence.js`, `lib/raf-throttle.js`.
- Không đổi `server/models.js` và `server/routes/boards.js` — schema board không có field mới.
- Commit sau mỗi task. Thông điệp commit tiếng Việt, tiền tố `feat:` / `test:` / `refactor:` như lịch sử repo đang dùng.

---

- [x] ## Task 1: `lib/shape.js` — hình học thuần

**Files:**
- Create: `game-tools/client/src/lib/shape.js`
- Create: `game-tools/client/src/lib/shape.test.js`

**Interfaces:**
- Consumes: không gì (module đầu tiên của đợt này, chỉ dùng `Math`).
- Produces:
  - `SHAPE_KINDS: string[]` — `["rect","ellipse","line","arrow","triangle","diamond"]`
  - `SHAPE_CLOSED: Set<string>` — `{"rect","ellipse","triangle","diamond"}`
  - `normalizeBox(x0: number, y0: number, x1: number, y1: number, opts?: {square?: boolean, snap?: boolean}) -> [number, number, number, number]` (số nguyên)
  - `shapePath(kind: string, pts: number[]) -> string` (chuỗi `d` cho `<path>`; `""` nếu `pts` không đủ 4 số hoặc `kind` lạ)
  - `shapeOutline(kind: string, pts: number[]) -> number[]` (mảng số phẳng; `[]` nếu `pts` không đủ 4 số hoặc `kind` lạ)
  - `SHAPE_MIN_DIAGONAL: number` — `4`, ngưỡng đường chéo dưới đó thì Task 5 bỏ hình

- [x] **Step 1: Viết test thất bại**

Tạo `game-tools/client/src/lib/shape.test.js`:

```js
// game-tools/client/src/lib/shape.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHAPE_KINDS, SHAPE_CLOSED, normalizeBox, shapePath, shapeOutline } from "./shape.js";

test("SHAPE_KINDS: sáu hình, đúng thứ tự hiện ở khu 4", () => {
  assert.deepEqual(SHAPE_KINDS, ["rect", "ellipse", "line", "arrow", "triangle", "diamond"]);
});

test("SHAPE_CLOSED: đúng bốn hình có vùng trong", () => {
  assert.deepEqual([...SHAPE_CLOSED].sort(), ["diamond", "ellipse", "rect", "triangle"]);
  assert.equal(SHAPE_CLOSED.has("line"), false);
  assert.equal(SHAPE_CLOSED.has("arrow"), false);
});

// KHÔNG sắp lại thứ tự hai góc: đường thẳng và mũi tên cần biết đâu là đầu,
// đâu là cuối. Việc lấy min/max là việc của shapePath cho bốn hình đóng.
test("normalizeBox: giữ nguyên thứ tự hai góc, chỉ làm tròn", () => {
  assert.deepEqual(normalizeBox(100.4, 50.6, 20.2, 10.5), [100, 51, 20, 11]);
});

test("normalizeBox: square ép |dx| = |dy| và giữ dấu", () => {
  // kéo sang phải 100, xuống 30 → cạnh 100
  assert.deepEqual(normalizeBox(0, 0, 100, 30, { square: true }), [0, 0, 100, 100]);
  // kéo sang trái 20, lên 80 → cạnh 80, giữ cả hai dấu âm
  assert.deepEqual(normalizeBox(0, 0, -20, -80, { square: true }), [0, 0, -80, -80]);
});

test("normalizeBox: snap ép hướng về 0/45/90 độ, giữ độ dài", () => {
  // gần ngang → thành ngang, độ dài giữ nguyên 100
  assert.deepEqual(normalizeBox(0, 0, 100, 8, { snap: true }), [0, 0, 100, 0]);
  // gần dọc → thành dọc
  assert.deepEqual(normalizeBox(0, 0, 6, 100, { snap: true }), [0, 0, 0, 100]);
  // gần chéo 45 độ → thành chéo đúng 45 độ
  assert.deepEqual(normalizeBox(0, 0, 100, 90, { snap: true }), [0, 0, 95, 95]);
});

test("normalizeBox: hộp suy biến không nổ", () => {
  assert.deepEqual(normalizeBox(5, 5, 5, 5, { square: true }), [5, 5, 5, 5]);
  assert.deepEqual(normalizeBox(5, 5, 5, 5, { snap: true }), [5, 5, 5, 5]);
});

test("shapePath: chữ nhật là bốn cạnh khép kín, thứ tự góc nào cũng ra một hình", () => {
  const a = shapePath("rect", [10, 20, 110, 70]);
  const b = shapePath("rect", [110, 70, 10, 20]);
  assert.equal(a, "M 10 20 L 110 20 L 110 70 L 10 70 Z");
  assert.equal(a, b, "kéo từ góc dưới-phải lên phải ra cùng một hình");
});

test("shapePath: đường thẳng giữ đúng chiều", () => {
  assert.equal(shapePath("line", [10, 20, 110, 70]), "M 10 20 L 110 70");
  assert.equal(shapePath("line", [110, 70, 10, 20]), "M 110 70 L 10 20");
});

test("shapePath: ê-líp dùng cung A nên zoom vào vẫn mịn", () => {
  const d = shapePath("ellipse", [0, 0, 100, 60]);
  assert.ok(d.startsWith("M "), d);
  assert.ok(d.includes(" A "), "phải dùng cung tròn, không phải đa giác: " + d);
  assert.ok(d.trimEnd().endsWith("Z"), d);
});

test("shapePath: bốn hình đóng kết bằng Z, hai hình mở thì không", () => {
  for (const kind of ["rect", "ellipse", "triangle", "diamond"]) {
    assert.ok(shapePath(kind, [0, 0, 100, 60]).trimEnd().endsWith("Z"), kind + " phải khép kín");
  }
  for (const kind of ["line", "arrow"]) {
    assert.ok(!shapePath(kind, [0, 0, 100, 60]).includes("Z"), kind + " không được khép kín");
  }
});

test("shapePath: mũi tên có đầu mũi ngoài phần thân", () => {
  const d = shapePath("arrow", [0, 0, 100, 0]);
  assert.ok(d.startsWith("M 0 0 L 100 0"), "phần thân phải là đoạn gốc → ngọn: " + d);
  // Đầu mũi vẽ bằng một lệnh M thứ hai, nên chuỗi phải có 2 chữ M.
  assert.equal((d.match(/M /g) || []).length, 2, "phải có đúng 2 lệnh M: " + d);
});

test("shapePath: kind lạ hoặc pts thiếu thì trả chuỗi rỗng chứ không nổ", () => {
  assert.equal(shapePath("star", [0, 0, 10, 10]), "");
  assert.equal(shapePath("rect", [0, 0]), "");
  assert.equal(shapePath("rect", []), "");
});

test("shapePath: hộp suy biến không nổ", () => {
  for (const kind of SHAPE_KINDS) {
    assert.doesNotThrow(() => shapePath(kind, [7, 7, 7, 7]), kind);
  }
});

// Đường bao của hình ĐÓNG lặp lại điểm đầu ở cuối, để đoạn khép kín cũng được
// đo trong hit-test — thiếu nó thì cạnh trái chữ nhật không bắt được chuột.
test("shapeOutline: hình đóng lặp lại điểm đầu ở cuối", () => {
  const rect = shapeOutline("rect", [0, 0, 100, 60]);
  assert.equal(rect.length, 10, "4 góc + điểm đầu lặp lại = 5 điểm");
  assert.deepEqual(rect.slice(0, 2), rect.slice(-2));
  assert.equal(shapeOutline("triangle", [0, 0, 100, 60]).length, 8);
  assert.equal(shapeOutline("diamond", [0, 0, 100, 60]).length, 10);
});

test("shapeOutline: ê-líp lấy 32 mẫu cộng điểm đầu lặp lại", () => {
  const out = shapeOutline("ellipse", [0, 0, 100, 60]);
  assert.equal(out.length, 66);
  assert.deepEqual(out.slice(0, 2), out.slice(-2));
});

// Đầu mũi nhỏ và nằm sát thân, nên đường bao của mũi tên chỉ là phần thân.
test("shapeOutline: đường thẳng và mũi tên là hai điểm", () => {
  assert.deepEqual(shapeOutline("line", [10, 20, 110, 70]), [10, 20, 110, 70]);
  assert.deepEqual(shapeOutline("arrow", [10, 20, 110, 70]), [10, 20, 110, 70]);
});

test("shapeOutline: mọi điểm nằm trong hộp bao", () => {
  for (const kind of SHAPE_KINDS) {
    const out = shapeOutline(kind, [10, 20, 110, 70]);
    assert.equal(out.length % 2, 0, kind + ": mảng phải có độ dài chẵn");
    for (let i = 0; i + 1 < out.length; i += 2) {
      assert.ok(out[i] >= 9.5 && out[i] <= 110.5, kind + ": x ngoài hộp: " + out[i]);
      assert.ok(out[i + 1] >= 19.5 && out[i + 1] <= 70.5, kind + ": y ngoài hộp: " + out[i + 1]);
    }
  }
});

test("shapeOutline: kind lạ hoặc pts thiếu thì trả mảng rỗng", () => {
  assert.deepEqual(shapeOutline("star", [0, 0, 10, 10]), []);
  assert.deepEqual(shapeOutline("rect", [0, 0]), []);
});
```

- [x] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && npm test
```

Expected: FAIL — `Cannot find module './shape.js'`.

- [x] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `game-tools/client/src/lib/shape.js`:

```js
// Mọi phép tính hình học của hình khối nằm ở đây, không dính React: nhờ vậy
// test được bằng node:test và InkLayer chỉ việc gọi shapePath.
//
// pts của một hình khối là ĐÚNG 4 số — hai góc đối [x0,y0,x1,y1] — chứ không
// phải danh sách điểm như nét bút.

export const SHAPE_KINDS = ["rect", "ellipse", "line", "arrow", "triangle", "diamond"];

// Bốn hình có vùng trong nên tô được. Hai hình còn lại (line, arrow) là hình
// mở: nút "cả hình" ở khu 4 bị vô hiệu khi đang chọn chúng.
export const SHAPE_CLOSED = new Set(["rect", "ellipse", "triangle", "diamond"]);

// Số mẫu khi xấp xỉ ê-líp cho hit-test. 32 mẫu ở kích thước thường sai dưới 1
// đơn vị canvas, và cái giá của sai số chỉ là cục gôm bắt chệch nửa pixel.
const ELLIPSE_SAMPLES = 32;

// Làm tròn về 1 chữ số thập phân trong chuỗi `d`: toạ độ hộp là số nguyên nên
// phần lớn số vẫn ra nguyên, chỉ trung điểm của cạnh lẻ và đầu mũi tên mới có
// phần thập phân. Giữ chuỗi ngắn mà không lệch mắt thấy được.
function r1(v) {
  return Math.round(v * 10) / 10;
}

// Đường chéo ngắn hơn ngưỡng này thì useInk bỏ hình, không tạo hình rác. Đo
// theo ĐƯỜNG CHÉO chứ không theo từng chiều: một đường thẳng ngang dài 200 có
// chiều cao 0, đo từng chiều sẽ bỏ oan.
export const SHAPE_MIN_DIAGONAL = 4;

export function normalizeBox(x0, y0, x1, y1, opts = {}) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  if (opts.square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = dx < 0 ? -side : side;
    dy = dy < 0 ? -side : side;
  } else if (opts.snap) {
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const step = Math.PI / 4;
      const angle = Math.round(Math.atan2(dy, dx) / step) * step;
      dx = len * Math.cos(angle);
      dy = len * Math.sin(angle);
    }
  }
  return [Math.round(x0), Math.round(y0), Math.round(x0 + dx), Math.round(y0 + dy)];
}

// Hộp đã sắp: bốn hình đóng không quan tâm kéo từ góc nào.
function sorted(pts) {
  const [x0, y0, x1, y1] = pts;
  return {
    l: Math.min(x0, x1), t: Math.min(y0, y1),
    r: Math.max(x0, x1), b: Math.max(y0, y1)
  };
}

function ok(kind, pts) {
  return SHAPE_KINDS.includes(kind) && Array.isArray(pts) && pts.length >= 4;
}

export function shapePath(kind, pts) {
  if (!ok(kind, pts)) return "";
  const [x0, y0, x1, y1] = pts;
  const { l, t, r, b } = sorted(pts);
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;

  if (kind === "rect") {
    return `M ${r1(l)} ${r1(t)} L ${r1(r)} ${r1(t)} L ${r1(r)} ${r1(b)} L ${r1(l)} ${r1(b)} Z`;
  }
  if (kind === "ellipse") {
    const rx = (r - l) / 2;
    const ry = (b - t) / 2;
    // Hai nửa cung: một lệnh A không vẽ được vòng kín vì điểm đầu trùng điểm cuối.
    return `M ${r1(l)} ${r1(cy)}`
      + ` A ${r1(rx)} ${r1(ry)} 0 1 0 ${r1(r)} ${r1(cy)}`
      + ` A ${r1(rx)} ${r1(ry)} 0 1 0 ${r1(l)} ${r1(cy)} Z`;
  }
  if (kind === "line") {
    return `M ${r1(x0)} ${r1(y0)} L ${r1(x1)} ${r1(y1)}`;
  }
  if (kind === "arrow") {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const head = Math.max(6, Math.min(18, len * 0.25));
    const a = Math.atan2(y1 - y0, x1 - x0);
    const wing = 0.44;   // ~25 độ mỗi bên
    const lx = x1 - head * Math.cos(a - wing);
    const ly = y1 - head * Math.sin(a - wing);
    const rxp = x1 - head * Math.cos(a + wing);
    const ryp = y1 - head * Math.sin(a + wing);
    return `M ${r1(x0)} ${r1(y0)} L ${r1(x1)} ${r1(y1)}`
      + ` M ${r1(lx)} ${r1(ly)} L ${r1(x1)} ${r1(y1)} L ${r1(rxp)} ${r1(ryp)}`;
  }
  if (kind === "triangle") {
    return `M ${r1(cx)} ${r1(t)} L ${r1(r)} ${r1(b)} L ${r1(l)} ${r1(b)} Z`;
  }
  // diamond
  return `M ${r1(cx)} ${r1(t)} L ${r1(r)} ${r1(cy)} L ${r1(cx)} ${r1(b)} L ${r1(l)} ${r1(cy)} Z`;
}

export function shapeOutline(kind, pts) {
  if (!ok(kind, pts)) return [];
  const [x0, y0, x1, y1] = pts;
  const { l, t, r, b } = sorted(pts);
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;

  // Hình mở: đường bao là chính phần thân. Đầu mũi tên nhỏ và nằm sát ngọn nên
  // đã lọt trong ngưỡng chạm, không cần đưa vào bao.
  if (kind === "line" || kind === "arrow") return [x0, y0, x1, y1];

  if (kind === "ellipse") {
    const rx = (r - l) / 2;
    const ry = (b - t) / 2;
    const out = [];
    for (let i = 0; i < ELLIPSE_SAMPLES; i++) {
      const a = (i / ELLIPSE_SAMPLES) * Math.PI * 2;
      out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    }
    out.push(out[0], out[1]);
    return out;
  }

  let corners;
  if (kind === "rect") corners = [l, t, r, t, r, b, l, b];
  else if (kind === "triangle") corners = [cx, t, r, b, l, b];
  else corners = [cx, t, r, cy, cx, b, l, cy];   // diamond
  // Lặp lại điểm đầu ở cuối: đoạn khép kín cũng phải được đo, không thì cạnh
  // cuối của hình không bắt được chuột.
  corners.push(corners[0], corners[1]);
  return corners;
}
```

- [x] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && npm test
```

Expected: PASS — toàn bộ test trong `shape.test.js` xanh.

- [x] **Step 5: Chạy cả bộ test cho chắc**

```bash
cd game-tools/client && npm test
```

Expected: mọi file `src/lib/*.test.js` xanh, không có test nào đỏ do file mới.

- [x] **Step 6: Commit**

```bash
git add game-tools/client/src/lib/shape.js game-tools/client/src/lib/shape.test.js
git commit -m "feat: module thuần hình học sáu hình khối"
```

---

- [x] ## Task 2: `drawingsHitBy` thay `strokesHitBy`

**Files:**
- Modify: `game-tools/client/src/lib/stroke.js` — thêm `polylineHitBy` và `pointInPolygon`, xoá `strokesHitBy`
- Modify: `game-tools/client/src/lib/stroke.test.js:52-81` — xoá 5 test `strokesHitBy`, thêm test `pointInPolygon`
- Modify: `game-tools/client/src/lib/shape.js` — thêm `drawingsHitBy`
- Modify: `game-tools/client/src/lib/shape.test.js` — thêm test `drawingsHitBy` (gồm 5 test chuyển từ `stroke.test.js`)
- Modify: `game-tools/client/src/lib/useInk.js:2,6,59,78` — đổi chỗ gọi

**Interfaces:**
- Consumes từ Task 1: `SHAPE_KINDS`, `SHAPE_CLOSED`, `shapeOutline(kind, pts)`.
- Produces:
  - `stroke.js`: `polylineHitBy(pts: number[], point: {x,y}, limit: number) -> boolean`, `pointInPolygon(pts: number[], px: number, py: number) -> boolean`
  - `shape.js`: `drawingsHitBy(drawings: object[], point: {x,y}, radius: number) -> number[]`
  - `stroke.js` **không còn** `strokesHitBy`.

- [ ] **Step 1: Viết test thất bại**

Trong `game-tools/client/src/lib/stroke.test.js`: đổi dòng import thành

```js
import { simplifyStroke, strokePath, polylineHitBy, pointInPolygon } from "./stroke.js";
```

**Xoá** năm test `strokesHitBy` (dòng 52 đến 81, từ `test("strokesHitBy: ngưỡng chạm...` tới hết file) và **thay** bằng:

```js
test("polylineHitBy: đo tới ĐOẠN THẲNG chứ không tới đỉnh", () => {
  // giữa một nét dài thì mọi đỉnh đều xa, chỉ khoảng cách tới đoạn mới đúng
  assert.equal(polylineHitBy([0, 0, 100, 0], { x: 50, y: 2 }, 3), true);
  assert.equal(polylineHitBy([0, 0, 100, 0], { x: 50, y: 4 }, 3), false);
});

test("polylineHitBy: đường một điểm đo bằng khoảng cách tới điểm đó", () => {
  assert.equal(polylineHitBy([10, 10], { x: 12, y: 10 }, 10), true);
  assert.equal(polylineHitBy([10, 10], { x: 30, y: 10 }, 10), false);
});

test("polylineHitBy: mảng rỗng không chạm gì", () => {
  assert.equal(polylineHitBy([], { x: 0, y: 0 }, 100), false);
});

test("pointInPolygon: phân biệt trong và ngoài", () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100, 0, 0];
  assert.equal(pointInPolygon(square, 50, 50), true);
  assert.equal(pointInPolygon(square, 150, 50), false);
  assert.equal(pointInPolygon(square, -1, 50), false);
  assert.equal(pointInPolygon(square, 50, 150), false);
});

// Đường bao hình đóng do shapeOutline sinh ra LUÔN lặp lại điểm đầu ở cuối, nên
// hàm này phải chịu được cạnh có độ dài 0.
test("pointInPolygon: chịu được điểm đầu lặp lại ở cuối", () => {
  const tri = [0, 0, 100, 0, 50, 80, 0, 0];
  assert.equal(pointInPolygon(tri, 50, 20), true);
  assert.equal(pointInPolygon(tri, 5, 70), false);
});

test("pointInPolygon: đa giác dưới 3 đỉnh luôn là ngoài", () => {
  assert.equal(pointInPolygon([0, 0, 10, 10], 5, 5), false);
  assert.equal(pointInPolygon([], 0, 0), false);
});
```

Trong `game-tools/client/src/lib/shape.test.js`: đổi dòng import thành

```js
import {
  SHAPE_KINDS, SHAPE_CLOSED, SHAPE_MIN_DIAGONAL,
  normalizeBox, shapePath, shapeOutline, drawingsHitBy
} from "./shape.js";
```

và **thêm vào cuối file** — năm test đầu là năm test chuyển nguyên từ
`stroke.test.js`, chúng chốt rằng nhánh nét bút không đổi hành vi:

```js
test("drawingsHitBy: nét bút — ngưỡng chạm là w/2 + radius", () => {
  const drawings = [{ id: 1, kind: "pen", color: "pen-red", w: 4, pts: [0, 0, 100, 0] }];
  // ngưỡng = 4/2 + 8 = 10
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 9 }, 8), [1]);
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 11 }, 8), []);
});

test("drawingsHitBy: nét bút — đo khoảng cách tới đoạn thẳng chứ không tới đỉnh", () => {
  const drawings = [{ id: 1, w: 2, pts: [0, 0, 100, 0] }];
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 0 }, 3), [1]);
});

test("drawingsHitBy: trả nhiều id khi một điểm chạm nhiều nét", () => {
  const drawings = [
    { id: 1, w: 2, pts: [0, 0, 100, 0] },
    { id: 2, w: 2, pts: [50, -20, 50, 20] },
    { id: 3, w: 2, pts: [0, 500, 100, 500] }
  ];
  assert.deepEqual(drawingsHitBy(drawings, { x: 50, y: 0 }, 3), [1, 2]);
});

test("drawingsHitBy: nét bút một điểm vẫn hit-test được", () => {
  assert.deepEqual(drawingsHitBy([{ id: 1, w: 4, pts: [10, 10] }], { x: 12, y: 10 }, 8), [1]);
});

test("drawingsHitBy: danh sách rỗng hoặc thiếu pts trả mảng rỗng", () => {
  assert.deepEqual(drawingsHitBy([], { x: 0, y: 0 }, 8), []);
  assert.deepEqual(drawingsHitBy([{ id: 1, w: 4 }], { x: 0, y: 0 }, 8), []);
});

// Chỉ viền: chạm viền thì trúng, giữa hình thì KHÔNG — không thì kéo gôm ngang
// qua một khung rỗng sẽ xoá nó dù người dùng chỉ đi qua vùng trống.
test("drawingsHitBy: chữ nhật chỉ viền — trúng viền, không trúng giữa", () => {
  const rect = [{ id: 1, kind: "rect", w: 2, fill: false, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(rect, { x: 50, y: 1 }, 3), [1], "cạnh trên");
  assert.deepEqual(drawingsHitBy(rect, { x: 0, y: 30 }, 3), [1], "cạnh trái — cạnh khép kín");
  assert.deepEqual(drawingsHitBy(rect, { x: 50, y: 30 }, 3), [], "giữa hình rỗng");
});

test("drawingsHitBy: chữ nhật tô cả hình — chạm giữa cũng trúng", () => {
  const rect = [{ id: 1, kind: "rect", w: 2, fill: true, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(rect, { x: 50, y: 30 }, 3), [1]);
  assert.deepEqual(drawingsHitBy(rect, { x: 200, y: 30 }, 3), [], "ngoài hình vẫn không trúng");
});

test("drawingsHitBy: ê-líp phân biệt trong và ngoài", () => {
  const el = [{ id: 1, kind: "ellipse", w: 2, fill: true, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(el, { x: 50, y: 30 }, 3), [1], "tâm");
  // Góc trên-trái của hộp bao nằm NGOÀI ê-líp
  assert.deepEqual(drawingsHitBy(el, { x: 3, y: 3 }, 3), [], "góc hộp bao");
});

test("drawingsHitBy: w lớn nới ngưỡng chạm của hình khối", () => {
  const thin = [{ id: 1, kind: "rect", w: 2, fill: false, pts: [0, 0, 100, 60] }];
  const thick = [{ id: 1, kind: "rect", w: 20, fill: false, pts: [0, 0, 100, 60] }];
  assert.deepEqual(drawingsHitBy(thin, { x: 50, y: 8 }, 3), []);
  assert.deepEqual(drawingsHitBy(thick, { x: 50, y: 8 }, 3), [1]);
});

test("drawingsHitBy: đường thẳng và mũi tên hit-test theo thân", () => {
  const l = [{ id: 1, kind: "line", w: 2, pts: [0, 0, 100, 100] }];
  assert.deepEqual(drawingsHitBy(l, { x: 50, y: 50 }, 3), [1]);
  assert.deepEqual(drawingsHitBy(l, { x: 50, y: 90 }, 3), []);
});

test("drawingsHitBy: hình khối thiếu số hoặc kind lạ thì bỏ qua, không nổ", () => {
  assert.deepEqual(drawingsHitBy([{ id: 1, kind: "rect", w: 2, pts: [0, 0] }], { x: 0, y: 0 }, 8), []);
  assert.deepEqual(drawingsHitBy([{ id: 1, kind: "star", w: 2, pts: [0, 0, 9, 9] }], { x: 5, y: 5 }, 8), []);
});

test("SHAPE_MIN_DIAGONAL: ngưỡng bỏ hình suy biến là 4", () => {
  assert.equal(SHAPE_MIN_DIAGONAL, 4);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && npm test
```

Expected: FAIL — `polylineHitBy is not a function`, `pointInPolygon is not a function`, `drawingsHitBy is not a function`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Trong `game-tools/client/src/lib/stroke.js`, **thay** hàm `strokesHitBy` (dòng
67-84) bằng hai hàm sau. `distToSegment` vẫn để nội bộ:

```js
// Tách nguyên vòng lặp của strokesHitBy cũ ra thành một phép tính dùng lại
// được: shape.js gọi nó cho cả đường bao của hình khối, không phải chép lại.
export function polylineHitBy(pts, point, limit) {
  if (!pts || pts.length < 2) return false;
  if (pts.length === 2) return Math.hypot(point.x - pts[0], point.y - pts[1]) <= limit;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    if (distToSegment(point.x, point.y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= limit) return true;
  }
  return false;
}

// Ray casting: bắn một tia sang phải, đếm số cạnh cắt qua. Lẻ là trong, chẵn là
// ngoài. Cạnh có độ dài 0 (đường bao hình đóng lặp lại điểm đầu ở cuối) tự bị
// loại vì hai đầu có cùng y nên điều kiện cắt không thoả.
export function pointInPolygon(pts, px, py) {
  if (!pts || pts.length < 6) return false;
  const n = pts.length / 2;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1];
    const xj = pts[j * 2], yj = pts[j * 2 + 1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
```

Trong `game-tools/client/src/lib/shape.js`, thêm import ở đầu file và
`drawingsHitBy` ở cuối file:

```js
import { polylineHitBy, pointInPolygon } from "./stroke.js";
```

```js
// Hit-test cho CẢ nét bút lẫn hình khối. Nó nằm ở shape.js chứ không ở stroke.js
// vì nó phải biết hình học của từng `kind`, mà chỗ duy nhất biết điều đó là file
// này. Chiều import một phía shape.js → stroke.js, không có vòng.
//
// MỌI kind chỉ có MỘT đường hit-test: đo tới các đoạn của đường bao, cộng
// point-in-polygon trên chính đường bao đó khi `fill` bật.
export function drawingsHitBy(drawings, point, radius) {
  const out = [];
  for (const d of drawings || []) {
    const pts = d.pts || [];
    if (pts.length < 2) continue;
    const limit = (d.w || 0) / 2 + radius;
    const kind = d.kind || "pen";

    if (kind === "pen") {
      if (polylineHitBy(pts, point, limit)) out.push(d.id);
      continue;
    }
    const outline = shapeOutline(kind, pts);
    if (!outline.length) continue;
    const hit = polylineHitBy(outline, point, limit)
      || (d.fill === true && pointInPolygon(outline, point.x, point.y));
    if (hit) out.push(d.id);
  }
  return out;
}
```

Trong `game-tools/client/src/lib/useInk.js`, đổi ba chỗ:

- dòng 2 — import: `import { simplifyStroke } from "./stroke.js";` và thêm dòng mới `import { drawingsHitBy } from "./shape.js";`
- dòng 6 — ghi chú: `strokesHitBy` → `drawingsHitBy`
- dòng 59 — `strokesHitBy(board.drawings || [], start, ERASE_RADIUS)` → `drawingsHitBy(...)`
- dòng 78 — `strokesHitBy(b.drawings || [], p, ERASE_RADIUS)` → `drawingsHitBy(...)`

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && npm test
```

Expected: PASS.

- [ ] **Step 5: Chắc chắn không còn chỗ nào gọi `strokesHitBy`**

```bash
cd game-tools/client && grep -rn "strokesHitBy" src/ ; echo "exit=$?"
```

Expected: không in ra dòng nào (`exit=1` từ grep là đúng).

- [ ] **Step 6: Smoke test phải vẫn xanh — cục gôm nét bút không được đổi hành vi**

```bash
cd game-tools/client && npm run test:smoke
```

Expected: PASS như trước khi sửa. Nếu phần gôm đỏ thì `polylineHitBy` đã lệch
khỏi vòng lặp gốc — so lại từng nhánh, đừng nới ngưỡng.

- [ ] **Step 7: Commit**

```bash
git add game-tools/client/src/lib/stroke.js game-tools/client/src/lib/stroke.test.js \
        game-tools/client/src/lib/shape.js game-tools/client/src/lib/shape.test.js \
        game-tools/client/src/lib/useInk.js
git commit -m "refactor: hit-test một đường cho cả nét bút và hình khối"
```

---

- [x] ## Task 3: `lib/pen.js` — prefs nhớ thêm hình và chế độ tô

**Files:**
- Modify: `game-tools/client/src/lib/pen.js`
- Modify: `game-tools/client/src/lib/pen.test.js`

**Interfaces:**
- Consumes từ Task 1: `SHAPE_KINDS`.
- Produces: `PEN_DEFAULT = { color: "pen-red", w: 4, kind: "rect", fill: false }`;
  `loadPenPrefs(storage) -> { color, w, kind, fill }`; `savePenPrefs(storage, prefs)` ghi cả bốn key.
  Khoá localStorage **không đổi**: `"ideamap.pen"`.

- [ ] **Step 1: Viết test thất bại**

Trong `game-tools/client/src/lib/pen.test.js`, **thay** test
`"PEN_DEFAULT phải nằm trong danh sách hợp lệ"` bằng:

```js
test("PEN_DEFAULT phải nằm trong danh sách hợp lệ", () => {
  assert.ok(PEN_COLORS.includes(PEN_DEFAULT.color));
  assert.ok(PEN_WIDTHS.includes(PEN_DEFAULT.w));
  assert.ok(SHAPE_KINDS.includes(PEN_DEFAULT.kind));
  assert.equal(PEN_DEFAULT.fill, false);
  assert.equal(PEN_COLORS.length, 7);
  assert.deepEqual(PEN_WIDTHS, [2, 4, 8]);
});
```

**thay** test `"loadPenPrefs: giá trị lạ lùi về mặc định theo từng phần"` bằng:

```js
test("loadPenPrefs: giá trị lạ lùi về mặc định theo từng phần", () => {
  const bothBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-neon", w: 999 }) });
  assert.deepEqual(loadPenPrefs(bothBad), PEN_DEFAULT);

  const onlyWidthBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 999 }) });
  assert.deepEqual(loadPenPrefs(onlyWidthBad), { ...PEN_DEFAULT, color: "pen-blue" });
});

// Một `kind` bị bỏ khỏi bảng chọn, hoặc `fill` bị ghi sai kiểu, không được làm
// mất luôn màu và độ dày người dùng đang dùng.
test("loadPenPrefs: kind lạ và fill sai kiểu chỉ lùi phần của chúng", () => {
  const s = fakeStorage({
    "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8, kind: "star", fill: "yes" })
  });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-blue", w: 8, kind: PEN_DEFAULT.kind, fill: false });
});

test("loadPenPrefs: prefs cũ chỉ có color/w vẫn đọc được, kind/fill lấy mặc định", () => {
  const s = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-green", w: 2 }) });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-green", w: 2, kind: PEN_DEFAULT.kind, fill: false });
});
```

**thay** test `"savePenPrefs rồi loadPenPrefs trả lại đúng giá trị"` bằng:

```js
test("savePenPrefs rồi loadPenPrefs trả lại đúng giá trị", () => {
  const s = fakeStorage();
  savePenPrefs(s, { color: "pen-green", w: 8, kind: "ellipse", fill: true });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-green", w: 8, kind: "ellipse", fill: true });
});
```

và đổi dòng import thành:

```js
import { PEN_COLORS, PEN_WIDTHS, PEN_DEFAULT, penVar, loadPenPrefs, savePenPrefs } from "./pen.js";
import { SHAPE_KINDS } from "./shape.js";
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && npm test
```

Expected: FAIL — `PEN_DEFAULT.kind` là `undefined`.

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Trong `game-tools/client/src/lib/pen.js`: thêm import, đổi `PEN_DEFAULT`, và
thêm hai key vào `loadPenPrefs` / `savePenPrefs`.

```js
import { SHAPE_KINDS } from "./shape.js";
```

```js
// Toàn bộ state của khu 4 nằm trong MỘT object dưới MỘT khoá: màu và độ dày
// dùng chung cho bút và hình khối, `kind` là hình đang chọn, `fill` là chế độ
// viền / cả hình. Chiều import pen.js → shape.js → stroke.js, không có vòng.
export const PEN_DEFAULT = { color: "pen-red", w: 4, kind: "rect", fill: false };
```

```js
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
    w: PEN_WIDTHS.includes(saved.w) ? saved.w : PEN_DEFAULT.w,
    kind: SHAPE_KINDS.includes(saved.kind) ? saved.kind : PEN_DEFAULT.kind,
    fill: saved.fill === true
  };
}

export function savePenPrefs(storage, prefs) {
  try {
    storage.setItem(KEY, JSON.stringify({
      color: prefs.color, w: prefs.w, kind: prefs.kind, fill: prefs.fill === true
    }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn bút, không đáng làm sập app.
  }
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/lib/pen.js game-tools/client/src/lib/pen.test.js
git commit -m "feat: prefs khu 4 nhớ thêm hình đang chọn và chế độ tô"
```

---

- [x] ## Task 4: Thanh công cụ — nút hình khối và bảng chọn ở khu 4

**Files:**
- Modify: `game-tools/client/src/components/ToolRail.jsx`
- Modify: `game-tools/client/src/components/ToolOptions.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css` (khối `.tool-options` ~dòng 625, thêm class mới cuối khối thanh công cụ ~dòng 655)
- Modify: `game-tools/client/src/pages/IdeaMap.jsx:~570` (thêm phím tắt `s` ngay sau nhánh `key === "e"`)
- Modify: `game-tools/client/src/locales/en/messages.po`
- Modify: `game-tools/client/src/__smoke__/entry.jsx:105` (số nút ở mode Sửa) và thêm nhóm kiểm mới

**Interfaces:**
- Consumes từ Task 1 và 3: `SHAPE_KINDS`, `SHAPE_CLOSED`, `PEN_COLORS`, `PEN_WIDTHS`, `penVar`.
- Produces:
  - `ToolRail` nhận props **không đổi**; `onTool` giờ được gọi thêm với `"shape"`.
  - `ToolOptions` nhận props **không đổi** (`tool`, `prefs`, `onPrefs`) nhưng render thêm bảng chọn hình và hai nút chế độ tô khi `tool === "shape"`.
  - Thứ tự nút trên `.tool-rail` ở mode Sửa: `[0]` Chuột, `[1]` Sửa, `[2]` Bút, `[3]` Cục gôm, `[4]` Hình khối, `[5..9]` năm nút thêm. **Tổng 10 nút.** Chỉ số `[3]` của cục gôm và `[2]` của bút giữ nguyên, nên smoke test cũ không phải đánh số lại.
  - Class CSS mới: `.shape-pick` (nút chọn hình), `.fill-pick` (nút chế độ tô).

- [x] **Step 1: Thêm nút Hình khối vào `ToolRail.jsx`**

Thêm hàm icon cạnh các icon khác (trước `export default`):

```jsx
function IconShape() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="2.5" width="10" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="13" cy="13" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
```

Trong khu 2, **sau** nút cục gôm và vẫn bên trong `{mode === "draw" && (<>…</>)}`:

```jsx
          <button
            type="button"
            className={"tool-btn" + (tool === "shape" ? " on" : "")}
            title={t`Hình khối (S)`}
            disabled={!canEdit}
            onClick={() => onTool("shape")}
          ><IconShape /></button>
```

- [x] **Step 2: Viết lại `ToolOptions.jsx`**

Thay toàn bộ nội dung file `game-tools/client/src/components/ToolOptions.jsx`:

```jsx
import { useLingui } from "@lingui/react/macro";
import { PEN_COLORS, PEN_WIDTHS, penVar } from "../lib/pen.js";
import { SHAPE_KINDS, SHAPE_CLOSED } from "../lib/shape.js";

// Icon của bảng chọn hình: vẽ ĐÚNG hình mà nút đó tạo ra, không dùng chữ hay
// emoji — theo currentColor nên tự đúng ở nền sáng và nền tối.
const SHAPE_ICON = {
  rect: <rect x="3" y="5" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  ellipse: <ellipse cx="10" cy="10" rx="7" ry="5" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  line: <path d="M 3 16 L 17 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  arrow: <path d="M 3 16 L 17 4 M 11 4 L 17 4 L 17 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  triangle: <path d="M 10 4 L 17 16 L 3 16 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  diamond: <path d="M 10 3 L 17 10 L 10 17 L 3 10 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
};

export default function ToolOptions({ tool, prefs, onPrefs }) {
  const { t } = useLingui();
  // Cục gôm không có tuỳ chọn nào, và mode Chuột thì IdeaMap không render
  // component này — nên chỉ còn hai trường hợp phải vẽ.
  if (tool !== "pen" && tool !== "shape") return null;
  const isShape = tool === "shape";
  const canFill = isShape && SHAPE_CLOSED.has(prefs.kind);

  const SHAPE_LABEL = {
    rect: t`Chữ nhật`,
    ellipse: t`Ê-líp`,
    line: t`Đường thẳng`,
    arrow: t`Mũi tên`,
    triangle: t`Tam giác`,
    diamond: t`Hình thoi`
  };

  return (
    <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
      {isShape && (
        <>
          <div className="tool-grid">
            {SHAPE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={"tool-btn shape-pick" + (prefs.kind === kind ? " on" : "")}
                title={SHAPE_LABEL[kind]}
                // Chọn hình mở thì tắt luôn chế độ tô: để `fill` bật ngầm rồi
                // đổi lại sang chữ nhật sẽ tô đặc bất ngờ.
                onClick={() => onPrefs({ ...prefs, kind, fill: SHAPE_CLOSED.has(kind) ? prefs.fill : false })}
              ><svg viewBox="0 0 20 20" width="18" height="18">{SHAPE_ICON[kind]}</svg></button>
            ))}
          </div>
          <div className="tool-sep" />
        </>
      )}

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

      {isShape && (
        <>
          <div className="tool-sep" />
          <div className="tool-grid">
            <button
              type="button"
              className={"tool-btn fill-pick" + (!prefs.fill ? " on" : "")}
              title={t`Chỉ viền`}
              onClick={() => onPrefs({ ...prefs, fill: false })}
            ><svg viewBox="0 0 20 20" width="18" height="18"><rect x="3" y="4" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></button>
            <button
              type="button"
              className={"tool-btn fill-pick" + (prefs.fill ? " on" : "")}
              title={t`Tô cả hình`}
              disabled={!canFill}
              onClick={() => onPrefs({ ...prefs, fill: true })}
            ><svg viewBox="0 0 20 20" width="18" height="18"><rect x="3" y="4" width="14" height="12" rx="1.5" fill="currentColor" /></svg></button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [x] **Step 3: CSS**

Trong `game-tools/client/src/styles/idea-map.css`, khối `.tool-rail, .tool-options`
(~dòng 625) giữ nguyên. **Thay** dòng

```css
.tool-options { left: 66px; width: 54px; }
```

bằng

```css
/* Khu 4 của tool hình khối cao chừng 300px (6 hình + 7 màu + 3 độ dày + 2 chế
   độ tô). Vì khối này canh giữa dọc bằng translateY(-50%), màn hình thấp sẽ
   tràn ra ngoài khung nhìn nếu không kẹp chiều cao lại.
   Rộng 62px thay vì 54px: .tool-grid xếp 2 cột, mà nút chọn hình phải lớn hơn ô
   màu 18px mới nhìn ra hình. 62 - 12 padding = 50px cho hai cột 23px + gap 4. */
.tool-options {
  left: 66px; width: 62px;
  max-height: calc(100% - 24px); overflow-y: auto;
}
/* .tool-btn mặc định 34px — quá rộng cho một cột của .tool-grid, sẽ tràn ra
   ngoài khối. Nút chọn hình và nút chế độ tô phải tự thu lại. */
.shape-pick, .fill-pick { width: 23px; height: 23px; }
.shape-pick svg, .fill-pick svg { display: block; }
```

- [x] **Step 4: Phím tắt `s` trong `IdeaMap.jsx`**

Ngay **sau** dòng xử lý phím `e` (nhánh cục gôm), thêm:

```js
      else if (key === "s") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("shape"); }
```

- [x] **Step 5: Bản dịch tiếng Anh**

Thêm vào `game-tools/client/src/locales/en/messages.po` (cùng khuôn với các
mục sẵn có trong file — mỗi mục là một cặp `msgid` / `msgstr`):

```
msgid "Hình khối (S)"
msgstr "Shape (S)"

msgid "Chữ nhật"
msgstr "Rectangle"

msgid "Ê-líp"
msgstr "Ellipse"

msgid "Đường thẳng"
msgstr "Line"

msgid "Mũi tên"
msgstr "Arrow"

msgid "Tam giác"
msgstr "Triangle"

msgid "Hình thoi"
msgstr "Diamond"

msgid "Chỉ viền"
msgstr "Outline only"

msgid "Tô cả hình"
msgstr "Filled"
```

- [x] **Step 6: Cập nhật smoke test cũ và thêm nhóm kiểm mới**

Trong `game-tools/client/src/__smoke__/entry.jsx`, **thay** dòng 105:

```js
  if (railBtns() !== 9) throw new Error("mode Sửa phải có 9 nút (2 mode + 2 tool + 5 thêm), có " + railBtns());
```

bằng

```js
  if (railBtns() !== 10) throw new Error("mode Sửa phải có 10 nút (2 mode + 3 tool + 5 thêm), có " + railBtns());
```

Rồi thêm vào **cuối** hàm `run`, ngay **trước** `return true;`:

```js
  // Tool hình khối: khu 4 phải mọc thêm bảng chọn hình và hai nút chế độ tô,
  // và nút "tô cả hình" phải mờ đi khi đang chọn một hình MỞ.
  const shapeBtn = document.querySelectorAll(".tool-rail .tool-btn")[4];
  await act(async () => { shapeBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const picks = document.querySelectorAll(".tool-options .shape-pick").length;
  const fills = document.querySelectorAll(".tool-options .fill-pick").length;
  log(`khu 4 của hình khối: ${picks} hình · ${document.querySelectorAll(".tool-options .pen-swatch").length} màu · ${document.querySelectorAll(".tool-options .pen-width").length} độ dày · ${fills} chế độ tô`);
  if (picks !== 6) throw new Error("khu 4 phải có 6 nút chọn hình, có " + picks);
  if (fills !== 2) throw new Error("khu 4 phải có 2 nút chế độ tô, có " + fills);
  if (document.querySelectorAll(".tool-options .pen-swatch").length !== 7) throw new Error("khu 4 của hình khối vẫn phải có 7 ô màu");
  if (document.querySelectorAll(".tool-options .pen-width").length !== 3) throw new Error("khu 4 của hình khối vẫn phải có 3 nút độ dày");

  const fillBtns = () => document.querySelectorAll(".tool-options .fill-pick");
  if (fillBtns()[1].disabled) throw new Error("chữ nhật là hình đóng, nút tô cả hình phải bấm được");
  // Nút chọn hình thứ 3 là "đường thẳng" — hình mở.
  await act(async () => { document.querySelectorAll(".tool-options .shape-pick")[2].click(); await new Promise((r) => setTimeout(r, 20)); });
  log(`chọn đường thẳng: nút tô cả hình disabled = ${fillBtns()[1].disabled}`);
  if (!fillBtns()[1].disabled) throw new Error("đường thẳng là hình mở, nút tô cả hình phải mờ đi");
  if (!fillBtns()[0].className.includes("on")) throw new Error("chọn hình mở phải tự về chế độ chỉ viền");
```

- [x] **Step 7: Chạy smoke test**

```bash
cd game-tools/client && npm run test:smoke
```

Expected: PASS, log in ra `khu 4 của hình khối: 6 hình · 7 màu · 3 độ dày · 2 chế độ tô`.

- [x] **Step 8: Commit**

```bash
git add game-tools/client/src/components/ToolRail.jsx game-tools/client/src/components/ToolOptions.jsx \
        game-tools/client/src/styles/idea-map.css game-tools/client/src/pages/IdeaMap.jsx \
        game-tools/client/src/locales/en/messages.po game-tools/client/src/__smoke__/entry.jsx
git commit -m "feat: khu 4 của thanh công cụ có bảng chọn hình và chế độ tô"
```

---

- [ ] ## Task 5: Vẽ hình khối — `useInk.js` và `InkLayer.jsx`

**Files:**
- Modify: `game-tools/client/src/lib/useInk.js`
- Modify: `game-tools/client/src/components/InkLayer.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css` (dòng `.ink-layer path { fill: none; … }`)
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (thêm nhóm kiểm mới cuối hàm)

**Interfaces:**
- Consumes từ Task 1 và 3: `SHAPE_KINDS`, `SHAPE_CLOSED`, `SHAPE_MIN_DIAGONAL`, `normalizeBox`, `shapePath`; `prefs.kind`, `prefs.fill`.
- Produces:
  - `useInk` trả `draft` giờ có thể là `{ kind, color, w, fill, pts }` (hình khối) hoặc `{ color, w, pts }` (nét bút — `kind` vắng nghĩa là `"pen"`).
  - `onStrokeDone` nhận thêm dạng `{ kind, color, w, fill, pts: [x0,y0,x1,y1] }`; `fill` **không** xuất hiện với hình mở và nét bút.
  - `InkLayer`'s `Stroke` nhận thêm `kind` và `fill`.
  - Các hàm live được gọi ở task này (`beginShape` / `pushShape` / `endShape`) **chưa tồn tại** — Task 8 mới thêm. Ở task này gọi qua optional chaining `live?.beginShape?.(…)` để không nổ, và Task 8 sẽ bỏ dấu `?` sau tên hàm.

- [ ] **Step 1: `useInk.js` — nhánh vẽ hình khối**

Đổi dòng import ở đầu file (`shapePath` KHÔNG dùng trong file này, chỉ `InkLayer`
mới cần nó):

```js
import { simplifyStroke } from "./stroke.js";
import { drawingsHitBy, normalizeBox, SHAPE_CLOSED, SHAPE_MIN_DIAGONAL } from "./shape.js";
```

Thêm hai ref cạnh `activeRef`:

```js
  const startRef = useRef(null);   // điểm bắt đầu của hình khối đang kéo
  // Hộp mới nhất phải nằm trong REF, không đọc lại từ state `draft`: pushDraft
  // là rafThrottle nên hộp cuối cùng có thể chưa kịp vào state lúc mouseup, và
  // finish() gắn listener vào window ngay từ mousedown nên closure của nó giữ
  // `draft` của lượt render tại thời điểm đó (luôn là null). Cùng lý do liveRef
  // bên dưới phải tồn tại.
  const boxRef = useRef(null);
```

`pushDraft` phải mang thêm `kind` và `fill`:

```js
  const pushDraft = useRef(null);
  if (!pushDraft.current) {
    pushDraft.current = rafThrottle((color, w, pts, kind, fill) => setDraft({ color, w, pts, kind, fill }));
  }
```

Trong `handleMouseDown`, khối phân nhánh hiện là `if (tool === "eraser") { … } else { … }`.
Thay bằng ba nhánh — nhánh `eraser` và nhánh cuối (bút) giữ y nguyên nội dung cũ,
chỉ thêm nhánh giữa:

```js
    if (tool === "eraser") {
      activeRef.current = "eraser";
      eraseSetRef.current = new Set(drawingsHitBy(board.drawings || [], start, ERASE_RADIUS));
      pushErase.current(Array.from(eraseSetRef.current));
      // Gọi cả khi rỗng: beginErase phải tăng strokeId để lượt quét này có khoá
      // overlay riêng, không nối tiếp vào lượt trước.
      live?.beginErase(Array.from(eraseSetRef.current));
    } else if (tool === "shape") {
      activeRef.current = "shape";
      startRef.current = start;
      const kind = penPrefs.kind;
      // Hình mở không có vùng trong: `fill` phải bị dập ở ĐÂY, không trông vào
      // nút ở khu 4 đã bị disable — prefs cũ trong localStorage vẫn có thể mang
      // fill: true cùng với kind: "line".
      const fill = SHAPE_CLOSED.has(kind) && penPrefs.fill === true;
      const box = normalizeBox(start.x, start.y, start.x, start.y);
      boxRef.current = box;
      pushDraft.current(penPrefs.color, penPrefs.w, box, kind, fill);
      live?.beginShape?.(kind, penPrefs.color, penPrefs.w, fill, box);
    } else {
      activeRef.current = "pen";
      ptsRef.current = [start.x, start.y];
      unsentRef.current = [];
      pushDraft.current(penPrefs.color, penPrefs.w, ptsRef.current.slice());
      live?.beginStroke(penPrefs.color, penPrefs.w, [Math.round(start.x), Math.round(start.y)]);
    }
```

Trong `onMove`, thêm nhánh hình khối ngay **sau** nhánh `eraser` và **trước**
phần nét bút:

```js
      if (activeRef.current === "shape") {
        const s = startRef.current;
        const kind = penPrefs.kind;
        const closed = SHAPE_CLOSED.has(kind);
        // Shift: hình đóng thì ép vuông/tròn đều, hình mở thì ép hướng 0/45/90.
        const box = normalizeBox(s.x, s.y, p.x, p.y, closed ? { square: ev.shiftKey } : { snap: ev.shiftKey });
        boxRef.current = box;
        pushDraft.current(penPrefs.color, penPrefs.w, box, kind, closed && penPrefs.fill === true);
        live?.pushShape?.(box);
        return;
      }
```

Trong `finish`, thay hai dòng

```js
      const wasPen = activeRef.current === "pen";
      activeRef.current = null;

      if (!wasPen) {
```

bằng

```js
      const was = activeRef.current;
      activeRef.current = null;

      if (was === "eraser") {
```

(phần thân nhánh gôm bên trong giữ y nguyên, kể cả `return;` ở cuối nó)

rồi thêm nhánh hình khối **ngay sau** nhánh gôm, trước phần nét bút:

```js
      if (was === "shape") {
        pushDraft.current.cancel();
        setDraft(null);
        const box = boxRef.current;
        boxRef.current = null;
        startRef.current = null;
        // Bấm rồi nhả gần như không di: hình suy biến, bỏ. Đo theo ĐƯỜNG CHÉO,
        // vì một đường thẳng ngang dài 200 có chiều cao 0 — đo từng chiều sẽ bỏ oan.
        const diag = box ? Math.hypot(box[2] - box[0], box[3] - box[1]) : 0;
        if (!box || diag < SHAPE_MIN_DIAGONAL) { live?.cancelStroke(); return; }
        const kind = penPrefs.kind;
        const stroke = { kind, color: penPrefs.color, w: penPrefs.w, pts: box };
        // `fill` chỉ có ở hình đóng — nét bút và hình mở không mang field này.
        if (SHAPE_CLOSED.has(kind)) stroke.fill = penPrefs.fill === true;
        const drawingId = onStrokeDone(stroke);
        live?.endShape?.(drawingId);
        return;
      }
```

Trong effect `onBlur` ở cuối hook, thêm hai dòng reset cạnh các dòng reset sẵn có:

```js
      startRef.current = null;
      boxRef.current = null;
```

**Không** đổi gì khác trong hook. Đặc biệt: không thêm chỗ nào gọi `setTool` —
vẽ xong phải GIỮ tool hình khối, và điều đó đạt được bằng cách không làm gì.
- [ ] **Step 2: `InkLayer.jsx` — vẽ được hình khối**

Thay `game-tools/client/src/components/InkLayer.jsx`:

```jsx
import { memo } from "react";
import { strokePath } from "../lib/stroke.js";
import { shapePath } from "../lib/shape.js";
import { penVar } from "../lib/pen.js";

// Một đường vẽ duy nhất cho cả ba nguồn: nét đã lưu trong board, nét mình đang
// kéo, và nét người khác đang vẽ. Không có code path thứ hai để lệch nhau.
function Stroke({ kind, color, w, pts, fill, erasing }) {
  const d = !kind || kind === "pen" ? strokePath(pts) : shapePath(kind, pts);
  if (!d) return null;
  // Không dùng vector-effect: non-scaling-stroke — muốn zoom vào là nét dày ra
  // như mực trên giấy.
  //
  // `fill` phải là attribute trên chính thẻ này và CSS của .ink-layer path
  // KHÔNG được khai `fill`: trong SVG, CSS thắng presentation attribute, nên một
  // dòng `fill: none` trong stylesheet sẽ làm mọi hình tô đặc biến thành viền.
  return (
    <path
      className={erasing ? "erasing" : undefined}
      d={d}
      stroke={penVar(color)}
      strokeWidth={w}
      fill={fill ? penVar(color) : "none"}
    />
  );
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
        <Stroke key={d.id} kind={d.kind} color={d.color} w={d.w} pts={d.pts} fill={d.fill} erasing={dimmed.has(d.id)} />
      ))}
      {Array.from(liveStrokes.entries()).map(([key, e]) => (
        e.pts ? <Stroke key={"live-" + key} kind={e.kind} color={e.color} w={e.w} pts={e.pts} fill={e.fill} /> : null
      ))}
      {draft && <Stroke kind={draft.kind} color={draft.color} w={draft.w} pts={draft.pts} fill={draft.fill} />}
    </svg>
  );
}

export default memo(InkLayer);
```

- [ ] **Step 3: CSS — bỏ `fill: none`**

Trong `game-tools/client/src/styles/idea-map.css`, **thay**

```css
.ink-layer path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
```

bằng

```css
/* KHÔNG khai `fill` ở đây: trong SVG, CSS thắng presentation attribute, nên một
   dòng `fill: none` sẽ làm mọi hình khối tô đặc biến thành hình chỉ có viền.
   `fill` do InkLayer truyền tường minh trên từng <path>. */
.ink-layer path { stroke-linecap: round; stroke-linejoin: round; }
```

- [ ] **Step 4: Smoke test — kéo ra hình, lưu đúng một lần**

Thêm vào **cuối** hàm `run` trong `game-tools/client/src/__smoke__/entry.jsx`,
ngay **trước** `return true;` (sau nhóm kiểm của Task 4):

```js
  // Kéo chuột ở tool hình khối: ra đúng một path mới, pts đúng 4 số, tô đặc thì
  // fill khác "none", và lưu đúng MỘT lần.
  const shapePicks = () => document.querySelectorAll(".tool-options .shape-pick");
  await act(async () => { shapePicks()[0].click(); await new Promise((r) => setTimeout(r, 20)); });   // chữ nhật
  await act(async () => { fillBtns()[1].click(); await new Promise((r) => setTimeout(r, 20)); });     // tô cả hình

  const pathsBeforeShape = document.querySelectorAll(".ink-layer path").length;
  const putsBeforeShape = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1200, 300, capture);
    mouse("mousemove", 1280, 360);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 1360, 420);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1360, 420); await new Promise((r) => setTimeout(r, 40)); });

  const pathsAfterShape = document.querySelectorAll(".ink-layer path").length;
  log(`vẽ hình khối: ${pathsBeforeShape} → ${pathsAfterShape} path · PUT thêm ${globalThis.__puts.length - putsBeforeShape} lần`);
  if (pathsAfterShape !== pathsBeforeShape + 1) throw new Error("một hình phải ra đúng 1 path mới");
  if (globalThis.__puts.length - putsBeforeShape !== 1) throw new Error("một hình phải đúng 1 lần lưu");

  const savedShape = globalThis.__puts[globalThis.__puts.length - 1];
  const lastDrawing = savedShape.drawings[savedShape.drawings.length - 1];
  log(`hình đã lưu: kind=${lastDrawing.kind} fill=${lastDrawing.fill} pts=${JSON.stringify(lastDrawing.pts)}`);
  if (lastDrawing.kind !== "rect") throw new Error("phải lưu kind = rect, có " + lastDrawing.kind);
  if (lastDrawing.fill !== true) throw new Error("đang bật tô cả hình thì phải lưu fill = true");
  if (lastDrawing.pts.length !== 4) throw new Error("pts của hình khối phải đúng 4 số, có " + lastDrawing.pts.length);
  if (lastDrawing.pts.some((v) => !Number.isInteger(v))) throw new Error("toạ độ hình khối phải là số nguyên");

  // fill trên <path> phải THẮNG được stylesheet — đây là cái bẫy CSS-vs-attribute.
  const rectPath = Array.from(document.querySelectorAll(".ink-layer path")).find((p) => (p.getAttribute("d") || "").includes(" Z"));
  if (!rectPath) throw new Error("không tìm thấy path của hình khối (chuỗi d phải khép kín bằng Z)");
  log(`fill của hình tô đặc: ${rectPath.getAttribute("fill")}`);
  if (!rectPath.getAttribute("fill") || rectPath.getAttribute("fill") === "none") throw new Error("hình tô đặc phải có fill khác none");

  // Bấm rồi nhả gần như không di: hình suy biến, không được lưu.
  const putsBeforeTiny = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1600, 300, capture);
    mouse("mousemove", 1601, 301);
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => { mouse("mouseup", 1601, 301); await new Promise((r) => setTimeout(r, 30)); });
  log(`hình suy biến: PUT thêm ${globalThis.__puts.length - putsBeforeTiny} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeTiny) throw new Error("hình quá nhỏ không được lưu");
```

- [ ] **Step 5: Chạy smoke test**

```bash
cd game-tools/client && npm run test:smoke
```

Expected: PASS. Nếu `fill` ra `"none"` thì dòng CSS ở Step 3 chưa được bỏ.

- [ ] **Step 6: Chạy cả bộ unit test**

```bash
cd game-tools/client && npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game-tools/client/src/lib/useInk.js game-tools/client/src/components/InkLayer.jsx \
        game-tools/client/src/styles/idea-map.css game-tools/client/src/__smoke__/entry.jsx
git commit -m "feat: vẽ hình khối bằng cách kéo chuột trên bản đồ ý tưởng"
```

---

- [ ] ## Task 6: Cục gôm xoá được hình khối

**Files:**
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (thêm nhóm kiểm mới cuối hàm)

**Interfaces:**
- Consumes: `drawingsHitBy` (Task 2) đã được `useInk` gọi từ Task 2; hình khối đã
  lưu được từ Task 5. Task này **không thêm code sản phẩm** — nó chốt bằng test
  rằng hai mảnh đó ghép lại đúng, và sửa nếu không.

- [ ] **Step 1: Viết bài kiểm chốt**

Thêm vào **cuối** hàm `run` trong `game-tools/client/src/__smoke__/entry.jsx`,
ngay **trước** `return true;`:

```js
  // Cục gôm phải xoá được hình khối, và với hình TÔ ĐẶC thì quét vào GIỮA hình
  // cũng xoá — không chỉ chạm viền.
  const putsBeforeShapeErase = globalThis.__puts.length;
  const pathsBeforeShapeErase = document.querySelectorAll(".ink-layer path").length;
  await act(async () => { document.querySelectorAll(".tool-rail .tool-btn")[3].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    // (1280,360) nằm giữa hình chữ nhật tô đặc vẽ ở nhóm trước (1200,300)-(1360,420)
    mouse("mousedown", 1280, 360, capture);
    mouse("mousemove", 1285, 365);
    await new Promise((r) => setTimeout(r, 60));
  });
  const dimmedShape = document.querySelectorAll(".ink-layer path.erasing").length;
  log(`quét gôm vào giữa hình tô đặc: ${dimmedShape} hình đang mờ đi`);
  if (dimmedShape < 1) throw new Error("quét vào giữa hình tô đặc phải làm nó mờ đi");

  await act(async () => { mouse("mouseup", 1285, 365); await new Promise((r) => setTimeout(r, 40)); });
  const pathsAfterShapeErase = document.querySelectorAll(".ink-layer path").length;
  log(`sau khi gôm hình: ${pathsBeforeShapeErase} → ${pathsAfterShapeErase} path · PUT thêm ${globalThis.__puts.length - putsBeforeShapeErase} lần`);
  if (pathsAfterShapeErase !== pathsBeforeShapeErase - 1) throw new Error("hình tô đặc phải bị xoá");
  if (globalThis.__puts.length - putsBeforeShapeErase !== 1) throw new Error("một lần quét gôm phải đúng 1 lần lưu");

  // Hình CHỈ VIỀN: quét vào giữa vùng rỗng thì KHÔNG được xoá.
  await act(async () => { document.querySelectorAll(".tool-rail .tool-btn")[4].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { fillBtns()[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    mouse("mousedown", 1200, 700, capture);
    mouse("mousemove", 1300, 780);
    await new Promise((r) => setTimeout(r, 60));
    // Hộp chỉ được cập nhật ở mousemove — mouseup KHÔNG cập nhật. Nên điểm cuối
    // phải là một mousemove, không thì hình dừng ở hộp của lần nhích trước.
    mouse("mousemove", 1360, 820);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1360, 820); await new Promise((r) => setTimeout(r, 40)); });
  const pathsWithOutlineRect = document.querySelectorAll(".ink-layer path").length;

  await act(async () => { document.querySelectorAll(".tool-rail .tool-btn")[3].click(); await new Promise((r) => setTimeout(r, 20)); });
  const putsBeforeHollow = globalThis.__puts.length;
  await act(async () => {
    // giữa hình chỉ viền → không chạm gì
    mouse("mousedown", 1270, 750, capture);
    mouse("mousemove", 1275, 755);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1275, 755); await new Promise((r) => setTimeout(r, 40)); });
  log(`quét vào giữa hình CHỈ VIỀN: còn ${document.querySelectorAll(".ink-layer path").length} path · PUT thêm ${globalThis.__puts.length - putsBeforeHollow} lần (phải là 0)`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsWithOutlineRect) throw new Error("hình chỉ viền không được xoá khi quét vào vùng rỗng bên trong");
  if (globalThis.__puts.length !== putsBeforeHollow) throw new Error("quét vùng rỗng không được tạo bước hoàn tác");
```

- [ ] **Step 2: Chạy smoke test**

```bash
cd game-tools/client && npm run test:smoke
```

Expected: PASS. Nếu đỏ ở chỗ "hình tô đặc phải bị xoá" thì `drawingsHitBy` chưa
đọc `d.fill` từ dữ liệu board — kiểm lại rằng Task 5 có ghi `fill` vào object
truyền cho `onStrokeDone`.

- [ ] **Step 3: Kiểm một lần quét xoá cả nét bút và hình khối là MỘT bước hoàn tác**

Đây là bất biến đã có sẵn từ spec 1 (`commitErase` gom cả danh sách id vào một
`recordHistory`), nên không cần thêm test mới — nhưng phải xác nhận nó chưa vỡ:
nhóm kiểm gôm cũ ở giữa file (`một lần quét gôm phải đúng 1 lần lưu`) vẫn phải
xanh trong lần chạy ở Step 2.

- [ ] **Step 4: Commit**

```bash
git add game-tools/client/src/__smoke__/entry.jsx
git commit -m "test: chốt cục gôm xoá hình tô đặc và tha hình chỉ viền"
```

---

- [ ] ## Task 7: Server — `sanitizeInk` nhận `kind` và `fill`

**Files:**
- Modify: `game-tools/server/index.js:217-265` (khối hằng số `MAX_LIVE_INK_*` và hàm `sanitizeInk`)

**Interfaces:**
- Consumes: không import gì từ client (server không với tới được `src/lib/`).
- Produces: `sanitizeInk` trả thêm `kind` (chỉ khi khác `"pen"`) và `fill` (chỉ ở
  gói `seq: 0` của hình khối). Handler `live:ink` **không đổi** — nó vẫn
  `socket.to(room).emit("live:ink", { ...clean, socketId: socket.id })`.

- [ ] **Step 1: Thêm danh sách `kind` hợp lệ**

Trong `game-tools/server/index.js`, ngay sau `const MAX_LIVE_INK_W = 64;`:

```js
// Bản sao TAY của SHAPE_KINDS trong game-tools/client/src/lib/shape.js, cộng
// "pen". Server không import được lib của client. Thêm một kind mới thì phải
// sửa cả hai chỗ — client sẽ vẽ được nhưng server sẽ chặn gói nếu quên.
const LIVE_INK_KINDS = new Set(["pen", "rect", "ellipse", "line", "arrow", "triangle", "diamond"]);
const LIVE_INK_BOX_NUMBERS = 4;
```

- [ ] **Step 2: Sửa nhánh `pts` của `sanitizeInk`**

**Thay** khối cuối của `sanitizeInk` (từ ghi chú `// pts phải là mảng số ĐỘ DÀI
CHẴN` tới `return clean;`) bằng:

```js
  // pts phải là mảng số ĐỘ DÀI CHẴN: nó là [x0,y0,x1,y1,…], lẻ một số là dữ
  // liệu hỏng chứ không phải thiếu điểm cuối.
  if (!Array.isArray(payload.pts)) return null;

  let kind = "pen";
  if (payload.kind !== undefined) {
    if (typeof payload.kind !== "string" || !LIVE_INK_KINDS.has(payload.kind)) return null;
    kind = payload.kind;
  }
  // Hình khối: pts là hai góc đối, đúng 4 số. Kiểm ĐỘ DÀI GỐC trước khi slice —
  // nếu kiểm sau thì một mảng 4000 số bị cắt còn MAX_LIVE_INK_NUMBERS rồi vẫn
  // không phải 4, nhưng một mảng gửi kèm kind sai vẫn có thể lọt qua nhờ bị cắt.
  if (kind !== "pen" && payload.pts.length !== LIVE_INK_BOX_NUMBERS) return null;

  const pts = payload.pts.slice(0, MAX_LIVE_INK_NUMBERS);
  if (pts.length < 2 || pts.length % 2 !== 0) return null;
  if (!pts.every((v) => Number.isFinite(v))) return null;

  const clean = { strokeId, seq: Number.isFinite(payload.seq) ? payload.seq : 0, pts };
  // Nét bút không mang kind, đúng như client phát — giữ gói nhẹ và giữ
  // mergeInkPacket mặc định về "pen".
  if (kind !== "pen") clean.kind = kind;
  if (clean.seq === 0) {
    if (typeof payload.color !== "string" || payload.color.length > MAX_LIVE_INK_COLOR_LEN) return null;
    if (!Number.isFinite(payload.w) || payload.w < MIN_LIVE_INK_W || payload.w > MAX_LIVE_INK_W) return null;
    clean.color = payload.color;
    clean.w = payload.w;
    // Không tin kiểu client gửi: chỉ đúng `true` mới là tô đặc.
    if (kind !== "pen") clean.fill = payload.fill === true;
  }
  return clean;
```

- [ ] **Step 3: Kiểm cú pháp**

```bash
cd game-tools/server && node --check index.js
```

Expected: không in gì ra (cú pháp hợp lệ).

- [ ] **Step 4: Kiểm tay logic `sanitizeInk` bằng một lần chạy nhỏ**

Vì `server/` không có bộ test, chạy tay bốn trường hợp bằng một script tạm rồi
xoá nó. Tạo `game-tools/server/tmp-check-ink.mjs`:

```js
// Bản sao đúng của khối hằng + hàm sanitizeInk để chạy tay. XOÁ file này sau
// khi kiểm — nó không phải test thật, chỉ là một lần bấm thử.
const MAX_LIVE_INK_NUMBERS = 200;
const MAX_LIVE_ERASE_IDS = 200;
const MAX_LIVE_INK_COLOR_LEN = 32;
const MIN_LIVE_INK_W = 1;
const MAX_LIVE_INK_W = 64;
const LIVE_INK_KINDS = new Set(["pen", "rect", "ellipse", "line", "arrow", "triangle", "diamond"]);
const LIVE_INK_BOX_NUMBERS = 4;

// >>> DÁN Y NGUYÊN hàm sanitizeInk từ index.js vào đây <<<

import assert from "node:assert/strict";
// hình khối gói đầu: giữ kind, fill, 4 số
assert.deepEqual(
  sanitizeInk({ strokeId: 1, seq: 0, kind: "rect", color: "pen-red", w: 4, fill: true, pts: [0, 0, 10, 10] }),
  { strokeId: 1, seq: 0, pts: [0, 0, 10, 10], kind: "rect", color: "pen-red", w: 4, fill: true }
);
// hình khối gói sau: giữ kind, KHÔNG có fill
assert.deepEqual(
  sanitizeInk({ strokeId: 1, seq: 3, kind: "rect", pts: [0, 0, 20, 20] }),
  { strokeId: 1, seq: 3, pts: [0, 0, 20, 20], kind: "rect" }
);
// kind lạ bị chặn
assert.equal(sanitizeInk({ strokeId: 1, seq: 3, kind: "star", pts: [0, 0, 20, 20] }), null);
// hình khối mà pts không phải 4 số thì chặn, kể cả mảng khổng lồ
assert.equal(sanitizeInk({ strokeId: 1, seq: 3, kind: "rect", pts: [0, 0, 1, 1, 2, 2] }), null);
assert.equal(sanitizeInk({ strokeId: 1, seq: 3, kind: "rect", pts: new Array(4000).fill(1) }), null);
// fill không phải boolean → false
assert.equal(sanitizeInk({ strokeId: 1, seq: 0, kind: "rect", color: "pen-red", w: 4, fill: "yes", pts: [0, 0, 10, 10] }).fill, false);
// nét bút KHÔNG mang kind trong kết quả
assert.equal("kind" in sanitizeInk({ strokeId: 1, seq: 0, color: "pen-red", w: 4, pts: [0, 0, 10, 10] }), false);
// nét bút nhiều điểm vẫn qua như cũ
assert.deepEqual(sanitizeInk({ strokeId: 1, seq: 2, pts: [0, 0, 1, 1, 2, 2] }).pts, [0, 0, 1, 1, 2, 2]);
console.log("sanitizeInk: 8/8 OK");
```

```bash
cd game-tools/server && node tmp-check-ink.mjs && rm tmp-check-ink.mjs
```

Expected: in ra `sanitizeInk: 8/8 OK`, rồi file tạm bị xoá.

- [ ] **Step 5: Chắc chắn file tạm đã biến mất**

```bash
cd game-tools/server && ls tmp-check-ink.mjs 2>&1
```

Expected: `No such file or directory`.

- [ ] **Step 6: Commit**

```bash
git add game-tools/server/index.js
git commit -m "feat: server chuyển tiếp gói live:ink của hình khối"
```

---

- [ ] ## Task 8: Realtime — hình khối chạy theo thời gian thực

**Files:**
- Modify: `game-tools/client/src/lib/ink-live.js`
- Modify: `game-tools/client/src/lib/ink-live.test.js`
- Modify: `game-tools/client/src/lib/useInkLive.js`
- Modify: `game-tools/client/src/lib/useInk.js` (bỏ `?` sau tên ba hàm live)
- Modify: `game-tools/client/src/__smoke__/entry.jsx` (thêm nhóm kiểm mới cuối hàm)

**Interfaces:**
- Consumes: `INK_LIVE_TTL_MS`, `INK_SETTLE_TTL_MS`, `inkKey`, `mergeInkPacket`,
  `reconcileInkOverlay` (đã có); `trailingThrottle`, `sweepExpired` (đã có).
- Produces:
  - Entry overlay đổi từ `{ color, w, pts, drawingId, erase, expiresAt }` thành
    `{ kind, fill, color, w, pts, drawingId, erase, expiresAt }`.
  - `useInkLive(socket)` trả thêm `beginShape(kind, color, w, fill, box)`,
    `pushShape(box)`, `endShape(drawingId)`.
  - Hình dạng gói `live:ink` của hình khối: `{ strokeId, seq, kind, pts: [x0,y0,x1,y1] }`
    ở mọi gói; gói `seq: 0` thêm `color`, `w`, `fill`; gói cuối là
    `{ strokeId, done: true, drawingId }` — **giống hệt** gói `done` của nét bút.

- [ ] **Step 1: Viết test thất bại cho `ink-live.js`**

Trong `game-tools/client/src/lib/ink-live.test.js`, **thay** test
`"mergeInkPacket: gói đầu tạo entry đủ màu, độ dày, điểm"` bằng:

```js
test("mergeInkPacket: gói đầu tạo entry đủ màu, độ dày, điểm", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0, 10, 10] }), NOW);
  assert.deepEqual(m.get("s1:1"), {
    kind: "pen", fill: false,
    color: "pen-red", w: 4, pts: [0, 0, 10, 10],
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});
```

và **thêm vào cuối file**:

```js
test("mergeInkPacket: gói đầu của hình khối giữ kind và fill", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: true, pts: [0, 0, 100, 60] }),
    NOW
  );
  assert.deepEqual(m.get("s1:1"), {
    kind: "rect", fill: true,
    color: "pen-blue", w: 8, pts: [0, 0, 100, 60],
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});

// ĐÂY là điểm khác nhau cốt lõi giữa hai loại gói: gói hình khối mang CẢ hộp
// nên phải THAY, không nối. Nối thì hộp dài ra thành 6, 8, 10 số và shapePath
// đọc sai hình.
test("mergeInkPacket: gói sau của hình khối THAY hộp chứ không nối", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: false, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "rect", pts: [0, 0, 50, 40] }), NOW + 40);
  m = mergeInkPacket(m, pkt({ seq: 2, kind: "rect", pts: [0, 0, 90, 70] }), NOW + 80);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 90, 70]);
  assert.equal(m.get("s1:1").kind, "rect", "kind phải giữ qua các gói");
  assert.equal(m.get("s1:1").fill, false, "fill phải giữ qua các gói");
  assert.equal(m.get("s1:1").expiresAt, NOW + 80 + INK_LIVE_TTL_MS);
});

test("mergeInkPacket: gói done của hình khối giữ hộp và mang drawingId", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "ellipse", color: "pen-green", w: 2, fill: true, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 42 }), NOW + 50);
  const e = m.get("s1:1");
  assert.equal(e.drawingId, 42);
  assert.equal(e.kind, "ellipse");
  assert.deepEqual(e.pts, [0, 0, 10, 10]);
  assert.equal(e.expiresAt, NOW + 50 + INK_SETTLE_TTL_MS);
});

test("mergeInkPacket: gói không có kind vẫn là nét bút và vẫn NỐI điểm", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  assert.equal(m.get("s1:1").kind, "pen");
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10]);
});
```

Sửa thêm test `"mergeInkPacket: gói erase gộp id qua nhiều gói"` — dòng
`assert.equal(m.get("s1:1").pts, null);` giữ nguyên, nhưng nếu nó dùng
`deepEqual` cả entry thì thêm `kind: null, fill: false` vào giá trị mong đợi.

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

```bash
cd game-tools/client && npm test
```

Expected: FAIL — entry thiếu `kind` / `fill`, và gói sau của hình khối bị nối
thành 6 số.

- [ ] **Step 3: Sửa `mergeInkPacket`**

Trong `game-tools/client/src/lib/ink-live.js`:

Nhánh erase — thêm hai field cho entry đồng dạng với nhánh vẽ:

```js
    next.set(key, {
      kind: null, fill: false,
      color: null, w: null, pts: null, drawingId: null, erase: merged,
      expiresAt: now + (packet.done === true ? INK_SETTLE_TTL_MS : INK_LIVE_TTL_MS)
    });
```

Nhánh vẽ — **thay** khối cuối hàm (từ `const pts = Array.isArray(...)` tới
`return next;`) bằng:

```js
  const pts = Array.isArray(packet.pts) ? packet.pts : null;
  if (!pts || pts.length < 2) return prev;
  // Vào giữa nét: không có gói seq 0 nên thiếu màu và độ dày, bỏ qua.
  if (!cur && packet.seq !== 0) return prev;

  // Gói hình khối mang kind ở MỌI gói, không chỉ gói đầu — nhờ vậy nhánh dưới
  // không phải nhớ kind của entry, và server kiểm được pts đúng 4 số.
  const kind = typeof packet.kind === "string" ? packet.kind : "pen";

  const next = new Map(prev);
  if (packet.seq === 0) {
    next.set(key, {
      kind, fill: packet.fill === true,
      color: packet.color, w: packet.w, pts: pts.slice(),
      drawingId: null, erase: null, expiresAt: now + INK_LIVE_TTL_MS
    });
  } else if (kind !== "pen") {
    // Hộp mang trọn thông tin: THAY, không nối. Nối thì hộp dài ra và shapePath
    // đọc sai hình.
    next.set(key, { ...cur, pts: pts.slice(), expiresAt: now + INK_LIVE_TTL_MS });
  } else {
    next.set(key, { ...cur, pts: cur.pts.concat(pts), expiresAt: now + INK_LIVE_TTL_MS });
  }
  return next;
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd game-tools/client && npm test
```

Expected: PASS.

- [ ] **Step 5: Thêm `beginShape` / `pushShape` / `endShape` vào `useInkLive.js`**

Thêm một ref cạnh `seqRef`:

```js
  const kindRef = useRef("pen");       // kind của hình đang kéo, để gói giữa chừng tự mang theo
```

Thêm bộ xả riêng cho hộp, cạnh `flushPtsRef` và `flushEraseRef`:

```js
  // KHÁC bút: ở đây KHÔNG cần bộ tích luỹ, và đó không phải sơ suất.
  // trailingThrottle THAY tham số đang chờ (`pending = args`) — với gói mang
  // ĐIỂM MỚI THÊM thì đó là mất dữ liệu, nhưng với gói mang CẢ HỘP thì đó đúng
  // là hành vi mong muốn: hộp sau đã chứa trọn thông tin của hộp trước.
  const flushBoxRef = useRef(null);
  if (!flushBoxRef.current) {
    flushBoxRef.current = trailingThrottle((box) => {
      seqRef.current += 1;
      socketRef.current?.emit("live:ink", {
        strokeId: strokeIdRef.current, seq: seqRef.current, kind: kindRef.current, pts: box
      });
    }, INK_SEND_MS);
  }
```

Thêm `flushBoxRef.current?.cancel();` vào effect dọn khi unmount (cạnh hai dòng
cancel sẵn có).

Thêm ba hàm, đặt sau `endStroke`:

```js
  // Gói đầu phải đi NGAY: nó mang kind, màu, độ dày và chế độ tô; thiếu nó thì
  // mọi gói sau bị người nhận bỏ (xem mergeInkPacket).
  const beginShape = useCallback((kind, color, w, fill, box) => {
    flushBoxRef.current.cancel();
    strokeIdRef.current += 1;
    seqRef.current = 0;
    kindRef.current = kind;
    emitNow({ strokeId: strokeIdRef.current, seq: 0, kind, color, w, fill: fill === true, pts: box });
  }, [emitNow]);

  const pushShape = useCallback((box) => {
    flushBoxRef.current(box);
  }, []);

  // Xả nốt hộp còn treo TRƯỚC gói done, không thì hình trên màn hình người khác
  // đứng ở kích thước của gói gần nhất cho tới khi board:update về.
  const endShape = useCallback((drawingId) => {
    flushBoxRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, done: true, drawingId: drawingId ?? null });
  }, [emitNow]);
```

Trong `cancelStroke`, thêm hai dòng — cùng lý do đã ghi trong ghi chú của nó về
`flushEraseRef`: một timer còn treo bắn *sau* gói `cancel` sẽ dựng lại đúng
entry vừa bị xoá, và hình tạm sống lại trên màn hình người khác tới hết TTL:

```js
    flushBoxRef.current.cancel();
```

Cập nhật `useMemo` cuối hàm để trả và phụ thuộc thêm ba hàm mới:

```js
  return useMemo(
    () => ({
      liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke,
      beginShape, pushShape, endShape,
      beginErase, pushErase, endErase, reconcile
    }),
    [
      liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke,
      beginShape, pushShape, endShape,
      beginErase, pushErase, endErase, reconcile
    ]
  );
```

- [ ] **Step 6: Bỏ optional chaining tạm trong `useInk.js`**

Ba hàm giờ đã tồn tại, nên đổi lại cho cùng khuôn với các lời gọi live khác:

- `live?.beginShape?.(…)` → `live?.beginShape(…)`
- `live?.pushShape?.(box)` → `live?.pushShape(box)`
- `live?.endShape?.(drawingId)` → `live?.endShape(drawingId)`

- [ ] **Step 7: Smoke test — phát và nhận gói hình khối**

Thêm vào **cuối** hàm `run` trong `game-tools/client/src/__smoke__/entry.jsx`,
ngay **trước** `return true;`:

```js
  // PHÁT: mọi gói của hình khối phải mang kind và pts đúng 4 số, và tổng số
  // "số" đã gửi không được phình lên như gói nét bút.
  await act(async () => { document.querySelectorAll(".tool-rail .tool-btn")[4].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { shapePicks()[1].click(); await new Promise((r) => setTimeout(r, 20)); });   // ê-líp
  const emittedBeforeShape = globalThis.__emitted.length;
  await act(async () => {
    mouse("mousedown", 200, 1200, capture);
    mouse("mousemove", 260, 1250);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 320, 1300);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 320, 1300); await new Promise((r) => setTimeout(r, 40)); });

  const shapePkts = globalThis.__emitted.slice(emittedBeforeShape).filter((e) => e[0] === "live:ink").map((e) => e[1]);
  log(`live:ink của hình khối: ${shapePkts.length} gói; seq = ${shapePkts.map((p) => (p.done ? "done" : p.seq)).join(",")}`);
  if (shapePkts.length < 2) throw new Error("phải phát ít nhất gói đầu và gói done");
  const shapeFirst = shapePkts[0];
  if (shapeFirst.seq !== 0 || shapeFirst.kind !== "ellipse") throw new Error("gói đầu phải mang seq 0 và kind");
  if (typeof shapeFirst.fill !== "boolean") throw new Error("gói đầu phải mang fill kiểu boolean");
  for (const p of shapePkts) {
    if (p.done) continue;
    if (p.kind !== "ellipse") throw new Error("MỌI gói hình khối phải mang kind, gói seq " + p.seq + " thì không");
    if (p.pts.length !== 4) throw new Error("gói hình khối phải mang đúng 4 số, gói seq " + p.seq + " có " + p.pts.length);
  }
  const shapeDone = shapePkts[shapePkts.length - 1];
  if (shapeDone.done !== true || !Number.isFinite(shapeDone.drawingId)) throw new Error("gói cuối phải là done kèm drawingId");
  if (shapePkts.filter((p) => p.done).length !== 1) throw new Error("một hình chỉ được có đúng 1 gói done");

  // NHẬN: gói hình của người khác hiện ra ngay, và gói sau THAY hộp chứ không
  // làm hình phình ra.
  const pathsBeforePeerShape = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer9", strokeId: 5, seq: 0, kind: "rect", color: "pen-purple", w: 4, fill: false, pts: [2000, 100, 2100, 200] });
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`hình của người khác đang vẽ: ${document.querySelectorAll(".ink-layer path").length} path (trước đó ${pathsBeforePeerShape})`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsBeforePeerShape + 1) throw new Error("gói hình khối của người khác không hiện ra");

  const peerRect = () => Array.from(document.querySelectorAll(".ink-layer path")).find((p) => (p.getAttribute("d") || "").startsWith("M 2000 100"));
  if (!peerRect()) throw new Error("không tìm thấy hình của người khác");
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer9", strokeId: 5, seq: 1, kind: "rect", pts: [2000, 100, 2300, 400] });
    await new Promise((r) => setTimeout(r, 30));
  });
  const grown = peerRect();
  log(`sau gói seq 1: d = ${grown?.getAttribute("d")}`);
  if (!grown) throw new Error("hình của người khác biến mất sau gói seq 1");
  if (!grown.getAttribute("d").includes("2300")) throw new Error("gói sau phải THAY hộp — hình phải lớn ra tới 2300");
  // Bốn cạnh: chuỗi d của chữ nhật luôn có đúng 3 lệnh L. Nhiều hơn nghĩa là
  // hộp đã bị NỐI thành 6 số thay vì thay.
  if ((grown.getAttribute("d").match(/L /g) || []).length !== 3) throw new Error("hộp bị nối thêm thay vì thay: " + grown.getAttribute("d"));
```

- [ ] **Step 8: Chạy smoke test**

```bash
cd game-tools/client && npm run test:smoke
```

Expected: PASS.

- [ ] **Step 9: Chạy cả bộ unit test**

```bash
cd game-tools/client && npm test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add game-tools/client/src/lib/ink-live.js game-tools/client/src/lib/ink-live.test.js \
        game-tools/client/src/lib/useInkLive.js game-tools/client/src/lib/useInk.js \
        game-tools/client/src/__smoke__/entry.jsx
git commit -m "feat: hình khối chạy theo thời gian thực qua kênh live:ink"
```

---

## Kiểm tay còn lại (không tự động hoá được)

Sau khi tám task xong, mở app thật và làm danh sách này — mục **Kiểm thử** của
spec ghi đầy đủ hơn:

- Hai tab cùng board: vẽ đủ sáu hình, cả viền cả tô, cả có `Shift` và không.
  Tab kia phải thấy hình lớn dần theo con trỏ, không nháy lúc thả chuột.
- Chọn đường thẳng → nút "cả hình" mờ đi và chế độ về viền.
- Zoom sâu vào ê-líp: viền còn mịn (đây là lý do dùng cung `A` chứ không phải đa giác).
- Đổi theme sáng/tối: cả màu viền và màu tô đều đúng.
- Tài khoản chỉ xem: nút hình khối mờ, không vẽ được, nhưng thấy hình người khác đang vẽ.
- Đóng tab giữa lúc đang kéo hình: hình tạm bên tab kia tự dọn sau TTL.
- Hình tô đặc vẽ chồng lên thẻ **sẽ che thẻ** — đây là hạn chế đã biết, spec 3
  làm z-order mới sửa. Không báo là lỗi.

## Kết quả

*(Điền khi mọi task đã tick: đường dẫn tới file summary trong `../summaries/`.)*
