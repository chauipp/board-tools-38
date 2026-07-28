# Thiết kế — HUD đảo nổi, canvas tràn viền

Ngày: 2026-07-28
Nhánh: `idea-map-hud-islands`

## Vấn đề

`.shell` là một flex column ba hàng: `.topbar` / `.filterbar` / `.viewport`. Hai
hàng đầu **đẩy** canvas xuống chứ không nổi trên nó, nên chúng ăn chỗ vĩnh viễn:

| Dải | Cao | Thành phần |
|---|---|---|
| `.topbar` | ~60px | padding 10×2 + khối tiêu đề ~37 (eyebrow 10px + h1 Anton 19px) + viền dưới 3px |
| `.filterbar .fb-tabs` | ~40px | padding 7×2 + nút `.btn` 25px |
| `.filterbar .fb-dock` | ~39px | `min-height: 38px` + viền trên 1px |
| **Tổng** | **~140px** | |

Trên laptop 1366×768, vùng nhìn còn ~660px sau chrome trình duyệt → **21% mặt
bàn vẽ mất trước khi vẽ nét nào**. Excalidraw và Miro đều mất 0px.

`.fb-dock` là chỗ tệ nhất: 39px giữ chỗ **kể cả khi rỗng**, cố ý theo comment
trong code ("Giữ chỗ cả khi rỗng để panel vừa bật lên luôn có dải riêng").

## Hình dạng đích

Canvas tràn viền. Mọi chrome là **đảo nổi** đè lên nó, chiếm 0px trong layout.

```
╭──────────────────────────────────────────────────╮
│ ┌────────────────────────┐   ┌──────────────┐    │
│ │ ☰  Sơ đồ A   🔍 │ ★    │   │ ●●●  + Mời   │    │  đảo trên trái / đảo người
│ └────────────────────────┘   └──────────────┘    │
│ ┌──┐                                             │
│ │▮ │                                             │
│ │▮ │  ← rail (giữ nguyên)                         │
│ └──┘                                             │
│ ┌────┐   ┌───────────┐┌──────────────────────┐   │
│ │↶ ↷ │   │ ⬤ 🏷 🎨 ▦ ││TRẠNG THÁI ●Mới ●Đang │   │
│ └────┘   └───────────┘└──────────────────────┘   │
│                            ↑ hiện khi bật panel  │
│                                    ┌───────────┐ │
│                                    │ − 100% + ⛶│ │
╰────────────────────────────────────└───────────┘─╯
```

**Thanh đáy: một đảo nút, một đảo nội dung.** Bốn nút bật panel luôn ở đó; đảo
nội dung chỉ tồn tại khi có panel đang bật, và **biến mất khỏi cây** khi tắt hết.

**Panel không kéo được đi đâu.** Bỏ hẳn cơ chế neo/nổi: không `layouts`, không
hút mép, không đường gióng, không vùng thả. Panel sống ở đúng một chỗ. Đổi lại
thì cũng không còn cách nào làm mất nó, và `lib/dock.js` + toàn bộ lượt kéo
trong `DockPanel.jsx` biến mất theo (~19 test, ~4KB bundle).

## Quyết định

**Panel xuống đáy, không ở cạnh nút bật trên đỉnh.** Đỉnh màn hình đã có ba thứ
tranh chỗ (đảo trên trái, đảo người, và `.focus-banner` ở giữa), còn đáy giữa
đang trống. Panel lọc là thứ mở ra rồi để đó cả buổi nên nó cần chỗ rộng và ổn
định, không phải chỗ đắt nhất màn hình.

**Cụm đáy căn giữa, trần bề rộng tính theo bên chật hơn.** Cụm căn giữa nên trần
trừ 2×N là chừa N mỗi bên; nút zoom bên phải rộng ~180 + mép 12 = 192, đảo hoàn
tác bên trái chỉ ~88. Lấy 210 mỗi bên → `calc(100vw - 420px)`.

**Mọi thứ "giao diện" về một chỗ.** Sáng/tối và skin đang nằm trong ☰, nền bảng
và bộ màu nằm trong panel — cùng một họ mà rải hai nơi, muốn chỉnh thì phải nhớ
mở hai chỗ. Gom cả vào panel Giao diện, kéo theo cả ngôn ngữ (nó cũng là thiết
lập hiển thị của từng người; để lại một mình trong ☰ thì thành mồ côi).

