# Summary — Tool text

Ngày hoàn tất: 2026-07-28
Nhánh: `idea-map-theme-sketch` (7 commit, tiếp sau đợt skin vẽ tay `b3d149b`)

- Spec: [`docs/superpowers/specs/2026-07-28-idea-map-text-tool-design.md`](../specs/2026-07-28-idea-map-text-tool-design.md)
- Plan: [`docs/superpowers/plans/2026-07-28-idea-map-text-tool.md`](../plans/2026-07-28-idea-map-text-tool.md)

Kiểm tự động lúc chốt: `npm test` 310/310 xanh (+13 test mới), `npm run
test:smoke` xanh (thêm bốn chặng cho text), `npm run build` sạch, `node --check`
sạch — **server không sửa một dòng nào**, đúng như thiết kế.

---

### Đã làm gì

- Khu 2 của thanh công cụ trái có **tool thứ tư: Text** (phím `t`), sau Bút,
  Cục gôm, Hình khối. Khu 4 khi cầm nó hiện ba cỡ chữ (nhỏ / vừa / lớn) và bảy
  màu dùng chung với bút — **không** hiện độ dày nét và bảng sáu hình.
- Bấm lên bảng là gõ được ngay tại chỗ: ô nhập hiện đúng vị trí, đúng font, đúng
  cỡ, đúng màu của chữ sẽ vẽ ra, và co giãn theo mức thu phóng. `Enter` xuống
  dòng, `Escape` kết thúc.
- **Một cú bấm lên text đã có phục vụ hai việc**, phân biệt bằng ngưỡng 3 đơn vị:
  di dưới ngưỡng → mở ra sửa (ô nhập mang sẵn nội dung cũ); di quá ngưỡng → kéo
  đi chỗ khác. Không cần bấm đúp, và không bấm nhầm sang việc kia được.
- Gõ rỗng thì không đẻ ra phần tử vô hình; sửa thành rỗng thì coi như xoá. Cục
  gôm quét trúng text như quét nét bút. Hoàn tác được cả bốn việc.
- Chữ trên bảng dùng `--canvas-font` nên **tự theo skin vẽ tay** — bật skin là
  chú thích thành chữ viết tay, không có một dòng JS nào lo việc đó.

### File chính

| File | Vai trò |
|---|---|
| `client/src/lib/text-el.js` (+test) | Ba cỡ chữ, tách dòng, đo hộp (nhận hàm đo qua tham số nên test được), hit-test theo hộp |
| `client/src/lib/shape.js` | `drawingsHitBy` thêm nhánh `kind: "text"` |
| `client/src/lib/pen.js` | Thêm khoá `size` vào lựa chọn lưu ở localStorage |
| `client/src/lib/useInk.js` | Chốt chặn tool `text` ngay đầu `handleMouseDown` |
| `client/src/components/ToolRail.jsx` | Nút Text ở khu 2 |
| `client/src/components/ToolOptions.jsx` | Nhánh khu 4 riêng cho text |
| `client/src/components/InkLayer.jsx` | `TextEl` — vẽ `<text>` với một `<tspan>` mỗi dòng |
| `client/src/pages/IdeaMap.jsx` | Ô nhập, `commitText`, lượt kéo, hàm đo bề rộng chữ |
| `client/src/styles/idea-map.css` | `.ink-layer text`, `.text-input`, `.text-size` |

### Khác với plan

- **Bỏ hẳn bấm đúp để sửa.** Plan định dùng `dblclick`, nhưng khi ghép với lượt
  kéo (Task 6) thì cú mousedown đầu của một lần bấm đúp đã kịp mở ô nhập mới —
  hai cơ chế giẫm chân nhau. Gộp thành một cú bấm phân biệt bằng ngưỡng di
  chuyển: đơn giản hơn, ít trạng thái hơn, và không có ca nào mơ hồ.
- **Ô nhập nằm ngoài `.canvas`, không nằm trong.** Plan để ngỏ hai lựa chọn.
  Phải chọn "ngoài" vì `.canvas` khai `will-change: transform` → nó là một
  stacking context, con của nó không thể nổi lên trên `.ink-capture` (z-index 8)
  để nhận chuột. Cái giá là toạ độ và cỡ chữ phải tự nhân camera vào.
- **Hàm đo bề rộng chữ phải có đường lùi.** `getContext("2d")` trả `null` trong
  jsdom, làm smoke test ném lỗi và trắng cả trang. Thêm nhánh ước lượng thô
  (`độ dài × cỡ × 0.55`) — hộp chỉ dùng cho vùng chạm nên sai vài phần trăm còn
  hơn làm sập trang vì không đo được một dòng chữ.
