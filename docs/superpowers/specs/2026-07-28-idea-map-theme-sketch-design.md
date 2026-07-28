# Bản đồ ý tưởng — hệ màu bảng & skin vẽ tay

Ngày: 2026-07-28
Base: `main` (sau `c5bba20`)

## Bối cảnh

Học phần giao diện của https://excalidraw.com/. Hai thứ muốn có:

1. Đổi được màu cho **cả bảng** lẫn **từng thẻ**, và có sẵn preset để bấm phát ra ngay.
2. Một **skin "vẽ tay"** song song với skin hiện tại — người dùng chọn nhìn kiểu nào.

### Hiện trạng

- Mọi màu đã đi qua CSS variable (`index.css`), theme sáng/tối bật bằng
  `data-theme` trên `<html>` (`lib/useTheme.js`, lưu `localStorage`).
- Board đã có bảng màu tự tạo lưu trên server: `board.palette` → token
  `pal-<id>` → `paletteCss()` bơm một thẻ `<style>` duy nhất (`lib/palette.js`).
  **Hạ tầng màu đã có sẵn, đợt này chỉ mở rộng.**
- Nhưng `node.color` hiện **chỉ tô vạch viền trái 4px** (`IdeaCard.jsx`), không
  tô nền; `group.color` chỉ đổi `borderColor` (`FrameBox.jsx`); **nền canvas
  không đổi được** — cứng theo theme (`.viewport` trong `idea-map.css`).
- Thẻ và khung là **DOM div**, dây là **SVG `<line>`** (`EdgeLayer.jsx`), nét bút
  và hình khối đã là **SVG path** (`InkLayer.jsx`, `lib/stroke.js`, `lib/shape.js`).

### Vì sao không "bật rough.js một phát" được

Excalidraw vẽ **mọi thứ** lên một thẻ `<canvas>` bằng rough.js, nên độ rung là
một tham số của bộ vẽ. Ở đây thẻ là DOM thật (có input, ảnh, nút, `contain:
layout style`), không có bộ vẽ trung tâm nào để chỉnh. Nên skin vẽ tay phải làm
bằng ba kỹ thuật khác nhau cho ba loại vật thể:

| Vật thể | Kỹ thuật | Chi phí |
|---|---|---|
| Thẻ, khung (DOM) | `border-radius` bốn giá trị lệch + font viết tay | 0 lúc chạy |
| Dây nối, hình khối (SVG) | sinh `d` rung bằng `lib/sketchy.js` | ~20 phép tính/dây |
| Nét bút (SVG) | **không đụng** — vốn đã là nét tay thật | 0 |

Cách thứ ba khả dĩ — vẽ viền thẻ bằng một SVG rough thật sau mỗi thẻ — bị loại:
200–300 thẻ là 300 SVG phải sinh lại mỗi lần đổi cỡ, mà `border-radius` lệch đã
đủ giống.

## Phạm vi

Ba mảng, làm **đúng thứ tự này** vì mảng sau dựa lên mảng trước:

1. **Token hình dạng** — rút bán kính bo, độ dày viền, font của vật thể canvas
   thành biến CSS. Không đổi một pixel nào so với hiện tại.
2. **Màu** — nền bảng theo preset, bộ màu theo preset, thẻ/khung tô nền thật.
3. **Skin vẽ tay** — `data-skin="sketch"`, font viết tay, viền méo, nét rung.

Skin vẽ tay **chỉ áp cho canvas**: thẻ, khung, dây, hình khối, nền bảng.
Topbar, filterbar, ToolRail, ColorMenu, mọi popover **giữ nguyên** giao diện
sạch. Đây cũng là cách Excalidraw làm: canvas vẽ tay, panel bên trái là UI
thường — chữ nút ở cỡ 10–11px mà viết tay thì không đọc được.

---

## A. Token hình dạng

Thêm vào `:root` của `index.css` một khối token **không liên quan tới màu**.
Chúng tách khỏi khối màu vì skin đổi chúng còn theme thì không:

