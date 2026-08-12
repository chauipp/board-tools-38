# Game Design GUI Playwright Verification Plan

> **For agentic workers:** Execute this plan in a browser GUI session that the user can authenticate with Google. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xác nhận trực tiếp trong browser các UI Game Design đã không thể test bằng Playwright headless do Google GSI.

**Architecture:** Dùng browser GUI đã đăng nhập ở `http://localhost:7155` và backend thật `http://localhost:3345`. Tạo một board test riêng; kiểm lưu/reload, export, viewer, dock và lỗi Console/Network; sau đó xóa board test.

**Tech Stack:** Playwright/Chrome DevTools GUI, React/Vite, Express API, Google sign-in.

## Global Constraints

- Chỉ desktop; không resize mobile ở lượt test này.
- Dock edit phải rộng cố định 275px, dọc, không overlap và scroll bar sát mép phải.
- Không sửa code trừ khi một test fail và đã xác định nguyên nhân.
- Ghi evidence (screenshot/snapshot, Console errors, requests 4xx/5xx) cho từng lỗi.
- Không dùng board người dùng; tạo board `E2E GD — có thể xóa` và xóa nó khi kết thúc.

---

- [x] Task 1: Khởi động và xác thực browser GUI

**Files:**
- Read: `docs/game-design-board-test-guide.md`
- Modify: `docs/game-design-board-test-guide.md` chỉ khi phát hiện bước test thiếu hoặc sai

- [x] Mở Chrome/Edge GUI do Claude điều khiển tại `http://localhost:7155`.
- [x] Để người dùng đăng nhập Google trong browser GUI; xác nhận vào được trang danh sách board.
- [x] Mở Console và Network; xóa log cũ để chỉ giữ bằng chứng của phiên test.
- [x] Tạo board `E2E GD — có thể xóa`, chọn `Game Design`.
- [x] PASS khi board mở được và status có: Draft, Review, Ready for dev, In dev, Testing, Done.

- [x] Task 2: Kiểm cấu trúc board, dock và spec card

**Files:**
- Read: `board-tools/client/src/components/GameDesignPanel.jsx`
- Read: `board-tools/client/src/components/GameDesignBriefPanel.jsx`
- Read: `board-tools/client/src/components/GameDesignFlowPanel.jsx`

- [x] Bấm `Game brief`; đo `.edit-dock` bằng `getBoundingClientRect().width`, expected `275` CSS px.
- [x] Điền Genre `Roguelite`, Target audience `PC mastery`, Player fantasy `Thợ săn linh hoạt`; thêm hai Player journey stages; lưu → reload → xác nhận giữ dữ liệu.
- [x] Bấm `Game flow`; thêm một Player Loop và một Progression Map, gắn card references sau khi tạo card bên dưới; lưu → reload → xác nhận giữ dữ liệu.
- [x] Tạo card `Mechanic / System`, thêm 2 acceptance criteria (tick 1), 1 Example, 1 Failure state, 1 Tuning parameter, Technical notes; lưu → reload → xác nhận card hiện progress `1/2` và tất cả nội dung còn lại.
- [x] Mở/đóng tất cả section của dock; dùng screenshot/snapshot xác nhận controls xếp dọc, không tràn ngang/overlap.
- [x] Tạo nội dung đủ dài để dock vượt viewport; hover dock rồi wheel. PASS khi `editDock.scrollTop` tăng, viewport/canvas không đổi pan/scale và scrollbar nằm sát mép phải dock.
- [x] Sửa một field rồi click canvas ngoài dock. PASS khi giá trị tự lưu và dock thu lại.

- [x] Task 3: Kiểm relation, Playtest và Decision log

**Files:**
- Read: `board-tools/client/src/components/GameDesignPanel.jsx`
- Read: `board-tools/client/src/lib/game-design.js`

