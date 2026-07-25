# Idea Map: bảng màu tự tạo + filterbar dạng accordion

## Bối cảnh

Hiện `IdeaMap.jsx` có 3 chỗ tô màu, tất cả đều lưu **token** màu chứ không lưu mã hex:

- `node.color` → dải màu bên trái card (`border-left-color`)
- `edge.color` → màu dây (`stroke`)
- `status.color` / `tag.color` → màu badge (pill trên card + chip trên filterbar)

Token là tên biến CSS (`"dot-1"`, `"st-idea"`), render qua `colorVar(token)` → `var(--dot-1)`.
Tập token cố định trong `BADGE_PALETTE` ([`lib/badges.js`](../../../game-tools/client/src/lib/badges.js)),
giá trị thật khai báo trong [`index.css`](../../../game-tools/client/src/index.css) cho cả theme sáng và tối.

Yêu cầu:

1. Một **bảng màu** người dùng tự tạo được, màu đã tạo thì lưu lại để dùng tiếp.
2. Click trái vào màu đã lưu → sửa được bằng chính bộ chọn màu.
3. Kéo màu thả vào đâu thì chỗ đó nhận màu — card, dây, badge.
4. Sửa màu đã lưu thì **mọi chỗ đang dùng màu đó đổi theo** (liên kết sống).
5. Filterbar (Trạng thái / Nhãn) chuyển thành các khung bật-tắt được, thêm khung thứ ba là Bảng màu.

Đây là **giai đoạn 1**. Việc kéo-thả panel tự do, xoay ngang/dọc và snap vào vị trí là
giai đoạn 2, spec riêng — giai đoạn này panel nằm cố định trong filterbar.

## Data model

- `board.palette: [{ id, hex }]` — mảng mới ngang hàng `statuses`/`tags`. `hex` là chuỗi
  `"#rrggbb"` do `<input type="color">` sinh ra.
- `board.nextPaletteId: number` — cùng pattern cấp id như `nextStatusId`/`nextTagId`.
- Màu tự tạo mang token **`"pal-<id>"`**. Không thêm field mới vào node/edge/status/tag:
  chúng vẫn lưu token như cũ, chỉ là token giờ có thể là `"pal-3"` thay vì `"dot-1"`.
- Server ([`server/index.js`](../../../game-tools/server/index.js)) thêm `palette: { type: Array, default: [] }`
  và `nextPaletteId: { type: Number, default: 1 }` vào `ideaBoardSchema`, **và** thêm cả hai
  vào danh sách destructure + object update của `PUT /api/ideas`. Bỏ bước này thì palette
  không lưu được (route chỉ ghi đúng các field được liệt kê tường minh). Không cần migrate:
  field mới, board cũ nhận giá trị mặc định.

## Liên kết sống — để CSS lo

Toàn bộ định nghĩa màu tự tạo nằm trong **một** thẻ `<style>` render từ `board.palette`:

```jsx
<style>{`:root {\n${board.palette.map((c) => `  --pal-${c.id}: ${c.hex};`).join("\n")}\n}`}</style>
```

Sửa hex của một swatch → chỉ dòng khai báo đó đổi → mọi card / dây / badge đang dùng
`var(--pal-3)` repaint ngay. Không cần code đi tìm và ghi lại từng chỗ tham chiếu, không
cần thêm lớp gián tiếp: `colorVar()` giữ nguyên không đổi một dòng, và cascade của CSS
chính là cơ chế liên kết sống.

Thẻ `<style>` này render trong JSX của chính component `IdeaMap`, cạnh `.filterbar` — nó
phụ thuộc `board.palette` nên phải nằm trong cây React để tự cập nhật, không dùng
`document.head` thủ công.

Ghi màu vào board ở sự kiện **`change`** của color input (lúc người dùng đóng bộ chọn),
một lần một commit. Không dùng `input` (phát liên tục khi kéo): bộ chọn màu của Windows là
hộp thoại **modal** — không thấy bản đồ phía sau trong lúc kéo nên preview realtime không
có giá trị gì, mà mỗi bước kéo lại thành một entry undo và một lần lưu server.

**Xoá swatch**: gỡ token khỏi mọi chỗ đang dùng nó trong cùng một lần commit —
`node.color`, `edge.color`, `status.color`, `tag.color` nào bằng `"pal-<id>"` thì set về
`null`. Nếu để nguyên token đã chết, sau này tạo swatch mới trùng id thì các thẻ cũ tự
nhiên có màu trở lại — hành vi rất khó hiểu. Với badge thì `color: null` không hợp lệ
(badge luôn cần màu để vẽ dot), nên badge nào đang dùng màu bị xoá sẽ nhận
`BADGE_PALETTE[0]` thay vì `null`.

