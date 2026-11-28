# Kế hoạch refactor Board Tools

Ngày lập: 2026-11-28 · Commit gốc: `cc60553` (nhánh `main`)

Tài liệu này để các agent triển khai đọc và làm theo. Mỗi **task** là một PR độc lập. Số dòng trong tài liệu đúng tại commit gốc; khi làm hãy tìm theo **tên hàm**, không tin số dòng.

---

## 1. Hiện trạng

### 1.1 Quy mô

| Khu vực | File | Dòng | Ghi chú |
|---|---|---|---|
| Client | `client/src/pages/IdeaMap.jsx` | 5.905 | Một component duy nhất dài 5.440 dòng |
| Client | `client/src/__smoke__/entry.jsx` | 4.061 | Một hàm `run` dài ~3.900 dòng |
| Client | `client/src/styles/idea-map.css` | 1.779 | Một file, thứ tự nguồn có ý nghĩa |
| Client | `client/src/lib/useInk.js` | 1.060 | |
| Client | `client/src/lib/game-design.js` | 885 | 27 dòng dài hơn 200 ký tự |
| Client | `client/src/components/GameDesignPanel.jsx` | 272 | 55 dòng dài hơn 200 ký tự (gần như minified) |
| Server | `server/index.js` | 782 | Bootstrap + auth + calculator + toàn bộ Socket.IO |
| Server | `server/boards.js` | 632 | CRUD + file + snapshot + member + template |
| Server | `server/board-payload.js` | 459 | Validate board + toàn bộ game-design |

`client/src/lib/` còn lại gồm ~45 module thuần, phần lớn có test đi kèm. Đây là phần khoẻ nhất của dự án và **không phải mục tiêu refactor**.

### 1.2 Baseline kiểm thử (đo tại commit gốc)

| Lệnh | Kết quả |
|---|---|
| `client: npm test` | 726/726 pass |
| `server: npm test` | 155/155 pass |
| `client: npm run build` | Pass, một chunk JS 619 kB |
| `client: npm run test:smoke` (kịch bản mặc định) | **FAIL**, ổn định qua 3 lần chạy: `bấm 2 lần phải hoàn tác về 617px, đang ở 784px` |
| `SMOKE_SCENARIO=tree-panel node smoke-run.mjs` | Pass |
| `SMOKE_SCENARIO=workspace node smoke-run.mjs` | Pass |

Hai điều cần biết về smoke:

- Kịch bản mặc định chết ở khoảng dòng 2.907 của `entry.jsx`, nên ~1.100 dòng kiểm tra phía sau **không bao giờ chạy**.
- `npm run test:smoke` chỉ chạy kịch bản mặc định. Hai kịch bản `tree-panel` và `workspace` phải gọi tay bằng biến môi trường.

### 1.3 Vấn đề cấu trúc trong `IdeaMap.jsx`

Trong một component: 63 `useState`, 42 `useRef`, 31 `useEffect`, 40 `useMemo`, ~170 hàm lồng bên trong.

- **Lưu và đồng bộ** (`saveNow`, `settleSave`, hàng đợi lưu, rebase khi 409, fallback ghi đè) nằm trong component, không có unit test, chỉ được smoke phủ.
- **Undo/redo** (`past`, `future`, gộp nhịp phím mũi tên, `keepView`) nằm trong component, không có unit test.
- **18 cặp `mousemove`/`mouseup` viết tay**, mỗi handler kéo tự lặp lại: gắn listener, `rafThrottle`, ngưỡng "đã kéo", `flush`, gỡ listener.
- **47 lời gọi `setBoard`, 26 chỗ gán tay `boardRef.current = next`**. Quên một chỗ là handler đọc board cũ.
- **Camera (`board.view`) nằm chung state với nội dung board** (59 chỗ tham chiếu). Hệ quả: mỗi nhịp lia bảng đổi định danh `board`; undo phải có `keepView`; `saveBoard` phải tách `view` ra trước khi gửi.
- `actionsRef` là lớp vỏ thủ công để giữ định danh hàm cho `React.memo`.
- `import` nằm sau định nghĩa hàm (dòng 98 trở đi), 35 dòng dài hơn 200 ký tự.
- JSX render dài ~1.230 dòng.

### 1.4 Vấn đề cấu trúc ở server

