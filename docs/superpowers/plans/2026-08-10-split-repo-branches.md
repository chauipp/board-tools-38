# Tách repo thành nhánh board-tools và hidden-king Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách repo `my-g` (đang gộp game-tools/ và hidden-king/ trên `main`) thành 2 nhánh local độc lập — `board-tools` (game-tools/ đổi tên, kèm lịch sử liên quan) và `hidden-king` (lấy từ `hidden-king-relay-slice`, kèm lịch sử liên quan) — không đụng `main`, không push origin.

**Architecture:** Dùng `git filter-repo` trên các bản clone tạm (KHÔNG chạy trực tiếp trên repo gốc), lọc theo `--path` để giữ đúng lịch sử của từng phần (không commit nào chạm cả `game-tools/` và `hidden-king/` cùng lúc, nên lọc path là đủ, không cần cherry-pick tay). Sau đó fetch nhánh đã lọc từ clone tạm về repo chính thành nhánh local mới.

**Tech Stack:** git, git-filter-repo (đã có ở `~/.local/bin/git-filter-repo`), node/npm (test + build kiểm chứng nhánh board-tools).

## Global Constraints

- Không sửa, không sed, không cat nội dung `game-tools/server/.env` (chứa secret thật: Mongo Atlas URI, session secret) — chỉ được đọc bằng `git checkout -- ` để khôi phục nếu lỡ đụng, không bao giờ ghi đè.
- `game-tools/server/.env` và `.env.example` có `MONGODB_URI=.../game-tools?...` và `R2_BUCKET=game-tools-pdf` — đây là **tên database Mongo thật** và **tên bucket R2 thật** đang chạy production, KHÔNG phải chuỗi cosmetic. Tuyệt đối không đổi "game-tools" thành "board-tools" trong 2 file này — đổi là app sẽ trỏ nhầm sang database/bucket không tồn tại.
- Không đổi chuỗi "game-tools" trong `docs/superpowers/{specs,plans,summaries}/` — đó là hồ sơ lịch sử các task cũ, giữ nguyên tên đúng như lúc đó.
- Không push bất kỳ nhánh nào lên origin trong plan này.
- Không đổi gì trên `main` trong plan này (dọn rỗng `main` là việc khác, làm sau khi người dùng xác nhận ổn).
- Không đụng nhánh `hidden-king-relay-slice` (local hay origin) — nhánh `hidden-king` mới là **bản lọc riêng**, không thay thế hay xoá nhánh cũ.
- Mọi lệnh chạy trong đường dẫn có khoảng trắng (`/home/chaupt/Documents/untitled folder/my-g`) — luôn quote path.

---

### Task 1: Tạo nhánh `board-tools` từ `main` bằng git filter-repo

**Files:**
- Không sửa file trong repo chính ở task này — chỉ tạo clone tạm và fetch một ref mới (`board-tools`) về repo chính. Repo chính: `/home/chaupt/Documents/untitled folder/my-g`.

**Interfaces:**
- Produces: nhánh local `board-tools` trong repo chính, chứa lịch sử đã lọc + `game-tools/` đã đổi tên thành `board-tools/`. Task 2 sẽ checkout nhánh này để sửa tiếp.

- [ ] **Step 1: Tạo clone tạm chỉ chứa nhánh `main`**

```bash
TMP_BOARD=$(mktemp -d)
git clone --no-hardlinks --no-local --single-branch --branch main \
  "/home/chaupt/Documents/untitled folder/my-g" "$TMP_BOARD"
cd "$TMP_BOARD"
git log --oneline | wc -l
```

Expected: in ra `336` (đúng số commit hiện tại của `main`).

- [ ] **Step 2: Lọc lịch sử — chỉ giữ path liên quan game-tools, đổi tên thành board-tools**

