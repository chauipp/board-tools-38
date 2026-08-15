# Decision timeline cho Game Design Board

> Plan: [../plans/2026-08-13-gd-decision-timeline.md](../plans/2026-08-13-gd-decision-timeline.md)

## Mục tiêu

Tập hợp mọi Decision log trong board thành một timeline đọc-only để cả GD và dev tra được quyết định, lý do/evidence và card nguồn mà không phải mở từng card.

## Quyết định

- Timeline là panel trong dock phải 275px, mở từ nút `Decisions` trên header GD.
- Dữ liệu được derive từ Decision log hiện có: không tạo schema hoặc API mới.
- Sắp giảm dần theo ngày; quyết định không có ngày đứng sau và vẫn hiển thị để tránh giấu dữ liệu cũ.
- Mỗi item có status, card nguồn, decision, owner, rationale/evidence khi có. Bấm card nguồn mở đúng inspector card đó.
- Viewer được mở/xem timeline, nhưng không có control chỉnh sửa trong panel.
- Không thay thế editor Decision log trên card, không tạo audit log hệ thống ở phase này.

## Giả định và rủi ro

Ngày hiện là text tự do từ dữ liệu cũ, do đó sort chỉ ưu tiên chuỗi ISO `YYYY-MM-DD`; các ngày khác vẫn hiển thị ở nhóm không ngày. Với nhiều card, cap quyết định mỗi card vẫn do normalizer hiện hữu bảo vệ hiệu năng.

## Plan thực thi

[../plans/2026-08-13-gd-decision-timeline.md](../plans/2026-08-13-gd-decision-timeline.md)
