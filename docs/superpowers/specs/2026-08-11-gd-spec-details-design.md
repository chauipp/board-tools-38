# Game Design Spec Details — Design

## Mục tiêu

Cho card Game Design các phần Examples, Failure States và Tuning Parameters để designer viết feature spec rõ ràng cho dev, mà không làm canvas hoặc dock rối.

## Tóm tắt đã chốt

- Chỉ card trên board `game-design` dùng ba collection optional trong `node.design`.
- Examples: `{ id, title, scenario, expectedResult }`, tối đa 20 dòng.
- Failure states: `{ id, condition, playerFeedback, recovery }`, tối đa 20 dòng.
- Tuning parameters: `{ id, name, defaultValue, min, max, unit, note }`, tối đa 30 dòng.
- Dòng thiếu `title` / `condition` / `name` bị bỏ khi lưu; mọi text trim, id tối đa 120 và text tối đa 1.000 ký tự.
- Giá trị tuning giữ dạng text, không làm công thức hoặc tự tính trong phase này.

## UI và quyền

- Ba section nằm cuối `GameDesignPanel`, mặc định collapse; mỗi item xếp dọc trong dock 275px.
- Nút có nhãn: `+ Thêm ví dụ`, `+ Thêm failure state`, `+ Thêm parameter`, `Xóa`.
- Viewer đọc được dữ liệu nhưng không có control mutating; click ngoài vẫn lưu dirty rồi đóng theo lifecycle hiện có.
- Export Markdown chỉ tạo heading section khi có item hợp lệ.

## Server, realtime và conflict

- Validator server kiểm type/count/length/id của ba collection; board/card legacy thiếu field vẫn hợp lệ.
- GET, PUT, socket và conflict dùng `nodes` payload hiện có nên không cần field board mới.
- Normalize client chạy khi load/import/socket; rebase collection node hiện có giữ thay đổi local node theo luật hiện hành.

## Kiểm thử và ngoài phạm vi

- Unit normalize/Markdown, server validation, smoke form/viewer và browser desktop thật khi có phiên đăng nhập test.
- Ngoài phạm vi: balance sheet, CSV, công thức tự tính, graph, mobile.

## Decision log

- Chọn collection có cấu trúc thay vì textarea: dev đọc/quét được và export nhất quán.
- Chọn giá trị text cho tuning: không ép designer vào format số quá sớm.
- Chọn form dọc/collapse: giữ dock 275px không overlap và ưu tiên thông tin đang dùng.

## Plan thực thi

[Xem kế hoạch thực thi](../plans/2026-08-11-gd-spec-details.md).

## Kết quả

[Kết quả sẽ được ghi tại đây](../summaries/2026-08-11-gd-spec-details-summary.md).