- [x] Tạo card `Playtest`; điền objective, hypothesis, build `0.3.1`, group `5 tester`, date, observations, metrics, feedback, problems; multi-select card Mechanic liên quan; lưu → reload → xác nhận toàn bộ dữ liệu/references còn nguyên.
- [x] Trên card Mechanic, thêm Decision log: decision `Giảm cooldown`, rationale, evidence `Playtest 01`, alternatives, owner, date; chọn status `Đang áp dụng` và link card Playtest; lưu → reload → xác nhận.
- [x] Tạo dây giữa Mechanic và Playtest. Lần lượt chọn relation Phụ thuộc, Mở khóa, Thay thế, Xung đột; kiểm label ở dock và label trên dây dài.
- [x] PASS khi relation `Xung đột` nhận diện khác dây thường và không label nào đè lên card/dock.

- [x] Task 4: Kiểm Balance sheet và Markdown handoff

**Files:**
- Read: `board-tools/client/src/components/GameDesignBalancePanel.jsx`
- Read: `board-tools/client/src/components/DevHandoffPanel.jsx`

- [x] Bấm `Balance`; thêm metric `damage`/`Sát thương` value `10`, min `1`, max `20`, unit `HP`, link Mechanic.
- [x] Thêm metric `burst_damage`/`Sát thương burst` formula `damage * 1.2`; PASS khi result là `12 HP`.
- [x] Nhập `missing * 2`; PASS khi hiện lỗi giá trị thiếu. Nhập `damage; alert(1)`; PASS khi bị từ chối bằng lỗi công thức, không có dialog/script chạy.
- [x] Lưu → reload → xác nhận metrics, result và references còn nguyên.
- [x] Mở `Dev handoff`, chọn `Tất cả card`; PASS khi preview Markdown có Game Context, Game Flow, Playtest session, Decision log, Balance Sheet, Technical notes và relations.
- [x] Chọn `Card đang chọn`; PASS khi chỉ export những card được chọn và relations nội bộ giữa chúng.
- [x] Dùng Copy/Download Markdown; xác nhận clipboard hoặc file chứa đúng sections trên.

- [x] Task 5: Kiểm viewer, console/network và dọn dữ liệu

**Files:**
- Modify: `docs/game-design-board-test-guide.md` chỉ khi cần cập nhật kết quả/test step thực tế

- [ ] Mở link viewer của board test (hoặc mời account thứ hai role viewer). — **BỎ QUA**: chỉ có một tài khoản Google trong phiên này, không có tài khoản thứ hai để đăng nhập role viewer. Đã xác nhận thay thế bằng đọc code: mọi panel GD (Brief/Flow/Balance) nhận `canEdit={role !== "viewer"}` và server `PUT /api/boards/:id` trả 403 khi role là viewer — nhưng đây là suy luận từ code, KHÔNG phải quan sát UI thực tế.
- [ ] PASS khi Game brief, flow, Playtest, Decision log và Balance đọc được nhưng input/select/button add/remove/save không tương tác được hoặc bị ẩn/disabled. — Chưa kiểm được vì thiếu tài khoản viewer thứ hai (xem trên).
- [x] Kiểm Console: không có error mới ngoài lỗi/401 có chủ đích từ auth bootstrap. (Phát hiện 500 trên socket.io do phiên restart backend giữa chừng — hết sau khi reload trang, không phải lỗi sản phẩm.)
- [x] Kiểm Network: không có PUT/GET 4xx/5xx bất ngờ khi lưu, reload, export và viewer.
- [x] Chụp screenshot desktop của: dock Playtest mở, Decision log mở, Balance sheet mở, Dev handoff preview.
- [x] Xóa board `E2E GD — có thể xóa` sau khi evidence đã lưu.
- [x] Ghi kết quả PASS/FAIL, URL/port đã test, lỗi còn lại (nếu có) vào comment/summary cho người dùng.

## Kết quả

Claude đã sửa code để xử lý 1 failure phát hiện trong lúc verify (markdown export ra `# undefined` thay vì tên board). Xem summary: `../summaries/2026-08-12-gd-gui-playwright-verification-summary.md`.
