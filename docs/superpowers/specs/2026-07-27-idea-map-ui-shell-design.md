# Bản đồ ý tưởng — sửa vỏ giao diện & phím tắt tạo thẻ

Ngày: 2026-07-27
Nhánh: `worktree-idea-map-ui-shell` (base `origin/main`)

## Bối cảnh

Năm thay đổi độc lập lên trang `/idea-map/:boardId`. Bốn cái đầu là vỏ giao
diện (chỗ đặt control), cái thứ năm sửa thuật toán đặt thẻ mới cho đúng ý
"bấm hướng nào ra hướng đó".

### Cảnh báo va chạm

Worktree chính đang có một đợt refactor chưa commit tách `IdeaMap.jsx` thành
`IdeaCard.jsx` / `EdgeLayer.jsx` / `PeerLayer.jsx` và viết lại `usePresence.js`,
`useLiveSync.js`. Spec này làm trên `origin/main` (IdeaMap.jsx còn nguyên khối
2972 dòng). Merge về sau sẽ conflict ở `IdeaMap.jsx` và vùng presence — giải
quyết thủ công, không có cách né.

## A. Đưa VI/EN và nút sáng/tối ra khỏi dropdown XEM

Hiện tại `LocaleToggle` và nút `◐` nằm trong `TopMenu label="Xem"`, sau một
`menubar-sep`. Phải bấm XEM mới đổi được ngôn ngữ.

Sau thay đổi: hai nút là phần tử độc lập của `.topbar`, đứng ngay bên phải nút
XEM. Dropdown XEM chỉ còn Trình chiếu + Mục lục, và `menubar-sep` /
`menubar-row` trong đó bị gỡ.

## B. Thanh presence cuối hàng filter

Gom danh tính người dùng, người đang online và nút mời vào một chỗ.

Component mới `components/PresenceBar.jsx`, render trong `.filterbar` sau
`<div className="spacer"/>` của `.fb-tabs`.

Nội dung, trái sang phải:

1. Avatar từng peer đang online — nguồn là `presencePeers` từ `usePresence`
   (server đã gửi kèm `email`, `name`, `picture`, `x`, `y`). Viền tô bằng
   `cursorColor(peer.email)` để khớp màu con trỏ trên canvas. Tooltip = tên.
   Chỉ hiện người đang kết nối; thành viên offline không hiện (không gọi
   `GET /api/boards/:id/members`).
2. Nút **+ Mời** — chỉ khi `role === "owner"`, mở `InviteModal` đang có sẵn.
   Mục "Mời thành viên" trong dropdown BOARD bị gỡ.
3. Avatar của chính mình (từ `useAuth`) — bấm mở menu nhỏ chứa **Đăng xuất**.

Bấm avatar một peer → camera pan về vị trí con trỏ của họ (`peer.x`, `peer.y`
là toạ độ canvas), giữ nguyên `scale`, đặt điểm đó vào giữa viewport:

```
panX = rect.width  / 2 - peer.x * scale
panY = rect.height / 2 - peer.y * scale
```

Kèm highlight con trỏ peer đó khoảng 1 giây để mắt bắt được sau khi màn hình
nhảy. Camera là dữ liệu cục bộ (`lib/camera.js`) nên thao tác này không đụng
tới `board` và không tạo entry undo.

Peer không có `picture` (hoặc ảnh lỗi) → fallback chữ cái đầu của tên trên nền
`cursorColor(email)`, cùng cách `IdentityChip` đang xử lý `onError`.

### Chip danh tính cũ ở góc dưới trái

`IdentityChip` hiện render trong `AuthGate`, tức mọi trang. Nó nằm ngoài
`BrowserRouter` nên không đọc được route. Chuyển nó vào trong `BrowserRouter`
và ẩn khi `useLocation().pathname` khớp `/idea-map/:boardId`. Trang chủ,
danh sách board, calculator giữ nguyên chip góc dưới trái.

## C. Tạo thẻ đúng hướng đã bấm

`createLinkedNode(sourceId, direction)` hiện có hai chỗ sai so với yêu cầu:

- Bước đẩy `x += dir[0]*STEP + (dir[0]===0 ? STEP : 0)` cộng thêm `STEP` vào
  trục vuông góc. Bấm ↑ hoặc ↓ thì thẻ trôi chéo sang phải thay vì đi thẳng.
