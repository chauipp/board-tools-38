# Exclusive tree panel Implementation Plan

**Goal:** Không để Chi tiết thiết kế che Xếp cây.

**Architecture:** `treeUI` ưu tiên vùng inspector bên phải; giữ nguyên dữ liệu và selection. Không thay schema hay CSS.

**Tech Stack:** React, Vite, jsdom, Playwright.

[Spec](../specs/2026-10-20-exclusive-tree-panel-design.md)

- [x] Task 1: Hồi quy và sửa điều kiện render
  - [x] Thêm `runTreePanelExclusive` trong `client/src/__smoke__/entry.jsx`, chọn kịch bản bằng `SMOKE_SCENARIO=tree-panel` trong `client/smoke-run.mjs` và fixture Game Design tương ứng.
  - [x] Chạy smoke mới: chọn card thấy `.gd-panel`, mở `.tp-open` thấy `.tree-panel` và không có `.edit-dock`; quan sát lỗi trước sửa.
  - [x] Thêm `!treeUI &&` vào điều kiện render `.edit-dock` trong `client/src/pages/IdeaMap.jsx`.
  - [x] Chạy lại kịch bản, kiểm đóng/mở và chọn card khác.
- [x] Task 2: Kiểm chứng
  - [x] Chạy unit, build, full smoke; ghi rõ lỗi có từ baseline nếu còn.
  - [x] Playwright desktop và 375×667: chọn card → mở cây → chỉnh khoảng cách → đóng → chọn card; console/network và ảnh.
  - [x] Viết summary, rà diff, chuẩn bị commit đúng identity và tích hợp local; giữ CSS chưa commit của người dùng; không push.

## Kết quả

[Summary](../summaries/2026-10-20-exclusive-tree-panel-summary.md)
