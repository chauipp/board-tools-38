# Summary — HUD đảo nổi, canvas tràn viền

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-hud-islands` (từ `idea-map-theme-sketch`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-hud-islands-design.md`](../specs/2026-07-28-idea-map-hud-islands-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-hud-islands.md`](../plans/2026-07-28-idea-map-hud-islands.md)

Kiểm tự động lúc chốt: `npm test` 310/310 xanh, `npm run test:smoke` xanh (thêm
ba chặng), `npm run build` sạch, `npm run i18n:extract` 227/227 không thiếu chuỗi
EN nào. **Server không sửa một dòng nào.**

---

### Đã làm gì

- **Canvas tràn viền.** `.shell` không còn là flex column xếp `.topbar` /
  `.filterbar` / `.viewport` thành ba hàng; `.viewport` giờ `position: absolute;
  inset: 0`. Toàn bộ chrome nổi đè lên canvas, chiếm **0px** trong layout — trước
  đây hai dải trên ăn ~140px vĩnh viễn, tức 21% chiều cao trên laptop 1366×768,
  kể cả bảng trống không bật lọc nào.
- **Bốn đảo nổi.** Trên trái: ☰ + tên board + tìm kiếm + 5 nút icon (4 panel + ★).
  Trên phải: ai đang mở board + mời. Dưới trái: hoàn tác/làm lại. Dưới phải: zoom
  (đã có sẵn, chỉnh cho khớp mép 12px và bo góc 10px của họ đảo).
- **Đảo to vừa là bảng điều khiển vừa là chỗ neo.** Panel nhỏ kéo vào trong nó thì
  neo, kéo ra thì nổi tự do — đúng cơ chế cũ, chỉ đổi vùng thả từ một dải ngang
  suốt màn hình thành cái khay trong đảo. Khay **co về 0** khi không panel nào
  neo, thay cho 38px giữ chỗ vĩnh viễn.
- **Một ☰ thay cho ba menu.** Board / Dữ liệu / Xem + ngôn ngữ + sáng-tối + skin
  gom hết vào một nút. Tên board 13px thường thay cho `h1` Anton 19px kèm dòng
  eyebrow "BẢN ĐỒ Ý TƯỞNG" — riêng hai dòng đó là ~37px.
- **Ô tìm kiếm thu về một nút**, bung ra khi bấm hoặc `Ctrl+F`, đóng lại thì xoá
  luôn từ khoá.

### File chính

| File | Vai trò |
|---|---|
| `client/src/styles/idea-map.css` | `.shell` / `.viewport` đổi mô hình layout; thêm họ `.island` (`.tl/.tr/.bl/.br`), `.island-row/-btn/-sep/-name`, `.island-dock`; bỏ `.topbar`, `.filterbar`, `.topbar-prefs`; dời `.outline-panel` / `.io-drawer` / `.readonly-banner` né đảo |
| `client/src/pages/IdeaMap.jsx` | Chín icon SVG mới cho HUD; ba đảo thay cho hai dải; gộp ba `TopMenu` thành một ☰; state `searchOpen` + `toggleSearch` + effect focus |
| `client/src/components/DockPanel.jsx` | Bật/tắt `.drag-active` trên khay lúc kéo; sửa lại comment về vùng kẹp |
| `client/src/__smoke__/entry.jsx` | Sửa hai chỗ bám `.topbar`; thêm chặng cấu trúc HUD, chặng khay co lại, chặng ô tìm |
| `client/src/locales/en/messages.po` | Ba chuỗi mới |

### Khác với plan

- **Khay neo CO VỀ 0, không `display: none`** như plan viết. `display:none` giấu
  cả cây con, mà panel **nổi** vẫn là con của khay (chúng `position: fixed` nên
  không chiếm chỗ trong dòng chảy) — mọi panel nổi sẽ biến mất khỏi màn hình.
  Cho panel nổi ra ngoài khay thì tránh được, nhưng lúc kéo một panel từ neo sang
  nổi, cờ `free` lật ngay ở mousemove đầu tiên → đổi cha → React gắn lại phần tử
  mới, còn closure của lượt kéo vẫn giữ phần tử CŨ đã lìa cây và `offsetWidth`
  của nó thành 0. Giữ chung một cha là điều kiện để lượt kéo sống.
- **Phải thêm `.drag-active`** — không có trong plan. Khay co về 0 thì
  `getBoundingClientRect()` trả một dải cao 0, `overBar()` không bao giờ đúng, và
  panel nổi cuối cùng rời khay là **không còn đường nào neo lại**. Giờ khay bung
  ra thành ô nét đứt cao 34px suốt lượt kéo. Bật ở lần mousemove vượt ngưỡng chứ
  không ở mousedown: bấm-không-kéo là lệnh xoay ngang/dọc, không nên làm khay
  nhấp nháy.
- **Panel nổi nằm TRÊN đảo, không chui xuống gầm** như tôi nói lúc đề xuất.
  `.island` là `position: absolute; z-index: 50` nên nó tạo stacking context;
  `.dock-panel.free` là con của nó, `z-index: 40` chỉ có nghĩa *trong* context đó,
  và nó vẫn vẽ sau nền của đảo. Giữ nguyên vì hướng này an toàn hơn: panel bị che
  mất thì người dùng tưởng nó biến mất, còn panel che đảo thì kéo đi là xong.
- **`dock.js` không sửa dòng nào**, đúng dự đoán: `canvasBounds()` đọc rect của
  `.viewport`, mà `.viewport` giờ tràn viền nên vùng kẹp tự nới thành cả khung
  nhìn. Ý nghĩa của hàm thì đổi — nó không còn đảm bảo "panel không che lên thanh
  nào" được nữa, vì không còn thanh nào để né.
- **`.island.tl` phải có trần bề rộng 720px** — không có trong plan. `flex-wrap`
  của khay cần một mốc để xuống dòng; thiếu nó thì neo bốn panel là đảo kéo dài
  tới sát đảo người ở góc bên kia.
- Ô tìm kiếm **đóng lại thì xoá từ khoá**. Từ khoá tính vào `activeFilterCount` và
  làm mờ thẻ không khớp; giữ nó sống trong khi ô nhập biến mất là một bộ lọc vô
  hình, không còn chỗ nào nhìn ra vì sao thẻ bị mờ.

### Hai chỗ smoke test đang nói dối, phát hiện khi sửa

- Nút đổi skin giờ nằm trong menu ☰, mà bấm một mục là menu tự đóng và nút rời
  khỏi cây. Test đang giữ một tham chiếu rồi bấm nó **hai** lần — cú thứ hai rơi
  vào node đã lìa cây, không làm gì cả, và test vẫn chạy tiếp. Đổi thành mở lại
  menu và tìm lại nút cho mỗi lần bấm.
- Ba chuỗi mới chưa qua `i18n:extract` nên `t` trả về **mã băm** (`"4r3iJS"`) thay
  vì tiếng Việt, làm mọi phép tìm theo `title` trượt. Đây là lý do đáng để chạy
  extract ngay khi thêm chuỗi chứ không để tới cuối.

### Còn dở / cần lưu ý

- **Chưa kiểm bằng mắt trên trình duyệt** — phiên này không có công cụ điều khiển
  trình duyệt. jsdom không tính layout, nên ba chặng smoke mới chỉ kiểm được
  *cấu trúc* (hai dải cũ đã rời khỏi cây, ba đảo có mặt, khay mất class `.on`),
  **không** kiểm được điều quan trọng nhất là canvas có thật sự cao bằng cửa sổ.
  Danh sách kiểm tay cuối file plan còn nguyên.
- **Màn hẹp chưa xử lý.** Dưới ~900px, ô tìm và tên board thu lại, nhưng nếu neo
  nhiều panel thì đảo to vẫn có thể chạm đảo người — lúc đó đảo người vẽ đè lên.
  Chấp nhận trong đợt này.
- **Màn thấp chưa xử lý.** Đảo to phình xuống (neo nhiều panel) và thanh công cụ
  trái căn giữa dọc có thể đụng nhau dưới ~600px chiều cao. Cùng lý do đó,
  `.readonly-banner` đặt ở `bottom: 58px` cũng có thể đụng đuôi rail trên màn rất
  thấp.
- `.spacer` không còn chỗ dùng nào trong `IdeaMap.jsx` nhưng vẫn giữ trong CSS —
  nó là class tiện ích chung, các trang khác có thể đang dùng.
