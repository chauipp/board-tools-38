# Smooth Connectors Implementation Plan

**Goal:** Dây nối cong mềm, tránh card và giữ thao tác chọn/sửa/xuất ảnh chính xác.

**Architecture:** Helper thuần `edge-routing.js` tạo tuyến dùng chung; UI và PNG chỉ tiêu thụ kết quả. Card/frame không thay đổi vị trí, board không thêm metadata.

**Tech Stack:** React18, SVG, Canvas2D, Node builtin test, Vite6, Playwright.

## Global Constraints

- Giữ nguyên thay đổi người dùng tại `client/src/index.css` trên main.
- Không thêm dependency, không thay schema/API hoặc ghi board thật trong QA.
- Làm trong worktree từ ce8a622; test đỏ trước xanh; không bỏ qua test để đạt xanh.

[Spec](../specs/2026-10-19-smooth-connectors-design.md)

- [x] Task 1: Hình học tuyến mềm và tránh card

Files: tạo `client/src/lib/edge-routing.js` và `.test.js`; mở rộng `sketchy.js`/test nếu cần giữ nét tay.

- [x] Viết regression fanout hẹp, bốn hướng, card cản, group, overlap, marquee; chạy đỏ bằng `node --test src/lib/edge-routing.test.js`.
- [x] Trả giao diện `buildEdgeRoutes(edges,nodes,groups,sizeOf): Map` và `routeIntersectsRect(route,rect): boolean`; mỗi route có `d,points,start,end,label,length,endAngle`.
- [x] Kiểm xanh focused; kiểm endpoint/malformed hữu hạn, ổn định; ghi self-review và log.

- [x] Task 2: Đồng bộ hiển thị và tương tác

Files: `EdgeLayer.jsx`, `IdeaMap.jsx`, `png-export.js`, `idea-map.css`, `__smoke__/entry.jsx`.

- [x] Thay `<line>` bằng `<path>` cho nét và hit; `d={route.d}`, `fill="none"`; nhãn dùng `route.label`.
- [x] Memo route từ edges/maps/cardSize; truyền vào EdgeLayer. Marquee dùng `routeIntersectsRect`; tay cầm dùng `route.start/end`.
- [x] PNG stroke Path2D theo route, arrow dùng `endAngle`, bounds gồm route.points; smoke đọc path geometry và class, giữ assertion hành vi.
- [x] Chạy `npm test`, `npm run build`, `npm run test:smoke`; so lỗi baseline đã ghi.

- [x] Task 3: Browser QA, bàn giao và dọn tài nguyên

- [x] Playwright fixture `http://127.0.0.1:7156/idea-map/wire-qa`, chặn API/socket; baseline và sau sửa lấy600 mẫu/edge, PASS không xuyên unrelated card.
- [x] Kiểm bốn hướng, vật cản, nhóm, click/contextmenu/marquee/handles/drag, mobile, sketch, PNG và console/network; chụp ảnh bằng chứng.
- [x] Review diff; hoàn tất summary riêng; kiểm identity + toàn staged diff trước commit; tích hợp về main sau kiểm xanh theo yêu cầu repo.
- [x] Đóng worker/browser, dừng server7156, xác nhận port trống; bỏ symlink dependency. Archive worktree, xóa run root và lưu conversation là bước bàn giao ngay sau commit tài liệu.

## Kết quả

[Summary](../summaries/2026-10-19-smooth-connectors-summary.md)
