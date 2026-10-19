# Khoảng cách card cùng cấp

[Spec](../specs/2026-10-19-same-level-spacing-design.md) · [Plan](../plans/2026-10-19-same-level-spacing.md)

## Đã làm gì

- Panel cây chỉ còn “Giữa các cấp” và “Giữa các card cùng cấp”, có tên truy cập và bản dịch Anh/Việt.
- Một thanh cập nhật cả khoảng cách nhánh và lá; mở chỉnh cấu hình cũ lấy breadth làm giá trị chung.
- Đã kiểm editor với7card, hai nhánh con có lá: tăng80→120 làm khoảng cách hai lá129→169 và hai card cha258→338, khoảng cách cấp giữ nguyên.
- Kéo chuột, phím, lưu/tải lại, đặt lại và đổi hướng đã kiểm; mobile375×667 không tràn slider. Console không lỗi, không request4xx/5xx.
- Client713/713 và production build đạt cả worktree và main; nguồn đã merge local tại8656330, chưa push.

## File chính

- `client/src/components/TreePanel.jsx`: hai điều khiển, cập nhật đồng thời breadth/leaf và aria-label.
- `client/src/pages/IdeaMap.jsx`: chuẩn hóa cấu hình cũ khi mở panel.
- `client/src/locales/{vi,en}/messages.po`: nhãn mới, bỏ giải thích lá đã xóa.
- `client/src/__smoke__/entry.jsx`: kiểm panel chỉ có hai range, giữ các kiểm hướng/preview/lưu/undo.

## Khác với plan

Kiểm lưu breadth=leaf bằng browser fixture riêng thay vì chèn bật/tắt khóa vào smoke đang kiểm một mốc undo; bật khóa tạo thêm history nên không phù hợp kịch bản cũ. Không đổi thuật toán bố cục hay schema.

## Còn dở / cần lưu ý

- Smoke qua panel cây rồi thất bại tại lỗi bấm đúp nền có từ trước: mong617px, thực tế784px; không bỏ qua hoặc sửa test cho xanh.
- JS/JSX LSP chưa cài, người dùng đã từ chối cài; không có kết quả LSP, đã thay bằng build/tests/browser.
- Cây con lớn vẫn cần chừa đủ diện tích nên khoảng cách card cha có thể lớn hơn giá trị tối thiểu.
- Ảnh thật: `/home/chaupt/.cache/tmp/spacing-desktop.png`, `/home/chaupt/.cache/tmp/spacing-mobile.png`.
- Log: `/home/chaupt/.cache/tmp/spacing-{tests,build,smoke}.log`, `spacing-merged-{tests,build}.log`. Nhật ký: `/home/chaupt/.cache/tmp/ulw-spacing-20261019.7e2daK.md`.
- Thay đổi có sẵn `client/src/index.css` được giữ nguyên. Không tạo recipe vì đây là gộp điều khiển theo đường triển khai trực tiếp; bài học về history đã nằm trong hợp đồng kiểm thử hiện có.
