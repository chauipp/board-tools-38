# Dây nối mềm, tránh card

[Spec](../specs/2026-10-19-smooth-connectors-design.md) · [Plan](../plans/2026-10-19-smooth-connectors.md)

## Đã làm gì

- Dây nối ra/vào giữa cạnh phù hợp bằng đường cong, không xuyên dưới các card cùng cột ở bố cục nhiều nhánh hẹp.
- Tuyến bị card chắn được đi vòng và bo góc; group nền không chặn dây, group đầu nối bỏ qua các card thành viên bên trong.
- Vùng bấm, quét chọn, tay cầm, nhãn và PNG dùng chung hình học; nét vẽ tay giữ tuyến và điểm neo.
- Lia/thu phóng không tính lại tuyến khi card không đổi; broad-phase loại card ở xa trước kiểm giao chi tiết.
- Kiểm browser thật ở bốn hướng, card cản, group, mobile375×667, nét tay, thao tác chọn/sửa/kéo và PNG; 713/713 unit test và build đạt.

## File chính

- `client/src/lib/edge-routing.js`: tạo cubic, tuyến đi vòng bo góc, chiều dài/nhãn và giao marquee; test hồi quy bên cạnh.
- `client/src/components/EdgeLayer.jsx`: vẽ đường cong và vùng bấm cùng tuyến, giữ màu/quan hệ/mũi tên.
- `client/src/pages/IdeaMap.jsx`: memo tuyến theo hình học, đồng bộ marquee và tay cầm.
- `client/src/lib/png-export.js`: xuất cùng tuyến và mở bounds cho phần đường vòng.
- `client/src/lib/sketchy.js`: rung nhẹ control point, giữ đầu neo; test kiểm ổn định seed và hai lượt nét.
- `client/src/__smoke__/entry.jsx`: kiểm đường path thay line, giữ hành vi resize/chọn/sửa và tăng kiểm bật/tắt skin.
- `client/src/styles/idea-map.css`: bo đầu/góc nét nối.

## Khác với plan

Thêm broad-phase và lọc vật cản tăng dần sau khi review phát hiện cap toàn bộ card sẽ tắt tránh cản trên board lớn. Một test đỏ/xanh riêng kiểm 100 card xa không ảnh hưởng tuyến vòng card gần. Đo fixture100 card/99 dây: lượt ấm giảm khoảng374–414ms xuống66–74ms; không coi đây là đảm bảo hiệu năng mọi board.

## Còn dở / cần lưu ý

- Smoke vẫn dừng ở lỗi bấm đúp nền hoàn tác: mong617px nhưng784px. Đã tái hiện giống hệt trước sửa, không bỏ qua/giảm assertion; ghi ở log `wire-baseline-smoke.log` và `wire-final-smoke.log` trong cache tạm.
- Hình học chồng lấn/điểm neo bị bịt kín hoặc hơn48 vật cản thực sự tham gia tuyến vòng dùng cubic fallback ổn định; không đảm bảo tránh che khi không có tuyến khả thi hoặc vượt ngưỡng tìm kiếm. Dây nháp chưa có đích giữ dạng hiện tại.
- Không có JS/CSS LSP trong môi trường (người dùng đã từ chối cài); xác minh qua test, build và browser. Build còn cảnh báo bundle lớn có sẵn.
- Bằng chứng: `/home/chaupt/.cache/tmp/wire-final-dark.png`, `wire-mobile.png`, `wire-sketch.png`, `wire-group.png`, `wire-png.png`; nhật ký `/home/chaupt/.cache/tmp/ulw-wire-20261019.aa4on8.md`. Browser test dùng fixture API/socket trong bộ nhớ, không ghi board thật.
- Commit triển khai: `2a89c5c Add smooth obstacle-aware card connectors`. Chưa push.
