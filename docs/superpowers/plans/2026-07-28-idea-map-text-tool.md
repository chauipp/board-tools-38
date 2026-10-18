# Tool text — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tool **Text** vào khu 2 của thanh công cụ trái: bấm lên bảng là gõ chữ được ngay tại chỗ, ba cỡ và bảy màu dùng chung với bút, sửa lại bằng bấm đúp, kéo di chuyển được, xoá bằng cục gôm, hoàn tác được, đồng bộ realtime.

**Architecture:** Text **không có kiểu dữ liệu riêng** — nó là một phần tử `board.drawings` với `kind: "text"`, `pts` chỉ 2 số (điểm neo), cộng `text` / `size` / `w` / `h`. Nhờ vậy `commitStroke`, `commitErase`, hoàn tác, bốn chỗ liệt kê field ở server và kênh `board:update` không phải sửa dòng nào. Một module thuần mới `lib/text-el.js` gánh cỡ chữ, tách dòng, đo hộp (nhận hàm đo bề rộng qua tham số nên test được bằng `node:test`) và hit-test. Ô nhập là `<textarea>` HTML đặt chồng lên canvas, dựng để trùng khít với chữ sẽ vẽ ra.

**Tech Stack:** React 18, Vite 6, socket.io 4, Express + Mongoose (server), `@lingui/react/macro` cho i18n, `node:test` + `node:assert/strict` cho unit test, `npm run test:smoke` (jsdom) cho test ghép nối.

**Spec:** [`docs/superpowers/specs/2026-07-28-idea-map-text-tool-design.md`](../specs/2026-07-28-idea-map-text-tool-design.md)

## Global Constraints

- Thư mục làm việc của mọi lệnh `npm`: `game-tools/client`. Đường dẫn file tính từ gốc repo.
- Unit test dùng `node:test` + `node:assert/strict`, **không** vitest. `npm test` chỉ nhặt file trong `src/lib/`.
- Mọi chuỗi hiện cho người dùng đi qua `@lingui/react/macro`. Ngôn ngữ nguồn là **tiếng Việt**.
- **Không sửa `server/`.** Text đi trọn vẹn qua đường của `drawings` đã có; nếu thấy mình đang mở `server/boards.js` thì đã đi sai hướng.
- Giá trị `tool` sau đợt này: `"pen"` | `"eraser"` | `"shape"` | `"text"`. Giá trị `kind` hợp lệ trong `drawings`: bảy cũ cộng `"text"`.
- `"text"` **không được** thêm vào `SHAPE_KINDS`: mảng đó là danh sách hình vẽ ra bảng chọn ở khu 4 và đi qua `shapePath` / `shapeOutline`, text không thuộc về đó. `drawingsHitBy` xử lý `"text"` bằng một nhánh riêng.
- Toạ độ là **số nguyên**, đơn vị toạ độ canvas.
- Không dùng `sketchy.js` cho text.
- Commit sau mỗi task. Thông điệp commit tiếng Việt, tiền tố `feat:` / `test:` / `refactor:`.

---

- [x] ## Task 1: `lib/text-el.js` — cỡ chữ, tách dòng, đo hộp, hit-test

**Files:**
- Create: `game-tools/client/src/lib/text-el.js`
- Create: `game-tools/client/src/lib/text-el.test.js`

**Interfaces:**
- Consumes: không gì.
- Produces:
  - `TEXT_SIZES: number[]` — `[14, 20, 30]`
  - `TEXT_LINE_H: number` — `1.3`
  - `textLines(text: string) -> string[]`
  - `textBox(lines: string[], size: number, measureWidth: (line: string, size: number) => number) -> { w: number, h: number }`
  - `textHitBy(el, point: {x,y}, radius: number) -> boolean`

- [ ] **Step 1: Viết test thất bại**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXT_SIZES, TEXT_LINE_H, textLines, textBox, textHitBy } from "./text-el.js";

