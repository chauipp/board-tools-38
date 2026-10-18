# Summary — Thanh công cụ bên trái & vẽ tay bằng bút

Ngày hoàn tất: 2026-07-27
Nhánh: `idea-map-left-toolbar-ink` (12 commit, base `23163c0`)

- Spec: [`docs/superpowers/specs/2026-07-27-idea-map-left-toolbar-ink-design.md`](../specs/2026-07-27-idea-map-left-toolbar-ink-design.md)
- Plan: [`docs/superpowers/plans/2026-07-27-idea-map-left-toolbar-ink.md`](../plans/2026-07-27-idea-map-left-toolbar-ink.md)

---

### Đã làm gì

- Trang `/idea-map/:boardId` có thanh công cụ dọc nổi ở lề trái, chia bốn khu: chọn mode (Chuột / Sửa), chọn dụng cụ vẽ (Bút / Cục gôm, chỉ hiện ở mode Sửa), năm nút thêm (thẻ, thẻ gốc, khung, nối dây, nhập nhanh), và tuỳ chọn bút (7 màu + 3 độ dày, chỉ hiện khi đang cầm bút). Menu THÊM và nút NỐI Ý TƯỞNG đã rời khỏi topbar — mỗi việc còn đúng một chỗ bấm.
- Vẽ tay bằng bút chạy thật: kéo chuột ở mode Sửa ra nét theo màu và độ dày đang chọn, nét lưu vào `board.drawings` đi theo đúng đường lưu sẵn có nên hoàn tác/làm lại (Ctrl+Z) hoạt động không cần code riêng. Kéo ngang qua thẻ vẫn ra nét; chuột phải và Space+trái vẫn lia bảng.
- Cục gôm quét qua nhiều nét: nét bị chạm mờ dần trong lúc quét rồi mất khi thả chuột. Một lần quét xoá 5 nét thì một lần Ctrl+Z lấy lại cả 5. Quét chỗ trống không tạo bước hoàn tác rỗng.
- Nét chạy theo thời gian thực qua kênh socket mới `live:ink`: người khác thấy nét đang được vẽ dần ra, không khuyết khúc; khi bản lưu chính thức về thì bản tạm bỏ ngay nên không nháy. Người chỉ xem thấy nét của người khác nhưng không vẽ được (server chặn ngay tại socket).
- Màu bút và độ dày nhớ qua `localStorage`; mode thì không nhớ (mở board ra luôn ở Chuột). Bảy màu bút có bộ giá trị riêng cho theme sáng và tối.
- Phím tắt: `v` (Chuột), `b` (Bút), `e` (Gôm), `l` (nối dây), `Shift+N` (thẻ gốc), `Esc` (thoát mode Sửa trước khi làm việc khác).

### File chính

**Module thuần (test bằng `node:test`)**
- `game-tools/client/src/lib/pen.js` — bộ màu bút, độ dày, đọc/ghi prefs localStorage chịu được JSON hỏng và storage ném lỗi.
- `game-tools/client/src/lib/stroke.js` — giản lược nét (làm tròn → lọc điểm gần → Ramer–Douglas–Peucker), sinh chuỗi `d` cho `<path>`, hit-test cục gôm đo tới đoạn thẳng chứ không tới đỉnh.
- `game-tools/client/src/lib/ink-live.js` — trộn gói `live:ink` vào một Map overlay (TTL hai mức) và đối chiếu overlay với board thật; trả chính map cũ khi không có gì đổi để React bỏ qua render.

**Hook và component**
- `game-tools/client/src/lib/useInk.js` — bắt chuột vẽ/gôm; điểm thô nằm trong ref chứ không trong state, đẩy vào state qua rafThrottle; tự huỷ nét khi cửa sổ mất focus.
- `game-tools/client/src/lib/useInkLive.js` — phát và nhận `live:ink`; điểm cộng dồn vào ref rồi throttle chỉ quyết định *lúc nào* xả (throttle thay tham số nên không được throttle thẳng lời gọi, sẽ mất điểm).
- `game-tools/client/src/components/InkLayer.jsx` — một đường vẽ duy nhất cho cả ba nguồn nét: đã lưu, mình đang kéo, người khác đang vẽ.
- `game-tools/client/src/components/ToolRail.jsx`, `ToolOptions.jsx` — thanh công cụ và tuỳ chọn bút, icon là inline SVG theo `currentColor`.

