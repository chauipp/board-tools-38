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
7. Dùng `Template nhanh`: bấm lần lượt `XP & Level`, `Drop rate`, `Currency flow`. Template chỉ thêm metric thiếu, không thay metric cùng key đã tồn tại.
8. Đổi `rare_rate` thành `120`: phải hiện warning vượt max và warning drop rate ngoài 0–100%. Đặt min lớn hơn max hoặc formula tính ra ngoài range: warning phải hiện nhưng vẫn cho phép lưu để GD tự quyết định tuning.

## 14. Kiểm Team handoff (Dev / Art / Audio)

1. Mở một card GD, kéo tới section `Team handoff` và mở nó. Có ba brief xếp dọc: `Dev`, `Art`, `Audio`.
2. Ở Dev, điền `Người nhận`, `Ghi chú bàn giao`, chọn `Sẵn sàng bàn giao`; lưu và tải lại board để xác nhận dữ liệu còn nguyên.
3. Ở Art, điền brief, asset requirements, reference, format, naming convention; chọn `Đã bàn giao`, người nhận và ngày. Lặp lại tương tự với Audio.
4. Xác nhận badge trạng thái của từng team hiển thị `Bản nháp` / `Sẵn sàng bàn giao` / `Đã bàn giao` đúng dữ liệu; trong dock 275px không có control nào chồng hoặc tràn ngang.
5. Bấm `Handoff` ở header. Chọn lần lượt Dev, Art, Audio và `Tất cả card`, `Card đang chọn` hoặc `Theo loại card`.
6. Dev Markdown phải có `Technical notes` và `Dev handoff`, nhưng không có brief Art/Audio. Art/Audio Markdown phải có brief đúng team, trạng thái/người nhận/ngày bàn giao và không có technical notes Dev.
7. Chọn `Sao chép Markdown` hoặc `Xuất Markdown`; tên file phải là `game-design-dev-handoff.md`, `game-design-art-handoff.md` hoặc `game-design-audio-handoff.md`.
8. Với viewer, toàn bộ input/select của Team handoff bị khóa nhưng nội dung vẫn đọc được.

### Handoff theo loại card

1. Tạo ít nhất một card Mechanic, UI/UX và Playtest. Mở `Handoff` → `Phạm vi xuất` → `Theo loại card`.
2. Giữ Ctrl/Cmd chọn Mechanic và UI/UX. Preview chỉ có các card thuộc hai loại này; số card xuất đúng tổng đang chọn.
3. Relation sang card Playtest không được xuất; relation giữa hai card trong scope vẫn được xuất.
4. Đổi sang chỉ Playtest hoặc bỏ toàn bộ chọn loại: preview/số lượng cập nhật ngay, không lỗi/overlap ở dock 275px.
5. Xuất file: tên file phải bao gồm id loại card đã chọn, ví dụ `game-design-dev-mechanic-ui-ux-handoff.md`.

## 15. Kiểm Review workflow

1. Tạo board GD mới và xác nhận filter/status có thêm `Approved` và `Rejected`; card có thể được kéo vào hai status này như status cũ.
2. Mở card GD, mở section `Review`, chọn `Changes requested`, điền reviewer/ngày review, thêm một yêu cầu chỉnh sửa và người ghi.
3. Tick `Đã xử lý`, lưu rồi reload: outcome, reviewer, ngày và trạng thái resolved phải còn nguyên.
4. Đổi outcome lần lượt thành `Approved` và `Rejected`; card preview phải hiển thị outcome ở phần Review.
5. Mở `Handoff`: Markdown có `Review`, outcome/reviewer/date và chỉ các yêu cầu chưa xử lý. Viewer chỉ đọc được và không thêm/sửa/xóa/tick/lưu được.

## 16. Kiểm Dependency Guard

1. Trên board GD, tạo ba card A, B, C; tạo dây `A phụ thuộc B`, `B phụ thuộc C`, `C phụ thuộc A`.
2. Xác nhận cả ba card hiện badge `Blocked` và `Vòng lặp`; ba dây đổi sang nét cảnh báo đỏ cam đứt, vẫn bấm chọn được.
3. Chọn dây A → B: dock 275px hiển thị `Chuỗi phụ thuộc` theo dạng `A → B → C`, cùng cảnh báo blocker và vòng lặp; nội dung dài phải tự xuống dòng, không tràn ngang.
4. Xóa dây C → A: badge `Vòng lặp` và cảnh báo vòng lặp phải biến mất. A/B vẫn `Blocked` khi prerequisite chưa có status `Done`.
5. Đặt C thành `Done`: B hết `Blocked`; đặt B thành `Done`: A hết `Blocked`.
6. Đổi một dây thành `Mở khóa` / `Thay thế` / `Xung đột`: dây đó không được tính blocker hoặc vòng lặp.
7. Mở cùng board bằng link viewer: badge và inspector vẫn đọc được, selector relation và nút xóa dây bị khóa/ẩn.

