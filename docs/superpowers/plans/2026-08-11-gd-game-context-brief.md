# Game Design Context Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm brief cấp board cho Game Design gồm bối cảnh game và player journey, có thể chỉnh trong dock phải và xuất Markdown.

**Architecture:** Đặt `gameDesignBrief` ở payload/schema board thay vì node để bối cảnh chỉ có một nguồn sự thật. Helpers thuần trong `game-design.js` chuẩn hóa brief và tạo Markdown; `GameDesignBriefPanel` chỉ quản lý form local, còn `IdeaMap` mở panel/dữ liệu/realtime qua lifecycle board hiện có.

**Tech Stack:** React 18, Vite, Node.js test runner, Express, Mongoose, Playwright.

## Global Constraints

- Chỉ `kind === "game-design"` dùng brief UI; board idea và board cũ không có field vẫn hoạt động như trước.
- `gameDesignBrief` gồm `genre`, `targetAudience`, `playerFantasy` tối đa 4.000 ký tự và `playerJourney` tối đa 50 stage, mỗi field stage tối đa 1.000 ký tự.
- Stage thiếu `title` bị bỏ khi lưu; viewer chỉ đọc, mọi control sửa phải disabled hoặc ẩn rõ ràng.
- Dock cố định 275px, scrollbar thuộc `.edit-dock` ở sát mép phải; hover dock không được làm canvas lia/zoom.
- Control tối thiểu 32px, label tối thiểu 12px; Phase 1A chỉ xác nhận desktop. Kiểm mobile 375×667 được dời sang Phase UX/mobile sau.
- Không tự commit; các bước commit chỉ chạy khi người dùng yêu cầu.

---

## File structure

- `board-tools/client/src/lib/game-design.js`: normalize brief, kiểm stage, Markdown phần Game Context.
- `board-tools/client/src/lib/game-design.test.js`: test helper/Markdown brief.
- `board-tools/client/src/components/GameDesignBriefPanel.jsx`: form brief và player journey trong dock.
- `board-tools/client/src/pages/IdeaMap.jsx`: state mở brief, save/load/realtime normalize, nút header và dock composition.
- `board-tools/client/src/styles/idea-map.css`: style nút header và stage journey responsive.
- `board-tools/client/src/lib/rebase.js`, `rebase.test.js`: merge scalar `gameDesignBrief` khi conflict.
- `board-tools/server/models.js`, `boards.js`, `board-payload.js`, `board-payload.test.js`: persistence, API/socket và validation.
- `docs/game-design-board-checklist.md`: tick chính xác Phase 1A sau kiểm chứng.
- `docs/superpowers/summaries/2026-08-11-gd-game-context-brief-summary.md`: summary khi toàn bộ task hoàn tất.

## - [x] Task 1: Thêm mô hình brief, validation và truyền payload server

**Files:**

- Modify: `board-tools/server/models.js`
- Modify: `board-tools/server/boards.js`
- Modify: `board-tools/server/board-payload.js`
- Modify: `board-tools/server/board-payload.test.js`

**Interfaces:**

- Produces: `gameDesignBrief` optional trong GET, conflict body, PUT update và socket `board:update`.
- Consumes: `{ genre, targetAudience, playerFantasy, playerJourney: [{ id, title, experience, emotion }] }`.

- [ ] **Step 1: Viết test server thất bại**

  Thêm payload GD hợp lệ:

  ```js
  gameDesignBrief: {
    genre: "Roguelite",
    targetAudience: "Người chơi thích mastery",
    playerFantasy: "Thợ săn linh hoạt",
    playerJourney: [{ id: "journey-1", title: "Khám phá", experience: "Thử build", emotion: "Tò mò" }]
  }
  ```

  Assert payload không brief vẫn `null`; assert `gameDesignBrief: []`, stage `id: 1`, `title: 2`, và 51 stage bị từ chối.

- [ ] **Step 2: Chạy test để xác nhận lỗi**

  Run: `npm test -- --test-name-pattern="brief"`

  Working directory: `board-tools/server`

  Expected: FAIL vì validator chưa nhận/kiểm brief.

- [ ] **Step 3: Cài đặt persistence và validation**

  Thêm `gameDesignBrief: { type: Object, default: null }` vào board schema. Thêm field vào `boardPayload`, destructuring PUT, `findByIdAndUpdate` và socket payload. Trong validator, dùng constants `GAME_DESIGN_BRIEF_LIMITS = { text: 4000, stageText: 1000, stages: 50, id: 120 }`; nhận `undefined`/`null` hoặc object không array, kiểm bốn string brief và tất cả stage object/string/id trước khi DB ghi.

- [ ] **Step 4: Chạy full server suite**

  Run: `npm test`

  Working directory: `board-tools/server`

  Expected: PASS.