- Danh sách field của board bị chép tay **5 lần**: `boardPayload`, `restored` trong restore snapshot, destructure trong `PUT`, lệnh update trong `PUT`, payload broadcast trong `PUT`. Thêm một field mà sót một chỗ là mất dữ liệu âm thầm.
- 12 route lặp cùng khối `try/catch` với `CastError → 404`.
- `sanitizeInk`, `sanitizeGeom` và phần kiểm `live:laser` nằm trong `index.js`, không export, **không có test** dù là cửa chặn payload độc hại.
- Schema `Calculator` định nghĩa trong `index.js` thay vì `models.js`.
- `dotenv.config()` gọi ở 4 file. Kiểm biến môi trường rải trong `index.js`.
- Hằng số chép tay giữa client và server (`LIVE_INK_KINDS`, `LIVE_INK_FILLABLE_KINDS`, `LIVE_INK_VERTEX_NUMBERS`, các giới hạn game-design, `RELATION_IDS`). Comment trong code đã tự ghi "phải sửa cả hai chỗ".

### 1.5 Lỗi phát hiện khi đọc (sửa trong plan, mỗi lỗi một commit riêng)

| # | Vị trí | Lỗi |
|---|---|---|
| B1 | `server/boards.js` — `POST /` | Board game-design có 9 status (id 1–9) nhưng `nextStatusId` đặt là `9`. Status đầu tiên người dùng tạo sẽ trùng id với "Archived". |
| B2 | `server/boards.js` — 3 route snapshot | Chuỗi lỗi bị hỏng mã hoá (mojibake): `"KhÃ´ng Ä‘á»c Ä‘Æ°á»£c snapshot."` |
| B3 | `client/src/__smoke__/entry.jsx` | Kịch bản smoke mặc định fail trên `main` (xem 1.2). Chưa xác định là lỗi sản phẩm hay test lỗi thời. |

### 1.6 Ngoài phạm vi (cần chủ dự án quyết định riêng)

- **Ảnh base64 nằm trong document Board.** `AGENTS.md` cấm lưu binary lớn trong board, nhưng `nodes[].image` hiện là data URL. Chuyển sang R2 như PDF là thay đổi dữ liệu + migration, không phải refactor.
- `board:update` phát toàn bộ board qua socket sau mỗi lần lưu.
- Chuyển `mouse*` sang Pointer Events (hỗ trợ cảm ứng/bút).
- Chuyển sang TypeScript.

---

## 2. Luật chung cho mọi agent

1. **Không đổi hành vi.** Refactor chỉ di chuyển và tách code. Lỗi B1–B3 là ngoại lệ duy nhất và đã được chỉ định task.
2. **Một task = một PR**, mỗi PR tự pass toàn bộ cổng kiểm ở mục 3. Không gộp hai task.
3. **Giữ nguyên comment tiếng Việt giải thích "vì sao"** khi di chuyển code. Chúng ghi lại các bug đã gặp; mất comment là mất lý do.
4. **Không đổi tên class CSS, `title`, `data-*`, nội dung chữ trên UI.** Smoke test tìm phần tử bằng chính những thứ đó (ví dụ `button[title="Hoàn tác (Ctrl+Z)"]`, `.tree-panel .op-close`).
5. **Không thêm dependency** trừ khi task ghi rõ.
6. **Không format hàng loạt.** Chỉ định dạng lại những dòng task yêu cầu; diff phải đọc được.
7. Khi tách một hàm ra file mới, **di chuyển nguyên văn trước**, chạy cổng kiểm, rồi mới dọn dẹp trong commit sau.
8. Tuân thủ `AGENTS.md`: giữ thay đổi không liên quan trong worktree, không in secret từ `.env`.
9. Trong `IdeaMap.jsx` **chỉ một agent ghi tại một thời điểm** (Track B chạy tuần tự).
10. Gặp chỗ plan mô tả sai so với code thật: dừng task, ghi lại sai lệch trong PR, không tự suy diễn thiết kế mới.

## 3. Cổng kiểm bắt buộc cho mọi PR

```bash
cd client && npm test && npm run build && npm run test:smoke
```

```bash
cd server && npm test
```

Sau Phase 0, `npm run test:smoke` chạy **tất cả** kịch bản. Trước khi Phase 0 xong, agent phải chạy thêm tay hai kịch bản `tree-panel` và `workspace`.

PR đụng UI phải kèm kiểm tay trên dev server (client `7155`, server `3345`): kéo thẻ, quét chọn, vẽ nét, undo/redo, mở hai tab cùng board để xem đồng bộ.

---

## 4. Sơ đồ phase và phụ thuộc

```
Phase 0 (lưới an toàn) ──┬─► Track A: Phase 1 (server) ───────────────┐
                         ├─► Track B: Phase 2 (IdeaMap, TUẦN TỰ) ─────┼─► Phase 6 (shared) ─► Phase 7 (tooling)
                         ├─► Track C: Phase 3 (game-design) ──────────┘
                         └─► Track D: Phase 4 (CSS), Phase 5 (api client)
```

