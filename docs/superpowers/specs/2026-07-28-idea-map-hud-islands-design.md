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
│ ┌──────────────────────────┐   ┌──────────────┐  │
│ │ ☰  Sơ đồ A  🔍 │ ⬤🏷🎨◐ ★│   │ ●●●  + Mời   │  │  đảo to (trái)   / đảo người (phải)
│ │ ┌──────────┐ ┌─────────┐ │   └──────────────┘  │
│ │ │⠿Trạng thái│ │⠿Nhãn   │ │                     │  khay neo — chỉ hiện khi có panel neo
│ │ └──────────┘ └─────────┘ │                     │
│ └──────────────────────────┘                     │
│ ┌──┐                    ┌──────────────┐         │
│ │▮ │                    │⠿ Bảng màu   ×│         │  đảo nhỏ nổi tự do
│ │▮ │  ← rail (giữ nguyên)└──────────────┘         │
│ └──┘                                             │
│ ┌────┐                        ┌───────────────┐  │
│ │↶ ↷ │                        │ − 100% + ⛶   │  │  đảo hoàn tác / đảo zoom
│ └────┘                        └───────────────┘  │
╰──────────────────────────────────────────────────╯
```

**Đảo to là chỗ neo, không phải một dải.** Nó co lại còn bằng header của chính
nó khi không panel nào neo vào. Panel nhỏ kéo vào trong nó thì neo, kéo ra ngoài
thì nổi tự do — đúng cơ chế `.fb-dock` đang có, chỉ đổi vùng thả.

## Quyết định

**Đảo to phình sang phải, không phình xuống.** Thanh công cụ trái căn giữa dọc;
ở draw mode nó cao ~426px (3 khung: 2+4+4 nút, `.tool-btn` 34px, gap 10px) nên
trên màn 660px nó chiếm y≈117..543. Đảo to ở góc trên trái mà neo panel theo cột
dọc thì chỉ được ~105px là đụng rail. Neo theo hàng ngang, `flex-wrap` xuống dòng
khi hết chỗ — nhưng bó trong bề rộng đảo, không suốt màn hình như hiện nay.

**`dock.js` không phải sửa.** `canvasBounds()` trong `DockPanel.jsx` đọc
`getBoundingClientRect()` của `.viewport`; `.viewport` tràn viền thì nó tự trả về
cả khung nhìn. Hệ quả: tiền đề cũ "panel không bao giờ che lên thanh trên" mất.
Chấp nhận — panel z-index 45, đảo z-index 50, kéo panel vào gầm đảo thì nó khuất,
kéo ra là thấy lại. Không dựng thêm luật kẹp; luật càng nhiều càng khó đoán.

**Tìm kiếm thu về một nút.** Ô input 180px + nhãn chiếm chỗ thường trực cho việc
thỉnh thoảng mới dùng. Bấm nút hoặc `Ctrl+F` mới bung ra.

**Bỏ eyebrow và `.display` 19px.** Trang này là bản đồ ý tưởng, không cần một
dòng chữ nhắc điều đó; và tên board 13px thường đọc vẫn rõ. Đây là hai thứ đắt
nhất trong `.topbar` (~37px chiều cao).

**Bốn nút bật panel hiện thẳng trong đảo to, dạng icon.** Chữ đầy đủ
"Trạng thái / Nhãn / Bảng màu / Giao diện" ~280px; icon 4×28=112px. Giấu sau ☰
thì tốn một cú bấm mỗi lần — đây là cách duy nhất triệu hồi panel.

## Cái gì đi đâu

| Hiện tại | Sau |
|---|---|
| eyebrow "BẢN ĐỒ Ý TƯỞNG" | bỏ hẳn |
| `h1.display` 19px Anton | tên board 13px thường, trong đảo to |
| TopMenu Board / Dữ liệu / Xem | gộp thành một ☰ |
| LocaleToggle, sáng/tối, skin | vào trong ☰ |
| Undo / Redo | đảo riêng góc dưới trái |
| Ô tìm kiếm 180px | nút 🔍, bung ra khi bấm / `Ctrl+F` |
| 4 nút panel + ★ Yêu thích | icon trong đảo to |
| Khớp N/M + Xoá lọc | hàng thứ hai trong đảo to, chỉ khi đang lọc |
| `.fb-dock` (39px luôn giữ chỗ) | khay trong đảo to, `display:none` khi rỗng |
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
