# Kết quả refactor dự án

[Thiết kế](../specs/2026-11-27-project-refactor-design.md) · [Kế hoạch](../plans/2026-11-27-project-refactor.md)

## Đã làm gì

- Chuyển editor sang tải theo route. JavaScript ban đầu giảm từ khoảng 621 kB còn 225 kB trước gzip.
- Tách lưu, lịch sử, quét chọn, lia, thu phóng, mục lục và toolbar khỏi editor. Undo/Redo giữ chỉnh sửa của người khác khi lịch sử còn ghép an toàn được.
- Dùng phiên bản ghi để phát hiện xung đột trên MongoDB. Lần gõ hoặc nhích thẻ mới nhất được giữ trong lúc PUT đang chạy. Restore nhận 409 cập nhật phiên bản để người dùng kiểm và xác nhận lại.
- Chia REST thành board, snapshot, thành viên và PDF. Tách Socket.IO cộng tác và router bàn tính khỏi điểm khởi động.
- Chia Game Design theo mô hình, thao tác thẻ, Balance, dependency và báo cáo. Khi hai người tạo thẻ trùng ID, rebase đổi cả ID liên kết trong Game Flow, Balance và đặc tả thẻ. Trạng thái mới được cấp ID riêng kể cả trên board cũ có bộ đếm trùng với Archived.
- 731 test client, 156 test server, hợp đồng HTTP với MongoDB, production build và smoke đầy đủ đều qua. Chromium kiểm thao tác canvas, lưu hai phía, restore, Handoff, Reports và tải nháp ở 375 px. Fixture migration singleton chạy hai lần chỉ tạo một board. Quota được kiểm qua API và lệnh dry run.

## File chính

- `client/src/main.jsx` tải editor theo route.
- `client/src/lib/useBoardPersistence.js` điều phối lưu, ghép xung đột và restore.
- `client/src/lib/useBoardHistory.js` giữ lịch sử undo, redo và gộp thao tác phím mũi tên.
- `client/src/lib/useCanvasViewportGestures.js` điều phối cuộn, lia và quét chọn.
- `client/src/lib/game-design.js` giữ điểm import hiện có và xuất các mô-đun nghiệp vụ riêng.
- `server/boards.js` xử lý CRUD board và gắn các router snapshot, thành viên, PDF.
- `server/board-api.integration.mjs` chạy các ca HTTP với MongoDB thật, bao gồm hai PUT cùng phiên bản.
- `server/board-realtime.js` đăng ký các sự kiện Socket.IO của board.
- `server/calculator-routes.js` chứa đường dẫn và dữ liệu của bàn tính.

## Khác với plan

Rà diff phát hiện thêm các ca cần sửa trong phạm vi lưu và cộng tác. Đã kiểm việc giữ bản nháp trong form, thứ tự hàng đợi ghi, phục hồi sau restore 409 và các liên kết Game Design khi đổi ID.

## Còn dở / cần lưu ý

Tám task đã hoàn tất trong worktree. Chạy kiểm tra triển khai trên máy cục bộ dùng Node 22.18, MongoDB 8.2 và kho PDF cục bộ. Thay đổi chưa merge vào `main`. Render, đăng nhập Google và Cloudflare R2 của môi trường thật chưa được kiểm trong đợt này.
