# Idea Map: sắp xếp dạng cây theo 4 hướng

## Goal

Từ một thẻ gốc do người dùng chọn, tự động xếp lại toàn bộ thẻ/khung nối
với nó (qua dây nối, đi mấy tầng cũng được) thành hình cây gọn gàng —
thẳng hàng theo tầng, co giãn theo kích thước thẻ thật, không lãng phí
khoảng trống ngang — theo 1 trong 4 hướng do người dùng chọn (xuống / lên
/ phải / trái). Đây là một hành động rời rạc (bấm 1 phát, xong ngay), không
phải chế độ xem hay ràng buộc thường trực.

## Quyết định (từ buổi brainstorm)

- Tính năng **mới, độc lập** — không đụng vào "Xếp gọn" (`tidySelection` /
  `layerLayout`) đã có sẵn, vì hai cái khác nhau: "Xếp gọn" xếp cột
  trái→phải theo tập thẻ đang chọn thủ công, không có khái niệm cha nằm
  giữa các con; tính năng này đi từ **một gốc duy nhất**, tự động kéo theo
  mọi con cháu qua dây nối.
- **Phạm vi**: chỉ thẻ gốc + con cháu của nó (theo dây nối, không phân
  biệt chiều mũi tên) bị xếp lại. Các thẻ khác trên board không đụng tới.
  Thẻ gốc đứng yên tại vị trí hiện tại, làm điểm neo.
- **Kích hoạt**: 4 nút mũi tên (↓ ↑ → ←) trong menu chuột phải của thẻ
  (và của khung) — bấm hướng nào chạy ngay hướng đó, không có bước xác
  nhận thêm.
- **3 tiêu chí tối ưu** (người dùng chọn cả 3): thẳng hàng & khoảng cách
  đều theo tầng; thu gọn khoảng trống ngang thừa (nhánh ít con chiếm ít
  chỗ hơn); co giãn khoảng cách theo kích thước thật của từng thẻ (không
  dùng cỡ cố định).
- Là hành động có thể Undo (Ctrl+Z) như mọi thao tác sửa board khác.

## Hiện trạng (khảo sát trước khi thiết kế)

- `client/src/lib/layout.js` đã có `layerLayout`/`gridLayout` phục vụ nút
  "Xếp gọn" — xếp theo cột (độ sâu = đường đi dài nhất từ 1 nguồn bất kỳ
  trong tập đã chọn), không có centering cha-con, không đi từ 1 gốc.
  Không tái dùng được cho tính năng này, nhưng dùng chung quy ước đo kích
  thước (`frameCardSize`) và cách gọi `commitAndSave`.
- Menu chuột phải của thẻ (`ColorMenu.jsx`, dùng chung cho cả thẻ lẫn
  khung qua prop `kind`) đã có sẵn mẫu "hàng nút icon toggle" (chọn hình
  vuông/elip, viền liền/đứt) — dùng lại đúng kiểu dáng CSS đó cho hàng 4
  nút hướng, chỉ khác là 4 nút này là hành động một-lần (không phải trạng
  thái lưu trên thẻ).
- Dây nối tự vẽ lại theo vị trí thẻ hiện tại mỗi lần render
  (`rectForEndpoint` + `clipToRect` trong `board-geometry.js`) — xếp lại
  vị trí thẻ là dây tự chạy theo, không cần đụng gì đến code vẽ dây.
- Thẻ khoá (`node.locked` / `group.locked`) không bị đổi vị trí bởi các
  hành động hàng loạt khác (`nudgeSelection`, `applyToSelection` đều lọc
  `!n.locked`) — tính năng này giữ đúng quy ước đó.
- `edge.fromKind`/`toKind` có thể là `"node"` hoặc `"group"` — khung cũng
  có thể là một điểm nối, và cây này xử lý node/group như nhau (đều có
  toạ độ x/y, khác nhau ở cách lấy w/h: node đo qua DOM
  `frameCardSize`, group đọc thẳng field `w`/`h` đã lưu).

## Kiến trúc

### A. Dựng cây từ gốc (`buildTree`)

BFS từ thẻ gốc, coi mọi dây nối là hai chiều (không quan tâm mũi tên hiển
thị hay `from`/`to` ai là ai) — miễn có dây là tính quan hệ cha/con. Mỗi
thẻ/khung chỉ được ghé một lần (dùng tập `visited`); nhánh dẫn ngược lại
một thẻ đã ghé (vòng lặp, hoặc thẻ có "2 cha") bị bỏ qua ở bước này —
dây đó vẫn hiển thị trên canvas bình thường, chỉ là không ảnh hưởng tới
việc tính vị trí. Trả về gốc + bản đồ `children` (thẻ nào có những con
nào), đây là dữ liệu thuần, không đụng DOM hay board state.

### B. Tính toạ độ (`treeLayout`)

Tính trên 2 trục trừu tượng trước, rồi mới ánh xạ ra x/y thật theo hướng:

- **Trục "chiều rộng" (breadth)**: vị trí một thẻ trong hàng anh em của
  nó. Tính từ dưới lên (bottom-up): thẻ lá chiếm đúng kích thước của
  chính nó; thẻ có con thì "độ rộng" = lớn hơn giữa (kích thước chính nó)
  và (tổng độ rộng các con + khoảng cách giữa chúng) — nhánh ít con không
  chiếm chỗ thừa. Thẻ cha luôn nằm giữa (căn theo tâm) khối con của nó;
  nếu bản thân cha to hơn tổng các con thì các con được dồn vào giữa dưới
  cha (đối xứng), không bị lệch.
