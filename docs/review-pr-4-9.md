# Review PR #4–#9

**Ưu tiên trước khi merge:** giữ các chỉnh sửa đồng thời trong hàng đợi lưu của #7 và thu hẹp phạm vi file mà Vite được phục vụ trong #9. Hai lỗi hàng đợi đã có trong logic trước khi tách IdeaMap. #7 đưa logic này vào module riêng, nên có thể tái hiện và sửa bằng unit test độc lập.

## Các phần cần cải thiện

| Ưu tiên | PR và vị trí | Điều kiện và hậu quả | Cách sửa và tiêu chí nghiệm thu |
|---|---|---|---|
| P1 | #7 · `client/src/lib/save-queue.js:70` | Khi PUT A đang gửi, thao tác B xếp một bản board đầy đủ vào `pending`. Nếu A gặp 409, lần thử lại ghép được thẻ của người khác. Ngay sau đó hàng đợi gửi nguyên B với **mốc mới**, dù B được dựng trước khi ghép. Server chấp nhận B và thẻ vừa ghép bị xóa. | Giữ mốc nội dung của B, áp phần thay đổi A→B lên bản vừa ghép và cập nhật cả UI. Test một PUT bị 409 khi đã có PUT chờ. Sau khi tải lại phải còn cả thẻ từ xa lẫn thay đổi B. |
| P1 | #7 · `client/src/lib/save-queue.js:74,128` | Nhấn phím mũi tên trong lúc PUT A đang gửi sẽ hẹn lưu vị trí sau 500 ms. Nếu A gặp 409 trước khi hết hạn, lời gọi thử lại chạy `cancelTimer()`. Vị trí mới chưa vào `pending` và bị mất. | Tách retry nội bộ khỏi thao tác thay thế lần lưu hẹn giờ. Test với đồng hồ giả và 409 đến ở giữa khoảng 500 ms. PUT cuối phải giữ cả vị trí mới lẫn thay đổi từ xa. |
| P1 | #9 · `client/vite.config.js:16` | `fs.allow: [".."]` cho phép dev server phục vụ file từ toàn bộ repo. Khi dùng kho PDF local, `server/pdf-storage.js:15` lưu tệp dưới `server/uploads/pdf`. Người truy cập được dev server và biết đường dẫn file có thể đọc qua middleware file của Vite, ngoài route kiểm quyền board. | Chỉ cho phép hai thư mục `client/` và `shared/`. Test dev server bằng một file giả vô hại ở ngoài hai thư mục đó, kỳ vọng 403, đồng thời kiểm tra import từ `shared/` vẫn hoạt động. |
| P2 | #5 · `server/routes/boards.js:73` | Bản sửa cấp ID đúng khi **tạo** board. Board game-design cũ đã lưu 9 trạng thái và `nextStatusId = 9` vẫn trả về bộ đếm cũ. Khi thêm trạng thái, client dùng trực tiếp 9, trùng với Archived. | Chuẩn hóa bộ đếm bằng giá trị lớn hơn giữa bộ đếm hợp lệ đã lưu và `max(id) + 1`. Test với board cũ qua luồng đọc → thêm trạng thái → lưu lại. Giữ nguyên ID của trạng thái và tham chiếu trên các thẻ cũ. |
| P2 | #8/#9 · `client/src/components/game-design/GameDesignFlowPanel.jsx:29,53` | Nút thêm cho nhập bước Player Loop thứ 21 hoặc mốc Progression thứ 31. Khi bấm lưu, normalizer cắt còn 20/30 và panel xóa cờ đã sửa. Đã kiểm tra với 21 bước có tên, kết quả còn 20. Hành vi này có từ trước #8. | Dùng giới hạn trong `shared/game-design-limits.js` cho cả nút thêm. Test nhập đến sát trần, lưu mục cuối hợp lệ và xác nhận UI chặn mục vượt trần trước khi người dùng nhập nội dung. |
| P2 | #9 · `README.md:21,37`, `server/.env.example:7`, `server/config.js:20` | Người mới sao chép env mẫu sẽ chạy Express ở 3001. Vite chuyển API và Socket.IO đến 3345. Với đúng hướng dẫn setup, frontend chạy nhưng API đăng nhập không đến backend. | Đồng bộ mẫu env, giá trị mặc định và proxy theo cổng dev 3345 của dự án. Kiểm tra qua Vite rằng API đăng nhập trả phản hồi từ Express và Socket.IO kết nối đúng cổng. |

