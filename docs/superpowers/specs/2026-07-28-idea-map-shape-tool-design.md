# Bản đồ ý tưởng — tool hình khối

Ngày: 2026-07-28
Base: `main` (sau `603bf45`)

## Bối cảnh

Spec `2026-07-27-idea-map-left-toolbar-ink-design.md` đã dựng thanh công cụ bốn
khu ở lề trái và làm tool **bút** vẽ được thật: nét lưu vào `board.drawings`,
đồng bộ realtime qua kênh `live:ink`, xoá được bằng cục gôm, hoàn tác được.
Spec đó cố ý để dành `kind` trong dữ liệu nét và **không** dựng nút hình khối.

Đợt này thêm tool **hình khối**: kéo chuột ra một trong sáu hình, viền hoặc tô
cả hình, đi trọn vẹn qua đúng những đường đã có — lưu, realtime, gôm, hoàn tác.

## Phạm vi

Spec 1 nêu "spec 2" gồm ba mảng. Đợt này làm **một mảng**: tool hình khối.

Hai mảng còn lại — **chọn / di chuyển nét đã vẽ** và **z-order tổng** — dồn
sang spec 3, vì cả hai dựa trên cùng một bộ máy chọn nét mới (hit-test theo cú
bấm, ô chọn, phím Delete, kéo dịch toạ độ) và tách ra thì trùng việc.

## A. Giao diện

### Khu 2 — thêm nút thứ ba

Sau **Bút** và **Cục gôm**, thêm **Hình khối** (`tool === "shape"`). Icon là
inline SVG theo `currentColor` như các nút sẵn có: một hình vuông và một hình
tròn lồng nhau. Phím tắt `s` — đã kiểm, `s` chưa bị chiếm trong
`IdeaMap.jsx`; nó vào cùng nhánh với `b` và `e`:

```js
else if (key === "s") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("shape"); }
```

### Khu 4 — bốn nhóm khi đang cầm hình khối

```
┌──────┐
│ ▭  ○ │  6 hình, 2 cột × 3 hàng
│ ╱  ↗ │
│ △  ◇ │
├──────┤
│ ●  ● │
│ ●  ● │  7 màu — dùng lại y nguyên khu 4 của bút
│ ●  ● │
│ ●    │
├──────┤
│  ─   │
│  ━   │  3 độ dày — dùng lại y nguyên
│  ▬   │
├──────┤
│ ▢  ▮ │  viền · cả hình
└──────┘
```

Sáu hình, theo đúng thứ tự này trong bảng chọn: **chữ nhật · ê-líp · đường
thẳng · mũi tên · tam giác · hình thoi**.

Cột này cao khoảng 300px. `.tool-options` đang canh giữa dọc bằng
`translateY(-50%)` nên màn hình thấp sẽ tràn ra ngoài khung nhìn — thêm
`max-height: calc(100% - 24px)` và `overflow-y: auto` cho `.tool-options`.

Nút **cả hình** bị `disabled` khi hình đang chọn là **đường thẳng** hoặc **mũi
tên**: hai hình mở, không có vùng trong để tô. Bấm sang một trong hai hình đó
thì `fill` tự về `false` — nếu chỉ disable nút mà giữ `fill: true`, đổi lại
sang chữ nhật sẽ tô đặc bất ngờ.

Tool **bút** và **cục gôm** giữ nguyên khu 4 như spec 1: bút hiện màu + độ dày,
gôm không có tuỳ chọn nào.

### Vẽ

- Kéo từ một góc sang góc đối. Hình hiện ngay theo con trỏ trong lúc kéo.
- Giữ `Shift` ép vuông / tròn đều với bốn hình đóng; với **đường thẳng** và
  **mũi tên** thì ép hướng về 0° / 45° / 90°.
