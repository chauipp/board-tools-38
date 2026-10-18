# Idea Map: panel kéo-thả đặt vị trí tự do

## Bối cảnh

Giai đoạn 1 ([spec](2026-07-25-idea-map-color-palette-design.md)) biến filterbar thành ba
panel bật-tắt nằm cố định thành hàng: Trạng thái, Nhãn, Bảng màu. Yêu cầu giai đoạn 2:

1. Mỗi panel có **dấu 6 chấm** để kéo, đặt được ở vị trí bất kì.
2. **Click** vào dấu 6 chấm → xoay ngang / dọc.
3. Kéo tới **đúng chỗ** thì panel nhảy và dính vào đó (snap).

## Hai trạng thái, không nhiều hơn

Mỗi panel ở một trong hai trạng thái:

- **Neo (mặc định)** — nằm trong **khay neo**, dải ngay dưới hàng nút.
- **Nổi** — `position: fixed` tại `{x, y}`, có nền + viền + shadow + tiêu đề riêng.

Kéo dấu 6 chấm ra khỏi khay → panel thành nổi. Thả **vào khay** → neo lại.

## Khay neo: luôn hiện, và là vùng thả duy nhất

Khay **luôn giữ chỗ**, kể cả khi rỗng (viền nét đứt để đọc ra là "ném panel vào đây"), và
trong lúc kéo thì sáng lên khi con trỏ vào tới. Ba lý do, theo thứ tự quan trọng:

1. **Panel vừa bật luôn có dải riêng của nó.** Không giữ chỗ thì panel nổi đậu ngay dưới hàng
   nút sẽ che mất panel vừa neo vào — người dùng bật Bảng màu và thấy như nó không hiện.
2. **Luôn có chỗ để kéo panel về.** Cả ba panel nổi hết thì vẫn còn khay rỗng làm đích.
3. **Hết nhập nhằng "đậu nổi ở đây" với "neo vào đây".** Trong khay là neo, ngoài khay là nổi.
   Đó cũng là lý do vùng thả là khay chứ không phải cả filterbar (hàng nút phải bấm được) và
   không phải hàng nút (thả gần bar nào cũng thành neo thì căn hàng với panel neo mất luôn).

## Panel neo chảy cùng một hàng

Panel neo xếp trong khay theo `flex-wrap: wrap`, không phải mỗi panel một dòng. Bật panel thứ
ba thì nó vào chỗ trống bên phải panel thứ hai, chỉ xuống dòng khi hết chiều ngang. Mỗi panel
một dòng thì bật cả ba là bar cao ba tầng và canvas bị đẩy xuống tương ứng.

Panel nổi vẫn render bên trong khay nhưng `position: fixed` nên không tính vào chiều cao khay.

Panel nổi khi bật lại thì hiện đúng vị trí đã lưu — đó chính là điểm của việc lưu vị trí. Không
tự tìm chỗ trống cho panel nổi.

Cờ ngang/dọc **lưu độc lập** với neo/nổi — click dấu 6 chấm là xoay, bất kể panel đang ở đâu,
và cờ đó theo panel khi kéo ra. Nhưng hướng dọc chỉ **áp dụng khi panel nổi**: panel neo dùng
chung một hàng với các panel neo khác, xếp dọc một cái là cả hàng cao theo nó và đẩy canvas
xuống. Không tự động ghép hai thứ (kiểu "nổi thì tự thành dọc") vì người dùng có thể muốn một
panel dọc dựng ở mép phải trong khi hai panel kia vẫn ngang trong khay.

## Panel nổi không được che bar, một chút cũng không

Panel nổi bị kẹp trong **hình chữ nhật vùng vẽ**, không phải trong cửa sổ. Nên panel chỉ còn
hai chỗ hợp lệ: **dính sát mép ngoài bar**, hoặc **vào thẳng trong khay**. Không có trạng thái
thứ ba là "đè lên bar một phần".

Kẹp theo vùng vẽ là chặn ở gốc, không phải đi dò từng ca chồng lấn: không có nhánh nào cần
kiểm "panel có đang đè bar không" vì vị trí đè bar không bao giờ tính ra được.

Hệ quả có ý thức: **không còn căn ngang hàng được với panel neo**, vì dải đó chính là bar.
Kéo tới đó thì panel dính vào mép trên vùng vẽ, ngay dưới bar. Yêu cầu "không che một chút
nào" mạnh hơn tiện lợi của việc căn hàng đó.

Vị trí đọc từ `localStorage` được **kẹp lại khi mount và mỗi lần đổi cỡ cửa sổ** — chỉ kẹp,
không hút mép, để không tự dịch một vị trí vẫn hợp lệ mà người dùng đã đặt. Không có bước này
thì vị trí lưu từ phiên cũ (hoặc cửa sổ vừa thu nhỏ) vẫn hiện ra đè lên bar.

## Snap: mép vùng vẽ + căn hàng với panel khác

Hai lớp hút, ngưỡng 24px:

1. **Mép vùng vẽ** — trái / phải / trên / dưới.
2. **Căn hàng với các panel khác** — tái dùng `computeSnap` của kéo thẻ
   ([`lib/snap.js`](../../../game-tools/client/src/lib/snap.js)): mốc trái/giữa/phải trên trục
   ngang, trên/giữa/dưới trên trục dọc, chọn cặp lệch ít nhất. Panel neo vẫn là mốc, nhưng chỉ
   mốc trục ngang dùng được — mốc trục dọc của nó nằm trong bar nên kẹp luôn thắng.

Thứ tự: hút mép **trước**, căn hàng **sau**, và bước cuối chỉ kẹp trong khung nhìn chứ không
hút mép lần nữa. Nếu hút mép chạy sau thì một panel vừa căn thẳng hàng ở cách mép 20px sẽ bị
mép giật ra khỏi hàng — căn hàng phải thắng.

`computeSnap` trả sẵn guide; vẽ bằng div `position: fixed` 1px trong lúc kéo, xoá khi thả.
Không có guide thì snap đọc như "panel tự nhảy" chứ không như "nó dính vào cái kia".

Không làm lưới snap, không cho panel hút dính cạnh-kề-cạnh với nhau — mỗi vùng hút thêm là
một chỗ panel nhảy ngoài ý muốn.

Kẹp là bắt buộc, không phải tính năng phụ: panel thả ra ngoài mép là panel không lấy lại được.

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
