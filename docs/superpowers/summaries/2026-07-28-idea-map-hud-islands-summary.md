# Summary — HUD đảo nổi, canvas tràn viền

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-hud-islands` (từ `idea-map-theme-sketch`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-hud-islands-design.md`](../specs/2026-07-28-idea-map-hud-islands-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-hud-islands.md`](../plans/2026-07-28-idea-map-hud-islands.md)

Kiểm tự động lúc chốt: `npm test` 291/291 xanh, `npm run test:smoke` xanh (thêm
bốn chặng), `npm run build` sạch, `npm run i18n:extract` 234/234 không thiếu chuỗi
EN nào. **Server không sửa một dòng nào.**

Làm bốn đợt, ba đợt sau đều bắt nguồn từ việc người dùng xem bản chạy thật:
dựng HUD đảo nổi → đưa panel lọc xuống thanh đáy và **bỏ hẳn** kéo thả → gom mọi
thứ "giao diện" về một bảng → tách bảng đó hẳn khỏi thanh lọc.

---

### Đã làm gì

- **Canvas tràn viền.** `.shell` không còn là flex column xếp `.topbar` /
  `.filterbar` / `.viewport` thành ba hàng; `.viewport` giờ `position: absolute;
  inset: 0`. Toàn bộ chrome nổi đè lên canvas, chiếm **0px** trong layout — trước
  đây hai dải trên ăn ~140px vĩnh viễn, tức 21% chiều cao trên laptop 1366×768,
  kể cả bảng trống không bật lọc nào.
- **Năm cụm nổi.** Trên trái: ☰ + tên board + tìm kiếm + Giao diện. Trên phải: ai đang mở
  board + mời. Dưới trái: hoàn tác/làm lại. Dưới phải: zoom (đã có sẵn, chỉnh cho
  khớp mép 12px và bo góc 10px của họ đảo). Đáy giữa: thanh lọc (ba panel + ★).
- **Thanh đáy = đảo nút + đảo nội dung.** Bốn nút bật panel luôn ở đó; đảo nội
  dung chỉ tồn tại khi có panel đang bật và **biến mất khỏi cây** khi tắt hết.
- **Panel không kéo được đi đâu nữa.** Bỏ hẳn neo/nổi: không `layouts`, không hút
  mép, không đường gióng, không vùng thả, không nhớ vị trí. Panel sống ở đúng một
  chỗ — đổi lại thì cũng không còn cách nào làm mất nó.
- **Một ☰ thay cho ba menu.** Board / Dữ liệu / Xem gom vào một nút, còn đúng ba
  nhóm: đi đâu, dữ liệu, cách xem. Tên board 13px thường thay cho `h1` Anton 19px
  kèm dòng eyebrow "BẢN ĐỒ Ý TƯỞNG" — riêng hai dòng đó là ~37px.
- **Mọi thứ "giao diện" về một bảng.** Ngôn ngữ, sáng/tối, kiểu vẽ, nền bảng, bộ
  màu — trước đây rải hai chỗ (ba cái trong ☰, hai cái trong panel), giờ là năm
  hàng trong cùng bảng Giao diện, chia đôi bằng hai nhãn **"Chỉ mình bạn thấy"**
  và **"Mọi người cùng thấy"**.
- **Mỗi nhóm chỉ còn một loại.** Bảng Giao diện là *thiết lập* nên nó lên đảo trên
  trái và bung ra ngay dưới nút của mình, không đứng chung dải với ba nút *lọc* ở
  đáy; ★ Yêu thích đi ngược lại, xuống đáy vì nó là lọc. Đảo trên trái = board +
  tìm + thiết lập; thanh đáy = lọc.
- **Ô tìm kiếm thu về một nút**, bung ra khi bấm hoặc `Ctrl+F`, đóng lại thì xoá
  luôn từ khoá.

### File chính

| File | Vai trò |
|---|---|
| `client/src/styles/idea-map.css` | `.shell` / `.viewport` đổi mô hình layout; `.island` là mặt kính thuần (không định vị), `.tl/.tr/.bl` neo góc, `.hud-bottom` là cụm đáy; `.filter-dock` / `.filter-panel` / `.filter-title`; bỏ `.topbar`, `.filterbar`, `.dock-*`; dời `.outline-panel` / `.io-drawer` / `.readonly-banner` / `.bulk-bar` né đảo |
| `client/src/pages/IdeaMap.jsx` | Chín icon SVG mới cho HUD; năm cụm nổi thay cho hai dải; gộp ba `TopMenu` thành một ☰; state `searchOpen` + `toggleSearch` + effect focus; bỏ state `layouts` |
| `client/src/components/FilterPanel.jsx` | Thay `DockPanel.jsx` — nhãn + nội dung, không còn gì khác |
| `client/src/lib/useTheme.js` | Trả `{ theme, setTheme, toggle }` thay vì mỗi hàm toggle; chặn thiếu `matchMedia` |
| `client/src/__smoke__/entry.jsx` | Sửa hai chỗ bám `.topbar`; thêm chặng cấu trúc HUD, chặng thanh đáy, chặng ô tìm |
| ~~`client/src/lib/dock.js`~~, ~~`dock.test.js`~~, ~~`components/DockPanel.jsx`~~ | Xoá — kéo theo 19 test và ~4KB bundle |

### Khác với plan

- **Toàn bộ Task 8 không có trong plan gốc.** Người dùng xem bản chạy thật rồi
  yêu cầu: bốn nút bật panel xuống thanh đáy, nội dung panel hiện ở ô bên cạnh,
  và không kéo ra ngoài nữa. Đó là thứ xoá đi nhiều mã nhất trong cả đợt.
- **`.island` phải tách làm hai việc.** Ban đầu nó vừa là mặt kính vừa là
  `position: absolute; z-index: 50`. Hai đảo ở thanh đáy nằm trong dòng chảy của
  `.hud-bottom` nên không được absolute — tách định vị sang `.tl/.tr/.bl`.
- **Trần bề rộng cụm đáy phải tính theo bên chật hơn.** Cụm căn giữa nên trần trừ
  2×N là chừa N mỗi bên; nút zoom bên phải rộng ~192 còn đảo hoàn tác bên trái
  chỉ ~88, nên phải lấy 210 mỗi bên (`calc(100vw - 420px)`) chứ không phải trung
  bình hai bên.
- **`.bulk-bar` phải lên `bottom: 60px`.** Đáy giữa giờ là chỗ của thanh panel, mà
  thanh đó LUÔN hiện.
- **Mỗi panel phải tự xưng tên.** Bản cũ chỉ hiện tên khi panel nổi, vì lúc neo
  thì mỗi panel là một khối riêng có viền. Giờ nhiều panel bật cùng lúc nằm liền
  một dải trong cùng một đảo, không còn gì để mắt tự tách ra.
- **`TopMenu` phải mọc thêm ba prop.** `closeOnClick` tắt được (menu hành động
  đóng sau một cú bấm là đúng, bảng thiết lập thì bắt mở lại năm lần), `wide`
  (252px — hàng swatch nền bảng và bốn nút bộ màu không vừa 190px), và `title`
  (tooltip thật, đồng thời là mốc để test phân biệt hai trigger trên cùng đảo —
  lấy theo index thì thêm cái thứ ba là trỏ nhầm).
- **`useTheme` phải đổi API** — không có trong plan. Panel cần tô sáng nút đang
  dùng, mà hook cũ chỉ trả về hàm toggle. Giờ nó giải sẵn ra `"light"`/`"dark"`
  ngay lúc mount thay vì giữ `null`. Ba trang khác gọi nó cũng phải sửa theo.
- **Ngôn ngữ đi theo sang panel Giao diện** dù người dùng không đánh dấu nó. Bỏ
  sáng/tối và skin ra khỏi ☰ thì nó còn lại một mình trong menu, mà nó cũng là
  thiết lập hiển thị của từng người — cùng họ với hai cái kia.
- Ô tìm kiếm **đóng lại thì xoá từ khoá**. Từ khoá tính vào `activeFilterCount` và
  làm mờ thẻ không khớp; giữ nó sống trong khi ô nhập biến mất là một bộ lọc vô
  hình, không còn chỗ nào nhìn ra vì sao thẻ bị mờ.

### Hai cái bẫy gặp ở đợt đầu (đã thành vô nghĩa sau đợt sau)

Ghi lại vì chúng là hệ quả thật của việc để panel nổi làm con của khay neo — nếu
sau này ai đó định dựng lại cơ chế kéo thả thì đây là hai chỗ sẽ dẫm phải:

- **Khay neo không thể `display: none`.** Panel nổi vẫn là con của khay;
  `display:none` giấu cả cây con bất kể con nó `position: fixed`, nên mọi panel
  nổi sẽ biến mất khỏi màn hình.
- **Cho panel nổi ra ngoài khay cũng không xong.** Lúc kéo panel từ neo sang nổi,
  cờ `free` lật ngay ở mousemove đầu tiên → đổi cha → React gắn lại phần tử mới,
  còn closure của lượt kéo vẫn giữ phần tử cũ đã lìa cây và `offsetWidth` của nó
  thành 0.

### Ba chỗ smoke test đang nói dối, phát hiện khi sửa

- Có một đợt nút đổi skin nằm trong menu ☰ (trước khi nó về panel Giao diện), mà
  bấm một mục là menu tự đóng và nút rời khỏi cây. Test giữ một tham chiếu rồi
  bấm nó **hai** lần — cú thứ hai rơi vào node đã lìa cây, không làm gì cả, và
  test vẫn xanh. Bài học không mất đi cùng cái menu: đừng giữ tham chiếu tới
  phần tử nằm trong thứ có thể tự đóng.
- Ba chuỗi mới chưa qua `i18n:extract` nên `t` trả về **mã băm** (`"4r3iJS"`) thay
  vì tiếng Việt, làm mọi phép tìm theo `title` trượt. Đây là lý do đáng để chạy
  extract ngay khi thêm chuỗi chứ không để tới cuối.
- **`window.matchMedia` không tồn tại trong jsdom.** Mã cũ chỉ gọi nó lúc BẤM nút
  nên suốt bao lâu nay không ai gặp; chuyển sang gọi lúc mount là sập cả trang vì
  một câu hỏi về màu nền. Cùng loại bẫy với `getContext("2d")` trả `null` hồi làm
  tool text — một API phụ trợ vắng mặt không được phép giết cả trang.

### Còn dở / cần lưu ý

- **Chưa kiểm bằng mắt trên trình duyệt** — phiên này không có công cụ điều khiển
  trình duyệt. jsdom không tính layout, nên bốn chặng smoke mới chỉ kiểm được
  *cấu trúc* (hai dải cũ đã rời khỏi cây, các đảo có mặt, đảo nội dung biến mất
  khi tắt hết panel, không còn phần tử kéo-thả nào), **không** kiểm được điều
  quan trọng nhất là canvas có thật sự cao bằng cửa sổ và các cụm có đụng nhau
  không. Danh sách kiểm tay cuối file plan còn nguyên.
- **Vị trí panel cũ còn nằm lại trong localStorage** dưới khoá
  `idea-map-panel-layout`. Không ai đọc nữa, vô hại, nhưng cũng không có mã nào
  dọn nó.
- **Bật cả bốn panel thì đảo nội dung khá rộng.** Có trần `max-height: 40vh` +
  cuộn để nó không cao vống lên, nhưng bề rộng thì chỉ bị chặn bởi
  `calc(100vw - 420px)`. Chưa biết thực tế trông thế nào.
- **Thanh nhiều lựa chọn có thể bị đảo nội dung cao đè lên.** `.bulk-bar` ở
  `bottom: 60px`, đủ cho đảo nội dung một hàng; đảo cao 40vh thì không.
- **Màn thấp chưa xử lý.** `.readonly-banner` ở `bottom: 58px` có thể đụng đuôi
  thanh công cụ trái trên màn rất thấp (<600px).
- `.spacer` không còn chỗ dùng nào trong `IdeaMap.jsx` nhưng vẫn giữ trong CSS —
  nó là class tiện ích chung, các trang khác có thể đang dùng.
