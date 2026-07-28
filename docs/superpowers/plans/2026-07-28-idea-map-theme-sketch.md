# Hệ màu bảng & skin vẽ tay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `/idea-map/:boardId` đổi được màu nền bảng và bộ màu theo preset (lưu vào board, đồng bộ realtime), thẻ và khung tô nền thật theo màu đã chọn, và có một skin **vẽ tay** bật/tắt được cho riêng từng người — font viết tay, viền méo, dây nối và hình khối rung như vẽ bằng bút chì.

**Architecture:** Ba lớp xếp chồng, làm đúng thứ tự. (1) Rút hình dạng vật thể canvas thành token CSS (`--card-radius`, `--edge-w`, `--canvas-font`…) — refactor thuần, không đổi diện mạo. (2) Màu: hai thuộc tính mới `data-bg` / `data-pack` trên `documentElement` gán lại `--board-bg` và `--dot-1..8`; vì thẻ lưu **tên token** chứ không lưu hex nên đổi pack là cả bản đồ đổi màu mà không sửa một byte dữ liệu. (3) Skin: trục thứ hai `data-skin` độc lập với `data-theme`, gán lại đúng khối token ở (1), cộng một module thuần mới `lib/sketchy.js` sinh path rung cho SVG. Hit-test và hình học **không đụng tới** — rung chỉ là chuyện hiển thị.

**Tech Stack:** React 18, Vite 6, socket.io 4, Express + Mongoose (server), `@lingui/react/macro` cho i18n, `@fontsource/shantell-sans` cho font viết tay, `node:test` + `node:assert/strict` cho unit test, `npm run test:smoke` (jsdom) cho test ghép nối.

**Spec:** [`docs/superpowers/specs/2026-07-28-idea-map-theme-sketch-design.md`](../specs/2026-07-28-idea-map-theme-sketch-design.md)

## Global Constraints

- Thư mục làm việc của mọi lệnh `npm`: `game-tools/client` (client) và `game-tools/server` (server). Đường dẫn file trong plan này tính từ gốc repo.
- Unit test dùng `node:test` + `node:assert/strict`, **không** vitest. `npm test` chạy `node --test "src/lib/*.test.js"` — chỉ nhặt file trong `src/lib/`.
- Server **không có** bộ test nào; phần `server/` kiểm bằng `node --check` và qua smoke test của client.
- Mọi chuỗi hiện cho người dùng phải đi qua `@lingui/react/macro`: `<Trans>` cho nội dung, `` t`…` `` cho `title`. Ngôn ngữ nguồn là **tiếng Việt**; bản dịch tiếng Anh nằm ở `game-tools/client/src/locales/en/messages.po`.
- Hai trục giao diện **độc lập nhau**: `data-theme` (`light`/`dark`, của người dùng) và `data-skin` (`clean`/`sketch`, của người dùng). Hai thuộc tính dữ liệu board: `data-bg`, `data-pack`. Cả bốn đều đặt trên `document.documentElement`.
- `data-bg` và `data-pack` phải **gỡ khi rời trang board** — màu của một board không được dính sang trang danh sách.
- Preset nền **không được** ghi đè `--bg`; nó gán `--board-bg` / `--board-grid`. Lý do trong spec mục B1.
- Pack màu chỉ gán lại `--dot-1..8`. **Không** đụng `--st-*` (màu trạng thái, mang nghĩa cố định) và `--pen-*` (hệ màu bút riêng).
- `lib/sketchy.js` **không được gọi `Math.random()`** ở bất kỳ đâu. Test phải chứng minh điều đó bằng cách gọi hai lần cùng seed và so chuỗi.
- Skin vẽ tay **chỉ áp cho canvas**: `.idea-card`, `.frame-box`, `.edge-layer`, `.ink-layer`, `.viewport`. Không đụng `.topbar`, `.filterbar`, `.tool-rail`, `.badge-editor`, `.dock-panel`.
- `EdgeLayer` và `InkLayer` bọc `memo()` → nhận `sketch` qua **prop**, tuyệt đối không đọc DOM/`getComputedStyle` trong render.
- Commit sau mỗi task. Thông điệp commit tiếng Việt, tiền tố `feat:` / `test:` / `refactor:` như lịch sử repo đang dùng.

---

- [ ] ## Task 1: Token hình dạng — refactor thuần

**Files:**
- Modify: `game-tools/client/src/index.css`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: không gì.
- Produces: token CSS `--card-radius`, `--card-border-w`, `--frame-radius`, `--frame-border-w`, `--pill-radius`, `--edge-w`, `--edge-w-hot`, `--canvas-font`, `--canvas-font-scale`, `--grid-size`.

**Ràng buộc tuyệt đối:** task này **không được đổi một pixel nào**. Giá trị token phải bằng đúng giá trị đang khai cứng. Đây là bước dọn đường cho Task 7.

