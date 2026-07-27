# Bản đồ ý tưởng — thanh công cụ bên trái & vẽ tay bằng bút

Ngày: 2026-07-27
Base: `main` (sau `23163c0`)

## Bối cảnh

Trang `/idea-map/:boardId` hiện chỉ có hai thanh ngang: `.topbar` (menu Board /
Thêm / hoàn tác / Nối ý tưởng / tìm kiếm / Dữ liệu / Xem / ngôn ngữ) và
`.filterbar` (tab panel + presence). Mọi thao tác đều là thao tác lên **thẻ** —
chưa có cách nào vẽ thẳng lên bảng.

Đợt này thêm một thanh công cụ dọc ở lề trái, chia bốn khu, và làm cho tool
**bút** vẽ được thật: nét lưu vào board, mọi người thấy theo thời gian thực,
hoàn tác được, xoá được bằng cục gôm.

## Phạm vi

Đây là **spec 1 của hai spec**. Đường cắt:

- **Spec 1 (tài liệu này)** — thanh công cụ đầy đủ bốn khu + tool bút vẽ thật +
  cục gôm + lưu + đồng bộ realtime + hoàn tác.
- **Spec 2 (sau)** — tool hình khối (8 hình), chọn / di chuyển nét đã vẽ, và
  z-order tổng (đưa lên trước / đưa ra sau cho cả nét vẽ lẫn thẻ).

> Cập nhật 2026-07-28: phần "spec 2" ở trên đã được cắt làm hai khi lên thiết
> kế thật. Tool hình khối (6 hình, không phải 8) là
> [`2026-07-28-idea-map-shape-tool-design.md`](2026-07-28-idea-map-shape-tool-design.md);
> chọn / di chuyển nét và z-order tổng dồn sang spec 3 vì cả hai dựa trên cùng
> một bộ máy chọn nét. Mọi chỗ ghi "spec 2" bên dưới đọc thành "đợt sau".

Spec 1 **không** dựng nút chết: nút hình khối chỉ xuất hiện ở spec 2.

## A. Thanh công cụ bên trái

Hai component mới, render bên trong `.viewport` (đã là `position: relative`),
nổi trên canvas — canvas vẫn trải hết bề rộng nên đổi mode không làm khung nhìn
co giãn và thẻ không xê dịch.

- `components/ToolRail.jsx` — thanh chính: rộng 46px, `left: 12px`, canh giữa
  theo chiều dọc (`top: 50%; transform: translateY(-50%)`), bo góc 12, nền
  `var(--surface)`, viền `var(--line)`, `box-shadow: var(--shadow)`,
  `z-index: 30`.
- `components/ToolOptions.jsx` — khu 4: cột thứ hai rộng 54px, `left: 66px`,
  cùng canh giữa dọc. Chỉ render khi tool đang chọn có option.

```
   ┌────┐ ┌────┐
   │ ↖  │ │ ● ●│ ← 7 màu bút, 2 cột
   │ ✎  │ │ ● ●│
   ├────┤ │ ● ●│
   │ ✒  │ │ ●  │
   │ ⌫  │ ├────┤
   ├────┤ │ ─  │ ← 3 độ dày
   │ +▭ │ │ ━  │
   │ +👑│ │ ▬  │
   │ +⬚ │ └────┘
   │ ⇄  │  khu 4
   │ ≡  │
   └────┘
 khu 1/2/3
```

### Khu 1 — mode (luôn hiện)

Hai nút: **Chuột** · **Sửa**. Đúng một nút sáng.

### Khu 2 — tool (chỉ khi mode = Sửa)

Hai nút: **Bút** · **Cục gôm**. Mặc định khi vào mode Sửa là Bút.

Mode Chuột thì khu 2 **ẩn hẳn** (không phải làm mờ) — mọi thao tác trên bảng
giữ nguyên y như hiện tại: kéo trái = quét chọn, chuột phải hoặc Space+trái =
lia bảng, cuộn = thu phóng.

### Khu 3 — thêm (luôn hiện)

Năm nút, **chuyển hẳn** từ `.topbar` xuống, mỗi việc chỉ còn một chỗ bấm:

| Nút | Việc | Nguồn cũ |
| --- | --- | --- |
| Thêm ý tưởng | `handleAddClick()` | menu THÊM → `+ Ý tưởng` |
| Thêm thẻ gốc | như trên, node mới có `isRoot: true` | *mới* |
| Thêm khung | `createGroup()` | menu THÊM → `+ Khung` |
| Nối ý tưởng | toggle `linkMode` | nút `Nối ý tưởng` trên topbar |
| Nhập nhanh | `setCaptureOpen(true)` | menu THÊM → `Nhập nhanh` |

Sau đợt này `.topbar` **gỡ bỏ** cả `TopMenu label="Thêm"` và nút
`Nối ý tưởng`. Menu Board / Dữ liệu / Xem, hoàn tác/làm lại, ô tìm kiếm và cụm
ngôn ngữ + sáng/tối giữ nguyên chỗ cũ.

"Thẻ gốc" là cờ `isRoot` đã có trên node (badge 👑, hiện chỉ bật/tắt qua menu
chuột phải trên thẻ). Nút này tạo thẻ mới đã sẵn cờ đó.

### Khu 4 — option của tool

| Tool | Nội dung khu 4 |
| --- | --- |
| Bút | 7 ô màu (lưới 2 cột) → vạch ngăn → 3 nút độ dày |
| Cục gôm | ẩn (không có option) |
| mode Chuột | ẩn |

### Hành vi

- Đổi sang mode **Sửa** → xoá `selectedIds` / `selectedEdgeIds` và tắt
  `linkMode`. Không để vừa vẽ vừa còn thẻ đang chọn, vì khi đó Delete sẽ xoá
  thẻ trong lúc người dùng nghĩ mình đang xoá nét.
- Mode Sửa **vẫn lia và thu phóng như cũ**: chuột phải kéo, Space + trái kéo,
  cuộn để zoom. Chỉ chuột-trái-kéo là chuyển thành vẽ.
- Icon là inline SVG như `components/ColorMenu.jsx` đang làm (không dùng
  emoji): theo được `currentColor` nên tự đúng ở cả nền sáng và tối.
- `role === "viewer"`: nút mode Sửa, cả khu 2 và cả khu 3 bị vô hiệu hoá, dùng
  lại móc `data-mutating` mà `.topbar` đang dùng.
- Mode và tool **không** nhớ qua lần mở sau: mở board luôn ở mode Chuột. Mở
  board ra mà con trỏ đang là cây bút là điều gây bất ngờ vô cớ.

### Phím tắt

Thêm vào handler keydown toàn cục trong `IdeaMap.jsx`. Handler đã tự thoát sớm
khi con trỏ nằm trong input/textarea/contentEditable nên thẻ đang mở ô sửa
không bị dính.

| Phím | Việc |
| --- | --- |
| `v` | mode Chuột |
| `b` | mode Sửa + tool Bút |
| `e` | mode Sửa + tool Cục gôm |
| `l` | bật/tắt Nối ý tưởng |
| `Shift+N` | thêm thẻ gốc |
| `Esc` | đang ở mode Sửa → về mode Chuột |

`n` (thêm ý tưởng), `f` (vừa khung theo lựa chọn), `Enter` / `Shift+Enter`, mũi
tên, `Delete`, `Ctrl+Z/Y/D/F` giữ nguyên. `b`, `e`, `l`, `v` hiện chưa dùng nên
không đụng phím nào.

Nhánh `Esc` phải chèn **trước** các nhánh Esc đang có (đóng `colorMenu`,
`badgeUI`, `edgeMenu`, `commentsFor`, tắt `linkMode`, bỏ `focusId`, bỏ chọn):
đang vẽ mà bấm Esc thì ý người dùng là "thoát cây bút".

`b`, `e` và `Shift+N` ghi dữ liệu nên `return` sớm khi `role === "viewer"`.
`v` chỉ đổi mode nên người chỉ xem vẫn dùng được.

## B. Bộ màu bút và độ dày

Màu bút là **hệ màu riêng**, không dùng `board.palette` hay `BADGE_PALETTE`.
Đổi màu thẻ không được kéo theo màu nét vẽ.

`lib/pen.js` (đặt tên `pen-` chứ không `ink-` để không lẫn với `--ink` /
`--ink-dim` đang là màu chữ):