```css
:root {
  /* Hình dạng vật thể trên canvas. Skin "sketch" đổi cả khối này; theme
     sáng/tối KHÔNG đụng tới. */
  --card-radius: 6px;
  --card-border-w: 1px;
  --frame-radius: 10px;
  --frame-border-w: 2px;
  --pill-radius: 999px;
  --edge-w: 1.6px;
  --edge-w-hot: 2.4px;
  --canvas-font: "IBM Plex Sans", Arial, "Liberation Sans", sans-serif;
  --canvas-font-scale: 1;
  --grid-size: 26px;
}
```

Rồi thay giá trị cứng ở các luật sau trong `idea-map.css` bằng token:
`.idea-card`, `.frame-box`, `.status-pill`, `.tag-pill`, `.cmt-pill`,
`.edge-layer .visible`, `.edge-layer .visible.hot`, `.edge-layer .visible.selected`,
`.viewport` (kích thước lưới).

**Ràng buộc:** task này là refactor thuần. Sau nó, ảnh chụp màn hình phải trùng
khít với trước nó. Không đổi giá trị, chỉ đổi chỗ khai.

Lý do làm trước: `idea-map.css` đang 862 dòng với 68 chỗ `border-radius`. Nếu
skin viết bằng override rải rác thì thành hai stylesheet phải nuôi song song,
sửa một chỗ quên chỗ kia. Có token rồi thì skin chỉ là một khối gán lại biến
cộng vài chục dòng override thật sự.

---

## B. Màu

### B1. Nền bảng — 6 preset

Thêm `board.bg`: chuỗi id preset, hoặc `null` = theo theme như hiện tại.

Sáu preset, mỗi cái khai **cả bản sáng lẫn bản tối** trong `idea-map.css`:

| id | Tên hiện cho người dùng | Sáng | Tối |
|---|---|---|---|
| `null` | Theo giao diện | `--bg` hiện tại | `--bg` hiện tại |
| `paper` | Giấy kraft | `#E6E0CC` | `#241F16` |
| `white` | Trắng | `#FBFAF7` | `#141414` |
| `slate` | Xám đá | `#E4E6E4` | `#1B1E1F` |
| `mint` | Bạc hà | `#E2EDE6` | `#141F19` |
| `blush` | Hồng phấn | `#F1E6E4` | `#221715` |

Preset **không đổi `--bg`** mà đổi hai biến riêng:

```css
:root { --board-bg: var(--bg); --board-grid: var(--line); }
:root[data-bg="mint"] { --board-bg: #E2EDE6; --board-grid: rgba(20,31,25,0.16); }
:root[data-theme="dark"][data-bg="mint"] { --board-bg: #141F19; --board-grid: rgba(226,237,230,0.13); }
```

`.viewport` dùng `--board-bg` / `--board-grid`. Không được ghi đè thẳng `--bg`:
`--bg` còn được dùng cho nền hover của `.menubar-trigger` và nền `body`, đổi nó
là một board nền "bảng đen" sẽ kéo cả thanh menu tối theo trong lúc theme đang
sáng.

Thuộc tính `data-bg` đặt trên **`document.documentElement`**, không phải trên
`.viewport` — cùng chỗ với `data-theme`, nhờ vậy `exportPng()` (đang đọc
`getComputedStyle(document.documentElement)`) không phải đổi cách lấy giá trị.
Trang `/idea-map/:boardId` gắn thuộc tính lúc mount và **gỡ lúc unmount**, để
màu của một board không dính sang trang danh sách board.

### B2. Bộ màu — 4 pack

Thêm `board.pack`: `null` (mặc định) | `"pastel"` | `"vivid"` | `"mono"`.

Pack gán lại giá trị của tám token `--dot-1..8`. Vì thẻ/nhãn/dây lưu **tên
token** (`"dot-3"`) chứ không lưu hex, đổi pack là cả bản đồ đổi màu theo mà
**không sửa một byte dữ liệu nào** — và hoàn tác/redo không dính gì tới nó.

```css
:root[data-pack="pastel"] { --dot-1: #A8C0D8; --dot-2: #C3B2D9; /* … */ }
:root[data-theme="dark"][data-pack="pastel"] { /* … */ }
```

