# Khóa bố cục tự động theo cây

Trong bảng Xếp cây, người dùng bật/tắt Khóa bố cục tự động. Lưu cấu hình `treeLayoutLock: { directions, depth, breadth, leaf }` trên card hoặc khung gốc, tận dụng dữ liệu nodes/groups hiện có; không thêm collection hay migration.

Với khung trong cây, cấu hình giữ thêm `groupMembers` là danh sách id thành viên chốt trước khi di chuyển/xem trước. Không tính lại thành viên từ vị trí khung sau mỗi lần xếp, vì khung có thể phủ lên cây độc lập.

Khi bật, tự tính lại toàn bộ hậu duệ có dây nối hướng ra từ gốc khi thêm/xóa card, thay quan hệ, đổi kích thước hay nội dung. Gốc giữ tọa độ. Card/khung thuộc cây bị chặn kéo tự do và phím mũi tên, kể cả kéo theo vùng chọn hay khung chứa. Card vẫn chọn, sửa, xóa và thêm con được. Tắt chế độ không thay đổi khóa thủ công có sẵn.

Cấu hình áp dụng độc lập từng cây. Mở bảng tại một hậu duệ đang chịu khóa sẽ chỉnh cây gốc sở hữu nó; không tạo khóa lồng nhau. Dây vô hướng không tạo hậu duệ; chu trình được BFS xử lý. Cấu hình sai trong dữ liệu nhập bị bỏ qua. Board cũ không có cấu hình giữ hành vi cũ. Undo/redo và lưu/tải board phải bảo toàn khóa.

Tham khảo: [XMind Skeleton](https://xmind.com/user-guide/skeleton-new), [Floating Topic](https://xmind.com/user-guide/floating-topic). Đây là thiết kế lấy cảm hứng từ cấu trúc nhánh và tự bố trí, không sao chép thuật toán nội bộ.

## Plan thực thi

[Plan](../plans/2026-10-19-tree-layout-lock.md)

[Kết quả](../summaries/2026-10-19-tree-layout-lock-summary.md)
