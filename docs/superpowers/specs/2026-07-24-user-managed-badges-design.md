# Thiết kế: Trạng thái & Nhãn do người dùng tự quản

Ngày: 2026-07-24

## 1. Mục tiêu

Cho người dùng tự **tạo / đổi tên / đổi màu / xoá** các badge trạng thái và nhãn trong bản đồ ý tưởng, thay vì danh sách trạng thái cứng trong code. Đây là dự án "trạng thái thành dữ liệu DB" đã được tách ra khi làm i18n.

### Trong phạm vi
- Trạng thái và nhãn đều trở thành **thực thể dữ liệu** lưu trong DB, quản lý được đồng nhất.
- Bốn thao tác cho cả hai loại: đổi tên, đổi màu, xoá, thêm mới.
- Sửa badge qua **chuột phải chip trong thanh lọc**; tạo mới qua nút **"+"** cuối mỗi nhóm chip.
- Di trú dữ liệu board hiện có sang mô hình mới, không mất dữ liệu.

### Ngoài phạm vi
- Sửa badge bằng chuột phải trên **pill của thẻ** (nằm trong canvas, đang là thao tác lia sa bàn — để sau nếu cần).
- Dịch tên badge sang tiếng Anh: tên badge là **dữ liệu người dùng**, theo quy tắc "trong DB thì không dịch" đã áp dụng ở dự án i18n. Không bọc `<Trans>`.
- Đổi hành vi kéo-thả chip gán badge (giữ nguyên).
- Dựng test framework (dự án không có, đã chốt không thêm).

## 2. Hiện trạng

| Thứ | Hiện tại | Vấn đề |
|---|---|---|
| Trạng thái | `STATUS` hằng số cứng: `{ key: { label, color } }` × 5; `node.status` lưu **key** (`"chosen"`) | Người dùng không sửa được; muốn thêm trạng thái phải sửa code |
| Nhãn | `node.tag` lưu **chuỗi tên** (`"Cơ chế"`); màu suy ra từ `hashTag(tag)`; `TAG_SUGGESTIONS` gợi ý cứng | Đổi tên/màu không được; màu do hash, không chọn được |
| Màu | `--st-*` (5 màu trạng thái, **đổi theo sáng/tối**); `--dot-1..8` (8 màu nhãn, **cố định** cả hai theme) | — |
| Server | Board là singleton; `nodes/edges/view/nextNodeId/nextEdgeId` lưu thẳng | Chưa có định nghĩa badge |

Điểm mấu chốt: trạng thái lưu **key** (đổi label không đụng thẻ) còn nhãn lưu **chuỗi tên** (đổi tên phải sửa mọi thẻ). Thiết kế thống nhất cả hai về **mô hình keyed**.

## 3. Mô hình dữ liệu

Định nghĩa badge lưu ngay trong document board (không cần collection mới):

```
board.statuses = [{ id: <int>, name: <string>, color: <token> }, …]   // có thứ tự hiển thị
board.tags     = [{ id: <int>, name: <string>, color: <token> }, …]
board.nextStatusId = <int>
board.nextTagId    = <int>
```

Thẻ tham chiếu bằng id:

```
node.statusId = <int> | null     // thay cho node.status (key string)
node.tagId    = <int> | null     // thay cho node.tag (name string)
```

- `null` = "không trạng thái" / "không nhãn" — hợp lệ cho **cả hai** loại.
- **Đổi tên / đổi màu** = sửa một định nghĩa, thẻ không đổi (chúng trỏ id). Đối xứng hoàn toàn giữa hai loại.

### Màu — lưu token, không lưu hex

`color` lưu **tên token bảng màu** (ví dụ `"c3"`), resolve sang `var(--badge-c3)` lúc render. Lý do: lưu hex thô sẽ vỡ dark mode. Một bảng màu badge cố định ~8–10 màu được định nghĩa một lần trong `index.css`, mỗi màu có biến thể sáng/tối (giống cách `--st-*` đang làm). Bộ chọn màu chỉ hiện các token này.

