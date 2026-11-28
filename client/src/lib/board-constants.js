// Hằng số cấp module của bảng ý tưởng (trước nằm đầu pages/IdeaMap.jsx).

export const CARD_W = 210;
// Cỡ nhỏ nhất của một cái khung. Dùng chung cho cả tay cầm kéo giãn LẪN cú tô ra
// khung mới — tô được một cái khung 70x60 rồi kéo giãn không thu lại được nữa là
// hai luật đá nhau; và khung bé hơn thế thì nút ×, tiêu đề, bốn dấu + chồng chất
// lên nhau, không bấm trúng cái nào.
// Di dưới ngưỡng này (đơn vị toạ độ canvas) thì cú bấm lên text được hiểu là
// "mở ra sửa" chứ không phải "kéo đi". Đủ rộng để tay run không thành cú kéo,
// đủ hẹp để một cú kéo thật không bị nuốt thành cú bấm.
export const TEXT_DRAG_THRESHOLD = 3;
// Nới vùng cầm của hộp bao vùng chọn ra ngoài mép, tính bằng pixel MÀN HÌNH
// (chia cho scale trước khi so). Nhắm cho trúng một đường viền 1px là việc không
// ai làm nổi, và mép chính là chỗ tay hay đặt vào nhất.
export const SEL_GRAB_PAD = 6;
// Đích thả màu "cả vùng chọn". Object hằng dùng chung: dựng mới ở mỗi nhịp chuột
// thì mọi thẻ trên bảng render lại theo (dropTargetId là prop của IdeaCard).
export const SELECTION_DROP = { kind: "selection", id: null };
// Ngưỡng chạm khi bấm chọn nét vẽ / hình / chữ, tính bằng đơn vị canvas. Rộng
// hơn cục gôm một chút: gôm là việc quét cả một vùng nên bắt hụt còn quét lại
// được, còn bấm chọn mà trượt thì mất cả vùng chọn, phải gom lại từ đầu.
export const PICK_RADIUS = 6;
export const MIN_GROUP_W = 160, MIN_GROUP_H = 120;
export const MIN_SCALE = 0.3, MAX_SCALE = 2.4;

// Ba panel LỌC ở thanh đáy. Giao diện không nằm đây: nó là thiết lập, và nó bung
// ra ngay dưới nút của mình trên đảo trên trái.
// Liệt kê ra một chỗ để "có panel nào đang bật không" không phải viết tay ba
// phép hoặc là một Object.keys trên state.
export const PANEL_KEYS = ["status", "tag", "palette"];

// Tuỳ chọn khởi điểm của bảng Xếp cây. depth 110 (chứ không 70 như hướng ngang)
// vì hướng dọc lấy CHIỀU CAO thẻ làm khoảng cách tầng — xem ghi chú trong
// arrangeAsTree. breadth và leaf dùng chung khoảng cách card cùng cấp.
export const TREE_OPTS = { directions: ["down"], depth: 110, breadth: 56, leaf: 56 };
export const EMPTY_ARRAY = [];
export const EMPTY_MAP = new Map();
export const EMPTY_SET = new Set();
