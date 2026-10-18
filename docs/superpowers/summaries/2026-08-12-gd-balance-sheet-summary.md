# Kết quả Balance Sheet

Spec: [Balance Sheet](../specs/2026-08-12-gd-balance-sheet-design.md)  
Plan: [Kế hoạch triển khai](../plans/2026-08-12-gd-balance-sheet.md)

## Đã làm gì

- Thêm Balance sheet cấp board GD để ghi các chỉ số như damage, HP, cooldown, reward với min/max và đơn vị.
- Hỗ trợ công thức bằng key chỉ số và bốn phép toán/ngoặc; kết quả hiển thị tức thời, không dùng `eval`.
- Mỗi chỉ số liên kết được với card GD liên quan và xuất trong Markdown handoff.
- Dữ liệu mới đồng bộ qua realtime, rebase và được server validate trước khi ghi.

## File chính

- `board-tools/client/src/components/GameDesignBalancePanel.jsx`: UI Balance sheet trong dock.
- `board-tools/client/src/lib/game-design.js`: model, evaluator giới hạn và Markdown.
- `board-tools/server/board-payload.js`: validation Balance sheet.
- `board-tools/server/boards.js` và `models.js`: persistence/response realtime.

## Khác với plan

Không lệch. Chưa thêm CSV, economy flow hay so sánh version vì nằm ngoài scope phase nhỏ này.

## Còn dở / cần lưu ý

- Browser editor vẫn chưa xác nhận được do Google OAuth từ chối origin local của Playwright.
- Cần bổ sung template XP/drop rate/currency, cảnh báo bất thường và import/export CSV ở phase Balance tiếp theo.
