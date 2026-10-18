# Thiết kế: Ô nhóm, dây tuỳ biến & màu card cho Bản đồ ý tưởng

Ngày: 2026-07-24

## 1. Mục tiêu

Mở rộng bản đồ ý tưởng với ba nhóm tính năng:

1. **Ô nhóm (group frame):** một khung chứa để "gom" nhiều card. Kéo card thả vào khung thì card **thuộc về** khung; kéo khung thì mọi card bên trong đi theo. Khung resize được.
2. **Dây tuỳ biến:** mỗi dây có thể đổi **màu**, bật/tắt **mũi tên**, **nét đứt**, **độ đậm**. Dây nối được từ card tới **card** hoặc tới **ô nhóm**.
3. **Màu card & ô nhóm:** tô màu nền (tint) từ bảng màu sẵn có; ring khi hover/chọn dùng màu đầy đủ để nhận biết nhanh.

### Trong phạm vi
- Ô nhóm: tạo khung rỗng, kéo di chuyển (card theo cùng), thả card vào/ra để đổi thành viên, resize kéo góc, đổi màu, đổi tên, xoá.
- Dây nối tới card **hoặc** ô nhóm; đầu dây cắt tới **biên** phần tử đích.
- Chọn dây bằng **click chuột trái** (kiểu Miro) → thanh công cụ nổi để đổi màu / mũi tên / nét đứt / độ đậm / xoá.
- Màu card & ô nhóm qua **chuột phải** → menu bảng màu + lối vào Sửa/Xoá.
- Di trú board hiện có sang mô hình mới, không mất dữ liệu.

### Ngoài phạm vi
- "Nhóm từ vùng chọn" (marquee-select rồi gom) — v1 chỉ tạo khung rỗng rồi kéo card vào. Có thể thêm sau.
- Ô nhóm lồng nhau (group trong group). Một cấp là đủ.
- Thu gọn/ẩn nội dung ô nhóm (đã cân nhắc, không chọn).
- Đổi màu **theo từng badge trên pill của thẻ** (không liên quan).
- Dựng test framework (dự án không có, đã chốt không thêm). Kiểm chứng bằng `i18n:extract` + `build` + click-test thủ công.

## 2. Hiện trạng

| Thứ | Hiện tại |
|---|---|
| Node | `{ id, title, desc, tagId, statusId, x, y }` |
| Edge | `{ id, from, to }` — **vô hướng**, vẽ đường **tâm–tâm**; **click trái = xoá dây** |
| Lớp vẽ | `svg.edge-layer` (dưới) → card (trên); card ở trên nên đường tâm–tâm bị card che, chỉ thấy đoạn giữa hai thẻ |
| Màu badge | token palette (`--st-*`, `--dot-1..8`) resolve qua `colorVar(token)` = `var(--token)`; danh sách trong `BADGE_PALETTE` (`client/src/lib/badges.js`) |
| Chuột phải | Trang chặn menu native (`handlePageContextMenu`), trừ input/textarea; chip badge chuột phải mở `BadgeEditor` |
| Server | Board singleton; `PUT /api/ideas` destructure **cố định** `nodes, edges, statuses, tags, next*Id, view` — field top-level mới **bị âm thầm rớt** nếu không thêm vào đây |

## 3. Mô hình dữ liệu

### 3.1 Ô nhóm — mảng top-level mới

```
board.groups = [{ id: <int>, title: <string>, x, y, w, h, color: <token|null> }, …]
board.nextGroupId = <int>
```

- `x, y` = góc trên-trái trong toạ độ canvas; `w, h` = kích thước (resize được).
- `color = null` → nền trung tính; token → tint nền + ring/viền màu.
- Mặc định khi tạo: `w = 320, h = 220`. Kích thước tối thiểu khi resize: `w ≥ 160, h ≥ 120`.

### 3.2 Node — thêm hai field (đều optional, mặc định `null`)

