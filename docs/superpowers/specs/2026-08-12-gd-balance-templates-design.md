# Balance Templates & Warnings — Design

> Plan thực thi: [../plans/2026-08-12-gd-balance-templates.md](../plans/2026-08-12-gd-balance-templates.md)

## Mục tiêu

Giúp Game Designer bắt đầu tune XP/level, drop rate và currency flow ngay từ Balance sheet, đồng thời thấy rõ chỉ số hay công thức bất thường trước khi bàn giao.

## Phạm vi

- Có bốn preset chèn nhanh: Combat, XP & Level, Drop rate và Currency flow.
- Preset thêm các metric còn thiếu, không ghi đè metric cùng key đã có.
- Cảnh báo tính tại client cho value/formula không phải số, min lớn hơn max, kết quả dưới min hoặc vượt max, và drop rate dưới 0 hoặc trên 100%.
- Cảnh báo không chặn lưu: đây là tín hiệu tuning cho GD, không phải lỗi dữ liệu.
- Markdown vẫn export từng metric, formula, range và thẻ liên quan như hiện tại.

## Ngoài phạm vi

- Không có chart, CSV, lịch sử snapshot/so sánh phiên bản hay mô phỏng economy nhiều bước.
- Không tự áp quy tắc drop rate lên metric tùy ý; chỉ key preset có hậu tố `_rate` hoặc đơn vị `%` mới nhận cảnh báo 0–100.

## UX

Đầu Balance sheet có hàng `Template nhanh`, các nút xếp dọc/gọn trong dock. Khi click, metric mới xuất hiện ngay trong danh sách để GD sửa trước khi lưu. Mỗi metric hiển thị kết quả hoặc lỗi công thức; các warning màu cảnh báo xuất hiện dưới kết quả, không che input và không làm dock rộng quá 275px.

## Độ đúng

- `balanceWarnings(metric, variables)` là hàm thuần, có test cho range, result và rate.
- Template là data tĩnh đã chuẩn hóa, có unique key và dùng cùng shape metric hiện tại.
- Viewer xem được template/warning nhưng không thể chèn template, sửa hay lưu.

## Kết quả chấp nhận

- Một click `XP & Level` tạo level, xp cần và XP reward có formula tham chiếu.
- Một click `Drop rate` tạo rate đúng đơn vị %, và 120 hiển thị warning vượt 100%.
- Thử min `20`, max `10`, hoặc result vượt max đều hiện warning nhưng save/reload giữ dữ liệu.
