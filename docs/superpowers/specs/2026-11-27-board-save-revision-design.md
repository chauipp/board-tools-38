# Lưu board có kiểm tra phiên bản

Dùng mốc updatedAt tăng nghiêm ngặt làm phiên bản để giữ tương thích với client đang triển khai. MongoDB kiểm tra mốc và ghi nội dung trong cùng thao tác. Cả lưu thường và khôi phục snapshot dùng cùng điều kiện ghi. Client dừng lưu tự động khi không thể ghép xung đột và giữ nội dung đang chỉnh.

## Plan thực thi

[Kế hoạch](../plans/2026-11-27-board-save-revision.md) · [Kết quả](../summaries/2026-11-27-board-save-revision-summary.md)
