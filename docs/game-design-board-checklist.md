# Checklist Game Design Board

Theo dõi phạm vi và tiến độ phát triển board Game Design. Các mục `[x]` là đã có; các mục `[ ]` là chưa làm.

## Lộ trình triển khai

### Phase 0 — Nền tảng board

- [x] Hoàn thiện hai loại board và dữ liệu `idea` / `game-design`
- [x] Hoàn thiện canvas, realtime, lưu trữ và dock chỉnh sửa bên phải
- [x] Hoàn thiện tìm kiếm, lọc, tag, status, chọn nhiều, undo/redo
- [ ] Phân quyền theo project/team
- [ ] Lịch sử thay đổi và version snapshot

**Hoàn thành phase khi:** board ổn định, dữ liệu không mất, nhiều người cùng sửa được và có thể khôi phục phiên bản.

### Phase 1 — Core Game Design authoring

- [x] Bộ template Game Pillar, Core Loop, Mechanic, Character, Skill, Quest, UI/UX, Playtest
- [x] Panel spec và preview trên card
- [x] Các field nền tảng: goal, rules, input, output, edge cases, dependencies, owner, priority
- [x] Genre, target audience, player fantasy và player journey
- [ ] Player loop cấp nhỏ/cấp lớn và progression map
- [x] Failure states, examples và tuning parameters

**Hoàn thành phase khi:** GD có thể viết một feature spec hoàn chỉnh mà không cần tài liệu ngoài board.

### Phase 2 — Relationships và workflow

- [x] Loại quan hệ `depends on`, `unlocks`, `replaces`, `conflicts with`
- [ ] Dependency graph và cảnh báo vòng lặp
- [x] Workflow Draft → Review → Ready for dev → In dev → Testing → Done
- [ ] Reviewer, ngày review, comment yêu cầu chỉnh sửa
- [x] Definition of Done checklist
- [ ] Roadmap, milestone, deadline, assignee và blocker

**Hoàn thành phase khi:** team biết card liên quan với nhau ra sao, ai đang xử lý và điều kiện nào để hoàn tất.

### Phase 3 — Playtest và decision loop

- [x] Playtest card cơ bản
- [x] Test objective, hypothesis, build/version và nhóm người chơi
- [x] Observations, metrics, feedback và problems found
- [x] Decision log: lý do, phương án, evidence, người quyết định, ngày quyết định
- [x] Liên kết playtest/decision với mechanic/level/skill qua card reference
- [ ] Follow-up task riêng
- [ ] So sánh nhiều session và xem lịch sử theo version

**Hoàn thành phase khi:** mỗi thay đổi thiết kế đều truy được từ feedback/evidence đến quyết định cuối cùng.

### Phase 4 — Balance và progression

- [x] Balance sheet riêng
- [x] Chỉ số tùy biến cho damage, HP, armor, cooldown, duration, cost, reward
- [ ] XP, level progression, drop rate và currency flow template
- [x] Công thức có biến đầu vào và tính toán tự động
- [ ] So sánh trước/sau và cảnh báo giá trị bất thường
- [ ] Liên kết balance sheet với card

**Hoàn thành phase khi:** GD có thể tune hệ thống bằng dữ liệu và nhìn thấy tác động của thay đổi.

### Phase 5 — Handoff cho dev, art và audio

- [x] Export Markdown cơ bản
- [ ] Export theo nhóm card hoặc loại card
- [ ] Chế độ Dev handoff
- [ ] Acceptance criteria, technical notes, edge cases và dependencies trong handoff
- [ ] Art brief, animation/VFX/UI asset requirements
- [ ] Audio/SFX/music requirements
- [ ] Asset status, reference, format và naming convention
- [ ] Đánh dấu phần đã handoff

**Hoàn thành phase khi:** dev, art và audio nhận được tài liệu đủ rõ để triển khai mà không phải hỏi lại những thông tin cơ bản.

### Phase 6 — Analytics, live game và báo cáo

