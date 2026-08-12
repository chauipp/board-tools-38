# Hướng dẫn test Board Game Design

## 1. Khởi động app

Mở hai terminal:

```bash
# Terminal 1 — backend thật
cd "board-tools/server"
PORT=3345 PUBLIC_MODE=true npm run dev

# Terminal 2 — frontend
cd "board-tools/client"
CHOKIDAR_USEPOLLING=true npm run dev -- --host 0.0.0.0
```

Mở `http://localhost:7155`. Nếu Vite báo cổng 7155 đang dùng, dùng đúng cổng Vite in ra (ví dụ 7156).

## 2. Tạo board GD mới

1. Từ danh sách board, chọn tạo board mới.
2. Chọn loại `Game Design`.
3. Kiểm tra status mặc định theo thứ tự: `Draft`, `Review`, `Ready for dev`, `In dev`, `Testing`, `Done`.
4. Không dùng board GD cũ để kiểm status mặc định; status board cũ được giữ nguyên có chủ ý.

## 3. Kiểm Game brief (bối cảnh game)

1. Trên board `Game Design`, bấm `Game brief` cạnh tên board.
2. Xác nhận dock chỉnh sửa mở ở bên phải, rộng cố định 275px; nút này không xuất hiện trên board tư duy.
3. Điền `Genre`, `Target audience`, `Player fantasy`.
4. Bấm `+ Thêm giai đoạn`, điền tên giai đoạn, trải nghiệm và cảm xúc; thêm ít nhất một giai đoạn nữa.
5. Bấm `Lưu Game brief`, tải lại trang, mở lại brief và xác nhận toàn bộ dữ liệu vẫn còn.
6. Sửa một ô rồi bấm ra ngoài dock: dữ liệu phải được lưu và dock thu lại.
7. Mở `Xuất Markdown`; xác nhận có `## Game Context` trước `## Game Design`, gồm các field đã điền và danh sách Player journey.
8. Với link viewer, xác nhận brief vẫn đọc được nhưng không thể nhập, thêm/xóa stage hoặc lưu.

## 4. Kiểm card và checklist

1. Mở menu GD ở thanh công cụ trái, tạo một card `Mechanic / System`.
2. Bấm card và xác nhận dock edit mở ở bên phải, rộng 275px.
3. Trong `Acceptance criteria`, bấm `+ Thêm tiêu chí` hai lần.
4. Nhập hai tiêu chí, tick một tiêu chí, bấm `Lưu chi tiết`.
5. Xác nhận card hiện `Tiêu chí 1/2`.
6. Mở lại card, sửa text, bỏ tick, xóa một dòng và lưu.
7. Nạp một card legacy có criteria dạng text (nếu có) và xác nhận text trở thành một dòng checklist chưa tick.

## 5. Kiểm Game flow (Player Loop và Progression Map)

1. Trên board `Game Design`, bấm `Game flow` cạnh `Game brief`.
2. Xác nhận dock phải mở đúng bề rộng 275px; board tư duy không có nút này.
3. Trong `Player Loop`, bấm `+ Thêm bước`, điền tên bước, hành động, kết quả/reward và ghi chú. Chọn một hoặc nhiều `Thẻ liên quan` (giữ Ctrl/Cmd để chọn nhiều).
4. Trong `Progression Map`, bấm `+ Thêm mốc`, điền tên mốc, mục tiêu, unlock, mô tả và cảm xúc mong muốn.
5. Thu/mở từng section; các control phải vẫn xếp dọc, không overlap.
6. Bấm `Lưu Game flow`, tải lại trang và xác nhận hai danh sách cùng references còn nguyên.
7. Mở Xuất Markdown; xác nhận `## Game Flow` nằm sau `## Game Context` và trước `## Game Design`.
8. Với link viewer, xác nhận đọc được flow nhưng không thêm/sửa/xóa/lưu được.

## 6. Kiểm Examples, Failure States và Tuning Parameters

1. Mở một card `Mechanic / System`; cuối dock có ba section thu gọn: `Examples`, `Failure States`, `Tuning Parameters`.
2. Bấm `+ Thêm ví dụ`: section phải tự mở. Điền tên, tình huống và kết quả mong đợi; lưu rồi mở lại card để xác nhận dữ liệu còn nguyên.
3. Thêm một failure state gồm điều kiện, phản hồi người chơi và cách phục hồi; xóa nó rồi lưu để xác nhận dòng đã biến mất.
4. Thêm parameter gồm tên, default, min/max, đơn vị và ghi chú. Mỗi section chỉ nhận tối đa 20 / 20 / 30 dòng; mỗi ô dừng ở 1.000 ký tự.
5. Thu/mở từng section. Trong dock 275px, các ô phải xếp dọc, không tràn ngang hoặc overlap; rê chuột và cuộn phải chỉ cuộn dock.
6. Bấm `Lưu chi tiết`, tải lại trang và mở `Xuất Markdown`: chỉ các section có dữ liệu hợp lệ mới xuất thành `Examples`, `Failure states`, `Tuning parameters`.
7. Với link viewer, xác nhận vẫn đọc được item nhưng không có nút thêm/xóa/lưu và mọi input bị khóa.

