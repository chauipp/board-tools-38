# Post-launch Review cho Game Design Card

> Plan thực thi: [../plans/2026-08-13-gd-post-launch-review.md](../plans/2026-08-13-gd-post-launch-review.md)

## Mục tiêu

Cho team khép vòng đời feature ngay trên card: sau khi phát hành, ghi kết quả, tín hiệu thực tế, điều học được, quyết định tiếp theo và người chịu trách nhiệm.

## Dữ liệu

`node.design.postLaunchReview` là object:

```js
{ outcome, actualMetrics, learnings, nextDecision, owner, reviewDate, status, cardIds }
```

`status` là `pending`, `healthy`, `needs-iteration`, `sunset`. Text được trim; `reviewDate` là ISO `YYYY-MM-DD` hoặc rỗng; liên kết chỉ giữ card còn tồn tại.

## UX

- Section `Post-launch review` thu gọn mặc định trong dock phải, item xếp dọc.
- Card chỉ hiện badge gọn theo status, ví dụ `Post-launch · Iterate`; không đưa nội dung dài lên canvas.
- Markdown/Handoff xuất toàn bộ kết quả và tên card liên quan.
- Viewer chỉ đọc; board cũ và dữ liệu rỗng tương thích.

## Ngoài phạm vi

Không tạo dashboard, không tự lấy analytics, không tạo lịch sử nhiều review/release, không tự tạo task tracker.

## Quyết định

- Một review/card thay vì danh sách: phase này tập trung vòng phản hồi của rollout hiện hành; history theo version là mở rộng sau.
- `cardIds` dùng liên kết sẵn có để nối review tới mechanic/playtest/follow-up mà không thêm quan hệ đồ thị mới.
