# Thiết kế — Bút laser

Ngày: 2026-07-28
Nhánh: `idea-map-laser-pointer` (từ `idea-map-hud-islands`)

## Vấn đề

Bảng đã trình chiếu được (mode trình chiếu, ←/→ chuyển khung, Esc thoát) và đã
có mặt nhiều người cùng lúc, nhưng lúc đang nói thì không có cách nào **chỉ vào
một chỗ**. Con trỏ của mình có hiện trên màn hình người khác (`peer-cursor`),
nhưng nó là một mũi tên bé xíu không có vệt — người nghe không kịp bắt mắt nó
đang di chuyển đi đâu.

Cả Excalidraw lẫn Miro đều giải bằng cùng một thứ: **bút laser** — một vệt sáng
chạy theo con trỏ rồi tự tan sau chưa tới một giây.

## Cái laser KHÔNG phải là gì

Đây là quyết định gốc, mọi thứ còn lại chảy ra từ nó: **laser không ghi gì vào
board**. Nó không nằm trong `drawings`, không có `id`, không tạo bước hoàn tác,
không gây một lần `PUT` nào. Nó gần với `cursor:move` hơn là với nét bút.

Ba hệ quả trực tiếp:

1. **Người chỉ xem (viewer) được dùng.** Bút, cục gôm, hình khối, text đều bị
   khoá với viewer vì chúng ghi dữ liệu; laser thì không, mà người được mời vào
   họp để nghe lại chính là người hay phải chỉ trỏ nhất.
2. **Server không chặn viewer ở kênh này**, khác hẳn `live:ink`.
3. **Nó là MODE, không phải một tool nữa của mode Sửa.** Mọi tool của mode Sửa
   đều ghi vào board, đều bị khoá với viewer, và đều đi kèm bảng tuỳ chọn ở khu
   4 (màu/độ dày). Laser không cái nào cả — nhét nó vào khu 2 là phải bịa ra
   ngoại lệ cho cả ba thứ đó.

## Hành vi

- **Bật bằng nút Laser ở khu 1** (cạnh Chuột và Sửa) hoặc phím `K` — chữ cái
  Excalidraw dùng. Bấm/bấm phím lần nữa là tắt: laser là thứ bật lên trong dăm
  câu nói rồi tắt, khác bút (chọn xong vẽ cả buổi), nên nó cần phím bật/tắt chứ
  không phải phím chọn.
- **KHÔNG cần giữ nút chuột.** Vệt chạy theo con trỏ ngay khi di. Giữ nút để chỉ
  trỏ là thứ không ai làm nổi trong lúc đang nói — Excalidraw và Miro cũng vậy.
- **Vệt tan từ đuôi.** Mỗi điểm sống 900ms rồi rụng. Đứng yên một nhịp là vệt
  rút về con trỏ rồi biến mất hẳn.
- **Vệt thon dần**: nhọn ở đuôi, rộng ở đầu, cộng một chấm sáng đúng chỗ con trỏ.
- **Mỗi người một màu.** Vệt của mình đỏ; vệt người khác lấy đúng màu con trỏ của
  họ (`cursorColor(email)`), nên hai người cùng chỉ thì biết ai đang chỉ cái nào.
- **`K` vẫn chạy khi đang trình chiếu**, là ngoại lệ duy nhất trong danh sách
  phím tắt bị tắt lúc đó — vì đang trình chiếu mới là lúc cần nó nhất.
- **Vệt nằm trong `.canvas`**, nên nó bám theo bảng khi lia/phóng: chỉ vào một
  cái thẻ thì vệt ở lại đúng cái thẻ đó.
- **Bề rộng vệt tính theo pixel MÀN HÌNH**, không theo đơn vị canvas. Nét bút cố
  ý dày lên khi phóng to ("mực trên giấy"), nhưng laser là cái que chỉ — nó phải
  giữ nguyên cỡ dù bảng đang zoom bao nhiêu.

