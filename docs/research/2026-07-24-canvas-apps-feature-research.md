# Research: tính năng hay nhất của Miro/MURAL, Figma/FigJam, XMind/MindMeister/Whimsical/MindNode, Excalidraw/tldraw/Obsidian Canvas/Heptabase → áp dụng vào Idea Map

4 research agent chạy song song (2026-07-24), mỗi agent một nhóm app, cùng context dự án
(React DOM canvas, SVG edges, whole-board PUT, 2 người dùng, không real-time). Dưới đây là
tổng hợp đã khử trùng lặp, xếp theo mức độ hội tụ (bao nhiêu agent cùng gọi tên) và tỉ lệ
giá trị/chi phí. Chi tiết từng agent nằm ở cuối.

## Insight lớn nhất (cả 4 agent đồng thuận)

App đã làm đúng phần KHÓ (zoom-to-cursor, undo/redo, frame drag-with-members, marquee) nhưng
thiếu gần như toàn bộ phần RẺ mà làm nên "cảm giác xịn":
1. **Phản hồi không gian khi thao tác** — snapping, guide lines, edge có mũi tên cắt đúng mép card
2. **Vòng lặp bàn phím** — hiện chỉ có Ctrl+Z/Y; không có Delete, Escape, duplicate, nudge, quick-add
3. **Multi-select mới chỉ kéo được** — chưa batch-edit thuộc tính
4. **Card là text trơ** — chưa có link bấm được, markdown, ảnh

## Đợt 1 — "Cảm giác canvas" (toàn S/M, hội tụ cao nhất)

| # | Tính năng | Nguồn | Cost |
|---|-----------|-------|------|
| 1 | Edge cắt đúng mép card + mũi tên (thay line xuyên tâm hiện tại) | Excalidraw (#1 MUST) | S |
| 2 | Bộ phím tắt: Delete/Backspace xoá selection, Escape thoát mode, N tạo card, Ctrl+D duplicate, mũi tên nudge (Shift=10px), Space+kéo = pan, F/Shift+2 zoom-to-selection | Miro+Excalidraw+Figma (đều MUST) | S |
| 3 | Alt-drag để duplicate (kéo giữ Alt = copy thay vì move) | Figma (MUST) | S |
| 4 | Snapping + alignment guides khi kéo card/frame (~6px screen-space) | Figma #1, Miro #1 (MUST) | M |
| 5 | Quick-create bàn phím: đang edit card nhấn Tab/Ctrl+Enter → sinh card mới nối edge, focus luôn ô nhập | XMind #1, FigJam, Miro (MUST) | S |
| 6 | Focus mode: chọn card → dim mọi thứ ngoài 1-2 hop lân cận (tái dùng CSS dim của filter) | MindMeister/MindNode (MUST) | S |
| 7 | Bulk-edit multi-select: chọn ≥2 card → thanh nổi đổi status/tag/màu một lần | Figma (MUST) | S |
| 8 | Bổ sung Duplicate/Xoá vào popover chuột phải card hiện có | Figma (MUST) | S |

## Đợt 2 — "Tổ chức & nội dung"

| # | Tính năng | Nguồn | Cost |
|---|-----------|-------|------|
| 9 | Outline/list panel: danh sách card nhóm theo frame/status, click → bay tới card | MindNode/MindMeister (MUST), Miro frames panel | M |
| 10 | Tidy up: chọn nhiều card → xếp lưới/hàng đều nhau (1 undo step) | Miro (MUST), Figma | S/M |
| 11 | Markdown-lite trong desc: URL bấm được, **bold**, bullet `- ` (render ~30 dòng, không lib) | Obsidian/Heptabase (MUST) | S-M |
| 12 | Quick capture: ô nhập nhanh, mỗi dòng = 1 card, tile vào chỗ trống gần viewport | MindNode Quick Entry (MUST) | M |
| 13 | Export Markdown outline (tái dùng logic #9): `## Frame` + bullet + danh sách edge | XMind | S |

## Đợt 3 — "Mở rộng" (chọn theo nhu cầu)

| # | Tính năng | Nguồn | Cost | Ghi chú |
|---|-----------|-------|------|---------|
| 14 | Ảnh trên card (paste/drop → nén client-side → data URL) | Excalidraw/Heptabase | M | BẮT BUỘC nén (PUT limit 2mb) |
| 15 | Comment trên card (mảng comments, author từ localStorage) | Miro | S/M | |
| 16 | Favorite/star per-person → filter "cả 2 cùng thích" | Miro dot-voting | S | |
| 17 | Deep link `?card=<id>` → pan tới + highlight | Miro | S | |
| 18 | Lock card/frame (khoá vị trí) | Miro | S | |
| 19 | Export PNG (DOM-to-image theo bbox fitToView) | Excalidraw/XMind | M | |
| 20 | Presentation mode: bước qua từng frame full-screen bằng mũi tên | Miro | M | |
| 21 | Loại edge (solid/dashed) + label giữa edge | XMind relationship | S | |

## SKIP (có lý do)

- **Minimap** — 2 agent nói skip/borderline: fit-to-view đã giải quyết 90%, board 2 người khó đủ lớn
- **Elbow/orthogonal edge routing** — Excalidraw tự thú nhận phải viết A* pathfinder, lớn hơn toàn bộ board-geometry.js hiện tại; #1 Đợt 1 cho 80% cảm giác với 5% công
- **Command palette** — chỉ đáng khi số action đủ nhiều; đội 2 người tự build tool đã thuộc nút
- **Stamps/emoji reactions** — trùng với status/tag; 2 người nói chuyện trực tiếp được
- **Real-time multiplayer/cursors** — không có sync infra, ngoài scope từ đầu
- **Auto-layout/tree balancing** — free-positioning là lựa chọn có chủ đích của app, không mượn
- **Boundary/Summary kiểu XMind** — Frame hiện tại đã là superset

## Báo cáo gốc từng agent

(Nội dung đầy đủ của 4 agent nằm trong transcript phiên làm việc; file này giữ phần tổng hợp
đã khử trùng lặp. Nguồn tham khảo chính: help.miro.com, mural.co, help.figma.com, xmind.com
user guide, support.mindmeister.com, whimsical.com, docs Excalidraw/tldraw + devlog elbow
arrows, Obsidian Canvas, Heptabase.)
