# Summary — Bút laser

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-laser-pointer` (từ `idea-map-hud-islands`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-laser-pointer-design.md`](../specs/2026-07-28-idea-map-laser-pointer-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-laser-pointer.md`](../plans/2026-07-28-idea-map-laser-pointer.md)

Kiểm tự động lúc chốt: `npm test` 303/303, `npm run test:smoke` xanh (thêm một
chặng), `npm run build` sạch, `npm run i18n:extract` 236/236 không thiếu chuỗi
EN nào, `node --test auth.test.js` bên server 11/11.

---

### Đã làm gì

- **Nút Laser ở khu 1 của thanh công cụ và phím `K`.** Bật lên rồi di chuột là
  có một vệt sáng chạy theo con trỏ — không cần giữ nút chuột. Bấm lại hoặc `Esc`
  là tắt.
- **Vệt tự tan.** Mỗi điểm sống 900ms rồi rụng khỏi đuôi; đứng yên một nhịp là
  vệt rút về con trỏ rồi biến mất. Không có gì được lưu: không nét trong
  `drawings`, không bước hoàn tác, không một lần `PUT` nào.
- **Người khác thấy vệt của mình gần như tức thời** qua kênh `live:laser` mới
  (~25 gói/giây). Vệt của mình đỏ, vệt người khác lấy đúng màu con trỏ của họ —
  hai người cùng chỉ thì biết ai đang chỉ cái nào.
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
| `client/src/lib/laser.js` | Lõi thuần: thêm/rụng điểm và tính viền ngoài của vệt. Không React, không DOM |
| `client/src/lib/laser.test.js` | 12 test, gồm hợp đồng "chối điểm thì trả về CHÍNH mảng cũ" |
| `client/src/lib/useLaser.js` | `createLaserStore()` (kho vệt ngoài React) + `useLaser()` (gom điểm 40ms rồi phát) |
| `client/src/components/LaserLayer.jsx` | Nhận vệt người khác, chạy vòng rAF, vẽ quầng sáng + lõi + chấm đầu |
| `client/src/components/ToolRail.jsx` | `IconLaser` + nút thứ ba ở khu 1, cố ý KHÔNG có `disabled={!canEdit}` |
| `client/src/pages/IdeaMap.jsx` | mode `"laser"`, lớp `.laser-capture`, phím `K`, `<LaserLayer>` trong `.canvas` |
| `client/src/styles/idea-map.css` | `.laser-capture` (z-index 8, cùng khuôn `.ink-capture`) và bốn rule của lớp vẽ |
| `server/index.js` | Kênh `live:laser`: sanitize, `.volatile`, không chặn viewer |
| `client/src/__smoke__/entry.jsx` | Tra nút theo TÊN thay cho chỉ số (cả file), hai phép đếm nút, một chặng laser mới |

### Khác với plan

- **Task 7 Step 1 không có trong dự tính ban đầu.** Cả `entry.jsx` bấm nút bằng
  chỉ số (`.tool-btn[3]`), mà thêm một nút vào khu 1 là mọi chỉ số phía sau dịch
  đi một — 14 chỗ. Đổi số cho khớp thì test vẫn xanh nhưng vẫn giòn y như cũ, nên
  đổi hẳn sang tra theo `title` (`railBtn("Cục gôm")`). Đây đúng bài học phiên
  trước đã rút ra khi làm `TopMenu` ("lấy theo index thì thêm cái thứ ba là trỏ
  nhầm"), chỉ là lần này nó rơi vào file test.
- **Laser thành MODE chứ không phải một tool nữa của mode Sửa.** Trông thì giống
  vẽ, nhưng mọi tool của mode Sửa đều ghi vào board, đều bị khoá với viewer, và
  đều đi kèm bảng tuỳ chọn ở khu 4. Laser không cái nào cả — nhét vào khu 2 là
  phải bịa ngoại lệ cho cả ba thứ đó.
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

### Còn dở / cần lưu ý

- **Chưa kiểm bằng mắt trên trình duyệt.** Phiên này không có công cụ điều khiển
  trình duyệt, và jsdom không vẽ gì — chặng smoke mới chỉ kiểm được *hành vi*
  (có vệt, phát đúng số điểm, vệt người khác khác màu, tự tan hết, không ghi vào
  board), **không** kiểm được thứ quan trọng nhất là nó có trông ra một cây laser
  hay không. Danh sách kiểm tay ở cuối file plan còn nguyên tám mục.
- **Nhịp tan 900ms là con số đoán.** Nó hợp lý trên giấy (đủ dài để mắt bắt kịp,
  đủ ngắn để lia một vòng không thành mạng nhện) nhưng chỉ dùng thật lúc đang nói
  mới biết đúng hay không. Sửa một hằng số trong `laser.js`.
- **Lỡ tay bấm chuột trái ở mode Laser thì không có gì xảy ra** — cố ý, để không
  kéo mất một cái thẻ giữa lúc đang trình bày. Nhưng cũng có nghĩa là muốn bấm
  vào thẻ thì phải tắt laser trước. Chuột phải và Space+trái vẫn lia bảng được.
- **Chuột lia CỰC nhanh có thể tạo vệt gãy khúc**: điểm chỉ được lấy ở mỗi
  `mousemove`, nên hai điểm liền nhau có thể cách nhau cả trăm đơn vị và đoạn nối
  giữa chúng là một đường thẳng. Nét bút cũng vậy nhưng không ai để ý vì nét bút
  người ta vẽ chậm.
- **Không có cách nào tắt laser của người khác.** Nếu ai đó để laser bật rồi bỏ
  đi, mỗi lần họ chạm chuột là màn hình mọi người có một vệt. Tự tan sau 900ms
  nên không tích tụ, nhưng vẫn là một thứ chưa có nút gạt.
