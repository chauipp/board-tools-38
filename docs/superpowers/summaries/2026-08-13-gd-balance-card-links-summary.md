# Kết quả — Balance Links

> Spec: [Balance ↔ Card Links](../specs/2026-08-13-gd-balance-card-links-design.md)  
> Plan: [Balance ↔ Card Links Plan](../plans/2026-08-13-gd-balance-card-links.md)

## Đã làm gì

- Card GD hiển thị badge số metric Balance được gắn.
- Inspector card có Balance links, đọc tên/key/kết quả/đơn vị từng metric.
- Có thể mở thẳng Balance Sheet từ card để chỉnh metric nguồn.
- Card không lưu bản sao metric nên giá trị luôn cùng nguồn dữ liệu Balance.

## File chính

- `board-tools/client/src/lib/game-design.js`: reverse lookup metric theo card.
- `board-tools/client/src/components/GameDesignPanel.jsx`: section Balance links và điều hướng.
- `board-tools/client/src/components/IdeaCard.jsx`: badge Balance.
- `board-tools/client/src/pages/IdeaMap.jsx`: truyền Balance sheet vào card/inspector.

## Khác với plan

Không lệch.

## Còn dở / cần lưu ý

Browser UI cần Claude kiểm qua profile đăng nhập; client test/build/smoke và server test đã pass.
