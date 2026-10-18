# Balance Templates & Warnings — Kết quả

Spec: [../specs/2026-08-12-gd-balance-templates-design.md](../specs/2026-08-12-gd-balance-templates-design.md)  
Plan: [../plans/2026-08-12-gd-balance-templates.md](../plans/2026-08-12-gd-balance-templates.md)

## Đã làm gì

- Thêm template nhanh Combat, XP & Level, Drop rate và Currency flow vào Balance sheet.
- Template chỉ thêm metric chưa tồn tại, nên không ghi đè tuning đang làm.
- Thêm cảnh báo range đảo, kết quả dưới/vượt min-max và drop rate ngoài 0–100%; warning không chặn GD lưu dữ liệu.
- Đã kiểm browser: click XP/Level + Drop rate tạo 6 metric, rate 120% hiện đủ 2 cảnh báo; dock vẫn rộng đúng 275px, không tràn ngang; Console/Network sạch.

## File chính

- `board-tools/client/src/lib/game-design.js` — định nghĩa template, append an toàn và hàm cảnh báo tuning.
- `board-tools/client/src/components/GameDesignBalancePanel.jsx` — hiển thị template nhanh và warning từng metric.
- `board-tools/client/src/styles/idea-map.css` — bố cục template/warning trong dock cố định.
- `board-tools/client/src/lib/game-design.test.js` — kiểm template, duplicate protection và các loại warning.
- `docs/game-design-board-checklist.md` — cập nhật các hạng mục Balance đã hoàn thành.

## Khác với plan

- Không lệch. Không thay API/server vì metric shape hiện hữu đã đủ lưu các template mới.

## Còn dở / cần lưu ý

- Chưa có compare snapshot/version, CSV hay chart/mô phỏng economy; đây là phần mở rộng riêng nếu cần sau này.
- Cảnh báo rate chỉ áp dụng cho key hậu tố `_rate` hoặc đơn vị `%`, để không áp quy tắc drop rate nhầm lên metric khác.