- [ ] **Step 1: Khai token**

Thêm vào cuối khối `:root` đầu tiên của `index.css` (sau `--pen-mono`), kèm ghi chú vì sao nó tách khỏi khối màu:

```css
  /* Hình dạng vật thể trên canvas — KHÔNG phải màu. Tách riêng vì skin
     (data-skin) gán lại cả khối này, còn theme sáng/tối thì không đụng. Ba
     khối màu bên dưới (@media dark, [data-theme]) cố tình không lặp lại nó. */
  --card-radius: 6px;
  --card-border-w: 1px;
  --frame-radius: 10px;
  --frame-border-w: 2px;
  --pill-radius: 999px;
  --edge-w: 1.6px;
  --edge-w-hot: 2.4px;
  --canvas-font: "IBM Plex Sans", Arial, "Liberation Sans", "Helvetica Neue", sans-serif;
  --canvas-font-scale: 1;
  --grid-size: 26px;
```

Khối token này chỉ khai **một lần** ở `:root` — không nhân bản vào `@media (prefers-color-scheme: dark)` hay `:root[data-theme=…]`.

- [ ] **Step 2: Thay giá trị cứng bằng token trong `idea-map.css`**

Đọc và sửa đúng các luật sau (grep từng cái, đừng thay bừa bằng sed):

| Luật | Đổi |
|---|---|
| `.viewport` | `26px 26px` → `var(--grid-size) var(--grid-size)`; `var(--bg)` → `var(--board-bg)`; `radial-gradient(var(--line)…` → `radial-gradient(var(--board-grid)…` |
| `.idea-card` | `border: 1px solid` → `var(--card-border-w)`; `border-radius: 6px` → `var(--card-radius)`; thêm `font-family: var(--canvas-font)` |
| `.frame-box` | bán kính + độ dày viền → token |
| `.status-pill`, `.tag-pill`, `.cmt-pill` | `border-radius` → `var(--pill-radius)` |
| `.edge-layer .visible` | `stroke-width: 1.6` → `var(--edge-w)` |
| `.edge-layer .visible.hot`, `.visible.selected` | `2.4` → `var(--edge-w-hot)` |

Trong `index.css` thêm mặc định cho hai biến nền, ngay trên khối token hình dạng:

```css
  /* Nền canvas đi qua biến riêng chứ không dùng thẳng --bg: preset nền của
     board (data-bg) chỉ được đổi nền SA BÀN, không được kéo theo nền hover của
     thanh menu — chỗ đó cũng đang dùng var(--bg). */
  --board-bg: var(--bg);
  --board-grid: var(--line);
```

- [ ] **Step 3: Kiểm không đổi diện mạo**

```bash
cd game-tools/client && npm run build && npm run test:smoke
```

Mở app, so mắt với ảnh chụp trước khi sửa: thẻ, khung, dây, lưới chấm, badge phải y hệt ở **cả hai** theme.

- [ ] **Step 4: Commit**

```bash
git add game-tools/client/src/index.css game-tools/client/src/styles/idea-map.css
git commit -m "refactor: rút hình dạng vật thể canvas thành token CSS"
```

---

- [ ] ## Task 2: `lib/board-theme.js` + CSS preset nền và bộ màu

**Files:**
- Create: `game-tools/client/src/lib/board-theme.js`
- Create: `game-tools/client/src/lib/board-theme.test.js`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: không gì.
- Produces:
  - `BOARD_BGS: string[]` — `["paper","white","slate","mint","blush"]` (không gồm `null`)
  - `COLOR_PACKS: string[]` — `["pastel","vivid","mono"]` (không gồm `null` = Cổ điển)
  - `isBoardBg(v) -> boolean` — `null`/`undefined` hợp lệ; chuỗi lạ thì không
  - `isColorPack(v) -> boolean` — như trên

Module **chỉ giữ id**, không giữ hex: toàn bộ giá trị màu nằm trong CSS. Nhờ vậy không có hai nguồn sự thật để lệch nhau, và nút swatch trong panel chỉ cần `data-bg` là CSS tự tô.

- [ ] **Step 1: Viết test thất bại**

`game-tools/client/src/lib/board-theme.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_BGS, COLOR_PACKS, isBoardBg, isColorPack } from "./board-theme.js";

test("id preset không trùng nhau", () => {
  assert.equal(new Set(BOARD_BGS).size, BOARD_BGS.length);
  assert.equal(new Set(COLOR_PACKS).size, COLOR_PACKS.length);
});

// null = "theo giao diện", là giá trị hợp lệ và là mặc định của board cũ.
test("null hợp lệ, chuỗi lạ thì không", () => {
  assert.equal(isBoardBg(null), true);
  assert.equal(isBoardBg(undefined), true);
  assert.equal(isBoardBg("mint"), true);
  assert.equal(isBoardBg("neon"), false);
  assert.equal(isBoardBg(7), false);
  assert.equal(isColorPack("pastel"), true);
  assert.equal(isColorPack("Pastel"), false);
});
```