```
node.groupId = <int|null>   // thuộc ô nhóm nào (back-reference, nguồn sự thật duy nhất)
node.color   = <token|null> // màu nền thẻ; null = trung tính
```

Chọn back-reference trên node (không dùng `group.memberIds`) để chỉ có **một nguồn sự thật**: thành viên của ô `g` = `nodes.filter(n => n.groupId === g.id)`, không phải đồng bộ hai chiều.

### 3.3 Edge — thêm các field kiểu & đích (đều optional)

```
edge.fromKind = "node" | "group"   // mặc định "node" (dây cũ không có field này ⇒ coi là node)
edge.toKind   = "node" | "group"   // mặc định "node"
edge.color    = <token|null>       // null = màu dây mặc định hiện tại
edge.arrow    = <bool>             // mặc định false — mũi tên ở đầu `to`
edge.dashed   = <bool>             // mặc định false
edge.width    = "thin" | "normal" | "thick"   // mặc định "normal"
```

`from`/`to` vẫn là **id số**; ý nghĩa id (node hay group) do `fromKind`/`toKind` quyết định. Dây cũ `{id, from, to}` vẫn hợp lệ, mặc định là node→node, normal, không mũi tên, không đứt.

Ánh xạ `width`: `thin = 1.5px`, `normal = 2.5px` (đúng hiện tại), `thick = 4px`.

## 4. Server — schema + di trú + persist

**Schema (`ideaBoardSchema`):** thêm
```js
groups: { type: Array, default: [] },
nextGroupId: { type: Number, default: 1 },
```

**`PUT /api/ideas`:** thêm `groups, nextGroupId` vào destructure và vào object `findOneAndUpdate`. Bỏ sót ⇒ ô nhóm không bao giờ lưu được.

**`GET /api/ideas` (trong `migrateBoard`, idempotent):** nếu `!Array.isArray(doc.groups)` thì gán `doc.groups = []`, `doc.nextGroupId = 1`, đánh dấu `changed = true`. Các field mới trên node/edge là optional nên **không** cần lặp từng node/edge — thiếu thì đọc ra `undefined`, client coi như mặc định.

**Ghi vào block `findOneAndUpdate` của GET:** thêm `groups`, `nextGroupId` vào danh sách field cập nhật khi `migrateBoard` báo có thay đổi.

## 5. Ô nhóm (frame)

### 5.1 Tạo
- Nút **"+ Nhóm"** trên topbar (cạnh "+ Ý tưởng"). Tạo ô rỗng ở giữa viewport hiện tại: `{ id: nextGroupId, title: "Nhóm mới", x, y, w:320, h:220, color:null }`, tăng `nextGroupId`. Vào history + lưu.

### 5.2 Render — lớp dưới cùng
Thứ tự lớp trong `.canvas`: **groups (dưới)** → `svg.edge-layer` → **cards (trên)**. Mỗi ô là một `<div class="group-frame">` định vị tuyệt đối theo `x,y,w,h`, gồm:
- **Thanh tiêu đề** (trên cùng, cao ~28px): tên nhóm; là vùng kéo di chuyển.
- **Thân** rỗng (chỉ là nền/viền) để card nằm đè lên trên.
- **Tay nắm resize** ở góc dưới-phải.

Card **không** là con DOM của ô (vẫn là con trực tiếp của `.canvas`, định vị theo toạ độ canvas). Quan hệ "thuộc nhóm" thuần logic qua `groupId`. Điều này giữ nguyên toàn bộ cơ chế kéo/marquee/connector của card.

### 5.3 Di chuyển — card đi theo
Kéo **thanh tiêu đề** ô → tính `dx, dy` (chia `view.scale`), dịch `x,y` của ô **và** dịch `x,y` của mọi node có `node.groupId === g.id`. Kết thúc kéo (nếu có di chuyển) → history + lưu. Dùng chung mẫu `onMove/onUp` như `handleNodeMouseDown`.

