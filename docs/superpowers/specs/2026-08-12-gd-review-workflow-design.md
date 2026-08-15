# Game Design Review Workflow — Design

> Plan thực thi: [../plans/2026-08-12-gd-review-workflow.md](../plans/2026-08-12-gd-review-workflow.md)

## Mục tiêu

Cho mỗi Game Design card một vòng review rõ ràng: ai review, khi nào, kết luận gì và những việc cần sửa trước khi được duyệt.

## Phạm vi

- Board GD mới có thêm status `Approved` và `Rejected`, giữ toàn bộ status cũ.
- Mỗi card có `design.review`: reviewer, review date, outcome (`pending`, `approved`, `changes-requested`, `rejected`) và tối đa 20 comment hành động.
- Inspector có section `Review` thu gọn trong dock phải; comment có nội dung, người ghi và checkbox resolved.
- Preview card hiển thị outcome review khi đã khác `pending`.
- Markdown handoff xuất review outcome và comment chưa resolved để Dev/Art/Audio biết còn điều kiện nào.
- Client normalize và server validate dữ liệu; viewer chỉ đọc.

## Ngoài phạm vi

- Không có mention, notification, threaded discussion hay approval theo nhiều cấp.
- Không ép status board tự đổi theo review outcome; GD tự kéo status khi team muốn quy trình khác.

## Kết quả chấp nhận

- Reviewer đặt `Changes requested`, thêm comment, tick resolved, lưu/reload không mất.
- Chọn `Approved` hoặc `Rejected` hiển thị trên card và xuất Markdown.
- Board GD mới có thể lọc và kéo card vào status Approved/Rejected.
