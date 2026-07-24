# Idea Map: khung bao quanh (frame) + màu card

## Bối cảnh

`IdeaMap.jsx` là sa bàn (canvas) kéo-thả các "idea card" nối với nhau bằng edge, lưu
trong document `IdeaBoard` (Mongo) qua `board.nodes` / `board.edges` / `board.statuses` /
`board.tags`. Yêu cầu thêm 2 tính năng:

1. Một khung (frame) bao quanh nhiều card, kéo thêm card vào được, và khung có thể nối
   edge với card bên ngoài nó.
2. Card có màu, đổi màu bằng chuột phải; vẫn giữ được cách sửa nội dung card.

## Data model

- `board.groups: [{ id, title, x, y, w, h, color }]` — mảng mới, ngang hàng `nodes`/`edges`.
  Server thêm `groups: { type: Array, default: [] }` vào `ideaBoardSchema`
  (`server/index.js`) — không cần migrate vì đây là field mới, mặc định `[]`.
- Node (card) thêm field `color` (token màu từ `BADGE_PALETTE`, nullable). Không cần đổi
  schema server vì `nodes` đã là mảng kiểu tự do (Mixed).
- **Không lưu danh sách thành viên khung.** Card nào "thuộc" khung nào được tính theo hình
  học (tâm card nằm trong hình chữ nhật `{x, y, w, h}` của khung) tại thời điểm cần dùng
  (render viền/kéo khung/xoá khung). Tránh 2 nguồn sự thật phải đồng bộ; tự nhiên hỗ trợ
  kéo card ra/vào khung chỉ bằng cách đổi vị trí card.
- `edges` thêm field optional `fromKind` / `toKind`: `"node"` (mặc định, edge cũ không có
  field này vẫn hiểu là node) hoặc `"group"`. Cho phép một đầu edge trỏ vào khung thay vì
  card.

## Hành vi khung (frame)

- **Tạo khung**: nút `+ Khung` cạnh nút `+ Ý tưởng` trên topbar → tạo khung kích thước mặc
  định 480×320 tại giữa viewport hiện tại (cùng cách tính toạ độ như `handleAddClick`).
- **Kéo khung**: bấm-giữ vào thân/viền khung (không phải lên 1 card đang nằm trong đó) →
  tại `mousedown`, tính tập card có tâm nằm trong rect khung → khi kéo, dịch chuyển khung
  và toàn bộ card đó theo cùng delta (x, y). Tái dùng đúng pattern dx/dy đang dùng cho kéo
  multi-select ở `handleNodeMouseDown`.
- **Resize**: 1 tay cầm ở góc dưới-phải khung, kéo để đổi `w`/`h`. Resize không kéo card
  theo — card có thể lòi ra ngoài biên sau khi resize, chấp nhận được.
- **Connector**: khung có 4 connector-zone (trên/phải/dưới/trái) giống card, tái dùng CSS
  `.connector-zone`/`.connector-dot` hiện có. Kéo từ 1 connector tới 1 card khác (hoặc khung
  khác) tạo edge với `fromKind: "group"`.
- **Tiêu đề khung**: 1 dòng text, sửa bằng double-click vào vùng tiêu đề (input thay chỗ text,
  Enter/blur để lưu — cùng pattern input-inline đã dùng trong app).
- **Xoá khung**: nút xoá nhỏ ở góc khung (giống `.icon-btn` trên card). Xoá khung chỉ xoá
  khung + các edge có đầu là khung đó; **không xoá card bên trong**.
- Không hỗ trợ khung lồng khung.

## Render / z-order

- Khung render trong layer riêng, **dưới** layer card (để card luôn ở trên, bắt được click/
  drag của card trước). Khung không chặn pointer-event ở vùng giữa (chỉ viền/tiêu đề/tay
  cầm resize là bắt event) để không cản thao tác trên card nằm trong.

## Màu card

- Card thêm dải màu ~4px bên trái (`border-left`), nền giữ nguyên (`--surface-2`) như hiện
  tại. Không tô nền toàn card.
- **Chuột phải vào card** (đã bị chặn context-menu mặc định của trình duyệt ở mức trang) →
  mở popover nhỏ, tái dùng style `.badge-editor`:
  - hàng swatch màu, tái dùng `BADGE_PALETTE`
  - nút **Sửa** → gọi `onEdit()` hiện có (mở form edit inline của card)
  - đóng khi click ra ngoài / Esc (giống `BadgeEditor`)
- Nút ✎ (sửa) trên card giữ nguyên như hiện tại — không thay thế, chỉ thêm lối tắt qua
  chuột phải.

## Gom nhóm từ multi-select

- Khi đã bôi đen (marquee) từ 2 card trở lên, chuột phải vào một card đang được chọn →
  popover màu của card có thêm nút **Gom nhóm**: tạo một khung mới bao quanh bounding box
  của các card đã chọn (padding đều 4 phía, chừa chỗ cho tiêu đề), tiêu đề mặc định
  `Khung mới`. Card giữ nguyên vị trí — khung ôm quanh chúng (membership theo hình học
  như mọi khung khác).
- Chuột phải vào card không thuộc selection, hoặc selection < 2 card → popover như cũ,
  không có nút Gom nhóm.

## Ngoài phạm vi

- Không animation kéo-thả cầu kỳ, không giới hạn số card/khung, không khung lồng khung,
  không tô nền toàn card. Giữ nguyên các pattern tương tác thuần mousedown/mousemove/mouseup
  đã có trong file.
