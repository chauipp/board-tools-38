# Kết quả — Handoff theo loại card

> Spec: [Handoff theo loại card](../specs/2026-08-13-gd-handoff-type-filter-design.md)  
> Plan: [Handoff theo loại card — Plan](../plans/2026-08-13-gd-handoff-type-filter.md)

## Đã làm gì

- Handoff có phạm vi `Theo loại card` và chọn nhiều template GD bằng Ctrl/Cmd.
- Preview, count và Markdown chỉ lấy card thuộc loại đã chọn.
- Relations có đầu nằm ngoài phạm vi tự bị loại khỏi export.
- Tên file download phản ánh các loại card đã chọn.

## File chính

- `board-tools/client/src/components/DevHandoffPanel.jsx`: scope/filter/filename trong panel Handoff.
- `board-tools/client/src/lib/game-design.test.js`: kiểm tra relation chỉ xuất trong scope.
- `docs/game-design-board-test-guide.md`: test manual theo loại card.

## Khác với plan

Không lệch.

## Còn dở / cần lưu ý

Browser UI cần Claude test trên profile đã đăng nhập; client test/build/smoke và server test đã pass.
