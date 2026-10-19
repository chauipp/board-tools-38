# Đổi chỗ nhánh trong cây khóa bố cục

[Thiết kế](../specs/2026-10-19-locked-sibling-swap-design.md) · [Plan](../plans/2026-10-19-locked-sibling-swap.md)

## Đã làm gì

- Kéo card lên card cùng cha để đổi thứ tự hoặc đổi cả hướng mọc; nhánh con đi theo, gốc và quan hệ nối giữ nguyên. Áp dụng cả ở nhánh sâu và khung cùng cấp.
- Card nguồn mờ, ứng viên viền đứt, đích nổi bật kèm hướng dẫn. Thả sai đích, Esc hoặc mất focus không thay đổi board hay ghi lịch sử.
- Lưu thứ tự/hướng qua tải lại, thay kích thước, thêm/xóa, undo/redo. Mỗi drop hợp lệ tạo một mốc undo; khóa thủ công/gốc không kéo được.
- Bảng Xếp cây có hướng dẫn thao tác; đổi chỗ khi panel mở rồi chỉnh khoảng cách vẫn giữ thứ tự/hướng.
- Kiểm editor thật bằng Playwright trên cổng riêng với fixture API trong bộ nhớ, không ghi board thật. Đã diễn lại cùng phía, trái/phải, trên/phải, nested, groups, hủy, sai đích, reload, undo/redo, dấu cộng, mobile375×667 và light/dark.

## File chính

- `client/src/lib/tree-layout.js`: nhận thứ tự con và hướng nhánh lưu sẵn, giữ BFS parent và bố trí nhánh kích thước khác nhau.
- `client/src/lib/locked-tree.js`: tìm sibling hợp lệ, hoán đổi slot nguyên tử và lưu các hướng hiệu lực để tránh tự cân lại.
- `client/src/lib/locked-tree.test.js`, `tree-layout.test.js`: thêm18 test, toàn bộ81 test bố cục đạt.
- `client/src/pages/IdeaMap.jsx`: vòng đời drag, hit test, hủy, commit/lịch sử và bảo toàn metadata panel.
- `client/src/components/IdeaCard.jsx`, `FrameBox.jsx`, `TreePanel.jsx`: trạng thái đổi chỗ và hướng dẫn dùng.
- `client/src/styles/idea-map.css`: feedback nguồn/ứng viên/đích và tooltip không vượt khung hẹp.

## Khác với plan

Không đổi phạm vi. Với slot đã lưu ở hướng trái/lên, có hiệu chỉnh theo kích thước card để nhánh lớn sau hoán đổi không chồng cha; dữ liệu chưa lưu slot vẫn giữ tọa độ thuật toán cũ.

## Còn dở / cần lưu ý

- Client700/700 test và production build đạt. LSP JS/CSS chưa cài, không tự cài hay báo diagnostics sạch.
- Smoke vẫn lỗi cử chỉ bấm đúp nền có từ baseline trước sửa: `bấm 2 lần phải hoàn tác về 617px, đang ở 784px`. Không sửa/skip test này; build có cảnh báo chunk>500kB đã có.
- Bằng chứng: `/home/chaupt/.cache/tmp/sibling-client-tests.log`, `sibling-build.log`, `sibling-smoke.log`, `sibling-helper-evidence/REPORT.md`; ảnh `sibling-swap-drag.png`, `sibling-cross-side.png`, `sibling-up-right.png`, `sibling-mobile.png`, `sibling-groups.png`, `sibling-final-dark.png`, `sibling-panel-mobile.png` trong cùng cache.
- Tự review diff, không có yêu cầu strict review riêng. Final browser0 console errors/0 failed HTTP, còn2 cảnh báo React Router cũ. Không thay API/schema hoặc dữ liệu board thật.
- Đã fast-forward commit `3f034a5` về main, kiểm lại main700/700 và build đạt. Client7155 phục vụ helper/handler mới qua HTTP chỉ đọc; dirty `client/src/index.css` giữ nguyên, không push. Browser và Vite QA7156 đã dừng, cache tạm đã xóa, bằng chứng được giữ ngoài worktree.
