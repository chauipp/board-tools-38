# Nhân bản card Game Design — Kế hoạch thực thi

> Spec: [../specs/2026-08-13-gd-duplicate-card-design.md](../specs/2026-08-13-gd-duplicate-card-design.md)

**Mục tiêu:** Editor có thể clone một card GD thành biến thể độc lập ngay cạnh bản gốc.

**Kiến trúc:** Một helper thuần tạo board kế tiếp và deep-clone `design`; inspector gọi callback ở `IdeaMap` để ghi history, persist và focus bản sao.

**Tech stack:** React, JavaScript ES modules, Node test runner.

- [x] Task 1: Helper nhân bản dữ liệu
  - [x] Viết test thất bại cho ID/vị trí/status/edge và deep clone.
  - [x] Thêm `duplicateGameDesignCard` tối thiểu trong `game-design.js`.
  - [x] Chạy `npm test` client.
- [x] Task 2: Hành động trong dock
  - [x] Thêm nút editor-only `Nhân bản thẻ` ở inspector.
  - [x] Nối callback qua history, save và focus card clone.
  - [x] Chạy build client.
- [ ] Task 3: Xác minh và tài liệu
  - [x] Cập nhật checklist và kịch bản test Claude.
  - [x] Chạy test, build, smoke; thử Playwright local và ghi blocker phiên browser đang bị chiếm.

## Kết quả

[../summaries/2026-08-13-gd-duplicate-card-summary.md](../summaries/2026-08-13-gd-duplicate-card-summary.md)