```js
export const PEN_COLORS = ["pen-red", "pen-orange", "pen-yellow",
                           "pen-green", "pen-blue", "pen-purple", "pen-mono"];
export const PEN_WIDTHS = [2, 4, 8];          // đơn vị toạ độ canvas
export const PEN_DEFAULT = { color: "pen-red", w: 4 };
export function penVar(token) { return `var(--${token})`; }
// Đọc/ghi khoá "ideamap.pen" = { color, w }. Thiếu khoá, JSON hỏng, hoặc token /
// độ dày không còn nằm trong PEN_COLORS / PEN_WIDTHS đều trả về PEN_DEFAULT —
// người dùng cũ không bị kẹt với một giá trị đã bỏ.
export function loadPenPrefs(storage) { … }
export function savePenPrefs(storage, prefs) { … }
```

Nét lưu **token** chứ không lưu hex, nên đổi sáng/tối là nét đổi theo và luôn
nhìn được. Giá trị thật khai báo trong `styles/idea-map.css`, mượn nguyên các
màu đã được duyệt cho hai theme trong `index.css` (`--danger`, `--accent`,
`--st-*`) nên chắc chắn hoà với tổng thể:

| Token | Sáng | Tối |
| --- | --- | --- |
| `--pen-red` | `#A43F32` | `#E2685A` |
| `--pen-orange` | `#9C5A22` | `#E3A455` |
| `--pen-yellow` | `#8A6D14` | `#D4B451` |
| `--pen-green` | `#3C7A5A` | `#74C79B` |
| `--pen-blue` | `#35618A` | `#86B8E8` |
| `--pen-purple` | `#6B5B8A` | `#B9A6DE` |
| `--pen-mono` | `#24261D` | `#ECE7D2` |

Khai báo ở cả bốn khối theme mà `index.css` đang dùng: `:root`,
`@media (prefers-color-scheme: dark) :root`, `:root[data-theme="dark"]`,
`:root[data-theme="light"]`. Bỏ sót khối `[data-theme]` nào là nút `◐` đổi
theme xong nét vẽ giữ nguyên màu của theme cũ.

Màu và độ dày đang chọn nhớ vào `localStorage` (`loadPenPrefs` /
`savePenPrefs`, cùng kiểu `loadLayouts` trong `lib/dock.js`) — chọn bút đỏ dày
hôm nay thì mai mở lại vẫn là bút đỏ dày.

## C. Dữ liệu nét vẽ

Hai field mới trên board:

```js
board.drawings = [
  { id: 1, kind: "pen", color: "pen-red", w: 4, pts: [120,80, 124,86, 131,95] }
]
board.nextDrawingId = 2
```

- `pts` là **mảng số phẳng**, làm tròn về số nguyên, toạ độ canvas. Nhỏ hơn
  khoảng 40% so với mảng `{x, y}` — quan trọng vì mỗi lần lưu là PUT cả board.
- `kind` có sẵn để spec 2 thêm `"rect"` / `"ellipse"` / … không phải đổi schema.
- `id` cấp từ `nextDrawingId`, cùng kiểu `nextNodeId` / `nextGroupId`.

## D. `lib/stroke.js` — module thuần

Tách hẳn khỏi React, có `lib/stroke.test.js` đi kèm (`node:test` +
`node:assert/strict`, cùng kiểu các test lib đang có — `npm test` chạy
`node --test "src/lib/*.test.js"`):

```js
simplifyStroke(pts)                       -> pts'
strokePath(pts)                           -> chuỗi `d` cho <path>
strokesHitBy(drawings, point, radius)     -> [id, ...]
```

- `simplifyStroke` — bỏ điểm cách điểm trước dưới 2px, rồi
  Ramer–Douglas–Peucker sai số 1px. Một nét kéo dài từ ~400 điểm còn ~60. Chạy
  **một lần lúc thả chuột**, không chạy trong lúc kéo.
- `strokesHitBy` — khoảng cách từ điểm tới từng đoạn thẳng của nét; chạm khi
  `d <= w / 2 + radius`. Dùng cho cục gôm.

## E. Vẽ bằng bút

`components/InkLayer.jsx` — một `<svg>` trong `.canvas`, dựng theo đúng khuôn
`.edge-handle-layer` đang dùng (`.canvas` có `width: 0; height: 0` nên lớp con
cần kích thước riêng + `overflow: visible`):

```css
.ink-layer {
  position: absolute; left: 0; top: 0; width: 4200px; height: 3200px;
  overflow: visible; pointer-events: none; z-index: 7;
}
```

