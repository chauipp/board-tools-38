# Khóa bố cục tự động theo cây

[Spec](../specs/2026-10-19-tree-layout-lock-design.md) · [Plan](../plans/2026-10-19-tree-layout-lock.md)

## Đã làm gì

- Thêm công tắc Khóa bố cục tự động trong Xếp cây, cùng nhãn Tự xếp trên gốc.
- Thêm card bằng nút cộng ở bất kỳ phía nào hoặc phím Enter đều theo hướng cây đã lưu; tự xếp lại sau khi đo kích thước thật, xóa hoặc thay quan hệ.
- Chặn kéo gốc/con, kéo theo vùng chọn, Alt-kéo và phím mũi tên; tắt khóa khôi phục kéo tự do.
- Lưu độc lập từng cây; mở panel tại hậu duệ đang khóa sẽ chỉnh đúng gốc sở hữu. Giữ cấu hình khi tải lại và undo/redo.
- Cố định thành viên khung trước khi xem trước/xếp để khung di chuyển phủ lên cây khác không nhận nhầm card của cây đó.
- Đã diễn lại các thao tác trên trình duyệt với cả board tư duy và Game Design; kiểm màn hình 375×667, sáng/tối và console/network.
- Đã tích hợp fast-forward về main, kiểm lại 682 test và build; server đang chạy ở cổng 7155 đã phục vụ mã tính năng mới qua kiểm tra HTTP chỉ đọc.

## File chính

- `client/src/lib/locked-tree.js`: chuẩn hóa cấu hình, xác định cây sở hữu và áp bố cục với membership khung ổn định.
- `client/src/lib/locked-tree.test.js`: regression hướng cây, thêm/xóa, chu trình, khung, nhiều cây và lỗi nhận nhầm thành viên qua nhiều lượt reflow.
- `client/src/pages/IdeaMap.jsx`: tích hợp lưu/xem trước/đo kích thước, điều khiển khóa và chặn thao tác di chuyển.
- `client/src/components/TreePanel.jsx`: công tắc và mô tả chế độ tự xếp.
- `client/src/components/IdeaCard.jsx`: nhãn Tự xếp và trạng thái card chịu khóa bố cục.
- `client/src/styles/idea-map.css`: hiển thị công tắc và nhãn theo theme hiện có.

## Khác với plan

Bổ sung snapshot `groupMembers` sau khi review tái hiện được khung dịch chuyển phủ lên cây khác rồi nhận nhầm ownership. Điều chỉnh camera thêm card theo tọa độ cuối sau khi xếp, thay vì vị trí đặt tự do ban đầu.

## Còn dở / cần lưu ý

- Client 682/682 test và server 129/129 test đạt; build đạt với cảnh báo bundle lớn đã có.
- Smoke toàn editor vẫn lỗi bấm đúp nền: mong rộng 617px, thực tế 784px. Đã tái hiện cùng lỗi trên main trước thay đổi; không sửa hoặc bỏ qua test.
- Máy thiếu TypeScript/Biome language server nên chưa có LSP diagnostics; dùng build và test thực thi để kiểm.
- Kiểm trình duyệt dùng API/socket fixture trong bộ nhớ để không chỉnh dữ liệu thật; đã kiểm hình học, thao tác, lưu/tải lại và undo/redo qua editor thật.
- Bằng chứng: `/home/chaupt/.cache/tmp/tree-lock-dark.png`, `tree-lock-mobile.png`, `tree-lock-group-isolation.png`, `tree-lock-game-design.png`; nhật ký `/home/chaupt/.cache/tmp/ulw-20261019.r3ZduI.md`.