// Hàm đo giả: mỗi ký tự rộng đúng 0.5 lần cỡ chữ. Nhờ tiêm hàm đo mà test không
// phụ thuộc font cài trên máy chạy test.
const fakeMeasure = (line, size) => line.length * size * 0.5;

test("ba cỡ, tăng dần", () => {
  assert.deepEqual(TEXT_SIZES, [14, 20, 30]);
});

test("tách dòng: chịu cả \\r\\n, giữ dòng trống ở giữa", () => {
  assert.deepEqual(textLines("a\nb"), ["a", "b"]);
  assert.deepEqual(textLines("a\r\nb"), ["a", "b"]);
  assert.deepEqual(textLines("a\n\nb"), ["a", "", "b"]);
  assert.deepEqual(textLines(""), [""]);
});

test("hộp: rộng theo dòng DÀI NHẤT, cao theo số dòng", () => {
  const box = textBox(["abc", "abcdef"], 20, fakeMeasure);
  assert.equal(box.w, 60);                        // 6 ký tự × 20 × 0.5
  assert.equal(box.h, Math.round(2 * 20 * TEXT_LINE_H));
});

// Một dòng trống vẫn chiếm chiều cao — nếu không thì gõ Enter hai lần rồi xoá
// hết chữ ở dòng cuối, hộp co lại và cục gôm hụt.
test("dòng trống vẫn tính chiều cao", () => {
  assert.equal(textBox(["a", ""], 20, fakeMeasure).h, textBox(["a", "b"], 20, fakeMeasure).h);
});

test("hộp không bao giờ rộng 0 — text rỗng vẫn phải bấm trúng được", () => {
  assert.ok(textBox([""], 14, fakeMeasure).w > 0);
});

test("hit-test: trong hộp trúng, ngoài hộp trượt", () => {
  const el = { pts: [100, 50], w: 60, h: 26 };
  assert.equal(textHitBy(el, { x: 110, y: 60 }, 0), true);
  assert.equal(textHitBy(el, { x: 300, y: 60 }, 0), false);
  assert.equal(textHitBy(el, { x: 110, y: 200 }, 0), false);
});

// Bán kính gôm nới hộp ra mọi phía: quét sát mép chữ vẫn phải ăn.
test("hit-test: bán kính nới hộp ra", () => {
  const el = { pts: [100, 50], w: 60, h: 26 };
  assert.equal(textHitBy(el, { x: 95, y: 60 }, 0), false);
  assert.equal(textHitBy(el, { x: 95, y: 60 }, 8), true);
});

