# Balance Sheet — Design

## Mục tiêu

Cho Game Designer ghi và tính các chỉ số balance cơ bản ngay trên board GD, đồng thời liên kết chúng tới card mechanic/skill/level.

## Phạm vi

- Một Balance sheet cấp board gồm tối đa 100 chỉ số: key công thức, tên, value, min, max, đơn vị, formula và card references.
- Công thức chỉ cho phép số, phép `+ - * / ( )` và key chỉ số; không dùng `eval`.
- Preview kết quả hoặc lỗi công thức; Markdown xuất bảng balance có liên kết card.
- Chưa làm CSV, economy flow, version comparison hoặc anomaly cảnh báo.

## Plan thực thi

[Kế hoạch triển khai](../plans/2026-08-12-gd-balance-sheet.md)
