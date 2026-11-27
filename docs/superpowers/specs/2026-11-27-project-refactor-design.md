# Refactor theo ranh giới chức năng

Giữ hành vi hiện hành của board và chia công việc thành các phần có thể kiểm thử độc lập. Client tải editor theo route và đưa các trách nhiệm ra khỏi IdeaMap theo nhóm dữ liệu board, thanh công cụ, lưu và đồng bộ, thao tác canvas. Server đưa đăng ký cộng tác ra khỏi điểm khởi động rồi phân chia các nhóm API khi đã có kiểm tra hợp đồng.

Phạm vi và thứ tự dựa trên [bản đồ hệ thống](../../2026-11-27-system-map.md) và [danh mục từng file](../../2026-11-27-system-file-inventory.md). Ưu tiên bảo toàn dữ liệu khi có nhiều người sửa, sau đó là ranh giới editor, API và nghiệp vụ Game Design.

## Plan thực thi

[Kế hoạch](../plans/2026-11-27-project-refactor.md) · [Kết quả](../summaries/2026-11-27-project-refactor-summary.md)