`data-pack` cũng đặt trên `documentElement` vì chip nhãn/trạng thái nằm trong
`.filterbar`, ngoài `.viewport`.

**Không** đụng tới `--st-*` (năm màu trạng thái) và `--pen-*` (bảy màu bút):
`--st-*` mang nghĩa cố định (chọn/loại/tạm gác), đổi theo pack là mất nghĩa;
`--pen-*` là hệ màu riêng đã có ghi chú giải thích trong `index.css`.

### B3. Thẻ và khung tô nền thật

Hiện `node.color` chỉ ra một vạch trái 4px. Đổi thành: **tô nền + đổi màu viền**,
như một vật thể Excalidraw.

`IdeaCard` truyền `style={{ "--tint": colorVar(node.color) }}` và thêm class
`tinted`; CSS lo phần còn lại:

```css
.idea-card.tinted {
  background: color-mix(in srgb, var(--tint) 14%, var(--surface-2));
  border-color: color-mix(in srgb, var(--tint) 55%, var(--line));
}
```

`color-mix` là mấu chốt: trộn với `--surface-2` nghĩa là nền thẻ **tự sống đúng
ở cả theme sáng lẫn tối** từ cùng một token, không phải nuôi hai bảng màu, và
14% thì chữ `--ink` vẫn luôn đủ tương phản — không cần tính độ sáng như
`contrastInk()` đang phải làm cho badge.

Khung (`FrameBox`) làm y hệt, nền nhạt hơn (7%) vì khung to và nằm dưới thẻ.

Vạch viền trái 4px cũ **bỏ hẳn** — giữ lại thì thẻ vừa có nền vừa có vạch, rối.

### B4. Panel "Giao diện bảng"

Thêm nút thứ tư vào `.fb-tabs` (sau **Bảng màu**) mở một `DockPanel` mới tên
**Giao diện**, chứa hai hàng:

```
Nền bảng   ○ ▨ ▨ ▨ ▨ ▨        ← 6 nút, cái đầu là "theo giao diện"
Bộ màu     [Cổ điển][Pastel][Rực][Đơn sắc]
```

Panel dùng lại `DockPanel` sẵn có nên tự kéo thả / thả nổi được như ba panel
kia. Cả hai control mang `data-mutating` — tài khoản chỉ xem không đổi được.

`bg` và `pack` là **dữ liệu board**, lưu server, đồng bộ realtime: đây là quyết
định thẩm mỹ chung cho cả nhóm, hai người mở cùng board phải thấy cùng màu.

---

## C. Skin vẽ tay

### C1. Trục `data-skin`, độc lập với `data-theme`

`lib/useSkin.js` — bản sao gần như y hệt `useTheme.js`: đọc/ghi
`localStorage["skin-pref"]`, đặt `data-skin` trên `documentElement`, giá trị
`"clean"` (mặc định) | `"sketch"`. Nút bật nằm trong `.topbar-prefs`, ngay cạnh
nút `◐`.

Skin là **thiết lập của từng người**, không phải dữ liệu board — ngược với
`bg`/`pack` ở mục B. Lý do: nó không đổi *nội dung* bảng, chỉ đổi cách người
ngồi trước màn hình nhìn thấy nó; để cục bộ thì không cần sửa schema, không cần
đồng bộ, và hai người xem cùng board theo hai kiểu khác nhau vẫn đúng.

Hai trục nhân nhau ra bốn tổ hợp — sạch/sáng, sạch/tối, vẽ tay/sáng, vẽ tay/tối
— **cả bốn đều phải kiểm**.

### C2. Font viết tay

**Đây là thứ quyết định 80% cảm giác, và cũng là chỗ suýt chọn sai.**

Đã tải thật các gói `@fontsource` về kiểm subset:

| Font | Subset `vietnamese` | Cân nặng |
|---|---|---|
| Excalifont / Virgil (Excalidraw dùng) | **không** | — |
| Caveat | **không** (chỉ latin, latin-ext, cyrillic) | — |
| Architects Daughter, Kalam, Indie Flower, Gochi Hand, Nanum Pen | **không** | — |
| Patrick Hand | có | chỉ 400 |
| **Shantell Sans** | **có** | 300–800 + italic |

