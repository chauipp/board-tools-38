# Game Design Ready-for-Dev Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến mỗi thẻ Game Design thành một hạng mục có thể review, bàn giao cho dev và theo dõi tiến độ mà không thay đổi hành vi của board tư duy.

**Architecture:** Gom quy tắc checklist, quan hệ và Markdown vào `lib/game-design.js` để client có một nguồn dữ liệu thống nhất. `IdeaMap` chỉ điều phối thao tác canvas/dock; `GameDesignPanel` và `EdgeLayer` lần lượt hiển thị/chỉnh sửa checklist và quan hệ. Server chỉ mở rộng validation và default của board GD mới, nên board cũ giữ nguyên dữ liệu lẫn status.

**Tech Stack:** React 18, Vite, Node.js test runner, Express, Mongoose, Playwright.

## Global Constraints

- Chỉ board có `kind === "game-design"` nhận workflow, checklist UI và relation UI mới; board thiếu `kind` vẫn là `idea`.
- Board GD mới có đúng sáu status mặc định: `Draft`, `Review`, `Ready for dev`, `In dev`, `Testing`, `Done`; board GD đã tồn tại không bị migration status.
- Checklist lưu dưới `node.design.acceptanceCriteria` là `{ id, text, done }[]`; chuỗi legacy phải đọc/lưu lại an toàn thành một item chưa hoàn thành.
- Relation hợp lệ duy nhất: `depends-on`, `unlocks`, `replaces`, `conflicts-with`; edge idea hoặc edge cũ không relation vẫn là dây thường.
- Edit dock cố định 275px; desktop và viewport 375×667 không được overflow ngang hoặc overlap HUD/minimap/zoom/filter.
- Control có hit area tối thiểu 32px; dock tối thiểu 12px; preview canvas tối thiểu 11px; màu luôn đi kèm nhãn chữ và trạng thái hover/focus rõ.
- Không tự commit thay đổi; mỗi bước “Commit” dưới đây chỉ thực hiện khi người dùng yêu cầu commit.

---

## File structure

- `board-tools/client/src/lib/game-design.js`: constants, chuẩn hóa checklist/relation, preview và export Markdown GD.
- `board-tools/client/src/lib/game-design.test.js`: test đơn vị cho dữ liệu checklist/relation và Markdown.
- `board-tools/client/src/components/GameDesignPanel.jsx`: inspector checklist có thêm/sửa/tick/xóa và chế độ viewer.
- `board-tools/client/src/components/IdeaCard.jsx`: hiển thị tiến độ checklist cô đọng trên card GD.
- `board-tools/client/src/components/EdgeLayer.jsx`: render relation label và biến thể dây cho GD một cách không che UI.
- `board-tools/client/src/pages/IdeaMap.jsx`: tạo/sửa edge GD, gắn edge inspector vào dock, truyền props canvas, chuẩn hóa board load/import/save.
- `board-tools/client/src/styles/idea-map.css`: layout dock, checklist, edge label, control state và responsive anti-overlap.
- `board-tools/server/boards.js`: sáu status mặc định cho board GD được tạo sau thay đổi.
- `board-tools/server/board-payload.js`: validation checklist/relation mới nhưng nhận legacy string.
- `board-tools/server/board-payload.test.js`: regression test payload hợp lệ/không hợp lệ.
- `docs/game-design-board-checklist.md`: tick các dòng Phase đang hoàn thành.
- `docs/superpowers/summaries/2026-08-11-gd-ready-for-dev-summary.md`: summary sau khi toàn bộ task hoàn tất.

## - [x] Task 1: Chuẩn hóa mô hình checklist, relation và export GD

**Files:**

- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`

**Interfaces:**

- Produces: `RELATION_OPTIONS`, `normalizeAcceptanceCriteria(value)`, `acceptanceProgress(node)`, `relationDefinition(relation)`, `gameDesignMarkdown(board)`.
- Consumes: node GD có `design` tùy chọn và edge `{ id, from, to, relation? }`.

- [ ] **Step 1: Viết test thất bại cho dữ liệu mới và legacy**

  Thêm các test Node cho các kết quả chính xác sau:

  ```js
  assert.deepEqual(normalizeAcceptanceCriteria("Có cooldown"), [
    { id: "ac-legacy-1", text: "Có cooldown", done: false }
  ]);
  assert.deepEqual(acceptanceProgress({ design: { acceptanceCriteria: [
    { id: "ac-1", text: "A", done: true },
    { id: "ac-2", text: "B", done: false }
  ] } }), { done: 1, total: 2 });
  assert.match(gameDesignMarkdown(board), /- \[x\] Có cooldown/);
  assert.match(gameDesignMarkdown(board), /Depends on|Phụ thuộc/);
  ```

- [ ] **Step 2: Chạy test để xác nhận lỗi**

  Run: `npm test -- --test-name-pattern="checklist|Markdown|relation"`

  Working directory: `board-tools/client`

  Expected: FAIL vì các helper và checklist Markdown chưa tồn tại.

- [ ] **Step 3: Cài đặt helpers dữ liệu thuần**

  Trong `game-design.js`, tạo `RELATION_OPTIONS` với id, nhãn tiếng Việt, class style; chuẩn hóa `undefined` thành `[]`, chuỗi không rỗng thành đúng một item legacy, mảng thành các `{ id, text: String(text).trim(), done: Boolean(done) }` có id ổn định. Đổi `emptyDesign()` để card mới có `acceptanceCriteria: []`; loại field này khỏi `gameDesignPreview()` text và thay bằng progress khi `total > 0`.

  Cập nhật `gameDesignMarkdown(board)` để:

  ```md
  **Acceptance criteria**

  - [x] Skill có cooldown
  - [ ] Cooldown hiện đúng UI

  ## Quan hệ

  - Combat — Phụ thuộc → Stamina
  ```

  Chỉ xuất mục `## Quan hệ` khi board có ít nhất một edge relation; tra tên thẻ bằng `id`, bỏ edge có đầu mút không còn tồn tại.

- [ ] **Step 4: Chạy test đơn vị client**

  Run: `npm test`

  Working directory: `board-tools/client`

  Expected: PASS, gồm toàn bộ test cũ và test checklist/relation mới.

- [ ] **Step 5: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/lib/game-design.js board-tools/client/src/lib/game-design.test.js
  git commit -m "feat: model game design criteria and relations"
  ```

## - [x] Task 2: Bảo vệ dữ liệu server và đổi default workflow cho board GD mới

**Files:**

- Modify: `board-tools/server/board-payload.js`
- Modify: `board-tools/server/board-payload.test.js`
- Modify: `board-tools/server/boards.js`

**Interfaces:**

- Consumes: payload `nodes[].design.acceptanceCriteria` và `edges[].relation`.
- Produces: `validateBoardPayload(body)` trả `null` với checklist/relation hợp lệ và chuỗi lỗi với dữ liệu không hợp lệ.

- [ ] **Step 1: Viết test validation và default status**

  Bổ sung test cho payload GD hợp lệ:

  ```js
  design: { acceptanceCriteria: [{ id: "ac-1", text: "Cooldown", done: false }] }
  edges: [{ id: 1, from: 1, to: 2, relation: "depends-on" }]
  ```

  Bổ sung test rejection cho `acceptanceCriteria: [{ id: 3, text: "x", done: false }]`, text rỗng, `done: "yes"`, và `relation: "blocks"`; giữ một test xác nhận `acceptanceCriteria: "Có cooldown"` legacy vẫn qua.

- [ ] **Step 2: Chạy server test để xác nhận lỗi**

  Run: `npm test -- --test-name-pattern="Game Design|checklist|relation"`

  Working directory: `board-tools/server`

  Expected: FAIL vì validator chưa kiểm tra hình dạng checklist/relation.

- [ ] **Step 3: Mở rộng validation không làm gãy board cũ**

  Khai báo tập relation hợp lệ cạnh `BOARD_KINDS`. Trong vòng node, chỉ kiểm `design.acceptanceCriteria` khi field tồn tại: nhận string hoặc array; mỗi item array phải object với `id` string không rỗng tối đa 120 ký tự, `text` string trim không rỗng tối đa `BOARD_LIMITS.descLen`, `done` boolean. Trong vòng edge, nếu `relation` tồn tại thì chỉ nhận string thuộc tập bốn relation; không bắt buộc `relation` theo `body.kind` để payload GD cũ/partial save vẫn qua.

  Đổi `GAME_DESIGN_STATUSES` thành ids 1–6 theo thứ tự:

  ```js
  ["Draft", "Review", "Ready for dev", "In dev", "Testing", "Done"]
  ```

  và đặt `nextStatusId: 7` trong route tạo board. Không có update/migration nào cho document có sẵn.

- [ ] **Step 4: Chạy toàn bộ server test**

  Run: `npm test`

  Working directory: `board-tools/server`

  Expected: PASS.

- [ ] **Step 5: Commit khi được yêu cầu**

  ```bash
  git add board-tools/server/board-payload.js board-tools/server/board-payload.test.js board-tools/server/boards.js
  git commit -m "feat: validate game design delivery data"
  ```

## - [x] Task 3: Thay textarea bằng acceptance checklist trong inspector

**Files:**

- Modify: `board-tools/client/src/components/GameDesignPanel.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