- Phase 0 chặn tất cả.
- Track A, B, C, D chạy song song vì không đụng chung file.
- Trong Track B các task chạy đúng thứ tự 2.1 → 2.9.
- Track C chỉ bắt đầu sau khi task 2.1 đã merge (2.1 đổi phần import của `IdeaMap.jsx`).

---

## Phase 0 — Lưới an toàn

### Task 0.1 — Sửa kịch bản smoke mặc định (B3)

- **File:** `client/src/__smoke__/entry.jsx` (tìm chuỗi `bấm 2 lần phải hoàn tác`), có thể `client/src/lib/multi-click.js`, `IdeaMap.jsx` (`handleViewportClickCapture`).
- **Việc:** Dùng `git log -S "bấm 2 lần phải hoàn tác"` và `git bisect` với `npm run test:smoke` để tìm commit làm hỏng. Xác định test lỗi thời hay sản phẩm hỏng. Sửa đúng bên sai.
- **Xong khi:** `npm run test:smoke` pass 3 lần liên tiếp; PR ghi rõ nguyên nhân gốc.
- **Lưu ý:** Sau khi qua điểm fail này có thể lộ thêm lỗi ở ~1.100 dòng phía sau. Sửa hết trong task này.

### Task 0.2 — Tách smoke thành nhiều kịch bản độc lập

- **File:** `client/src/__smoke__/entry.jsx`, `client/smoke-run.mjs`, `client/smoke.vite.config.js`, `client/package.json`.
- **Việc:**
  1. Tạo `client/src/__smoke__/harness.jsx`: hàm `mountBoard()`, các helper chuột/phím/`settle` đang khai báo trong `run`.
  2. Cắt hàm `run` thành các file `client/src/__smoke__/scenarios/<tên>.jsx`, mỗi file một nhóm chức năng (kéo thẻ, chọn, vẽ, chữ, dây nối, undo, laser, trình chiếu, đồng bộ realtime...). Cắt theo các dòng `log(...)` hiện có. Mỗi file export `async function run(ctx)`.
  3. `smoke-run.mjs` chạy lần lượt mọi kịch bản, **mỗi kịch bản một JSDOM mới**, in tên kịch bản khi fail. Hỗ trợ `SMOKE_ONLY=<tên>` để chạy một cái.
  4. Hai kịch bản `tree-panel` và `workspace` trở thành kịch bản thường trong danh sách, giữ nguyên fixture riêng của chúng.
- **Xong khi:** `npm run test:smoke` chạy mọi kịch bản; tổng số phép kiểm không giảm (đếm số `throw new Error` trước và sau, ghi vào PR).
- **Rủi ro:** Các bước trong `run` hiện phụ thuộc trạng thái của bước trước. Kịch bản nào không tách sạch được thì giữ chung một file và ghi chú lại, không viết lại logic kiểm.

### Task 0.3 — Script kiểm tổng và CI

- **File:** `package.json` (gốc), thêm `.github/workflows/ci.yml`.
- **Việc:** Thêm script gốc `verify` = test client + build + smoke + test server. Workflow chạy `verify` trên Node 22 cho mọi PR.
- **Xong khi:** `npm run verify` ở gốc repo pass.

### Task 0.4 — Sửa chuỗi mojibake (B2)

- **File:** `server/boards.js`, 3 chuỗi lỗi trong các route snapshot.
- **Việc:** Thay bằng `"Không đọc được snapshot."`, `"Không tạo được snapshot."`, `"Không khôi phục được snapshot."`. Kiểm cả repo: `grep -rn "Ã\|Ä‘" server client/src`.

---

## Phase 1 — Server (Track A)

Cấu trúc đích:

```
server/
  index.js              # chỉ bootstrap: config → connect → app → io → listen
  config.js             # đọc + kiểm biến môi trường, dotenv.config() MỘT lần
  app.js                # createApp({ io }) → express app
  models.js
  board-fields.js       # nguồn duy nhất cho danh sách field board
  board-templates.js    # DEFAULT_STATUSES, GAME_DESIGN_STATUSES, GAME_DESIGN_TEMPLATES
  board-access.js       # loadBoardWithRole, AUTH_FIELDS*
  http.js               # asyncRoute()
  routes/
    auth.js  calculator.js  boards.js  board-files.js
    board-snapshots.js  board-members.js  workspace.js
  realtime/
    handshake.js  presence.js  sanitize-ink.js  sanitize-geom.js  sanitize-laser.js
  validation/
    board.js  game-design.js
  jobs/quota-cron.js
```

