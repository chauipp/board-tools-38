# Kết quả: Game Design Board

Trỏ về: [spec](../specs/2026-08-11-game-design-board-design.md) · [plan](../plans/2026-08-11-game-design-board.md)

## Đã làm gì

- Màn danh sách board có modal chọn `Bảng tư duy trực quan` hoặc `Game Design`; danh sách hiển thị loại board.
- Board GD dùng chung canvas/realtime nhưng có menu tạo 8 loại thẻ template và panel chi tiết cho spec.
- Template GD được đặt trên toolbar cố định cạnh nút thêm thẻ để thao tác thường xuyên không bị ẩn trong menu chung.
- Mọi thao tác chỉnh sửa được gom vào dock bên phải: bulk edit cho thẻ/khung/nét vẽ và inspector Game Design xếp cùng một cột, có cuộn riêng để không chồng lên filter phía dưới.
- Thẻ GD lưu mục tiêu, luật, input/output, edge cases, phụ thuộc, owner, priority và acceptance criteria.
- Export Markdown của board GD tạo tài liệu handoff theo từng template; board idea vẫn export như cũ.
- API, socket, validation và rebase hỗ trợ `kind/type/design`; board cũ thiếu field vẫn tương thích.

## File chính

- `board-tools/server/models.js`, `boards.js`, `board-payload.js`: lưu, trả và kiểm loại board/dữ liệu thiết kế.
- `board-tools/client/src/pages/BoardList.jsx`: modal chọn loại board khi tạo.
- `board-tools/client/src/lib/game-design.js`: registry template, defaults và Markdown export.
- `board-tools/client/src/components/GameDesignPanel.jsx`, `IdeaCard.jsx`, `IdeaMap.jsx`: UI tạo/sửa thẻ GD và panel spec.
- `board-tools/client/src/index.css`, `styles/idea-map.css`: layout modal, panel và nhãn template.
- `docs/superpowers/specs/2026-08-11-game-design-board-design.md`, `plans/2026-08-11-game-design-board.md`: tài liệu thiết kế/kế hoạch.

## Khác với plan

- Không thêm bảng balance công thức hay tích hợp Jira trong phiên bản đầu như đã thống nhất.
- Ban đầu UI Playwright dùng route mock; sau đó đã dựng server MongoDB local và chạy lại luồng thật bằng session test tạm.
- Sau phản hồi UX, menu template được chuyển từ menu board sang toolbar nổi bên trái.
- Sau phản hồi UX tiếp theo, bulk bar được chuyển khỏi đáy canvas sang dock chỉnh sửa bên phải; panel GD và bulk bar dùng chung vùng neo này trên cả desktop và mobile.
- Bulk editor trong dock tiếp tục được xếp theo một cột dọc; select kéo đầy chiều rộng, bảng màu giữ dạng lưới nhỏ, các nút thao tác tách thành từng hàng.
- Dock phải được giới hạn chiều rộng cố định 300px trên desktop, chỉ co lại theo màn hình ở mobile.
- Khi có bất kỳ trạng thái chỉnh sửa nào, dock hiển thị trọn chiều cao cố định; bulk editor hoặc inspector chỉ lấp phần nội dung cần dùng bên trong cùng panel đó.

## Còn dở / cần lưu ý

- Cần chạy `npm ci` trong `board-tools/client` và `board-tools/server` ở máy triển khai nếu chưa có `node_modules`.
- Chưa kiểm Google OAuth thật; e2e dùng session test tạm với `PUBLIC_MODE=true`, tạo–đọc–lưu–xóa board trên MongoDB thật.