- [ ] Analytics events, KPI, funnel, retention và economy metrics
- [ ] A/B test hypothesis
- [ ] Live tuning notes, version rollout và feature flags
- [ ] Post-launch review
- [ ] GDD tổng hợp, feature spec, mechanics catalogue, character bible
- [ ] Level/economy/playtest/decision/dev handoff report
- [ ] Preview phạm vi xuất và PDF/Markdown/JSON có version number

**Hoàn thành phase khi:** board hỗ trợ vòng đời feature từ ý tưởng đến sau phát hành.

### Phase 7 — UX và mở rộng năng suất

- [x] Dock chỉnh sửa cố định 275px, bulk edit dọc, inspector GD và preview card
- [ ] Collapse/expand section và pin section hay dùng
- [ ] Quick edit, duplicate template và tạo card liên quan nhanh
- [ ] Tạo dependency bằng kéo thả
- [ ] Keyboard shortcuts và command palette
- [ ] Empty state hướng dẫn người mới
- [ ] Template project hoàn chỉnh
- [ ] Permission nâng cao và báo cáo tự động

**Hoàn thành phase khi:** thao tác thường xuyên nhanh, dễ học và phù hợp với team lớn.

## 1. Nền tảng board

- [x] Tạo board Game Design riêng
- [x] Giữ board tư duy trực quan độc lập
- [x] Chọn loại board khi tạo
- [x] Lưu loại board ở server
- [x] Realtime collaboration
- [x] Undo/redo
- [x] Tìm kiếm, lọc, tag, status
- [x] Chọn nhiều đối tượng
- [x] Dock chỉnh sửa cố định bên phải
- [ ] Phân quyền theo project/team
- [ ] Lịch sử thay đổi
- [ ] Version snapshot / khôi phục phiên bản

## 2. Cấu trúc game

- [x] Game Pillar
- [x] Core Loop
- [x] Mechanic/System
- [x] Character/Unit
- [x] Skill/Item
- [x] Quest/Level
- [x] UI/UX
- [x] Playtest
- [x] Genre / target audience
- [x] Game objective / player fantasy
- [x] Player journey
- [ ] Game loop cấp nhỏ và cấp lớn
- [ ] Progression map
- [ ] Content dependency map
- [ ] Feature roadmap

## 3. Spec cho từng loại nội dung

- [x] Tên và mô tả
- [x] Mục tiêu, luật hoạt động, input, output/reward
- [x] Edge cases và dependencies
- [x] Owner và priority
- [x] Acceptance criteria
- [ ] Player experience / cảm xúc mong muốn
- [x] Examples / tình huống mẫu
- [x] Failure states
- [x] Tuning parameters
- [ ] Technical notes cho dev
- [ ] Art/audio requirements
- [ ] Analytics events cần tracking

## 4. Quan hệ giữa các thành phần

- [x] Dây nối tự do giữa các card
- [x] Quan hệ `depends on`
- [x] Quan hệ `unlocks`
- [x] Quan hệ `replaces`
- [x] Quan hệ `conflicts with`
- [ ] Liên kết Mechanic ↔ Skill/Unit/Level/Quest/UI
- [ ] Dependency graph
- [ ] Cảnh báo dependency bị thiếu hoặc tạo vòng lặp

## 5. Trạng thái và workflow

- [x] Status cơ bản, priority, owner
- [x] Draft
- [x] Review
- [ ] Approved
- [x] Ready for dev
- [x] In dev
- [x] Testing
- [x] Done
- [ ] Rejected / Archived
- [ ] Người review và ngày review
- [ ] Comment yêu cầu chỉnh sửa
- [ ] Definition of Done checklist

## 6. Balance và economy