- **Bấm sang chỗ khác lúc đang gõ thì ô nhập nhảy theo** (chốt cái cũ, mở ngay ô
  mới tại đó) — như Excalidraw. Ban đầu cố tình không làm vì sợ thứ tự
  `blur` / `mousedown` khác nhau giữa các trình duyệt sẽ làm **mất chữ vừa gõ**;
  nhưng chính `preventDefault()` thêm vào khi sửa lỗi tiêu điểm đã gỡ bỏ nỗi lo
  đó — tiêu điểm không rời textarea nữa nên `blur` không xen vào giữa. Kèm theo
  là `textEditRef` chống chốt hai lần: `commitText` vừa là `onBlur` vừa được gọi
  tường minh, hai đường cùng đọc `textEdit` từ một closure.
- **Mở một text ra rồi đóng lại mà không sửa gì thì không ghi gì.** Không có chốt
  này thì mỗi lần bấm nhầm vào một dòng chú thích là một lượt PUT *và* một bước
  hoàn tác rỗng — Ctrl+Z mấy lần liền mà màn hình không đổi gì.
- **Không cần chặn phím tắt trong ô nhập** như plan lo: handler `keydown` chung
  của bảng đã bỏ qua mọi sự kiện phát từ `input` / `textarea` / `select` từ trước.
- Smoke test phải sửa thêm một chỗ không có trong plan: nó đếm cứng "mode Sửa
  phải có 9 nút", giờ là 10.

### Hai lỗi phát hiện khi chạy thật (đã sửa, commit `65b1ce5`)

Cả hai đều là thứ smoke test **không thể** bắt được, đúng vào chỗ mục dưới đây
đã cảnh báo:

- **Bấm tool text không ra ô nhập.** Hành vi mặc định của `mousedown` là dời tiêu
  điểm; `.ink-capture` là div không nhận tiêu điểm nên trình duyệt đẩy về
  `<body>`. React 18 xả sự kiện rời rạc ngay trong lúc dispatch, nên ô nhập đã
  kịp gắn vào cây và tự lấy tiêu điểm *trước* khi hành vi mặc định chạy — rồi bị
  cướp ngay sau đó, `blur` bắn ra, `commitText` thấy chuỗi rỗng và gỡ ô nhập đi.
  Sửa bằng `e.preventDefault()`. jsdom không mô phỏng cú cướp tiêu điểm này nên
  smoke test vẫn xanh suốt.
- **Ba nút cỡ chữ lệch và bị cắt.** Đặt nhầm trong `.tool-grid`, mà lưới đó có
  cột rộng đúng 22px (xem phép tính bề rộng khu 4 trong `idea-map.css`) còn
  `.tool-btn` là 34px — vừa tràn ra ngoài vừa xếp 2+1 lệch sang trái. Đưa ra
  ngoài lưới, xếp một cột như ba nút độ dày nét của bút. jsdom không tính layout
  nên smoke test cũng không thấy.

### Còn dở / cần lưu ý

- **Chưa kiểm bằng mắt trên trình duyệt** — phiên này không có công cụ điều khiển
  trình duyệt. Danh sách kiểm tay cuối file plan còn nguyên, đáng chú ý nhất:
  ô nhập có trùng khít với chữ vẽ ra ở mức thu phóng 50% và 200% không, và chữ
  tiếng Việt có dấu ở cả hai skin. Bốn chặng smoke test đã kiểm được phần *hành
  vi* (mở ô nhập, lưu đúng một lần, ra đúng số dòng, kéo và sửa không lẫn nhau),
  nhưng **không** kiểm được phần *nhìn*.
- **Không có xem trước trực tiếp** lúc gõ và lúc kéo: người khác thấy khi mình
  gõ xong, không thấy từng ký tự. Cố ý — `live:ink` sinh ra cho nét đang kéo,
  còn phát từng phím lên cho cả phòng thì vừa tốn vừa gây nhiễu.
- **Không đổi được cỡ hoặc màu của một text đã tạo** — phải xoá và gõ lại. Menu
  chuột phải cho phần tử `drawings` chưa tồn tại; dựng riêng một cái chỉ cho
  việc này thì không đáng.
- Đổi skin làm hộp `w`/`h` đã lưu lệch vài phần trăm so với chữ đang hiển thị
  (font khác thì bề rộng khác). Chỉ ảnh hưởng vùng chạm của cục gôm và vùng bấm
  để kéo, không ảnh hưởng chữ.
- Text vẫn **chưa chọn được ở mode Chuột**, chưa quét trúng bằng ô chọn, chưa kéo
  nhiều cái một lúc — cả cụm này thuộc đợt "chọn / di chuyển nét đã vẽ" đang treo
  từ spec hình khối.
