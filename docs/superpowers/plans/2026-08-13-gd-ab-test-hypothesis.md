# A/B Test Hypothesis Implementation Plan

> Spec: [../specs/2026-08-13-gd-ab-test-hypothesis-design.md](../specs/2026-08-13-gd-ab-test-hypothesis-design.md)

**Goal:** Ghi, lưu, xem và bàn giao giả thuyết A/B test theo từng Game Design card.

**Architecture:** Thêm `abTests` vào `node.design`; client normalize và export, server validate, dock chỉnh sửa dữ liệu cục bộ trước khi lưu. Card chỉ dùng badge tóm tắt để canvas không quá tải.

**Tech Stack:** React, JavaScript, Node test runner, Express/Mongo payload validation.

---

- [x] Task 1: Data contract, validation và export
  - [x] Viết test client/server cho normalizer, preview, Markdown và dữ liệu payload hợp lệ/lỗi.
  - [x] Chạy test mới để xác nhận fail vì tính năng chưa tồn tại.
  - [x] Thêm normalizer, initial data/load normalization, Markdown và server validation tối thiểu.
  - [x] Chạy client/server unit tests để xác nhận pass.

- [x] Task 2: Dock editor và card feedback
  - [x] Viết/điều chỉnh test cho tóm tắt card nếu cần.
  - [x] Thêm section A/B test thu gọn, giới hạn 20 và viewer read-only.
  - [x] Thêm badge gọn trên card, không hiển thị text dài.
  - [x] Build client để xác nhận JSX/CSS hợp lệ.

- [ ] Task 3: Verification và tài liệu
  - [x] Cập nhật checklist, manual test guide và Claude Playwright brief.
  - [x] Chạy client tests, build, smoke và server tests.
  - [x] Playwright đã mở `http://localhost:7155` nhưng dừng tại Login: `/api/auth/me` 401 và Google GSI báo origin chưa được cho phép. Đã bàn giao kịch bản browser cho Claude có session đăng nhập.

## Kết quả

[../summaries/2026-08-13-gd-ab-test-hypothesis-summary.md](../summaries/2026-08-13-gd-ab-test-hypothesis-summary.md)