- [x] Bảng chỉ số riêng
- [x] Damage / HP / Armor (qua chỉ số tùy biến)
- [x] Cooldown / duration (qua chỉ số tùy biến)
- [x] Cost / reward (qua chỉ số tùy biến)
- [ ] XP / level progression
- [ ] Drop rate và currency flow
- [x] Công thức có biến đầu vào và tính toán tự động
- [ ] So sánh trước/sau khi chỉnh
- [ ] Cảnh báo giá trị bất thường
- [ ] Import/export CSV
- [x] Liên kết bảng balance với card

## 7. Playtest và iteration

- [x] Playtest card cơ bản
- [x] Test objective và hypothesis
- [x] Build/version test
- [x] Người chơi / nhóm test và ngày test
- [x] Observations, metrics, player feedback
- [x] Problems found
- [x] Decision và liên kết card follow-up
- [ ] Follow-up task riêng
- [ ] So sánh nhiều phiên playtest
- [ ] Liên kết playtest với mechanic/level/skill
- [ ] Playtest history theo version

## 8. Decision log

- [x] Ghi lại quyết định thiết kế
- [x] Lý do và evidence/playtest liên quan
- [x] Các phương án đã cân nhắc
- [x] Người quyết định và ngày quyết định
- [x] Quyết định bị thay thế
- [ ] Decision timeline

## 9. Handoff cho dev

- [x] Export Markdown
- [ ] Export theo nhóm card được chọn
- [ ] Export theo loại card
- [ ] Chế độ Dev handoff
- [ ] Tách rõ Design / Art / Audio / Engineering tasks
- [x] Acceptance criteria dạng checklist
- [ ] Technical notes và edge cases nổi bật
- [ ] Dependencies tự động trong tài liệu
- [ ] Link ngược từ tài liệu về board
- [ ] Export JSON/CSV
- [ ] Template handoff riêng cho từng team
- [ ] Đánh dấu phần đã handoff

## 10. Handoff cho Art và Audio

- [ ] Art brief
- [ ] Concept reference
- [ ] Animation và VFX requirements
- [ ] UI asset requirements
- [ ] Audio/SFX và music requirements
- [ ] Asset status
- [ ] Link file/reference
- [ ] Kích thước, format và naming convention

## 11. Analytics và live game

- [ ] Event cần tracking
- [ ] KPI liên quan
- [ ] Funnel và retention impact
- [ ] Economy metrics
- [ ] A/B test hypothesis
- [ ] Live tuning notes
- [ ] Version rollout và feature flag
- [ ] Post-launch review

## 12. Quản lý project

- [ ] Roadmap và milestone
- [ ] Sprint và deadline
- [ ] Estimate
- [ ] Risk và blocker
- [ ] Assignee
- [ ] Link task tracker
- [ ] Board view theo milestone, owner và status

## 13. UX của chính công cụ

- [x] Dock chỉnh sửa bên phải, cố định 275px
- [x] Bulk edit xếp dọc
- [x] Inspector Game Design
- [x] Preview nội dung trên card
- [ ] Collapse/expand từng section
- [ ] Pin section hay dùng
- [ ] Quick edit ngay trên card
- [ ] Duplicate template
- [ ] Tạo card liên quan nhanh
- [ ] Tạo dependency bằng kéo thả
- [ ] Keyboard shortcuts
- [ ] Command palette
- [ ] Empty state hướng dẫn người mới
- [ ] Template project hoàn chỉnh

## 14. Báo cáo và xuất bản

- [ ] GDD tổng hợp
- [ ] Feature spec
- [ ] Mechanics catalogue
- [ ] Character bible
- [ ] Level design document
- [ ] Economy document
- [ ] Playtest report
- [ ] Decision report
- [ ] Dev handoff report
- [ ] Chọn phạm vi xuất và preview trước khi xuất
- [ ] PDF / Markdown / JSON
- [ ] Version number trong tài liệu

## Cách sử dụng

Làm theo thứ tự Phase 0 → Phase 7. Khi một mục chi tiết hoàn thành, tick `[ ]` thành `[x]`; chỉ đánh dấu phase hoàn thành khi đạt tiêu chí ở cuối phase đó.
