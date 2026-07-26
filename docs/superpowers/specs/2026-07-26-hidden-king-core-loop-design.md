# Hidden King — Core Loop Prototype (Design)

Date: 2026-07-26

## Nguồn gốc

Ý tưởng gốc nằm trong board "Board của Châu" (game-tools, MongoDB
`boards` collection, `_id: 6a64f31f334f713d05566ca4`) — một game 1v1
real-time nơi mỗi bên giấu một "vua" và phải tìm giết vua đối phương để
thắng, có kinh tế mua quân (tank/sp/xạ thủ), địa hình (đồi/đầm
lầy/bụi/sông), skill soi vua, và điều khiển kiểu RTS.

Đánh giá khả thi trước đó (không lưu thành file, chỉ trong hội thoại) chỉ
ra bản đầy đủ này vượt quá tiêu chí "team 2 người mới" mà chính user đặt
ra trong `y-tuong-game-team-2-nguoi.md` (không multiplayer online, không
AI phức tạp, một cơ chế đào sâu). Quyết định: tách bản đầy đủ thành nhiều
sub-project, bắt đầu bằng một prototype tối giản kiểm chứng core loop
"giấu vua — tìm vua" có vui không.

## Mục tiêu bản này

Trả lời một câu hỏi duy nhất: **cơ chế giấu-vua/tìm-vua, chơi real-time
giữa 2 người thật ở xa nhau, có vui không?** Không đo lường gì khác (cân
bằng kinh tế, đa dạng quân, v.v.) ở giai đoạn này.

## Ràng buộc

- 2 người chơi ở 2 máy khác nhau, địa điểm khác nhau → bắt buộc phải có
  networking thật ngay từ bản đầu, không né được bằng test local.
- Team 2 người, chưa có kinh nghiệm Unity multiplayer trước đó.
- Ưu tiên tận dụng giải pháp có sẵn (Unity Netcode + Relay) thay vì tự
  dựng hạ tầng network riêng.

## Kiến trúc / Setup

- **Engine:** Unity 6 LTS (bản LTS mới nhất qua Unity Hub).
- **Repo:** cùng repo với `game-lab` (không tách repo riêng), project nằm
  ở `hidden-king/` — theo đúng pattern `game-tools/` đã có trong repo
  này. Folder `.gitignore` + `README.md` đã tạo sẵn tại `hidden-king/`;
  Unity project (Assets/, ProjectSettings/, Packages/) sẽ được Unity Hub
  tạo trực tiếp vào folder này.
- **Template:** Universal 3D (URP) — vì hình ảnh là 2.5D (sprite 2D đặt
  trong scene 3D, camera góc nghiêng cố định kiểu Clash Royale/Hades), cần
  hệ thống camera/lighting 3D chứ không phải template 2D thuần. URP là
  pipeline mặc định hiện tại của Unity Hub (template "3D (Built-In Render
  Pipeline)" cũ đã bị đánh dấu deprecated).
- **Packages:** Netcode for GameObjects (kéo theo Unity Transport), gói
  Multiplayer (`com.unity.services.multiplayer`, cho Relay + join code).

## Core loop MVP

- 1 map tĩnh, vẽ tay: vài bụi cỏ làm chỗ ẩn nấp, biên map cố định. Không
  đồi/đầm lầy/sông ở bản này (chưa có luật cơ học nào được định nghĩa cho
  chúng trong board gốc).
- Mỗi người chơi điều khiển đúng **1 quân: Vua**. Không có tank/sp/xạ thủ,
  không kinh tế mua quân — để dành cho bản sau nếu core loop test vui.
- **Fog of war:** bán kính nhìn cố định quanh vua của bạn. Đứng trong bụi
  cỏ → đối phương chỉ thấy được khi đứng đủ gần (bán kính phát hiện nhỏ
  hơn bán kính nhìn thường).
- **Combat tối giản:** đối phương vào tầm + bấm tấn công → hạ trong 1-2
  nhát. Không hệ thống HP nhiều tầng, không skill, không item.
- **Thắng/thua:** giết được vua đối phương = thắng. Giới hạn thời gian
  trận (3–5 phút, số chính xác chốt khi playtest) — hết giờ xử thua/hoà,
  để tránh trận kéo dài vô thời hạn do một bên trốn kỹ.

## Networking flow

1. Player A tạo phòng qua Unity Relay → nhận join code.
2. Player A gửi join code cho Player B qua kênh ngoài game (chat/Zalo).
3. Player B nhập code để join qua Relay.
4. Một trong hai client đóng vai **host** (Netcode host model) — host xử
   lý toàn bộ logic tầm nhìn/va chạm, chỉ gửi state đã lọc theo tầm nhìn
   cho client kia. Client không host không bao giờ nhận vị trí quân địch
   khi ngoài tầm nhìn — tránh việc đọc gói tin lộ vị trí vua ẩn.

## Ngoài phạm vi bản này

Kinh tế mua quân, đa dạng loại quân (tank/sp/xạ thủ), skill riêng theo
lớp (soi vua, dịch chuyển, tăng tầm...), địa hình có luật cơ học riêng,
đào hầm, item/thuyền, matchmaking tự động, UI hoàn chỉnh. Quay lại sau
khi core loop được xác nhận vui qua playtest thật.

## Testing

Cảm giác chơi (fun) chỉ đánh giá được qua playtest thật giữa 2 người,
không assert được. Nhưng logic "ai thấy ai" (khoảng cách tới vua đối
phương + trạng thái đang đứng trong bụi hay không) là logic dễ sai
off-by-one và ảnh hưởng trực tiếp tới việc vua có bị lộ oan — nên có 1
EditMode test nhỏ cho hàm tính tầm nhìn này với vài case toạ độ/trạng
thái bụi cụ thể.
