# A/B Test Hypothesis cho Game Design Card

> Plan thực thi: [../plans/2026-08-13-gd-ab-test-hypothesis.md](../plans/2026-08-13-gd-ab-test-hypothesis.md)

## Mục tiêu

Cho GD ghi rõ giả thuyết thí nghiệm A/B ngay tại feature card: điều đang kiểm chứng, baseline/control, phương án variant, chỉ số chính, ngưỡng thành công, phân khúc và trạng thái. Dev/analyst nhận được thông tin triển khai mà không phải suy diễn từ ghi chú rời.

## Dữ liệu

`node.design.abTests` là mảng tối đa 20 item:

```js
{ id, hypothesis, control, variant, primaryMetric, successCriteria, segment, status }
```

Mọi field text được trim; `hypothesis` bắt buộc. `status` chỉ nhận `draft`, `running`, `concluded`, `rejected`. Dữ liệu cũ thiếu mảng được xem là rỗng.

## UX

- Section `A/B test hypotheses` thu gọn mặc định trong dock phải 275px, mỗi item xếp dọc.
- Editor có thêm/xóa, status dễ đọc; viewer chỉ đọc.
- Card canvas chỉ hiện feedback gọn: `A/B n`, hoặc `A/B n · Running` khi có test đang chạy.
- Markdown/Handoff xuất đầy đủ thông tin cho từng hypothesis có dữ liệu hợp lệ.

## Phi chức năng và giới hạn

- Realtime/load phải normalize dữ liệu để không hỏng board cũ.
- Server từ chối sai kiểu, ID trùng, hypothesis rỗng, status sai hoặc quá 20 item.
- Không thực thi experiment, không gán traffic, không tính kết quả/statistical significance, không dựng dashboard.

## Quyết định

- Gắn theo card thay vì tạo entity A/B Test toàn board: giữ ngữ cảnh feature, hợp mô hình dữ liệu hiện có và không phát sinh view quản lý mới.
- Để `successCriteria` là text tự do: game/team có cách đặt guardrail khác nhau; validation định lượng tự động là premature ở phase này.
