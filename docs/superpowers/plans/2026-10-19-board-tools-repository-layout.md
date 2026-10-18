# Chuẩn hóa cấu trúc repository board-tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm phẳng và dọn sạch repository board-tools mà không thay đổi hành vi ứng dụng.

**Architecture:** `client/` và `server/` trở thành hai thư mục ứng dụng trực tiếp dưới root. Tài liệu sản phẩm nằm dưới `docs/design/`; cấu hình Render và hướng dẫn root dùng đường dẫn tương đối từ root.

**Tech Stack:** React, Vite, Node.js, Express, Socket.IO, MongoDB, Render Blueprint.

## Global Constraints

- Không đọc, sửa, xóa hoặc stage `server/.env`.
- Không đổi logic runtime; chỉ đổi vị trí, metadata, comment, tài liệu và cấu hình đường dẫn.
- Giữ lại `.env.example`, test smoke, package-lock và tài liệu tính năng còn liên quan.
- Xóa `client/debug-edge3.mjs` vì không có consumer và chỉ là script debug cục bộ.
- Không đưa artifact `graphify-out/`, build output hoặc dependency directory vào repo.

---

- [x] Task 1: Di chuyển và dọn file

**Files:**
- Move: `board-tools/client/` -> `client/`
- Move: `board-tools/server/` -> `server/`
- Move: `board-tools/docs/pvp-ideas.md` -> `docs/design/pvp-combat-ideas.md`
- Delete: `client/debug-edge3.mjs`

- [x] **Step 1:** Tạo `docs/design/` và di chuyển các thư mục/file đã chỉ định.
- [x] **Step 2:** Xóa script debug không được tham chiếu.
- [x] **Step 3:** Xác nhận `client/package.json`, `server/package.json`, `.env.example` và package-lock vẫn tồn tại.

- [x] Task 2: Chuẩn hóa cấu hình và tài liệu

**Files:**
- Modify: `render.yaml`
- Modify: `AGENTS.md`
- Modify: `docs/game-design-board-test-guide.md`
- Modify: `docs/claude-test-dependency-guard.md`
- Modify: `docs/recipes/dock-wheel-scroll.md`
- Modify: `server/scripts/migrate-to-boards.mjs`
- Modify: `server/index.js`
- Modify: các comment test/client còn trỏ `board-tools/client/...`
- Create: `README.md`

- [x] **Step 1:** Đổi Render `rootDir` về root và cập nhật build/start command.
- [x] **Step 2:** Cập nhật các đường dẫn tài liệu và comment sang `client/`, `server/`.
- [x] **Step 3:** Viết README ngắn gồm cấu trúc, lệnh cài đặt, test, build, smoke test và biến môi trường.
- [x] **Step 4:** Đổi tên metadata package nếu còn tên cũ, nhưng không chỉnh dependency ngoài nhu cầu rename.

- [ ] Task 3: Kiểm chứng và dọn trạng thái

**Files:**
- Verify: toàn bộ `client/`, `server/`, `docs/`, `render.yaml`, `README.md`

- [x] **Step 1:** Chạy `npm test` và `npm run build` trong `client/`.
- [ ] **Step 2:** Chạy `npm run test:smoke` trong `client/` — đang fail ổn định ở bước undo cuối harness (`784px` thay vì `617px`), không liên quan refactor đường dẫn.
- [x] **Step 3:** Chạy `npm test` trong `server/`.
- [x] **Step 4:** Chạy tìm kiếm đường dẫn cũ và `git diff --check`.
- [x] **Step 5:** Kiểm tra `git status`, bảo đảm không có artifact build mới; `.env` local vẫn được giữ nguyên và không stage.

## Kết quả

Xem [summary](../summaries/2026-10-19-board-tools-repository-layout-summary.md) sau khi hoàn tất.