## Ràng buộc kỹ thuật đáng lưu

### Vệt không được nằm trong state của React

Vệt tan dần theo thời gian nên phải vẽ lại mỗi khung hình suốt 900ms **kể cả khi
con trỏ đã đứng yên**. Nếu nó là state của `IdeaMap` thì mỗi khung hình đó kéo
theo một lượt render toàn bộ thẻ, dây và khung — đúng thứ `PeerLayer.jsx` sinh
ra để tránh, chỉ tệ hơn: 60 lần/giây thay vì 20, và xảy ra đúng lúc người ta
đang thuyết trình.

Nên vệt sống trong một **kho object thường có đăng ký nghe** (`createLaserStore`
trong `useLaser.js`). Chỉ `LaserLayer` nghe nó, nên chỉ `LaserLayer` vẽ lại.
`IdeaMap` không render thêm một lượt nào. Vòng lặp `requestAnimationFrame` cũng
nằm trong `LaserLayer` và **chỉ sống khi còn vệt** — không có vệt thì không có
rAF nào đang chờ.

### Một `<path>` cho một vệt, không phải mấy chục `<line>`

`stroke-width` của SVG là một số duy nhất cho cả đường, nên muốn vệt thon dần thì
hoặc chẻ nó thành mấy chục đoạn mỗi đoạn một bề rộng (mấy chục phần tử DOM cho
mỗi người, vẽ lại 60 lần/giây), hoặc tính **viền ngoài** của vệt rồi tô đặc.
Chọn cách sau: `laserOutline()` trả về chuỗi `d` của một hình kín, và một vệt là
đúng một `<path>` (cộng một `<path>` quầng sáng dùng lại chính chuỗi `d` đó và
một `<circle>` ở đầu).

### Đóng dấu thời gian bằng đồng hồ của NGƯỜI NHẬN

Gói mạng không mang timestamp. Hai máy lệch giờ vài giây là vệt của người kia
hoặc tan ngay lập tức, hoặc không bao giờ tan. Cả lô điểm trong một gói cùng một
mốc — sai số tối đa đúng bằng một nhịp phát (40ms), mắt không thấy.

### Chỉ phát điểm nào THẬT SỰ vào vệt của mình

`pushLaserPoint` chối những điểm quá gần điểm cuối (chống nhiễu run tay và cắt
lưu lượng khi con trỏ gần đứng yên). Nếu vẫn phát chúng thì vệt người khác thấy
sẽ dày điểm hơn vệt mình thấy, và hai bên tan theo hai nhịp khác nhau. Hàm trả
về **chính mảng cũ** khi chối, và `useLaser` so tham chiếu để quyết định có phát
hay không — đây là hợp đồng, có test riêng chốt nó.

### `.volatile` ở server, khác `live:ink`

`live:ink` cố ý không dùng `.volatile` vì gói của nó mang điểm mới thêm của một
nét sẽ được **lưu lại vĩnh viễn** — mất một gói là nét khuyết một khúc và không
bao giờ tự lành. Vệt laser thì biến mất hết sau chưa tới một giây, nên mất một
gói chỉ làm nó thưa điểm đi một khúc rồi thôi. Dùng `.volatile` để mạng tắc thì
bỏ gói cũ thay vì xếp hàng phát bù.

## Phạm vi KHÔNG làm

- Không có tuỳ chọn màu/độ dày cho laser. Màu là danh tính người chỉ, không phải
  lựa chọn thẩm mỹ.
- Không có kiểu "vệt ở lại cho tới khi bấm xoá". Đó là bút, đã có sẵn.
- Không ẩn con trỏ chuột ở mode Laser. Vệt tan hết sau chưa tới một giây, nên
  người dừng tay một nhịp mà không có con trỏ sẽ mất dấu chuột hoàn toàn.

## Plan thực thi

[`docs/superpowers/plans/2026-07-28-idea-map-laser-pointer.md`](../plans/2026-07-28-idea-map-laser-pointer.md)