test("hit-test: phần tử thiếu w/h thì trượt, không nổ", () => {
  assert.equal(textHitBy({ pts: [0, 0] }, { x: 0, y: 0 }, 5), false);
  assert.equal(textHitBy({}, { x: 0, y: 0 }, 5), false);
});
```

- [ ] **Step 2: Viết `text-el.js` cho test xanh**

Ghi chú bắt buộc trong file: vì sao `measureWidth` là tham số chứ không gọi
thẳng canvas (đo chữ cần DOM, mà module này phải chạy được trong `node:test`),
và vì sao `w`/`h` được lưu kèm phần tử thay vì đo lại lúc hit-test.

- [ ] **Step 3: Test xanh + commit**

```bash
cd game-tools/client && npm test
git add game-tools/client/src/lib/text-el.js game-tools/client/src/lib/text-el.test.js
git commit -m "feat: lib/text-el.js — cỡ chữ, tách dòng, đo hộp, hit-test cho text"
```

---

- [x] ## Task 2: Cục gôm ăn được text

**Files:**
- Modify: `game-tools/client/src/lib/shape.js`
- Modify: `game-tools/client/src/lib/shape.test.js`

**Interfaces:**
- Consumes: `textHitBy` từ `lib/text-el.js`.
- Produces: `drawingsHitBy` nhận thêm `kind: "text"`.

- [ ] **Step 1: Test thất bại trong `shape.test.js`**

Thêm ba test: quét trúng một text; quét trượt; và **một test canh gác** — cùng
một danh sách gồm cả `pen`, cả sáu hình khối, cả `text` thì mỗi thứ vẫn được bắt
đúng như trước. Test cuối là thứ bắt được lỗi "thêm nhánh mới làm hỏng nhánh cũ".

- [ ] **Step 2: Thêm nhánh trong `drawingsHitBy`**

Ngay sau nhánh `pen`, trước nhánh `shapeOutline`:

```js
if (kind === "text") {
  if (textHitBy(d, point, radius)) out.push(d.id);
  continue;
}
```

Lưu ý: nhánh này **không** cộng `d.w / 2` như nét bút và hình khối — với text,
`w` là bề rộng hộp chứ không phải độ dày nét. Đây đúng là chỗ dễ sai nhất của
việc dùng chung một mảng `drawings` cho hai loại vật thể khác nhau; phải có ghi
chú tại chỗ.

Kiểm chiều import: `shape.js → text-el.js`, và `text-el.js` không import gì —
không có vòng.

- [ ] **Step 3: Test xanh + commit**

```bash
git add game-tools/client/src/lib/shape.js game-tools/client/src/lib/shape.test.js
git commit -m "feat: cục gôm quét được text"
```

---

- [x] ## Task 3: Cỡ chữ vào `penPrefs`

**Files:**
- Modify: `game-tools/client/src/lib/pen.js`
- Modify: `game-tools/client/src/lib/pen.test.js`

- [ ] **Step 1: Test thất bại**

`PEN_DEFAULT.size === 20`; `size` lạ (`999`, `"20"`, `null`) lùi về `20` **mà
không** kéo theo `color` / `w` / `kind` / `fill`; `savePenPrefs` ghi cả `size`.

- [ ] **Step 2: Sửa `pen.js`**

Thêm `size` vào `PEN_DEFAULT`, vào bộ lọc từng khoá của `loadPenPrefs`
(`TEXT_SIZES.includes(saved.size) ? … : …`), và vào `savePenPrefs`. Import
`TEXT_SIZES` từ `text-el.js` — chiều `pen.js → text-el.js` không tạo vòng
(`pen.js` vốn đã import `shape.js`).

- [ ] **Step 3: Test xanh + commit**

```bash
git add game-tools/client/src/lib/pen.js game-tools/client/src/lib/pen.test.js
git commit -m "feat: cỡ chữ lưu cùng lựa chọn bút"
```

---

- [x] ## Task 4: Nút Text ở khu 2, cỡ + màu ở khu 4

**Files:**
- Modify: `game-tools/client/src/components/ToolRail.jsx`
- Modify: `game-tools/client/src/components/ToolOptions.jsx`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

- [ ] **Step 1: `ToolRail` — nút thứ tư ở khu 2**

`IconText`: chữ "T" vẽ bằng `path` theo `currentColor` (không dùng ký tự thật —
ký tự sẽ đổi hình theo font, kể cả font viết tay của skin). Title
`` t`Text (T)` ``, `disabled={!canEdit}`.

- [ ] **Step 2: `ToolOptions` — nhánh `tool === "text"`**

Điều kiện thoát sớm hiện là `if (tool !== "pen" && tool !== "shape") return null;`
— phải nới cho `"text"`. Khu 4 khi cầm Text: ba nút cỡ (chữ "A" ba kích thước
khác nhau) + bảy màu bút dùng lại y nguyên. **Không** hiện độ dày nét và bảng
sáu hình.

- [ ] **Step 3: Phím tắt `t` trong `IdeaMap.jsx`**

```js
else if (key === "t") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("text"); }
```

Đặt ngay sau nhánh `"s"`. Đã kiểm `t` chưa bị chiếm.

- [ ] **Step 4: CSS cho nút cỡ chữ + build + commit**

```bash
cd game-tools/client && npm run build && npm run test:smoke
git add game-tools/client/src
git commit -m "feat: nút Text ở khu 2, chọn cỡ và màu ở khu 4"
```

---

- [x] ## Task 5: Tạo và sửa text tại chỗ

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/lib/useInk.js`
- Modify: `game-tools/client/src/components/InkLayer.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Produces: state `textEdit` (`{ id: number|null, x, y, value, size, color }`), hàm `commitText`.

- [ ] **Step 1: `useInk` không nuốt tool `text`**

`handleMouseDown` hiện chia ba nhánh và nhánh cuối (`else`) là bút — nghĩa là
tool lạ sẽ **vẽ ra một nét bút**. Chặn ngay đầu hàm:

```js
// Tool text không đi qua đây: nó không có lượt kéo nào để theo dõi, ô nhập do
// IdeaMap dựng. Không có chốt này thì nhánh `else` cuối hàm coi nó là bút.
if (tool === "text") return;
```

- [ ] **Step 2: Mở ô nhập**

Trong `IdeaMap`, handler mousedown của lớp `.ink-capture` khi `tool === "text"`:
đổi toạ độ chuột sang toạ độ canvas rồi `setTextEdit({ id: null, x, y, value: "", size: penPrefs.size, color: penPrefs.color })`.

Bấm đúp lên một text đã có → `setTextEdit({ id, ...el })`. Tra phần tử bằng
`drawingsHitBy` với bán kính 0.

- [ ] **Step 3: Ô nhập trùng khít**

`<textarea>` đặt trong lớp canvas đã biến đổi (cùng chỗ với thẻ), hoặc đặt ngoài
với toạ độ nhân `scale` — chọn một và ghi rõ lý do. Bắt buộc:
`padding: 0; border: 0; outline: none; background: transparent; resize: none; overflow: hidden;`
`font-family: var(--canvas-font); font-size: <size>px; line-height: 1.3;`
`color: var(--pen-…)`. Tự cao theo nội dung (`rows` theo số dòng, hoặc đặt
`height` theo `scrollHeight`).

`autoFocus`. `Escape` → kết thúc (và `stopPropagation` để không rơi vào nhánh
`escape` chung của bảng). `blur` → kết thúc. **`Enter` xuống dòng**, không kết thúc.

- [ ] **Step 4: `commitText`**

Cùng kỷ luật refs-only như `commitStroke` (đọc `boardRef.current`, tự gọi
`recordHistory` + `setBoard` + lưu, **không** dùng `commitAndSave`) — người khác
có thể gửi `board:update` về trong lúc mình đang gõ.

Ba đường:
- `id == null` + chuỗi có nội dung → thêm phần tử mới, `nextDrawingId + 1`.
- `id != null` + chuỗi có nội dung → thay phần tử đó (giữ nguyên `id`).
- chuỗi rỗng sau khi `.trim()` → tạo mới thì **không làm gì**; sửa thì **xoá** phần tử.

Đo `w`/`h` bằng `textBox(textLines(value), size, measure)` với `measure` dựng từ
`canvas.getContext("2d")` và đúng chuỗi font đang hiển thị (đọc `--canvas-font`
qua `getComputedStyle`) — cùng cách `png-export.js` đang làm.

- [ ] **Step 5: Vẽ text trong `InkLayer`**

Trong `Stroke`, nhánh `kind === "text"` trả `<text>` với một `<tspan>` mỗi dòng
(`x` lặp lại, `dy` = `size * 1.3`, dòng đầu `dy = size`), `fill={penVar(color)}`,
`fontSize={size}`. Không có `stroke`.

Phần tử đang được sửa phải **ẩn** khỏi `InkLayer` (`textEdit.id === d.id`), không
thì chữ cũ nằm chồng dưới ô nhập.

CSS: `.ink-layer text { font-family: var(--canvas-font); white-space: pre; }` —
một dòng này là toàn bộ phần "skin cho text".

- [ ] **Step 6: Kiểm tay + commit**

Gõ tiếng Việt có dấu ở cả hai skin; zoom 50% / 200% rồi gõ, ô nhập phải trùng
khít; ba dòng thì cục gôm ăn cả ba; bấm rồi Escape ngay thì không tạo gì.

```bash
git add game-tools/client/src
git commit -m "feat: gõ text thẳng lên bảng, bấm đúp để sửa"
```

---

- [x] ## Task 6: Kéo di chuyển text

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`

