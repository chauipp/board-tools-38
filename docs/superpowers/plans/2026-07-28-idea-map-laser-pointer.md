# Plan — Bút laser

Spec: [`docs/superpowers/specs/2026-07-28-idea-map-laser-pointer-design.md`](../specs/2026-07-28-idea-map-laser-pointer-design.md)

Nhánh: `idea-map-laser-pointer` (từ `idea-map-hud-islands`)

---

- [x] Task 1: Lõi thuần — `lib/laser.js`
  - [x] Step 1: Hằng số `LASER_FADE_MS` / `LASER_MAX_POINTS` / `LASER_MIN_DIST` / `LASER_HEAD_PX`
  - [x] Step 2: `pushLaserPoint(pts, x, y, now)` — chối điểm quá gần, trả về CHÍNH mảng cũ khi chối, cắt đầu khi vượt trần
  - [x] Step 3: `trimLaserTrail(pts, now)` — rụng điểm hết hạn khỏi đầu mảng, trả về chính mảng cũ khi không có gì rụng
  - [x] Step 4: `laserOutline(pts, headW)` — viền ngoài hình kín, thon từ 0 ở đuôi tới `headW` ở đầu
  - [x] Step 5: `lib/laser.test.js` — 12 test, gồm hợp đồng "trả chính mảng cũ" và điểm trùng nhau không sinh `NaN`

- [x] Task 2: Kho vệt + phía phát — `lib/useLaser.js`
  - [x] Step 1: `createLaserStore()` — Map khoá→điểm, đăng ký nghe, `add`/`sweep`/`drop`. Không phải state React
  - [x] Step 2: `useLaser(socket)` — gom điểm qua `trailingThrottle` 40ms, phát `live:laser`, chỉ phát điểm đã vào vệt

- [x] Task 3: Lớp vẽ — `components/LaserLayer.jsx`
  - [x] Step 1: Nhận `live:laser` của người khác, đóng dấu thời gian bằng đồng hồ mình
  - [x] Step 2: Bỏ vệt khi nhận `presence:leave`
  - [x] Step 3: Vòng lặp rAF chỉ sống khi còn vệt
  - [x] Step 4: Vẽ quầng sáng + lõi + chấm đầu, màu đặt một lần trên `<g>`, bề rộng chia cho `scale`

- [x] Task 4: Server — kênh `live:laser`
  - [x] Step 1: Sanitize `pts` (mảng số chẵn, trần 120 số, biên độ dùng chung `MAX_LIVE_INK_COORD`)
  - [x] Step 2: `.volatile`, KHÔNG chặn viewer, `socketId` do server đính

- [x] Task 5: Nối vào UI
  - [x] Step 1: `IconLaser` + nút ở khu 1 của `ToolRail`, không có `disabled={!canEdit}`
  - [x] Step 2: mode `"laser"` + lớp `.laser-capture` (nhường đường lia bảng như `.ink-capture`)
  - [x] Step 3: Phím `K` bật/tắt, kể cả khi đang trình chiếu; `Esc` về mode Chuột
  - [x] Step 4: `<LaserLayer>` trong `.canvas`, sau `InkLayer`
  - [x] Step 5: CSS `.laser-capture` / `.laser-layer` / `.laser-halo` / `.laser-core` / `.laser-head`

- [x] Task 6: i18n
  - [x] Step 1: `npm run i18n:extract` → 236 chuỗi
  - [x] Step 2: Dịch EN chuỗi mới ("Laser pointer — for presenting (K)")

- [x] Task 7: Smoke test
  - [x] Step 1: Đổi cả file `entry.jsx` từ tra nút theo CHỈ SỐ sang tra theo TÊN (`railBtn`)
  - [x] Step 2: Cập nhật hai phép đếm nút (6→7 ở mode Chuột, 10→11 ở mode Sửa)
  - [x] Step 3: Chặng laser — bật, di chuột ra vệt, phát gói, vệt người khác khác màu, tự tan hết, không ghi gì vào board, bấm lại là tắt

---

## Kiểm tự động

- `npm test` — 303/303 (291 cũ + 12 laser)
- `npm run test:smoke` — xanh, thêm một chặng
- `npm run build` — sạch
- `npm run i18n:extract` — 236/236, EN không thiếu chuỗi
- `node --test auth.test.js` (server) — 11/11

## Kiểm bằng mắt (phiên này không có công cụ điều khiển trình duyệt)

jsdom không tính layout và không vẽ gì, nên những thứ dưới đây chưa ai nhìn thấy:

- [ ] Vệt trông có ra laser không: độ thon, quầng sáng, chấm đầu ở đúng con trỏ
- [ ] Nhịp tan 900ms — nhanh quá hay chậm quá khi nói thật
- [ ] Zoom 25% và 400%: vệt có giữ nguyên bề rộng trên màn hình không
- [ ] Hai người cùng chỉ: hai màu có phân biệt được trên cả nền sáng lẫn nền tối
- [ ] Chỉ trỏ trong lúc đang TRÌNH CHIẾU (thanh công cụ vẫn hiện ở mode đó)
- [ ] Vệt có nằm trên nét vẽ và trên thẻ không (z-index 8 trong `.canvas`)
- [ ] Mạng thật: vệt bên kia có mượt không ở nhịp 40ms, hay giật thành từng khúc
- [ ] Viewer (người chỉ xem) bật được laser và người khác thấy được vệt của họ

## Kết quả

[`docs/superpowers/summaries/2026-07-28-idea-map-laser-pointer-summary.md`](../summaries/2026-07-28-idea-map-laser-pointer-summary.md)
