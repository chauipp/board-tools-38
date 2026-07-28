# Bản đồ ý tưởng — tool text

Ngày: 2026-07-28
Base: `idea-map-theme-sketch` (sau `b3d149b`)

## Bối cảnh

Khu 2 của thanh công cụ trái hiện có ba tool: **Bút**, **Cục gôm**, **Hình
khối**. Thiếu một thứ mà mọi bảng vẽ đều có: **gõ chữ thẳng lên bảng**, không
phải tạo một cái thẻ.

Thẻ (`node`) là một vật thể nặng: có tiêu đề, mô tả, trạng thái, nhãn, bình
luận, yêu thích, bốn dấu nối dây. Muốn chú thích một chữ "chỗ này còn thiếu"
cạnh một cụm hình thì tạo thẻ là quá tay — và cái thẻ đó sẽ lọt vào bộ lọc, vào
mục lục, vào trình chiếu, vào tổng số "khớp N/M".

Chữ trên canvas **đã theo skin vẽ tay** từ đợt trước (`--canvas-font` áp cho
`.idea-card`, `.frame-box`, `.edge-label`), nên text mới chỉ cần dùng đúng biến
đó là tự có hai kiểu chữ.

## Quyết định nền: text là một phần tử `drawings`

Text **không có kiểu dữ liệu riêng**. Nó là một phần tử của `board.drawings`
như nét bút và hình khối, chỉ khác `kind`:

```js
{ id, kind: "text", pts: [x, y], text: "…", color: "pen-red", size: 20, w, h }
```

Đây là đúng cái mẹo spec hình khối đã dùng, và nó trả công y như lần đó: `PUT`,
`GET`, payload realtime, hoàn tác, bốn chỗ liệt kê field ở server **không phải
sửa một dòng nào**. Cục gôm cũng dùng lại được.

Khác nét bút và hình khối ở ba điểm, và cả ba đều có lý do:

- `pts` chỉ có **2 số** — một điểm neo (góc trên trái), không phải hộp: cỡ chữ
  quyết định chiều cao, nội dung quyết định chiều rộng, nên kéo ra một cái hộp
  là vô nghĩa.
- Có `text` và `size`, không có `w` (độ dày nét).
- Có `w`/`h` **đo được lúc commit**, lưu kèm. Không đo lại lúc hit-test vì đo
  chữ cần DOM, mà `drawingsHitBy` là hàm thuần chạy trong `node:test`.

## A. Khu 2 — nút thứ tư

Sau Bút, Cục gôm, Hình khối: **Text** (`tool === "text"`). Icon inline SVG theo
`currentColor` như ba nút kia — chữ "T" vẽ bằng path, không phải ký tự thật.

Phím tắt `t` — đã kiểm, chưa bị chiếm trong `IdeaMap.jsx`; vào cùng nhánh với
`p`, `e`, `s`:

```js
else if (key === "t") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("text"); }
```

## B. Khu 4 — cỡ chữ và màu

Hai nhóm, dùng lại đúng khuôn của bút:

```
┌──────┐
│ A  A │  3 cỡ: nhỏ 14 / vừa 20 / lớn 30
│ A    │
├──────┤
│ ●  ● │
│ ●  ● │  7 màu — dùng lại y nguyên bộ màu bút
│ ●  ● │
│ ●    │
└──────┘
```

Cỡ là **ba mức cố định**, không phải ô nhập tự do: cùng lý do ba mức độ dày nét
của bút — trên một bảng chung, ba cỡ thì còn ra một hệ phân cấp, còn tự do thì
mỗi người một cỡ và bảng thành cái chợ.

Cỡ lưu vào `penPrefs` (`localStorage` khoá `ideamap.pen`) như `color` / `w` /
`kind` / `fill`, thêm khoá `size`. Giá trị hỏng lùi về mặc định theo từng khoá,
đúng cách `loadPenPrefs` đang làm.

## C. Tạo và sửa

**Tạo**: đang cầm tool Text, bấm lên chỗ trống → hiện ngay một ô nhập tại chỗ,
con trỏ nháy sẵn. Gõ. Kết thúc bằng `Escape` hoặc bấm ra ngoài. Chuỗi rỗng (hoặc
chỉ có khoảng trắng) thì **không tạo gì** — không đẻ ra phần tử rác vô hình.

**Sửa**: bấm đúp vào một text đã có → cùng ô nhập đó, mang sẵn nội dung cũ. Xoá
sạch chữ rồi kết thúc = xoá phần tử.

Ô nhập là một `<textarea>` HTML thật đặt chồng lên canvas, **cùng font, cùng cỡ,
cùng màu, cùng chiều cao dòng** với chữ sẽ được vẽ ra. Nó phải trùng khít: gõ
xong thấy chữ nhảy sang chỗ khác hoặc đổi cỡ là hỏng cảm giác "gõ thẳng lên
bảng". `padding: 0; border: 0; background: transparent`, và cỡ chữ nhân với
`scale` của camera để lúc zoom vẫn khớp.

Xuống dòng bằng `Enter` — text nhiều dòng là chuyện thường với chú thích. Vậy
nên kết thúc là `Escape`, không phải `Enter`.

## D. Kéo di chuyển

Đang cầm tool Text, bấm vào một text đã có rồi kéo → text đi theo. Nhả chuột
lưu một lần.

Đây là chỗ text **cố tình khác** nét bút và hình khối, hai thứ hiện chưa di
chuyển được (việc đó đang treo ở spec "chọn / di chuyển nét đã vẽ"). Lý do:
vẽ lại một nét bút thì nhanh, còn gõ lại một đoạn chú thích ba dòng vì đặt lệch
20px thì không ai chịu được.

