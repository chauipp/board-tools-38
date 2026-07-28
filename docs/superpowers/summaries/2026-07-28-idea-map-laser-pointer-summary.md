# Summary — Bút laser

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-laser-pointer` (từ `idea-map-hud-islands`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-laser-pointer-design.md`](../specs/2026-07-28-idea-map-laser-pointer-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-laser-pointer.md`](../plans/2026-07-28-idea-map-laser-pointer.md)

Kiểm tự động lúc chốt: `npm test` 313/313, `npm run test:smoke` xanh (thêm một
chặng), `npm run build` sạch, `npm run i18n:extract` 238/238 không thiếu chuỗi
EN nào, `node --test auth.test.js` bên server 11/11.

---

### Đã làm gì

- **Nút Laser ở khu 1 của thanh công cụ và phím `K`.** Bấm lại hoặc `Esc` là tắt.
- **Giữ chuột trái thì vệt mới sáng**, đúng như cầm cây laser thật phải bấm. Rê
  chuột không giữ nút thì không để lại gì, nên vừa để laser bật sẵn vừa đọc nội
  dung bảng cũng không rắc vệt lên màn hình mọi người. Một lần bấm là một vệt:
  thả ra rồi bấm lại ở góc kia thì bắt đầu vệt mới, không nối thành một vạch
  thẳng băng qua bảng.
- **Chọn được màu và độ đậm** ở khu 4 như bút: bảy màu (dùng lại đúng bảng của
  bút) và ba độ đậm. Lựa chọn nhớ qua lần mở sau. Màu đi vào gói mạng nên người
  khác thấy đúng màu mình chọn.
- **Vệt tự tan.** Mỗi điểm sống 900ms rồi rụng khỏi đuôi; đứng yên một nhịp là
  vệt rút về con trỏ rồi biến mất. Không có gì được lưu: không nét trong
  `drawings`, không bước hoàn tác, không một lần `PUT` nào.
- **Người khác thấy vệt của mình gần như tức thời** qua kênh `live:laser` mới
  (~25 gói/giây), đúng màu và đúng độ đậm mình chọn.
- **Người CHỈ XEM cũng dùng được.** Đây là công cụ đầu tiên trên thanh này không
  bị khoá với viewer, vì nó không ghi một chữ nào vào board. Server cũng không
  chặn viewer ở kênh này, khác `live:ink`.
- **`K` vẫn chạy khi đang trình chiếu** — ngoại lệ duy nhất trong danh sách phím
  tắt bị tắt lúc đó, vì đang trình chiếu mới là lúc cần cây laser nhất.
- **Vệt bám theo bảng** (nằm trong `.canvas`) nhưng **giữ nguyên bề rộng trên màn
  hình** khi phóng to/thu nhỏ — chỉ vào một cái thẻ thì vệt ở lại đúng thẻ đó,
  và nó không dày lên như nét bút khi zoom vào.

### File chính

| File | Vai trò |
|---|---|
| `client/src/lib/laser.js` | Lõi thuần: thêm/rụng điểm, viền ngoài vệt, và bộ nhớ màu/độ đậm (`ideamap.laser`). Không React, không DOM |
| `client/src/lib/laser.test.js` | 22 test, gồm hợp đồng "chối điểm thì trả về CHÍNH mảng cũ" và hai khoá localStorage phải tách nhau |
| `client/src/components/ToolOptions.jsx` | Nhánh khu 4 của laser: 7 màu + 3 độ đậm, không bảng hình, không chế độ tô |
| `client/src/lib/useLaser.js` | `createLaserStore()` (kho vệt ngoài React) + `useLaser()` (gom điểm 40ms rồi phát) |
| `client/src/components/LaserLayer.jsx` | Nhận vệt người khác, chạy vòng rAF, vẽ quầng sáng + lõi + chấm đầu |
| `client/src/components/ToolRail.jsx` | `IconLaser` + nút thứ ba ở khu 1, cố ý KHÔNG có `disabled={!canEdit}` |
| `client/src/pages/IdeaMap.jsx` | mode `"laser"`, lớp `.laser-capture` (giữ chuột mới vẽ), state `laserPrefs`, phím `K`, `<LaserLayer>` trong `.canvas` |
| `client/src/styles/idea-map.css` | `.laser-capture` (z-index 8, cùng khuôn `.ink-capture`) và bốn rule của lớp vẽ |
| `server/index.js` | Kênh `live:laser`: sanitize `pts`/`color`/`w`, chuyển tiếp `reset`, `.volatile`, không chặn viewer |
| `client/src/__smoke__/entry.jsx` | Tra nút theo TÊN thay cho chỉ số (cả file), hai phép đếm nút, một chặng laser mới |

### Ba vòng sửa theo phản hồi

Bản đầu cho vệt chạy theo con trỏ không cần giữ nút (đúng cách Excalidraw làm) và
không cho chọn màu/độ đậm — màu là danh tính người chỉ, băm từ email. Người dùng
xem xong yêu cầu cả ba: chọn màu, chọn đậm nhạt, và **phải bấm mới lên vệt**.
Bản này là bản sau khi sửa. Đổi lại đúng một quyết định thiết kế nhưng kéo theo
ba thứ mới: `laserPrefs` với khoá localStorage riêng, kiểu vệt phải đi trong gói
mạng (nên phải lọc hai lần), và một cờ `reset` để một lần bấm là một vệt.

### Khác với plan

- **Task 7 Step 1 không có trong dự tính ban đầu.** Cả `entry.jsx` bấm nút bằng
  chỉ số (`.tool-btn[3]`), mà thêm một nút vào khu 1 là mọi chỉ số phía sau dịch
  đi một — 14 chỗ. Đổi số cho khớp thì test vẫn xanh nhưng vẫn giòn y như cũ, nên
  đổi hẳn sang tra theo `title` (`railBtn("Cục gôm")`). Đây đúng bài học phiên
  trước đã rút ra khi làm `TopMenu` ("lấy theo index thì thêm cái thứ ba là trỏ
  nhầm"), chỉ là lần này nó rơi vào file test.
- **Laser thành MODE chứ không phải một tool nữa của mode Sửa.** Trông thì giống
  vẽ, nhưng mọi tool của mode Sửa đều ghi vào board và đều bị khoá với viewer;
  laser thì không. Nó CÓ khu 4 như chúng, nhưng đọc từ `laserPrefs` riêng chứ
  không phải `penPrefs` — độ đậm laser là pixel màn hình còn độ dày bút là đơn vị
  canvas, dùng chung một ô `w` là đổi cái này sẽ đổi luôn cái kia.
- **Kiểu vệt đi kèm MỌI gói, không chỉ gói đầu**, ngược với `live:ink` (chỉ gửi
  màu ở `seq: 0`). Làm được thế vì kênh ink KHÔNG `.volatile` nên gói đầu chắc
  tới nơi; kênh laser thì `.volatile`, rơi gói đầu là cả lượt chỉ đó mất màu.
- **Kiểu vệt phải lọc HAI lần.** Server không import được `PEN_COLORS` của client
  nên chỉ chặn được "chuỗi ngắn" và "số trong biên độ" — `w = 63` lọt qua đó vẫn
  là một vệt phủ ngang màn hình cả phòng. `sanitizeLaserStyle()` bên client lọc
  lần hai, và có test riêng cho cả hai trường hợp.
- **Kho vệt nằm ngoài React**, không phải một `useState` như `useInkLive` đang
  làm. Vệt phải vẽ lại 60 lần/giây suốt 900ms kể cả khi con trỏ đứng yên; để nó
  trong state của `IdeaMap` là mỗi khung hình đó render lại toàn bộ thẻ, dây,
  khung — đúng thứ `PeerLayer.jsx` sinh ra để tránh, và xảy ra đúng lúc đang
  thuyết trình. Vòng rAF cũng chỉ sống khi còn vệt.
- **Vệt vẽ bằng VIỀN NGOÀI tô đặc, không phải đường kẻ.** `stroke-width` của SVG
  là một số cho cả đường nên không thon dần được; cách còn lại là chẻ ra mấy chục
  `<line>` cho mỗi người mỗi khung hình. Ở đây một vệt là đúng một `<path>`.
- **Bề rộng chia cho `view.scale`.** Nét bút cố ý dày lên khi phóng to ("mực trên
  giấy" — ghi chú có sẵn trong `InkLayer.jsx`), nhưng laser là cái que chỉ, phải
  giữ nguyên cỡ trên màn hình.
- **`.volatile` ở server**, ngược với quyết định của `live:ink` ngay bên trên nó.
  `live:ink` mang điểm của một nét sẽ được lưu vĩnh viễn nên mất gói là khuyết
  vĩnh viễn; vệt laser biến mất hết sau chưa tới một giây.
- **Không gắn listener vào `window` như `useInk.js` làm.** Ở đó bắt buộc, vì thả
  chuột ngoài khung nhìn mà không nhận `mouseup` là nét treo lại và không bao giờ
  được lưu — cả một `cleanupRef` cộng listener `blur` dựng lên chỉ để chặn chuyện
  đó. Lượt chỉ laser không có gì để commit, mà `.laser-capture` lại phủ kín khung
  nhìn, nên `onMouseUp` + `onMouseLeave` ngay trên lớp phủ là đủ và không có
  listener nào sống sót ra ngoài lượt.
- **Một chỗ smoke test tự lừa mình, phát hiện khi viết.** Bấm chọn màu rồi bấm
  chọn độ đậm trong cùng một `act()`: cả hai handler là
  `onPrefs({ ...prefs, … })` và cùng đóng gói `prefs` của MỘT lượt render, nên cú
  sau ghi đè cú trước. Màu quay về mặc định `pen-red` — mà mặc định cũng là một
  màu hợp lệ, nên assertion "gói có mang màu" vẫn xanh. Tách hai `act()` và so
  với đúng token vừa chọn mới thấy. Người dùng thật không gặp: giữa hai cú bấm
  luôn có một lượt render.

### Còn dở / cần lưu ý

- **Chưa kiểm bằng mắt trên trình duyệt.** Phiên này không có công cụ điều khiển
  trình duyệt, và jsdom không vẽ gì — chặng smoke mới chỉ kiểm được *hành vi*
  (có vệt, phát đúng số điểm, vệt người khác khác màu, tự tan hết, không ghi vào
  board), **không** kiểm được thứ quan trọng nhất là nó có trông ra một cây laser
  hay không. Danh sách kiểm tay ở cuối file plan còn nguyên mười một mục.
- **Nhịp tan 900ms là con số đoán.** Nó hợp lý trên giấy (đủ dài để mắt bắt kịp,
  đủ ngắn để lia một vòng không thành mạng nhện) nhưng chỉ dùng thật lúc đang nói
  mới biết đúng hay không. Sửa một hằng số trong `laser.js`.
- **Ở mode Laser, chuột trái chỉ để chỉ trỏ** — không chọn được thẻ, không kéo
  được gì. Cố ý, để không kéo mất một cái thẻ giữa lúc đang trình bày; muốn thao
  tác lên thẻ thì tắt laser trước. Chuột phải và Space+trái vẫn lia bảng được.
- **Chuột lia CỰC nhanh có thể tạo vệt gãy khúc**: điểm chỉ được lấy ở mỗi
  `mousemove`, nên hai điểm liền nhau có thể cách nhau cả trăm đơn vị và đoạn nối
  giữa chúng là một đường thẳng. Nét bút cũng vậy nhưng không ai để ý vì nét bút
  người ta vẽ chậm.
- **Không có cách nào tắt laser của người khác.** Nếu ai đó vừa bật laser vừa giữ
  chuột rê lung tung thì màn hình mọi người có vệt. Tự tan sau 900ms nên không
  tích tụ, và giờ phải GIỮ chuột mới vẽ được nên khả năng vô tình đã thấp hẳn.
- **Mặc định của mọi người đều là đỏ.** Trước đây vệt lấy màu con trỏ băm từ
  email nên hai người luôn khác màu sẵn; giờ màu là lựa chọn, mà ai chưa chọn thì
  cùng `pen-red`. Muốn phân biệt phải tự đổi.
- **Rê chuột lên thanh công cụ giữa lượt chỉ là đóng lượt** (`onMouseLeave`).
  Đúng ý trong hầu hết trường hợp, nhưng chỉ vào một thẻ nằm sát mép trái màn
  hình thì có thể bị cắt sớm.
