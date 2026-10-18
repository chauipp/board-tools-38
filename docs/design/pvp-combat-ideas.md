# Ý tưởng đối kháng PvP

## Bối cảnh

Cốt lõi giữ chân người chơi hiện tại là **hệ thống phân chia điểm**: mỗi build có xxx điểm ngân sách, chia vào các chỉ số — Máu, Giáp, giáp phép, Xuyên giáp, xuyên giáp phép , Tấn công, tốc độ chạy, chính xác, né tránh,... 
Phần build đã rõ ràng; phần còn thiếu là **trận PvP diễn ra như thế nào** để đủ hấp dẫn, chứ không chỉ là so hai cột số rồi ra kết quả.


Hai ý tưởng liên quan đã có sẵn trong sa bàn ý tưởng (Bản đồ ý tưởng) nhưng chưa triển khai:
- **Hệ vũ khí (khắc chế vòng tròn)** 
- **Hệ nguyên tố (khắc chế vòng tròn)**: lửa, nuớc, đất ... 
- **Leo hạng / Elo online** — ghi chú kèm theo: chỉ nên thêm sau khi core loop đã vui và có đủ người chơi để ghép trận.

Dưới đây là 2 hướng thiết kế đối kháng khác hẳn nhau, cộng một đề xuất thứ tự triển khai.

## Hướng A — Đối kháng nằm ở khâu chuẩn bị & đọc bài

Trận đấu vẫn được **mô phỏng tự động** (bấm nút ra kết quả ngay, như hiện tại), nhưng thêm **thông tin không hoàn hảo** để việc build không còn là bài toán tối ưu có một đáp án duy nhất.

- **Do thám giới hạn**: trước trận chỉ thấy hệ vũ khí / phe của đối thủ, không thấy số điểm chi tiết trong từng chỉ số → người chơi phải đoán tỉ lệ build dựa trên hệ, không phải soi số trực tiếp.
- **Hệ vũ khí tam giác làm hệ số nhân**: mỗi hệ vũ khí khắc chế/được lợi trên một cặp chỉ số nhất định (ví dụ hệ này nhân sát thương xuyên giáp, hệ kia nhân giáp...) → không còn build "bá" tuyệt đối, vì build tối ưu phụ thuộc vào việc đoán đúng hệ đối thủ đang dùng.
- **Đấu Bo3 có "học giữa hiệp"**: sau hiệp 1, người chơi được đảo một phần nhỏ điểm (ví dụ ~10%) dựa trên thông tin vừa lộ ra ở hiệp đó → biến một cú bấm nút thành một trận có nhịp điệu và có thích nghi, mà vẫn không cần thao tác tay theo thời gian thực.
- **Leo hạng + chuỗi thắng công khai**: tận dụng ý tưởng Elo đã có, thêm yếu tố khoe (streak, bảng xếp hạng theo mùa) để tạo động lực quay lại, không chỉ để ghép trận công bằng.

**Ưu điểm**: chi phí phát triển thấp, đúng tinh thần "core loop nhẹ" đã ghi chú trong sa bàn.
**Nhược điểm**: độ "đã tay" thấp hơn — hấp dẫn kiểu cờ vua/đặt cược hơn là kiểu hành động.

## Hướng B — Đối kháng nằm ngay trong trận

Build từ ngân sách điểm chỉ quyết định **nền** (sát thương gốc, máu, giáp). Ai thắng còn phụ thuộc vào lựa chọn theo lượt: mỗi lượt cả hai bên chọn ngầm 1 trong 3 hành động (Đánh thường / Chiêu / Phòng thủ), sau đó lộ ra cùng lúc — tạo một lớp tương tự "oẳn tù tì có trạng thái", nhưng áp dụng cho hành động thay vì hệ vũ khí tĩnh.

**Ưu điểm**: cảm giác "đấu" thật hơn hẳn, có kỹ năng thực sự trong trận.
**Nhược điểm**: tốn nhiều công phát triển hơn (UI theo lượt, cân bằng hành động, animation) — lệch khỏi hướng công cụ nhẹ đang xây hiện tại.

## Đề xuất

Làm **Hướng A trước**: do thám giới hạn + hệ vũ khí tam giác làm hệ số nhân + Bo3 học giữa hiệp. Lý do:
1. Tận dụng đúng 2 ý tưởng đã có sẵn trong sa bàn mà chưa triển khai.
2. Chi phí thấp, validate được core loop có vui không trước khi đầu tư vào Hướng B.
3. Ghi chú Elo hiện có ("chỉ thêm sau khi core loop vui") cũng ủng hộ thứ tự này.

Nên thiết kế Hướng A theo cách để sau này có thể gắn thêm lớp thao tác của Hướng B (ví dụ: mỗi hiệp trong Bo3 sau này thay bằng một lượt thao tác thật) mà không phải làm lại từ đầu.
