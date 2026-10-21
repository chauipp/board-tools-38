# Thu/mở thanh công cụ thiết kế

[Spec](../specs/2026-10-21-collapse-design-toolbar-design.md) · [Plan](../plans/2026-10-21-collapse-design-toolbar.md)

## Đã làm gì

- Thêm nút Thiết kế cạnh tên board để thu/mở nhóm Game Brief → Reports; menu board, tìm kiếm và giao diện vẫn truy cập được.
- Nhớ lựa chọn theo tài khoản, board và profile màn hình bằng workspace settings; mặc định mở.
- Thu nhóm công cụ không đóng inspector đang xem và không ghi nội dung board.
- Nhóm công cụ cuộn ngang riêng trên màn hình hẹp; kiểm bằng trình duyệt desktop và mobile 375×667, reload và bàn phím.
- Client 724 test, server 145 test, build và hai smoke workspace/tree-panel đều đạt; không có page error hoặc HTTP lỗi trong kịch bản trình duyệt.

## File chính

- `client/src/pages/IdeaMap.jsx`: nút truy cập được bằng bàn phím và nhóm toolbar có aria-expanded/hidden.
- `client/src/styles/idea-map.css`: giữ nút thu/mở hiện hữu, nhóm công cụ cuộn khi hẹp.
- `client/src/lib/workspace-state.js`: mặc định và khôi phục toolsOpen qua controller hiện có.
- `server/workspace.js`: cho phép lưu toolsOpen với kiểm tra boolean.
- Hai file workspace-state.test.js và workspace.test.js: hồi quy default/hydrate/patch và validation HTTP.

## Khác với plan

Không lệch.

## Còn dở / cần lưu ý

- Không chạy lại toàn bộ smoke tổng; hai scenario liên quan đã đạt. Smoke tổng trước đó có lỗi double-click resize không thuộc thay đổi này.
- Build còn cảnh báo chunk lớn đã tồn tại. Không thay CSS riêng trong client/src/index.css và không push.