## 4. Server — di trú một lần, idempotent

Trong `GET /api/ideas` (hoặc ngay khi nạp board), trước khi trả về, chuẩn hoá board:

1. **Nếu thiếu `board.statuses`:** seed 5 trạng thái mặc định (id 1–5) với `name` = nhãn tiếng Việt hiện tại và `color` = token khớp màu `--st-*` hiện tại. Với mỗi node, ánh xạ `node.status` (key cũ) → `statusId` tương ứng; xoá `node.status`. Đặt `nextStatusId = 6`.
2. **Nếu thiếu `board.tags`:** gom các `node.tag` phân biệt (bỏ rỗng) → tag defs, `color` = token khớp `hashTag(tag)` hiện tại (giữ nguyên màu cũ). Với mỗi node, đổi `node.tag` → `tagId` (rỗng → `null`); xoá `node.tag`. Đặt `nextTagId`.
3. **Idempotent:** nếu board đã có `statuses`/`tags` thì bỏ qua bước tương ứng. Chạy lại nhiều lần cho cùng kết quả.

Di trú chạy **server-side** nên mọi client tải về đều thấy dữ liệu đã chuẩn hoá. Seed data mặc định (`defaultIdeas`) cũng cập nhật sang mô hình mới.

## 5. Client — tầng nền (foundation): đọc định nghĩa từ board

Bỏ các hằng số cứng `STATUS`, `STATUS_ORDER`, `DOT_PALETTE`, `hashTag`. Thay bằng tra cứu trong `board.statuses` / `board.tags` theo id. Các đơn vị đổi:

- **Chip lọc trạng thái/nhãn**: lặp `board.statuses` / `board.tags` thay vì `STATUS_ORDER` / `distinctTags`. Thêm chip "Không trạng thái" và "Không nhãn" (lọc `statusId==null` / `tagId==null`).
- **Pill trên thẻ**: tra def theo `node.statusId` / `node.tagId`; `null` → không hiện pill.
- **Form sửa thẻ**: ô Nhãn đổi từ nhập tự do (`<input list>`) sang **dropdown chọn** từ `board.tags` (+ lựa chọn "Không nhãn"); ô trạng thái vẫn dropdown nhưng nguồn từ `board.statuses`.
- **Chip-ghost (kéo-thả)** và **gán badge khi thả**: dùng id thay vì key/name.
- **i18n**: `tagLabel` (đang dùng `t\`Chưa gắn nhãn\``) thu về xử lý `null` = "Chưa gắn nhãn" — chuỗi UI này **vẫn dịch** (nó là nhãn giao diện cho trạng thái rỗng, không phải tên badge do user đặt). Tên badge do user đặt **không dịch**.

**Cuối tầng này app trông y hệt hiện tại** — chỉ đổi cách lưu. Đây là mốc verify quan trọng nhất.

## 6. Client — tầng tính năng: sửa badge

### Chuột phải chip lọc → popover
Component mới (ví dụ `BadgeMenu`) gắn vào chip trong `.filterbar` (không phải canvas nên không đụng thao tác chuột-phải-kéo-lia sa bàn). Nội dung:
- **Đổi tên**: ô nhập, Enter để lưu.
- **Đổi màu**: dãy ô màu từ bảng palette, bấm để chọn.
- **Xoá**: gỡ badge khỏi mọi thẻ đang dùng (`statusId`/`tagId` của chúng → `null`), rồi bỏ def. Không hỏi lại (đã chốt: gỡ khỏi thẻ, xoá thẳng).

### Nút "+" cuối mỗi nhóm
Tạo badge mới: nhập tên + chọn màu → thêm def với id mới. Trạng thái mới xếp cuối danh sách.

### Đóng popover
Bấm ra ngoài / Escape đóng (giống các popover khác). Chỉ một popover mở tại một thời điểm.