## 17. Kiểm Delivery tracking (milestone, assignee, deadline, blocker)

1. Mở một card GD và mở section `Delivery` ở cuối dock phải.
2. Điền milestone `Vertical slice`, assignee `Linh`, deadline hợp lệ và chọn `Đang bị chặn`; nhập blocker `Chờ animation`.
3. Lưu, tải lại board và mở lại card: tất cả dữ liệu phải còn nguyên. Trong preview card, milestone/deadline/assignee hiện gọn; badge `Bị chặn` dễ nhìn, không đè title/nút/preview khác.
4. Đổi `Mức blocker` sang `Có rủi ro`, xác nhận badge thành `Rủi ro`; đổi sang `Không có`, badge biến mất. Text blocker có thể giữ để làm ghi chú, nhưng không còn mang trạng thái khẩn cấp.
5. Mở Xuất Markdown / Handoff: card có section `Delivery` với Milestone, Assignee, Deadline và Blocker/Risk khi có dữ liệu.
6. Mở link viewer: thấy đủ thông tin nhưng input/select Delivery bị khóa và không có nút lưu.
7. Trong dock 275px, các field xếp dọc, không tràn ngang/overlap; rê chuột và scroll chỉ cuộn dock.

## 18. Kiểm Analytics events và KPI

1. Mở một card GD, mở section `Analytics events` ở cuối dock phải và bấm `+ Thêm event`.
2. Điền `Event name` (ví dụ `dash_used`), trigger, properties, KPI liên quan và owner; lưu rồi reload.
3. Xác nhận event còn nguyên, section hiển thị số lượng event và card có badge `Analytics 1` (nhiều event thì số tăng tương ứng).
4. Mở Markdown/Handoff: xác nhận có `Analytics events`, event name và các field Trigger/Properties/KPI/Owner.
5. Thử thêm/xóa event; không cho vượt quá 20 event. Event không có tên không được xuất sau khi lưu.
6. Với viewer, event vẫn đọc được nhưng mọi input, nút thêm/xóa/lưu bị khóa hoặc ẩn.
7. Dock 275px phải xếp dọc, không overlap; console/network không có lỗi mới.

## 19. Kiểm Follow-up tasks

1. Mở card Playtest hoặc card có Decision log; mở section `Follow-up tasks` và bấm `+ Thêm việc`.
2. Điền nội dung, owner, deadline, chọn card liên quan; lưu rồi reload.
3. Card hiện `Follow-up 0/1`. Tick `Hoàn thành`, lưu: card đổi thành `Follow-up 1/1` và trạng thái còn nguyên sau reload.
4. Mở Markdown/Handoff: có `Follow-up tasks` dạng checkbox, owner/deadline/card liên quan.
5. Thử thêm/xóa task; giới hạn 20. Task rỗng không được lưu/xuất.
6. Viewer chỉ đọc, không tick/thêm/xóa/lưu; dock 275px không tràn/ngang hoặc overlap.

## 20. Kiểm Balance links trên card

1. Trong Balance sheet, gắn metric `Damage` và `Cooldown` vào một card Mechanic qua `Thẻ liên quan`, lưu.
2. Card đó hiện badge `Balance 2`; card không được gắn không có badge.
3. Mở card, section `Balance links` liệt kê hai metric, key và giá trị/kết quả công thức đúng đơn vị.
4. Bấm `Mở Balance`: dock chuyển sang Balance sheet. Bỏ card khỏi metric rồi lưu: card và Balance links cập nhật ngay, không cần reload.
5. Viewer nhìn thấy badge/metric, bấm được `Mở Balance` nhưng không thể sửa metric.
6. Dock 275px không tràn ngang, console/network không có lỗi mới.

## 21. Kiểm A/B test hypotheses

