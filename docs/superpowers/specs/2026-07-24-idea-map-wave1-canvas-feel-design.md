# Idea Map — Đợt 1: "Cảm giác canvas"

Nguồn: `docs/research/2026-07-24-canvas-apps-feature-research.md` (4 research agent:
Miro/MURAL, Figma/FigJam, XMind/MindMeister/Whimsical/MindNode, Excalidraw/tldraw/Obsidian
Canvas/Heptabase). Người dùng duyệt làm cả 3 đợt; đợt 2-3 sẽ có spec/plan riêng sau khi
đợt 1 hoàn thành.

## Phạm vi đợt 1 (8 tính năng, gom thành 7 hạng mục)

### 1. Edge cắt mép card + mũi tên
- Edge hiện vẽ tâm-đến-tâm, đầu line chui dưới card. Đổi thành: hai đầu edge cắt đúng tại
  biên hình chữ nhật của card/khung; đầu "to" có mũi tên (SVG `<marker>`, màu `--ink-dim`
  cùng opacity với line). Giữ đường thẳng (không cong, không elbow).
- Helper thuần `clipToRect` thêm vào `lib/board-geometry.js` + test.
- Draft line (đang kéo nối) giữ nguyên như cũ.

### 2. Bộ phím tắt
Mở rộng keydown handler hiện có (đang chỉ Ctrl+Z/Y). Tất cả bị bỏ qua khi đang gõ trong
input/textarea/select/contentEditable:
- `Delete`/`Backspace`: xoá mọi card đang chọn (kind-aware edge cleanup như `deleteNode`).
- `Escape`: thoát lần lượt — đóng colorMenu/badgeUI nếu mở, nếu không thì tắt linkMode,
  nếu không thì bỏ chọn (clear selectedIds), thoát focus mode (mục 6).
- `N`: tạo card mới giữa viewport (cùng math `handleAddClick`), vào edit luôn.
- `Ctrl/Cmd+D`: nhân bản selection (offset +24,+24, clone cả edge nội bộ giữa các card
  được chọn, chọn các bản sao, 1 undo step). `preventDefault` (chặn bookmark).
- Mũi tên: nudge selection 1px canvas-unit (Shift = 10px); gộp history 1 lần cho mỗi
  chuỗi nhấn (burst ~600ms), save debounced.
- `F`: zoom tới selection (bbox selection, cùng math `fitToView`); không có selection thì
  fit toàn bộ.
- `Space` giữ + kéo chuột trái = pan (con trỏ grab); nhả Space trở lại bình thường.
  Chặn page-scroll mặc định của Space.

### 3. Nhân bản nhanh bằng chuột
- Alt+kéo card (hoặc selection): tạo bản sao ngay tại mousedown rồi kéo bản sao đi, bản
  gốc đứng yên (chuẩn Figma). 1 undo step cho cả tạo+kéo.
- Popover chuột phải card thêm 2 nút: **Nhân bản** (duplicate card đó) và **Xoá**.

### 4. Snapping + alignment guides
- Khi kéo card/khung (cả kéo nhóm): so mép trái/giữa/phải và trên/giữa/dưới của bbox đang
  kéo với mọi card/khung khác; trong ngưỡng ~6px màn hình (6/scale canvas-unit) thì hút
  vào và vẽ guide line mảnh (SVG trong edge-layer, màu `--accent`) suốt chiều nối 2 đối
  tượng. Giữ Alt để tắt snap tạm thời. Resize khung không cần snap (giữ đơn giản).
- Helper thuần trong file mới `lib/snap.js` + test.

### 5. Quick-create khi đang edit
- Trong form edit card, `Ctrl/Cmd+Enter`: lưu card hiện tại rồi tạo ngay card mới nối
  edge về bên phải (tái dùng `createLinkedNode`), tự vào edit card mới — gõ liên tục
  không cần chuột. (Không hijack phím Tab — Tab vẫn chuyển field như mặc định.)

### 6. Focus mode
- Nút **Tập trung** trong popover chuột phải card: dim mọi card ngoài vùng lân cận ≤2
  hop theo edge (tái dùng cơ chế dim của filter). Banner nhỏ "Đang tập trung — Esc để
  thoát". Esc hoặc bấm lại để thoát. Không persist (state client-side).

### 7. Bulk-edit multi-select
- Khi chọn ≥2 card: thanh nổi dưới-giữa viewport hiện: số card đã chọn, dropdown trạng
  thái, dropdown nhãn, hàng swatch màu (kể cả "không màu"), nút Bỏ chọn. Mỗi thay đổi
  áp cho toàn bộ selection trong 1 commitAndSave.

## Ngoài phạm vi đợt 1
Outline panel, tidy-up, markdown-lite, quick capture, export MD (đợt 2); ảnh, comment,
favorite, deep link, lock, PNG, presentation, edge label (đợt 3); minimap, elbow routing,
command palette, realtime (skip vĩnh viễn — xem research doc).
