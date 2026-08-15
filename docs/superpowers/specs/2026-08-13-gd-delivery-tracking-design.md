# Delivery Tracking cho Game Design Card

> Plan thực thi: [../plans/2026-08-13-gd-delivery-tracking.md](../plans/2026-08-13-gd-delivery-tracking.md)

## Mục tiêu

Hoàn tất phần còn thiếu của Phase 2 bằng cách để mỗi card Game Design mang được mốc phát hành, deadline, người phụ trách và blocker có thể hành động.

## Quyết định UX

- Không mở thêm màn roadmap lớn: thông tin delivery thuộc chính card cần triển khai, nên nằm trong section `Delivery` của dock phải.
- `Milestone`, `Assignee`, `Deadline`, `Blocker` là field đơn giản, đọc được ngay; `Blocker` có severity `none`, `risk`, `blocked`.
- Canvas chỉ hiện tóm tắt gọn: milestone/deadline/assignee và một badge blocker khi có. Không phình card thành một bảng task.
- Viewer đọc được mọi thông tin nhưng không chỉnh sửa.

## Dữ liệu

`node.design.delivery`:

```js
{ milestone: "Vertical slice", assignee: "Linh", deadline: "2026-09-15", blocker: "Chờ animation", blockerLevel: "blocked" }
```

Ngày dùng chuỗi `YYYY-MM-DD`; dữ liệu cũ thiếu field được chuẩn hóa về rỗng. Export Markdown có section Delivery khi card có dữ liệu.

## Phạm vi

- Client normalization, panel edit, preview card, Markdown.
- Server validation, persistence và payload realtime.
- Unit/build/smoke; browser test sẽ được bổ sung vào test guide.

## Ngoài phạm vi

- Gantt/timeline toàn board, phân quyền theo team, nhắc deadline, notification, công việc con độc lập.
