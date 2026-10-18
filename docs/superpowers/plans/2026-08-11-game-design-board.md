# Game Design Board — Kế hoạch thực thi

> **For Codex:** Thực hiện tuần tự từng task, test trước và kiểm UI Playwright trước khi hoàn tất.

**Goal:** Thêm lựa chọn board Game Design có template thẻ và dữ liệu cấu trúc, đồng thời giữ nguyên board tư duy hiện có.

**Architecture:** Mở rộng document Board với `kind`; frontend dùng registry template và panel chi tiết cho node trong board GD. Canvas và cơ chế lưu/realtime hiện tại được tái sử dụng.

**Tech Stack:** React 18, Vite, Express, MongoDB/Mongoose, Socket.IO, node:test.

---

- [x] Task 1: Mở rộng model và API board theo loại

  - [ ] Viết test server cho create/list/get/save `kind` và node `design`.
  - [ ] Thêm `kind` vào schema, payload GET/PUT/socket và danh sách board.
  - [ ] Tạo default status cho Game Design, giữ `idea` là mặc định tương thích.
  - [ ] Mở rộng validation cho `kind`, `type` và `design` an toàn.
  - [ ] Chạy `npm test` trong `board-tools/server`.

- [x] Task 2: Tạo registry template và export GD

  - [ ] Viết test thuần cho default template/design và Markdown của thẻ GD.
  - [ ] Tạo `client/src/lib/game-design.js` chứa type, label, icon, defaults và các trường panel.
  - [ ] Mở rộng `outline`/Markdown export để board GD xuất phần handoff có cấu trúc.
  - [ ] Chạy `npm test` trong `board-tools/client`.

- [x] Task 3: Thêm lựa chọn loại board ở BoardList

  - [ ] Viết smoke/component test cho payload tạo board theo loại nếu hạ tầng hiện tại cho phép.
  - [ ] Sửa `api.js` để `createBoard(name, kind)` gửi loại board.
  - [ ] Sửa `BoardList.jsx`: modal chọn loại, tên board, trạng thái loading/error và nhãn loại trong danh sách.
  - [ ] Thêm CSS và i18n cần thiết.
  - [ ] Chạy build + smoke test client.

- [x] Task 4: Tích hợp template và panel chi tiết vào canvas GD

  - [ ] Viết test cho helper tạo node GD/defaults và merge/rebase field mới.
  - [ ] Sửa `IdeaMap.jsx` để nhận biết `board.kind`, mở menu template và tạo node đúng type.
  - [ ] Sửa `IdeaCard.jsx` để hiện type/tóm tắt và mở panel chi tiết mà không đổi card của idea board.
  - [ ] Tạo component panel form, lưu qua undo/autosave, tôn trọng viewer role.
  - [ ] Kiểm update/rebase/realtime mang `kind`, `type`, `design`.
  - [ ] Chạy toàn bộ test, build và smoke test.

- [x] Task 5: Kiểm UI và tài liệu kết quả

  - [ ] Dựng client/server, dùng Playwright tạo board Idea và Game Design.
  - [ ] Tạo/sửa Mechanic, kiểm lưu, export và board idea không thay đổi.
  - [ ] Kiểm console/network, trạng thái trống/lỗi liên quan và viewport 375×667.
  - [ ] Tick toàn bộ checkbox sau khi pass review.
  - [ ] Viết [summary kết quả](../summaries/2026-08-11-game-design-board-summary.md).

## Kết quả

Sau khi hoàn tất, xem [summary](../summaries/2026-08-11-game-design-board-summary.md).
