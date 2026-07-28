# Plan — HUD đảo nổi, canvas tràn viền

Spec: [`docs/superpowers/specs/2026-07-28-idea-map-hud-islands-design.md`](../specs/2026-07-28-idea-map-hud-islands-design.md)

Nhánh: `idea-map-hud-islands` (từ `idea-map-theme-sketch`)

Thứ tự cố ý: dựng khung xương trước (Task 1) rồi mới nhét nội dung vào từng đảo.
Làm ngược lại thì mỗi task đều phải sống chung với layout cũ một lúc.

---

- [x] **Task 1: Khung xương — canvas tràn viền, lớp `.island` dùng chung**

  - [x] Step 1: `.shell` bỏ `flex-direction: column`, đổi thành `position: relative`
  - [x] Step 2: `.viewport` thành `position: absolute; inset: 0` (đang là `flex: 1`)
  - [x] Step 3: Thêm class `.island` — mặt kính dùng chung với `.tool-group`
        (nền `--surface`, viền 1px `--line`, `border-radius: 12px`, `box-shadow`),
        `position: absolute; z-index: 50`
  - [x] Step 4: Bốn lớp vị trí `.island.tl / .tr / .bl / .br` (12px mỗi mép)
  - [x] Step 5: `npm run build` sạch — lúc này trang sẽ vỡ hình, đó là bình thường

- [x] **Task 2: Đảo to — ☰ gộp menu, tên board, tìm kiếm thu gọn**

  - [x] Step 1: Gộp ba `TopMenu` (Board / Dữ liệu / Xem) + `.topbar-prefs` thành
        một `TopMenu` nhãn ☰, chia mục bằng `.menubar-sep`
  - [x] Step 2: Tên board 13px thường; bỏ `.eyebrow` và `h1.display`
  - [x] Step 3: Nút 🔍 mở/đóng ô tìm; `Ctrl+F` mở và focus (đang có `searchInputRef`)
  - [x] Step 4: Ô tìm bung ra thì đẩy đảo rộng thêm, không đè lên gì
  - [x] Step 5: `npm test` + `npm run test:smoke` xanh

- [x] **Task 3: Đảo to — 4 nút bật panel dạng icon + ★ + đuôi lọc**

  - [x] Step 1: Bốn icon SVG cho Trạng thái / Nhãn / Bảng màu / Giao diện
        (vẽ path, không dùng emoji — theo `currentColor` như `ToolRail.jsx`)
  - [x] Step 2: `.island-btn` 28px, trạng thái `.on` như `.tool-btn.on`
  - [x] Step 3: ★ Yêu thích thành nút cùng cỡ, bỏ dạng `.chip-toggle`
  - [x] Step 4: "Khớp N/M + Xoá lọc" xuống hàng hai trong đảo, chỉ khi
        `activeFilterCount > 0`

- [x] **Task 4: Đảo to — khay neo bên trong**

  - [x] Step 1: `.fb-dock` → `.island-dock` nằm trong đảo to; CO VỀ 0 khi không
        panel nào neo (thay cho `min-height: 38px` luôn giữ chỗ). Không dùng
        `display: none` như dự định ban đầu — xem summary.
  - [x] Step 2: `fbDockRef` trỏ vào phần tử mới — `DockPanel` không phải sửa,
        `barRef` vốn chỉ là "phần tử làm vùng thả"
  - [x] Step 3: Panel neo chảy ngang, `flex-wrap: wrap`, bó trong bề rộng đảo
  - [x] Step 4: Giữ nguyên `.drop-target` sáng lên khi kéo panel qua khay
  - [x] Step 5: Kiểm: bật panel → neo → kéo ra nổi → kéo vào neo lại

- [x] **Task 5: Đảo người (trên phải) + đảo hoàn tác (dưới trái)**

  - [x] Step 1: `PresenceBar` ra đảo `.tr`; bỏ `margin-left:auto` và vạch ngăn
        trái (không còn nằm cuối một hàng nữa)
  - [x] Step 2: Undo/Redo ra đảo `.bl`
  - [x] Step 3: Báo lỗi lưu (`saveError`) — chuyển xuống cạnh đảo hoàn tác

