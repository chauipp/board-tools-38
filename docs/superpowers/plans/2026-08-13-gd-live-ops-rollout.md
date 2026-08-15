# Live Tuning, Rollout và Feature Flag Implementation Plan

> Spec: [../specs/2026-08-13-gd-live-ops-rollout-design.md](../specs/2026-08-13-gd-live-ops-rollout-design.md)

**Goal:** Cho mỗi Game Design card ghi và bàn giao an toàn live tuning, version rollout, feature flag và phương án rollback.

**Architecture:** Lưu `liveOps` trong `node.design`; client normalise lúc load/save/export, server validate payload, dock quản lý form cục bộ và card chỉ phản hồi bằng một badge gọn.

**Tech Stack:** React, JavaScript, Node test runner, Express/Mongo payload validation.

---

- [x] Task 1: Data contract, validation và Markdown
  - [x] Viết test client/server fail cho normalize, preview/export và validator.
  - [x] Chạy test xác nhận fail vì contract chưa tồn tại.
  - [x] Thêm normalizer, default/new card, realtime/load, Markdown và validation server.
  - [x] Chạy client/server tests xác nhận xanh.

- [x] Task 2: Dock editor và card feedback
  - [x] Thêm section thu gọn, viewer read-only và giới hạn input trong dock 275px.
  - [x] Thêm card badge theo status/percent mà không làm canvas phình.
  - [x] Build client xác nhận JSX/CSS hợp lệ.

- [ ] Task 3: Verification và tài liệu
  - [x] Cập nhật checklist, manual test guide và brief Playwright/Claude.
  - [x] Chạy client tests, build, smoke và server tests.
  - [x] Playwright local dừng ở Login vì `/api/auth/me` 401 và Google GSI chưa cho phép origin localhost; đã bàn giao kịch bản browser cho Claude có session đăng nhập.

## Kết quả

[../summaries/2026-08-13-gd-live-ops-rollout-summary.md](../summaries/2026-08-13-gd-live-ops-rollout-summary.md)