- [ ] **Step 5: Commit khi được yêu cầu**

  ```bash
  git add board-tools/server/models.js board-tools/server/boards.js board-tools/server/board-payload.js board-tools/server/board-payload.test.js
  git commit -m "feat: persist game design context brief"
  ```

## - [x] Task 2: Chuẩn hóa brief client, Markdown và rebase

**Files:**

- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`
- Modify: `board-tools/client/src/lib/rebase.js`
- Modify: `board-tools/client/src/lib/rebase.test.js`

**Interfaces:**

- Produces: `emptyGameDesignBrief()`, `normalizeGameDesignBrief(value)`, `hasGameDesignBrief(brief)`, `gameDesignMarkdown(board)`.
- Consumes: partial/legacy `board.gameDesignBrief`.

- [ ] **Step 1: Viết test helper và Markdown thất bại**

  Assert `normalizeGameDesignBrief(null)` ra ba chuỗi rỗng + `playerJourney: []`; stage title rỗng bị bỏ; stage valid được trim. Assert Markdown có `## Game Context`, ba field có giá trị, numbered journey line, và không có heading khi brief rỗng. Thêm rebase test với local đổi `genre`, server đổi node/edge, assert cả hai còn.

- [ ] **Step 2: Chạy test để xác nhận lỗi**

  Run: `npm test -- --test-name-pattern="brief|Game Context"`

  Working directory: `board-tools/client`

  Expected: FAIL vì helpers/scalar chưa tồn tại.

- [ ] **Step 3: Cài đặt helpers và export**

  Dùng id fallback `journey-${index + 1}` chỉ trong client normalize; trim fields, lọc stage không title. Trong Markdown, thêm trước `## Game Design`:

  ```md
  ## Game Context

  **Genre**

  Roguelite

  **Player journey**

  1. **Khám phá** — Thử build · Tò mò
  ```

  Bỏ từng phần rỗng. Thêm `gameDesignBrief` vào `SCALARS` của rebase để local brief follow luật scalar thắng conflict.

- [ ] **Step 4: Chạy test client**

  Run: `npm test`

  Working directory: `board-tools/client`

  Expected: PASS.

- [ ] **Step 5: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/lib/game-design.js board-tools/client/src/lib/game-design.test.js board-tools/client/src/lib/rebase.js board-tools/client/src/lib/rebase.test.js
  git commit -m "feat: normalize and export game context brief"
  ```

## - [x] Task 3: Tạo inspector Game Context Brief trong dock

**Files:**

- Create: `board-tools/client/src/components/GameDesignBriefPanel.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

**Interfaces:**

- Consumes: `brief`, `canEdit`, `onSave(nextBrief)`, `onClose()`, `outsideRef`.
- Produces: brief normalized; only calls `onSave` with stage có title.

- [ ] **Step 1: Viết smoke DOM cho form**

  Trong `src/__smoke__/entry.jsx`, render panel với brief rỗng; click `+ Thêm giai đoạn`, fill `Khám phá`, `Thử build`, `Tò mò`, save, assert `onSave` nhận đúng stage. Render viewer và assert input/button disabled/không save.

- [ ] **Step 2: Chạy smoke để xác nhận lỗi**

  Run: `npm run test:smoke`

  Working directory: `board-tools/client`

  Expected: FAIL vì component chưa tồn tại.

- [ ] **Step 3: Cài đặt form local và outside-save**

  Dùng cấu trúc `GameDesignPanel`: state brief normalized, `dirty`, `useCloseOnOutside`. Render field `Genre`, `Target audience`, `Player fantasy`; mỗi journey row gồm title input, experience textarea, emotion input, button `Xóa`. `+ Thêm giai đoạn` tạo `{ id: crypto.randomUUID(), title: "", experience: "", emotion: "" }`. `save()` gọi `onSave(normalizeGameDesignBrief(localBrief))`, reset dirty; click ngoài khi dirty save rồi close.

- [ ] **Step 4: Thêm CSS panel journey**

  Dùng `.gd-brief-panel`, `.gd-journey-stage`, `.gd-journey-remove`, `.gd-add-journey`: xếp dọc, row controls không overlap, min-height 32px, label 12px, focus-visible accent. Không đặt `overflow` mới trong panel; `.edit-dock` là scroll owner sát mép phải.

- [ ] **Step 5: Chạy smoke và build**

  Run: `npm run test:smoke && npm run build`

  Working directory: `board-tools/client`

  Expected: PASS.

- [ ] **Step 6: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/components/GameDesignBriefPanel.jsx board-tools/client/src/styles/idea-map.css board-tools/client/src/__smoke__/entry.jsx
  git commit -m "feat: edit game design context brief"
  ```

## - [x] Task 4: Gắn brief vào header, dock, load/save và quyền xem

**Files:**

- Modify: `board-tools/client/src/pages/IdeaMap.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

