# Playtest & Decision Log — Design

## Mục tiêu

Biến feedback playtest thành quyết định thiết kế có thể truy ngược ngay trên Game Design board, không cần một tài liệu ngoài board.

## Phạm vi

- Thẻ `Playtest` có một session có cấu trúc: objective, hypothesis, build/version, player group, date, observations, metrics, feedback và problems found.
- Mỗi thẻ GD có Decision log gồm decision, rationale, evidence, alternatives, owner, date, status và card references.
- References chỉ nhận ID của card còn tồn tại trên board. Playtest có thể gắn mechanic/skill/level; decision có thể gắn playtest và phần design liên quan.
- Các nội dung xuất hiện trong Markdown handoff. Viewer chỉ đọc; editor mới sửa được.

## Thiết kế dữ liệu

Lưu trong `node.design` để một card và lịch sử quyết định của nó được đồng bộ, export và lưu cùng một lần với dữ liệu board hiện tại.

`playtestSession` là object đơn với các string fields và `cardIds: string[]`. Một thẻ Playtest biểu diễn một lần test; muốn so sánh nhiều session, tạo nhiều thẻ Playtest và link chúng tới cùng card thiết kế.

`decisionLog` là array tối đa 30 phần tử. Mỗi entry gồm `id`, `decision`, `rationale`, `evidence`, `alternatives`, `owner`, `date`, `status` (`active` hoặc `replaced`) và `cardIds`.

## UI

Trong dock cố định 275px, Playtest card có section thu gọn `Playtest session`; mọi card GD có section `Decision log`. Controls xếp dọc; chọn thẻ liên quan là multi-select. Không thêm panel nổi hoặc tăng bề rộng dock.

## An toàn và tương thích

Normalizers bỏ entry thiếu title/decision, trim text và bỏ card reference đã bị xóa. Server chặn sai kiểu, ID trùng, text quá dài, status lạ và card ID không thuộc board. Board cũ không có field vẫn hợp lệ.

## Kiểm chứng

Thêm unit test normalizer/Markdown và server validation; chạy client tests, smoke, build, server tests. Kiểm UI bằng browser thật nếu đăng nhập được; hiện Google GSI vẫn từ chối origin của browser tự động nên trạng thái đó phải nêu rõ nếu chưa được khắc phục.

## Plan thực thi

[Kế hoạch triển khai](../plans/2026-08-12-gd-playtest-decision-log.md)
