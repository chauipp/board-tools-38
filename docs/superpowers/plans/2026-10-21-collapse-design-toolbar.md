# Collapse design toolbar Implementation Plan

**Goal:** Thu/mở dãy công cụ thiết kế và nhớ lựa chọn theo workspace.

**Architecture:** Thêm toolsOpen vào boolean schema hiện có, nút Thiết kế điều khiển nhóm toolbar qua aria-expanded/hidden; không đụng nội dung board.

**Tech Stack:** React, CSS, workspace API, node:test, Playwright.

[Spec](../specs/2026-10-21-collapse-design-toolbar-design.md)

- [x] Task 1: Toggle và persistence
  - [x] Thêm client test mặc định true/giá trị false qua hydrate/patch, HTTP test boolean false và reject string; chạy đỏ trước sửa.
  - [x] Thêm toolsOpen vào client FLAGS và server toggles; IdeaMap bọc dãy, nút Thiết kế với aria-expanded/controls; CSS nhóm cuộn ngang khi hẹp.
  - [x] Client724/server145 và build đạt; smoke workspace và tree-panel đều đạt.
- [x] Task 2: Browser và tích hợp
  - [x] Browser desktop: thu/mở, inspector giữ nguyên, reload nhớ false; mobile375×667 nút luôn bấm được và nhóm cuộn riêng; board idea không có nút; console/network sạch.
  - [x] Summary4sections, kiểm staged diff/identity rồi commit và merge local; giữ CSS riêng và không push. Đã dừng QA và gỡ symlinks; archive worktree sau commit tài liệu.
  - [x] Sau tích hợp: client724/server145 đạt; frontend7155 trả200; backend3345 đang lắng nghe. Không còn server QA7156.

## Kết quả

[Summary](../summaries/2026-10-21-collapse-design-toolbar-summary.md)
