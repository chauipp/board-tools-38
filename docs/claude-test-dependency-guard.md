# Brief cho Claude — Test Dependency Guard

## Mục tiêu

Kiểm tra trực tiếp trên trình duyệt tính năng **Dependency Guard** của Game Design Board. Chỉ báo `PASS` khi đã kiểm UI bằng Playwright và không có lỗi Console/Network bất thường.

Phạm vi thay đổi cần test:

- `depends-on` giữa card GD được hiểu là: `A depends-on B` thì A bị block cho đến khi B có status `Done`.
- Card bị block hiện badge `Blocked`.
- Vòng phụ thuộc hiện badge `Vòng lặp` trên card và dây cảnh báo đỏ/cam nét đứt.
- Chọn một edge `depends-on` mở dock phải, thấy chain và cảnh báo tương ứng.
- `unlocks`, `replaces`, `conflicts-with` không được tạo blocker hoặc cycle.

## Điều kiện trước khi test

- Làm trong worktree `board-tools` hiện tại, không sửa hoặc commit code trừ khi tìm ra bug và được yêu cầu sửa.
- Desktop viewport: `1440 × 900`.
- Dùng backend thật port `3345`; frontend đang chạy tại `http://localhost:7155` (nếu Vite báo cổng khác, dùng cổng Vite in ra).
- Có thể đăng nhập trong browser Playwright. Nếu Google GSI chặn origin, dùng browser/profile đã đăng nhập sẵn hoặc thiết lập cookie session test; không coi màn Login là editor đã test.

Khởi động nếu chưa có server:

```bash
cd "server"
PORT=3345 PUBLIC_MODE=true npm run dev

cd "../client"
CHOKIDAR_USEPOLLING=true npm run dev -- --host 0.0.0.0
```

## Kịch bản chính: blocker và vòng lặp

1. Tạo một board mới loại `Game Design`, tên `TEMP Dependency Guard — xóa sau test`.
2. Tạo ba card GD, đổi tên thành `A`, `B`, `C` và đặt cách nhau đủ xa để nhìn rõ dây.
3. Dùng công cụ dây tạo ba relation:

   - `A depends-on B`
   - `B depends-on C`
   - `C depends-on A`

   Mặc định dây GD có thể đã là `depends-on`; nếu không, bấm từng dây và chọn `Phụ thuộc` trong dock.

4. Kiểm card:

   - Mỗi card A/B/C có đúng các badge `Blocked` và `Vòng lặp`.
   - Badge không che tiêu đề, các nút card hoặc nội dung preview.
   - Ba dây cycle hiển thị kiểu cảnh báo đỏ/cam, nét đứt và vẫn bấm được.

5. Bấm edge `A → B`. Kiểm dock phải:

   - Dock có bề rộng chính xác `275px`.
   - Có `Chuỗi phụ thuộc` và nội dung `A → B → C`.
   - Có cảnh báo thẻ nguồn bị chặn.
   - Có cảnh báo `Vòng lặp phụ thuộc`.
   - Không tràn ngang: `scrollWidth === clientWidth` cho `.edit-dock`.
   - Text dài tự xuống dòng, không overlap với selector quan hệ hoặc nút `Xóa dây`.

6. Chụp screenshot trước/sau khi mở dock để lưu bằng chứng.

## Kịch bản thay đổi trạng thái

1. Xóa edge `C → A`.
2. Kiểm A/B/C không còn badge `Vòng lặp`, dây còn lại trở về kiểu dependency bình thường.
3. A vẫn `Blocked` vì B chưa `Done`; B vẫn `Blocked` vì C chưa `Done`.
4. Chuyển status C sang `Done`: B hết `Blocked`.
5. Chuyển status B sang `Done`: A hết `Blocked`.
6. Reload trang: trạng thái badge và relation vẫn đúng sau khi nạp lại.

## Kịch bản relation không phải dependency

1. Tạo một edge `A unlocks B`, một edge `B replaces C`, hoặc `C conflicts-with A`.
2. Xác nhận các edge này không làm card xuất hiện `Blocked` hay `Vòng lặp`.
3. Chọn edge đó: dock chỉ mô tả loại relation, không hiện block/cycle warning.

## Kiểm UI tổng quát

- Rê chuột và lăn trên dock: dock cuộn, canvas không bị pan/zoom ngoài ý muốn.
- Không có overlap giữa dock, HUD, minimap và các control khác.
- Card/badge dễ đọc ở theme hiện tại, có tương phản rõ.
- Console không có `error` mới do UI. Network không có request `4xx/5xx` bất ngờ (trừ request auth đã biết trước nếu không đăng nhập).

## Kiểm viewer (nếu đã có link viewer)

- Viewer vẫn thấy badge và nội dung chain/warning trên edge inspector.
- Viewer không được đổi relation hoặc xóa dây; selector bị disabled và nút xóa ẩn.

## Cách ghi kết quả

Trả về theo mẫu:

