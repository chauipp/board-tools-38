# Game Design Ready-for-Dev — Design

## Mục tiêu

Biến card Game Design thành một đơn vị có thể review và bàn giao cho dev: có trạng thái workflow rõ ràng, tiêu chí nghiệm thu tick được và quan hệ có nghĩa với card khác. Board tư duy trực quan không đổi hành vi.

## Phạm vi

### Workflow Game Design

- Board GD mới dùng bộ status mặc định theo thứ tự: `Draft`, `Review`, `Ready for dev`, `In dev`, `Testing`, `Done`.
- Board GD cũ không bị ghi đè status đang có.
- Người dùng vẫn dùng UI status hiện có để thêm, đổi tên, xóa hoặc đổi thứ tự status.
- Bulk edit tiếp tục đổi status cho nhiều card như hiện tại.

### Acceptance criteria checklist

- `node.design.acceptanceCriteria` đổi từ text tự do sang mảng item `{ id, text, done }` cho card GD mới và khi người dùng chỉnh sửa card cũ.
- Inspector GD hiển thị từng criterion như một checkbox, có thêm dòng, sửa text và xóa dòng.
- Khi đọc dữ liệu cũ có chuỗi acceptance criteria, client chuyển nó thành một item checklist chưa hoàn thành; dữ liệu không bị mất.
- Card canvas hiển thị tiến độ ngắn `đã xong/tổng số` khi có checklist.
- Export Markdown tạo checklist Markdown `- [ ]` / `- [x]`.

### Quan hệ card Game Design

- Edge GD có thêm field `relation`, một trong: `depends-on`, `unlocks`, `replaces`, `conflicts-with`.
- Edge cũ và mọi edge của board idea không có `relation`; chúng vẫn hiển thị và hoạt động như dây nối thường.
- Với board GD, thao tác tạo/sửa edge mở lựa chọn loại quan hệ; mặc định là `depends-on`.
- Canvas hiện nhãn ngắn của quan hệ trên edge GD.
- Khi xóa card, edge liên quan vẫn bị xóa theo hành vi hiện tại.
- Export Markdown có mục quan hệ, ghi nguồn, loại quan hệ và đích.

## Thiết kế dữ liệu

```js
// Chỉ dùng trong node của board.kind === "game-design"
node.design.acceptanceCriteria = [
  { id: "ac-1", text: "Skill có cooldown", done: true }
];

// Chỉ dùng cho edge của board.kind === "game-design"
edge.relation = "depends-on";
```

Server vẫn cho phép payload board cũ. Validation chỉ nhận mảng checklist hợp lệ hoặc chuỗi legacy; relation chỉ nhận bốn id nêu trên khi có field.

## UX

- Mọi chỉnh sửa sống trong dock phải rộng 275px.
- Inspector Game Design gồm các field spec như hiện tại, riêng Acceptance criteria là section checklist.
- Khi user chọn edge GD, edit dock hiển thị nhóm sửa quan hệ thay cho menu rời; không thay đổi menu edge của board idea.
- Bulk edit và inspector vẫn có thể cùng nằm trong dock, với panel dock cao cố định hiện có.

### Tiêu chuẩn dễ nhìn và dễ dùng

- Dock phải là một cột cố định, không lấn rộng theo canvas. Khi đang edit, dock luôn hiện trọn chiều cao; nội dung dài cuộn bên trong dock, không đẩy hoặc chồng lên minimap, zoom control hay filter HUD.
- Mỗi nhóm chỉnh sửa xếp dọc, có khoảng cách rõ ràng. Checkbox acceptance criteria có hàng bấm riêng; nút thêm/xóa/tick không đè lên text hoặc nhau.
- Relation có cả **nhãn chữ** và màu/kiểu dây riêng; màu không phải cách nhận diện duy nhất. Ví dụ nhãn `Phụ thuộc` luôn đọc được kể cả với người không phân biệt màu.
- Nhãn relation đặt giữa edge, có nền tương phản với canvas; tránh che đầu card, connector và control. Edge quá ngắn thì nhãn chuyển vào dock thay vì chen lên canvas.
- Các action nguy hiểm (xóa criterion, xóa edge) dùng màu danger kèm chữ rõ ràng; các action thường không dùng màu danger.
- Text trong dock tối thiểu 12px; label/tiêu đề phân cấp rõ; text preview trên canvas tối thiểu 11px ở zoom mặc định. Không dùng chữ quá nhạt so với nền của skin đang chọn.
- Mỗi control tương tác có vùng bấm tối thiểu 32px, hover/focus rõ và có `title`/accessible name khi chỉ dùng icon.
- Viewer thấy checklist, progress và relation nhưng các control sửa bị ẩn hoặc disabled rõ ràng.
- Desktop và mobile 375×667 không có horizontal overflow; dock mobile vẫn cố định trong viewport và nội dung cuộn được.

## Tương thích và lỗi

- Board cũ thiếu `kind` vẫn là `idea`.
- GD cũ với acceptance criteria dạng text được chuẩn hóa ở client trước khi lưu tiếp.
- Relation id lạ bị bỏ về `depends-on` chỉ lúc user chủ động sửa edge; server từ chối payload relation không hợp lệ.
- Viewer thấy tiến độ và nhãn quan hệ nhưng không thể thay đổi chúng.

## Kiểm thử

- Unit test chuẩn hóa checklist legacy, tạo/sửa/tick/xóa checklist và Markdown.
- Unit test validation acceptance criteria/relation hợp lệ và không hợp lệ.
- UI Playwright: tạo GD board, xác nhận status mặc định; tạo checklist rồi tick; tạo edge chọn relation; xem nhãn edge; export Markdown; mobile 375×667; không lỗi console/network ngoài các request xác thực dự kiến.
- Visual Playwright: chụp desktop và mobile với checklist dài, bulk edit và relation ngắn/dài; xác nhận dock, HUD, minimap, zoom control, label edge và card không overlap hay tràn ngang.

## Plan thực thi

[Xem kế hoạch triển khai](../plans/2026-08-11-gd-ready-for-dev.md).
