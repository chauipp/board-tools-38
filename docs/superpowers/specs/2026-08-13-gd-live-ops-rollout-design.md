# Live Tuning, Rollout và Feature Flag cho Game Design Card

> Plan thực thi: [../plans/2026-08-13-gd-live-ops-rollout.md](../plans/2026-08-13-gd-live-ops-rollout.md)

## Mục tiêu

Mỗi feature card có một bản ghi live-ops để GD, dev và QA biết thay đổi tune nào sẽ lên live, từ version nào, được bật bằng flag nào, rollout tới đâu và cách rollback khi có vấn đề.

## Bối cảnh và giả định

- Board là nơi đặc tả, phối hợp và bàn giao; không trực tiếp bật flag hay thay đổi production.
- Desktop-first, dock phải cố định 275px; viewer chỉ đọc; board cũ không mất dữ liệu.
- Một card thường có một rollout hiện hành; lịch sử rollout/post-launch sẽ là phase sau.
- Dữ liệu có quy mô nhỏ, realtime như các field card hiện tại, và server phải từ chối dữ liệu sai hình dạng.

## Dữ liệu

`node.design.liveOps`:

```js
{
  tuningNotes, version, featureFlag, rolloutPercent,
  audience, status, rollbackPlan
}
```

- Text được trim; `rolloutPercent` là chuỗi số nguyên 0–100 hoặc rỗng để người dùng có thể chưa quyết định.
- `status`: `planned`, `running`, `paused`, `full`, `rolled-back`.
- Không có field nào bắt buộc: card vẫn có thể là spec chưa chuẩn bị rollout.

## UX và export

- Section `Live tuning & rollout` thu gọn mặc định ở dock, mọi control xếp dọc.
- Card chỉ hiện badge khi có live-ops: ví dụ `Live · 25%` hoặc `Live · Paused`; không đưa notes dài lên canvas.
- Markdown/Handoff xuất section đầy đủ, có flag, version, rollout, audience, notes và rollback plan.
- Viewer thấy nội dung nhưng không sửa/lưu.

## Ngoài phạm vi

- Không kết nối dịch vụ feature flag, không gọi API production, không rollout traffic, không audit log/history, không dashboard metric.

## Quyết định

- Dùng object đơn thay vì danh sách rollout: đáp ứng rollout đang hoạt động và tránh tạo UI timeline/history trước Phase post-launch.
- Giữ percent dưới dạng chuỗi chuẩn hoá: tương thích mô hình form text hiện có, cho phép trạng thái planned chưa có tỷ lệ, nhưng vẫn validate chặt 0–100.