- **Trục "chiều sâu" (depth)**: tầng theo BFS (gốc = tầng 0). Mọi thẻ
  cùng tầng dùng chung một mốc trên trục sâu = tổng (kích thước lớn nhất
  của mỗi tầng trước đó + khoảng cách tầng), nên luôn thẳng hàng theo
  tầng dù các thẻ trong tầng cao thấp/dài ngắn khác nhau.
- **Kích thước dùng cho mỗi trục đổi theo hướng**: hướng dọc (↓/↑) —
  chiều rộng trục breadth dùng **width** thẻ, trục depth dùng **height**
  thẻ (tầng cách nhau theo chiều cao). Hướng ngang (→/←) — ngược lại,
  breadth dùng **height**, depth dùng **width** (giống cách "Xếp gọn"
  đang tính cột theo bề ngang thẻ).
- **Ánh xạ ra hướng thật**: ↓ và → là hướng "xuôi" (trục depth tăng dần
  theo hướng dương); ↑ và ← là ảnh gương của ↓/→ (trục depth tăng dần
  theo hướng âm). Trục breadth không đổi chiều giữa ↓/↑ hay giữa →/←.
- **Neo gốc**: toàn bộ toạ độ được tính trong một hệ quy chiếu tương đối
  trước, xong dịch chuyển (translate) đồng loạt một lần cuối sao cho thẻ
  gốc rơi đúng vào vị trí x/y hiện tại của nó trên board — mọi thẻ khác
  dịch theo cùng một lượng.

Đầu vào của `treeLayout` là dữ liệu thuần (danh sách `edges`, một hàm
`sizeOf(kind, id) => {w, h}` do nơi gọi cung cấp, toạ độ gốc hiện tại) —
không phụ thuộc React state hay DOM, nên test được như hàm thuần túy,
đúng quy ước của `board-geometry.test.js`/`layout.test.js`.

### C. Áp dụng vào board

Hàm `arrangeAsTree(rootKind, rootId, direction)` trong `IdeaMap.jsx`:
đóng gói `sizeOf` (node dùng `frameCardSize`, group đọc `board.groups`),
gọi `treeLayout`, rồi `commitAndSave` với vị trí mới cho từng thẻ/khung —
**bỏ qua** (không ghi đè toạ độ) những thẻ/khung có `locked: true`, dù
chúng vẫn tham gia tính cây để con cháu chúng được xếp đúng chỗ xung
quanh vị trí cố định đó. Người chỉ xem (viewer) không thấy 4 nút hướng
này, giống mọi hành động sửa board khác. Dùng `commitAndSave` sẵn có nên
tự động: vào lịch sử Undo, lưu server, và phát broadcast realtime cho
người xem khác trên board — không cần thêm code cho 3 việc này.

## Files touched

**Mới**
- `client/src/lib/tree-layout.js` — `buildTree`, `treeLayout` (thuần,
  không phụ thuộc React/DOM).
- `client/src/lib/tree-layout.test.js`.

**Sửa**
- `client/src/components/ColorMenu.jsx` — thêm prop `onArrangeTree`
  (nhận `direction`), render hàng 4 nút icon mũi tên (↓ ↑ → ←) theo đúng
  kiểu `em-toggle-group` đã có, chỉ hiện khi prop được truyền vào.
- `client/src/pages/IdeaMap.jsx` — hàm `arrangeAsTree(rootKind, rootId,
  direction)`; truyền `onArrangeTree` cho cả `ColorMenu` của thẻ (chỉ khi
  đang chọn đúng 1 thẻ — giống `onFocus`/`onEdit` dùng qua helper `one`)
  lẫn của khung.
- Catalog i18n (`vi`/`en` `messages.po`) — 4 label tooltip cho 4 nút
  hướng, chạy `lingui extract` sau khi thêm.

## Xử lý trường hợp biên

- **Vòng lặp / 1 thẻ có nhiều "cha"**: `buildTree` chỉ ghé mỗi thẻ một
  lần (BFS + `visited`) nên tự dừng, không cần dò vòng lặp riêng; dây
  thừa vẫn hiển thị bình thường, chỉ không ảnh hưởng vị trí.
- **Thẻ gốc bị khoá**: không sao — gốc vốn đã luôn đứng yên theo thiết
  kế, khoá hay không không đổi gì.
- **Thẻ/khung con bị khoá**: giữ nguyên vị trí, con cháu của nó vẫn được
  xếp quanh vị trí cố định đó bình thường.
- **Gốc không có dây nối nào**: cây chỉ có 1 thẻ, hành động không làm gì
  (không có gì để xếp).

## Testing

- `buildTree`: cây tuyến tính, cây phân nhánh, có vòng lặp, có thẻ 2
  "cha", dây không liên quan tới gốc (không bị lôi vào cây).
- `treeLayout`: thẳng hàng theo tầng (mọi thẻ cùng tầng có toạ độ trục
  sâu bằng nhau); cha nằm giữa các con; nhánh 1-con không tốn khoảng
  rộng thừa; đổi `sizeOf` trả kích thước lớn hơn thì khoảng cách giãn ra
  tương ứng; cả 4 hướng đều giữ gốc đúng tại toạ độ đầu vào; kiểm tra
  không có 2 thẻ nào chồng lấn hình chữ nhật sau khi xếp (trên vài cây
  mẫu nhiều tầng/nhiều nhánh).