- Khi đẩy hết khung nhìn mà chưa tìm được chỗ trống, nó quét lưới toàn bộ
  viewport và đặt thẻ ở ô trống đầu tiên — thẻ rơi vào chỗ không liên quan gì
  tới hướng đã bấm.

Thay bằng: tách thuật toán ra module thuần `lib/place-node.js`, hàm

```js
placeLinkedNode({ anchor, anchorSize, newSize, direction, obstacles, viewport, gap, step })
  -> { x, y, panTo: { x, y } | null }
```

Quy tắc:

1. Vị trí đầu tiên = tâm anchor dịch theo `direction` một khoảng
   `anchorSize/2 + gap + newSize/2`.
2. Còn chồng lên obstacle nào → đẩy tiếp **đúng một hướng đó** thêm `step`,
   lặp lại. Trục vuông góc không đổi.
3. Có giới hạn số lần lặp (an toàn khi board dày đặc) — chạm giới hạn thì
   nhận vị trí cuối cùng dù còn chồng, không quay về quét lưới.
4. Vị trí chốt nằm ngoài `viewport` (đã trừ margin) → trả `panTo` là toạ độ
   canvas cần đưa vào giữa màn hình. `IdeaMap` dùng nó tính `view` mới.

Bỏ hẳn nhánh quét lưới. Module này có `place-node.test.js` đi kèm (vitest,
cùng kiểu các test lib đang có).

## D. Enter / Shift+Enter trên thẻ đang chọn

Thêm vào handler keydown toàn cục trong `IdeaMap.jsx`. Handler đã tự thoát sớm
khi `e.target` là input/textarea/contentEditable, nên thẻ đang ở chế độ sửa
không bị dính — đúng yêu cầu "không phải trạng thái đang sửa".

Điều kiện chung: `role !== "viewer"`, `selectedIds.size === 1`, không đang
trình chiếu, không có menu/popover nào mở.

- **Enter** → tạo thẻ con bên phải: `createLinkedNode(id, "right")`.
- **Shift+Enter** → tạo thẻ cùng cấp. Tìm cha qua `board.edges`: cạnh có
  `to === id` và `toKind !== "group"`, lấy `from` làm cha. Thẻ mới nối dây từ
  **cha**, nhưng vị trí tính từ **thẻ đang chọn**, hướng `bottom`.
  Thẻ đang chọn không có cha → không làm gì.

Để tách "neo hình học" khỏi "neo nối dây", `createLinkedNode` nhận thêm tuỳ
chọn `anchorId` (mặc định = `sourceId`): `sourceId` quyết định cạnh nối,
`anchorId` quyết định chỗ đặt.

Cả hai trường hợp đều `setEditingId(id)` — thẻ mới mở sẵn ô sửa tên, gõ xong
Enter là lưu (hành vi giống nút `+` trên thẻ hiện tại).

## E. Ctrl+F nhảy vào ô tìm kiếm

Trong handler keydown, nhánh `e.ctrlKey || e.metaKey` hiện `return` sớm khi
`role === "viewer"`. Ctrl+F chỉ đọc, không ghi, nên xử lý **trước** guard đó.

`e.preventDefault()` để chặn hộp tìm kiếm của trình duyệt, rồi `focus()` +
`select()` ô search qua `searchInputRef` mới. `select()` để gõ tiếp là đè lên
từ khoá cũ.

## Kiểm thử

- `lib/place-node.test.js` — mới: đặt thẳng bốn hướng, đẩy qua vật cản không
  lệch trục vuông góc, chạm giới hạn lặp, tính `panTo` khi ra ngoài khung nhìn.
- `npm test` (vitest) toàn bộ phải xanh.
- Kiểm tay trên app đang chạy: đổi ngôn ngữ không cần mở XEM; presence bar
  hiện avatar và bấm avatar peer thì camera nhảy; bấm `+` bốn hướng ra thẻ
  đúng hướng; Enter/Shift+Enter; Ctrl+F.

## Ngoài phạm vi

- Không hiện thành viên offline (đã chốt: chỉ người đang online).
- Không đụng `usePresence.js` / `useLiveSync.js` / server — giảm bề mặt
  conflict với đợt refactor song song.
- Không tách nhỏ `IdeaMap.jsx` — đợt refactor song song đang làm việc đó.
