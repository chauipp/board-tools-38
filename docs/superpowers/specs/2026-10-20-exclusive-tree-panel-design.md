# Ưu tiên bảng Xếp cây

Khi chọn card trên board Game Design, Chi tiết thiết kế vẫn hiện như cũ. Khi mở Tuỳ chỉnh cây, dock bên phải phải ẩn để bảng Xếp cây không bị che; vùng chọn và dữ liệu board không bị xoá. Đóng bảng cây cho phép xem lại thiết kế. Áp dụng cho cả cây gốc card và khung; không sửa CSS z-index để che triệu chứng.

Nguyên nhân: `treeUI` và điều kiện render `.edit-dock` độc lập trong `IdeaMap.jsx`.

Giải pháp: chỉ render edit dock khi không có `treeUI`. Giữ nguyên state chọn card và quy trình lưu khi bấm ra ngoài form.

Kiểm chứng: smoke hành vi trước/sau fix, unit tests, build và Playwright desktop/mobile trên board fixture, không ghi dữ liệu board thật.

## Plan thực thi

[Plan](../plans/2026-10-20-exclusive-tree-panel.md) · [Kết quả](../summaries/2026-10-20-exclusive-tree-panel-summary.md)