Chốt **`@fontsource/shantell-sans`**: là font duy nhất vừa đủ dấu tiếng Việt vừa
có trục cân nặng — tiêu đề thẻ cần đậm hơn phần mô tả, mà Patrick Hand chỉ có
một cân nặng thì tiêu đề với mô tả trông y như nhau.

Nạp **lười**, chỉ khi người dùng bật skin lần đầu:

```js
// trong useSkin, nhánh bật sketch
if (next === "sketch") await import("../styles/sketch-fonts.js");
```

`styles/sketch-fonts.js` chỉ gồm bốn dòng import subset `latin` và `vietnamese`
ở hai cân nặng 400/600. Người không bao giờ bật skin thì bundle không đổi một
byte.

Font áp qua `--canvas-font`, tức **chỉ vật thể canvas**. Kèm
`--canvas-font-scale: 1.08` vì Shantell Sans có chiều cao chữ x nhỏ hơn IBM Plex
Sans, để nguyên cỡ sẽ đọc thấy bé hơn.

### C3. Viền méo bằng CSS thuần

```css
:root[data-skin="sketch"] .idea-card[data-wob="0"] {
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
}
/* …ba biến thể nữa cho data-wob 1,2,3 */
```

Bốn biến thể, thẻ chọn cái nào theo `node.id % 4` (`data-wob` trong `IdeaCard`),
nên hai thẻ cạnh nhau không méo giống hệt nhau mà một thẻ vẫn méo **cố định** —
kéo đi kéo lại không đổi hình.

Con số 255px trên một thẻ rộng 210px nghe vô lý nhưng đúng: khi tổng bán kính
hai góc vượt cạnh, trình duyệt chia đều tất cả bán kính cho cùng một hệ số, nên
tỉ lệ méo giữ nguyên ở **mọi** kích thước thẻ. Đây chính là lý do mẹo này chạy
được mà không cần biết thẻ to bao nhiêu.

Kèm theo trong skin: viền dày `1.6px`, bóng đổ nhạt và lệch hơn, nền lưới chấm
đổi thành lưới mờ hơn.

### C4. `lib/sketchy.js` — nét rung cho dây và hình khối

Module thuần, không dính React, test bằng `node:test` — cùng khuôn `shape.js` /
`stroke.js`.

```js
seedFrom(value: number|string) -> number      // FNV-1a, id nào cũng ra seed ổn định
sketchyLine(x1, y1, x2, y2, seed, opts?) -> string
sketchyPath(kind: string, pts: number[], seed: number) -> string   // khớp chữ ký shapePath
```

Bốn ràng buộc, cái nào hỏng là hỏng cả tính năng:

1. **Không `Math.random()`.** PRNG là `mulberry32` gieo bằng `seedFrom(id)`. Nếu
   random thì mỗi khung hình nét lại rung một kiểu — kéo một thẻ là cả bản đồ
   giật, chóng mặt trong ba giây.
2. **Độ lệch không phụ thuộc toạ độ**, chỉ phụ thuộc seed và biên độ. Nhờ vậy
   kéo thẻ thì dây uốn theo mượt thay vì nhảy hình.
3. **Biên độ có trần**: `amp = clamp(len * 0.02, 0.6, 4)`. Không trần thì một
   dây dài 900 đơn vị sẽ uốn thành con rắn.
4. **Hai nét chồng nhau trong MỘT chuỗi `d`** (`"M…C… M…C…"`), không phải hai
   thẻ `<path>`. Được cái nhìn giống bút chì vẽ hai lần mà không tăng số nút DOM.

Áp vào:

- `EdgeLayer`: `<line className="visible">` → `<path>` khi `sketch` bật. Thẻ
  `<line className="hit">` (vùng bấm 16px) **giữ nguyên đường thẳng** — vùng bấm
  không việc gì phải rung theo.
- `InkLayer`: `shapePath(kind, pts)` → `sketchyPath(kind, pts, seed)` khi sketch
  bật, seed từ `drawing.id`. Nét bút (`kind === "pen"`) không đụng.