**Bằng chứng cho hai lỗi P1 của #7.** Đã chạy module thật với transport giả điều khiển thời điểm trả 409. Với hai lần lưu ngay, ba PUT lần lượt mang `{a:1}`, `{a:1,remote:true,…}`, `{a:2}`; PUT cuối thiếu trường từ xa. Khi lần thứ hai dùng debounce, chỉ có hai PUT, timer đã bị hủy và không PUT nào mang `a:2`.

## Trình tự merge

GitHub hiện ghi #4 nhắm vào `main`. #5, #6 và #7 nhắm vào `refactor/0.2-smoke-scenarios`; #8 nhắm vào `refactor/2.1-ideamap-stateless`; #9 nhắm vào `refactor/integration-trial`. Bấm merge theo số thứ tự hiện tại sẽ đưa thay đổi vào các nhánh đích khác nhau. Nếu đích phát hành là `main`, sau #4 hãy retarget từng PR về `main` khi phần nền của nó đã có mặt, đối chiếu lại diff và chạy CI. Đặc biệt với #9, kiểm tra diff chỉ còn shared, lint và tài liệu sau khi #5–#8 đã vào `main`.

## Phạm vi đã kiểm tra

| PR | Head đã đối chiếu trên GitHub | Phần đã xem |
|---|---|---|
| #4 | `73fb0ea` | Điều phối smoke bằng process riêng, lệnh verify và workflow CI. Chưa thấy lỗi riêng cần sửa trong phần đã kiểm. |
| #5 | `cb31b73` | Bootstrap, router, serializer và test board cũ/mới. Xem phát hiện về bộ đếm trạng thái. |
| #6 | `61fd73d` | So sánh bằng PostCSS trước/sau khi nối theo thứ tự import. Cả 2.698 khai báo giữ nguyên thứ tự, selector/ngữ cảnh, thuộc tính, giá trị và cờ important. Đã xem helper HTTP, luồng auth/PDF và test mã lỗi. Chưa thấy hồi quy cụ thể. |
| #7 | `235d698` | Store, hàng đợi lưu, lịch sử, phím mũi tên và cách nối các thành phần của IdeaMap. |
| #8 | `2d7c509` | Các section của panel, luồng chỉnh Game Flow và chuẩn hóa dữ liệu. |
| #9 | `3d197dd` | Shared constants, Vite, lint và hướng dẫn setup. |

Trên cây tích hợp tại `3d197dd`, `npm run verify` thành công với 799 test client, build production, cả 5 kịch bản smoke và 211 test server. ESLint báo 36 warning và 0 error. Đây là kết quả trên cây tích hợp. Chưa kiểm tay #7 trong phiên trình duyệt với tài khoản và backend thật; smoke dùng jsdom, API và socket giả. Trước khi merge #7, nên dùng hai phiên trên một board thử để xác nhận thao tác kéo/nhích rồi tải lại vẫn giữ chỉnh sửa của cả hai người.

---

## Phản hồi của người làm PR (Claude, 2026-11-28)

Tôi đã đối chiếu từng phát hiện với code. **Cả 6 phát hiện đều đúng, và đã sửa hết.** Không có phát hiện nào tôi phản bác. Hai chỗ tôi chọn cách sửa hơi khác đề xuất; lý do ghi ngay trong dòng tương ứng.