### 5.4 Thành viên — cập nhật **chỉ khi thả card**
Chỉ thay đổi `groupId` khi **kéo một card và thả**:
- Sau khi thả, xét tâm card: nếu nằm trong biên một ô → `groupId = ô.id` (nếu đè nhiều ô, chọn ô **trên cùng** theo thứ tự mảng cuối/nhỏ nhất — quy ước: ô có index lớn hơn = vẽ sau = "trên", ưu tiên ô đó). Nếu không nằm trong ô nào → `groupId = null`.
- Trong lúc kéo card, ô đang chứa tâm card được **làm sáng viền** (class `drop-target`, tái dùng ý tưởng có sẵn).
- **Di chuyển hoặc resize ô KHÔNG đổi thành viên** — thành viên chỉ đổi do thao tác trên card. Hành vi này dễ đoán.

Ghi chú: khi kéo **cả nhóm card đã chọn** (marquee) thì mỗi card được xét lại `groupId` theo tâm của chính nó lúc thả.

### 5.5 Resize
Kéo tay nắm góc dưới-phải → cập nhật `w,h` (chia `view.scale`), ép `w ≥ 160, h ≥ 120`. Kết thúc → history + lưu. Không đổi thành viên.

### 5.6 Chuột phải ô → menu
`onContextMenu` trên ô mở popover tại con trỏ, gồm:
- **Hàng ô màu** palette (gồm ô "bỏ màu" = `null`) — bấm áp ngay.
- **Đổi tên** — bật **inline edit** trên thanh tiêu đề (double-click thanh tiêu đề cũng bật inline edit). Threshold kéo phân biệt double-click với thao tác kéo di chuyển.
- **Xoá** — xoá ô khỏi `groups`; mọi node có `groupId === id` được gỡ về `groupId = null` (**giữ card**, chỉ tan nhóm). Cũng xoá các edge có đầu trỏ tới group này (`fromKind/toKind === "group" && id khớp`).

Tên nhóm là **dữ liệu người dùng** → không bọc `<Trans>` (theo quy tắc "trong DB thì không dịch").

## 6. Nối dây tới card hoặc ô

### 6.1 Tạo dây
Mở rộng `handleConnectorMouseDown`: khi thả, dò phần tử đích tại con trỏ — có thể là `.idea-card` **hoặc** `.group-frame`.
- Đích là card khác → `{ from: node.id, fromKind:"node", to: targetId, toKind:"node" }`.
- Đích là ô nhóm → `{ ..., to: groupId, toKind:"group" }`.
- Không tạo dây trỏ về chính card nguồn.
- Kế thừa **kiểu mặc định** cho dây mới: `color:null, arrow:false, dashed:false, width:"normal"`.

`toggleEdge` cần so khớp theo cả `(id, kind)` để tránh nhầm node id với group id trùng số.

### 6.2 Hình học — cắt tới biên
Thay đường **tâm–tâm** bằng đường **biên–biên**: tính tâm hai đầu, rồi cắt mỗi đầu về giao điểm với **hình chữ nhật biên** của phần tử đầu đó (card hoặc group). Kết quả: dây chạm mép thẻ/ô, không chui vào giữa (quan trọng với ô to). Áp dụng cho **cả** đầu node và đầu group.

Helper thuần: `clipToRect(cx, cy, ox, oy, rect) -> {x, y}` (điểm trên biên `rect` theo hướng từ tâm phần tử tới điểm kia). Tính được từ `x,y,w,h` của group và `offsetWidth/Height` của card (như code hiện dùng cho card).

### 6.3 Lớp vẽ
Group ở **dưới** `edge-layer` nên dây vẽ tới biên group nằm **trên** nền group → luôn thấy. Card ở **trên** edge-layer; nhờ cắt biên, đầu dây dừng ở mép card nên không bị thân card che.