Đổi script test server thành `node --test "**/*.test.js"` ngay ở task đầu tiên tạo thư mục con. `render.yaml` không cần đổi vì `index.js` vẫn ở gốc `server/`.

### Task 1.1 — Một nguồn duy nhất cho field board

- **File:** tạo `server/board-fields.js` + test; sửa `server/boards.js`, `server/board-payload.js`.
- **Việc:**
  1. Export `BOARD_LIST_FIELDS`, `BOARD_COUNTER_FIELDS`, `BOARD_THEME_FIELDS` (`bg`, `grid`, `pack`), `BOARD_GAME_DESIGN_FIELDS`, và `pickBoardContent(obj)`.
  2. Thay 5 danh sách chép tay trong `boards.js` bằng `pickBoardContent`. `boardPayload` giữ nguyên các giá trị mặc định hiện có (`kind || "idea"`, `?? null`).
  3. `board-payload.js` import `LIST_FIELDS`/`COUNTER_FIELDS` từ đây.
- **Test:** một test khẳng định hình dạng trả về của `GET`, `PUT` broadcast và `restore` có đúng cùng tập key như trước (chụp tập key hiện tại vào test trước khi sửa).
- **Lưu ý:** `view` chỉ đi vào lệnh update của `PUT`, không vào broadcast. Giữ đúng như vậy.

### Task 1.2 — Tách `index.js`

Làm theo thứ tự, mỗi bước một commit:

1. `config.js`: gom 4 khối kiểm env + `dotenv.config()`. Bỏ `dotenv.config()` ở `pdf-quota.js`, `pdf-storage.js`, `notify.js`; bảo đảm `config.js` được import đầu tiên. Kiểm `server/scripts/*.mjs` vẫn chạy (chúng import các module đó trực tiếp nên phải tự import `config.js` hoặc giữ `dotenv` riêng).
2. Chuyển schema `Calculator`, `defaultCalculator`, `ensureCalculatorFor`, `calculatorPayload` sang `models.js` và `routes/calculator.js`.
3. `routes/auth.js`: hai limiter, `startSession`, 4 route auth.
4. `realtime/sanitize-ink.js`, `sanitize-geom.js`, `sanitize-laser.js`: di chuyển nguyên văn kèm toàn bộ hằng số và comment. Phần kiểm trong handler `live:laser` tách thành hàm thuần `sanitizeLaser(payload)`.
5. `realtime/handshake.js` (middleware `io.use`) và `realtime/presence.js` (`registerPresence(io)` chứa `presencePeers` và mọi handler).
6. `jobs/quota-cron.js`, `app.js`, và `index.js` chỉ còn bootstrap.

- **Test mới bắt buộc:** `sanitize-ink.test.js`, `sanitize-geom.test.js`, `sanitize-laser.test.js`. Mỗi comment "chặn vì…" trong code hiện tại phải thành ít nhất một ca test (ví dụ: toạ độ `1e9` bị chặn; `{kind:"arrow", fill:true}` không mang `fill`; `pts` độ dài lẻ bị chặn; `fade` rác chỉ bị bỏ riêng field đó).
- **Xong khi:** `index.js` dưới 80 dòng; thứ tự mount middleware/route giữ nguyên (`workspaceRouter` trước `boardsRouter`, static sau API).

### Task 1.3 — Tách `boards.js`

- **Việc:**
  1. `http.js`: `asyncRoute(handler, fallbackMessage)` gói `try/catch`, ánh xạ `CastError → 404 not_found`, còn lại `500` với đúng chuỗi lỗi hiện có của từng route.
  2. `board-access.js`, `board-templates.js`: di chuyển nguyên văn.
  3. Tách 4 router theo cấu trúc đích, mount lại dưới `/api/boards` theo **đúng thứ tự khớp route hiện tại** (`/:id/files/:fileId` trước `/:id`).
  4. Route upload có dọn file tạm trong `catch` — giữ nguyên hành vi này, không để `asyncRoute` nuốt mất.
- **Sửa B1 (commit riêng):** `nextStatusId = max(id) + 1` tính từ danh sách status, cho cả hai loại board. Thêm test.
- **Xong khi:** không file route nào quá 250 dòng.

### Task 1.4 — Tách `board-payload.js`

- **Việc:** `validation/board.js` (khung chung + `validateBoardPayload`), `validation/game-design.js` (mọi `validate*` của game-design, `normalizeGameDesignFlow`, `resolveGameDesignFields`, các `*_LIMITS`). Giữ `board-payload.js` làm file re-export để test hiện có không phải sửa import. Xuống dòng lại 14 dòng dài hơn 200 ký tự.
- **Giữ nguyên:** nguyên tắc "chặn nhầm là mất bài" ở đầu file. Không thêm, không siết bất kỳ luật kiểm nào.

