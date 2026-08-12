# Game Design Dev Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo chế độ Dev Handoff cho board Game Design và xuất tài liệu Markdown theo card hoặc selection.

**Architecture:** Mở rộng `node.design` bằng `technicalNotes`, thêm helper Markdown có filter nodeIds, và một panel dock chỉ đọc dữ liệu board để chọn phạm vi/xuất. Board idea giữ nguyên.

**Tech Stack:** React 18, Vite, Node.js test runner, Express, Socket.IO.

## Global Constraints

- Chỉ board `game-design` nhận Dev Handoff; board `idea` không đổi.
- Dock cố định 275px, controls dọc, scroll owner duy nhất.
- `technicalNotes` tối đa 2.000 ký tự; dữ liệu legacy thiếu field vẫn hợp lệ.
- Không làm task tracker, CSV, Jira/Linear sync hoặc công thức tuning trong phase này.
- Không tự commit.

## Kết quả

Sẽ tạo [summary](../summaries/2026-08-11-gd-dev-handoff-summary.md) sau khi mọi task và browser verification hoàn tất.

- [ ] Task 1: technical notes và validation

  - [ ] Viết test server chấp nhận `technicalNotes` hợp lệ, từ chối non-string và text vượt 2.000 ký tự; test client normalize trim/fallback legacy.
  - [ ] Bổ sung `technicalNotes` vào template card, `GameDesignPanel`, normalize data client và validator server mà không bắt buộc card cũ phải có field.
  - [ ] Chạy `npm test` trong `board-tools/server` và `board-tools/client`.

- [ ] Task 2: Markdown handoff theo phạm vi card

  - [ ] Viết test cho `gameDesignMarkdown(board, { nodeIds })`: chỉ có card thuộc phạm vi, section theo thứ tự Data/Acceptance/Examples/Failure/Tuning/Technical notes và dependencies chỉ còn khi cả hai đầu thuộc phạm vi.
  - [ ] Mở rộng helper Markdown với options optional, giữ nguyên output export board đầy đủ hiện có khi không truyền options.
  - [ ] Chạy `npm test` trong `board-tools/client`.

- [ ] Task 3: DevHandoffPanel và smoke

  - [ ] Viết smoke DOM thất bại: panel hiện số card, chuyển All/Selected, xuất không có card ngoài selection, viewer chỉ đọc/export.
  - [ ] Tạo `DevHandoffPanel.jsx`; gắn nút mở panel ở header board GD và đưa panel vào `edit-dock` trong `IdeaMap`.
  - [ ] Thêm CSS dọc, focus rõ, không nested scroll/horizontal overflow ở dock 275px.
  - [ ] Chạy `npm run test:smoke && npm run build` trong `board-tools/client`.

- [ ] Task 4: checklist, test guide và verification

  - [ ] Bổ sung test guide desktop: technical notes, All/Selected export, copy/download, viewer, dock scroll.
  - [ ] Tick checklist Dev handoff/technical notes sau khi feature pass review.
  - [ ] Khi có session, chạy Playwright desktop: save/reload/export/viewer/dock scroll/console/network.
  - [ ] Chạy toàn bộ test cuối server/client và tạo summary sau khi browser verification hoàn tất.