1. Mở một card GD, kéo xuống section `A/B test hypotheses` và bấm `+ Thêm hypothesis`.
2. Điền giả thuyết `Giảm cooldown tăng tần suất dash`, Control `1.0s`, Variant `0.7s`, Primary metric `dash_used/session`, tiêu chí thành công `Tăng 5% mà không giảm retention`, phân khúc `Người chơi mới`; chọn `Running` và lưu.
3. Reload board, mở lại card: toàn bộ field và trạng thái còn nguyên. Card canvas hiện badge `A/B 1 · Running`, badge không che title, action hoặc preview.
4. Thêm hypothesis thứ hai trạng thái Draft: badge là `A/B 2 · Running`. Đổi hypothesis đang chạy sang Concluded: badge còn `A/B 2`, không còn `Running`.
5. Mở Markdown/Handoff: xác nhận section `A/B test hypotheses` có hypothesis, Control, Variant, Primary metric, Success criteria, Segment và Status.
6. Thử xóa, thêm tối đa 20 item; hypothesis rỗng không được lưu/xuất. Với viewer, input/select đọc được nhưng bị khóa và không có nút thêm/xóa/lưu.
7. Kiểm dock cố định 275px, nội dung xếp dọc, `scrollWidth === clientWidth`; cuộn trong dock không làm pan/zoom canvas. Console/Network không có lỗi mới.

## 22. Kiểm Live tuning, rollout và feature flag

1. Mở một card GD và section `Live tuning & rollout`; nhập tuning notes, version `1.4.0`, feature flag `dash_cooldown_v2`, rollout `25`, audience `Người chơi mới`, status `Running`, rollback plan `Tắt flag và trả cooldown 1.0s`.
2. Lưu và reload: toàn bộ dữ liệu còn nguyên. Card hiện badge xanh `Live · 25%`, không overlap title, nút card hay preview.
3. Đổi status sang `Paused`: badge vàng `Live · Paused`; đổi `Rolled back`: badge đỏ `Live · Rolled back`; `Full rollout` hiện `Live · Full`.
4. Thử rollout `101`, `-1`, `25.5` hoặc chữ: sau save/reload giá trị không hợp lệ bị xoá, không làm board lỗi. `0` và `100` phải được giữ.
5. Mở Markdown/Handoff: có `Live tuning & rollout` với Version, Feature flag, Rollout, Audience, Status, Tuning notes và Rollback plan.
6. Viewer chỉ đọc nội dung, input/select bị khóa, không có nút lưu. Dock 275px không overflow, scroll trong dock không pan canvas; console/network không có lỗi mới.

## 23. Kiểm Post-launch review

1. Mở một card đã release, mở `Post-launch review`. Điền outcome, actual metrics, learnings, next decision, owner và ngày review; chọn card liên quan qua `Thẻ liên quan`.
2. Chọn `Needs iteration`, lưu/reload: dữ liệu và reference còn nguyên; card hiện badge vàng `Post-launch · Iterate`, không overlap title/action/preview.
3. Đổi sang `Healthy` và `Sunset`: badge lần lượt xanh `Healthy` và đỏ `Sunset`; `Pending` dùng badge trung tính.
4. Mở Markdown/Handoff: có section `Post-launch review` cùng Status, Outcome, Actual metrics, Learnings, Next decision, Owner, Review date và Related cards.
5. Xóa card được liên kết, reload board: reference card đã xóa tự biến mất khỏi review, không gây lỗi save/load.
6. Viewer chỉ đọc, không sửa status/text/reference/lưu. Kiểm dock 275px không horizontal overflow, scroll chỉ tác động dock, console/network không có lỗi mới.

## 24. Kiểm export có version (Markdown / JSON / Handoff)

1. Trên board GD đã lưu, mở `Xuất MD`: file tải về có version trong tên và đầu Markdown có `Export version` khớp `updatedAt` của board.
2. Trong menu, bấm `Xuất JSON`: preview phải là package có `format: game-design-board-export/v1`, `exportedAt`, `boardName`, `boardKind`, `version` và `board`.
3. Bấm `Tải JSON`: tên file có version. Sau đó Nhập JSON chính file vừa tải: board mở lại bình thường, không làm mất card/edge/dữ liệu GD.
4. Mở `Handoff`: preview có `Export version`; tải Markdown có version trong tên file. Đổi phạm vi/team/type: version vẫn hiện và content/số card vẫn đúng scope.
5. Board tư duy vẫn export JSON cũ, không bị bọc package GD. Console/network không lỗi mới.

## 25. Kiểm tạo nhanh card liên quan

