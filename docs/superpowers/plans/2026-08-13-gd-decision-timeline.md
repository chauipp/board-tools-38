# Decision timeline — Kế hoạch thực thi

> Spec: [../specs/2026-08-13-gd-decision-timeline-design.md](../specs/2026-08-13-gd-decision-timeline-design.md)

**Mục tiêu:** Xem tập trung các quyết định GD theo thời gian và quay về card nguồn bằng một cú bấm.

**Kiến trúc:** Helper thuần flatten/normalize/sort decision logs; panel đọc helper và callback mở inspector card.

**Tech stack:** React, JavaScript ES modules, Node test runner.

- [x] Task 1: Derived data
  - [x] Viết test thất bại cho flatten, sort và quyết định không có ngày.
  - [x] Thêm helper `decisionTimeline` tối thiểu.
  - [x] Chạy test client.
- [x] Task 2: Timeline inspector
  - [x] Thêm panel dọc, action mở card và trigger header GD.
  - [x] Duy trì dock phải cố định 275px, viewer chỉ đọc.
  - [x] Chạy build client.
- [ ] Task 3: Xác minh và tài liệu
  - [x] Cập nhật checklist/test guide.
  - [x] Chạy test/build/smoke; Playwright bị chặn vì profile browser đang bị process khác chiếm.

## Kết quả

[../summaries/2026-08-13-gd-decision-timeline-summary.md](../summaries/2026-08-13-gd-decision-timeline-summary.md)
