# Idea Map: panel kéo-thả đặt vị trí tự do

## Bối cảnh

Giai đoạn 1 ([spec](2026-07-25-idea-map-color-palette-design.md)) biến filterbar thành ba
panel bật-tắt nằm cố định thành hàng: Trạng thái, Nhãn, Bảng màu. Yêu cầu giai đoạn 2:

1. Mỗi panel có **dấu 6 chấm** để kéo, đặt được ở vị trí bất kì.
2. **Click** vào dấu 6 chấm → xoay ngang / dọc.
3. Kéo tới **đúng chỗ** thì panel nhảy và dính vào đó (snap).

## Hai trạng thái, không nhiều hơn

Mỗi panel ở một trong hai trạng thái:

- **Neo (mặc định)** — nằm trong filterbar như hiện tại, xếp hàng theo thứ tự cố định.
- **Nổi** — `position: fixed` tại `{x, y}`, có nền + viền + shadow riêng.

Kéo dấu 6 chấm ra khỏi filterbar → panel thành nổi. Thả **lên hàng nút** (Trạng thái · Nhãn ·
Bảng màu) → neo lại. Hàng nút **luôn hiện**, kể cả khi cả ba panel đều nổi, nên luôn có một
chỗ để kéo panel về. Trong lúc kéo, hàng nút sáng lên khi con trỏ vào tới — không có phản hồi
đó thì người dùng phải đoán vùng thả ở đâu.

Vùng thả là **hàng nút**, không phải cả filterbar. Lấy cả bar thì nó nuốt đúng dải mà người
dùng muốn đặt panel nổi thẳng hàng với panel đang neo — mọi lần thả ở đó đều thành neo lại,
và căn hàng ở dải đó không bao giờ xảy ra được.

## Panel neo chảy cùng một hàng

Các panel neo nằm trong **một hàng** `flex-wrap: wrap`, không phải mỗi panel một dòng. Bật
panel thứ ba thì nó vào chỗ trống bên phải panel thứ hai, chỉ xuống dòng khi hết chiều ngang.
Mỗi panel một dòng thì bật cả ba là bar cao ba tầng và canvas bị đẩy xuống tương ứng.

Hàng này chỉ vẽ đường kẻ phân cách khi **còn panel neo**. Panel nổi vẫn render trong hàng
nhưng `position: fixed` nên không tính vào chiều cao — cả ba panel nổi thì hàng cao 0 và biến
mất, không để lại đường kẻ mồ côi.

Panel nổi khi bật lại thì hiện đúng vị trí đã lưu — đó chính là điểm của việc lưu vị trí. Không
tự tìm chỗ trống cho panel nổi.

Cờ ngang/dọc **lưu độc lập** với neo/nổi — click dấu 6 chấm là xoay, bất kể panel đang ở đâu,
và cờ đó theo panel khi kéo ra. Nhưng hướng dọc chỉ **áp dụng khi panel nổi**: panel neo trải
hết chiều ngang bar, xếp dọc chỉ làm bar cao vống lên với mỗi chip một dòng. Không tự động
ghép hai thứ (kiểu "nổi thì tự thành dọc") vì người dùng có thể muốn một panel dọc dựng ở mép
phải trong khi hai panel kia vẫn ngang trong bar.

## Snap: mép khung nhìn + căn hàng với panel khác

Hai lớp hút, ngưỡng 24px:

1. **Mép khung nhìn** — trái / phải / trên / dưới.
2. **Căn hàng với các panel khác** — tái dùng `computeSnap` của kéo thẻ
   ([`lib/snap.js`](../../../game-tools/client/src/lib/snap.js)): mốc trái/giữa/phải trên trục
   ngang, trên/giữa/dưới trên trục dọc, chọn cặp lệch ít nhất. Panel neo cũng là mốc, nên kéo
   một panel nổi tới ngang hàng với panel đang neo là nó dính vào đúng hàng.

Thứ tự: hút mép **trước**, căn hàng **sau**, và bước cuối chỉ kẹp trong khung nhìn chứ không
hút mép lần nữa. Nếu hút mép chạy sau thì một panel vừa căn thẳng hàng ở cách mép 20px sẽ bị
mép giật ra khỏi hàng — căn hàng phải thắng.

`computeSnap` trả sẵn guide; vẽ bằng div `position: fixed` 1px trong lúc kéo, xoá khi thả.
Không có guide thì snap đọc như "panel tự nhảy" chứ không như "nó dính vào cái kia".

Không làm lưới snap, không cho panel hút dính cạnh-kề-cạnh với nhau — mỗi vùng hút thêm là
một chỗ panel nhảy ngoài ý muốn.

Kẹp trong khung nhìn là bắt buộc, không phải tính năng phụ: panel thả ra ngoài mép là panel
không lấy lại được.

## Lưu vị trí ở localStorage, không lưu vào board

Board là dữ liệu **dùng chung** giữa nhiều người — vị trí panel của tôi không phải là thứ
người khác phải nhận. Vị trí + hướng + trạng thái nổi lưu ở `localStorage` theo key
`idea-map-panel-layout`, nên không cần đổi gì ở server.

Trạng thái **mở/đóng** panel vẫn không lưu (giữ nguyên quyết định giai đoạn 1): mở panel là
hành động trong một lượt làm việc, còn vị trí là cách bố trí bàn làm việc.

Giá trị hỏng trong localStorage phải lùi về mặc định từng key, không được làm trắng trang.

## Ngoài phạm vi

- **Không** cho panel hút/dính vào nhau, không lưới snap.
- **Không** cho kéo panel khác (bulk-bar, mục lục, zoom) — chỉ ba panel của filterbar.
- **Không** đổi cỡ panel bằng kéo.
- **Không** đồng bộ vị trí panel giữa nhiều máy.