- [ ] **Step 2: Viết `board-theme.js` cho test xanh**

Kèm ghi chú: hai hàm `is*` tồn tại để lọc dữ liệu vào từ **Nhập JSON** — người dùng dán một board tay viết vào thì `data-bg="<script>"` không được lọt xuống DOM.

- [ ] **Step 3: Khai preset nền trong `idea-map.css`**

Đặt ngay trên luật `.viewport`, năm preset × hai theme. Mẫu:

```css
/* Nền bảng — dữ liệu của board (board.bg), khác với sáng/tối là thiết lập của
   người dùng. Mỗi preset phải khai CẢ hai theme: một board nền "bạc hà" mở ở
   chế độ tối mà vẫn dùng hex sáng thì chữ trắng trên nền xanh nhạt. */
:root[data-bg="paper"] { --board-bg: #E6E0CC; --board-grid: rgba(36,38,29,0.20); }
:root[data-theme="dark"][data-bg="paper"] { --board-bg: #241F16; --board-grid: rgba(236,231,210,0.13); }
/* white / slate / mint / blush — bảng giá trị ở spec mục B1 */
```

Cẩn thận độ đặc hiệu: khi hệ điều hành để tối mà người dùng chưa bấm nút, `data-theme` **không có** trên `<html>` (xem `useTheme.js`) → phải có thêm bản `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"])[data-bg="paper"] { … } }` cho từng preset, đúng như ba khối màu hiện có đang xử lý.

- [ ] **Step 4: Khai ba pack màu**

```css
/* Pack chỉ gán lại 8 token --dot-*. Thẻ/nhãn/dây lưu TÊN token ("dot-3") chứ
   không lưu hex, nên đổi pack là cả bản đồ đổi màu mà không sửa một byte dữ
   liệu — và không tạo một bước hoàn tác nào. */
:root[data-pack="pastel"] { --dot-1: …; /* … --dot-8 */ }
```

Ba pack, mỗi cái ba biến thể theme như Step 3. Gợi ý hướng màu: `pastel` nhạt và nhã, `vivid` bão hoà cao, `mono` tám sắc độ của cùng một màu chàm. Giữ nguyên thứ tự ý nghĩa của 8 token.

- [ ] **Step 5: Commit**

```bash
git add game-tools/client/src/lib/board-theme.js game-tools/client/src/lib/board-theme.test.js \
        game-tools/client/src/styles/idea-map.css
git commit -m "feat: preset nền bảng và bộ màu, khai bằng CSS"
```

---

- [ ] ## Task 3: Server cho `bg` / `pack`

**Files:**
- Modify: `game-tools/server/models.js`
- Modify: `game-tools/server/boards.js`

**Interfaces:**
- Consumes: không gì.
- Produces: hai field board mới `bg: String|null`, `pack: String|null` đi trọn vẹn qua GET → PUT → realtime.

- [ ] **Step 1: Schema**

`boardSchema`: thêm `bg: { type: String, default: null }`, `pack: { type: String, default: null }` ngay sau `palette`.

- [ ] **Step 2: Bốn chỗ liệt kê field trong `boards.js`**

```bash
grep -n "palette" game-tools/server/boards.js
```

Bốn chỗ, **thiếu một là hỏng**: object trả về ở GET (`palette: obj.palette`), destructure `req.body` ở PUT, object ghi `findByIdAndUpdate`, và `payload` phát realtime. Thêm `bg`, `pack` vào cả bốn, đặt cạnh `palette` cho dễ soát.

- [ ] **Step 3: Kiểm**

```bash
cd game-tools/server && node --check boards.js && node --check models.js
```

- [ ] **Step 4: Commit**

```bash
git add game-tools/server/models.js game-tools/server/boards.js
git commit -m "feat: board lưu được nền và bộ màu"
```

---

- [ ] ## Task 4: Panel "Giao diện" và gắn thuộc tính lên `<html>`

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `BOARD_BGS`, `COLOR_PACKS`, `isBoardBg`, `isColorPack` từ `lib/board-theme.js`.
- Produces: panel `Giao diện` trong `.fb-tabs`; `data-bg` / `data-pack` trên `document.documentElement`.

- [ ] **Step 1: Mặc định cho board cũ**

Ở chỗ `setBoard({ palette: [], nextPaletteId: 1, drawings: [], nextDrawingId: 1, ...boardData, … })` (`IdeaMap.jsx` ~dòng 234) thêm `bg: null, pack: null` vào lớp mặc định — board đã nằm trong DB không có field thì vẫn chạy.

- [ ] **Step 2: Effect gắn/gỡ thuộc tính**