- [x] **Task 6: Dọn va chạm của các overlay cũ**

  - [x] Step 1: `.outline-panel` `top: 12` → chừa đảo người (`top: 58`)
  - [x] Step 2: `.io-drawer` như trên
  - [x] Step 3: `.readonly-banner` dời khỏi góc dưới trái (đụng đảo hoàn tác)
  - [x] Step 4: Rà `.bulk-bar` / `.present-bar` / `.focus-banner` xem còn đụng gì
  - [x] Step 5: Soát z-index toàn cục: canvas 1-7, ink-capture 8, rail 30,
        panel 45, **đảo 50**, popover 90

- [x] **Task 7: Kiểm, i18n, tài liệu**

  - [x] Step 1: Cập nhật smoke test — nó đếm cứng số nút và tìm theo `.topbar`
  - [x] Step 2: Thêm chặng smoke: đảo không chiếm chỗ (`.viewport` cao bằng cửa sổ)
  - [x] Step 3: `npm run extract` + dịch chuỗi mới sang EN
  - [x] Step 4: `npm test`, `npm run test:smoke`, `npm run build` — cả ba xanh
  - [x] Step 5: Viết summary, nối chuỗi spec ↔ plan ↔ summary

- [x] **Task 8: Panel xuống thanh đáy, bỏ hẳn kéo thả** *(bổ sung sau khi người dùng xem bản chạy thật)*

  - [x] Step 1: Tách `.island` thành mặt-kính (không định vị) và `.tl/.tr/.bl`
        (neo góc); thêm `.hud-bottom` — bao ngoài trong suốt, hai đảo con
  - [x] Step 2: Bốn nút bật panel rời đảo trên trái xuống đảo nút ở thanh đáy;
        ★ Yêu thích ở lại (nó không mở ra khối nội dung nào)
  - [x] Step 3: `.island-dock` → `.filter-dock` trong đảo nội dung; đảo này không
        render khi không panel nào bật (`anyPanelOn`)
  - [x] Step 4: `DockPanel.jsx` → `FilterPanel.jsx`, bỏ toàn bộ lượt kéo; tên
        panel luôn hiện (`.filter-title`)
  - [x] Step 5: Xoá `lib/dock.js` + `lib/dock.test.js` + state `layouts` +
        `fbDockRef` + effect `saveLayouts`
  - [x] Step 6: `.bulk-bar` lên `bottom: 60px` nhường đáy giữa cho `.hud-bottom`
  - [x] Step 7: Cập nhật chặng smoke; thêm phép kiểm "không còn phần tử kéo-thả"
  - [x] Step 8: `npm test` 291/291 · smoke xanh · build sạch · i18n 226/226

---

## Kiểm bằng mắt (phiên này không có công cụ trình duyệt — để lại cho người dùng)

- [ ] Bảng trống: có đúng là **không còn dải nào** ăn chỗ trên đầu không
- [ ] Bật cả 4 panel cùng lúc — đảo nội dung ở đáy có phình quá rộng / quá cao
      không, và bốn nhãn panel có đọc ra được là bốn khối riêng không
- [ ] Bảng màu nhiều màu (>20 ô): đảo nội dung có cuộn trong `max-height: 40vh`
      thay vì cao vống lên không
- [ ] Cụm đáy có đụng đảo hoàn tác (trái) hoặc nút zoom (phải) không, ở 1366 và
      ở màn hẹp ~1024
- [ ] Chọn nhiều thẻ: thanh nhiều lựa chọn có nằm gọn TRÊN cụm đáy không
- [ ] Mode Sửa: rail + khu 4 có đụng cụm đáy không
- [ ] Mở Mục lục + đảo người cùng lúc — có chồng nhau không
- [ ] Chế độ chỉ xem: banner có đụng đảo hoàn tác không
- [ ] Cả hai skin (sạch / vẽ tay) × cả hai theme (sáng / tối)

## Kết quả

[`docs/superpowers/summaries/2026-07-28-idea-map-hud-islands-summary.md`](../summaries/2026-07-28-idea-map-hud-islands-summary.md)