`z-index: 7` là cao nhất trong `.canvas`: trên `.marquee-box` (4),
`.edge-handle-layer` (5), `.connector-zone` (5) và `.peer-cursor` (6). `.idea-card`
không đặt `z-index` nên vẽ theo thứ tự DOM, tức cũng nằm dưới. Đúng lựa chọn đã
chốt: nét vẽ là một lớp nằm trên tất cả. `pointer-events: none` nên ở mode Chuột
nét vẽ không bao giờ chặn đường bấm/kéo thẻ.

Mỗi nét là một `<path>`: `d` từ `strokePath`, `stroke: penVar(color)`,
`stroke-width: w`, `fill: none`, `stroke-linecap`/`stroke-linejoin: round`.
**Không** dùng `vector-effect: non-scaling-stroke` — muốn zoom vào là nét dày
ra như mực trên giấy.

`InkLayer` vẽ cả nét đã lưu, nét mình đang kéo dở, và nét người khác đang vẽ —
**một đường vẽ duy nhất**, không có code path thứ hai.

Lớp bắt chuột, cũng trong `.viewport`, chỉ render khi mode = Sửa:

```css
.ink-capture { position: absolute; inset: 0; z-index: 8; cursor: crosshair; }
```

Đây là lý do kéo ngang qua trên thẻ vẫn ra nét chứ không bị thẻ ăn mất chuột.
`z-index: 8` nằm dưới `ToolRail` (30) nên thanh công cụ vẫn bấm được. Handler
của nó nhường đường cho lia bảng trước khi nghĩ tới việc vẽ, đúng thứ tự
`handleViewportMouseDown` đang làm:

1. `e.button === 2` → `startPan`
2. `e.button === 0 && spacePanRef.current` → `startPan`
3. `e.button !== 0` → bỏ qua
4. còn lại → bắt đầu nét

Trong lúc kéo, điểm thô đẩy vào `useRef` và preview cập nhật qua
`lib/raf-throttle.js` đã có — **không** `setState` mỗi `mousemove`.

Thả chuột → `simplifyStroke` → `commitAndSave({ ...board, drawings: [...],
nextDrawingId })`: đúng **một** entry hoàn tác, một lần PUT, một lần broadcast
cho mỗi nét.

Nét chỉ có một điểm (bấm rồi nhả, không di) → bỏ, không tạo nét rác.

Cửa sổ mất focus giữa nét (`blur`) → huỷ nét đang vẽ và phát gói `cancel` (xem
mục G).

## F. Cục gôm

Kéo chuột: mỗi bước gọi `strokesHitBy`, gom id vào một `Set` trong ref. Nét bị
đánh dấu vẽ với `opacity: 0.25` để thấy trước khi mất. Bán kính gôm cố định
8px canvas.

Thả chuột → commit **một lần** cho cả `Set` → **một** bước hoàn tác cho cả lần
quét, dù quét qua mười nét.

Quét mà không chạm nét nào → không commit, không tạo entry hoàn tác rác.

## G. Đồng bộ realtime — kênh `live:ink`

Nét chạy tới đâu người khác thấy tới đó. Dùng đúng khuôn mẫu kênh live đang có
trong `lib/useLiveSync.js` + `server/index.js`, với **một khác biệt quan trọng**:

> `live:geom` phát bằng `socket.volatile` được, vì mỗi gói mang vị trí tuyệt
> đối — mất một gói thì gói sau tự sửa. Gói `live:ink` mang **điểm mới thêm**,
> mất một gói là nét khuyết hẳn một khúc và không bao giờ tự lành. Nên
> `live:ink` phát tin cậy qua `socket.to(room)`, không `volatile`.

Gói tin:

```js
{ strokeId, seq: 0, color: "pen-red", w: 4, pts: [120,80, 124,86] }  // gói đầu
{ strokeId, seq: 1, pts: [131,95, 138,101] }                          // chỉ điểm MỚI
{ strokeId, done: true, drawingId: 37 }                               // thả chuột
{ strokeId, erase: [3, 7, 12], done: false }                          // cục gôm
{ strokeId, cancel: true }                                            // huỷ giữa chừng
```

- `strokeId` là **số tăng dần cục bộ** của người vẽ, chỉ sống trong một nét.
  Server đính thêm `socketId` khi phát lại (giống `selection:update` và
  `edge-draft:update` đang làm) nên người xem khoá overlay theo
  `socketId + ":" + strokeId` — không phải tin id do client tự đặt.