---

## Phase 2 — Tách `IdeaMap.jsx` (Track B, tuần tự)

Mục tiêu cuối: `IdeaMap.jsx` dưới ~400 dòng, chỉ ghép hook và component.

Quy ước: hook mới đặt tại `client/src/lib/use<Name>.js`, logic thuần đặt tại `client/src/lib/<name>.js` kèm `<name>.test.js`, component mới đặt tại `client/src/components/board/`. Không dùng thư viện quản lý state. Hook nhận tham số tường minh; không tạo Context cho tới task 2.9.

### Task 2.1 — Tách phần không có state (cơ học)

- Icon (`IconSketch` … `IconRedo`, `LineSolidIcon` … `ReverseIcon`, `MiniMapIcon`) → `components/board/icons.jsx`.
- `TopMenu`, `DropCount`, `PaletteEditor`, `EdgeMenu`, `CommentsPopover` → mỗi cái một file trong `components/board/`.
- Hằng số cấp module (`CARD_W`, `MIN_SCALE`, `TREE_OPTS`, `EMPTY_*`, …) → `lib/board-constants.js`.
- `normalizeGameDesignBoard` → file mới `lib/normalize-board.js` + test. **Không** đặt vào `lib/game-design.js` (Track C đang sửa file đó).
- `computeZoom` → `lib/camera.js` + test.
- Đưa toàn bộ `import` về đầu file.
- **Xong khi:** `IdeaMap.jsx` giảm ~450 dòng; không dòng logic nào thay đổi.

### Task 2.2 — Hàng đợi lưu thành module thuần có test

- **Tạo:** `lib/save-queue.js` + `lib/save-queue.test.js`.
- **API:** `createSaveQueue({ save, rebase, merge, getBase, setBase, getStamp, setStamp, onState, maxTries = 3 })` trả về `{ saveNow(next), saveDebounced(next, ms), cancelTimer() }`. Mọi thứ đụng React/ref được tiêm qua tham số.
- **Chuyển nguyên logic** của `saveNow`, `settleSave`, `saveDebounced`: chỉ một PUT bay tại một thời điểm; cú đến sau chỉ giữ bản mới nhất; chốt `base` và `baseUpdatedAt` **trước** khi gửi; 409 → rebase → thử lại tối đa 3 lần; rebase hỏng hoặc quá số lần → ghi đè không kèm `baseUpdatedAt`; viewer không bao giờ lưu.
- **Test bắt buộc:** lưu thường; hai lần gọi liên tiếp chỉ sinh 2 PUT với bản cuối; 409 một lần rồi thành công; 409 quá 3 lần → fallback ghi đè; rebase trả `null` → fallback; lỗi mạng → `onState({ error: true })` và hàng đợi vẫn chạy tiếp; role viewer → 0 PUT.
- `IdeaMap.jsx` dùng module này. `arrangeLockedTrees` chạy trước khi đưa vào hàng đợi, giữ ở phía gọi.

### Task 2.3 — Lịch sử undo/redo thành module thuần có test

- **Tạo:** `lib/history.js` + test. Hàm thuần trên `{ past, future, nudgeBase }`: `record`, `undo`, `redo`, `beginNudge`, `flushNudge`, giới hạn `MAX_HISTORY = 50`.
- **Test bắt buộc:** trần 50; `record` xoá `future`; undo giữa chuỗi nhích phím trả về mốc trước chuỗi; redo khi đang có chuỗi nhích chỉ chốt chuỗi.
- `keepView` giữ ở `IdeaMap.jsx` cho tới task 2.5.

### Task 2.4 — `useBoardStore`: một cửa ghi board

- **Tạo:** `lib/useBoardStore.js`.
- **Gom:** tải board (`getBoard`), `board`/`setBoard`, `boardRef`, `role`/`roleRef`, `boardName`, `loadError`, `saveError`, `serverBaseRef`, `lastUpdatedAtRef`, hàng đợi lưu (2.2), lịch sử (2.3), `applyRemoteBoard`, snapshot (`createSnapshot`, `restoreSnapshot`).
- **API ghi duy nhất:**
  - `store.preview(next)` — đặt board + `boardRef` cùng lúc, không lưu, không ghi lịch sử (dùng trong lúc kéo).
  - `store.commit(next, { historical = true, from })` — thay cho `commitAndSave` và cho bộ ba `recordHistory` + `setBoard` + `saveNow`.
  - `store.undo()`, `store.redo()`.
