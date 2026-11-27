# Lưu board có kiểm tra phiên bản

[Thiết kế](../specs/2026-11-27-board-save-revision-design.md) · [Kế hoạch](../plans/2026-11-27-board-save-revision.md)

## Đã làm gì

- Lưu và khôi phục snapshot kiểm tra phiên bản trong cùng lệnh ghi MongoDB.
- Chỉnh sửa ở các trường khác nhau của cùng một thẻ được ghép. Chỉnh sửa trùng trường với giá trị khác nhau dừng tự động lưu.
- Giữ bản nháp khi gặp lỗi, có nút thử lại và tải JSON.
- Unit test client 727/727 và server 156/156 pass. Build Vite thành công. Đã kiểm cảnh báo, tải JSON và thử lại trên Chromium với API giả.

## File chính

- `server/board-write.js` thực hiện cập nhật có điều kiện.
- `server/boards.js` dùng chung cập nhật có điều kiện cho lưu và khôi phục.
- `client/src/lib/rebase.js` ghép ở cấp trường và phát hiện xung đột.
- `client/src/pages/IdeaMap.jsx` giữ bản nháp và điều phối phản hồi lưu với socket.

## Khác với plan

Không lệch thiết kế đã ghi. Giữ `updatedAt` làm phiên bản tăng dần để dùng lại hợp đồng hiện có cho lưu thường.

## Còn dở / cần lưu ý

Smoke test toàn bộ vẫn đỏ ở ca nhấp đúp hoàn tác có từ baseline. Chưa chạy kiểm thử tích hợp trên MongoDB thực. Bản nháp còn trong phiên hiện tại hoặc trong file đã tải. Cần tải lại client cũ trước khi dùng khôi phục snapshot với API mới. Thay đổi nằm trong worktree.