- Chỉ gói `seq === 0` mang `color` / `w`; gói sau khoảng 4 điểm ≈ 30 byte.
- Nhịp gửi **40ms** (~25 gói/giây) qua `trailingThrottle` đã có — nhanh hơn
  nhịp 60ms của kéo thẻ vì mắt bắt nét vẽ nhạy hơn bắt thẻ chạy. Một người vẽ
  liên tục tốn chừng 1KB/giây, rẻ hơn kênh geom.

### Phía người xem

Hook mới `lib/useInkLive.js` — **không** nhồi vào `useLiveSync.js` (đã ~400
dòng và đang giữ hai overlay khác). Hàm trộn thuần `mergeInkPacket()` nằm ở
`lib/ink-live.js` kèm `ink-live.test.js`.

Overlay là `Map` `strokeId → { color, w, pts, drawingId, erase, expiresAt }`,
quét hết hạn bằng `sweepExpired` đã có trong `useLiveSync.js`.

Ba chỗ dễ sinh nháy, xử lý theo đúng bài học đã ghi trong `useLiveSync.js`:

1. **TTL nét đang vẽ = 1200ms.** Người vẽ rớt mạng giữa nét thì nét tạm tự dọn
   thay vì treo mãi trên màn hình người khác.
2. **TTL gói `done` = 6000ms.** Nó phải cầm cự tới khi `board:update` của lần
   lưu đó về tới nơi. Bỏ ngay là nét biến mất rồi mới hiện lại — đúng hiện
   tượng nháy mà `GEOM_SETTLE_TTL_MS` đang chống.
3. **Đối chiếu sau `board:update`.** Vì vậy gói `done` mang kèm `drawingId` —
   id thật người vẽ vừa cấp. Áp `board:update` xong, nét nào trong overlay có
   `drawingId` đã nằm trong `board.drawings` thì bỏ **ngay**, không đợi hết
   TTL. Cùng vai trò `reconcileGeomOverlay`.

**Chỉ người đang thật sự vẽ mới được phát; người nhận không bao giờ phát lại.**
Đây là cùng một cái bẫy mà ghi chú dài trong `useLiveSync.js` đã mô tả: nếu
người nhận phát lại thì A → B → A thành vòng vọng, nét nhảy đi nhảy lại.

### Cục gôm cũng realtime

Cùng kênh, gói `{ strokeId, erase: [ids], done }`. Người xem vẽ những nét đó
với `opacity: 0.25` ngay trong lúc người kia đang quét; `board:update` sau đó
xoá thật. Dùng lại trọn cơ chế TTL + đối chiếu ở trên.

Phần này khoảng 15 dòng phụ thêm — cắt được mà không ảnh hưởng phần vẽ, nếu
muốn thu nhỏ đợt này.

## H. Server

`server/models.js` — thêm vào `boardSchema`:

```js
drawings: { type: Array, default: [] },
nextDrawingId: { type: Number, default: 1 },
```

`server/boards.js` `PUT /:id` — field board được **liệt kê tay ở ba chỗ**, bỏ
sót chỗ nào là nét vẽ bị âm thầm rụng:

1. `const { ... } = req.body` (dòng ~118)
2. `Board.findByIdAndUpdate(...)` (dòng ~124)
3. `payload` của `board:update` (dòng ~137)

`server/index.js` — thêm handler cạnh `live:geom`:

```js
socket.on("live:ink", (payload) => {
  // Khác cursor/geom/text: vẽ là ghi dữ liệu, không phải presence. Middleware
  // đã đặt socket.data.role nên chặn viewer ở đây chỉ tốn một dòng.
  if (socket.data.role === "viewer") return;
  const clean = sanitizeInk(payload);   // strokeId là số; pts là mảng số độ dài
  if (!clean) return;                   // chẵn, trần 200 số; erase là mảng số
  socket.to(room).emit("live:ink", { ...clean, socketId: socket.id });
});
```

Phát tin cậy cho mọi gói (không `volatile`) vì gói mang điểm mới thêm.

## I. Chia file

`IdeaMap.jsx` đang 2893 dòng nên không nhồi thêm logic vẽ vào đó. `IdeaMap`
chỉ giữ state `mode` / `tool` / `penPrefs` và nối dây.