Phân biệt bấm-để-kéo với bấm-đúp-để-sửa theo cách thường gặp: mousedown trên
text bắt đầu một lượt kéo, di dưới ngưỡng 3 đơn vị canvas thì coi như không kéo;
`dblclick` mở ô nhập.

## E. Vẽ ra

Trong `InkLayer`, cùng lớp SVG với nét bút và hình khối — nhờ vậy thứ tự trên
dưới giữa chữ và hình là nhất quán, và cục gôm quét qua là ăn cả ba loại.

`<text>` với một `<tspan>` cho mỗi dòng. CSS:

```css
.ink-layer text { font-family: var(--canvas-font); white-space: pre; }
```

Một dòng đó là toàn bộ phần "skin cho text": bật skin vẽ tay là chữ trên bảng
thành chữ viết tay, không cần code.

**Không** dùng `sketchy.js` cho text: nét rung là để làm mềm hình khối, còn bẻ
cong chữ thì chỉ làm nó khó đọc.

## F. Đo chữ

`w`/`h` đo lúc commit rồi lưu kèm phần tử. Phép đo tách làm hai tầng:

- `lib/text-el.js` — **thuần**, nhận hàm đo bề rộng qua tham số:
  `textBox(lines, size, measureWidth) -> { w, h }`. Test bằng một hàm đo giả
  (mỗi ký tự rộng 10) nên kiểm được đúng logic gộp dòng, không phụ thuộc font
  máy chạy test.
- Người gọi trong `IdeaMap.jsx` truyền hàm đo thật, dựng bằng
  `canvas.getContext("2d").measureText` với đúng chuỗi font đang hiển thị. Đây
  là cách `png-export.js` đã dùng, không phát minh gì mới.

Đổi skin làm chữ rộng ra hoặc hẹp lại so với `w` đã lưu. Chấp nhận: `w`/`h` chỉ
dùng cho vùng chạm của cục gôm và vùng bấm để kéo, lệch vài phần trăm không ai
thấy. Đo lại toàn bộ mỗi lần đổi skin thì phải ghi lại cả `drawings` lên server
chỉ vì một người đổi kiểu xem — sai hẳn về chất.

## Realtime

Text đi qua `commitStroke` sẵn có → `board:update` như mọi thay đổi khác. **Không**
có kênh xem trước trực tiếp (`live:ink`) cho việc gõ chữ và kéo text: người khác
thấy khi mình gõ xong, không thấy từng ký tự.

Cố ý. `live:ink` sinh ra cho nét đang kéo — thứ mất vài giây và nhìn nó lớn dần
mới có nghĩa. Gõ chữ thì cái đáng xem là kết quả; phát từng phím lên cho cả
phòng vừa tốn vừa gây nhiễu.

## Kiểm thử

Tự động:
- `lib/text-el.js` — `TEXT_SIZES`, tách dòng (kể cả `\r\n` và dòng trống cuối),
  `textBox` với hàm đo giả, `textHitBy` (trong hộp / ngoài hộp / sát mép có cộng
  bán kính gôm).
- `lib/shape.test.js` — `drawingsHitBy` nhận thêm `kind: "text"`, và **không**
  làm hỏng đường của `pen` / sáu hình khối.
- `lib/pen.test.js` — `size` hỏng thì lùi mặc định, không kéo theo `color` / `w`.
- `npm run test:smoke` — bấm nút Text, bấm lên bảng, gõ, `Escape`, kiểm có đúng
  một `<text>` trong `.ink-layer` và board có thêm một `drawings` `kind: "text"`.

Kiểm tay:
- Gõ tiếng Việt có dấu ở **cả hai skin** — ô nhập và chữ vẽ ra phải cùng font.
- Zoom 50% và 200% rồi gõ: ô nhập trùng khít chỗ chữ sẽ hiện.
- Gõ ba dòng, kiểm cục gôm quét trúng cả ba dòng chứ không chỉ dòng đầu.
- Kéo một text ba dòng sang chỗ khác, tải lại trang, kiểm nó ở đúng chỗ mới.
- Hai tab: tab A tạo text → tab B thấy sau khi A kết thúc gõ.
- Bấm lên bảng rồi `Escape` ngay, không gõ gì → không tạo phần tử nào (kiểm
  bằng Xuất JSON).
- Tài khoản chỉ xem: nút Text mờ, nhưng thấy được text người khác tạo.
- Hoàn tác sau khi tạo / sửa / kéo / xoá.

## Ngoài phạm vi

- Chữ **bám vào hình khối** (hình di thì chữ di theo, chữ dài tự xuống dòng
  trong hình) — muốn chữ trong khung thì đặt text đè lên hình, hoặc dùng thẻ,
  vốn đã là "hình có chữ".
- Chọn text ở mode Chuột, kéo nhiều text một lúc, ô chọn quét trúng text — cả
  cụm này thuộc đợt "chọn / di chuyển nét đã vẽ" đang treo.
- Căn lề (trái/giữa/phải), đậm/nghiêng, gạch chân.
- Đổi cỡ hoặc màu của một text **đã tạo** — hiện phải xoá và gõ lại. Menu chuột
  phải cho phần tử `drawings` chưa có, dựng riêng cho mỗi việc này thì không đáng.
- Xem trước trực tiếp lúc gõ và lúc kéo (xem mục Realtime).
- Nét rung cho chữ.
- Không tách nhỏ `IdeaMap.jsx` ngoài việc để logic mới ra file riêng.

---

## Plan thực thi

Spec này đã được chuyển thành plan thực thi từng task:

**→ [`docs/superpowers/plans/2026-07-28-idea-map-text-tool.md`](../plans/2026-07-28-idea-map-text-tool.md)**