- **Việc:** thay toàn bộ 26 chỗ gán tay `boardRef.current = …` bằng `preview`/`commit`. Sau task này `grep -c "boardRef.current = " IdeaMap.jsx` phải bằng 0.
- **Rủi ro cao nhất của cả plan.** Chia thành nhiều commit nhỏ theo nhóm handler; chạy smoke sau mỗi commit; kiểm tay hai tab.

### Task 2.5 — Tách camera khỏi nội dung board

- **Việc:** `view` thành state riêng trong `lib/useCamera.js` (`view`, `viewRef`, `setCamera`, `applyFollowCamera`, `zoomButton`, `fitToView`, `goToPoint`, `zoomToNodes`, handler wheel, `startPan`, đồng bộ với `useWorkspaceState`). Board trong store không còn field `view`.
- **Hệ quả cần dọn:** bỏ `keepView`; bỏ việc tách `view` trong `saveBoard` (`lib/api.js`) và trong `restoreSnapshot`; các lib nhận `board.view` (`png-export`, `minimap`, …) nhận `view` qua tham số.
- **Kiểm:** kịch bản smoke `workspace` (khôi phục camera) phải pass nguyên vẹn; undo không làm nhảy màn hình; ghim màn hình (follow) vẫn bám đúng.
- **Rủi ro trung bình–cao.** Nếu sau 2 ngày công vẫn chưa xanh: dừng, báo lại, bỏ qua task này. Các task sau không phụ thuộc cứng vào nó.

### Task 2.6 — `startDrag`: một helper cho mọi cú kéo

- **Tạo:** `lib/drag-session.js` + test. `startDrag(event, { onMove, onEnd, threshold })` lo: gắn/gỡ `mousemove`/`mouseup` trên `window`, bọc `rafThrottle`, gọi `flush` trước `onEnd`, cờ `moved`, trả về `cancel()`.
- **Việc:** chuyển từng handler trong 18 handler kéo sang helper, **mỗi handler một commit**. Thứ tự gợi ý từ đơn giản tới phức tạp: resize ảnh, resize PDF, resize khung, chip, màu, đầu dây, connector, pan, marquee, kéo nét vẽ, tay cầm hình, resize vùng chọn, kéo chữ, kéo khung, kéo thẻ, đổi chỗ cây khoá.
- **Giữ nguyên:** mọi phép tính toạ độ "từ mốc ban đầu, không cộng dồn".

### Task 2.7 — Tách hook theo miền chức năng

Mỗi dòng là một PR, làm theo thứ tự. Mỗi hook nhận `store`, `camera` và các thứ nó cần; trả về state + handler. Logic thuần lộ ra trong lúc tách thì đưa vào `lib/` kèm test.

| # | Hook | Lấy từ `IdeaMap.jsx` |
|---|---|---|
| a | `useBoardSelection` | 4 tập id chọn, `marquee`, `selectionSet`, `selBounds`, `clearSelection`, `handleMarqueeMouseDown`, `selectionDragSet`, đồng bộ `?card=` trên URL |
| b | `useBoardFilters` | `filterStatus/Tags/Fav`, `search`, `matches`, `passesFilter`, `focusSet`, `goToMatch`, `clearFilters` |
| c | `useBadgesAndPalette` | CRUD status/tag/palette, `chipDrag`, `colorDrag`, `setBoardBg/Grid/Pack`, `applyChipToNodes` |
| d | `useEdgeInteractions` | `toggleEdge`, `updateEdge`, `deleteEdge`, `linkMode`, `linkDraft`, `edgeDrag`, `edgeMenu`, các handler connector và đầu dây |
| e | `useGroupInteractions` | `handleGroupMouseDown`, resize, tiêu đề, xoá, màu, khoá, `createGroupAt`, `groupSelectedCards` |
| f | `useNodeInteractions` | `handleNodeMouseDown`, `createNode`, `createLinkedNode`, `duplicateNodes`, `deleteNode`, `saveNodeEdit*`, comment, yêu thích, màu/hình/bậc thẻ |
| g | `useNodeMedia` | dán ảnh, thả ảnh, `applyImageToNode`, `createImageNode`, `uploadPdfFile`, resize ảnh/PDF |
| h | `useDrawingSelection` | kéo nét vẽ, tay cầm hình, resize vùng chọn, nét đứt, `commitStroke`, `commitErase`, đổi bút/gôm |
| i | `useTextTool` | `textEdit`, `textDrag`, `handleTextMouseDown`, `commitText`, `measureTextWidth` |
| j | `useTreeLayout` | bảng Xếp cây, khoá cây, `startLockedTreeSwap`, các ref `tree*` |
| k | `usePresentation` | `presentIndex`, `start/step/exitPresentation`, class `presenting` trên body |
| l | `useGameDesignBoard` | thao tác thẻ GD, brief/flow/balance, `dependency`, export Markdown/JSON |
| m | `useBoardKeyboard` | effect `keydown` toàn cục, `nudgeSelection`; nhận bảng lệnh từ các hook trên |

