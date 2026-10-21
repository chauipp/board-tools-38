# Thiết kế ở hàng thứ hai

[Spec](../specs/2026-10-21-design-toolbar-second-row-design.md) · [Plan](../plans/2026-10-21-design-toolbar-second-row.md)

## Đã làm gì

- Đưa nút Thiết kế và dãy Game Brief → Reports xuống hàng dưới, căn trái theo ảnh yêu cầu.
- Giữ hàng menu/tên board/tìm kiếm/giao diện phía trên và giữ nguyên cơ chế nhớ thu/mở.
- Kiểm bằng trình duyệt1440×900 và375×667: toggle nằm dưới header, thu/mở/reload/bàn phím/Reports hoạt động; không phát sinh lỗi trang, HTTP lỗi hay ghi board.
- Client724 test và build đạt; đã xem ảnh desktop/mobile.

## File chính

- client/src/pages/IdeaMap.jsx: di chuyển nguyên toolbar sang hàng riêng, không thay state hoặc handler.
- client/src/styles/idea-map.css: khoảng cách6px phía trên hàng Thiết kế.

## Khác với plan

Không lệch.

## Còn dở / cần lưu ý

Build có cảnh báo chunk lớn đã tồn tại. Không đổi backend; không chạy lại smoke tổng; không push. CSS riêng client/src/index.css được giữ nguyên.