**Panel Giao diện chia đôi có nhãn.** Ngôn ngữ / sáng-tối / kiểu vẽ chỉ đổi cho
mình (localStorage); nền bảng / bộ màu ghi vào dữ liệu board nên **mọi người cùng
thấy**. Không nói rõ thì người ta đổi nền bảng mà tưởng chỉ mình thấy.

**Nút bật panel Giao diện đứng tách sau một vạch ngăn.** Ba nút cạnh nó mở ra bộ
LỌC (bấm chip là thẻ bị làm mờ), nó mở ra THIẾT LẬP và không lọc gì cả.

**Mỗi panel tự xưng tên.** Bản cũ chỉ hiện tên khi panel nổi, vì lúc neo thì mỗi
panel là một khối riêng có viền. Giờ nhiều panel bật cùng lúc nằm liền một dải
trong cùng một đảo, không còn gì để mắt tự tách ra.

**Tìm kiếm thu về một nút.** Ô input 180px + nhãn chiếm chỗ thường trực cho việc
thỉnh thoảng mới dùng. Bấm nút hoặc `Ctrl+F` mới bung ra.

**Bỏ eyebrow và `.display` 19px.** Trang này là bản đồ ý tưởng, không cần một
dòng chữ nhắc điều đó; và tên board 13px thường đọc vẫn rõ. Đây là hai thứ đắt
nhất trong `.topbar` (~37px chiều cao).

**Bốn nút bật panel hiện thẳng dạng icon, không giấu sau ☰.** Chữ đầy đủ
"Trạng thái / Nhãn / Bảng màu / Giao diện" ~280px; icon 4×28=112px. Giấu đi thì
tốn một cú bấm mỗi lần — đây là cách duy nhất triệu hồi panel.

## Cái gì đi đâu

| Hiện tại | Sau |
|---|---|
| eyebrow "BẢN ĐỒ Ý TƯỞNG" | bỏ hẳn |
| `h1.display` 19px Anton | tên board 13px thường, trong đảo trên trái |
| TopMenu Board / Dữ liệu / Xem | gộp thành một ☰ |
| LocaleToggle, sáng/tối, skin | vào panel Giao diện, cùng nền bảng + bộ màu |
| Undo / Redo | đảo riêng góc dưới trái |
| Ô tìm kiếm 180px | nút 🔍, bung ra khi bấm / `Ctrl+F` |
| 4 nút panel | icon ở đảo nút, thanh đáy (Giao diện tách sau vạch ngăn) |
| ★ Yêu thích | icon trong đảo trên trái |
| Khớp N/M + Xoá lọc | hàng thứ hai trong đảo trên trái, chỉ khi đang lọc |
| `.fb-dock` (39px luôn giữ chỗ) | đảo nội dung ở thanh đáy, không render khi rỗng |
| PresenceBar | đảo riêng góc trên phải |
| ToolRail, ToolOptions, zoom-ctrl | giữ nguyên vị trí |

## Va chạm phải xử lý

Bốn overlay đang định vị theo `.viewport` cũ (đã trừ 140px trên đầu). Canvas tràn
viền thì chúng trượt lên và đụng đảo:

| Overlay | Vị trí hiện tại | Đụng |
|---|---|---|
| `.outline-panel` | `top:12 right:12` | đảo người (trên phải) |
| `.io-drawer` | `top:14 right:14` | đảo người |
| `.readonly-banner` | `bottom:14 left:14` | đảo hoàn tác (dưới trái) |
| `.focus-banner` | `top:12` giữa | không đụng (giữa trên trống) |

## Ngoài phạm vi

- Không đổi `.tool-rail` / `.tool-options` — chúng đã nổi đúng cách rồi.
- Không đụng canvas, thẻ, dây, ink. Đây thuần tuý là lớp HUD.
- Không đụng server.
- Không làm responsive cho màn hẹp (<900px) trong đợt này.

## Plan thực thi

[`docs/superpowers/plans/2026-07-28-idea-map-hud-islands.md`](../plans/2026-07-28-idea-map-hud-islands.md)