**Interfaces:**

- Consumes: `normalizeAcceptanceCriteria(value)` và `acceptanceProgress(node)` từ `game-design.js`.
- Produces: `GameDesignPanel` gọi `onSave(nextNode)` với `design.acceptanceCriteria` luôn là mảng đã chuẩn hóa sau mọi lần người dùng sửa.

- [ ] **Step 1: Viết test component mức hành vi hoặc smoke DOM hiện hữu**

  Trong smoke entry hiện hữu, thêm kịch bản mở một thẻ GD, bấm `Thêm tiêu chí`, điền `Có cooldown`, tick checkbox, rồi lưu. Assert text tiến độ `1/1` và payload node có `[{ text: "Có cooldown", done: true }]`. Với `canEdit={false}`, assert checkbox, input text, nút thêm và nút xóa đều không thao tác được.

- [ ] **Step 2: Chạy smoke test để xác nhận lỗi**

  Run: `npm run test:smoke`

  Working directory: `board-tools/client`

  Expected: FAIL vì inspector còn textarea `Acceptance criteria`.

- [ ] **Step 3: Cài đặt section checklist có thao tác rõ ràng**

  Tách render `acceptanceCriteria` khỏi map textarea. Khởi tạo local state bằng `normalizeAcceptanceCriteria(node.design?.acceptanceCriteria)`. Mỗi hàng dùng checkbox có accessible name `Hoàn thành tiêu chí: <text>`, input text, và button chữ `Xóa` mang class danger. Nút `+ Thêm tiêu chí` tạo `{ id: crypto.randomUUID(), text: "", done: false }`; không đưa item text rỗng vào `onSave`.

  Giữ luật hiện tại: click ra ngoài nếu dirty thì lưu rồi đóng dock; `save()` merge design và persist mảng normalized. Viewer vẫn đọc được danh sách/progress nhưng mọi input/button bị `disabled`, và không có nút lưu.

- [ ] **Step 4: Hoàn thiện CSS khả dụng trong dock 275px**

  Tạo `.gd-criteria`, `.gd-criterion-row`, `.gd-criterion-toggle`, `.gd-criterion-remove`. Hàng criterion dùng grid `32px minmax(0, 1fr) auto`, gap 6px, input không tràn, button/click target tối thiểu 32px. Dùng `font-size: 12px` hoặc lớn hơn, `line-height: 1.4`, focus-visible viền accent rõ; xóa dùng chữ và `var(--danger)` thay vì icon đơn độc. Giới hạn scrolling ở `.gd-panel`, không tăng chiều ngang `.edit-dock`.

- [ ] **Step 5: Chạy smoke và build**

  Run: `npm run test:smoke && npm run build`

  Working directory: `board-tools/client`

  Expected: PASS.