`actionsRef` + `cardHandlers`/`groupHandlers` thay bằng một helper `lib/useStableHandlers.js` (cùng cơ chế, viết một lần).

### Task 2.8 — Tách JSX thành component

Thứ tự: `BoardTopBar` (đảo trên trái + các menu), `PresenceIsland`, `BoardHudBottom` (thanh filter), `HistoryIsland`, `ZoomControl`, `BoardCanvas` (viewport + các layer thẻ/khung/dây/mực/laser/peer), `EditDock`, `IoDrawer`, `PresentBar`, `CaptureOverlay`, `BoardPopovers` (menu màu, menu dây, badge, palette, comment).

- Mỗi component một PR. Cây DOM và class giữ nguyên từng nút.
- Component layer nặng (`BoardCanvas`) phải giữ `React.memo` và định danh prop ổn định như hiện tại. Đo bằng React Profiler: kéo một thẻ trên board ≥100 thẻ không được render lại toàn bộ thẻ.

### Task 2.9 — Dọn cuối

- Nếu `IdeaMap.jsx` còn truyền quá ~15 prop xuống một component: tạo `BoardContext` chỉ đọc cho `store`, `selection`, `camera`.
- Đổi `React.lazy` cho `IdeaMap`, `Calculator` và các panel game-design để tách chunk 619 kB. Kiểm lại cấu hình smoke (build dạng lib) vẫn chạy với import động.
- **Xong khi:** `IdeaMap.jsx` dưới 400 dòng; không file nào trong `components/board/` và `lib/use*.js` mới quá 500 dòng.

---

## Phase 3 — Module game-design (Track C)

### Task 3.1 — Tách `lib/game-design.js`

- Tạo `lib/game-design/` với các file theo miền: `types.js`, `brief.js`, `flow.js`, `balance.js`, `details.js`, `playtest.js`, `decisions.js`, `handoff.js`, `review.js`, `delivery.js`, `analytics.js`, `ab-tests.js`, `live-ops.js`, `post-launch.js`, `follow-ups.js`, `dependencies.js`, `reports.js`, `export.js`, `cards.js`.
- `lib/game-design.js` trở thành file re-export, để mọi import và `game-design.test.js` hiện có chạy không sửa.
- Xuống dòng lại 27 dòng dài. Không đổi logic.

### Task 3.2 — Tách `GameDesignPanel.jsx` và các panel GD

- Chuyển các panel `GameDesign*`, `DevHandoffPanel`, `DecisionTimelinePanel`, `PlaytestComparisonPanel`, `BoardSnapshotsPanel` vào `components/game-design/`.
- `GameDesignPanel.jsx`: mỗi mục (spec, chi tiết, playtest, decision log, handoff, review, delivery, analytics, A/B, live-ops, post-launch, follow-up) thành một component con. Mẫu "danh sách item có các field" lặp lại nhiều lần → một component `ListEditor` dùng chung (đã có mầm là `DetailSection`).
- Xuống dòng lại toàn bộ JSX một-dòng. Class CSS giữ nguyên.
- Kịch bản smoke `tree-panel` có render `.gd-panel` — phải pass.

### Task 3.3 — i18n cho panel game-design (tuỳ chọn, có đổi hành vi nhỏ)

- Các panel game-design (khoảng 11 component) chưa đi qua Lingui, chuỗi tiếng Việt viết cứng. Bọc bằng `<Trans>`/`t`, chạy `npm run i18n:extract`, điền bản `en`.
- Locale nguồn là `vi` nên chữ hiển thị mặc định không đổi. Chỉ làm khi chủ dự án đồng ý.

---

## Phase 4 — CSS (Track D)

### Task 4.1 — Tách `idea-map.css`

- Cắt thành `styles/board/{shell,islands,presence,follow,themes,canvas,cards,connectors,ink,minimap,docks,tree-panel,menus,readonly,game-design,responsive}.css`.
- Tạo `styles/board/index.css` chỉ gồm `@import` **theo đúng thứ tự xuất hiện hiện tại**. Trong file có nhiều luật phụ thuộc thứ tự nguồn (comment ghi "PHẢI đứng SAU .lv-5") — tuyệt đối không sắp xếp lại.
- **Kiểm:** so `dist/assets/*.css` trước và sau khi build; nội dung sau khi minify phải giống hệt. Ghi kết quả `diff` vào PR.

