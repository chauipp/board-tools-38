# Không gian làm việc riêng theo tài khoản

## Phạm vi đã được duyệt

Lưu theo tài khoản đăng nhập + board + profile màn hình. Desktop (rộng từ 768 CSS px) và mobile (nhỏ hơn 768) độc lập. Lưu camera tâm board+zoom, minimap/mục lục, nhóm chip trạng thái/nhãn/palette và một inspector chính. Các thành phần hiện có đều neo CSS, chưa có UI kéo/đổi cỡ độc lập, nên giữ neo và giới hạn theo viewport; không bổ sung chức năng kéo mới. Không lưu menu tạm, form nháp hay mode thao tác nguy hiểm.

## Dữ liệu và API

Collection riêng `WorkspaceState`, unique email phiên đăng nhập + boardId + profile; không sửa Board hoặc phát board:update. GET/PATCH/DELETE `/api/boards/:id/workspace/:profile` đều yêu cầu đăng nhập và quyền xem board; viewer được lưu setting cá nhân, người ngoài404. State version1 có camera `{x,y,scale}`, các boolean `miniOpen,outlineOpen,statusOpen,tagOpen,paletteOpen`, inspector null hoặc type tree/design/brief/flow/balance/handoff/decisions/insights/impact/playtests/reports/snapshots. Tree có kind node/group và id; design có id. PATCH `{changes:{...}}` chỉ nhận trường đóng, atomic từng trường; cùng trường nhận sau thắng, khác trường không ghi đè. GET/PATCH trả `{version:1,state,updatedAt}`; chưa có hoặc DELETE trả state rỗng.

Mọi request có header `X-Workspace-User` khớp email session, chỉ là assertion chống tab cũ dùng cookie tài khoản mới, không chọn owner. Mismatch409 dừng đồng bộ và hướng dẫn tải lại; header thiếu/sai400. Viewer restore cây chỉ đọc, không được đổi bố cục. Trên mobile, khi inspector đang mở, mục lục tạm ẩn nhưng ý định mở vẫn giữ để xuất hiện lại khi đóng inspector.

## Client

Hook riêng quản lý fetch/cache/queue, cache khoá email+board+profile. Chờ hydrate trước khi dùng UI; thay đổi trước fetch không được bị dữ liệu cũ ghi đè. Gửi patch rời rạc sau1giây, tuần tự từng tab; retry khi online và khi lỗi mạng. Lỗi không giả báo đã đồng bộ. Không tự đẩy setting từ máy khác vào giao diện đang dùng. Reset gửi đầy đủ default trong patch tuần tự để không có race DELETE/patch; API DELETE vẫn hỗ trợ reset phía server.

Một inspector phân biệt type thay thế các boolean độc lập; UI setters chuyển loại mà không bị close của bảng cũ xoá bảng mới. Restore cây chỉ set gốc/options/refs, không gọi `openTreePanel` vốn bố trí và lưu board. Target bị xoá thì bỏ inspector; deep link card rõ ràng ưu tiên camera mở từ link. Snapshots khi restore nạp danh sách nhưng không tạo snapshot.

Camera chuyển qua tâm của viewport; resize cùng profile giữ tâm/zoom, không tạo cập nhật setting chỉ vì thu/phóng cửa sổ. Profile đổi thì tải state riêng; không copy ghi đè profile khác. Giữ camera mặc định nếu chưa có setting; không lấy cache legacy chung board của user khác. Mục đang xem, mục lục và panel không ra khỏi viewport trên375×667.

## Kiểm chứng

Node tests pure camera/validation/cache/sync và HTTP router; baseline client713, server theo log. Browser fixture cùng tài khoản ở context mới, resize2profile, offline→online, target mất và reset không đổi board/undo. Console/network checked, ảnh desktop/mobile. Không dùng cookies hoặc ghi board thật trong fixture.

## Plan thực thi

[Plan](../plans/2026-10-21-user-workspace-state.md) · [Summary](../summaries/2026-10-21-user-workspace-state-summary.md)
