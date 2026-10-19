# Locked sibling swap Implementation Plan

> **For agentic workers:** use executing-plans, with a bounded parallel worker for layout helpers.

**Goal:** Kéo đổi chỗ hai nhánh cùng cha mà vẫn giữ cây tự xếp.

**Architecture:** Extend existing treeLayout with persisted siblingOrder/branchDirections. locked-tree owns validation and atomic swaps; IdeaMap owns mouse lifecycle and feedback. Existing server payloads and undo snapshots persist metadata unchanged.

**Tech Stack:** React18, Vite6, Node test runner, Playwright.

## Global Constraints

- Không sửa dirty client/src/index.css hoặc dữ liệu board thật. Không đổi cha, edges, API/schema.
- Gốc và khóa thủ công không kéo được; invalid drop/Escape không tạo undo/save.
- Slot/nhánh con giữ qua reflow, add, reload, undo/redo. UI dùng class riêng trong idea-map.css.

- [x] Task 1: Persist and swap layout slots

Files: client/src/lib/{tree-layout,locked-tree}.js and neighboring tests.

- [x] Baseline `node --test src/lib/locked-tree.test.js src/lib/tree-layout.test.js`.
- [x] Add behavior tests. Example: `assert.ok(find(swapped,2).y > find(swapped,3).y)`; cross-direction assert branch2 crosses root and its child remains further along new direction.
- [x] Implement `lockedTreeSiblings(board,key,nodeSize)` and `swapLockedSiblings(board,sourceKey,targetKey,nodeSize)`. Both validate canonical ownership/BFS parent/manual lock; swap returns original board for invalid pairs. Root metadata stores siblingOrder and branchDirections, layout consumes sanitized metadata.
- [x] Verify no input mutation, idempotent reflow, serialization, additions, malformed refs, independent trees.

- [x] Task 2: Drag and feedback in real editor

Files: client/src/pages/IdeaMap.jsx, client/src/components/{IdeaCard,FrameBox,TreePanel}.jsx, client/src/styles/idea-map.css.

- [x] Branch locked card/group mouse-down to `startLockedTreeSwap(e,key)`, retaining selection; source candidates via `lockedTreeSiblings`.
- [x] Mousemove after5px finds sibling under pointer using data-id/data-group-id, highlights valid target, shows concise instruction. No board writes during move.
- [x] Mouseup calls `swapLockedSiblings(boardRef.current, sourceKey, targetKey, frameCardSize)` then `commitAndSave(next)` only if changed. Escape/blur/unmount clean listeners without saving.
- [x] Preserve metadata when editing tree lock gaps/directions. Add styles for source/candidate/target; root stays default cursor.
- [x] Browser QA same-side/cross-side descendants/invalid/Escape/reload/undo/redo/add, mobile375×667, console/network; capture screenshots.

- [x] Task 3: Verify and integrate

- [x] Full client tests, build, smoke; read diff self-review; record known unchanged smoke baseline if still present.
- [x] Tick completed headings as work passes; write separate summary linked to spec and plan.
- [x] Before each commit: current Git identity, staged check and full staged diff; commit only task files. Fast-forward main preserving dirty CSS.
- [x] Stop QA process/browser and remove owned temp root. Preserve evidence outside run root; archive the clean native worktree after this documentation commit.

## Kết quả
[Summary](../summaries/2026-10-19-locked-sibling-swap-summary.md)

## Thiết kế
[Spec](../specs/2026-10-19-locked-sibling-swap-design.md)
