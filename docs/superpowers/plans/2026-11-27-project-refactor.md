# Project Refactor Implementation Plan

[Thiết kế](../specs/2026-11-27-project-refactor-design.md)

[Bản đồ hệ thống](../../2026-11-27-system-map.md) · [Danh mục từng file](../../2026-11-27-system-file-inventory.md)

- [x] Task 1: Đồng bộ smoke fixture với hành vi editor hiện tại và chạy toàn bộ smoke test.
- [x] Task 2: Tải editor theo route, tách chuẩn hoá board và thanh công cụ Game Design, kiểm tra bằng Chromium.
- [x] Task 3: Tách đăng ký cộng tác Socket.IO khỏi điểm khởi động và kiểm tra kết nối.
- [x] Task 4: Tách điều phối lưu board khỏi editor, kiểm tra xung đột, mất mạng và khôi phục snapshot.
  - [x] Tách hook, kiểm cảnh báo xung đột, tải bản nháp, thử lại và restore trên Chromium với API giả.
  - [x] Kiểm undo/redo sau bản cập nhật từ peer bằng unit test, smoke và Chromium. Giữ lịch sử ghép được và bỏ các bước có thể ghi đè chỉnh sửa từ peer.
  - [x] Chặn import/restore khi còn bản nháp chưa lưu. Kiểm trên Chromium rằng nội dung và số request ghi giữ nguyên.
  - [x] Mô phỏng mất mạng trên Chromium. Kiểm tải nháp và thử lại ở 375 px, kể cả khi minimap hiện.
  - [x] Kiểm hai request PUT cùng phiên bản trên MongoDB cô lập, chỉ một request ghi thành công. Kiểm nội dung 409, phiên bản mới, broadcast và chặn restore cũ.
  - [x] Kiểm cập nhật cùng thẻ khi form đang mở, lưu lại lượt nhích mới nhất khi PUT đang chờ và phục hồi phiên bản sau restore 409.
- [x] Task 5: Tách các thao tác canvas và cụm panel khỏi editor, kiểm tra workspace, kéo thả, undo và redo.
  - [x] Tách lịch sử, mục lục và menu nổi. Kiểm mục lục, undo/redo và khôi phục workspace.
  - [x] Tách cuộn, thu phóng, lia và quét chọn khỏi trang. Kiểm thao tác canvas, kéo thẻ và Undo/Redo trên Chromium với server thật.
  - [x] Tách quy tắc xác định thẻ và khung được kéo. Kiểm 31 test xếp cây, production build và kéo thẻ trên Chromium.
- [x] Task 6: Rà soát ranh giới API và chạy kiểm tra tích hợp.
  - [x] Tách router bàn tính và kiểm tra hợp đồng GET/PUT bằng HTTP loopback với dữ liệu giả.
  - [x] Kiểm hợp đồng API board, snapshot, thành viên và PDF với MongoDB cô lập trước khi tách router.
  - [x] Tách quyền truy cập, dữ liệu trả về và router theo board, snapshot, thành viên, PDF. Chạy lại cùng bộ kiểm hợp đồng trên MongoDB cô lập.
- [x] Task 7: Phân chia logic Game Design theo chuẩn hóa dữ liệu, dependency và báo cáo dựa trên fixture cũ/mới; kiểm xuyên suốt từ mechanic đến handoff.
- [x] Task 8: Rà build, deploy, quota, migration và tập hợp các kiểm tra cần chạy trước khi tích hợp.
  - [x] Chạy unit test, production build, smoke và phục vụ bản build qua Express với MongoDB cô lập.
  - [x] Rà cấu hình Render, kiểm API quota, PDF cục bộ và chạy migration singleton hai lần trên fixture cô lập.

Kiểm hợp đồng MongoDB trước khi tách API. Kiểm luồng canvas và Game Design trên Chromium trước khi tổng hợp build và kiểm tra triển khai.

## Kiểm tra trước khi tích hợp

1. Trong `client/`, chạy `npm test`, `npm run build` và `npm run test:smoke`. Nếu sandbox Windows chặn esbuild đọc thư mục cha, dùng `npx vite build --configLoader runner` cho production và `npx vite build --configLoader runner -c smoke.vite.config.js` rồi `node smoke-run.mjs` cho smoke.
2. Trong `server/`, chạy `npm test`. Khởi động MongoDB cô lập trên loopback, đặt `BOARD_TEST_MONGO_PORT` theo cổng đó rồi chạy `node --test board-api.integration.mjs`. Test tạo cơ sở dữ liệu riêng và xóa cơ sở dữ liệu sau khi chạy.
3. Khởi động Express với bản build và MongoDB kiểm thử. Trên Chromium, kiểm quét chọn, lia, kéo thẻ, Undo/Redo, lưu từ hai phiên, tải nháp khi offline, restore sau 409 và xuất Handoff/Reports ở 375 × 667.
4. Khi đưa lên Render, build client và server cùng phiên. Tab mở từ bản phát hành cũ cần tải lại trước khi lưu vì PUT yêu cầu `baseUpdatedAt`. Cấu hình R2 trong môi trường triển khai nếu lưu PDF lâu dài. Refactor dùng `updatedAt` có sẵn nên không có bước migration dữ liệu hoặc chuyển PDF sang R2 đi kèm.

## Kết quả

[Tóm tắt](../summaries/2026-11-27-project-refactor-summary.md)