- Thả chuột mà đường chéo giữa hai góc ngắn hơn **4** đơn vị canvas thì bỏ,
  không tạo hình rác. Cùng luật với nét bút một điểm ở spec 1 (`pts.length < 4`).
  Đo theo đường chéo chứ không theo từng chiều: một đường thẳng ngang dài 200
  có chiều cao 0, đo từng chiều sẽ bỏ oan.
- Vẽ xong **giữ nguyên** tool hình khối, vẽ tiếp hình nữa không phải bấm lại
  nút. Cùng nếp với bút và gôm.
- Chuột phải và `Space`+trái vẫn lia bảng; `Esc` vẫn thoát về mode Chuột. Cả hai
  đã do `handleInkCaptureMouseDown` và handler bàn phím lo, không phải sửa.
- Cục gôm xoá hình khối như xoá nét bút: chạm viền là xoá, và hình **cả hình**
  thì chạm vào vùng trong cũng xoá.
- `Ctrl+Z` lấy lại như nét bút. Không cần code hoàn tác riêng — xem mục B.

## B. Dữ liệu

**Không đổi schema server.** Một hình khối là một phần tử `board.drawings` như
nét bút, chỉ khác `kind` và ý nghĩa của `pts`:

```js
// nét bút — như spec 1
{ id: 1, kind: "pen",  color: "pen-red",  w: 4, pts: [120,80, 124,86, 131,95] }
// hình khối — pts là ĐÚNG 4 số: hai góc đối
{ id: 2, kind: "rect", color: "pen-blue", w: 4, pts: [200,100, 380,220], fill: false }
```

- `kind` ∈ `"pen" | "rect" | "ellipse" | "line" | "arrow" | "triangle" | "diamond"`
- `fill` boolean, **chỉ có ở bốn hình đóng**; nét bút, đường thẳng và mũi tên
  không mang field này
- `pts` vẫn là mảng số phẳng, số nguyên, toạ độ canvas

Hệ quả trực tiếp của việc dùng lại `drawings`: **`commitStroke`, `commitErase`,
hoàn tác/làm lại, `board.nextDrawingId`, và bốn chỗ liệt kê field trong
`server/routes/boards.js` không phải sửa dòng nào.** `commitStroke(stroke)` chỉ
spread `stroke` vào mảng, nó không quan tâm bên trong có gì.

Đây cũng là lý do bỏ hai phương án còn lại: nướng hình thành đường gấp khúc thì
ê-líp răng cưa khi zoom, dữ liệu to gấp chừng 15 lần, và mất hình gốc nên spec 3
không kéo tay cầm đổi kích thước được; còn một mảng `board.shapes` riêng thì
phải nhân đôi hoàn tác, gôm, kênh realtime, và bốn danh sách field ở GET/PUT —
đúng chỗ đã làm mất nét ở spec 1.

## C. `lib/shape.js` — module thuần

Tách hẳn khỏi React, có `lib/shape.test.js` đi kèm (`node:test` +
`node:assert/strict`; `npm test` chạy `node --test "src/lib/*.test.js"`).

```js
SHAPE_KINDS                        // 6 kind, đúng thứ tự hiện ở khu 4
SHAPE_CLOSED                       // Set 4 kind có vùng trong: rect, ellipse, triangle, diamond
normalizeBox(x0, y0, x1, y1, opts) // -> [x0,y0,x1,y1] số nguyên; opts.square, opts.snap
shapePath(kind, pts)               // -> chuỗi `d` cho <path>
shapeOutline(kind, pts)            // -> mảng số phẳng, đường bao xấp xỉ
drawingsHitBy(drawings, point, r)  // -> [id, ...] cho CẢ pen lẫn shape
```

- `normalizeBox` — làm tròn về số nguyên. Không sắp lại thứ tự hai góc: đường
  thẳng và mũi tên cần biết đâu là điểm đầu, đâu là điểm cuối. `shapePath` của
  bốn hình đóng tự lấy `min`/`max` nên góc nào trước cũng ra cùng một hình.
  `opts.square` ép `|dx| = |dy|` giữ dấu; `opts.snap` ép hướng về 0/45/90°.