---

## Phase 5 — API client (Track D)

### Task 5.1 — Gom lời gọi HTTP

- `lib/api.js`: thêm `request(path, { method, body, errors })` gói `fetch` + `checkAuthExpired` + ánh xạ mã lỗi. Viết lại 14 hàm hiện có trên helper đó, **giữ nguyên từng mã lỗi** (`BOARD_NOT_FOUND`, `READ_ONLY`, `CONFLICT` kèm `err.board`, …).
- Chuyển các `fetch` rải rác về `api.js`: `components/PdfUsage.jsx`, `lib/auth.js` (4 lời gọi), `uploadPdfFile` trong `IdeaMap.jsx` (phối hợp với Track B: làm sau task 2.7g hoặc để Track B làm).
- Thêm `lib/api.test.js` với `fetch` giả cho từng nhánh mã lỗi.

---

## Phase 6 — Hợp đồng dùng chung client/server

Chỉ bắt đầu khi Phase 1 và Phase 3 đã xong.

### Task 6.1 — Thư mục `shared/`

- Tạo `shared/` ở gốc repo: ESM thuần, không dependency, không đụng DOM/Node API.
  - `shared/ink-kinds.js`: `SHAPE_KINDS`, `SHAPE_CLOSED`, `VERTEX_NUMBERS`.
  - `shared/board-fields.js`: chuyển từ `server/board-fields.js`.
  - `shared/game-design-limits.js`: các `*_LIMITS`, `RELATION_IDS`, danh sách status hợp lệ.
- Server và client cùng import từ đây; xoá các bản chép tay và comment "phải sửa cả hai chỗ".
- `client/vite.config.js` và `smoke.vite.config.js`: thêm `server.fs.allow: [".."]`.
- **Kiểm deploy:** `render.yaml` build từ gốc repo nên `shared/` có mặt. Chạy thử đúng `buildCommand` và `startCommand` trong `render.yaml` ở máy local trước khi merge.

---

## Phase 7 — Công cụ

### Task 7.1 — ESLint

- Thêm ESLint (flat config) cho `client/` với `eslint-plugin-react-hooks`. Code đã có sẵn các comment `eslint-disable-line react-hooks/exhaustive-deps` nhưng repo chưa có cấu hình ESLint.
- Bật `react-hooks/rules-of-hooks` mức error, `exhaustive-deps` mức warn. Không bật luật định dạng. Thêm vào `verify` và CI.
- Không sửa hàng loạt cảnh báo `exhaustive-deps`: mỗi cái là một thay đổi hành vi tiềm ẩn, xử lý riêng.

### Task 7.2 — Cập nhật tài liệu

- `README.md`, `AGENTS.md`: cấu trúc thư mục mới, lệnh `npm run verify`, cách chạy một kịch bản smoke.

---

## 5. Thứ tự đề xuất và ước lượng

| Đợt | Task chạy song song | Ghi chú |
|---|---|---|
| 1 | 0.1, 0.4 | 0.1 chặn mọi thứ |
| 2 | 0.2, 0.3 | |
| 3 | 1.1 · 2.1 · 4.1 · 5.1 (phần `api.js`) | 4 agent |
| 4 | 1.2 · 2.2 · 2.3 · 3.1 | 2.2 và 2.3 tạo file mới, chỉ nối vào `IdeaMap.jsx` tuần tự |
| 5 | 1.3 · 2.4 · 3.2 | 2.4 là task rủi ro nhất |
| 6 | 1.4 · 2.5 · 2.6 | |
| 7 | 2.7a → 2.7m | tuần tự, một agent |
| 8 | 2.8, 2.9 | |
| 9 | 6.1, 7.1, 7.2 | |

## 6. Mẫu giao việc cho agent

```
Task: <số và tên task trong docs/superpowers/plans/2026-11-28-refactor-master-plan.md>
Đọc trước: mục 2 (Luật chung), mục 3 (Cổng kiểm), và phần mô tả task.
Phạm vi file được sửa: <danh sách>
Không được sửa: mọi file khác; riêng IdeaMap.jsx chỉ Track B được ghi.
Xong khi: <điều kiện "Xong khi" của task> + toàn bộ cổng kiểm pass.
Báo cáo: danh sách commit, kết quả từng lệnh cổng kiểm, mọi sai lệch giữa plan và code thật.
```
