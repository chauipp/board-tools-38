# Game Design Dev Handoff — Design

## Mục tiêu

Biến dữ liệu đã viết trên board Game Design thành tài liệu bàn giao cho dev có cấu trúc, dễ quét và không phải hỏi lại các thông tin cơ bản.

## Phạm vi phase

- Thêm `technicalNotes` dạng text vào `node.design`, tối đa 2.000 ký tự.
- Thêm nút `Dev handoff` trên board Game Design, mở trong dock phải 275px.
- Handoff hỗ trợ chọn tất cả card GD hoặc chỉ các card đang chọn.
- Markdown nhóm theo từng card: metadata, design fields, acceptance criteria, examples, failure states, tuning parameters, technical notes và dependencies.
- Card không đủ identity hoặc dữ liệu rỗng không tạo section rỗng; dữ liệu legacy vẫn đọc được.
- Viewer được đọc và export nhưng không có control chỉnh sửa.

## Ngoài phạm vi

- Không tạo task tracker, Jira/Linear sync, CSV hay API phát hành riêng.
- Không tự sinh công thức tuning hoặc thay đổi workflow status.
- Không đổi board idea.

## Luồng dữ liệu

`GameDesignPanel` chỉnh `technicalNotes` → normalize khi load/import/socket/rebase → `DevHandoffPanel` lấy board và selection → `gameDesignMarkdown(board, { nodeIds })` xuất Markdown → nút copy/tải file dùng helper hiện có.

## UI và UX

- Dock cố định 275px, các control xếp dọc, chỉ dock được scroll.
- Mặc định chọn `Tất cả card`; khi có nhiều card được chọn, cho phép chuyển sang `Card đang chọn`.
- Hiển thị số card và cảnh báo card thiếu acceptance criteria/technical notes, nhưng vẫn cho export.
- Nút chính: `Xuất Markdown`, `Sao chép Markdown`, `Đóng`.
- Viewer thấy nội dung và export, không thấy input hoặc nút sửa metadata.

## Kiểm thử

- Unit: normalize technical notes và Markdown lọc theo nodeIds/section order.
- Server: validate technicalNotes type/length, legacy payload vẫn hợp lệ.
- Smoke: mở panel, đổi phạm vi, export không có card ngoài phạm vi, viewer read-only.
- Browser desktop thật khi có session; mobile dời phase sau.

## Plan thực thi

[Xem plan](../plans/2026-08-11-gd-dev-handoff.md).
