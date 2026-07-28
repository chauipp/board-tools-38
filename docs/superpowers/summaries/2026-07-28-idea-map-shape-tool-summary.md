# Summary — Tool hình khối cho bản đồ ý tưởng

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-shape-tool` (25 commit, base `3631d83`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-shape-tool-design.md`](../specs/2026-07-28-idea-map-shape-tool-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-shape-tool.md`](../plans/2026-07-28-idea-map-shape-tool.md)

Kiểm tự động lúc chốt: `npm test` 241/241 xanh, `npm run test:smoke` xanh,
`node --check index.js` sạch.

---

### Đã làm gì

- Thanh công cụ bên trái có tool thứ ba: **Hình khối** (phím `s`), nằm sau Bút và
  Cục gôm. Khu 4 khi cầm nó hiện bảng chọn 6 hình — chữ nhật, ê-líp, đường
  thẳng, mũi tên, tam giác, hình thoi — cộng bộ màu và độ dày dùng chung với
  bút, cộng hai nút chế độ tô. Chọn một hình **mở** (đường thẳng, mũi tên) thì
  nút "tô cả hình" mờ đi *và* chế độ tự về chỉ viền, nên đổi lại sang chữ nhật
  không bị tô đặc bất ngờ.
- Kéo chuột ra hình thật, hiện ngay theo con trỏ. Giữ `Shift` ép hình đóng thành
  vuông / tròn đều, ép hình mở về hướng 0° / 45° / 90°. Kéo gần như không di thì
  bỏ, không tạo hình rác — đo theo **đường chéo** nên một đường thẳng ngang dài
  200 với chiều cao 0 không bị bỏ oan.
- Hình khối lưu chung `board.drawings` với nét bút (`kind` cho biết hình gì,
  `pts` là **đúng 4 số** = hai góc đối), nên `Ctrl+Z` / `Ctrl+Shift+Z` hoạt động
  không cần một dòng code hoàn tác nào, và bốn chỗ liệt kê field ở GET/PUT không
  phải sửa — chính chỗ đã làm mất nét vẽ ở đợt trước.
- Cục gôm xoá được hình khối: hình **chỉ viền** chỉ mất khi quét chạm viền, hình
  **tô cả hình** mất cả khi quét vào giữa vùng tô. Nét bút và cả sáu hình đi qua
  đúng một hàm hit-test.
- Hình chạy theo thời gian thực qua đúng kênh `live:ink` sẵn có, với một ngữ
  nghĩa mới: gói hình khối mang **cả hộp** và người nhận **thay** thay vì nối
  thêm như nét bút. Hệ quả tốt: mất một gói thì gói sau tự chữa, không để lại
  hình sai kích thước vĩnh viễn.
- Màu, độ dày, hình đang chọn và chế độ tô đều nhớ qua `localStorage` dưới đúng
  khoá cũ `"ideamap.pen"`; prefs của bản trước (chỉ có màu và độ dày) vẫn đọc
  được, hai key mới lấy mặc định.

### File chính

**Module thuần (test bằng `node:test`)**
- `game-tools/client/src/lib/shape.js` — toàn bộ hình học: `SHAPE_KINDS`,
  `SHAPE_CLOSED`, `normalizeBox` (làm tròn, ép vuông, ép hướng), `shapePath`
  (ê-líp dùng cung `A` thật nên zoom sâu vẫn mịn), `shapeOutline` (đường bao xấp
  xỉ, chỉ để đo), và `drawingsHitBy` — hit-test duy nhất cho cả nét bút lẫn hình.
- `game-tools/client/src/lib/stroke.js` — hạ xuống thành nơi giữ hai phép tính
  gốc: `polylineHitBy` (tách nguyên vòng lặp của `strokesHitBy` cũ, kể cả nhánh
  nét một điểm) và `pointInPolygon`. `strokesHitBy` bị xoá; năm test của nó
  chuyển sang `shape.test.js` để không mất phần phủ nét bút.
- `game-tools/client/src/lib/pen.js` — prefs khu 4 thành bốn key
  `{ color, w, kind, fill }`, lọc theo từng key nên một giá trị hỏng không làm
  mất giá trị còn lại.
- `game-tools/client/src/lib/ink-live.js` — `mergeInkPacket` chọn giữa **thay**
  và **nối** theo `kind`; entry overlay mang thêm `kind` và `fill`.

**Hook và component**
- `game-tools/client/src/lib/useInk.js` — nhánh thứ ba `tool === "shape"`, hộp
  mới nhất giữ trong ref (không đọc lại từ state, vì `finish` gắn vào `window`
  từ lúc mousedown và `pushDraft` là `rafThrottle`), **và một đường dọn duy nhất
  `cleanupRef`** để mất focus giữa nét không để listener sống sót.
- `game-tools/client/src/lib/useInkLive.js` — `beginShape` / `pushShape` /
  `endShape` cộng `kindRef`. `pushShape` cố ý **không** có bộ tích luỹ: với gói
  mang cả hộp thì việc `trailingThrottle` thay tham số đang chờ chính là hành vi
  đúng, khác hẳn gói điểm của bút.
- `game-tools/client/src/components/InkLayer.jsx` — vẫn đúng một component
  `Stroke` cho cả ba nguồn nét, giờ nhận thêm `kind` và `fill`.
- `game-tools/client/src/components/ToolOptions.jsx`, `ToolRail.jsx` — bảng chọn
  hình (icon vẽ đúng hình mà nút tạo ra), hai nút chế độ tô, nút Hình khối.

**Server và test**
- `game-tools/server/index.js` — `sanitizeInk` nhận `kind` (7 giá trị), bắt
  `pts` đúng 4 số với hình khối *kiểm độ dài gốc trước khi `slice`*, chỉ chấp
  `fill` cho bốn hình đóng, và chặn biên độ toạ độ.
- `game-tools/client/src/__smoke__/entry.jsx`, `smoke-run.mjs` — sáu nhóm kiểm
  mới: khu 4 theo tool và trạng thái mờ của nút tô; vẽ ra path đúng `kind`/`fill`
  và đúng một lần lưu; gôm xoá hình tô đặc nhưng tha hình chỉ viền; gói phát ra
  mang `kind` ở mọi gói với `pts` 4 số; gói nhận vào thay hộp chứ không nối; và
  mất focus giữa nét không lưu gì.

### Khác với plan

Bảy chỗ. Đáng chú ý là **không** chỗ nào là đổi ý thiết kế — tất cả là plan bỏ
sót, và ba trong số đó là plan sai chứ chỉ chưa đủ.

1. **`useInk.js` phải có một đường dọn dùng chung (`cleanupRef`)** — commit
   `ecc5238`. Đây là chỗ nặng nhất. Plan bảo đổi cách phân nhánh trong `finish()`
   từ `const wasPen = activeRef.current === "pen"` sang
   `if (was === "eraser") … else if (was === "shape") … else {bút}`. Nhưng effect
   `onBlur` đặt `activeRef.current = null` mà **không gỡ** listener
   `mousemove`/`mouseup` — lỗi rò có từ đợt trước. Trước đợt này `was === null`
   rơi vào nhánh gôm với set rỗng nên vô hại; sau khi đổi nhánh nó rơi vào nhánh
   **bút** và commit thật. Thao tác tái hiện: bấm chuột xuống → cửa sổ mất focus
   (alt-tab, thông báo hệ điều hành) → quay lại, di chuột không bấm → bấm một
   cái. Kết quả: một nét bút rác được lưu *và PUT cả board lên server*, tức sang
   màn hình mọi người — kể cả khi người dùng đang cầm tool hình khối. Chứng minh
   bằng cách đổi riêng điều kiện đó về ngữ nghĩa cũ thì PUT về 0.
2. **Server phải chặn biên độ toạ độ (`MAX_LIVE_INK_COORD`)** — commit `4b052b4`.
   Ghi chú sẵn có trong `index.js` nói thẳng `MAX_LIVE_INK_W` tồn tại để một
   client độc không phát được vệt bút phủ kín màn hình cả phòng. `fill` đi vòng
   qua đúng chốt đó: gói `{kind:"rect", w:64, fill:true, pts:[-1e9,-1e9,1e9,1e9]}`
   hợp lệ với mọi phép kiểm cũ và phủ toàn bộ canvas của người nhận. Ngưỡng chọn
   là 20000, gần năm lần cạnh dài của `.canvas` (4200×3200) nên không chặn oan.
3. **Server chỉ được chấp `fill` cho bốn hình đóng** — cùng commit. Plan để server
   nhận `fill` với mọi `kind` khác `pen`, lệch với client. Gói
   `{kind:"arrow", fill:true}` làm đầu mũi tên hiện thành nêm tô đặc lúc peer kéo
   rồi biến mất khi bản lưu về.
4. **`mergeInkPacket` phải lùi về `cur.kind` khi gói thiếu `kind`** — commit
   `d5d8be6`. Plan nhánh chỉ theo `packet.kind`, nên một gói `seq > 0` của hình
   khối mà thiếu `kind` rơi vào nhánh nối và làm hộp phình từ 4 lên 8 số. Fallback
   chỉ áp cho nhánh `seq > 0`; nhánh `seq === 0` cố ý **không** đọc `cur`, nếu
   không thì một nét bút trùng khoá overlay với hình cũ sẽ bị coi là hình khối.
5. **Bài kiểm cái bẫy CSS phải nằm ở `smoke-run.mjs`, không ở `entry.jsx`** —
   commit `bd2fed7`. Plan viết bài kiểm đọc `getAttribute("fill")` trong jsdom để
   chứng minh CSS không đè presentation attribute. Nó không chứng minh được gì:
   `getAttribute` không phản ánh cascade, và harness không nạp CSS vào jsdom bao
   giờ — nên nó xanh kể cả khi `fill: none` còn nguyên trong stylesheet. Thay
   bằng bài kiểm đọc thẳng `src/styles/idea-map.css` từ node, và đã xác minh nó
   có răng bằng cách thêm lại `fill: none` rồi thấy đỏ.
6. **Bề rộng khu 4: nút 23px → 22px, thêm `overflow-x: hidden`** — commit
   `9260b35`. Phép tính trong plan quên `box-sizing: border-box` cộng 2px viền:
   62px − 12 padding − 2 border = 48px cho hai cột, không phải 50px. Hai nút 23px
   làm hàng thừa 2px, và `overflow-y: auto` khiến trục x tự thành `auto` nên panel
   có thanh cuộn ngang.
7. **Task 4 dùng `npm run i18n:extract` thay vì gõ tay `messages.po`** — đúng hơn
   cách plan chỉ, nhưng nó cũng cập nhật `vi/messages.po` (ngoài danh sách file
   của plan) và làm diff phình 262 dòng mỗi file vì sắp lại tham chiếu nguồn. Đã
   kiểm: `msgid` 195 → 204 đúng 9 chuỗi mới, không chuỗi nào biến mất.

### Còn dở / cần lưu ý

- **Chưa chạy danh sách kiểm tay của spec.** Toàn bộ mục "Kiểm tay còn lại" bị
  hoãn: hai tab cùng board vẽ đủ sáu hình cả viền cả tô cả có `Shift` và xác nhận
  không nháy lúc thả chuột; zoom sâu vào ê-líp xem viền còn mịn; đổi theme
  sáng/tối; tài khoản chỉ xem không vẽ được nhưng vẫn thấy hình người khác; đóng
  tab giữa lúc đang kéo hình thì hình tạm bên tab kia tự dọn. **Đây là lớp xác
  minh còn thiếu quan trọng nhất**, và riêng thay đổi bề rộng khu 4 (mục 6 ở
  trên) hoàn toàn không có test nào canh giữ — smoke test chạy trong jsdom nên
  không có layout.
- **`game-tools/server` vẫn không có bộ test nào.** `sanitizeInk` được kiểm bằng
  script chạy tay rồi xoá (19 ca ở lượt review, 9 ca ở lượt sửa cuối) cộng phủ
  gián tiếp qua smoke test của client. Lần sau sửa nó thì không có gì bắt lỗi hộ.
- **Hai bản sao tay của hằng client nằm trong `server/index.js`**:
  `LIVE_INK_KINDS` và `LIVE_INK_FILLABLE_KINDS`, phản chiếu `SHAPE_KINDS` và
  `SHAPE_CLOSED` trong `client/src/lib/shape.js`. Có ghi chú trỏ chéo, nhưng
  không có gì tự động chặn hai chỗ lệch nhau — thêm một `kind` mới phải sửa hai
  nơi.
- **Hình tô đặc vẽ chồng lên thẻ sẽ che thẻ** (bấm vẫn bấm được, chỉ không thấy).
  Hạn chế đã chốt trong spec: lớp nét ở `z-index: 7`, phải đợi spec 3 làm z-order
  mới đẩy được từng hình xuống dưới.
- **Vẽ sai thì gôm hoặc `Ctrl+Z`** — chưa sửa được hình đã vẽ (không đổi kích
  thước, không đổi màu, không di chuyển). Spec 3.
- Nợ nhỏ đã ghi nhận, không chặn merge: một `kind` lạ trong `board.drawings`
  (client mới hơn, hoặc PUT tay) cho ra phần tử vừa vô hình vừa không gôm được,
  chỉ `Ctrl+Z` dọn nổi; `endStroke` và `endShape` phát gói y hệt nhau nên tên
  hơi lệch nghĩa; test "mọi điểm nằm trong hộp bao" của `shapeOutline` sẽ vẫn
  xanh nếu 32 mẫu ê-líp dồn hết về tâm; `normalizeBox` với `square` khi `dx` hoặc
  `dy` bằng 0 ép dấu về dương một cách chưa được đặc tả.
- `game-tools/client/vite.config.js` (đổi cổng dev 5173→7155, 3001→3345) và
  `improve.md` đang có thay đổi chưa commit. Có từ trước đợt này, đã chủ ý không
  đụng vào — đừng để chúng đi kèm commit merge.
