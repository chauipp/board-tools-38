# Game Design Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trạng thái và dữ liệu review card cho quy trình duyệt Game Design.

**Architecture:** Dữ liệu `review` sống trong `node.design`, đi qua normalizer/validator hiện hữu. Review section dùng state cục bộ GameDesignPanel; status board chỉ mở rộng seed status cho board GD mới.

**Tech Stack:** React 18, Vite, Express, Mongoose, Node test runner.

## Global Constraints

- Chỉ Game Design; dock desktop 275px, viewer read-only.
- Không tự đổi board status khi đổi review outcome.
- Không thêm notification hay dịch vụ ngoài.

---

- [x] Task 1: Review data contract và status seed

**Files:**
- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`
- Modify: `board-tools/client/src/components/IdeaCard.jsx`
- Modify: `board-tools/server/board-payload.js`
- Modify: `board-tools/server/board-payload.test.js`
- Modify: `board-tools/server/boards.js`

- [x] Test/implement `emptyReview`, `normalizeReview`, review Markdown/preview và payload invalid.
- [x] Bổ sung Approved/Rejected vào seed status Game Design mới.
- [x] Chạy client/server tests.

- [x] Task 2: Review inspector UI

**Files:**
- Modify: `board-tools/client/src/components/GameDesignPanel.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

- [x] Render section Review, outcome, reviewer/date và comment resolve/add/remove; persist qua save.
- [x] Render badge outcome review trên Game Design card và giữ layout card/dock không overlap.
- [x] Run client test/build/smoke.

- [x] Task 3: Verify và tài liệu

**Files:**
- Modify: `docs/game-design-board-checklist.md`
- Modify: `docs/game-design-board-test-guide.md`
- Create: `docs/superpowers/summaries/2026-08-12-gd-review-workflow-summary.md`

- [x] Playwright: tạo board/card tạm, lưu/reload changes requested/comment resolved, kiểm output card/Markdown/dock/console/network, rồi xóa board.
- [x] Tick plan/checklist và viết summary.

## Kết quả

Sau thực thi: [../summaries/2026-08-12-gd-review-workflow-summary.md](../summaries/2026-08-12-gd-review-workflow-summary.md)
