# Game Design Board — Thiết kế

## Bối cảnh

Board Tools hiện có là một canvas tư duy trực quan: thẻ, khung, dây nối, hình vẽ, cộng tác và xuất dữ liệu. Người dùng cần thêm một loại board dành riêng cho game design mà không thay đổi board hiện có.

## Mục tiêu

- Cho tạo `Bảng tư duy trực quan` hoặc `Game Design` từ danh sách board.
- Giữ tương thích tuyệt đối với board cũ: thiếu `kind` được hiểu là `idea`.
- Game Design dùng lại canvas, realtime, quyền truy cập và export hiện có.
- Thẻ Game Design mang template và phần chi tiết đủ rõ để handoff cho dev.

## Không thuộc phạm vi

- Bảng cân bằng có công thức/spreadsheet.
- Đồng bộ Jira, Linear, Figma hay analytics.
- Tách một canvas hoặc backend thứ hai.

## Quyết định

Board dùng một engine chung và trường `kind: "idea" | "game-design"`. Mỗi node của board GD có `type` và `design`; node/board cũ vẫn là dữ liệu tự do. Chọn hướng này để không nhân đôi code canvas, sync, export và để mở rộng template qua một registry phía client.

## Luồng sử dụng

1. Người dùng bấm `+ Board mới`.
2. Chọn Bảng tư duy trực quan hoặc Game Design, nhập tên.
3. Server tạo board với `kind` và các status phù hợp.
4. Trong board GD, người dùng thêm thẻ theo template, kết nối và nhóm chúng trên canvas.
5. Mở panel chi tiết của thẻ để điền mục tiêu, luật, input/output, phụ thuộc, owner, priority và acceptance criteria.
6. Board được autosave/realtime như board hiện tại; xuất Markdown tạo cấu trúc handoff.

## Template khởi đầu

- Game Pillar, Core Loop, Mechanic/System, Character/Unit, Skill/Item, Quest/Level, UI/UX, Playtest.
- Mọi template dùng các field chung: `goal`, `rules`, `inputs`, `outputs`, `edgeCases`, `dependencies`, `owner`, `priority`, `acceptanceCriteria`.
- Registry có thể đặt nhãn, icon, placeholder và các trường nên hiện theo từng `type`.

## Dữ liệu và tương thích

Schema `Board` có `kind` mặc định `idea`; API list/get/put và socket payload mang trường này. Node được phép có `type` và object `design`; validation chỉ kiểm kiểu an toàn/giới hạn độ dài. Board cũ thiếu mọi field mới vẫn được mở như `idea`.

## UX và lỗi

- Modal chọn loại phải hủy được và vô hiệu hóa lúc đang tạo.
- Chỉ board GD thấy nút template/panel chi tiết; board idea không đổi.
- Đổi template không tự xóa field cũ mà giữ `design` để tránh mất bài.
- Viewer không được tạo/sửa thẻ hoặc panel.

## Kiểm thử

- Unit/API: tạo/list/get/save `kind`; validate node `design`.
- Client: template registry và Markdown export.
- UI Playwright: tạo từng loại board, tạo/sửa Mechanic, kiểm board cũ và layout 375px.

## Decision log

- Dùng engine chung thay vì page riêng: giảm duplication và rủi ro sync.
- Chọn canvas + template thay vì table thuần: giữ workflow trực quan của người dùng nhưng thêm cấu trúc handoff.
- Hoãn balance table/Jira: không làm phiên bản đầu phình phạm vi.

## Plan thực thi

Xem [plan thực thi](../plans/2026-08-11-game-design-board.md).