| File | Vai trò |
| --- | --- |
| `components/ToolRail.jsx` | thanh chính, khu 1/2/3 — thuần trình bày, nhận callback |
| `components/ToolOptions.jsx` | khu 4 — màu bút + độ dày |
| `components/InkLayer.jsx` | `<svg>` vẽ nét đã lưu + nét đang kéo + nét người khác |
| `lib/useInk.js` | hook: bắt chuột vẽ và gôm, gom điểm, commit |
| `lib/useInkLive.js` | hook: phát và nhận `live:ink`, giữ overlay |
| `lib/stroke.js` | thuần: `simplifyStroke`, `strokePath`, `strokesHitBy` |
| `lib/ink-live.js` | thuần: `mergeInkPacket` |
| `lib/pen.js` | bộ màu bút, độ dày, prefs localStorage |

## Kiểm thử

- `lib/stroke.test.js` — mới: `simplifyStroke` giữ hai đầu nét và bỏ điểm giữa
  thẳng hàng; nét một điểm và nét rỗng không nổ; `strokePath` sinh `d` đúng;
  `strokesHitBy` chạm/không chạm quanh ngưỡng `w / 2 + radius`.
- `lib/ink-live.test.js` — mới: gói `seq` liên tiếp nối đúng thứ tự điểm; gói
  `done` chuyển sang TTL dài; gói `cancel` bỏ entry; gói `erase` gom id.
- `npm test` trong `game-tools/client` toàn bộ phải xanh. Server không có bộ
  test nào nên phần `server/` kiểm bằng tay khi chạy app.
- Kiểm tay trên app đang chạy, **hai tab cùng board**:
  - Vẽ ở tab A → tab B thấy nét chạy theo, không khuyết khúc, không nháy lúc
    thả chuột.
  - Tải lại trang → nét còn nguyên, đúng màu, đúng độ dày.
  - Zoom vào/ra → nét dày mỏng theo, không lệch khỏi thẻ.
  - Ctrl+Z sau khi vẽ → mất đúng một nét. Sau khi gôm 5 nét → cả 5 về.
  - Kéo qua trên thẻ khi đang dùng bút → ra nét, thẻ không bị kéo theo.
  - Chuột phải kéo và Space+trái kéo trong mode Sửa → vẫn lia bảng.
  - Đổi sáng/tối → nét đổi màu theo, vẫn đọc được.
  - Đăng nhập bằng tài khoản `viewer` → mode Sửa và khu 3 mờ, không vẽ được.
  - Phím `v` / `b` / `e` / `l` / `Shift+N` / `Esc`.

## Hạn chế đã biết

- **Mỗi nét vẽ xong là PUT cả board.** Đây là vấn đề có sẵn của kiến trúc lưu
  hiện tại (ảnh base64 nhúng trong node cũng vậy), nét vẽ chỉ làm nó nặng thêm.
  Sau `simplifyStroke` mỗi nét khoảng 0,5KB nên 500 nét thêm chừng 250KB. Đợt
  này **không** sửa kiến trúc lưu.
- **`nextDrawingId` trùng khi hai người vẽ cùng lúc** — cùng hạng rủi ro với
  `nextNodeId` khi hai người thêm thẻ cùng lúc, vì kiến trúc lưu là ghi cả
  board và bản sau thắng. Không xử lý riêng trong đợt này.

## Ngoài phạm vi

- Tool hình khối 8 hình (chữ nhật, ê-líp, đường thẳng, mũi tên, tam giác, hình
  thoi, ngôi sao, mũi tên hai đầu) — spec 2.
- Chọn / di chuyển / đổi màu nét đã vẽ — spec 2. Ở spec 1 muốn bỏ nét thì dùng
  cục gôm hoặc Ctrl+Z.
- z-order tổng, menu đưa lên trước / đưa ra sau cho cả nét vẽ lẫn thẻ — spec 2.
  Spec 1 để nét vẽ ở một lớp cố định nằm trên tất cả.
- Độ mờ nét, bút highlight, làm mượt nét kiểu bút áp lực.
- Không tách nhỏ `IdeaMap.jsx` ngoài việc để logic mới ra file riêng.

---

## Plan thực thi

Spec này đã được chuyển thành plan thực thi từng task:

**→ [`docs/superpowers/plans/2026-07-27-idea-map-left-toolbar-ink.md`](../plans/2026-07-27-idea-map-left-toolbar-ink.md)**
