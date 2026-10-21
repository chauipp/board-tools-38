# Design toolbar second row Implementation Plan

> Thực thi trực tiếp theo executing-plans.

**Goal:** Đưa nút Thiết kế xuống dưới hàng tên board.

**Architecture:** Chuyển nguyên block toggle/toolbar trong IdeaMap.jsx ra sau hàng chính vào .gd-tools-row. CSS đặt margin-top:6px, giữ nhóm cuộn ngang. Không đổi state/API.

**Tech Stack:** React, CSS, Vite, Playwright.

[Spec](../specs/2026-10-21-design-toolbar-second-row-design.md)

- [x] Task 1: Chuyển hàng và kiểm
  - [x] Baseline client724 đạt; đọc recipe dock-wheel-scroll.
  - [x] Di chuyển block nút và nhóm trong client/src/pages/IdeaMap.jsx, thêm .gd-tools-row trong client/src/styles/idea-map.css.
  - [x] npm test --prefix client:724 đạt; npm run build --prefix client đạt.
  - [x] Browser1440×900 và375×667: toggle.y=53.5 lớn hơn đáy hàng tên47; thu/mở/reload/Reports hoạt động, không tràn viewport; pageerror và HTTP lỗi đều0; board PUT0.
- [x] Task 2: Hoàn tất
  - [x] Summary riêng bốn mục; staged diff và identity; commit67cb221 đã merge local; client724 đạt sau merge và7155 trả200. Giữ CSS riêng, không push; đã dừng QA và gỡ dependency symlink. Archive worktree sau commit tài liệu.

## Kết quả

[Summary](../summaries/2026-10-21-design-toolbar-second-row-summary.md)