| Phát hiện | Kết luận | Đã sửa (nhánh · commit) | Kiểm chứng |
|---|---|---|---|
| P1 #7 · cú lưu xếp hàng sau 409 | **Đúng.** Có từ trước khi tách IdeaMap: B dựng trước lúc ghép, gửi sau với mốc mới, nên server chấp nhận và xoá thẻ vừa ghép. | `refactor/2.9-cleanup` · `6f92f20`. Sau khi ghép, cú đang xếp hàng được đắp lại phần A→B của nó lên bản vừa ghép (`rebase(merged, A, B)`). Màn hình hiện bản đó, tức đã cập nhật cả UI. Nếu ghép hỏng thì giữ hành vi cũ. | Test mới, đỏ trên code cũ: một PUT bị 409 khi đã có PUT chờ thì PUT cuối giữ cả `remote` lẫn `a:2`. Thêm một test chạy cùng luồng với `rebaseBoard` thật: còn cả thẻ từ xa lẫn cú nhích. |
| P1 #7 · timer bị retry huỷ | **Đúng.** `saveNow(merged, tries+1)` gọi `cancelTimer()`. | Cùng commit `6f92f20`. Chỉ một cú lưu **mới** (`tries === 0`) mới huỷ timer, retry thì không. Hàng đợi nhớ board của timer (`timerNext`) và ghép nó giống cú xếp hàng. | Test với đồng hồ giả: 409 về khi timer còn chờ, timer không bị huỷ, PUT cuối có cả vị trí mới lẫn thay đổi từ xa. |
| P1 #9 · `fs.allow: [".."]` | **Đúng.** Dò thật: một file vô hại ở gốc repo trả **200** qua `/@fs/`. (`.env` đã nằm trong `fs.deny` mặc định của Vite, nhưng `server/uploads/pdf` thì không.) | `refactor/7.2-docs` · `792893f`. Đổi thành `allow: [".", "../shared"]` cho cả `vite.config.js` lẫn `smoke.vite.config.js`. | Dựng dev server bằng API của Vite: file dò **200 → 403**. `shared/ink-kinds.js`, `/`, `src/main.jsx`, và `src/lib/shape.js` (có import từ `shared/`) vẫn **200**. |
| P2 #5 · `nextStatusId` của board cũ | **Đúng.** Bản sửa B1 chỉ áp cho board mới tạo. | `refactor/1.4-split-board-payload` · `d347bec`. `boardPayload` (dùng chung cho GET, thân 409, snapshot) trả `nextStatusId = max(bộ đếm đã lưu nếu là số, max(id) + 1)`. Trên nhánh #9 bản sửa nằm ở `shared/board-fields.js`. ID trạng thái và tham chiếu trên thẻ giữ nguyên; lần lưu kế tiếp của client ghi lại bộ đếm đã sửa. | Test: board cũ 9 trạng thái với bộ đếm 9 → 10; bộ đếm lớn hơn giữ nguyên; bộ đếm thiếu hoặc rác vẫn ra số dùng được; luồng đọc → thêm trạng thái ra id mới không trùng, `statusId` trên thẻ còn nguyên. |
| P2 #8/#9 · nút thêm Game Flow vượt trần | **Đúng.** Có từ trước #8. | `refactor/7.2-docs` · `9c8220a`. Nút "+ Thêm bước/mốc" bị `disabled` khi đủ `GAME_DESIGN_FLOW_LIMITS` (20/30), cách `DetailSection` vẫn làm; không thêm chữ mới lên UI. **Khác đề xuất:** sửa ở #9 chứ không ở #8, vì `shared/game-design-limits.js` chỉ có từ #9. Sửa ở #8 sẽ phải chép tay con số lần nữa, đúng thứ #9 vừa dọn. | Kịch bản smoke `game-design-panels`: 19/29 thì nút còn bấm được, 20/30 thì bị tắt. |
| P2 #9 · cổng 3001 và 3345 | **Đúng.** `.env.example` và giá trị mặc định là 3001, còn proxy Vite, README và AGENTS là 3345. | `refactor/7.2-docs` · `6c24c6a`. `PORT=3345` trong `server/.env.example`, mặc định trong `server/config.js` cũng là 3345 (Render luôn đặt `PORT` nên production không đổi). **Thêm:** gợi ý OAuth origin trong env mẫu đổi từ `localhost:5173` sang `localhost:7155`, cùng loại lỗi. | Grep không còn `3001`/`5173` trong env mẫu và config. **Chưa kiểm** API đăng nhập và Socket.IO qua Vite với backend thật, vì cần MongoDB và tài khoản; phần này cần kiểm tay. |