- `shapePath` — sinh cung `A` thật cho ê-líp nên zoom vào vẫn mịn. Bốn hình
  đóng kết bằng `Z`.
- `shapeOutline` — xấp xỉ ê-líp bằng 32 điểm; các hình còn lại trả đúng đỉnh
  của chúng. **Chỉ dùng để đo, không để vẽ.**

### Vì sao `shapePath` và `shapeOutline` tách nhau

Hai hàm giữ hai bản mô tả hình học của cùng một hình, nên về nguyên tắc chúng
có thể lệch nhau. Chấp nhận có chủ ý: chỗ duy nhất lệch là ê-líp, sai số dưới
1 đơn vị canvas ở kích thước thường, và cái giá của việc lệch chỉ là cục gôm
bắt chệch nửa pixel. Đổi lại, **mọi `kind` chỉ còn một đường hit-test duy
nhất** — đo tới các đoạn của đường bao, cộng point-in-polygon trên chính đường
bao đó khi `fill` bật. Nếu viết hình học chính xác cho từng `kind` thì có sáu
đường code riêng phải giữ đồng bộ với sáu path.

### `drawingsHitBy` thay `strokesHitBy`

Hit-test phải biết mọi `kind`, mà chỗ duy nhất biết hình học của `kind` là
`shape.js`. Nên:

- `stroke.js` hạ xuống thành nơi giữ hai phép tính gốc: nó **xuất thêm**
  `distToSegment` (đang là hàm nội bộ) và `pointInPolygon` (mới, ray casting).
- `shape.js` import hai hàm đó. Chiều import một phía `shape.js → stroke.js`,
  không có vòng.
- `strokesHitBy` bị xoá. Chỗ gọi là `useInk.js` hai dòng (59 và 78), đổi sang
  `drawingsHitBy`. **Năm** test của `strokesHitBy` trong `stroke.test.js`
  **chuyển sang** `shape.test.js` chứ không xoá, để không mất phần phủ nét bút.
- Nhánh `kind === "pen"` của `drawingsHitBy` phải giữ y nguyên hành vi cũ, kể cả
  trường hợp nét một điểm (`pts.length === 2` → đo khoảng cách tới điểm) và nét
  thiếu `pts` (bỏ qua). Năm test chuyển sang là thứ chốt điều đó.

## D. Tuỳ chọn nhớ trong localStorage

`lib/pen.js` đang nhớ `{ color, w }` dưới khoá `"ideamap.pen"`. Mở rộng thành
`{ color, w, kind, fill }` — toàn bộ state của khu 4, một object, một khoá:

```js
export const PEN_DEFAULT = { color: "pen-red", w: 4, kind: "rect", fill: false };
```

`loadPenPrefs` đã lọc theo từng key nên chỉ thêm hai dòng cùng khuôn: `kind`
phải nằm trong `SHAPE_KINDS`, `fill` phải là `true` hoặc `false`; sai thì rơi về
mặc định của riêng key đó. `savePenPrefs` ghi cả bốn key.

Chiều import mới: `pen.js → shape.js → stroke.js`, không có vòng.

## E. Vẽ — `lib/useInk.js`

Thêm nhánh thứ ba `tool === "shape"` bên cạnh `"pen"` và `"eraser"`.

- `mousedown`: nhớ điểm bắt đầu, `activeRef.current = "shape"`.
- `mousemove`: `box = normalizeBox(start.x, start.y, p.x, p.y, opts)` với
  `opts.square = ev.shiftKey` cho hình đóng, `opts.snap = ev.shiftKey` cho
  đường thẳng và mũi tên. Đẩy vào state qua `pushDraft` sẵn có (rafThrottle) —
  `draft` giờ mang thêm `kind` và `fill`.
