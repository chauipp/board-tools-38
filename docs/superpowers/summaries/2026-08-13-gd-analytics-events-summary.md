# Kết quả — Analytics Events

> Spec: [Analytics Events cho Game Design Card](../specs/2026-08-13-gd-analytics-events-design.md)  
> Plan: [Analytics Events Implementation Plan](../plans/2026-08-13-gd-analytics-events.md)

## Đã làm gì

- Card GD có section Analytics events với event name, trigger, properties, KPI và owner.
- Canvas hiển thị badge số lượng event, không đưa nội dung dài lên card.
- Markdown/Handoff xuất đầy đủ thông tin analytics có dữ liệu.
- Server giới hạn tối đa 20 event/card và chặn event thiếu tên hoặc sai kiểu.
- Bổ sung test guide cho người dùng và brief Claude.

## File chính

- `board-tools/client/src/lib/game-design.js`: normalize, preview và Markdown analytics.
- `board-tools/client/src/components/GameDesignPanel.jsx`: editor section Analytics events.
- `board-tools/client/src/components/IdeaCard.jsx`: badge số event trên card.
- `board-tools/client/src/pages/IdeaMap.jsx`: normalize dữ liệu khi load/realtime.
- `board-tools/server/board-payload.js`: validation payload analytics.
- `docs/game-design-board-test-guide.md`: kịch bản test UI.

## Khác với plan

Không lệch phạm vi; chưa kết nối SDK hoặc dashboard analytics theo đúng spec.

## Còn dở / cần lưu ý

Browser UI cần Claude chạy trên profile đã đăng nhập; unit/build/smoke/server đều đã pass.