```bash
cd "$TMP_BOARD"
git filter-repo --force \
  --path game-tools/ \
  --path render.yaml \
  --path .gitignore \
  --path improve.md \
  --path AGENTS.md \
  --path docs/superpowers/ \
  --path docs/research/ \
  --path .superpowers/ \
  --path-rename game-tools/:board-tools/
```

Expected: chạy xong không lỗi, in ra thống kê số commit đã xử lý.

- [ ] **Step 3: Xác nhận kết quả lọc đúng**

```bash
cd "$TMP_BOARD"
ls
# Kỳ vọng: board-tools, docs, render.yaml, .gitignore, improve.md, AGENTS.md, .superpowers
# KHÔNG có: hidden-king, game-tools
test -d board-tools/client && test -d board-tools/server && echo "OK: board-tools/client và board-tools/server tồn tại"
test ! -e game-tools && echo "OK: không còn folder game-tools"
test ! -e hidden-king && echo "OK: không có folder hidden-king"
git log --oneline | wc -l
```

Expected: cả 3 dòng "OK" đều in ra; số commit ít hơn 336 (chỉ còn các commit có chạm path đã giữ).

- [ ] **Step 4: Fetch nhánh đã lọc về repo chính**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git fetch "$TMP_BOARD" main:board-tools
git branch --list board-tools
```

Expected: `git branch --list board-tools` in ra `  board-tools` (nhánh local đã tồn tại).

- [ ] **Step 5: Dọn clone tạm**

```bash
rm -rf "$TMP_BOARD"
```

---

### Task 2: Sửa tham chiếu tên cũ trên nhánh `board-tools` và kiểm chứng

**Files:**
- Modify: `render.yaml` (rootDir, service name, comment đầu file)
- Modify: `AGENTS.md` (mọi đường dẫn `game-tools/...`)
- Modify: `board-tools/client/package.json` (field `name`)
- Modify: `board-tools/server/package.json` (field `name`)
- Modify: `board-tools/server/index.js` (3 comment trỏ đường dẫn cũ, dòng ~337, ~341, ~352)
- Modify: `board-tools/server/scripts/migrate-to-boards.mjs` (comment dòng 2)
- Modify: `board-tools/client/src/lib/erase.test.js`, `ink-live.test.js`, `stroke.test.js`, `image-budget.test.js`, `card-levels.test.js`, `board-geometry.test.js`, `pen.test.js`, `place-node.test.js`, `shape.test.js`, `popover.test.js` (comment dòng 1 mỗi file — tự trỏ đường dẫn file)
- Modify: `board-tools/client/src/__smoke__/entry.jsx` (comment dòng ~642)
- Delete + regenerate: `board-tools/client/package-lock.json`, `board-tools/server/package-lock.json`

**Interfaces:**
- Consumes: nhánh `board-tools` từ Task 1.
- Produces: nhánh `board-tools` đã sửa xong, test + build xanh — sẵn sàng để người dùng xem.

- [ ] **Step 1: Checkout nhánh board-tools trong repo chính**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git checkout board-tools
ls
# Kỳ vọng: thấy board-tools/, KHÔNG thấy game-tools/, KHÔNG thấy hidden-king/
```

- [ ] **Step 2: Sửa render.yaml**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
sed -i \
  -e 's#lives in game-tools/#lives in board-tools/#' \
  -e 's#relative to game-tools/#relative to board-tools/#' \
  -e 's#name: game-tools#name: board-tools#' \
  -e 's#rootDir: game-tools#rootDir: board-tools#' \
  render.yaml
grep -n "board-tools\|game-tools" render.yaml
```

Expected: chỉ còn `board-tools`, không còn dòng nào chứa `game-tools`.

- [ ] **Step 3: Sửa AGENTS.md**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
sed -i 's/game-tools/board-tools/g' AGENTS.md
grep -n "game-tools" AGENTS.md
```

Expected: `grep` không in ra gì (không còn match).

