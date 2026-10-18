# Summary — Hệ màu bảng & skin vẽ tay

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-theme-sketch` (10 commit, base `c5bba20`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-theme-sketch-design.md`](../specs/2026-07-28-idea-map-theme-sketch-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-theme-sketch.md`](../plans/2026-07-28-idea-map-theme-sketch.md)

Kiểm tự động lúc chốt: `npm test` 297/297 xanh (thêm 15 test mới), `npm run
test:smoke` xanh (thêm một chặng bật/tắt skin), `npm run build` sạch,
`node --check` sạch cả ba file server.

---

### Đã làm gì

- **Panel "Giao diện"** mới trên hàng filter (kéo thả / thả nổi được như ba panel
  cũ) cho chọn **nền bảng** — 6 lựa chọn: theo giao diện, giấy kraft, trắng, xám
  đá, bạc hà, hồng phấn — và **bộ màu** — 4 lựa chọn: cổ điển, pastel, rực, đơn
  sắc. Cả hai là dữ liệu board: lưu server, đồng bộ realtime, hoàn tác được.
- **Đổi bộ màu không sửa một byte dữ liệu nào.** Thẻ/nhãn/dây vốn lưu *tên token*
  (`"dot-3"`) chứ không lưu mã màu, nên bộ màu chỉ việc gán lại 8 biến CSS là cả
  bản đồ đổi theo — và vì không đụng dữ liệu nên nó cũng không đẻ ra bước hoàn tác.
- **Màu thẻ giờ tô nền thật**, thay cho vạch viền trái 4px cũ; khung cũng vậy,
  nhạt hơn. Nền trộn bằng `color-mix` với `--surface-2` nên một token màu tự cho
  ra kết quả đúng ở cả giao diện sáng lẫn tối, không phải nuôi hai bảng màu.
- **Skin "vẽ tay"** bật/tắt bằng nút mới trên thanh trên cùng, cạnh nút sáng/tối.
  Thẻ và khung đổi sang font viết tay (Shantell Sans) và viền méo bốn kiểu; dây
  nối, hình khối đổi sang nét rung hai lượt như vẽ bằng bút chì; nền lưới mờ đi,
  bóng đổ lệch một bên như tờ giấy đặt nghiêng. Chỉ canvas đổi — thanh công cụ,
  menu, popover giữ nguyên giao diện sạch.
- Skin là **thiết lập của từng người** (localStorage, như sáng/tối), nên hai
  người mở cùng một board xem theo hai kiểu khác nhau vẫn đúng. Font **nạp lười**:
  ai không bật skin thì bundle không tải thêm byte nào.

### File chính

| File | Vai trò |
|---|---|
| `client/src/index.css` | Thêm khối token hình dạng (`--card-radius`, `--edge-w`, `--canvas-font`…) tách khỏi khối màu, và `--board-bg` / `--board-grid` |
| `client/src/styles/idea-map.css` | 5 preset nền × 3 biến thể theme, 3 bộ màu, luật `.tinted` cho thẻ/khung, và khối skin vẽ tay ở cuối file |
| `client/src/lib/board-theme.js` (+test) | Danh sách id preset và hai hàm canh cửa `isBoardBg` / `isColorPack`; cố ý **không** giữ mã màu nào |
| `client/src/lib/sketchy.js` (+test) | Sinh path rung: PRNG mulberry32 gieo bằng id, biên độ có trần, nét đôi trong một chuỗi `d` |
| `client/src/lib/useSkin.js` | Trục `data-skin`, nạp font lười, lưu localStorage |
| `client/src/styles/sketch-fonts.js` | 4 dòng import subset font — tồn tại riêng chỉ để `import()` động cắt được thành chunk |
| `client/src/pages/IdeaMap.jsx` | Panel Giao diện, nút skin, effect gắn/gỡ `data-bg` / `data-pack` trên `<html>` |
| `client/src/components/{IdeaCard,FrameBox}.jsx` | `--tint` + class `tinted`, `data-wob` cho viền méo |
| `client/src/components/{EdgeLayer,InkLayer}.jsx` | Nhận prop `sketch`, đổi `<line>` → `<path>` rung |
| `server/{models,boards}.js` | Hai field `bg` / `pack`, đi qua đủ bốn chỗ liệt kê field |

### Khác với plan

- **`index.html` phải sửa thêm** (plan chỉ nhắc `main.jsx`): chỗ đọc `theme-pref`
  trước khi React chạy nằm trong `index.html`, không phải `main.jsx`. Đặt
  `data-skin` ở đó luôn để khung hình đầu tiên không vẽ sai skin.
- **`useSkin` phải nạp font cả lúc mount, không chỉ lúc bấm.** Plan chỉ nói nạp
  lười trong nhánh bật skin — nhưng khi tải lại trang với skin đang bật thì
  `index.html` đặt thuộc tính mà không có cú bấm nào, nên font sẽ không bao giờ
  được nạp. Thêm một `useEffect` xử lý.
- **`lib/dock.js` phải sửa thêm**: `DEFAULT_LAYOUTS` là nguồn của `loadLayouts`,
  panel thứ tư không khai ở đó thì không nhớ được vị trí. Kéo theo một test trong
  `dock.test.js` phải cập nhật.
- **Bộ màu không có bản tối riêng.** Plan để ngỏ; khi làm mới thấy bộ Cổ điển
  hiện tại cũng cố ý không khai lại `--dot-*` ở khối màu tối. Làm theo đúng vậy
  cho nhất quán, đổi lại là ba bộ mới phải chọn màu đọc được trên cả hai nền —
  nên "pastel" ở đây là pastel đục chứ không nhạt như phấn.
- **Ê-líp ở skin vẽ tay đi đường riêng** trong `sketchy.js`: nhiễu bán kính ở 16
  mẫu rồi làm trơn bằng đường cong bậc hai qua trung điểm, thay vì rung từng
  cạnh của đa giác 32 đỉnh như ba hình đóng kia — cách kia cho ra răng cưa.
- Thêm `.edge-label` vào danh sách nhận `--canvas-font` (plan không liệt kê):
  nhãn dây cũng là chữ trên canvas.

### Còn dở / cần lưu ý

- **Chưa kiểm bằng mắt trên trình duyệt thật.** Phiên này không có công cụ điều
  khiển trình duyệt, nên mọi thứ cần nhìn mới biết vẫn còn nguyên trong danh sách
  kiểm tay cuối file plan: bốn tổ hợp skin × theme, độ mượt khi kéo thẻ có nhiều
  dây ở skin vẽ tay, board ~200 thẻ, hai tab đồng bộ nền/bộ màu, xuất PNG với
  nền preset. Đây là phần rủi ro còn lại lớn nhất của đợt này.
- Hai thứ *đã* kiểm được không cần trình duyệt: font Shantell Sans phủ **đủ cả 67
  ký tự có dấu tiếng Việt** (đếm glyph bằng fontTools), và 4 khai báo `@font-face`
  nằm trong chunk lười `sketch-fonts-*.css` chứ không lọt vào CSS chính.
- **PNG export không vẽ nét rung** — ảnh xuất ra luôn là nét thẳng, kể cả khi
  đang bật skin vẽ tay. Nền preset thì có vào ảnh. Đây là hạn chế cố ý, đã ghi ở
  mục "Ngoài phạm vi" của spec.
- Skin vẽ tay **chưa áp cho vỏ giao diện** (topbar, ToolRail, popover) — cố ý để
  dành một đợt sau, sau khi nhìn thấy kết quả trên canvas thật.
- Board tạo trước đợt này không có `bg`/`pack`; client tự vá `null` lúc tải nên
  **không cần migration**.
- File `game-tools/client/vite.config.js` trong thư mục làm việc đang có thay đổi
  port cục bộ của bạn — cố ý **không** commit vào nhánh này.
