# Tách repo thành 2 nhánh: board-tools và hidden-king

## Bối cảnh

Repo `my-g` hiện gộp 2 sản phẩm không liên quan trong một cây lịch sử:
- `game-tools/` — web app (React + Vite + Express + Socket.IO + MongoDB), bảng vẽ ý tưởng nhiều người dùng.
- `hidden-king/` — project Unity, game.

`main` có 336 commit: 242 chạm `game-tools/`, 2 chạm `hidden-king/` (chỉ scaffold init), còn lại 92 commit ở root (docs/superpowers, render.yaml, .gitignore, improve.md...) — không có commit nào chạm cả hai folder cùng lúc.

Nhánh `hidden-king-relay-slice` (đã push lên origin) rẽ từ commit `1784b42` và chứa code Unity thật (Relay networking, `KingController`, `MatchSpawner`, `MatchConnection`, test EditMode/PlayMode...) — nhiều hơn hẳn scaffold trên main.

## Mục tiêu

- Nhánh `board-tools`: chỉ chứa lịch sử + code của `game-tools/`, đổi tên folder thành `board-tools/`.
- Nhánh `hidden-king`: chỉ chứa lịch sử + code của `hidden-king/`, lấy từ `hidden-king-relay-slice` (đầy đủ code Unity đã làm, không chỉ scaffold).
- `main`: giữ nguyên cho tới khi cả 2 nhánh trên được xác nhận ổn — dọn rỗng `main` là bước cuối, làm riêng sau, không nằm trong lần này.
- Không push nhánh mới lên origin — chỉ tạo local.

## Phương án

Dùng `git filter-repo` chạy trên **bản clone tạm** (đĩa scratch, không đụng repo gốc `my-g`), sau đó fetch nhánh kết quả về repo thật làm nhánh local mới. Vì lịch sử đã tách bạch theo path (không commit nào chạm cả hai folder), lọc theo `--path` là đủ để có lịch sử đúng cho từng phần — không cần cherry-pick tay từng commit.

### Nhánh `board-tools`

- Nguồn: `main`.
- Giữ các path: `game-tools/`, `render.yaml`, `.gitignore`, `improve.md`, `AGENTS.md`, `docs/superpowers/`, `docs/research/`, `.superpowers/`.
- `--path-rename game-tools/:board-tools/`.
- Sau filter, sửa tiếp (path đã đổi tên nhưng nội dung file còn trỏ tên cũ):
  - `render.yaml`: `rootDir: board-tools`, `name: board-tools` (service), comment đầu file.
  - `AGENTS.md`: mọi đường dẫn `game-tools/...` → `board-tools/...`.
  - Comment trong `board-tools/server/index.js` và vài `*.test.js` trỏ `game-tools/client/src/lib/...` → `board-tools/client/src/lib/...`.
  - `package.json` name: `game-tools-client` → `board-tools-client`, `game-tools-server` → `board-tools-server`.
  - Chạy lại `npm install` ở `board-tools/client` và `board-tools/server` để `package-lock.json` khớp tên mới.

### Nhánh `hidden-king`

- Nguồn: `hidden-king-relay-slice` (không phải `main`).
- Giữ path: `hidden-king/`, `docs/hidden-king-game-concept.md`.
- Không rename — tên đã đúng.
- Không sửa nội dung file nào thêm (không có chuỗi tên cũ cần đổi).

## Kiểm chứng

- `board-tools`: `npm test` ở `client/` và `server/` (đối chiếu vẫn 621 + 101 test pass như trước khi tách), `npm run build` ở `client/`.
- `hidden-king`: không có test runner tự động trong repo cho Unity project (không phải UI web) → chỉ xác nhận cấu trúc file đầy đủ so với `hidden-king-relay-slice` (không áp dụng skill kiểm UI Playwright — không phải web).

## Ngoài phạm vi

- Dọn rỗng `main` — làm sau, khi người dùng xác nhận cả 2 nhánh ổn.
- Push nhánh mới lên origin — giữ local, người dùng tự push khi sẵn sàng.
- Xoá `hidden-king-relay-slice` khỏi origin/local — không đụng, giữ nguyên như cũ (nhánh `hidden-king` mới là bản sao đã lọc, không thay thế nó).

## Plan thực thi

Xem `../plans/2026-08-10-split-repo-branches.md`.
