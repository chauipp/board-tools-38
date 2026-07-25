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

Kéo dấu 6 chấm ra khỏi filterbar → panel thành nổi. Thả **trở lại trong filterbar** → neo lại.
Không có vùng thả (drop zone) vẽ riêng: chính filterbar là vùng thả, và nó luôn nhìn thấy được.

Cờ ngang/dọc **lưu độc lập** với neo/nổi — click dấu 6 chấm là xoay, bất kể panel đang ở đâu,
và cờ đó theo panel khi kéo ra. Nhưng hướng dọc chỉ **áp dụng khi panel nổi**: panel neo trải
hết chiều ngang bar, xếp dọc chỉ làm bar cao vống lên với mỗi chip một dòng. Không tự động
ghép hai thứ (kiểu "nổi thì tự thành dọc") vì người dùng có thể muốn một panel dọc dựng ở mép
phải trong khi hai panel kia vẫn ngang trong bar.

## Snap = hút vào mép khung nhìn

`snapToEdges` kẹp panel trong khung nhìn rồi hút vào mép nếu đã đủ gần (24px). Đó là toàn
bộ cơ chế "kéo tới đúng chỗ thì dính": mép trái, mép phải, mép trên, mép dưới, cộng với
filterbar để neo lại. Không làm lưới snap, không làm panel hút vào nhau — chưa yêu cầu, và
mỗi vùng hút thêm là một chỗ panel "nhảy" ngoài ý muốn.

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