- **Hit-test tuyệt đối không đổi**: `shapeOutline()` và cục gôm vẫn chạy trên
  hình học thẳng. Rung là chuyện hiển thị; bắt trượt nửa pixel còn hơn phải viết
  lại hit-test cho một hình đang rung.

`EdgeLayer` và `InkLayer` đều bọc `memo()` và không biết gì về skin → phải nhận
`sketch` qua prop, không được đọc DOM.

---

## Dữ liệu & server

`board.bg`, `board.pack`: `String, default: null` trong `server/models.js`. Phải
thêm vào **cả bốn** chỗ liệt kê field ở `server/boards.js` (GET trả về, PUT
destructure, PUT ghi, payload realtime) — thiếu một chỗ là đổi màu xong tải lại
trang mất.

Client: `IdeaMap.jsx` chỗ `setBoard({ palette: [], nextPaletteId: 1, … })` thêm
`bg: null, pack: null` vào lớp mặc định, để board cũ trong DB không có field vẫn
chạy.

Không có migration: `null` là hành vi cũ y nguyên.

## Kiểm thử

Tự động:
- `lib/sketchy.test.js` — cùng seed ra cùng chuỗi; seed khác ra chuỗi khác;
  không NaN với đoạn dài 0; biên độ nằm trong trần; `d` sinh ra parse được
  thành số hợp lệ.
- `lib/board-theme.test.js` — id preset không trùng, `isBoardBg`/`isPack` chặn
  giá trị lạ (dùng khi nhập JSON từ ngoài).
- `npm run test:smoke` — thêm bước bật `data-skin="sketch"` rồi kiểm dây vẫn
  render ra `.edge-layer .visible`.

Kiểm tay (không tự động hoá được):
- **Bốn tổ hợp** skin × theme, mỗi cái xem thẻ có màu, thẻ không màu, khung, dây,
  hình khối, nét bút.
- Đổi nền bảng và bộ màu ở tab kia → tab này thấy đổi theo (realtime).
- Chữ tiếng Việt có dấu trên thẻ ở skin sketch: `ưỡng ệ ỗ ặ ữ` — kiểm font
  không rơi về fallback.
- Kéo một thẻ có 5 dây nối ở skin sketch → nét uốn theo mượt, **không giật**.
- Board 200 thẻ ở skin sketch → lia và thu phóng vẫn mượt.
- Xuất PNG khi board đặt nền `slate` → ảnh ra đúng nền đó (PNG export **không**
  vẽ nét rung — đây là hạn chế đã biết, không báo lỗi).
- Tài khoản chỉ xem: hai control trong panel Giao diện mờ, nhưng nút skin ở
  topbar vẫn bấm được (nó là thiết lập cá nhân).
- Rời khỏi `/idea-map/:boardId` sang danh sách board → màu nền board không dính lại.

## Ngoài phạm vi

- Skin vẽ tay cho **vỏ giao diện** (topbar, ToolRail, popover) — để một đợt sau,
  sau khi nhìn thấy kết quả trên canvas thật.
- Màu nền bảng tuỳ chỉnh bằng hex (chỉ có 6 preset). Bộ màu tuỳ chỉnh cũng vậy —
  `board.palette` đã lo việc "màu riêng của tôi".
- Tách màu nền và màu viền của thẻ thành hai trường độc lập như Excalidraw. Một
  token sinh ra cả hai qua `color-mix` là đủ và ít chỗ hỏng hơn.
- Kiểu tô gạch chéo / lưới chéo (hachure) của Excalidraw.
- Độ mờ (opacity) từng vật thể.
- Vẽ nét rung vào PNG export.
- Skin thứ ba.
- Không tách nhỏ `IdeaMap.jsx` ngoài việc để logic mới ra file riêng.

---

## Plan thực thi

Spec này đã được chuyển thành plan thực thi từng task:

**→ [`docs/superpowers/plans/2026-07-28-idea-map-theme-sketch.md`](../plans/2026-07-28-idea-map-theme-sketch.md)**