- [ ] **Step 4: Sửa package.json name + comment trong code (KHÔNG đụng .env/.env.example)**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
sed -i 's/"game-tools-client"/"board-tools-client"/' board-tools/client/package.json
sed -i 's/"game-tools-server"/"board-tools-server"/' board-tools/server/package.json
sed -i 's/game-tools\/client/board-tools\/client/g' board-tools/server/index.js
sed -i 's/game-tools\/server/board-tools\/server/g' board-tools/server/scripts/migrate-to-boards.mjs
for f in erase ink-live stroke image-budget card-levels board-geometry pen place-node shape popover; do
  sed -i "1s#game-tools/client#board-tools/client#" "board-tools/client/src/lib/${f}.test.js"
done
sed -i 's/game-tools\/client/board-tools\/client/g' board-tools/client/src/__smoke__/entry.jsx

# Xác nhận KHÔNG còn "game-tools" ngoài .env/.env.example (2 file này giữ nguyên, có ý)
grep -rl "game-tools" board-tools --exclude-dir=node_modules | grep -v -e '\.env$' -e '\.env\.example$'
```

Expected: lệnh `grep -rl` cuối in ra rỗng (không còn file nào khác chứa "game-tools" ngoài `.env`/`.env.example`).

- [ ] **Step 5: Regenerate package-lock.json cho khớp tên mới**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g/board-tools/client" && rm -f package-lock.json && npm install
cd "/home/chaupt/Documents/untitled folder/my-g/board-tools/server" && rm -f package-lock.json && npm install
```

Expected: cả 2 lệnh `npm install` chạy xong không lỗi, tạo `package-lock.json` mới.

- [ ] **Step 6: Chạy test + build để xác nhận không có gì hỏng do rename**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g/board-tools/client" && npm test && npm run build
cd "/home/chaupt/Documents/untitled folder/my-g/board-tools/server" && npm test
```

Expected: test client pass hết (đối chiếu ~621 test như trước khi tách), build client thành công, test server pass hết (đối chiếu ~101 test).

- [ ] **Step 7: Commit các sửa đổi**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add render.yaml AGENTS.md board-tools/
git status
git commit -m "chore: đổi tên game-tools sang board-tools trong render.yaml, AGENTS.md, package.json và comment code (không đụng .env)"
```

Expected: commit thành công trên nhánh `board-tools`; `git status` trước đó không có `.env`/`.env.example` nằm trong danh sách staged (vì nội dung chúng không đổi).

---

### Task 3: Tạo nhánh `hidden-king` từ `hidden-king-relay-slice` bằng git filter-repo

**Files:**
- Không sửa file trong repo chính ở task này — chỉ tạo clone tạm và fetch một ref mới (`hidden-king`) về repo chính.

**Interfaces:**
- Produces: nhánh local `hidden-king` trong repo chính, chứa lịch sử đã lọc của `hidden-king/` (lấy từ `hidden-king-relay-slice`, đầy đủ code Unity thật, không chỉ scaffold).

- [ ] **Step 1: Tạo clone tạm chỉ chứa nhánh `hidden-king-relay-slice`**

```bash
TMP_HK=$(mktemp -d)
git clone --no-hardlinks --no-local --single-branch --branch hidden-king-relay-slice \
  "/home/chaupt/Documents/untitled folder/my-g" "$TMP_HK"
cd "$TMP_HK"
git log --oneline | wc -l
```

Expected: in ra số commit của `hidden-king-relay-slice` tính từ gốc repo (nhiều hơn 336 do có 2 commit riêng cộng thêm, hoặc bằng tuỳ thời điểm — không cần khớp số cụ thể, chỉ cần chạy được).

- [ ] **Step 2: Lọc lịch sử — chỉ giữ path liên quan hidden-king**

```bash
cd "$TMP_HK"
git filter-repo --force \
  --path hidden-king/ \
  --path docs/hidden-king-game-concept.md
```

Expected: chạy xong không lỗi.