```jsx
// data-bg/data-pack là DỮ LIỆU BOARD, đặt cùng chỗ với data-theme (thiết lập
// người dùng) vì hai lý do: chip nhãn nằm trong .filterbar, ngoài .viewport, mà
// vẫn phải đổi màu theo pack; và exportPng() đang đọc getComputedStyle của
// documentElement, để ở đây thì nó không phải đổi cách lấy giá trị.
useEffect(() => {
  const el = document.documentElement;
  const bg = isBoardBg(board?.bg) ? board?.bg : null;
  const pack = isColorPack(board?.pack) ? board?.pack : null;
  if (bg) el.setAttribute("data-bg", bg); else el.removeAttribute("data-bg");
  if (pack) el.setAttribute("data-pack", pack); else el.removeAttribute("data-pack");
  // Gỡ khi rời trang: sang danh sách board mà còn nền "bảng đen" của board vừa
  // xem thì trông như lỗi hiển thị.
  return () => { el.removeAttribute("data-bg"); el.removeAttribute("data-pack"); };
}, [board?.bg, board?.pack]);
```

- [ ] **Step 3: Nút mở panel + `DockPanel`**

Thêm nút thứ tư vào `.fb-tabs` sau **Bảng màu** (`togglePanel("theme")`), và một `DockPanel title={t`Giao diện`}` cạnh panel Bảng màu. Nhớ thêm `theme` vào state `panels` và `layouts` đúng cách ba panel kia đang làm.

Nội dung panel: hàng nền (nút "theo giao diện" + 5 swatch preset, mỗi nút mang `data-bg` để CSS tự tô), hàng bộ màu (4 nút chữ). Cả hai hàng mang `data-mutating`.

Đặt màu: `commitAndSave({ ...board, bg: next })` — đi qua đúng đường lưu + realtime + hoàn tác như mọi thay đổi board khác.

- [ ] **Step 4: CSS cho swatch nền**

```css
/* Nút swatch tự tô bằng chính preset nó đại diện — không lặp lại hex trong JS. */
.bg-swatch { width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--line); cursor: pointer; }
.bg-swatch[data-bg="paper"] { background: #E6E0CC; }
/* … bốn cái còn lại; bản dark ở khối [data-theme="dark"] */
.bg-swatch.on { outline: 2px solid var(--accent); outline-offset: 1px; }
```

- [ ] **Step 5: Kiểm tay + commit**

Hai tab cùng board: tab A đổi nền → tab B đổi theo trong ~1 giây. Rời sang `/idea-map` → nền trở lại bình thường.

```bash
git add game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css
git commit -m "feat: panel Giao diện — chọn nền bảng và bộ màu"
```

---

- [ ] ## Task 5: Thẻ và khung tô nền theo màu

**Files:**
- Modify: `game-tools/client/src/components/IdeaCard.jsx`
- Modify: `game-tools/client/src/components/FrameBox.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes: `colorVar` từ `lib/badges.js`.
- Produces: class `tinted` + biến inline `--tint` trên `.idea-card` và `.frame-box`.

- [ ] **Step 1: `IdeaCard` — bỏ vạch trái, đổi sang nền**

Thay `...(node.color ? { borderLeftColor: colorVar(node.color), borderLeftWidth: 4 } : {})` bằng `...(node.color ? { "--tint": colorVar(node.color) } : {})`, và đẩy `"tinted"` vào `classNames` khi có `node.color`. Làm ở **cả hai** nhánh render (đang sửa và không sửa) để thẻ không đổi màu lúc bấm sửa.

- [ ] **Step 2: `FrameBox` — như trên**

Thay `borderColor: group.color ? colorVar(group.color) : undefined` bằng `--tint` + class `tinted`.

- [ ] **Step 3: CSS**

```css
/* Màu thẻ tô NỀN chứ không còn là vạch viền trái. Trộn với --surface-2 bằng
   color-mix nên MỘT token màu tự cho ra hai kết quả đúng ở hai theme — không
   phải nuôi bảng màu riêng cho nền tối. 14% đủ nhận ra màu mà chữ --ink vẫn
   thừa tương phản, nên không cần tính độ sáng như contrastInk() phải làm cho
   badge (badge tô ĐẶC nên mới cần). */
.idea-card.tinted {
  background: color-mix(in srgb, var(--tint) 14%, var(--surface-2));
  border-color: color-mix(in srgb, var(--tint) 55%, var(--line));
}
/* Khung nhạt hơn: nó to và nằm dưới thẻ, 14% thì cả vùng lớn bị nhuộm nặng. */
.frame-box.tinted {
  background: color-mix(in srgb, var(--tint) 7%, transparent);
  border-color: color-mix(in srgb, var(--tint) 60%, var(--line));
}
```

Soát lại luật `.idea-card:hover` và `.idea-card.selected` — chúng đổi `border-color`, phải kiểm thẻ có màu lúc hover/chọn vẫn đọc ra được là đang được chọn.

- [ ] **Step 4: Kiểm + commit**

Thẻ có màu ở cả hai theme; thẻ trong khung có màu; thẻ có màu + đang chọn + đang hover.

```bash
git add game-tools/client/src/components/IdeaCard.jsx game-tools/client/src/components/FrameBox.jsx \
        game-tools/client/src/styles/idea-map.css
