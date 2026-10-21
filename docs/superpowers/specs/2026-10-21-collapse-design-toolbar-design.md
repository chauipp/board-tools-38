# Thu gọn công cụ thiết kế

Nút Thiết kế luôn hiện cạnh tên board Game Design, thu/mở dãy Game Brief → Reports. Menu board, tên board, tìm kiếm và Giao diện vẫn hiện. Thu gọn không đóng inspector hay sửa board. Mặc định mở để tương thích; lưu `toolsOpen` boolean trong workspace hiện có theo user/board/profile; reset về mở. Trên màn hình hẹp dãy công cụ cuộn ngang riêng, nút đóng/mở không bị đẩy khuất. Board tư duy không hiện nút/dãy này.

Kiểm: client/controller + HTTP server chấp nhận boolean và từ chối sai kiểu; browser bấm, giữ inspector, reload và desktop/mobile. Không thêm dragging hoặc thay CSS riêng chưa commit.

## Plan thực thi

[Plan](../plans/2026-10-21-collapse-design-toolbar.md) · [Summary](../summaries/2026-10-21-collapse-design-toolbar-summary.md)