## 7. Kiểm relation giữa card

1. Tạo hai card GD và nối bằng công cụ dây.
2. Bấm dây; dock phải phải hiện `Liên kết thẻ`.
3. Lần lượt chọn `Phụ thuộc`, `Mở khóa`, `Thay thế`, `Xung đột` và xác nhận nhãn trên dock đổi đúng.
4. Với dây dài, nhãn chữ phải hiện giữa dây; dây `Xung đột` phải có kiểu/màu khác dây thường.
5. Với dây ngắn, nhãn không được đè lên card; quan hệ vẫn phải đọc được trong dock.
6. Board tư duy (`idea`) vẫn dùng menu dây cũ, không hiện selector relation.

## 8. Kiểm export

1. Mở Xuất Markdown trên board GD.
2. Xác nhận criteria đã tick xuất thành `- [x]`, chưa tick thành `- [ ]`.
3. Xác nhận mục `## Quan hệ` ghi tên nguồn, loại quan hệ và tên đích.

## 9. Kiểm cuộn dock trên desktop

1. Tạo card có nhiều field/criteria để dock dài hơn viewport.
2. Di chuột vào dock rồi lăn chuột: chỉ dock cuộn, canvas không lia/zoom.
3. Thanh cuộn nằm sát mép phải của dock, không nằm thụt vào giữa form.
4. Với Game brief có nhiều giai đoạn, xác nhận các control vẫn xếp dọc, không chồng lên nhau và không đè HUD/minimap/zoom/filter của canvas.
5. Bấm ra ngoài dock: dữ liệu dirty được lưu rồi dock thu lại.

> Kiểm thử mobile `375 × 667` được dời sang Phase UX/mobile rất sau; giai đoạn hiện tại ưu tiên màn hình lớn.

## 10. Kiểm viewer và lỗi

- Viewer nhìn thấy checklist/progress/relation nhưng không sửa được, các control bị disabled hoặc ẩn rõ ràng.
- Không có lỗi đỏ trong Console.
- Không có request 4xx/5xx bất ngờ trong Network.
- Sau test API/Playwright, xóa board test để không để lại dữ liệu.

## 11. Kiểm Playtest và Decision log

1. Tạo card `Playtest`, bấm card và mở section `Playtest session` trong dock phải.
2. Điền mục tiêu, hypothesis, build/version, nhóm người chơi, ngày test, observations, metrics, player feedback và problems found. Chọn một hay nhiều thẻ Mechanic / Skill / Level ở `Thẻ liên quan` (giữ Ctrl/Cmd).
3. Lưu, tải lại board và mở lại card: mọi field và liên kết phải còn nguyên; card bị xóa khỏi board không được còn trong references.
4. Mở một card GD bất kỳ, mở `Decision log`, bấm `+ Thêm quyết định`. Điền quyết định, lý do, evidence, phương án đã cân nhắc, người/ngày quyết định; chọn `Đang áp dụng` hoặc `Đã thay thế`; gắn thẻ Playtest/card GD liên quan.
5. Lưu rồi mở `Dev handoff` → `Xuất Markdown`: kiểm tra có `Playtest session` và `Decision log`, bao gồm tên card liên quan.
6. Với viewer, mọi field, select nhiều lựa chọn và nút thêm/xóa/lưu phải bị khóa hoặc ẩn.
7. Trong dock 275px, các section mở rộng xếp dọc, không tràn ngang; rê chuột/lăn chỉ cuộn dock.

> Browser automation hiện chưa qua được màn đăng nhập vì Google GSI trả `The given origin is not allowed for the given client ID` tại `http://localhost:7155`. Khi OAuth local hoạt động, thực hiện lại các bước trên bằng editor và kiểm tra Console/Network không có lỗi không mong đợi.

## 12. Kiểm tự động

```bash
cd board-tools/client
npm test
npm run build
npm run test:smoke

cd ../server
npm test
```

## 13. Kiểm Balance sheet

1. Trên board GD, bấm `Balance` ở header. Dock phải vẫn cố định 275px.
2. Bấm `+ Thêm chỉ số`, nhập key `damage`, tên `Sát thương`, giá trị `10`, min/max, đơn vị `HP`; lưu.
3. Thêm chỉ số khác có công thức `damage * 1.2`; kết quả phải hiện là `12`. Thử key chưa có hoặc ký tự lạ: phải hiện lỗi rõ ràng, không thực thi nội dung như JavaScript.
4. Chọn card Mechanic/Skill/Level liên quan, lưu rồi tải lại board; dữ liệu và link phải còn nguyên.
5. Mở Dev handoff/Markdown: xác nhận có `## Balance Sheet`, công thức, kết quả và tên card liên quan.
6. Với viewer, không thể thêm/xóa/sửa/lưu Balance sheet.