- `mouseup`: đường chéo < 4 thì `live?.cancelStroke()` rồi thôi; ngược lại
  `onStrokeDone({ kind, color, w, fill, pts: box })` và `live?.endShape(id)`.
  Hình mở không đặt `fill` vào object.

`onBlur` sẵn có đã dọn theo `activeRef` nên nhánh mới không cần thêm gì ngoài
việc reset điểm bắt đầu.

## F. Realtime — kênh `live:ink` dùng lại

Không thêm kênh mới. Gói hình khối khác gói nét bút ở **ngữ nghĩa hình học**:

| | nét bút | hình khối |
|---|---|---|
| gói mang gì | ĐIỂM MỚI THÊM | CẢ HỘP 4 số |
| người nhận làm gì | nối thêm | **thay** |
| mất một gói | nét khuyết khúc vĩnh viễn | gói sau tự chữa |

### Client phát — `lib/useInkLive.js`

Ba hàm mới, `strokeId`/`seq`/TTL dùng chung với bút:

```js
beginShape(kind, color, w, fill, box)   // emit ngay: { strokeId, seq: 0, kind, color, w, fill, pts: box }
pushShape(box)                          // throttled: { strokeId, seq: n, kind, pts: box }
endShape(drawingId)                     // flush hộp treo rồi emit gói done y như endStroke
```

**`pushShape` KHÔNG cần bộ tích luỹ, và đó không phải sơ suất.** Bút phải có
`pendingPtsRef` vì `trailingThrottle` *thay* tham số đang chờ (`pending = args`),
nên ba lần gọi trong cùng cửa sổ 40ms sẽ làm mất hai lô điểm đầu. Với hộp thì
"thay tham số đang chờ" là **đúng hành vi mong muốn**: hộp sau đã chứa trọn
thông tin của hộp trước. Nên `pushShape` truyền `box` thẳng làm tham số của
throttle:

```js
// kindRef do beginShape đặt, để gói giữa chừng không phải nhận lại kind từ
// useInk mỗi lần chuột nhích.
flushBoxRef.current = trailingThrottle((box) => {
  seqRef.current += 1;
  socketRef.current?.emit("live:ink", { strokeId: strokeIdRef.current, seq: seqRef.current, kind: kindRef.current, pts: box });
}, INK_SEND_MS);
```

`cancelStroke` phải huỷ thêm `flushBoxRef` — cùng lý do đã ghi trong ghi chú
của nó về `flushEraseRef`: một timer còn treo bắn *sau* gói `cancel` sẽ dựng lại
đúng entry vừa bị xoá, và hình tạm sống lại trên màn hình người khác tới hết
TTL dù người vẽ đã rời tab.

**Gói hình khối mang `kind` ở MỌI gói**, không chỉ gói `seq: 0`. Tốn chừng 10
byte một gói, đổi lấy hai thứ: server kiểm được `pts.length === 4` trên mọi gói
(nó không giữ state theo `strokeId`), và `mergeInkPacket` nhánh theo
`packet.kind` chứ không phải nhớ `kind` của gói đầu.

### Client nhận — `lib/ink-live.js`

`mergeInkPacket` thêm nhánh:

- `seq: 0` — entry lưu thêm `kind` (mặc định `"pen"` khi gói không có) và `fill`.
- `seq > 0` — `packet.kind` là hình khối thì `pts: pts.slice()` (**thay**);
  không thì `pts: cur.pts.concat(pts)` như cũ.

Entry overlay đổi từ `{ color, w, pts, drawingId, erase, expiresAt }` thành
`{ kind, fill, color, w, pts, drawingId, erase, expiresAt }`. Test sẵn có của
`ink-live.test.js` so sánh cả entry sẽ đỏ — cập nhật assertion, đừng nới nó
thành so sánh từng field lẻ.

`reconcileInkOverlay` không đổi: nó chỉ nhìn `drawingId` và `erase`.

### Server — `sanitizeInk`