- [ ] **Step 1: Lượt kéo**

Đang cầm tool Text, mousedown trúng một text (tra bằng `drawingsHitBy` bán kính
0) → bắt đầu lượt kéo: nghe `mousemove` / `mouseup` trên `window`, cập nhật một
state nháp `textDrag` (KHÔNG ghi vào `board` ở mỗi nhịp — một lần kéo là một lần
lưu, không phải trăm lần).

Ngưỡng 3 đơn vị canvas: di dưới ngưỡng thì coi như không kéo, để cú bấm còn rơi
vào việc mở ô nhập.

- [ ] **Step 2: Chốt lúc nhả**

`mouseup` → cập nhật `pts` của phần tử, `recordHistory` + lưu **một** lần. Dọn
listener trong cả nhánh `mouseup` lẫn `blur` — cùng cái bẫy `useInk.js` đã có
ghi chú dài.

- [ ] **Step 3: Kiểm tay + commit**

Kéo một text ba dòng, tải lại trang, kiểm đúng chỗ mới. Hoàn tác trả về chỗ cũ.

```bash
git add game-tools/client/src/pages/IdeaMap.jsx
git commit -m "feat: kéo di chuyển text trên bảng"
```

---

- [x] ## Task 7: Smoke test, i18n, summary

**Files:**
- Modify: `game-tools/client/src/__smoke__/entry.jsx`
- Modify: `game-tools/client/src/locales/en/messages.po`
- Create: `docs/superpowers/summaries/2026-07-28-idea-map-text-tool-summary.md`