```md
## Dependency Guard test — PASS | FAIL

- URL/board test: …
- Browser/viewport: …
- Kịch bản chính: PASS | FAIL
- Thay đổi status/reload: PASS | FAIL
- Relation không dependency: PASS | FAIL
- Dock 275px + overflow: PASS | FAIL (đo được: …)
- Console errors: …
- Network failures: …
- Screenshot: …
- Bug phát hiện (nếu có): bước tái hiện, actual, expected, ảnh/log.
- Dọn dẹp: đã xóa board test / chưa xóa (lý do).
```

## Dọn dẹp

Xóa board có tên bắt đầu bằng `TEMP Dependency Guard` khi test xong, kể cả test fail. Không để lại dữ liệu test trong tài khoản thật.

---

## Phần bổ sung — Test Delivery tracking

Sau khi test Dependency Guard, trên một board GD tạm, mở một card và section `Delivery`.

1. Điền `Milestone = Vertical slice`, `Assignee = Linh`, `Deadline = 2026-09-15`, `Mức blocker = Đang bị chặn`, `Blocker = Chờ animation` rồi lưu.
2. Reload trang, mở lại card: mọi field còn nguyên.
3. Canvas card hiển thị milestone, deadline, assignee và badge `Bị chặn`; chúng không overlap với title, control hay preview khác.
4. Chuyển Mức blocker lần lượt sang `Có rủi ro` và `Không có`; badge đổi thành `Rủi ro` rồi biến mất.
5. Mở Markdown/Handoff và xác nhận section `Delivery` ghi milestone, assignee, deadline, blocker.
6. Đo `.edit-dock`: rộng 275px và `scrollWidth === clientWidth`; kiểm tra Console/Network sạch.
7. Với viewer, data vẫn đọc được nhưng mọi input/select Delivery disabled và nút lưu không hiện.

## Phần bổ sung — Test Analytics events

1. Mở card GD và section `Analytics events`; thêm event `dash_used`.
2. Điền trigger `Khi dash thành công`, properties `distance, stamina`, KPI `Dùng dash / session`, owner `Linh`; lưu và reload.
3. Xác nhận card hiện badge `Analytics 1`, dock giữ bề rộng 275px, không overflow.
4. Mở Markdown/Handoff, xác nhận event cùng Trigger/Properties/KPI/Owner được xuất.
5. Thử thêm event thứ hai, xóa event, và thử vượt 20 event; kiểm giới hạn hoạt động đúng.
6. Viewer chỉ đọc được, không thêm/sửa/xóa/lưu; kiểm Console/Network sạch.

## Phần bổ sung — Test Follow-up tasks

1. Mở card GD, mở `Follow-up tasks`, thêm việc `Sửa cooldown`, owner `Linh`, deadline `2026-09-15`, gắn một card liên quan.
2. Lưu/reload: card hiện `Follow-up 0/1`; tick Hoàn thành, lưu/reload: hiện `Follow-up 1/1`.
3. Markdown/Handoff xuất checkbox, owner, deadline, tên card liên quan.
4. Thử xóa, thêm tối đa 20 việc; viewer không thể tick/thêm/xóa/lưu; kiểm dock 275px, Console và Network.

## Phần bổ sung — Test Balance links

1. Gắn metric `Damage` và `Cooldown` trong Balance sheet vào một card GD qua `Thẻ liên quan`, lưu.
2. Xác nhận card có `Balance 2`; mở card → `Balance links` liệt kê đúng tên, key, giá trị/kết quả và đơn vị.
3. Bấm `Mở Balance`, bỏ liên kết rồi lưu: badge/link biến mất ngay.
4. Viewer chỉ đọc, nhưng vẫn mở được Balance sheet; kiểm dock 275px, Console/Network.

## Phần bổ sung — Test Handoff theo loại card

1. Tạo card Mechanic, UI/UX, Playtest; mở `Handoff` và chọn `Phạm vi xuất = Theo loại card`.
2. Multi-select Mechanic + UI/UX: preview chỉ có hai loại, đúng số lượng card; relation sang Playtest không được xuất.
3. Chọn chỉ Playtest rồi bỏ toàn bộ loại: preview/count cập nhật ngay, không overflow dock 275px.
4. Download Markdown: tên file có các id loại đang chọn. Kiểm Console/Network sạch.

## Phần bổ sung — Test A/B test hypotheses

1. Trên board GD tạm, mở một card và section `A/B test hypotheses`; bấm `+ Thêm hypothesis`.
2. Điền `Giảm cooldown tăng tần suất dash`, Control `1.0s`, Variant `0.7s`, Primary metric `dash_used/session`, Success criteria `Tăng 5% không giảm retention`, Segment `Người chơi mới`; chọn `Running`, lưu và reload.
3. Kiểm dữ liệu còn nguyên và canvas hiện `A/B 1 · Running`. Badge dễ đọc, không overlap title/action/preview.
4. Thêm hypothesis Draft rồi đổi test Running sang Concluded: badge lần lượt là `A/B 2 · Running` và `A/B 2`.
5. Mở Markdown/Handoff: kiểm section `A/B test hypotheses` có đủ hypothesis/Control/Variant/Primary metric/Success criteria/Segment/Status.
6. Kiểm tối đa 20 item, hypothesis trống bị loại sau lưu; viewer chỉ đọc, không thêm/xóa/sửa/chọn status/lưu.
7. Đo `.edit-dock`: `width === 275px`, `scrollWidth === clientWidth`; lăn chuột trên dock không pan/zoom canvas. Console/Network sạch. Chụp screenshot dock mở và card badge.

