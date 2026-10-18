# Game Design Flow — Design

## Mục tiêu

Thêm một bản đồ luồng cấp board Game Design để designer mô tả Player Loop và Progression Map trước khi đi vào các card feature chi tiết.

## Tóm tắt đã chốt

- Chỉ board `kind === "game-design"` có Game Flow; board idea không bị thay đổi.
- `Player Loop` mô tả chuỗi tuần hoàn hành động → kết quả/reward → quyết định tiếp theo.
- `Progression Map` mô tả mốc phát triển early/mid/late với mục tiêu, unlock, mô tả và cảm xúc.
- Game Flow là overview cấp board, không thay thế card Mechanic/Quest/Skill hay balance sheet.
- UI ở dock phải 275px; hai section thu/mở độc lập, mọi control xếp dọc.
- Viewer chỉ đọc; desktop là phạm vi kiểm chứng, mobile để Phase UX/mobile sau.

## Dữ liệu

```js
board.gameDesignFlow = {
  playerLoop: [
    { id: "loop-1", title: "Khám phá", action: "Chọn khu vực", outcome: "Nhận thông tin và tài nguyên", note: "Mở lựa chọn build", cardIds: ["node-1"] }
  ],
  progressionMap: [
    { id: "progression-1", title: "Early game", objective: "Học loop", unlocks: "Kỹ năng né", description: "Run đầu ngắn", emotion: "Tò mò", cardIds: ["node-2"] }
  ]
};
```

- `playerLoop` tối đa 20 item, `progressionMap` tối đa 30 item.
- Các text trim khi lưu, tối đa 1.000 ký tự; title là bắt buộc và item thiếu title bị bỏ.
- `id` là string tối đa 120 ký tự. `cardIds` là mảng id node duy nhất, chỉ giữ các node thuộc board hiện tại.
- Board GD cũ thiếu field normalize thành hai mảng rỗng.

## UI và luồng

- Header GD có nút `Game flow`, mở dock và đóng inspector/bulk edit đang mở.
- `Player Loop` và `Progression Map` có thể collapse/expand. Thao tác thêm/xóa/lưu luôn có chữ rõ ràng.
- Mỗi item hiển thị field theo chiều dọc và multiselect/reference tới card GD. Click một reference mở card tương ứng trong dock.
- Click ngoài hoặc Escape: nếu dirty, lưu flow rồi đóng theo cùng lifecycle Game brief.
- Export có `## Game Flow` sau `## Game Context`, chỉ xuất section có dữ liệu.

## Server, conflict và quyền

- Server schema/payload/PUT/socket/conflict nhận `gameDesignFlow` optional và validation nghiêm ngặt.
- Client normalize khi load/import/realtime; rebase coi flow là scalar cấp board để local flow thắng remote flow, trong khi node/edge vẫn merge hiện hữu.
- Viewer đọc được nội dung và references nhưng không thể sửa, thêm, xóa hay lưu.

## Kiểm thử và ngoài phạm vi

- Unit cho normalize, reference card, Markdown và rebase; server test malformed/limit/legacy; smoke form/viewer; Playwright desktop thật cho save, reload, export, overlap và console/network.
- Ngoài phạm vi: mobile, dependency graph/cycle warning, balance formula, drag-drop và tự sinh flow từ card.

## Decision log

- Chọn dữ liệu cấp board thay vì card canvas: overview có một nguồn sự thật, canvas không quá tải.
- Chọn panel dock thay vì spreadsheet: đồng bộ với thao tác chỉnh sửa hiện tại, phù hợp desktop trước.
- Chỉ reference card một chiều: giữ quan hệ nhẹ, không thay thế dependency graph sau này.

## Plan thực thi

[Xem kế hoạch thực thi](../plans/2026-08-11-gd-game-flow.md).

## Kết quả

[Kết quả sẽ được ghi tại đây](../summaries/2026-08-11-gd-game-flow-summary.md).
