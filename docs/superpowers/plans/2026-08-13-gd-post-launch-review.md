# Post-launch Review Implementation Plan

> Spec: [../specs/2026-08-13-gd-post-launch-review-design.md](../specs/2026-08-13-gd-post-launch-review-design.md)

**Goal:** Ghi, xem và bàn giao post-launch review theo từng Game Design card.

**Architecture:** Lưu object `postLaunchReview` trong `node.design`; client normalize khi load/save/export, server validate, dock dùng form cục bộ và card hiện badge status gọn.

**Tech Stack:** React, JavaScript, Node test runner, Express/Mongo payload validation.

---

- [x] Task 1: Data, validation và export
  - [x] Viết test fail cho normalizer, preview, Markdown và validator.
  - [x] Chạy test xác nhận contract chưa tồn tại.
  - [x] Thêm data contract, load normalization, export và validation server.
  - [x] Chạy client/server test xác nhận pass.

- [x] Task 2: Dock và card feedback
  - [x] Thêm section 275px, related-card control và viewer read-only.
  - [x] Thêm badge status trên card, không làm canvas phình.
  - [x] Build client.

- [ ] Task 3: Verification và docs
  - [x] Cập nhật checklist, manual guide và brief Claude.
  - [x] Chạy client test/build/smoke và server test.
  - [x] Playwright local bị Login chặn: `/api/auth/me` 401 và Google GSI chưa allow localhost origin. Kịch bản đã bàn giao cho Claude có session đăng nhập.

## Kết quả

[../summaries/2026-08-13-gd-post-launch-review-summary.md](../summaries/2026-08-13-gd-post-launch-review-summary.md)
