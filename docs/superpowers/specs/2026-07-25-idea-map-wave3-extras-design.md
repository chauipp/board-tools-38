# Idea Map — Đợt 3: "Mở rộng"

Nguồn: `docs/research/2026-07-24-canvas-apps-feature-research.md`. Đợt cuối trong 3 đợt
người dùng đã duyệt. Đợt 1 (canvas feel) và Đợt 2 (organize) đã merge vào main.

## Danh tính người dùng (dùng chung cho favorite + comment)
- Tên người dùng lưu `localStorage["idea-map-user"]`. Lần đầu cần tên (bấm ⭐ hoặc gửi
  comment) → `window.prompt` hỏi tên, lưu lại. Không auth thật — 2 người tin nhau.

## Phạm vi (8 tính năng)

### 1. Khoá vị trí (lock)
- `locked: true` (optional) trên node và group. Card/khung khoá: drag handler early-return
  (không kéo được, không bị kéo theo khung), resize khung khoá bị chặn; edit/delete vẫn được.
- Toggle qua popover chuột phải (card + khung): nút **Khoá** / **Mở khoá**. Card/khung đang
  khoá hiện icon 🔒 nhỏ ở góc. Tidy up bỏ qua card khoá (giữ nguyên vị trí, không tham gia lưới).

### 2. Yêu thích (favorite)
- `favorites: string[]` (tên người dùng) trên node. Nút ⭐ nhỏ trên card (cạnh ✎): toggle
  tên mình; hiện số ⭐ nếu > 0, tô vàng nếu mình đã thích.
- Filterbar thêm chip **⭐ Yêu thích** (lọc card có ≥1 favorite — tích hợp passesFilter).

### 3. Deep link
- Chọn card → URL thêm `?card=<id>` (replaceState, không spam history). Load trang có
  `?card=` → pan/zoom tới card + chọn nó + nháy outline (CSS animation ~1.5s).
- Popover chuột phải card thêm **Chép liên kết** (copy URL vào clipboard).

### 4. Kiểu edge + nhãn edge
- Edge thêm `style: "solid"|"dashed"` (mặc định solid) và `label: string` (optional).
- Click edge hiện popover nhỏ tại con trỏ: nút đổi kiểu (solid↔dashed), ô nhập nhãn,
  nút xoá edge (thay hành vi click-là-xoá hiện tại — an toàn hơn). Nhãn render text nhỏ
  giữa edge (SVG `<text>`, nền mờ).

### 5. Comment trên card
- `comments: [{ text, author, at }]` trên node (at = ISO string). Badge 💬n trên card khi
  có comment. Click badge (hoặc nút trong popover chuột phải) mở popover danh sách:
  các comment (author + text + thời gian tương đối), ô nhập thêm, nút xoá từng comment.
  Không resolve/thread — giữ phẳng.

### 6. Ảnh trên card
- `image: string` (data URL, optional) trên node. Paste ảnh (Ctrl+V khi có card đang chọn)
  hoặc kéo-thả file ảnh lên card → nén client-side (canvas, max-width 480px, JPEG q0.8)
  rồi gán vào card đó. Hiển thị trên card (trên phần desc, bo góc, max-height). Nút xoá
  ảnh trong form edit. Server: nâng `express.json` limit 2mb → 10mb (ảnh đi trong
  whole-board PUT).

### 7. Export PNG
- Nút **Xuất PNG** trong outline panel (cạnh Xuất MD): vẽ lại board lên `<canvas>` thuần
  (không lib): nền, khung (viền + tiêu đề), edge (đường + mũi tên + nhãn), card (nền, dải
  màu, tiêu đề, vài dòng desc, pill status) — bản chụp ĐƠN GIẢN HOÁ, không cần pixel-perfect
  với DOM. Scale 2x cho nét. Tải xuống `idea-map.png`.

### 8. Trình chiếu (presentation)
- Nút **Trình chiếu** trên topbar (chỉ enable khi có ≥1 khung): overlay fullscreen ẩn mọi
  chrome, hiện lần lượt từng khung (pan/zoom canvas tới bbox khung, theo thứ tự
  board.groups). Phím ←/→ chuyển khung, Esc thoát, đếm "2/5" góc dưới. Thoát trả lại
  view trước khi trình chiếu.

## Ngoài phạm vi
Lightbox ảnh, comment thread/resolve, video, xuất PDF, realtime.
