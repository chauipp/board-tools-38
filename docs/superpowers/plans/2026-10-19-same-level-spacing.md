# Same-level spacing Implementation Plan

> **For agentic workers:** Use executing-plans to implement task-by-task; approved design already discussed with user.

**Goal:** Hai thanh khoảng cách dễ hiểu, một giá trị chung cho card cùng cấp.

**Architecture:** TreePanel updates existing breadth and leaf together. IdeaMap normalizes old unequal options when opening panel. Generic tree-layout/locked-tree APIs remain unchanged.

**Tech Stack:** React, Vite, Lingui, Node tests, Playwright.

## Global Constraints

Giữ dữ liệu board hiện có và thay đổi index.css của người dùng. Không đổi schema, không push. Dùng worktree riêng và merge local sau khi kiểm chứng.

- [x] Task 1: Gộp điều khiển và đồng bộ cấu hình
  - [x] Đọc TreePanel, IdeaMap, locked-tree và smoke panel; baseline713/713.
  - [x] TreePanel chỉ depth/breadth; onChange breadth gọi `onOpts({ ...opts, breadth: value, leaf: value })`; thêm aria-label theo nhãn.
  - [x] IdeaMap openTreePanel dùng `{ ...savedOpts, leaf: savedOpts.breadth }` để đồng bộ cấu hình cũ; cập nhật chú thích mặc định.
  - [x] Cập nhật catalog Anh/Việt; smoke kiểm2range. Kiểm lưu breadth=leaf qua browser riêng, tránh thêm mốc history vào kịch bản undo hiện có.
  - [x] `npm test`, `npm run build`, `npm run test:smoke`;713/713 và build đạt; smoke qua panel/undo rồi gặp lỗi nền double-click có từ trước.

- [x] Task 2: Kiểm editor và tích hợp
  - [x] Playwright demo root→Combat/Level→2lá mỗi nhánh, cấu hình cũ80/24: mở panel thấy80/80, kéo120 làm cả2nhóm giãn; cấp giữ nguyên. PUT và reload120/120.
  - [x] Kiểm đặt lại56/56, đổi hướng, mobile375×667, console/network; chụp ảnh.
  - [x] Đọc diff, viết summary, kiểm identity/cached diff, commit8656330 và merge local; kiểm kết quả merge713/713, build đạt.
  - [x] Dừng Vite/browser, bỏ symlink; archive worktree, xóa run root và lưu conversation thực hiện ngay sau commit tài liệu; receipt tại nhật ký kiểm chứng.

## Kết quả
[Summary](../summaries/2026-10-19-same-level-spacing-summary.md) · [Spec](../specs/2026-10-19-same-level-spacing-design.md)