- [ ] **Step 6: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/components/GameDesignPanel.jsx board-tools/client/src/styles/idea-map.css board-tools/client/src/__smoke__/entry.jsx
  git commit -m "feat: edit game design acceptance criteria"
  ```

## - [x] Task 4: Hiển thị progress checklist trên card GD

**Files:**

- Modify: `board-tools/client/src/components/IdeaCard.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`
- Modify: `board-tools/client/src/lib/game-design.test.js`

**Interfaces:**

- Consumes: `acceptanceProgress(node)`.
- Produces: card GD render `.gd-card-progress` chỉ khi `total > 0`, ví dụ `Tiêu chí 1/3`.

- [ ] **Step 1: Viết assertion regression cho preview/progress**

  Thêm test xác nhận `gameDesignPreview()` không stringify checklist thành `[object Object]`, còn `acceptanceProgress()` trả `{ done: 0, total: 0 }` với string rỗng và `{ done: 2, total: 3 }` với checklist đã tick.

- [ ] **Step 2: Chạy test để xác nhận lỗi**

  Run: `npm test -- --test-name-pattern="progress|preview"`

  Working directory: `board-tools/client`

  Expected: FAIL trước khi progress helper/card được dùng.

- [ ] **Step 3: Render progress tách biệt khỏi preview text**

  Trong nhánh `gameDesign` của `IdeaCard`, tính progress từ node và render sau type/before preview:

  ```jsx
  {progress.total > 0 && <div className="gd-card-progress">Tiêu chí {progress.done}/{progress.total}</div>}
  ```

  Đảm bảo click vào text progress vẫn mở inspector như phần card còn lại và không thêm control edit riêng cho viewer.

- [ ] **Step 4: Đặt kiểu đọc được ở zoom mặc định**

  Dùng `.gd-card-progress` tối thiểu 11px, accent/badge background có tương phản, `overflow-wrap: anywhere`; không thay đổi width card hoặc làm preview đè action/title.

- [ ] **Step 5: Chạy test và build client**

  Run: `npm test && npm run build`

  Working directory: `board-tools/client`

  Expected: PASS.

- [ ] **Step 6: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/components/IdeaCard.jsx board-tools/client/src/styles/idea-map.css board-tools/client/src/lib/game-design.js board-tools/client/src/lib/game-design.test.js
  git commit -m "feat: show game design criterion progress"
  ```

## - [x] Task 5: Tạo, sửa và chọn relation qua edge inspector trong dock

**Files:**

- Modify: `board-tools/client/src/pages/IdeaMap.jsx`
- Modify: `board-tools/client/src/components/EdgeLayer.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`
- Modify: `board-tools/client/src/lib/game-design.js`

**Interfaces:**

- Consumes: `RELATION_OPTIONS` và `relationDefinition(relation)`.
- Produces: edge mới của board GD `{ id, from, fromKind, to, toKind, relation: "depends-on" }`; edge idea giữ nguyên shape không relation.

- [ ] **Step 1: Viết smoke case về relation edge**

  Mở board GD có hai card, tạo dây, assert edge mới có `relation === "depends-on"`; chọn edge, đổi select sang `unlocks`, assert dock hiện `Mở khóa` và SVG hiện nhãn đó. Lặp lại trên board idea để assert vẫn chỉ mở `EdgeMenu` cũ, không có selector relation.

- [ ] **Step 2: Chạy smoke để xác nhận lỗi**

  Run: `npm run test:smoke`

  Working directory: `board-tools/client`

  Expected: FAIL vì edge mới không có `relation` và chưa có edge inspector GD.

- [ ] **Step 3: Gắn relation vào vòng đời edge của IdeaMap**

  Trong `toggleEdge`, thêm `relation: "depends-on"` chỉ khi `board.kind === "game-design"`. Khi click edge GD, set selected edge và render một section trong `.edit-dock` thay cho `EdgeMenu` floating; section có tiêu đề `Quan hệ thẻ`, select với bốn option, mô tả nhãn/hướng và button `Xóa dây`. `onChange` gọi `updateEdge(edge.id, { relation: validRelation })`.

  Khi selection chuyển card/edge khác hoặc edge bị xóa, dọn state inspector; chỉ editor nhìn/chạm select/xóa, viewer đọc relation dưới dạng text disabled. Giữ edge menu, reverse, label, color, style và behavior board idea không đổi.

