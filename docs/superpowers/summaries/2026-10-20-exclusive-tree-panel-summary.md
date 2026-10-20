# Ưu tiên bảng Xếp cây

[Spec](../specs/2026-10-20-exclusive-tree-panel-design.md) · [Plan](../plans/2026-10-20-exclusive-tree-panel.md)

## Đã làm gì

- Mở Tuỳ chỉnh cây sẽ ẩn edit dock để Chi tiết thiết kế không che bảng cây.
- Giữ vùng chọn và dữ liệu board; đóng bảng cây rồi chọn card vẫn mở thiết kế bình thường.
- Thêm smoke riêng cho chọn card → mở cây → kích hoạt thiết kế khi cây đang mở → đóng/Escape → chọn lại card. Chạy trong `client/`: `SMOKE_SCENARIO=tree-panel npm run test:smoke`.
- Smoke mới đã đỏ trước fix với lỗi `dock Chi tiết thiết kế vẫn che bảng Xếp cây`, xanh sau fix. Unit 713/713 và production build đạt.
- Playwright trên board fixture xác nhận desktop 1280×900 không còn dock chồng, thanh khoảng cách hoạt động, nút đóng và chọn card khác hoạt động. Ở 375×667, bảng cây rộng 220px tại x=143 nằm trong màn hình. Console không có error; API fixture trả thành công.

## File chính

- `client/src/pages/IdeaMap.jsx`: ưu tiên `treeUI` trong điều kiện hiển thị dock.
- `client/src/__smoke__/entry.jsx`: kịch bản hồi quy chuyển bảng với component thật.
- `client/smoke-run.mjs`: chọn kịch bản tree-panel và fixture Game Design mà không đổi luồng smoke mặc định.

## Khác với plan

Không lệch. Kiểm mobile bằng mở cây trên desktop rồi thu màn hình, vì dock thiết kế hiện có che card ở màn hình hẹp. Escape trên browser được kiểm sau khi focus bảng cây; smoke kiểm sự kiện window trực tiếp.

## Còn dở / cần lưu ý

- Full smoke vẫn thất bại ở lỗi bấm đúp nền có từ trước: `bấm 2 lần phải hoàn tác về 617px, đang ở 784px`. Không xoá hay nới assertion này.
- Build còn cảnh báo bundle trên 500 kB; smoke có cảnh báo React act/Router đã tồn tại.
- Chưa có LSP TypeScript; không cài vì người dùng đã từ chối trước đó.
- Kiểm UI dùng API/socket fixture, không đăng nhập Google hoặc ghi board thật. Ảnh: `/home/chaupt/.cache/tmp/exclusive-tree-panel-desktop.png` và `/home/chaupt/.cache/tmp/exclusive-tree-panel-mobile.png`.
