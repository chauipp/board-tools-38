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
   đều ghi vào board và đều bị khoá với viewer; laser thì không. Nhét nó vào khu
   2 là phải bịa ngoại lệ cho cả hai thứ đó, và bịa thêm một ngoại lệ nữa cho
   `penPrefs` — laser có bảng độ đậm riêng, đơn vị khác hẳn (xem dưới).

## Hành vi

- **Bật bằng nút Laser ở khu 1** (cạnh Chuột và Sửa) hoặc phím `K` — chữ cái
  Excalidraw dùng. Bấm/bấm phím lần nữa là tắt: laser là thứ bật lên trong dăm
  câu nói rồi tắt, khác bút (chọn xong vẽ cả buổi), nên nó cần phím bật/tắt chứ
  không phải phím chọn.
- **Phải giữ chuột trái** thì vệt mới sáng, đúng như cầm cây laser thật phải
  bấm. Rê chuột không giữ nút thì không để lại gì — nhờ vậy vừa đọc nội dung
  bảng vừa để laser bật sẵn cũng không rắc vệt lên màn hình mọi người.
- **Một lần bấm là một vệt.** Thả ra rồi bấm lại ở chỗ khác thì bắt đầu vệt mới,
  không nối vào vệt cũ — nối thì có một vạch thẳng băng qua bảng đúng chỗ người
  ta không hề rê chuột.
- **Vệt tan từ đuôi.** Mỗi điểm sống 900ms rồi rụng. Đứng yên một nhịp là vệt
  rút về con trỏ rồi biến mất hẳn.
- **Vệt thon dần**: nhọn ở đuôi, rộng ở đầu, cộng một chấm sáng đúng chỗ con trỏ.
- **Chọn được màu và độ đậm**, ở khu 4 như bút. Bảy màu dùng lại đúng bảng của
  bút (`PEN_COLORS` — người dùng đã quen nó); ba độ đậm là bảng RIÊNG vì đơn vị
  khác hẳn: pixel màn hình chứ không phải đơn vị canvas. Lựa chọn nhớ qua lần mở
  sau, ở một khoá localStorage riêng — dùng chung ô `w` với bút là đổi độ đậm
  laser sẽ đổi luôn độ dày nét bút.
- **Màu đi theo người chỉ.** Kiểu vệt nằm trong gói mạng nên người khác thấy đúng
  màu mình chọn, không phải màu con trỏ băm từ email. Đổi lại: mặc định của mọi
  người đều là đỏ, nên muốn hai người phân biệt được nhau thì phải tự chọn.
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

### Kiểu vệt đi kèm MỌI gói, không chỉ gói đầu

`live:ink` chỉ gửi màu/độ dày ở gói `seq: 0` để giữ gói nhẹ, và làm được vì kênh
đó KHÔNG `.volatile` — gói đầu chắc chắn tới nơi. Kênh laser thì `.volatile`, nên
gói đầu rơi được, và nếu chỉ nó mang kiểu vệt thì rơi nó là cả lượt chỉ đó mất
màu. Lặp lại hai field nhỏ 25 lần/giây rẻ hơn nhiều so với việc phải làm gói đầu
tin cậy. Phần thưởng kèm theo: đổi màu giữa lượt là vệt đổi màu ngay.

### Lọc kiểu vệt HAI lần

Server không import được `PEN_COLORS`/`LASER_WIDTHS` của client nên chỉ chặn được
"chuỗi ngắn" và "số trong biên độ" — mà `w = 63` lọt qua biên độ đó vẫn là một
vệt phủ ngang màn hình cả phòng, và một token màu lạ làm vệt mất màu hẳn
(`var(--gì-đó)` không tồn tại). `sanitizeLaserStyle()` bên client lọc lần hai,
nơi mới biết đâu là token thật.

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

- Không có kiểu "vệt ở lại cho tới khi bấm xoá". Đó là bút, đã có sẵn.
- Không ẩn con trỏ chuột ở mode Laser. Vệt tan hết sau chưa tới một giây, nên
  người dừng tay một nhịp mà không có con trỏ sẽ mất dấu chuột hoàn toàn.

## Plan thực thi

[`docs/superpowers/plans/2026-07-28-idea-map-laser-pointer.md`](../plans/2026-07-28-idea-map-laser-pointer.md)