- [ ] **Step 4: Render label and stroke không dựa riêng vào màu**

  Truyền `gameDesign={board.kind === "game-design"}` tới `EdgeLayer`. Với edge có relation, lấy label/class từ `relationDefinition`, render `<text className="edge-relation-label">Phụ thuộc</text>` chỉ khi độ dài segment sau clipping tối thiểu 150 canvas px; đoạn ngắn không render label canvas và inspector vẫn hiện đầy đủ relation. Áp class riêng trên visible line để quan hệ có dash/width/màu khác nhau, song song với `edge.style` người dùng có thể chọn.

- [ ] **Step 5: Hoàn thiện layout và accessibility relation**

  Thêm `.edge-inspector` xếp dọc trong dock; select và delete button cao ít nhất 32px. `.edge-relation-label` tối thiểu 11px, nền `var(--surface)`/stroke contrast, `pointer-events: none`, text anchor giữa dây. Đặt z-index layer dưới card/connector như hiện tại để nhãn không che vùng bấm; không render label ngắn là cơ chế tránh overlap, không dùng màu làm dấu hiệu duy nhất.

- [ ] **Step 6: Chạy smoke, unit và build**

  Run: `npm test && npm run test:smoke && npm run build`

  Working directory: `board-tools/client`

  Expected: PASS.

- [ ] **Step 7: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/pages/IdeaMap.jsx board-tools/client/src/components/EdgeLayer.jsx board-tools/client/src/styles/idea-map.css board-tools/client/src/lib/game-design.js board-tools/client/src/__smoke__/entry.jsx
  git commit -m "feat: add semantic game design relations"
  ```

## - [x] Task 6: Chuẩn hóa đường load/import/rebase và cập nhật checklist dự án

**Files:**

- Modify: `board-tools/client/src/pages/IdeaMap.jsx`
- Modify: `board-tools/client/src/lib/rebase.js`
- Modify: `docs/game-design-board-checklist.md`

**Interfaces:**

- Consumes: `normalizeAcceptanceCriteria(value)`.
- Produces: board GD legacy được hiển thị bằng checklist và sẽ lưu dưới array sau lần chỉnh/saving tiếp theo; rebase bảo toàn field `relation` vì edge là object nguyên vẹn.

- [ ] **Step 1: Viết test rebase cho checklist/relation**

  Thêm test vào test file rebase hiện có với base/server/next: client đổi `acceptanceCriteria` từ legacy string sang array trong node, đồng thời server thêm edge relation khác. Assert board merged giữ array checklist mới lẫn relation edge server; no dangling edge.

- [ ] **Step 2: Chạy test rebase để xác nhận lỗi hoặc xác nhận coverage**

  Run: `npm test -- --test-name-pattern="rebase|checklist|relation"`

  Working directory: `board-tools/client`

  Expected: PASS nếu merge object tổng quát đã bảo toàn field; nếu không, FAIL và chỉ rõ field bị mất trước khi sửa.

- [ ] **Step 3: Đặt normalize tại các điểm biên dữ liệu**

  Tạo helper board-level chỉ biến đổi node có `type`/`design` GD và `acceptanceCriteria` string; gọi nó khi nhận board từ GET/socket/import và trước `saveDesignNode`. Không thay `kind`, status hay bất cứ node/edge nào của board idea. Không tự autosave ngay khi load một board legacy; migration chỉ persist khi người dùng chủ động lưu/chỉnh nó.

- [ ] **Step 4: Cập nhật checklist Phase tương ứng**

  Trong `docs/game-design-board-checklist.md`, tick chính xác các dòng Phase workflow, acceptance criteria, semantic relation, validation/export và UI verification đã được hoàn tất. Không tick mục Phase sau nếu chưa có kiểm chứng của Task 7.

- [ ] **Step 5: Chạy bộ test regressions**

  Run: `npm test && npm run build`

  Working directory: `board-tools/client`

  Run: `npm test`

  Working directory: `board-tools/server`

  Expected: PASS cho cả client và server.

- [ ] **Step 6: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/pages/IdeaMap.jsx board-tools/client/src/lib/rebase.js board-tools/client/src/lib/rebase.test.js docs/game-design-board-checklist.md
  git commit -m "feat: preserve legacy game design delivery data"
  ```

