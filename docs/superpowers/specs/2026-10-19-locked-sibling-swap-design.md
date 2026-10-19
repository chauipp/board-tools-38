# Đổi chỗ nhánh cùng cấp khi khóa bố cục

Kéo một card lên card khác có cùng cha trong cây tự xếp để hoán đổi ô bố cục. Cùng hướng: đổi thứ tự. Khác hướng: đổi cả hướng và thứ tự. Cây con đi theo, cha và dây nối giữ nguyên. Chỉ bắt đầu khi kéo quá 5px; nhấn chọn vẫn bình thường.

Thả vùng trống, card khác cha, cây khác, gốc, hoặc card khóa thủ công không thay đổi board. Escape/hủy cửa sổ hủy thao tác. Nguồn và đích được đánh dấu trong khi kéo; không cho kéo tự do hoặc nhân bản bằng Alt trong cây tự xếp.

Lưu thứ tự con theo khóa endpoint và hướng nhánh gốc trong treeLayoutLock. Dữ liệu cũ giữ thuật toán chia nhánh mặc định; lần hoán đổi đầu chụp đầy đủ slot hiện tại rồi hoán đổi. Không đổi mảng edges để tránh làm thay đổi BFS và quan hệ phụ thuộc ngoài ý muốn. Mỗi drop hợp lệ tạo đúng một undo entry, lưu qua luồng commitAndSave hiện có. Thêm/xóa card và đổi khoảng cách giữ slot đã chọn; slot không còn hợp lệ bị bỏ qua. Group cùng cấp được hỗ trợ theo mô hình endpoint sẵn có, giữ snapshot thành viên.

Kiểm unit: đổi cùng phía, khác phía trọng số khác nhau, nhánh sâu, khóa thủ công, khác cha/cây, malformed metadata, reload/idempotence, thêm/xóa. Kiểm trình duyệt thật qua editor React trên cổng QA7156 với board trong bộ nhớ, không ghi dữ liệu thật; gồm kéo/thả, hủy, reload, undo/redo, dấu cộng, mobile, console/network.

## Plan thực thi
[Plan](../plans/2026-10-19-locked-sibling-swap.md)

## Kết quả
[Summary](../summaries/2026-10-19-locked-sibling-swap-summary.md)
