# Analytics Events cho Game Design Card

> Plan thực thi: [../plans/2026-08-13-gd-analytics-events.md](../plans/2026-08-13-gd-analytics-events.md)

## Mục tiêu

Cho GD mô tả event cần tracking, trigger, properties và KPI ngay trên card để dev có thể triển khai telemetry mà không phải hỏi lại.

## Dữ liệu

`node.design.analyticsEvents` là mảng tối đa 20 item:

```js
{ id, eventName, trigger, properties, kpi, owner }
```

Tất cả là text trim; `eventName` bắt buộc; dữ liệu cũ thiếu mảng được coi là rỗng.

## UX

- Section `Analytics events` thu gọn mặc định ở dock phải.
- Mỗi event xếp dọc, có thêm/xóa; viewer chỉ đọc.
- Card chỉ hiện badge `Analytics n`, không đưa nội dung dài lên canvas.
- Markdown/Handoff xuất đầy đủ event và field có dữ liệu.

## Ngoài phạm vi

Không gửi telemetry từ board, không kết nối SDK analytics, không dựng dashboard/funnel tự động.
