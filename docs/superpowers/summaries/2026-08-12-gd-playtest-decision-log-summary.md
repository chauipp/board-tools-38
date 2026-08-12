# Kết quả Playtest & Decision Log

Spec: [Playtest & Decision Log](../specs/2026-08-12-gd-playtest-decision-log-design.md)  
Plan: [Kế hoạch triển khai](../plans/2026-08-12-gd-playtest-decision-log.md)

## Đã làm gì

- Thẻ Playtest giờ lưu được mục tiêu, giả thuyết, build/version, nhóm test, ngày test, quan sát, metrics, feedback và vấn đề phát hiện.
- Playtest và quyết định đều gắn được với nhiều card GD còn tồn tại để truy ngược feedback tới mechanic, skill hoặc level liên quan.
- Mọi card GD có Decision log với lý do, evidence, phương án thay thế, người/ngày quyết định và trạng thái đã bị thay thế.
- Markdown handoff hiển thị đầy đủ Playtest session, Decision log và tên card liên quan.
- Server kiểm payload của dữ liệu mới, chặn reference sai, ID trùng, status không hợp lệ và dữ liệu vượt giới hạn.

## File chính

- `board-tools/client/src/lib/game-design.js`: normalizer và Markdown cho playtest/decision.
- `board-tools/client/src/components/GameDesignPanel.jsx`: các form thu gọn trong dock 275px.
- `board-tools/server/board-payload.js`: validation dữ liệu session/log.
- `docs/game-design-board-test-guide.md`: hướng dẫn test tay và blocker OAuth.

## Khác với plan

Không lệch về chức năng. Browser editor chưa xác nhận được vì Google OAuth từ chối origin local của Playwright; đã thay bằng unit, smoke và production build, đồng thời ghi rõ bước cần test lại.

## Còn dở / cần lưu ý

- So sánh nhiều session/history theo version và follow-up task riêng vẫn để phase sau.
- Cần sửa cấu hình Google OAuth cho `http://localhost:7155` trước khi kiểm UI editor tự động được.