## 7. Chọn & chỉnh dây (kiểu Miro)

### 7.1 Chọn bằng click trái
- **Bỏ** hành vi "click trái xoá dây" hiện tại.
- Mỗi dây có một `<line class="hit">` trong suốt, dày (~14px) để dễ bấm. `onClick` trên hit → `setSelectedEdgeId(edge.id)`.
- Dây được chọn: thêm class `selected` (đậm hơn/nổi bật). Click ra vùng trống canvas → bỏ chọn (`selectedEdgeId = null`).
- Phím **Delete/Backspace** khi có dây đang chọn (và không đang gõ input) → xoá dây đó.

### 7.2 Thanh công cụ nổi
Khi có `selectedEdgeId`, hiện `EdgeToolbar` (component mới) ở toạ độ **màn hình** gần **giữa dây** (đổi từ toạ độ canvas qua `view`), gồm:
- **Hàng ô màu** palette + ô "mặc định" (`color:null`).
- Nút bật/tắt **Mũi tên** (`arrow`).
- Nút bật/tắt **Nét đứt** (`dashed`).
- Ba nút **Độ đậm**: mảnh / vừa / đậm (`width`).
- Nút **Xoá**.

Mỗi thay đổi → cập nhật edge tương ứng qua `commitAndSave` (history + lưu).

### 7.3 Render kiểu dây trong SVG
- Màu: `stroke = color ? colorVar(color) : var(--edge-default)`.
- Độ đậm: `stroke-width` theo ánh xạ mục 3.3.
- Nét đứt: `stroke-dasharray = dashed ? "6 5" : "none"`.
- Mũi tên: một `<marker>` SVG dùng chung (`marker-end`) khi `arrow`; màu mũi tên khớp màu dây.

## 8. Màu card & ô nhóm

### 8.1 Mô hình hiển thị (một màu/phần tử, token palette)
- **Nền:** tô *tint nhạt* để chữ vẫn đọc rõ — `background: color-mix(in srgb, var(--token) 14%, var(--surface))` (biến CSS `--card-tint`). `null` → nền hiện tại.
- **Ring/viền khi hover & chọn:** dùng **màu đầy đủ** `var(--token)` (biến `--card-accent`). `null` → ring tím mặc định như hiện tại. Với card: `.idea-card.selected` và `:hover` lấy `--card-accent`; với ô: viền/`drop-target` lấy màu ô.
- Token lưu trong `node.color` / `group.color`, resolve qua `colorVar` sẵn có. Không lưu hex (tránh vỡ dark mode).

### 8.2 Điểm vào — chuột phải card → menu
Chuột phải một card mở popover `CardMenu` (component mới) tại con trỏ, gồm:
- **Hàng ô màu** palette (+ ô "bỏ màu" = `null`) — bấm áp ngay.
- **✎ Sửa nội dung** — mở form sửa thẻ hiện có (`setEditingId`).
- **× Xoá** — xoá card.

Gộp cả đổi màu nhanh lẫn lối vào Sửa/Xoá vào một menu, đồng nhất với menu chuột phải của ô nhóm. Nút ✎/× hover trên thẻ vẫn giữ.

### 8.3 Bảng màu dùng chung
`EdgeToolbar`, `CardMenu`, menu màu của ô, và `BadgeEditor` đều chọn từ cùng `BADGE_PALETTE`. Tách một component `<ColorSwatches value onChange includeNone />` để dùng lại ở cả bốn nơi (DRY).

## 9. i18n
- Chuỗi UI mới (nút "+ Nhóm", nhãn trong toolbar/menu: "Mũi tên", "Nét đứt", "Độ đậm", "Bỏ màu", "Đổi tên", "Sửa nội dung", tooltip…) bọc `<Trans>` / `t` như phần còn lại.
- **Tên nhóm** là dữ liệu người dùng → **không** bọc `<Trans>`.
- `npm run i18n:extract` phải báo **0 thiếu** sau khi thêm.

