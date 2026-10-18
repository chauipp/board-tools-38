# Balance Templates & Warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm preset progression/economy và cảnh báo tuning trực tiếp trong Game Design Balance sheet.

**Architecture:** Template và warning nằm trong `game-design.js` dưới dạng hàm thuần. Balance panel chỉ render/áp template vào state local; persistence/server dùng metric shape hiện có nên không thay schema.

**Tech Stack:** React 18, Vite, Node test runner.

## Global Constraints

- Chỉ Game Design board; dock edit desktop cố định 275px.
- Template không ghi đè dữ liệu metric đang có và warning không chặn lưu.
- Không thêm dependency, chart, CSV hay thay đổi API/schema.

---

- [x] Task 1: Contract template và warning

**Files:**
- Modify: `board-tools/client/src/lib/game-design.js`
- Modify: `board-tools/client/src/lib/game-design.test.js`

**Interfaces:**
- Produces `BALANCE_TEMPLATES`, `balanceWarnings(metric, variables)` and `appendBalanceTemplate(balance, templateId, nodes)`.

- [x] Viết test cho metric preset unique, append không ghi đè key cũ, và cảnh báo range/rate/formula.
- [x] Tạo bốn template Combat, XP & Level, Drop rate, Currency flow với metric/formula an toàn.
- [x] Implement warning trả mảng message cho range đảo, result ngoài range và rate ngoài 0–100.
- [x] Chạy `npm test` ở client.

- [x] Task 2: Balance panel

**Files:**
- Modify: `board-tools/client/src/components/GameDesignBalancePanel.jsx`
- Modify: `board-tools/client/src/styles/idea-map.css`

- [x] Render các nút template nhanh, disabled cho viewer; click append metric mới và đánh dirty.
- [x] Render warning rõ ràng dưới kết quả, giữ controls xếp dọc trong dock.
- [x] Chạy client test, build và smoke test.

- [x] Task 3: UI verification và tài liệu

**Files:**
- Modify: `docs/game-design-board-checklist.md`
- Modify: `docs/game-design-board-test-guide.md`
- Create: `docs/superpowers/summaries/2026-08-12-gd-balance-templates-summary.md`

- [x] Mở production preview bằng Playwright, dùng board tạm để áp XP/Level và Drop rate, kiểm warning/rộng dock/console/network rồi xóa board test.
- [x] Tick checklist và plan, ghi summary dựa trên diff/test thực tế.

## Kết quả

Sau thực thi: [../summaries/2026-08-12-gd-balance-templates-summary.md](../summaries/2026-08-12-gd-balance-templates-summary.md)