git commit -m "feat: màu thẻ và khung tô nền thay cho vạch viền"
```

---

- [ ] ## Task 6: `lib/sketchy.js` — sinh nét rung

**Files:**
- Create: `game-tools/client/src/lib/sketchy.js`
- Create: `game-tools/client/src/lib/sketchy.test.js`

**Interfaces:**
- Consumes: `shapeOutline` từ `lib/shape.js` (chiều import một phía `sketchy.js → shape.js`, không có vòng).
- Produces:
  - `seedFrom(value: number|string) -> number`
  - `amplitude(len: number) -> number`
  - `sketchyLine(x1, y1, x2, y2, seed, opts?) -> string`
  - `sketchyPath(kind: string, pts: number[], seed: number) -> string`

- [ ] **Step 1: Viết test thất bại**

`game-tools/client/src/lib/sketchy.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFrom, amplitude, sketchyLine, sketchyPath } from "./sketchy.js";

// Đây là test QUAN TRỌNG NHẤT của module. Nếu nó đỏ thì mỗi khung hình nét lại
// rung một kiểu: kéo một thẻ là cả bản đồ giật.
test("cùng seed ra cùng chuỗi, khác seed ra khác chuỗi", () => {
  const a = sketchyLine(0, 0, 100, 40, seedFrom(7));
  assert.equal(sketchyLine(0, 0, 100, 40, seedFrom(7)), a);
  assert.notEqual(sketchyLine(0, 0, 100, 40, seedFrom(8)), a);
});

test("seedFrom nhận cả số lẫn chuỗi, luôn ra số nguyên không âm", () => {
  for (const v of [1, 999, "e12", "node:3"]) {
    const s = seedFrom(v);
    assert.equal(Number.isInteger(s), true);
    assert.equal(s >= 0, true);
  }
});

test("đoạn dài 0 trả chuỗi rỗng, không NaN", () => {
  assert.equal(sketchyLine(10, 10, 10, 10, 1), "");
  assert.equal(/NaN/.test(sketchyLine(0, 0, 300, 0, 5)), false);
});

test("biên độ có trần: dây rất dài không uốn thành con rắn", () => {
  assert.equal(amplitude(0), 0.6);
  assert.equal(amplitude(5000), 4);
  assert.equal(amplitude(100), 2);
});

// Nét vẽ hai lần chồng nhau, nhưng nằm trong MỘT chuỗi d (hai đoạn con "M"),
// không phải hai thẻ <path>.
test("mặc định hai lượt trong một chuỗi d", () => {
  const d = sketchyLine(0, 0, 100, 0, 3);
  assert.equal(d.split("M").length - 1, 2);
});

test("sketchyPath: sáu kind đều ra chuỗi d không rỗng, không NaN", () => {
  for (const k of ["rect", "ellipse", "line", "arrow", "triangle", "diamond"]) {
    const d = sketchyPath(k, [10, 20, 110, 90], seedFrom(k));
    assert.ok(d.length > 0, k);
    assert.equal(/NaN|undefined/.test(d), false, k);
  }
});

test("sketchyPath: kind lạ hoặc pts thiếu → chuỗi rỗng, cùng cách shapePath", () => {
  assert.equal(sketchyPath("star", [0, 0, 10, 10], 1), "");
  assert.equal(sketchyPath("rect", [0, 0], 1), "");
});
```

- [ ] **Step 2: Viết `sketchy.js` cho test xanh**

```js
// Sinh path "vẽ tay" cho SVG. Nó KHÔNG động tới hình học thật: hit-test, cắt
// dây vào biên thẻ và cục gôm vẫn chạy trên đường thẳng như cũ. Rung chỉ là
// chuyện hiển thị — bắt trượt nửa pixel còn hơn viết lại hit-test cho một hình
// đang rung.
import { shapeOutline } from "./shape.js";