**Về "Trình tự merge": đúng.** Base hiện tại của các PR xếp chồng sẽ đưa thay đổi vào nhánh trung gian nếu bấm merge theo số. Cách làm đề xuất (sau #4 thì retarget từng PR về `main`, đối chiếu diff, chạy lại CI) khớp với ghi chú trong mô tả các PR. Thêm hai điểm:

- Nếu bật "Automatically delete head branches", GitHub tự đổi base của PR con sang `main` khi nhánh base bị xoá sau merge.
- Khi #6 và #7 cùng vào `main`, `IdeaMap.jsx` sẽ xung đột ở dòng import CSS. Cách giải quyết: giữ phần import của #7 và đổi đường dẫn thành `styles/board/index.css`, như đã làm trên `refactor/integration-trial`.

Sau khi #5–#8 đã vào `main`, diff của #9 cần đối chiếu lại. Giờ nó còn chứa các commit sửa theo review này (Vite, Game Flow, cổng) và một merge commit đưa bản sửa của #5/#7 vào.

**Lan bản sửa sang các nhánh:** bản sửa của #5 và #7 đã merge vào `refactor/integration-trial` rồi vào `refactor/7.2-docs`. Ở bước đó có một xung đột vì `server/board-fields.js` trên #9 chỉ là file re-export; tôi áp tay bản sửa vào `shared/board-fields.js`. #8 không đổi.

**Kiểm tra sau khi sửa:** trên `refactor/7.2-docs` (cây tích hợp mới nhất), `npm run verify` pass: lint 0 lỗi / 36 cảnh báo, client 802 test, build, 5 kịch bản smoke, server 213 test. Nhánh #7 riêng: client 773 test, build, smoke pass. Nhánh #5 riêng: `npm run verify` pass, server 212 test.

**Vẫn chưa làm, đồng ý với review:** chưa kiểm tay #7 bằng hai phiên trình duyệt trên cùng một board với backend thật (kéo/nhích rồi tải lại, va chạm 409). Bản sửa hàng đợi lưu làm việc này càng cần thiết trước khi merge.

## Cho vòng review tiếp theo

**Head hiện tại** (đã push; CI `verify` pass ở cả ba PR có thay đổi):

| PR | Head lần review trước | Head mới | Thay đổi so với lần trước |
|---|---|---|---|
| #4 | `73fb0ea` | `73fb0ea` | Không đổi |
| #5 | `cb31b73` | `d347bec` | +1 commit: sửa `nextStatusId` của board cũ |
| #6 | `61fd73d` | `61fd73d` | Không đổi |
| #7 | `235d698` | `6f92f20` | +1 commit: hàng đợi lưu (cú xếp hàng và timer qua 409) |
| #8 | `2d7c509` | `2d7c509` | Không đổi |
| #9 | `3d197dd` | đầu nhánh `refactor/7.2-docs` (`e51cc65` + các commit chỉ sửa file này) | Merge bản sửa #5/#7 qua `refactor/integration-trial`; +3 commit (Vite `fs.allow`, nút Game Flow, cổng 3345); các commit ghi phản hồi review vào file này |

**Diff cần xem cho từng bản sửa:**

- #7: `git show 6f92f20` — `client/src/lib/save-queue.js`, `client/src/lib/save-queue.test.js` (3 test mới ở cuối file).
- #5: `git show d347bec` — `server/board-fields.js`, `server/board-fields.test.js` (2 test mới ở cuối file). Trên #9 bản sửa nằm ở `shared/board-fields.js`, trong merge commit `0f143ef`.
- #9: `git show 792893f` (Vite), `git show 9c8220a` (Game Flow + smoke), `git show 6c24c6a` (cổng).

**Lệnh tái hiện:**

```bash
# #7 — test hàng đợi lưu (gồm 3 test mới)
cd client && node --test src/lib/save-queue.test.js

# #5 — test bộ đếm trạng thái
cd server && node --test board-fields.test.js

# #9 — kịch bản smoke có phép kiểm nút Game Flow
cd client && npx vite build -c smoke.vite.config.js && SMOKE_ONLY=game-design-panels node smoke-run.mjs

# Toàn bộ (từ gốc repo, trên refactor/7.2-docs)
npm run verify
```

Phép dò `fs.allow` được chạy bằng script tạm ngoài repo, không commit. Cách làm: dựng dev server qua `createServer()` của Vite với `client/vite.config.js`, rồi `fetch` `/@fs/<repo>/fs-probe-harmless.txt` (file tạo tạm ở gốc repo) và `/@fs/<repo>/shared/ink-kinds.js`. Kết quả: 403 và 200.

**Điểm nên soi kỹ ở vòng này:**

- `save-queue.js`: tôi dùng `rebase(merged, next, pending)`, tức đắp delta A→B lên bản vừa ghép. Cách này giả định B được dựng từ trạng thái local đã có A. Đúng với IdeaMap, vì `prepare` đặt bản đã xếp cây lên màn hình trước khi gửi.
- `boardPayload` giờ có thể trả `nextStatusId` khác giá trị đang lưu trong DB, cho tới lần lưu kế tiếp. Test "board shape" chỉ kiểm tập key nên vẫn pass.

## Re-review trên f0b34dc — còn lỗi mất chỉnh sửa

**Chưa nên merge #5/#7.** Đã dùng hai tài khoản riêng trong hai tab sidebar, một owner và một editor, trên cùng board test với Vite, Express, Socket.IO và MongoDB local thật. Hai người thấy nhau trong danh sách online. Owner nhích thẻ A từ x=0 lên 10, editor nhích thẻ B từ y=0 lên 10 gần như đồng thời. UI từng phiên hiện đúng vị trí vừa nhích. Sau khi tải lại cả hai tab, cả hai đều thấy **A trở về x=0, B giữ y=10**. Đây là bằng chứng end-to-end về mất chỉnh sửa. Không thu trace HTTP trong lượt này nên chưa quy kết nó cho một nguyên nhân cụ thể.

| Ưu tiên | Vị trí | Bằng chứng và yêu cầu sửa |
|---|---|---|
| P1 | #5 · `server/routes/boards.js:135` | Kiểm mốc khi đọc rồi ghi bằng ID ở câu lệnh riêng. Đã gọi handler thật với owner và editor, mock model cho hai phép đọc thấy cùng phiên bản. Cả hai nhận 200 và ghi hai nội dung khác nhau. Dùng điều kiện phiên bản ngay trong phép cập nhật MongoDB, bảo đảm phiên bản mới khác phiên bản cũ, và trả 409 kèm board mới khi điều kiện trượt. Test hai PUT đồng thời cùng mốc phải cho đúng một lần thành công trước khi retry. |
| P1 | #7 · `client/src/lib/save-queue.js:139` | Hai người cùng tạo thẻ số 1. Lần ghép đầu chuyển thẻ local sang số 2. Bản chờ sửa thẻ local vẫn dùng số 1. Chạy queue và `rebaseBoard` thật cho kết quả thẻ số 1 của cộng tác viên bị đổi thành B, còn thẻ local số 2 giữ tên A. Cần giữ ánh xạ ID xuyên suốt các phiên bản chờ, kể cả tham chiếu. Test sau reload phải còn thẻ remote nguyên vẹn và thẻ local mang tên B. |
| P1 | #7 · `client/src/lib/save-queue.js:74` | Với PUT A đang gửi, PUT B đang chờ và thao tác C mới hơn đang debounce, khi A retry thành công, `settleSave` gọi `saveNow(B)` rồi hủy timer của C. Đã chạy queue thật với timer điều khiển được. PUT cuối mang B, C biến mất. Phân biệt việc rút phần tử khỏi hàng đợi với việc nhận thao tác mới. Test cả trường hợp retry lẫn lưu thành công ngay. |
| P2 | #5 · `server/routes/board-snapshots.js:74` | Bản sửa chuẩn hóa bộ đếm khi GET và khi tạo snapshot mới. Restore snapshot cũ lại dùng `pickBoardContent(normalized)`, ghi, broadcast và trả nguyên bộ đếm 9. Người dùng thêm trạng thái ngay sau restore vẫn có thể cấp trùng ID 9. Chuẩn hóa trước khi ghi restore. Test snapshot cũ qua route restore, kiểm tra phản hồi, broadcast và bản lưu đều trả 10. Phát hiện qua đọc code. |

Bản sửa giới hạn Game Flow, phạm vi file Vite và cổng mặc định phù hợp với review trước. Đã kiểm trực tiếp đăng nhập và presence qua proxy Vite ở cổng 7155 với backend 3345. `npm run verify` trên cây tích hợp đạt 802 test client, cả 5 kịch bản smoke và 213 test server, lint có 36 warning. Các test queue hiện có bao phủ riêng thao tác chờ và thao tác debounce, nhưng chưa bao phủ tình huống đồng thời ở trên.

---

## Phản hồi vòng 2 của người làm PR (Claude, 2026-11-28)

**Cả 4 phát hiện đều đúng, đã sửa.** Ngoài ra tôi tìm được nguyên nhân của ca end-to-end mà review chưa quy kết (A lùi về x=0, B giữ y=10). Nó là **lỗi thứ năm**, nằm ở client, và bản sửa server một mình không chặn được.

### Nguyên nhân của ca end-to-end

Khi gói `board:update` của người kia về trong lúc một cú nhích của mình còn đang hẹn giờ (debounce 500 ms):

1. `useLiveSync` dời mốc (`lastUpdatedAtRef`) lên mốc mới và thay board trên màn hình bằng bản vừa nhận.
2. Board nằm trong timer vẫn là bản **cũ**, chụp lúc nhích, chưa có thay đổi của người kia.
3. Timer nổ, gửi bản cũ kèm **mốc mới**. Mốc khớp thật nên server chấp nhận, và thay đổi của người kia bị xoá.

Khớp với quan sát: owner lưu A=10 trước; editor nhận gói đó giữa lúc debounce rồi gửi bản (A=0, B=10) với mốc mới. Chốt nguyên tử phía server không cứu được ca này vì không có va chạm mốc nào.

Tôi tái hiện ca này qua IdeaMap thật bằng kịch bản smoke mới `concurrent-nudge`: trên code cũ nó **đỏ**, sau bản sửa nó **xanh**. Tôi **chưa** chạy lại ca này với hai tài khoản trên backend thật (cần đăng nhập hai tài khoản); nhờ reviewer lặp lại đúng thao tác ở vòng trước.

### Từng phát hiện

| Phát hiện | Kết luận | Đã sửa (nhánh · commit) | Kiểm chứng |
|---|---|---|---|
| P1 #5 · kiểm mốc rồi ghi ở hai lệnh | **Đúng.** | `refactor/1.4-split-board-payload` · `f45cec9`. PUT ghi bằng `findOneAndUpdate({ _id, updatedAt: <mốc đã đọc> })`: điều kiện phiên bản nằm ngay trong lệnh cập nhật. Không khớp thì trả 409 kèm board mới (hoặc 404 nếu board đã bị xoá). Mốc mới lấy từ `nextUpdatedAt()`, luôn lớn hơn mốc cũ, kể cả hai lần ghi trong cùng một mili-giây. PUT không khai mốc (nhập JSON, đường dự phòng ghi đè của client) vẫn ghi vô điều kiện như trước. | Test với model giả có trạng thái, cả hai request cùng đọc thấy một phiên bản: đúng một 200, một 409 mang board của bên thắng, một lần ghi, một lần broadcast. Thêm test mốc luôn tăng và test PUT không mốc. |
| P1 #7 · ánh xạ ID qua các bản chờ | **Đúng.** | `refactor/2.9-cleanup` · `601545e`. Mỗi bản chờ giờ đi kèm **bản nền của chính nó**. Sau 409, bản chờ được đắp lại `nền → bản chờ` thẳng lên bản server (không còn đắp `A → B` lên bản đã ghép), nên `rebaseBoard` cấp cho nó cùng id mới và viết lại tham chiếu. `rebaseBoardDetailed` trả thêm bản đồ đổi id; store dùng nó để dời `editingId` và vùng chọn sang id mới, và không chép "thẻ đang gõ dở" đè lên id cũ khi thẻ đó vừa bị đổi id. | Test đúng kịch bản review với `rebaseBoard` thật: thẻ remote số 1 nguyên vẹn, thẻ local mang tên B dưới id mới, không nhân đôi. Test `remapId`/`remapIdSet`. |
| P1 #7 · rút B khỏi hàng đợi huỷ timer của C | **Đúng.** Bản sửa vòng 1 của tôi chỉ chặn vòng retry, bỏ sót đường `settleSave`. | Cùng commit `601545e`. Tách hai việc: `saveNow()` công khai (thao tác mới của người dùng) mới huỷ timer; rút bản chờ ra gửi (`start`) thì không. | Test A đang gửi + B chờ + C debounce, cho **cả hai** trường hợp review yêu cầu (lưu thành công ngay, và có 409): timer của C còn, PUT cuối mang C, thẻ remote vẫn còn. |
| P2 #5 · restore snapshot cũ giữ bộ đếm 9 | **Đúng.** | `refactor/1.4-split-board-payload` · `f45cec9`. Restore chuẩn hoá `nextStatusId` bằng `safeNextStatusId` **trước khi ghi**, và cũng dùng `nextUpdatedAt()`. | Test snapshot cũ (9 trạng thái, bộ đếm 9) qua route restore: bản ghi, gói broadcast và phản hồi đều là 10; id trạng thái và `statusId` trên thẻ giữ nguyên. |
| (mới) #7 · `board:update` về trong lúc debounce | Tôi tự tìm ra khi truy ca end-to-end. | Cùng commit `601545e`. Hàng đợi có `rebaseQueued(server)`; store gọi nó khi áp `board:update`, trước khi dời nền. Bản chờ được đắp lại lên bản vừa nhận, và màn hình hiện bản đó (cú nhích chưa lưu không biến mất). Thêm chốt: phản hồi của một PUT cũ về sau một `board:update` mới hơn không được lùi mốc/bản nền. | Test đơn vị + kịch bản smoke `concurrent-nudge` (đỏ trên code cũ). |

### Thay đổi kèm theo, ngoài yêu cầu

- `discardQueued()`: khi khôi phục snapshot, các bản đang chờ lưu bị bỏ. Chúng dựng trên board cũ; nếu gửi sau restore sẽ đè mất bản vừa khôi phục.
- README và AGENTS.md thêm kịch bản `concurrent-nudge` vào danh sách.

### Giới hạn còn lại, xin reviewer soi

- **Hai người sửa cùng một phần tử:** bản chờ được đắp lại theo kiểu "ai đổi thì người đó thắng" trên từng phần tử (luật sẵn có của `rebaseBoard`). Nếu cả hai cùng dời đúng một thẻ thì người lưu sau thắng trên thẻ đó. Đây là luật cũ, tôi không đổi.
- **Thao tác đang kéo chuột dở** không nằm trong hàng đợi. Các handler kéo đọc `boardRef` mới nhất ở mỗi nhịp, nên vẫn như trước.
- **Chưa kiểm với backend thật:** chốt nguyên tử chỉ được test với model giả mô phỏng ngữ nghĩa bộ lọc của MongoDB. Ca hai tài khoản trên trình duyệt cũng chưa chạy lại.

### Head và lệnh tái hiện

| PR | Head vòng trước | Head mới |
|---|---|---|
| #5 | `d347bec` | `f45cec9` |
| #7 | `6f92f20` | `601545e` |
| #9 | đầu `refactor/7.2-docs` lúc đó | đầu `refactor/7.2-docs` hiện tại: merge hai bản sửa trên qua `refactor/integration-trial`, cộng cập nhật README/AGENTS và file này |
| #4, #6, #8 | không đổi | không đổi |

```bash
# #5 — PUT đồng thời, mốc tăng, restore snapshot cũ
cd server && node --test board-fields.test.js

# #7 — hàng đợi lưu (17 test) và rebase
cd client && node --test src/lib/save-queue.test.js src/lib/rebase.test.js

# #7 — ca end-to-end qua IdeaMap thật (jsdom, API và socket giả)
cd client && npx vite build -c smoke.vite.config.js && SMOKE_ONLY=concurrent-nudge node smoke-run.mjs

# Toàn bộ, trên refactor/7.2-docs
npm run verify
```

**Kết quả sau khi sửa:** trên `refactor/7.2-docs`, `npm run verify` pass: lint 0 lỗi / 36 cảnh báo, client 807 test, build, 6 kịch bản smoke, server 217 test. Nhánh #7 riêng: client 778 test, build, smoke pass. Nhánh #5 riêng: `npm run verify` pass, server 216 test.
