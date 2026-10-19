# Dây nối mềm và không bị card che

## Mục tiêu

Dây nối trên board phải mềm mại, đi từ cạnh phù hợp của card và không xuyên dưới các card cùng cột như ảnh người dùng. Không thay đổi vị trí card, topology hoặc dữ liệu đã lưu.

## Thiết kế

Một bộ hình học thuần dùng chung trả về SVG path, hai đầu neo, mẫu điểm, nhãn giữa chiều dài và tiếp tuyến cuối. Ưu tiên cubic nối các cạnh đối diện; nếu gặp card khác, tìm tuyến vuông góc tránh vật cản rồi bo góc. Frame nền không phải vật cản; card nằm trong group đầu nối không chặn chính group ấy. Hình học chồng lấn hoặc không có tuyến phải trả kết quả hữu hạn, ổn định.

EdgeLayer vẽ cả nét và vùng bấm theo cùng tuyến. IdeaMap dùng tuyến này cho tay cầm và marquee. PNG dùng cùng đường cong và tính bounds có cả đường vòng. Nét vẽ tay chỉ rung nhẹ điểm điều khiển, không đổi đầu neo hoặc tuyến cơ sở. Dây nháp chưa có đích vẫn giữ preview hiện có.

## Kiểm chứng

- Fixture editor thật: root x160, children x440, gap70; baseline bốn dây xuyên card. Sau sửa tất cả bảy dây không có điểm nằm trong card không liên quan.
- Kiểm các hướng trái/phải/trên/dưới, vật cản độc lập, group và overlap; unit test kiểm hình học, browser lấy mẫu trực tiếp SVG.
- Bấm, menu, tay cầm, marquee, resize/di chuyển và PNG khớp tuyến. Kiểm mobile375×667, sketch, console/network; full client/build/smoke.

## Giới hạn

Không sắp lại card, không sửa auth/API/schema. Không thể đảm bảo lộ dây khi chính card đè nhau hoặc che kín điểm neo; fallback phải ổn định, không treo.

## Plan thực thi

[Plan](../plans/2026-10-19-smooth-connectors.md) · [Kết quả](../summaries/2026-10-19-smooth-connectors-summary.md)
