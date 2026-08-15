# Dependency Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện blocker/cycle của Game Design dependency trên card và edge inspector.

**Architecture:** Phân tích đồ thị chạy thuần ở client trên snapshot board; không có schema/API mới. IdeaMap memo kết quả và truyền trạng thái card/edge xuống component hiển thị.

**Tech Stack:** React 18, Vite, Node test runner.

## Global Constraints

- Chỉ edge `depends-on` node→node của Game Design.
- Không tự đổi/xóa relation; dock 275px và canvas hiện hữu không đổi bố cục.

---

- [x] Task 1: Graph analysis

**Files:**
- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`

- [x] Test/implement dependency chains, blocked status, cycle edge/card và relation non-dependency.
- [x] Run client unit tests.

- [x] Task 2: Card and edge feedback

**Files:**
- Modify: `board-tools/client/src/pages/IdeaMap.jsx`
- Modify: `board-tools/client/src/components/IdeaCard.jsx`
- Modify: `board-tools/client/src/components/EdgeLayer.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

- [x] Memo analysis once per board and show Blocked/Cycle badge on card.
- [x] Show chain/blocker/cycle warning in selected dependency edge inspector; apply a warning class to cycle edge.
- [x] Run client test/build/smoke.

- [ ] Task 3: Browser verify and docs

**Files:**
- Modify: `docs/game-design-board-checklist.md`
- Modify: `docs/game-design-board-test-guide.md`
- Create: `docs/superpowers/summaries/2026-08-12-gd-dependency-guard-summary.md`

- [ ] Browser verification blocked: Playwright MCP shared profile is in use; an isolated Chromium attempt reached the real backend but temporary board creation returned HTTP 500. Do not mark UI verification complete until backend test-board creation works.
- [x] Tick checklist and add the manual test script; write summary only after browser verification passes.

## Kết quả

Sau thực thi: [../summaries/2026-08-12-gd-dependency-guard-summary.md](../summaries/2026-08-12-gd-dependency-guard-summary.md)