Thêm một danh sách `kind` hợp lệ, kèm ghi chú trỏ về
`client/src/lib/shape.js` để hai bên không lệch:

```js
const LIVE_INK_KINDS = new Set(["pen", "rect", "ellipse", "line", "arrow", "triangle", "diamond"]);
```

- Gói có `kind`: phải nằm trong Set, không thì trả `null`. `kind !== "pen"` thì
  `pts` phải **đúng 4 số** (kiểm trước khi `slice`, để một mảng 4000 số không
  bị cắt thành 4 rồi lọt qua).
- Gói `seq: 0` có `kind !== "pen"`: `fill` chuyển thành boolean bằng
  `payload.fill === true` — không tin kiểu client gửi.
- Chặn viewer (`socket.data.role === "viewer"`) và tự đính `socketId` như spec 1
  đã làm, không đổi.

## G. Vẽ ra màn hình — `components/InkLayer.jsx`

`Stroke` nhận thêm `kind` và `fill`:

```js
const d = !kind || kind === "pen" ? strokePath(pts) : shapePath(kind, pts);
```

**Một cái bẫy phải xử lý, không phải tuỳ chọn:** `styles/idea-map.css` đang có
`.ink-layer path { fill: none; ... }`. Trong SVG, **CSS thắng presentation
attribute**, nên viết `fill={...}` trên `<path>` sẽ bị dòng CSS đó đè và không
có hình nào tô được. Bỏ `fill: none` khỏi khối CSS đó và luôn truyền `fill`
tường minh trên mọi `<path>` — nét bút và hình mở truyền `"none"`.

Ba nguồn nét (đã lưu, mình đang kéo, người khác đang vẽ) vẫn đi qua đúng một
component `Stroke`, không sinh đường code thứ hai.

## H. i18n

Chuỗi mới đều đi qua `@lingui/react/macro`: `<Trans>` cho nội dung, `` t`…` ``
cho `title`. Nguồn là tiếng Việt; bản tiếng Anh thêm vào
`src/locales/en/messages.po`. Chuỗi mới: tên tool "Hình khối (S)", sáu tên hình,
"Chỉ viền", "Tô cả hình".

## Kiểm thử

**`lib/shape.test.js`** — mới:

- `normalizeBox`: kéo ngược chiều vẫn ra hộp đúng; làm tròn về số nguyên;
  `square` ép `|dx| = |dy|` và giữ dấu; `snap` ép về 0/45/90°.
- `shapePath`: mỗi `kind` trả chuỗi bắt đầu bằng `M`; bốn hình đóng kết bằng
  `Z`; ê-líp có `A`; hộp suy biến không làm hàm ném lỗi.
- `shapeOutline`: bao của mỗi hình nằm trong hộp; ê-líp ra 32 điểm; mảng luôn
  có độ dài chẵn.
- `drawingsHitBy`: năm test chuyển từ `stroke.test.js` (nét bút) vẫn xanh; chạm
  viền chữ nhật thì trúng; điểm giữa chữ nhật `fill: false` thì **không** trúng;
  cùng điểm đó với `fill: true` thì trúng; `w` lớn nới ngưỡng chạm; ê-líp phân
  biệt được trong và ngoài.

**`lib/ink-live.test.js`** — mở rộng: gói `seq: 0` của hình lưu `kind` và
`fill`; gói `seq > 0` của hình **thay** hộp chứ không nối; gói của bút vẫn nối
như cũ.

**`lib/pen.test.js`** — mở rộng: `kind` lạ và `fill` không phải boolean thì rơi
về mặc định của riêng key đó, không làm mất `color`/`w` đang lưu.

**Smoke test** (`src/__smoke__/entry.jsx` + `smoke-run.mjs`) — bốn nhóm mới:

- Bấm `s` thì khu 2 sáng nút hình khối và khu 4 hiện 6 + 7 + 3 + 2 nút.
- Kéo chuột ở tool hình khối ra đúng một `<path>` mới trong `.ink-layer`, có
  `fill` khác `"none"` khi bật "cả hình", và lưu đúng **một** PUT.