## Filterbar dạng accordion

`.filterbar` hiện là một hàng ngang gồm `.fb-group` cho Trạng thái, Nhãn, Yêu thích, luôn
hiện hết. Chuyển thành: một hàng **nút bật-tắt** + các khung nội dung mở ra bên dưới.

- Ba nút: **Trạng thái · Nhãn · Bảng màu**. Bật/tắt **độc lập** — mở cùng lúc cả ba được.
  Nút đang mở hiển thị trạng thái active (tái dùng `.btn.toggle.active` đã có).
- Mặc định: Trạng thái + Nhãn mở, Bảng màu đóng → giữ đúng hành vi hiện tại khi mới vào.
- Chip **★ Yêu thích** và cụm `.fb-tail` (số khớp + Xoá lọc) nằm ngoài accordion, luôn hiện —
  đây là bộ lọc chứ không phải nội dung cần gấp lại.
- Trạng thái mở/đóng chỉ giữ trong `useState`, **không** lưu qua reload.

## Bảng màu

Nội dung khung: một hàng swatch tròn (tái dùng `.be-swatch`) + nút `[+]` (tái dùng `.fb-add`).

- **`[+]`** → mở popover nhỏ (tái dùng `.badge-editor`) chứa `<input type="color">`, giá trị
  ban đầu `#888888`. Xác nhận → thêm `{ id: nextPaletteId, hex }` vào `board.palette`.
- **Click trái vào swatch** → cùng popover đó ở chế độ sửa: color input mang hex hiện tại,
  chọn màu xong là toàn bản đồ đổi theo, kèm nút **Xoá màu**.
- Popover đóng khi click ra ngoài / Esc — tái dùng `useCloseOnOutside` như `BadgeEditor`.

Dùng `<input type="color">` gốc của trình duyệt, không thêm thư viện chọn màu. Bộ chọn
native đã có sẵn eyedropper, nhập hex, lưu màu gần dùng — đủ và bằng 0 dòng code.

## Kéo-thả màu

Tái dùng nguyên cơ chế của `handleChipMouseDown` — mousedown → vượt ngưỡng 5px thì tính là
kéo → mousemove cập nhật ghost + highlight đích → mouseup áp dụng. Đây là cơ chế đang chạy
tốt cho việc kéo chip Trạng thái/Nhãn vào thẻ, không phát minh lại. Ghost tái dùng
`.chip-ghost` (đã có `pointer-events: none` nên không tự che `elementFromPoint`), nội dung
là một dot màu.

Đích được phân giải bằng `document.elementFromPoint` tại điểm thả, theo thứ tự:

| `closest()` khớp | Ghi vào |
|---|---|
| `.idea-card[data-id]` | `node.color` của card đó |
| `.edge-layer .hit[data-edge-id]` | `edge.color` của dây đó |
| `[data-badge-kind][data-badge-id]` | `status.color` / `tag.color` tương ứng |
| không khớp gì | không làm gì |

Thuộc tính cần thêm (hiện chưa có):

- `data-edge-id` trên đường `.hit` của mỗi edge.
- `data-badge-kind="status"` + `data-badge-id` trên chip filterbar **và** trên
  `.status-pill` / `.tag-pill` của card — thả vào badge ở đâu cũng cùng ý nghĩa
  "đổi màu status/tag này".

Thả vào badge đổi màu của **định nghĩa** status/tag đó, nên mọi thẻ đang gắn nó đều đổi
theo. Đó là hành vi mong đợi vì badge vốn là thực thể dùng chung.

Card nằm trên edge layer trong DOM, nên khi dây đi ngầm dưới card thì `elementFromPoint`
trả về card — đúng thứ tự ưu tiên mong muốn, không cần xử lý thêm.

## Ngoài phạm vi

- **Không** kéo-thả panel tự do / xoay ngang-dọc / snap vị trí — giai đoạn 2, spec riêng.
- **Không** thêm màu tự tạo vào các hàng swatch có sẵn (`ColorMenu`, `BadgeEditor`,
  `EdgeMenu`, `bulk-bar`). Các popover đó giữ nguyên `BADGE_PALETTE` cố định; kéo-thả từ
  bảng màu chính là đường dùng màu tự tạo. Nhồi thêm vào mọi hàng swatch làm chúng phình
  ra vô hạn theo số màu người dùng tạo.
- **Không** đổi màu khung (group) bằng kéo-thả — chưa yêu cầu.
- **Không** lưu trạng thái mở/đóng accordion qua reload.
- **Không** giới hạn số màu tạo được, không đặt tên cho màu.