**Interfaces:**

- Consumes: `GameDesignBriefPanel`, `normalizeGameDesignBrief`, `board.gameDesignBrief`.
- Produces: nút header `Game brief` chỉ board GD; `saveGameDesignBrief(nextBrief)` qua `commitAndSave`.

- [ ] **Step 1: Viết smoke hành vi integration**

  Với board `kind: "game-design"`, assert nút `Game brief` xuất hiện; bấm nút mở `.edit-dock` chứa brief panel, save làm PUT mang `gameDesignBrief`. Với board `kind: "idea"`, assert nút/panel không có.

- [ ] **Step 2: Chạy smoke để xác nhận lỗi**

  Run: `npm run test:smoke`

  Working directory: `board-tools/client`

  Expected: FAIL vì header/dock chưa nối brief.

- [ ] **Step 3: Nối lifecycle board và header**

  Khi GET/socket/conflict/import nhận board GD, gọi `normalizeGameDesignBrief` cùng normalize checklist. Thêm state `briefOpen`; render button chữ `Game brief` cạnh `island-name` chỉ cho GD; click đóng inspector card/edge rồi mở brief. Render `GameDesignBriefPanel` trong `.edit-dock`; dock condition bao gồm `briefOpen`; `saveGameDesignBrief` tạo `{ ...boardRef.current, gameDesignBrief: nextBrief }`, record history, set ref/state, saveNow.

- [ ] **Step 4: Giữ UI isolation và quyền**

  Viewer vẫn mở xem brief nhưng panel không mutating. Khi chuyển board/press Escape/click outside, panel close đúng thứ tự đang dùng; button dùng accessible name/title. Không thêm brief vào board idea hoặc canvas card.

- [ ] **Step 5: Chạy full client checks**

  Run: `npm test && npm run test:smoke && npm run build`

  Working directory: `board-tools/client`

  Expected: PASS.

- [ ] **Step 6: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/pages/IdeaMap.jsx board-tools/client/src/styles/idea-map.css board-tools/client/src/__smoke__/entry.jsx
  git commit -m "feat: open game context brief from board header"
  ```

## - [x] Task 5: Kiểm browser thật, cập nhật phase và summary

**Files:**

- Modify: `docs/game-design-board-checklist.md`
- Create: `docs/superpowers/summaries/2026-08-11-gd-game-context-brief-summary.md`

**Interfaces:**

- Consumes: backend thật `http://localhost:3345`, frontend Vite `http://localhost:7155` hoặc port Vite báo ra.
- Produces: evidence desktop/mobile và tick Phase 1A đã thực hiện.

- [x] **Step 1: Khởi động app thật**

  Run: `PORT=3345 PUBLIC_MODE=true npm run dev`

  Working directory: `board-tools/server`

  Run: `CHOKIDAR_USEPOLLING=true npm run dev -- --host 0.0.0.0`

  Working directory: `board-tools/client`

- [x] **Step 2: Playwright desktop**

  Tạo board GD API test, mở browser desktop, assert button `Game brief`; điền ba field và hai stage, save rồi reload; assert field giữ đúng, export Markdown chứa `## Game Context` và journey. Chụp screenshot dock stage dài, kiểm scrollbar sát mép phải và không overlap canvas HUD/minimap/zoom/filter.

- [x] **Step 3: Playwright quyền viewer desktop**

  Mở board bằng viewer member trên desktop; assert brief đọc được nhưng controls không chỉnh/lưu/xóa. Assert console không error và network không 4xx/5xx bất ngờ; xóa board test API ở teardown. Kiểm mobile được dời sang Phase UX/mobile sau.

- [x] **Step 4: Chạy test cuối**

  Run: `npm test && npm run test:smoke && npm run build`

  Working directory: `board-tools/client`

  Run: `npm test`

  Working directory: `board-tools/server`

  Expected: PASS.

- [x] **Step 5: Cập nhật checklist và summary**

  Tick chính xác Phase 1 và mục cấu trúc/spec tương ứng cho genre, target audience, player fantasy, player journey; không tick Player Loop/Progression/Failure states/Examples/Tuning. Summary có bốn mục `Đã làm gì`, `File chính`, `Khác với plan`, `Còn dở / cần lưu ý`, link đầu file tới spec/plan.

- [ ] **Step 6: Commit khi được yêu cầu**

  ```bash
  git add docs/game-design-board-checklist.md docs/superpowers/summaries/2026-08-11-gd-game-context-brief-summary.md
  git commit -m "test: verify game design context brief"
  ```

## Kết quả

Khi hoàn tất, tạo [summary](../summaries/2026-08-11-gd-game-context-brief-summary.md) dựa trên diff và kết quả kiểm chứng.
