Plan: [../plans/2026-08-12-gd-gui-playwright-verification.md](../plans/2026-08-12-gd-gui-playwright-verification.md)
(Không có spec riêng — plan này được giao thẳng để chạy verification.)

## Đã làm gì

- Xác nhận toàn bộ tính năng Game Design (Game brief, Game flow, spec card, relation 4 loại, Playtest session, Decision log, Balance sheet, Dev handoff Markdown) hoạt động đúng trên board GD thật qua browser GUI thật (đăng nhập Google thật), điều mà Playwright headless trước đây không làm được do Google GSI chặn origin.
- Phát hiện và sửa 1 bug thật: Markdown xuất từ Dev handoff luôn có dòng đầu `# undefined` thay vì tên board, do `name` bị tách khỏi object `board` khi load board (giữ riêng trong state `boardName`) nhưng không được truyền lại cho hàm build markdown.
- Phát hiện một vấn đề hạ tầng không phải bug sản phẩm: backend dev server (`node --watch index.js`) chạy từ 11/08 nhưng code đã sửa từ 12/08 — `--watch` không tự nạp lại, khiến server phục vụ code cũ (thiếu hoàn toàn field `gameDesignBrief`/`Flow`/`Balance` trong response). Đã khởi động lại server (có xin phép người dùng trước khi kill) để nạp code mới.
- Không kiểm được góc nhìn `viewer` bằng thao tác UI thật (chỉ có một tài khoản Google trong phiên, không có tài khoản thứ hai để mời làm viewer) — đã đọc code thay thế (`canEdit={role !== "viewer"}` ở mọi panel GD, server trả 403 cho PUT khi role viewer) nhưng đây là suy luận, không phải quan sát trực tiếp.
- Đã dọn board test `E2E GD — có thể xóa` sau khi lưu đủ evidence.

## File chính

- `board-tools/client/src/components/DevHandoffPanel.jsx` — nhận thêm prop `boardName`, dùng nó (thay vì `board.name` luôn undefined) khi build markdown.
- `board-tools/client/src/pages/IdeaMap.jsx` — truyền `boardName={boardName}` xuống `<DevHandoffPanel>`.

## Khác với plan

- Task 5, mục "Mở link viewer": **không thực hiện được** như plan yêu cầu — thiếu tài khoản Google thứ hai để đăng nhập role viewer trong phiên này. Đã ghi rõ trong file plan, không tự nhận là PASS.
- Trong lúc test relation, thao tác nhầm bấm "Xóa dây" thay vì nút đóng dock, xóa mất edge relation vừa test (đã kiểm đủ 4 loại relation trước đó, có bằng chứng trong lịch sử preview Markdown và trong text đã đọc trực tiếp từ DOM — không tạo lại edge vì board test sẽ bị xóa ngay sau đó).
- Có việc phát sinh ngoài plan: restart backend server giữa chừng (do phát hiện server chạy code cũ) — đã hỏi và được người dùng đồng ý trước khi `kill`.

## Còn dở / cần lưu ý

- **Viewer role**: cần một tài khoản Google thứ hai (mời làm thành viên role "Chỉ xem") để verify thật sự trên UI rằng input/select/button bị khóa đúng như thiết kế. Hiện tại chỉ xác nhận qua đọc code.
- **`node --watch`không tự nạp code**: đáng để điều tra thêm tại sao — có thể do watch không theo dõi được thư mục qua git worktree, hoặc do editor ghi file theo cách watch không nhận ra. Nếu lặp lại, cân nhắc chuyển sang `nodemon` hoặc restart thủ công sau mỗi lần sửa code server khi test.
- Board thật của người dùng (`Board mới` — GAME DESIGN) không bị đụng tới trong suốt quá trình test.
