# Nhân bản card Game Design

> Plan: [../plans/2026-08-13-gd-duplicate-card.md](../plans/2026-08-13-gd-duplicate-card.md)

## Mục tiêu

Cho phép editor nhân bản một card Game Design đã có để thử một biến thể mà không phải nhập lại toàn bộ brief/spec.

## Quyết định

- Bản sao giữ title, mô tả, loại card và toàn bộ dữ liệu `design`; title nhận hậu tố ` — bản sao`.
- Bản sao được đặt cách card nguồn 300px về bên phải để thấy ngay cả hai biến thể.
- Không copy `id`, toạ độ, status, tag hay edge. Bản sao vì thế không kế thừa workflow cũ và không ngụ ý dependency.
- Dữ liệu `design` được deep clone để sửa bản sao không làm thay đổi card nguồn.
- Chỉ editor thấy nút `Nhân bản`; sau thao tác, dock chuyển sang card mới. Một Undo hoàn tác cả thao tác.
- Không mở rộng sang template library hoặc drag/drop dependency ở phase này.

## Giả định và rủi ro

Board hiện có giới hạn dữ liệu normalizer ở server; helper chỉ làm việc trên dữ liệu đã hợp lệ. Tạo bản sao là một lần save/realtime như các hành động card khác. Kiểm UI local bị chặn bởi Google OAuth, nên hướng dẫn xác nhận trên phiên Claude đã đăng nhập.

## Plan thực thi

[../plans/2026-08-13-gd-duplicate-card.md](../plans/2026-08-13-gd-duplicate-card.md)