## Phần bổ sung — Test Live tuning, rollout và feature flag

1. Mở card GD → `Live tuning & rollout`; điền tuning notes, Version `1.4.0`, Feature flag `dash_cooldown_v2`, Rollout `25`, Audience `Người chơi mới`, Status `Running`, Rollback plan `Tắt flag và trả cooldown 1.0s`; lưu/reload.
2. Kiểm mọi dữ liệu còn nguyên và card có badge xanh `Live · 25%`, không overlap title/action/preview.
3. Đổi status sang Paused, Rolled back, Full rollout; kiểm lần lượt badge vàng `Live · Paused`, đỏ `Live · Rolled back`, xanh `Live · Full`.
4. Kiểm `0` / `100` giữ được; `101`, `-1`, `25.5`, text không hợp lệ không tồn tại sau lưu/reload và không gây lỗi.
5. Markdown/Handoff có section `Live tuning & rollout`, gồm đủ Version/Feature flag/Rollout/Audience/Status/Tuning notes/Rollback plan.
6. Viewer chỉ đọc, input/select disabled, không nút lưu. Đo dock 275px + không horizontal overflow; kiểm Console/Network và chụp ảnh bằng chứng.

## Phần bổ sung — Test Post-launch review

1. Mở card GD → `Post-launch review`; điền Outcome, Actual metrics, Learnings, Next decision, Owner, Review date; chọn một `Thẻ liên quan`, đặt Status `Needs iteration`, lưu/reload.
2. Xác nhận field/reference còn nguyên; canvas có badge vàng `Post-launch · Iterate`, không overlap title/action/preview.
3. Đổi status qua Healthy, Sunset, Pending; kiểm badge xanh, đỏ, trung tính tương ứng.
4. Markdown/Handoff có section `Post-launch review` với đủ field và tên thẻ liên quan.
5. Xóa card tham chiếu, reload: reference cũ không còn, không error. Viewer disabled toàn bộ input/select/reference, không có nút Lưu.
6. Đo dock 275px/không overflow; scroll chỉ dock; Console/Network sạch; chụp screenshot.

## Phần bổ sung — Test Versioned export

1. Board GD đã lưu: `Xuất MD` tải file có version trong filename và đầu Markdown có `Export version` khớp mốc board.
2. Menu → `Xuất JSON`: kiểm package `game-design-board-export/v1`, có exportedAt/boardName/boardKind/version/board. Bấm `Tải JSON`, kiểm filename có version.
3. Nhập lại chính JSON package vừa tải: card/edge/dữ liệu GD còn nguyên. Board idea xuất JSON dạng cũ, không package GD.
4. Handoff preview hiện `Export version`; Markdown tải có version trong filename; đổi team/scope/type không làm sai version hoặc số card.
5. Console/Network sạch; chụp preview Handoff và JSON metadata.

## Phần bổ sung — Test tạo nhanh card liên quan

1. Mở card GD; trong dock xác nhận có `Tạo card liên quan`, chọn UI/UX + Mở khóa, bấm `+ Tạo & nối`.
2. Card UI/UX mới nằm bên phải nguồn, dây có relation Mở khóa, dock chuyển sang card mới. Lặp Playtest + Phụ thuộc và Quest/Level + Thay thế.
3. Reload còn đủ card/dây. Undo xóa đúng cả card+dây của action cuối; Redo phục hồi đủ.
4. Viewer không có section/nút; dock 275px không overflow; Console/Network sạch, chụp screenshot.

## Phần bổ sung — Test Player experience

1. Mở card GD, điền `Trải nghiệm người chơi / cảm xúc mong muốn` (ví dụ Căng thẳng nhưng công bằng; làm chủ khi né đúng lúc), lưu/reload.
2. Xác nhận text còn nguyên; preview card hiện field khi còn chỗ, không overlap.
3. Markdown/Handoff có `Trải nghiệm người chơi` và đúng nội dung. Viewer field disabled, không nút lưu; dock 275px/Console/Network sạch.

## Phần bổ sung — Test Archived status

1. Tạo board GD mới, mở panel status: có `Archived` sau `Rejected`.
2. Gán Archived cho card, reload: card/data/edge còn nguyên. Lọc Archived chỉ còn card đó; đổi lại Draft/Done thành công.
3. Board GD cũ không tự bị thêm Archived. Viewer thấy/lọc nhưng không thể đổi status; Console/Network sạch.