// mulberry32 — PRNG 32 bit gieo được. TUYỆT ĐỐI không dùng Math.random(): độ
// lệch phải là hàm của id, không phải của thời điểm render.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(value) {          // FNV-1a
  const s = String(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const MIN_AMP = 0.6, MAX_AMP = 4, AMP_RATIO = 0.02;
export function amplitude(len) {
  return Math.min(MAX_AMP, Math.max(MIN_AMP, len * AMP_RATIO));
}

const r1 = (v) => Math.round(v * 10) / 10;
```

Hàm lõi `wobble(x1, y1, x2, y2, rand, amp)` trả một đoạn `"M… C…"`:

- vector đơn vị vuông góc `(nx, ny) = (-dy/len, dx/len)`;
- hai điểm điều khiển ở 1/3 và 2/3 đoạn, lệch `(rand()*2-1) * amp` theo phương vuông góc;
- **hai đầu chỉ lệch 0.4 lần biên độ** — dây phải còn dính vào mép thẻ, lệch nhiều là nhìn ra ngay chỗ hở;
- độ lệch **chỉ phụ thuộc `rand` và `amp`**, không phụ thuộc toạ độ tuyệt đối, nhờ vậy kéo thẻ thì dây uốn theo mượt thay vì nhảy hình.

`sketchyLine` gọi `wobble` hai lượt bằng **cùng một** `rand` (lượt hai lấy tiếp dãy số nên lệch khác lượt một) rồi nối bằng dấu cách.

`sketchyPath(kind, pts, seed)`:

- `pts` không đủ 4 số hoặc `kind` lạ → `""` (giống hệt `shapePath`);
- `rect`, `triangle`, `diamond`: lấy `shapeOutline()` rồi `wobble` từng đoạn, hai lượt;
- `line`: `sketchyLine` hai đầu;
- `arrow`: thân như `line`, cộng hai gạch đầu mũi tên tính đúng công thức của `shapePath` (`head = clamp(len*0.25, 6, 18)`, `wing = 0.44`), mỗi gạch cũng `wobble` một lượt;
- `ellipse`: lấy 16 mẫu quanh tâm, **nhiễu bán kính** `1 + (rand()*2-1) * amp / max(rx, ry)` cho từng mẫu, rồi nối bằng chuỗi `Q` qua trung điểm (làm trơn) và đóng `Z`. Không dùng `wobble` từng đoạn cho ê-líp: 32 đoạn cong nhỏ mỗi đoạn một bezier trông như răng cưa chứ không như nét bút.

- [ ] **Step 3: Test xanh**

```bash
cd game-tools/client && npm test
```

- [ ] **Step 4: Commit**

```bash
git add game-tools/client/src/lib/sketchy.js game-tools/client/src/lib/sketchy.test.js
git commit -m "feat: lib/sketchy.js sinh nét rung có seed cố định"
```

---

- [ ] ## Task 7: Skin vẽ tay — trục `data-skin`, font, viền méo

**Files:**
- Create: `game-tools/client/src/lib/useSkin.js`
- Create: `game-tools/client/src/styles/sketch-fonts.js`
- Modify: `game-tools/client/src/main.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/components/IdeaCard.jsx`
- Modify: `game-tools/client/src/components/FrameBox.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`
- Modify: `game-tools/client/package.json`

**Interfaces:**
- Consumes: token của Task 1.
- Produces: `useSkin() -> { skin, toggle }`; `data-skin` trên `documentElement`; `data-wob` trên thẻ và khung.

- [ ] **Step 1: Cài font**

```bash
cd game-tools/client && npm i @fontsource/shantell-sans
```

**Không đổi sang font khác nếu chưa kiểm subset.** Đã tải về kiểm: Excalifont/Virgil (font của Excalidraw), Caveat, Architects Daughter, Kalam, Indie Flower, Gochi Hand, Nanum Pen **đều không có subset `vietnamese`**. Chỉ Shantell Sans (300–800 + italic) và Patrick Hand (một cân nặng 400) có. Chọn Shantell Sans vì tiêu đề thẻ cần đậm hơn mô tả.

`styles/sketch-fonts.js` chỉ gồm:

```js
// Nạp lười — chỉ chạy khi người dùng bật skin vẽ tay lần đầu, nên ai không
// dùng thì bundle không đổi một byte. Chỉ hai subset và hai cân nặng: latin cho
// chữ thường, vietnamese cho dấu (thiếu nó là "ưỡng" rơi về font dự phòng và
// một chữ trong câu trông khác hẳn phần còn lại).
import "@fontsource/shantell-sans/latin-400.css";
import "@fontsource/shantell-sans/latin-600.css";
import "@fontsource/shantell-sans/vietnamese-400.css";
import "@fontsource/shantell-sans/vietnamese-600.css";
```

- [ ] **Step 2: `lib/useSkin.js`**

Bản sao `useTheme.js` với ba khác biệt: khoá lưu là `skin-pref`, thuộc tính là `data-skin`, và nhánh bật `sketch` `await import("../styles/sketch-fonts.js")` trước khi đặt thuộc tính (để chữ không nhấp nháy đổi font hai lần). Mặc định `"clean"`.

`main.jsx`: đọc `localStorage["skin-pref"]` đặt `data-skin` **trước khi render** — cùng chỗ và cùng lý do với `theme-pref` đang làm, tránh một khung hình sai skin.

- [ ] **Step 3: Nút bật trong `.topbar-prefs`**

Ngay sau nút `◐`, một nút `.btn.ghost.icon` mang `title={t\`Đổi kiểu giao diện: sạch / vẽ tay\`}`, icon inline SVG (nét bút lượn) theo `currentColor` như `ToolRail.jsx` đang làm. **Không** gắn `data-mutating`: skin là thiết lập cá nhân, tài khoản chỉ xem vẫn được đổi.

- [ ] **Step 4: `data-wob` trên thẻ và khung**

`IdeaCard`: `data-wob={node.id % 4}`. `FrameBox`: `data-wob={group.id % 4}`. Dùng `id` chứ không dùng chỉ số trong mảng — chỉ số đổi khi xoá thẻ khác, thẻ sẽ đột nhiên méo kiểu khác.

- [ ] **Step 5: Khối CSS của skin**

Cuối `idea-map.css`, một khối liền mạch có tiêu đề rõ:

```css
/* ─── Skin vẽ tay ─────────────────────────────────────────────────────────
   CHỈ áp cho vật thể trên canvas. Topbar, filterbar, ToolRail, popover giữ
   nguyên giao diện sạch — chữ nút ở cỡ 10–11px mà viết tay thì không đọc được.
   Excalidraw cũng làm đúng vậy: canvas vẽ tay, panel bên trái là UI thường. */
:root[data-skin="sketch"] {
  --card-radius: 0;              /* border-radius thật do bốn biến thể data-wob lo */
  --card-border-w: 1.6px;
  --frame-border-w: 2.4px;
  --edge-w: 2px;
  --edge-w-hot: 3px;
  --canvas-font: "Shantell Sans", "Comic Sans MS", cursive;
  --canvas-font-scale: 1.08;     /* chiều cao chữ x nhỏ hơn IBM Plex Sans */
}

/* Bốn biến thể méo, chọn theo id % 4 nên hai thẻ cạnh nhau không giống hệt
   nhau mà MỘT thẻ thì méo cố định — kéo đi kéo lại không đổi hình.
   255px trên một thẻ rộng 210px nghe vô lý nhưng đúng: khi tổng bán kính hai
   góc vượt cạnh, trình duyệt chia đều MỌI bán kính cho cùng một hệ số, nên tỉ
   lệ méo giữ nguyên ở mọi kích thước thẻ. Đó là lý do mẹo này chạy được mà
   không cần biết thẻ to bao nhiêu. */
:root[data-skin="sketch"] .idea-card[data-wob="0"],
:root[data-skin="sketch"] .frame-box[data-wob="0"] {
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
}
/* …ba biến thể còn lại, hoán vị bốn con số */
```

Cộng thêm trong khối: cỡ chữ thẻ nhân `--canvas-font-scale`, bóng đổ nhạt và lệch nhẹ, lưới chấm mờ đi (`--board-grid` giảm độ đặc).

- [ ] **Step 6: Kiểm bốn tổ hợp + commit**

sạch/sáng, sạch/tối, vẽ tay/sáng, vẽ tay/tối. Gõ `ưỡng ệ ỗ ặ ữ` vào tiêu đề một thẻ, kiểm không có chữ nào rơi về font dự phòng (DevTools → Computed → Rendered Fonts).

```bash
git add game-tools/client/package.json game-tools/client/package-lock.json \
        game-tools/client/src/lib/useSkin.js game-tools/client/src/styles/sketch-fonts.js \
        game-tools/client/src/main.jsx game-tools/client/src/pages/IdeaMap.jsx \
        game-tools/client/src/components/IdeaCard.jsx game-tools/client/src/components/FrameBox.jsx \
        game-tools/client/src/styles/idea-map.css
git commit -m "feat: skin vẽ tay — font viết tay và viền méo cho thẻ, khung"
```

---

- [ ] ## Task 8: Dây nối và hình khối dùng nét rung

**Files:**
- Modify: `game-tools/client/src/components/EdgeLayer.jsx`
- Modify: `game-tools/client/src/components/InkLayer.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Consumes: `sketchyLine`, `sketchyPath`, `seedFrom` từ `lib/sketchy.js`; `skin` từ `useSkin`.
- Produces: prop `sketch: boolean` cho `EdgeLayer` và `InkLayer`.

- [ ] **Step 1: Truyền `sketch` xuống hai lớp**

`IdeaMap` lấy `skin` từ `useSkin()` và truyền `sketch={skin === "sketch"}`. Hai component bọc `memo()` nên **phải nhận qua prop** — đọc `getComputedStyle` trong render thì memo không thấy skin đổi và bảng đứng im cho tới lần render sau.

- [ ] **Step 2: `EdgeLayer`**

Thẻ `<line className="visible">` → `<path>` khi `sketch`, `d={sketchyLine(p1.x, p1.y, p2.x, p2.y, seedFrom(edge.id))}`. Ba thứ **giữ nguyên**:

- `<line className="hit">` — vùng bấm 16px không việc gì phải rung theo;
- `markerEnd`, `strokeDasharray`, `style` màu — chép sang `<path>` y nguyên;
- dây nháp (`.draft`) và đường gióng (`.snap-guide`) — chúng là phản hồi lúc thao tác, rung chỉ làm khó ngắm.

`<path>` phải có `fill="none"` — CSS của `.edge-layer` chưa khai `fill` cho `path` bao giờ, thiếu attribute này là dây thành một mảng đen đặc.

- [ ] **Step 3: `InkLayer`**

Trong `Stroke`, khi `sketch` và `kind` khác `"pen"`: `d = sketchyPath(kind, pts, seedFrom(id))`. Nét bút không đụng — nó vốn đã là nét tay thật.

`Stroke` cần thêm prop `id` (hiện chỉ nhận `kind, color, w, pts, fill, erasing`). Nét đang kéo (`draft`) và nét người khác đang vẽ (`liveStrokes`) chưa có id → dùng seed cố định `0`; chúng chỉ sống vài giây.

Hình **tô đặc** (`fill`) ở skin sketch: giữ nguyên `fill={penVar(color)}` — path rung vẫn là đường khép kín nên tô được bình thường.

- [ ] **Step 4: Kiểm mượt + commit**

Kéo một thẻ có 5 dây ở skin sketch: dây phải uốn theo **mượt, không giật**. Nếu giật thì độ lệch đang phụ thuộc toạ độ — sai ràng buộc số 2 của `sketchy.js`, quay lại Task 6.

Board ~200 thẻ ở skin sketch: lia và thu phóng vẫn mượt.

```bash
git add game-tools/client/src/components/EdgeLayer.jsx game-tools/client/src/components/InkLayer.jsx \
        game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: dây nối và hình khối vẽ bằng nét rung ở skin vẽ tay"
```

---

- [ ] ## Task 9: Smoke test, i18n, dọn

**Files:**
- Modify: `game-tools/client/src/__smoke__/entry.jsx`
- Modify: `game-tools/client/src/locales/en/messages.po`

- [ ] **Step 1: Smoke test cho skin**

Trong `entry.jsx`, sau các bước hiện có: đặt `document.documentElement.setAttribute("data-skin", "sketch")`, `act` một nhịp, rồi kiểm bảng vẫn dựng được — số `.idea-card` không đổi và `.edge-layer path.visible` (hoặc `.visible`) vẫn còn đúng số dây. Đây là lưới an toàn cho lỗi "đổi `<line>` thành `<path>` làm sập lớp dây".

- [ ] **Step 2: i18n**

```bash
cd game-tools/client && npm run i18n:extract
```

Dịch các chuỗi mới sang tiếng Anh trong `locales/en/messages.po`: tên panel, tên 6 nền, tên 4 bộ màu, title nút skin.

- [ ] **Step 3: Chạy đủ bộ kiểm**

```bash
cd game-tools/client && npm test && npm run test:smoke && npm run build
cd ../server && node --check index.js && node --check boards.js
```

- [ ] **Step 4: Commit**

```bash
git add game-tools/client/src/__smoke__/entry.jsx game-tools/client/src/locales
git commit -m "test: smoke test cho skin vẽ tay, dịch chuỗi giao diện mới"
```

---

## Kiểm tay còn lại (không tự động hoá được)

Sau khi chín task xong, mở app thật — mục **Kiểm thử** của spec ghi đầy đủ hơn:

- **Bốn tổ hợp** skin × theme, mỗi cái xem đủ: thẻ có màu, thẻ không màu, khung, dây, sáu hình khối, nét bút, ảnh trong thẻ.
- Hai tab cùng board: đổi nền và bộ màu ở tab A → tab B đổi theo.
- Chữ tiếng Việt có dấu ở skin sketch — kiểm bằng Rendered Fonts, không đoán bằng mắt.
- Kéo thẻ có nhiều dây ở skin sketch: uốn mượt, không giật.
- Board ~200 thẻ ở skin sketch: lia, thu phóng vẫn mượt.
- Xuất PNG khi board đặt nền `slate`: ảnh ra đúng nền. **PNG export không vẽ nét rung** — hạn chế đã biết, không báo là lỗi.
- Tài khoản chỉ xem: hai control trong panel Giao diện mờ, nút skin ở topbar vẫn bấm được.
- Rời `/idea-map/:boardId` sang danh sách board: nền và bộ màu không dính lại.
- Board cũ trong DB (không có `bg`/`pack`): mở lên chạy đúng như trước, không lỗi console.

## Kết quả

*(Điền khi cả chín task đã tick: link tới `../summaries/2026-07-28-idea-map-theme-sketch-summary.md`)*
