# Tree layout lock Implementation Plan

**Goal:** Mỗi cây được chọn có chế độ tự sắp xếp theo hướng đã lưu và chặn kéo card khỏi bố cục.

**Architecture:** Lưu cấu hình trên node/group gốc. Helper thuần tính membership và bố cục; IdeaMap dùng helper tại ranh giới lưu và khi kích thước card thay đổi. TreePanel có công tắc bật/tắt.

**Tech Stack:** React, JavaScript, Vite, node:test, browser automation.

## Global Constraints

- Giữ nguyên thay đổi người dùng trên main và mọi biến môi trường.
- Không in secrets; không chỉnh dữ liệu board thật để kiểm thử.
- Không thay `locked` thủ công bằng khóa bố cục.
- Cây không khóa giữ hành vi hiện tại; lịch sử lưu đủ cả cấu hình và vị trí.

- [x] Task 1: Helper bố cục và membership

Create `client/src/lib/locked-tree.js` và `locked-tree.test.js`. Export `normalizeTreeLock`, `treeLockOwners`, `arrangeTree`, `arrangeLockedTrees`. Unit kiểm thêm hậu duệ, hướng, cây độc lập, chu trình, khóa thủ công và dữ liệu sai. Chạy `node --test src/lib/locked-tree.test.js src/lib/tree-layout.test.js`.

- [x] Task 2: Tích hợp editor và công tắc

Modify `IdeaMap.jsx`, `TreePanel.jsx`, `idea-map.css`. Thêm công tắc, phục hồi opts từ gốc, chuyển mở bảng tại hậu duệ về gốc khóa. Chặn kéo trực tiếp, vùng chọn/khung và nudge. Áp `arrangeLockedTrees(next, sizeOf)` tại saveNow và commitAndSave; effect theo số đo thực để xếp lại sau render. Bảo toàn cấu hình khi đổi hướng và undo/redo. Kiểm build và smoke.

- [x] Task 3: Kiểm trình duyệt và bàn giao

Trên board fixture: bật khóa hướng phải, thêm con vào nhánh, xác nhận không chồng; thử kéo gốc/con và nudge không đổi vị trí; tắt khóa kéo được; đổi hướng và tải lại vẫn giữ cấu hình; xóa/undo/redo và cây độc lập không hồi quy. Chụp bằng chứng desktop/mobile, kiểm console/network. Chạy client/server tests và build; rà diff, tích hợp về checkout người dùng, viết summary, dọn tài nguyên sở hữu.

## Kết quả

[Summary](../summaries/2026-10-19-tree-layout-lock-summary.md) · [Spec](../specs/2026-10-19-tree-layout-lock-design.md)
