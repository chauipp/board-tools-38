# Idea Map — Đợt 2: "Tổ chức & nội dung"

Nguồn: `docs/research/2026-07-24-canvas-apps-feature-research.md`. Tiếp nối Đợt 1 (đã merge
vào main). Người dùng đã duyệt làm cả 3 đợt.

## Phạm vi (5 tính năng)

### 1. Outline panel (mục lục)
- Nút **Mục lục** trên topbar bật/tắt panel dọc bên phải viewport (absolute, cuộn được).
- Nội dung: mỗi khung là một section (tiêu đề khung + số card), liệt kê card bên trong
  (membership theo hình học như kéo khung — `nodesInFrame`); sau đó các card không thuộc
  khung nào, nhóm theo trạng thái (card không trạng thái vào nhóm "Khác").
- Mỗi dòng card: chấm màu status + tiêu đề. Click dòng card → chọn card đó + bay tới
  (tái dùng zoom-to-selection). Click tiêu đề khung → bay tới bbox khung.
- Panel là view — không sửa/xoá từ panel (giữ đơn giản).

### 2. Export Markdown
- Nút **Xuất MD** trong panel mục lục: tải file `.md` — `## Tên khung` + bullet
  `- Tiêu đề (Trạng thái, Nhãn): mô tả` cho từng card, các card ngoài khung nhóm theo
  trạng thái, cuối cùng section `## Liên kết` liệt kê `- A → B` cho mọi edge (kể cả đầu
  khung). Logic nhóm dùng chung với panel (một helper thuần duy nhất).

### 3. Tidy up (Xếp gọn)
- Nút **Xếp gọn** trên thanh bulk-edit (hiện khi chọn ≥2 card): xếp các card đã chọn thành
  lưới — số cột = ceil(sqrt(n)), thứ tự đọc theo vị trí hiện tại (trên→dưới, trái→phải),
  neo tại góc trên-trái của bbox selection, khoảng cách 24px, cột/hàng rộng theo card lớn
  nhất trong cột/hàng. 1 undo step.

### 4. Markdown-lite trong mô tả card
- Ở chế độ xem (không phải edit), desc render: URL trần thành link bấm được (mở tab mới,
  click không kéo card theo), `**đậm**`, dòng bắt đầu `- ` thành bullet. Không lib ngoài,
  không hỗ trợ gì thêm (không heading/italic/code). Form edit vẫn là textarea thuần.

### 5. Quick capture (Nhập nhanh)
- Nút **Nhập nhanh** trên topbar mở modal textarea: mỗi dòng = 1 ý tưởng (title). Xác nhận
  → tạo hàng loạt card (desc rỗng, status mặc định đầu tiên như createNode) xếp lưới quanh
  tâm viewport (dùng cùng helper lưới của Xếp gọn), 1 undo step, đóng modal. Esc/Huỷ đóng
  không tạo gì.

## Ngoài phạm vi
Sửa nội dung từ outline panel, kéo-thả trong panel, markdown đầy đủ, import markdown.
Đợt 3 riêng: ảnh, comment, favorite, deep link, lock, PNG, presentation, edge label.
