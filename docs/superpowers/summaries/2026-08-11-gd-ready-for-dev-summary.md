Trỏ tới [spec](../specs/2026-08-11-gd-ready-for-dev-design.md) và [plan](../plans/2026-08-11-gd-ready-for-dev.md).

# Summary — Game Design Ready-for-Dev

## Đã làm gì

- Board GD mới có workflow sáu trạng thái Draft, Review, Ready for dev, In dev, Testing, Done; board cũ không bị migration.
- Acceptance criteria được chuẩn hóa thành checklist, có thêm/sửa/tick/xóa trong dock, progress trên card và Markdown `- [ ]`/`- [x]`.
- Edge GD có bốn quan hệ có nghĩa, edge mới mặc định `depends-on`, có inspector bên phải và nhãn chữ trên dây đủ dài.
- Legacy string được chuyển an toàn ở client; server validation nhận cả legacy và chặn checklist/relation sai kiểu hoặc sai giá trị.
- UI đã kiểm bằng browser thật ở desktop và 375×667: dock 275px, không overflow ngang, không lỗi console hoặc request lỗi ngoài dự kiến.
- Dock ưu tiên wheel event của chính nó, cuộn được khi form dài; scrollbar thuộc chính dock nên nằm sát mép phải và dùng màu của skin.

## File chính

- `board-tools/client/src/lib/game-design.js`: mô hình checklist/relation, progress và Markdown export.
- `board-tools/client/src/components/GameDesignPanel.jsx`: inspector checklist cho editor/viewer.
- `board-tools/client/src/components/IdeaCard.jsx`: progress checklist trên canvas.
- `board-tools/client/src/components/EdgeLayer.jsx`: nhãn relation và hiển thị edge GD.
- `board-tools/client/src/pages/IdeaMap.jsx`: lifecycle edge inspector, normalize load/import/realtime và dock.
- `board-tools/client/src/styles/idea-map.css`: layout checklist/edge inspector/label và responsive.
- `board-tools/server/board-payload.js`, `board-tools/server/boards.js`: validation và default status server.
- `docs/game-design-board-checklist.md`: cập nhật các mục workflow, relation và handoff.
- `docs/recipes/dock-wheel-scroll.md`: bẫy wheel event của canvas chặn scroll native trong panel nổi.

## Khác với plan

- Không thêm smoke scenario riêng cho checklist/relation vào `src/__smoke__/entry.jsx`; luồng này đã được kiểm bằng Playwright browser thật với API/backend thật.
- Edge ngắn không hiện nhãn trên canvas mà giữ nhãn đầy đủ trong dock, đúng yêu cầu tránh overlap.

## Còn dở / cần lưu ý

- Backend dev cần chạy với cấu hình môi trường hợp lệ; khi kiểm local đã dùng `PORT=3345 PUBLIC_MODE=true` vì allowlist trong `.env` đang trống.
- Các mục nâng cao như dependency graph/cảnh báo vòng lặp, reviewer và version snapshot vẫn còn trong checklist.