## 10. Các file dự kiến đụng tới

**Server**
- `server/index.js`: schema (`groups`, `nextGroupId`); `migrateBoard` (khởi tạo groups); GET `findOneAndUpdate`; PUT destructure + update.

**Client**
- `client/src/pages/IdeaMap.jsx`: state (`selectedEdgeId`, drag/resize ô); render lớp group; tạo/di chuyển/resize/xoá ô; thành viên khi thả card; mở rộng connector & `toggleEdge` cho group; render kiểu dây (marker, dasharray, width, color) + click chọn; phím Delete xoá dây; `CardMenu` cho chuột phải card; nút "+ Nhóm".
- `client/src/components/GroupFrame.jsx` (mới): render một ô nhóm (tiêu đề, thân, tay nắm resize, inline rename).
- `client/src/components/EdgeToolbar.jsx` (mới): thanh công cụ chỉnh dây.
- `client/src/components/CardMenu.jsx` (mới): menu chuột phải card (màu + Sửa + Xoá).
- `client/src/components/ColorSwatches.jsx` (mới): hàng ô màu dùng chung.
- `client/src/lib/badges.js`: có thể thêm helper hình học `clipToRect` và ánh xạ `EDGE_WIDTHS`.
- `client/src/styles/idea-map.css`: `.group-frame` (+ tiêu đề, tay nắm, tint, ring), `.edge-layer line.selected`, biến `--card-tint`/`--card-accent`, `.card-menu`, `.edge-toolbar`, `.color-swatches`.

## 11. Kiểm thử (không có test framework)

**Cổng build:** `cd client && npm run i18n:extract` (0 thiếu) + `npm run build` (pass).

**Click-test thủ công (dev):**
1. Bấm "+ Nhóm" → ô rỗng hiện ra; kéo tiêu đề thấy ô di chuyển.
2. Kéo 4 card thả vào trong ô → viền ô sáng lúc kéo; thả xong kéo tiêu đề ô thấy **cả 4 card đi theo**; kéo một card ra ngoài rồi kéo ô lại → card đó **không** theo nữa.
3. Kéo góc ô → ô resize, không rớt thành viên.
4. Kéo connector card thả lên ô nhóm → dây chạm **mép** ô, không chui vào giữa.
5. Click trái vào dây → dây nổi bật + thanh công cụ hiện; đổi màu, bật mũi tên, bật nét đứt, đổi độ đậm — dây đổi tương ứng; bấm Xoá (hoặc phím Delete) → dây biến mất.
6. Chuột phải card → menu: chọn màu → nền thẻ tint, hover/chọn thấy ring đúng màu; "Bỏ màu" → về trung tính; "Sửa nội dung" mở form; "Xoá" xoá thẻ.
7. Chuột phải ô → đổi màu / đổi tên / Xoá; Xoá ô → **card vẫn còn**, chỉ tan nhóm.
8. **Reload trang** → toàn bộ ô nhóm, thành viên, kiểu dây, màu card còn nguyên (đã lưu server).

## 12. Rủi ro & lưu ý
- **PUT rớt field:** quên thêm `groups/nextGroupId` vào PUT ⇒ lưu mất ô. Đã nêu ở mục 4, cần test reload.
- **Trùng id node vs group:** edge `from/to` là id số; luôn so khớp kèm `kind`.
- **Thứ tự z:** group phải ở dưới edge-layer, card ở trên; sai thứ tự sẽ che dây hoặc che card.
- **Kéo tiêu đề vs kéo card đè lên ô:** thanh tiêu đề ô bắt sự kiện kéo-di-chuyển-ô; thân ô **không** bắt (để marquee/tạo card trên vùng trống vẫn hoạt động khi con trỏ ở trong ô nhưng không trúng card). Cần đảm bảo pointer-events hợp lý.