- [ ] **Step 1: Smoke test**

Bấm nút Text ở khu 2 → bấm lên bảng → gõ vào `<textarea>` → `Escape`. Kiểm:
`.ink-layer text` có đúng 1, board có thêm một `drawings` `kind: "text"`, và PUT
tăng đúng 1 lần. Rồi bấm-Escape-không-gõ-gì và kiểm **không** có PUT nào thêm.

- [ ] **Step 2: i18n**

```bash
cd game-tools/client && npm run i18n:extract
```
Dịch chuỗi mới sang tiếng Anh, kiểm `Missing` về 0.

- [ ] **Step 3: Chạy đủ bộ kiểm**

```bash
cd game-tools/client && npm test && npm run test:smoke && npm run build
```

- [ ] **Step 4: Summary + commit**

Viết `docs/superpowers/summaries/2026-07-28-idea-map-text-tool-summary.md` theo
khuôn: đầu file trỏ spec + plan, cuối plan trỏ lại summary.

---

## Kiểm tay còn lại (không tự động hoá được)

- Tiếng Việt có dấu ở **cả hai skin**, ô nhập và chữ vẽ ra cùng font.
- Zoom 50% và 200%: ô nhập trùng khít chỗ chữ sẽ hiện.
- Text ba dòng: cục gôm quét trúng cả ba.
- Kéo text ba dòng → tải lại trang → đúng chỗ mới.
- Hai tab: A tạo text, B thấy sau khi A kết thúc gõ (không thấy từng ký tự —
  đây là hành vi cố ý, xem mục Realtime của spec).
- Bấm rồi Escape ngay → Xuất JSON kiểm không có phần tử rỗng nào.
- Tài khoản chỉ xem: nút Text mờ, vẫn thấy text người khác tạo.
- Hoàn tác sau mỗi việc: tạo, sửa, kéo, xoá.

## Kết quả

**→ [`docs/superpowers/summaries/2026-07-28-idea-map-text-tool-summary.md`](../summaries/2026-07-28-idea-map-text-tool-summary.md)**