1. Mở một card GD bất kỳ. Trong dock có section `Tạo card liên quan` với lựa chọn loại card và relation.
2. Chọn `UI / UX` + `Mở khóa`, bấm `+ Tạo & nối`: một card UI/UX mới xuất hiện bên phải card nguồn, có dây `Mở khóa`; dock chuyển sang card mới.
3. Lặp lại với `Playtest` + `Phụ thuộc` và `Quest / Level` + `Thay thế`; kiểm mỗi card/dây đúng loại relation và không overlap card nguồn rõ rệt.
4. Reload board: card/dây còn nguyên; Undo một lần phải xoá cả card mới lẫn dây vừa tạo, Redo phải khôi phục cả hai.
5. Viewer không thấy section/nút tạo; dock 275px không overflow, console/network không lỗi mới.

## 26. Kiểm Player experience / cảm xúc mong muốn

1. Mở card GD, điền `Trải nghiệm người chơi / cảm xúc mong muốn`, ví dụ `Căng thẳng nhưng công bằng; cảm giác làm chủ khi né đúng lúc`, rồi lưu/reload.
2. Xác nhận text còn nguyên; card preview hiện field khi còn chỗ, không che title/nút/badge.
3. Mở Markdown/Handoff: có section `Trải nghiệm người chơi` và đúng nội dung.
4. Thử nhập hơn 2.000 ký tự: input chặn ở giới hạn; viewer thấy text nhưng field disabled, không có nút lưu. Dock không overflow, console/network sạch.

## 27. Kiểm Archived status

1. Tạo một board Game Design mới. Trong panel trạng thái, xác nhận có `Archived` sau `Rejected`.
2. Gán `Archived` cho một card qua chip kéo-thả hoặc selector trạng thái; reload board, card và toàn bộ data/edge vẫn còn nguyên.
3. Lọc theo `Archived`: chỉ card đó hiện; đổi nó lại `Draft` hoặc `Done` để xác nhận archive không khóa card.
4. Board GD cũ không tự có status Archived sau reload. Viewer thấy/lọc card Archived nhưng không đổi status.

## 28. Kiểm nhân bản card Game Design

> Ghi chú cho Claude: local Playwright của Codex đang không mở được vì profile browser bị một tiến trình khác chiếm; hãy chạy mục này trong phiên browser đã đăng nhập sẵn theo hướng dẫn OAuth hiện có.

1. Mở một card GD có title, spec lồng nhau (ví dụ Acceptance criteria), tag/status và ít nhất một dây nối. Trong dock editor, section `Biến thể card` phải hiện nút `Nhân bản thẻ`.
2. Bấm `Nhân bản thẻ`: card mới xuất hiện khoảng bên phải card nguồn; dock tự chuyển sang card mới và title là `<tên cũ> — bản sao`.
3. So sánh title, mô tả, loại card và các field spec: tất cả được copy. Bản sao không có tag/status của bản gốc và không sinh thêm edge/dây nối.
4. Sửa một Acceptance criterion hoặc field trong bản sao, lưu rồi mở lại bản gốc: nội dung card nguồn không đổi. Reload: cả hai card vẫn còn độc lập.
5. Undo một lần: card clone biến mất; Redo: nó trở lại cùng spec. Với viewer, không thấy section/nút `Biến thể card`.
6. Kiểm dock vẫn rộng 275px, không tràn ngang/overlap; cuộn trong dock không pan canvas. Console/network không có lỗi mới.

## 29. Kiểm Decision timeline

1. Trên ít nhất hai card GD, thêm Decision log có ngày `2026-08-10` và `2026-08-12`; thêm một quyết định chưa có ngày hoặc ngày legacy. Có cả status `Đang áp dụng` và `Đã thay thế`.
2. Bấm `Decisions` ở header board GD. Dock phải mở timeline dọc 275px: item ngày `2026-08-12` đứng trước `2026-08-10`, item không có ngày đứng sau; mỗi item ghi rõ card nguồn, owner, lý do/evidence nếu có và trạng thái.
3. Bấm `Mở: <tên card>`: timeline đóng và inspector mở đúng card nguồn. Thử lần lượt các item ở card khác nhau.
4. Mở bằng link viewer: timeline vẫn xem/mở được card nguồn nhưng không có input, nút thêm, lưu hay xóa quyết định trong timeline.
5. Với board không có Decision log, mở `Decisions`: hiện empty state, không lỗi và dock không tràn ngang. Kiểm console/network không lỗi mới.
