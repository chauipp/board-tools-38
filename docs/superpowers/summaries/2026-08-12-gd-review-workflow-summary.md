# Game Design Review Workflow — Kết quả

Spec: [../specs/2026-08-12-gd-review-workflow-design.md](../specs/2026-08-12-gd-review-workflow-design.md)  
Plan: [../plans/2026-08-12-gd-review-workflow.md](../plans/2026-08-12-gd-review-workflow.md)

## Đã làm gì

- Bổ sung outcome review, reviewer, ngày review và danh sách yêu cầu chỉnh sửa có thể đánh dấu đã xử lý ở từng card GD.
- Thêm status `Approved` và `Rejected` cho board Game Design mới.
- Card preview hiển thị trạng thái review, còn Markdown handoff xuất outcome và chỉ các yêu cầu chưa xử lý.
- Kiểm Playwright với board tạm đã xóa: review/comment load đúng, dock 275px không tràn ngang, Console/Network sạch.

## File chính

- `board-tools/client/src/lib/game-design.js` — normalize review, preview card và Markdown.
- `board-tools/client/src/components/GameDesignPanel.jsx` — section Review và thao tác comment.
- `board-tools/server/board-payload.js` — validation review data.
- `board-tools/server/boards.js` — seed status Approved/Rejected cho board GD mới.
- `docs/game-design-board-test-guide.md` — luồng test thủ công Review workflow.

## Khác với plan

- Không lệch. Một test Markdown ban đầu sai expectation vì label được bold; đã sửa test chứ không thay hành vi sản phẩm.

## Còn dở / cần lưu ý

- Board GD đã tạo trước phase này không tự thêm Approved/Rejected, nhưng có thể thêm thủ công từ panel status; không chạy migration để tránh tự thay dữ liệu board hiện tại.
- Archived, review nhiều cấp, mention/notification và deadline/milestone vẫn thuộc workflow/project-management phase sau.