- [ ] **Step 3: Xác nhận kết quả lọc đúng — phải có code Unity thật, không chỉ scaffold**

```bash
cd "$TMP_HK"
ls
# Kỳ vọng: hidden-king, docs
# KHÔNG có: game-tools, board-tools, render.yaml, AGENTS.md
test -f hidden-king/Assets/Scripts/Net/MatchConnection.cs && echo "OK: có code Relay networking thật"
test -f hidden-king/Assets/Scripts/Gameplay/KingController.cs && echo "OK: có KingController"
test -f docs/hidden-king-game-concept.md && echo "OK: có game-concept.md"
test ! -e game-tools && test ! -e board-tools && echo "OK: không lẫn code game-tools"
git log --oneline | wc -l
```

Expected: cả 4 dòng "OK" đều in ra.

- [ ] **Step 4: Fetch nhánh đã lọc về repo chính**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git fetch "$TMP_HK" hidden-king-relay-slice:hidden-king
git branch --list hidden-king
```

Expected: `git branch --list hidden-king` in ra `  hidden-king`.

- [ ] **Step 5: Dọn clone tạm**

```bash
rm -rf "$TMP_HK"
```

---

### Task 4: Xác nhận cuối — main và các nhánh cũ không bị đụng, không có gì bị push

**Files:**
- Không sửa file nào — chỉ kiểm tra trạng thái git.

**Interfaces:**
- Consumes: nhánh `board-tools` (Task 2) và `hidden-king` (Task 3) đã tồn tại local.
- Produces: xác nhận cuối để báo cáo cho người dùng.

- [ ] **Step 1: Quay lại main, xác nhận main không đổi**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git checkout main
git status
git log --oneline -1
```

Expected: `git status` sạch (ngoài các untracked file đã có từ trước như `.codex/`, `AGENTS.md` nếu chưa track — không liên quan task này); `git log -1` vẫn là commit spec đã tạo trước đó, không có gì mới từ 2 nhánh kia lẫn vào.

- [ ] **Step 2: Xác nhận 2 nhánh mới tồn tại local, chưa lên origin**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git branch -vv | grep -E "board-tools|hidden-king"
git ls-remote --heads origin | grep -E "board-tools|hidden-king" || echo "OK: chưa có nhánh nào trong số này trên origin"
```

Expected: `git branch -vv` in ra `board-tools` và `hidden-king` (không có `[origin/...]` phía sau — nghĩa là chưa track remote nào); dòng `ls-remote` in ra `OK: chưa có...` (vì `hidden-king` là tên mới, `board-tools` cũng là tên mới — `hidden-king-relay-slice` cũ trên origin không bị ảnh hưởng, vẫn còn nguyên).

- [ ] **Step 3: Xác nhận hidden-king-relay-slice cũ vẫn còn nguyên, không bị xoá/đổi**

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git log --oneline hidden-king-relay-slice -1
git log --oneline origin/hidden-king-relay-slice -1
```

Expected: cả 2 lệnh in ra đúng commit `3a6b8d2 feat(hidden-king): 2 máy vào cùng trận qua Relay và thấy nhau di chuyển` — không đổi.

- [ ] **Step 4: Viết summary**

Viết file `docs/superpowers/summaries/2026-08-10-split-repo-branches-summary.md` theo 4 mục (Đã làm gì / File chính / Khác với plan / Còn dở-cần lưu ý) dựa trên diff và commit thật đã tạo ở Task 1-3, rồi commit file này vào `main`.

```bash
cd "/home/chaupt/Documents/untitled folder/my-g"
git add docs/superpowers/summaries/2026-08-10-split-repo-branches-summary.md
git commit -m "docs: summary tách repo thành nhánh board-tools và hidden-king"
```

## Kết quả

Xem `../summaries/2026-08-10-split-repo-branches-summary.md` (viết ở Task 4, Step 4).
