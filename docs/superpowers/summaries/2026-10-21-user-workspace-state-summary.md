# Không gian làm việc riêng theo tài khoản

[Spec](../specs/2026-10-21-user-workspace-state-design.md) · [Plan](../plans/2026-10-21-user-workspace-state.md)

## Đã làm gì

- Tự lưu và khôi phục vùng đang xem/zoom, minimap, mục lục, nhóm chip trạng thái/nhãn/palette và inspector đang mở theo tài khoản + board + desktop/mobile.
- Các máy cùng tài khoản tải state từ server; cache riêng tài khoản giữ thay đổi chưa đồng bộ khi mất mạng. Request ràng buộc tài khoản kỳ vọng để tab cũ không ghi vào tài khoản mới sau khi cookie đổi.
- Desktop/mobile dùng state riêng; resize giữ tâm nhìn và không ghi đè bố trí tự động. Trên màn hình hẹp mục lục tạm ẩn khi inspector mở, giữ ý định để hiện lại sau đó.
- Giao diện → Đặt lại giao diện chỉ reset user/board/profile hiện tại. Khôi phục cây không bố trí lại card, không ghi board hay thêm undo; viewer chỉ đọc các điều khiển cây.
- Đã kiểm 723/723 test client, 144/144 test server, build và hai smoke `workspace`/`tree-panel`. Browser chạy app thật trong StrictMode với API/socket fixture: reload, context mới, account isolation, resize, offline→online, target mất, reset, GET chậm và retry camera đều đạt. API/auth/router và MongoDB thật đã kiểm độc lập, dữ liệu board QA không đổi và đã xoá đúng dữ liệu QA.

## File chính

- `server/workspace.js`, `server/models.js`, `server/index.js`: collection riêng và API GET/PATCH/DELETE có kiểm quyền, kiểm account, validation đóng và atomic field patches.
- `server/workspace.test.js`: HTTP auth/permission/isolation/validation/concurrent/reset/account-cookie regressions.
- `client/src/lib/workspace-state.js`, `useWorkspaceState.js`: normalize, camera tâm, cache theo key, hydrate, hàng đợi revision và retry/drain lifecycle.
- `client/src/lib/workspace-state.test.js`: 10 regression về camera/cache/race/offline/hydration/StrictMode.
- `client/src/pages/IdeaMap.jsx`: state giao diện bền vững, inspector duy nhất, restore không side effect và reset.
- `client/src/components/TreePanel.jsx`, `client/src/styles/idea-map.css`: quyền viewer và giới hạn panel responsive.
- `client/src/__smoke__/entry.jsx`, `client/smoke-run.mjs`: kịch bản restore quan sát camera transform, panel, board PUT và undo.

## Khác với plan

Không lệch phạm vi. Review bổ sung account assertion header và các tình huống GET/ACK chậm, dispose, retry camera; đã sửa và có test/bằng chứng. Không thêm kéo/resize cho UI chưa hỗ trợ; các panel hiện tại vẫn neo CSS. Không di chuyển camera legacy dùng chung board vào tài khoản để tránh trộn state người từng dùng chung trình duyệt.

## Còn dở / cần lưu ý

- Full smoke vẫn có lỗi bấm đúp nền từ trước: `bấm 2 lần phải hoàn tác về 617px, đang ở 784px`; không sửa/skip/nới assertion ngoài phạm vi. Build có cảnh báo chunk>500kB, smoke có cảnh báo React act/Router đã tồn tại.
- State tạm như context menu, form nháp, mode vẽ, bộ lọc tìm kiếm không được khôi phục. Theme/ngôn ngữ/bút và các thiết lập device-local trước đây không chuyển sang server trong phạm vi này. Chưa bổ sung kéo/resize panel mới.
- Browser dùng fixture để không chạm board thật; đường lưu server đã được kiểm thêm qua MongoDB thật. Không tuyên bố đã tự đăng nhập Google trên browser người dùng.
- Bằng chứng: `/home/chaupt/.cache/tmp/workspace-browser-results.json`, `workspace-edge-browser-results.json`, `workspace-mongo-http-results.json`, `workspace-review-final.md`; ảnh `workspace-desktop.png`, `workspace-mobile.png`. Nhật ký `/home/chaupt/.cache/tmp/ulw-user-workspace-20261021.vCVgcX.md` ghi cleanup và các lệnh đầy đủ.
- Commits implementation: `7120b00` API riêng, `574d14a` khôi phục workspace. Đã tích hợp local main; chưa push. CSS chưa commit của người dùng giữ nguyên. Không tạo recipe vì người dùng chọn chưa cần lưu.
