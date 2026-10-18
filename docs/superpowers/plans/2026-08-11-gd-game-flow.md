# Game Design Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Thêm Player Loop và Progression Map cấp board Game Design, chỉnh trong dock phải và xuất Markdown.

**Architecture:** `gameDesignFlow` là dữ liệu cấp board có validation server và normalize client. Một panel flow dùng lifecycle/dock/realtime đã có của Game brief; references chỉ trỏ tới node hiện tại.

**Tech Stack:** React 18, Vite, Node.js test runner, Express, Mongoose, Socket.IO, Playwright.

**Đặc tả:** [Game Design Flow — Design](../specs/2026-08-11-gd-game-flow-design.md).

## Global constraints

- Chỉ desktop; mobile được dời Phase UX/mobile.
- Chỉ board GD có flow UI, board idea tương thích không đổi.
- Dock cố định 275px, chỉ dock scroll, control dọc và không overlap.
- Không tự commit.

- [x] Task 1: Dữ liệu và payload server

  - [x] Viết test validator/payload cho flow hợp lệ, legacy, item sai kiểu, quá giới hạn và reference sai.
  - [x] Thêm `gameDesignFlow` schema/payload/PUT/socket/conflict với giới hạn spec.
  - [x] Chạy `npm test` tại `board-tools/server` (109 pass).

- [x] Task 2: Normalize, Markdown và rebase client

  - [x] Viết test thất bại cho normalize hai collection, filter item/reference không hợp lệ, Markdown và local-wins rebase.
  - [x] Thêm helpers/export Markdown rồi thêm flow vào scalar rebase.
  - [x] Chạy `npm test` tại `board-tools/client` (635 pass).

- [x] Task 3: Game Flow panel trong dock

  - [x] Viết smoke cho thêm/lưu Player Loop, collapse và viewer read-only.
  - [x] Tạo component form local, references tới card và outside-save; thêm CSS dọc/accessibility.
  - [x] Chạy `npm run test:smoke && npm run build` tại `board-tools/client`.

- [ ] Task 4: Tích hợp header, load/save và realtime

  - [ ] Viết smoke thất bại: `Game flow` chỉ GD, mở dock, PUT có flow, board idea không có nút.
  - [ ] Nối IdeaMap với state, lifecycle, normalize load/socket/conflict, header và export.
  - [ ] Chạy `npm test && npm run test:smoke && npm run build` tại `board-tools/client`.

- [ ] Task 5: Kiểm browser thật, checklist và summary

  - [ ] Chạy backend/frontend đúng worktree, tạo board GD test với API.
  - [ ] Playwright desktop: flow dài, save/reload/export/reference/dock scroll/no overlap; kiểm viewer/console/network rồi teardown.
  - [ ] Tick checklist Player Loop/Progression Map và tạo summary bốn mục.
  - [ ] Chạy `npm test` server và client checks cuối.

## Kết quả

Khi hoàn tất, tạo [summary](../summaries/2026-08-11-gd-game-flow-summary.md) dựa trên diff và kết quả kiểm chứng.