**Nối dây và server**
- `game-tools/client/src/pages/IdeaMap.jsx` — state `mode`/`tool`/`penPrefs`, `commitStroke`/`commitErase`, lớp bắt chuột `.ink-capture`, phím tắt, gỡ hai mục khỏi topbar.
- `game-tools/server/models.js`, `boards.js`, `index.js` — hai field board mới, bốn chỗ liệt kê field, và handler `live:ink` có sanitize + chặn viewer + đính `socketId` phía server.
- `game-tools/client/src/index.css`, `src/styles/idea-map.css` — biến `--pen-*` ở cả bốn khối theme; class cho thanh công cụ, lớp vẽ, lớp bắt chuột.
- `game-tools/client/src/__smoke__/entry.jsx`, `smoke-run.mjs` — 13 nhóm kiểm ghép nối mới (thanh công cụ theo mode, vẽ ra nét và lưu đúng một lần, gôm, phát/nhận gói live, chống vòng vọng, không mất cập nhật của người khác giữa nét).

### Khác với plan

Ba chỗ lệch, tất cả đều là plan bỏ sót chứ không phải đổi thiết kế:

1. **`GET /api/boards/:id` cũng phải liệt kê field mới** (commit `2bee01d`). Plan nói field board được liệt kê tay ở *ba* chỗ trong `boards.js`; thực tế có *bốn* — allowlist của route GET là chỗ thứ tư. Thiếu nó thì tải lại trang xong lần lưu kế tiếp xoá sạch nét đã lưu, vì client mặc định `drawings: []` cho board "không có" field đó.
2. **`.zoom-ctrl` phải được nâng z-index** (commit `9c9bbe3`). Plan tính z-index của `.ink-capture` (8) sao cho nằm dưới thanh công cụ (30), nhưng `.zoom-ctrl` vốn không khai z-index nên bị lớp bắt chuột che — ở mode Sửa không bấm được nút zoom. Cho nó `z-index: 40` bằng với `.focus-banner` cạnh nó.
3. **`commitStroke`/`commitErase` phải đọc `boardRef.current`** (commit `3f51ea8`, cùng năm sửa nhỏ khác). Plan viết hai hàm này dùng biến `board` của closure. Nhưng `useInk` gắn `finish` làm listener `mouseup` trên `window` từ lúc mousedown, nên nếu `board:update` của người khác về *giữa lúc đang kéo nét*, lúc nhả chuột sẽ PUT bản board cũ kèm nét mới — âm thầm revert thay đổi vừa lưu của người kia. Sửa theo đúng kỷ luật refs-only mà `applyImageToNode` trong cùng file đã ghi chú sẵn cho tình huống này. Đã thêm một bài kiểm smoke bắn `board:update` vào giữa nét để chốt.

Ngoài ra: lời gọi `useInk(...)` phải đặt sau khi `boardRef`/`viewportRef` khai báo, không phải ngay sau `useCardSizes()` như plan chỉ — vị trí plan nêu gây `ReferenceError`.

### Còn dở / cần lưu ý

- **Chưa chạy danh sách kiểm tay của spec.** Mọi bước "Kiểm tay trên app đang chạy" trong Task 5/6/7/8 và mục **Kiểm thử** của spec đều bị hoãn: cần mở app thật, hai tab cùng board, kiểm nét chạy realtime không khuyết khúc, không nháy khi thả chuột, gôm hiện mờ rồi mất, đóng tab giữa nét thì nét tạm tự dọn, tài khoản chỉ xem không vẽ được, đổi sáng/tối, zoom. **`game-tools/server` không có bộ test nào** — mức kiểm tự động duy nhất cho phần server là `node --check`, nên toàn bộ hành vi relay (`sanitizeInk`, chặn viewer, truncate) hiện chỉ được phủ gián tiếp qua smoke test của client. Đây là lớp xác minh còn thiếu quan trọng nhất.
- `game-tools/client/vite.config.js` đang có thay đổi chưa commit (đổi cổng dev 5173→7155 và 3001→3345). Có từ trước phiên này, đã chủ ý không commit.
- Nợ nhỏ đã ghi nhận, không chặn merge: `rdp()` đệ quy không giới hạn độ sâu (cần phân bố điểm bệnh lý mới đụng); nhánh erase trong `ink-live.js` cấp phát Map mới cả khi gói trùng; `sanitizeInk` nhận id không nguyên (`Number.isFinite`) — giống khuôn `sanitizeGeom` sẵn có, nếu sửa thì sửa cả hai; smoke test chọn nút gôm theo chỉ số vị trí; smoke output có 4 cảnh báo React `act(...)` (base đã có 3, nhánh này thêm 1 — cùng loại, do timer/effect cập nhật state ngoài `act`).
- `IdeaMap` re-render mỗi gói ink nhận từ người khác (~25 lần/giây mỗi người đang vẽ) vì state `liveStrokes` nằm ở component này — cùng hạng với overlay `live:geom` sẵn có. Chỉ cần xem lại nếu thực tế thường có 3 người vẽ cùng lúc.
- Schema để `drawings: Array` không kiểu và `PUT` ghi thẳng những gì client gửi, tức server tin hoàn toàn client có quyền sửa. Đã ghi trong "Hạn chế đã biết" của spec; nên validate phía server một thể khi làm spec hình khối.
