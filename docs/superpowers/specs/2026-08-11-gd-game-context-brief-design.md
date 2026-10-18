# Game Design Context Brief — Design

## Mục tiêu

Cho mỗi board Game Design một brief cấp dự án để designer ghi rõ game đang làm cho ai, trải nghiệm cốt lõi là gì và hành trình người chơi cần đi qua. Brief xuất cùng Markdown để dev/team đọc được bối cảnh trước khi vào từng card.

## Phạm vi

### Dữ liệu cấp board

Chỉ board có `kind === "game-design"` dùng optional field:

```js
board.gameDesignBrief = {
  genre: "Action roguelite",
  targetAudience: "Người chơi thích mastery 15–30 phút mỗi lượt",
  playerFantasy: "Một thợ săn linh hoạt làm chủ tình huống nguy hiểm",
  playerJourney: [
    { id: "journey-1", title: "Khám phá", experience: "Thử chiến thuật", emotion: "Tò mò" }
  ]
};
```

- `genre`, `targetAudience`, `playerFantasy` là chuỗi tối đa 4.000 ký tự, trim khi lưu.
- `playerJourney` là mảng tối đa 50 stage; mỗi stage có `id`, `title`, `experience`, `emotion` là chuỗi tối đa 1.000 ký tự.
- Stage thiếu title bị bỏ khi lưu, không tạo stage rỗng.
- Board GD cũ thiếu field là brief rỗng; board idea không render hoặc chỉnh brief.

### Giao diện

- Header board GD có nút chữ `Game brief`, dùng để mở inspector trong dock phải 275px.
- Khi brief mở, dock dùng cùng vị trí/cuộn/right panel hiện có; click ra ngoài sẽ lưu thay đổi dirty trước khi thu panel, cùng luật inspector card GD.
- Ba field text đứng trước section `Player journey`.
- Mỗi stage journey là một hàng dọc: input tên stage, textarea trải nghiệm, input cảm xúc, nút `Xóa` có chữ và màu danger; có nút `+ Thêm giai đoạn`.
- Viewer thấy nội dung brief nhưng không có control sửa/lưu/xóa hoạt động.
- Nút `Game brief` chỉ hiện ở board GD; nó không ảnh hưởng board idea, bulk edit, minimap, zoom hoặc filter.

### Markdown

`gameDesignMarkdown(board)` xuất brief trước `## Game Design`, chỉ khi có ít nhất một field/stage:

```md
## Game Context

**Genre**

Action roguelite

**Player journey**

1. **Khám phá** — Thử chiến thuật · Tò mò
```

Không tạo heading/trường rỗng; sau brief vẫn xuất card, checklist và quan hệ như hiện tại.

## Server/API/realtime

- `boardPayload()` gửi `gameDesignBrief` cho GET, conflict response và socket payload hiện có.
- PUT cho phép field optional; validator chỉ nhận object không phải array và kiểm độ dài/kích thước/id stage.
- Mongo schema lưu `gameDesignBrief` là `Object`, default `null`, để document cũ không migration.
- `rebase.js` xem `gameDesignBrief` là scalar board-level: khi cả hai phía cùng đổi brief, thay đổi local theo luật scalar hiện tại thắng; nodes/edges vẫn merge như cũ.

## UX và accessibility

- Dock giữ width 275px, scrollbar thuộc dock và sát mép phải; nội dung brief dài cuộn bên trong dock, canvas không bắt wheel khi hover dock.
- Label dock tối thiểu 12px, canvas không thay đổi; mọi button/input có vùng bấm tối thiểu 32px và focus-visible rõ.
- Không chỉ dùng icon cho thao tác journey: `Xóa`, `+ Thêm giai đoạn`, `Lưu brief` đều có tên đọc được.
- Desktop và mobile 375×667 không horizontal overflow; stage dài wrap/scroll dọc, không chồng controls.

## Kiểm thử

- Unit: normalize brief rỗng/legacy, stage add-edit-delete filter stage rỗng, Markdown có/không brief.
- Server: payload brief hợp lệ, stage/id/text sai kiểu hoặc vượt giới hạn bị từ chối; payload cũ thiếu brief qua được.
- Rebase: local brief thay đổi sống cùng node/edge remote thay đổi.
- Playwright backend thật: mở `Game brief`, điền ba field và hai stage, lưu/click ngoài, reload dữ liệu, export Markdown; viewer chỉ đọc.
- Visual Playwright desktop và mobile 375×667: stage dài, dock right scrollbar, không overlap HUD/minimap/zoom/filter, console/network sạch.

## Ngoài phạm vi

- Player Loop cấp nhỏ/cấp lớn và Progression Map sẽ là Phase 1B riêng, dùng card chuyên dụng.
- Genre taxonomy, analytics, roadmap, reviewer và graph/cycle warning không thuộc lát cắt này.

## Plan thực thi

[Xem kế hoạch triển khai](../plans/2026-08-11-gd-game-context-brief.md).

## Kết quả

[Xem kết quả triển khai](../summaries/2026-08-11-gd-game-context-brief-summary.md).