- Cục gôm quét vào giữa một hình `fill: true` thì xoá được nó.
- Gói `live:ink` phát ra mang `kind` ở mọi gói và `pts` dài đúng 4; nhận một
  gói hình của người khác thì hiện thêm một `<path>`; nhận gói `seq` sau thì
  hộp bị **thay**, không dài ra.

**Kiểm tay trên app đang chạy** — hai tab cùng một board:

- Vẽ đủ sáu hình, cả viền cả tô, cả `Shift`; nhìn tab kia thấy hình lớn dần
  theo con trỏ, không nháy lúc thả chuột.
- Chọn đường thẳng thì nút "cả hình" mờ đi và `fill` về viền.
- Zoom sâu vào ê-líp: viền còn mịn.
- Đổi theme sáng/tối: màu viền và màu tô đều đúng.
- Tài khoản chỉ xem: nút hình khối mờ, không vẽ được, nhưng thấy hình người
  khác đang vẽ.
- Đóng tab giữa lúc đang kéo hình: hình tạm bên tab kia tự dọn.

**Server không có bộ test nào** — mức kiểm tự động duy nhất cho `sanitizeInk` là
`node --check` cộng phần phủ gián tiếp qua smoke test của client. Giống spec 1,
đây là lớp xác minh còn thiếu.

## Hạn chế đã biết

- **Hình tô đặc che thẻ nằm dưới.** Lớp nét vẽ ở `z-index: 7`, trên mọi thẻ.
  Bấm vào thẻ bị che thì vẫn bấm được (`.ink-layer` có `pointer-events: none`)
  nhưng mắt không thấy nó. Chủ ý chấp nhận: spec 3 làm z-order sẽ cho đẩy từng
  hình xuống dưới.
- **Vẽ sai thì gôm hoặc `Ctrl+Z`**, không sửa được hình đã vẽ — không đổi kích
  thước, không đổi màu, không di chuyển. Spec 3.
- **`shapePath` và `shapeOutline` là hai bản mô tả hình học** của cùng một
  hình, có thể lệch. Xem mục C để biết vì sao chấp nhận.
- **`nextDrawingId` trùng khi hai người vẽ cùng lúc** — như spec 1, cùng hạng
  rủi ro với `nextNodeId`. Không xử lý riêng.
- **Mỗi hình vẽ xong là PUT cả board** — vấn đề có sẵn của kiến trúc lưu. Một
  hình khối chỉ 4 số nên nó nhẹ hơn nét bút nhiều.
- **`drawings` vẫn là `Array` không kiểu trong schema, PUT ghi thẳng những gì
  client gửi.** Server tin hoàn toàn client có quyền sửa. Đã nêu ở spec 1; nên
  validate phía server thành một việc riêng.
- **`LIVE_INK_KINDS` ở server là bản sao tay của `SHAPE_KINDS`.** Server không
  import được lib của client. Có ghi chú trỏ chéo hai chiều; thêm `kind` mới thì
  phải sửa hai chỗ.

## Ngoài phạm vi

- Chọn / di chuyển / đổi kích thước / đổi màu nét và hình đã vẽ — spec 3.
- z-order tổng, đưa lên trước / đưa ra sau cho cả nét vẽ lẫn thẻ — spec 3.
- Ngôi sao và mũi tên hai đầu: spec 1 có nêu, đợt này bỏ vì trên bản đồ ý tưởng
  gần như không dùng tới. Thêm sau chỉ là thêm một `kind`.
- Tô nền chọn màu riêng khác màu viền, và độ mờ nền.
- Chữ bên trong hình khối — muốn có chữ thì dùng thẻ.
- Hình khối bám (snap) vào thẻ hoặc vào lưới.
- Không tách nhỏ `IdeaMap.jsx` ngoài việc để logic mới ra file riêng.
