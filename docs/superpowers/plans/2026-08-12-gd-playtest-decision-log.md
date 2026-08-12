# Playtest & Decision Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lưu được evidence playtest và quyết định thiết kế có liên kết card, đồng thời xuất được trong handoff.

**Architecture:** Dữ liệu mới nằm trong `node.design`, được chuẩn hóa ở client trước khi lưu và kiểm ở server theo node IDs của board. `GameDesignPanel` hiển thị các section dọc trong dock hiện có; Markdown dùng cùng normalizer nên output và UI đồng nhất.

**Tech Stack:** React, Vite, Node test runner, Express payload validation.

## Global Constraints

- Chỉ áp dụng cho `game-design`; board tư duy giữ nguyên.
- Dock edit cố định 275px và controls xếp dọc.
- Desktop-first; không kiểm mobile ở phase này.
- Viewer chỉ đọc, editor mới thay đổi dữ liệu.
- Không commit hoặc merge trong task này.

---

- [x] Task 1: Model Playtest và Decision Log

**Files:**
- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`

**Interfaces:**
- Produces: `emptyPlaytestSession`, `normalizePlaytestSession`, `emptyDecisionLog`, `normalizeDecisionLog`.

- [x] Step 1: Viết test cho trim, entry rỗng, reference thiếu và Markdown.
- [x] Step 2: Cài normalizer và thêm section Playtest/Decision vào `gameDesignMarkdown`.
- [x] Step 3: Chạy `npm test` trong `board-tools/client`.

- [x] Task 2: Kiểm dữ liệu server

**Files:**
- Modify: `board-tools/server/board-payload.js`
- Modify: `board-tools/server/board-payload.test.js`

**Interfaces:**
- Consumes: object `node.design.playtestSession` và `node.design.decisionLog` từ Task 1.
- Produces: payload reject rõ ràng cho kiểu sai, status sai, ID/reference sai hoặc vượt giới hạn.

- [x] Step 1: Viết test payload hợp lệ và các case reject.
- [x] Step 2: Cài validation theo node IDs hiện có.
- [x] Step 3: Chạy `npm test` trong `board-tools/server`.

- [x] Task 3: Form dock và liên kết card

**Files:**
- Modify: `board-tools/client/src/components/GameDesignPanel.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`
- Modify: `board-tools/client/src/pages/IdeaMap.jsx`

**Interfaces:**
- Consumes: normalizer Task 1 và danh sách nodes của board.
- Produces: Playtest session chỉ trên Playtest card; Decision log cho toàn bộ card GD; viewer readonly.

- [x] Step 1: Truyền nodes vào inspector và render form section dọc/collapse.
- [x] Step 2: Lưu normalized session/log và hiển thị references bằng multi-select.
- [x] Step 3: Chạy focused client tests, smoke và build.

- [x] Task 4: Hoàn thiện test thủ công và hồ sơ tiến độ

**Files:**
- Modify: `docs/game-design-board-checklist.md`
- Modify: `docs/game-design-board-test-guide.md`
- Create: `docs/superpowers/summaries/2026-08-12-gd-playtest-decision-log-summary.md`

- [x] Step 1: Bổ sung luồng test Playtest/Decision Log và tick checklist khi đã test tự động.
- [x] Step 2: Dùng Playwright theo luồng editor nếu OAuth cho phép; nếu không, ghi blocker cụ thể.
- [x] Step 3: Viết summary dựa trên diff khi toàn bộ task hoàn tất.

## Kết quả

[Summary sau khi hoàn tất](../summaries/2026-08-12-gd-playtest-decision-log-summary.md)
