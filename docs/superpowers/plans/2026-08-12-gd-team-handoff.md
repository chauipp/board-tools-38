# Game Design Team Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép GD tạo, theo dõi và xuất brief riêng cho Dev, Art và Audio từ Game Design board.

**Architecture:** Lưu `teamHandoff` trong `node.design`, normalize client trước khi autosave và validate server trước persistence. Inspector chỉnh dữ liệu từng team; Handoff panel gọi cùng một Markdown builder với `team` và `nodeIds` để preview/copy/download đúng phạm vi.

**Tech Stack:** React 18, Vite, Express, Mongoose, Node test runner.

## Global Constraints

- Chỉ Game Design board; Idea board không đổi.
- Desktop-first; edit dock cố định 275px và mọi control sửa dữ liệu nằm trong dock phải.
- Không upload asset hoặc tích hợp dịch vụ ngoài.
- Không commit/merge trong task này; worktree đang có thay đổi người dùng cần được giữ nguyên.

---

- [x] Task 1: Data contract, normalize và server validation

**Files:**
- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`
- Modify: `board-tools/client/src/lib/rebase.js`
- Modify: `board-tools/server/board-payload.js`
- Modify: `board-tools/server/board-payload.test.js`

**Interfaces:**
- Produces `emptyTeamHandoff()`, `normalizeTeamHandoff(value)`, `TEAM_HANDOFF_TEAMS` and normalized `design.teamHandoff`.

- [x] Add failing client tests for empty/default data, whitespace cleanup, invalid status fallback, and team-specific Markdown filtering.
- [x] Implement the client normalizer and include it in existing design normalization/rebase paths.
- [x] Add failing server tests for invalid handoff team/status/field type and valid three-team payload.
- [x] Add strict server validator for every persisted team handoff field; retain compatibility when an old card has no `teamHandoff`.
- [x] Run `npm test` in client and server.

- [x] Task 2: Inspector section for team briefs and status

**Files:**
- Modify: `board-tools/client/src/components/GameDesignPanel.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

**Interfaces:**
- Consumes `normalizeTeamHandoff()` and saves normalized `teamHandoff` inside `node.design`.
- Produces a collapsible `Team handoff` section with Dev/Art/Audio controls.

- [x] Add local handoff state reset on card change and save it through existing `onSave`.
- [x] Render one compact collapsible section per team: status, recipient, date, notes (Dev) or brief/requirements/reference/format/naming (Art/Audio).
- [x] Disable all editable controls for viewer; preserve read-only content.
- [x] Style fields and status badges as a vertical 275px dock layout with no horizontal overflow.
- [x] Run client unit tests and production build.

- [x] Task 3: Team-aware Markdown and Handoff panel

**Files:**
- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/components/DevHandoffPanel.jsx`
- Modify: `board-tools/client/src/pages/IdeaMap.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`
- Test: `board-tools/client/src/lib/game-design.test.js`

**Interfaces:**
- `gameDesignMarkdown(board, { team: "dev" | "art" | "audio", nodeIds? })` returns Markdown only for the target team.

- [x] Extend Markdown tests: Dev retains technical notes; Art/Audio contain their own requirements and omit unrelated content; selected scope retains only internal relations.
- [x] Add `team` option to Markdown builder and render handoff status/recipient/date plus only nonempty target-team fields.
- [x] Convert Handoff panel to team selector, status summary, team-specific help, copy and downloadable filename (`game-design-<team>-handoff.md`).
- [x] Rename header trigger/panel labels from Dev-only to `Handoff` without changing the right-dock interaction model.
- [x] Run `npm test`, smoke test and production build in client.

- [x] Task 4: Verify, document and phase tracking

**Files:**
- Modify: `docs/game-design-board-checklist.md`
- Modify: `docs/game-design-board-test-guide.md`
- Create: `docs/superpowers/summaries/2026-08-12-gd-team-handoff-summary.md`

- [x] Start frontend preview from the current worktree on an isolated port; use a temporary board that is deleted afterward.
- [x] Use Playwright to create a Game Design board, enter Dev/Art/Audio data, save/reload, switch each export target and verify no clipping/overlap in the 275px dock.
- [x] If authenticated GUI is unavailable, explicitly record that constraint and provide exact manual test steps instead of claiming UI is verified.
- [x] Tick completed checklist/plan tasks, write summary based on actual diff and tests, and link spec/plan/summary.

## Kết quả

Sau thực thi: [../summaries/2026-08-12-gd-team-handoff-summary.md](../summaries/2026-08-12-gd-team-handoff-summary.md)