## - [x] Task 7: Kiểm UI end-to-end desktop/mobile và hoàn tất tài liệu

**Files:**

- Modify: `board-tools/client/src/__smoke__/entry.jsx` (nếu cần selector/regression smoke)
- Create: `docs/superpowers/summaries/2026-08-11-gd-ready-for-dev-summary.md`
- Modify: `docs/game-design-board-checklist.md`

**Interfaces:**

- Consumes: app client ở `http://localhost:7155`, API thật ở `http://localhost:3345`, board test tạm qua API xác thực Playwright.
- Produces: bằng chứng UI desktop và 375×667, screenshot kiểm overlap, summary có link tới spec/plan.

- [ ] **Step 1: Khởi động backend thật và frontend polling**

  Run: `npm run dev`

  Working directory: `board-tools/server`

  Run: `CHOKIDAR_USEPOLLING=true npm run dev -- --host 0.0.0.0`

  Working directory: `board-tools/client`

  Expected: API nghe tại `http://localhost:3345`, Vite nghe tại `http://localhost:7155`.

- [ ] **Step 2: Chạy Playwright desktop với dữ liệu thật**

  Dùng account test `playwright@example.com` tạo rồi xóa board GD qua API. Trong browser viewport desktop: xác nhận sáu status đúng thứ tự; tạo card, thêm ba criteria, tick một; tạo edge dài đổi `unlocks`; tạo edge ngắn; export Markdown và assert `- [x]`, `- [ ]`, và relation. Chụp screenshot trong lúc dock có checklist dài, bulk edit và edge inspector; kiểm thủ công không có dock/HUD/minimap/zoom/filter/card/label overlap.

- [ ] **Step 3: Chạy Playwright mobile 375×667**

  Lặp checklist + edge inspector ở `375×667`, cuộn phần nội dung dock, và assert `document.documentElement.scrollWidth <= window.innerWidth`. Chụp screenshot; kiểm dock rộng không quá 275px, title/input/button không tràn, control hit area >= 32px, và canvas controls vẫn thao tác được ngoài dock.

- [ ] **Step 4: Kiểm console/network và cleanup dữ liệu test**

  Assert không có console error, request 4xx/5xx bất ngờ; bỏ qua request auth được ứng dụng chủ động thực hiện. Xóa board test bằng API sau test bất kể test pass/fail để không để lại dữ liệu `playwright@example.com`.

- [ ] **Step 5: Chạy bộ kiểm chứng cuối**

  Run: `npm test && npm run test:smoke && npm run build`

  Working directory: `board-tools/client`

  Run: `npm test`

  Working directory: `board-tools/server`

  Expected: PASS toàn bộ.

- [ ] **Step 6: Hoàn tất checklist và viết summary**

  Tick mục UI/UX và verification còn lại trong `docs/game-design-board-checklist.md`. Tạo summary theo đúng bốn mục `Đã làm gì`, `File chính`, `Khác với plan`, `Còn dở / cần lưu ý`; dòng đầu bắt buộc link tới `../specs/2026-08-11-gd-ready-for-dev-design.md` và `../plans/2026-08-11-gd-ready-for-dev.md`. Không ghi summary trước khi toàn bộ Task 1–7 đã tick.

- [ ] **Step 7: Commit khi được yêu cầu**

  ```bash
  git add board-tools/client/src/__smoke__/entry.jsx docs/game-design-board-checklist.md docs/superpowers/summaries/2026-08-11-gd-ready-for-dev-summary.md
  git commit -m "test: verify game design ready for dev workflow"
  ```

## Kết quả

Khi hoàn tất, tạo [summary](../summaries/2026-08-11-gd-ready-for-dev-summary.md) dựa trên diff và kết quả kiểm chứng.
