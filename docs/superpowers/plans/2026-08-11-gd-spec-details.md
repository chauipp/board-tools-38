# Game Design Spec Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Thêm Examples, Failure States và Tuning Parameters có cấu trúc vào card Game Design, export Markdown và hỗ trợ realtime.

**Architecture:** Ba mảng nằm trong `node.design`, giữ tương thích card legacy. Server validate nodes như payload cũ; client normalize/export và `GameDesignPanel` quản lý form local trong dock phải hiện hữu.

**Tech Stack:** React 18, Vite, Express, Mongoose, Socket.IO, Node test runner, Playwright.

**Đặc tả:** [Game Design Spec Details — Design](../specs/2026-08-11-gd-spec-details-design.md).

## Global constraints

- Chỉ desktop; mobile dời Phase UX/mobile.
- Chỉ board GD hiển thị UI; board idea và card legacy không đổi.
- Dock cố định 275px, scroll owner duy nhất, controls dọc và không overlap.
- Không tự commit.

- [x] Task 1: Validation server cho detail collections

  - [x] Viết test thất bại: three valid collections, legacy missing fields, malformed item/id/text/count rejection.
  - [x] Mở rộng validator node design theo limits spec, không làm hỏng acceptanceCriteria legacy.
  - [x] Chạy `npm test` tại `board-tools/server`.

- [x] Task 2: Normalize và Markdown client

  - [x] Viết test thất bại normalize filter/trim/fallback id và export chỉ section có data.
  - [x] Thêm helpers vào `game-design.js` và Markdown card.
  - [x] Chạy `npm test` tại `board-tools/client`.

- [x] Task 3: Form details trong GameDesignPanel

  - [x] Viết smoke thất bại cho thêm/sửa/xóa/collapse và viewer read-only.
  - [x] Thêm section dọc, local save/outside-save, CSS focus/scroll.
  - [x] Chạy `npm run test:smoke && npm run build` tại `board-tools/client`.

- [ ] Task 4: Lifecycle, UI desktop, checklist và summary

  - [x] Kiểm load/import/socket/rebase normalize details và export qua luồng `IdeaMap`.
  - [ ] Khi có session, Playwright desktop thật: save/reload/export/viewer/dock scroll/console/network. (chờ phiên đăng nhập test)
  - [ ] Tạo summary bốn mục sau khi browser verification hoàn tất.
  - [x] Tick checklist Examples, Failure states, Tuning parameters.
  - [x] Chạy toàn bộ test cuối server/client.

## Kết quả

Khi hoàn tất, tạo [summary](../summaries/2026-08-11-gd-spec-details-summary.md) dựa trên diff và kết quả kiểm chứng.