## 7. Tương tác với code sẵn có

- **Menu chuột phải cũ đã gỡ**: dự án i18n đã bỏ context menu tuỳ biến trên canvas. Popover badge này là component **mới, riêng**, chỉ trên chip lọc — không hồi sinh menu canvas cũ.
- **Chuột phải kéo lia sa bàn**: không đổi. Popover badge chỉ ở filterbar, nằm ngoài viewport.
- **Quy tắc "DB thì không dịch"**: tên badge là dữ liệu người dùng → không dịch. Dự án này **hoàn tất** phần dở của i18n: nhãn trạng thái từ hằng số cứng (tạm để tiếng Việt) nay chính thức thành dữ liệu, không dịch, đúng quy tắc — không còn ngoại lệ nào.
- **`user-select: none` trên chip**: đã thêm ở vế 1; giữ nguyên.

## 8. Thứ tự xây dựng

Một spec, nhưng plan tách thành các task theo tầng:

1. **Server: schema + di trú + seed** — nền tảng, verify bằng cách mở board cũ thấy dữ liệu đúng.
2. **Client foundation** — đọc định nghĩa từ board, bỏ hằng số cứng; app trông y hệt. Verify không hồi quy.
3. **Client feature — tạo ("+")** và **sửa (đổi tên/màu/xoá qua chuột phải)**.
4. **Rà soát + kiểm chứng toàn diện.**

Làm tầng nền + di trú trước và verify kỹ, vì nếu vỡ sẽ lộ ra trước khi xây UI.

## 9. Kiểm chứng

Không có test framework (giữ nguyên quyết định cũ). Mỗi task kết thúc bằng: `npm run i18n:extract` (0 thiếu) + `npm run build` + kiểm bằng mắt (headless + trình duyệt thật).

Kịch bản bắt buộc:
- **Di trú**: mở board đang có dữ liệu thật → mọi thẻ hiện đúng trạng thái/nhãn, màu và tên như trước khi đổi.
- Tạo badge mới → xuất hiện ở chip lọc và trong dropdown form thẻ.
- Đổi tên badge → mọi thẻ đang dùng đổi theo tức thì (vì trỏ id).
- Đổi màu → pill và chip đổi màu, đúng cả sáng/tối.
- Xoá badge đang có thẻ dùng → thẻ đó về "không trạng thái"/"không nhãn", def biến mất.
- Không hồi quy: kéo-thả chip gán badge vẫn chạy; lọc vẫn đúng; i18n vẫn đổi ngữ đúng.

## 10. Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Di trú làm hỏng dữ liệu board thật | Cao | Idempotent, server-side, chỉ chạy khi thiếu định nghĩa. Verify trên board thật trước. Có thể sao lưu bằng "Xuất JSON" trước khi chạy |
| Blast radius lớn (nhiều chỗ render đổi id) | Trung bình | Tách tầng nền riêng, verify không hồi quy trước khi xây UI |
| Bảng màu lẫn `--st-*` (đổi theme) và `--dot-*` (cố định) | Thấp | Định nghĩa bảng màu badge thống nhất mới, mỗi màu có biến thể sáng/tối |
| Popup badge đụng thao tác chuột phải khác | Thấp | Popover chỉ ở filterbar, ngoài viewport |
| Tên badge trùng nhau | Thấp | Keyed model không cần tên duy nhất; id phân biệt. Cho phép trùng tên |

## 11. Quan hệ với nhánh i18n

Dự án này **phụ thuộc** code i18n (nó refactor chính phần `STATUS` mà i18n cố ý để nguyên). Nhánh `feature/lingui-i18n` hiện chưa merge. Khi bắt đầu thực thi, chọn một trong hai: (a) merge i18n vào main trước rồi nhánh mới từ main; (b) nhánh mới xếp chồng trên `feature/lingui-i18n`. Quyết định lúc bắt đầu plan. Vế 1 (chip `user-select`) đã nằm trên nhánh i18n.
