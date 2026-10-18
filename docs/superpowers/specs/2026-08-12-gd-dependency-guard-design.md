# Dependency Guard — Design

> Plan thực thi: [../plans/2026-08-12-gd-dependency-guard.md](../plans/2026-08-12-gd-dependency-guard.md)

## Mục tiêu

Biến relation `Phụ thuộc` thành thông tin hành động: biết thẻ nào đang bị block và ngăn một dây mới tạo vòng dependency.

## Phạm vi

- Hàm thuần phân tích dependency chỉ từ edge `depends-on` giữa các node.
- `dependencyAnalysis(board)` trả direct prerequisites/dependents, chain transitive, blocked card và set edge tạo cycle.
- Edge inspector hiển thị chain source → target, warning cycle và trạng thái blocker.
- Khi người dùng đổi/tạo relation `depends-on` tạo cycle, UI vẫn cho thấy dây nhưng warning rõ ràng; không tự xóa dữ liệu cũ.
- Card có badge `Blocked` khi có prerequisite chưa status Done; badge `Vòng lặp` khi card thuộc cycle.

## Quy tắc hướng

Với edge `A depends-on B`, A là card bị block, B là prerequisite. Chain hiển thị `A → B → …`; `Done` xác định bằng status có tên chính xác `Done` (case-insensitive).

## Ngoài phạm vi

- Không auto-layout graph, không chặn server PUT, không sửa toàn bộ cycle cũ tự động.
- Unlocks/replaces/conflicts không được coi là dependency blocking.

## Kết quả chấp nhận

- A depends-on B và B chưa Done: A hiện Blocked.
- A→B→C→A: inspector của edge dependency báo vòng lặp và card trong vòng có badge.
- Quan hệ khác không tạo blocker/cycle.
