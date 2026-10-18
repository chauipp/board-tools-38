# Kết quả — Follow-up Tasks

> Spec: [Follow-up Tasks](../specs/2026-08-13-gd-follow-up-tasks-design.md)  
> Plan: [Follow-up Tasks Plan](../plans/2026-08-13-gd-follow-up-tasks.md)

## Đã làm gì

- Thêm follow-up task trên card GD: nội dung, owner, deadline, checkbox hoàn thành và card liên quan.
- Card hiển thị tiến độ task dạng `done/total`.
- Markdown/Handoff xuất task thành checkbox cùng metadata cần triển khai.
- Server validate task, reference và deadline, giới hạn 20 task/card.

## File chính

- `board-tools/client/src/lib/game-design.js`: normalize, tiến độ và Markdown follow-up.
- `board-tools/client/src/components/GameDesignPanel.jsx`: editor Follow-up tasks.
- `board-tools/client/src/components/IdeaCard.jsx`: badge tiến độ.
- `board-tools/server/board-payload.js`: validation payload.

## Khác với plan

Không tạo task manager độc lập; follow-up thuộc card nguồn để giữ workflow GD gọn.

## Còn dở / cần lưu ý

UI browser cần được Claude kiểm bằng profile đã đăng nhập; client test/build/smoke và server test đã pass.
