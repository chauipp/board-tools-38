# Chuẩn hóa cấu trúc repository board-tools

## Mục tiêu

Biến repository mới thành một repo ứng dụng độc lập, không có lớp thư mục `board-tools/` lồng bên trong, đường dẫn deploy và tài liệu nhất quán, đồng thời loại bỏ script debug không còn được sử dụng.

## Phạm vi

- Di chuyển `board-tools/client/` thành `client/`.
- Di chuyển `board-tools/server/` thành `server/`.
- Di chuyển `board-tools/docs/pvp-ideas.md` thành `docs/design/pvp-combat-ideas.md`.
- Xóa `client/debug-edge3.mjs` vì không được package script hoặc source nào tham chiếu.
- Cập nhật `render.yaml`, `AGENTS.md`, tài liệu hướng dẫn, comment đường dẫn và package metadata.
- Bổ sung README ở root và script root để người mới biết cách cài/chạy/test.
- Không đổi logic runtime, không đọc hoặc sửa nội dung secret `.env`, không đụng lịch sử tài liệu cũ trong `docs/superpowers/`.
- Giữ env runtime local tại `server/.env` và không stage file này; xóa bản `.env` cũ còn sót trong lớp thư mục `board-tools/`.

## Cấu trúc đích

```text
client/       React + Vite frontend
server/       Express + Socket.IO + MongoDB backend
docs/
  design/     ý tưởng và tài liệu định hướng sản phẩm
  recipes/    quy trình kỹ thuật lặp lại
  research/   nghiên cứu
  superpowers/ hồ sơ spec/plan/summary lịch sử
```

## Kiểm chứng

- Không còn đường dẫn runtime hoặc hướng dẫn trỏ tới `board-tools/`.
- Client test, client build và server test chạy thành công; smoke test hiện còn failure undo có sẵn trong harness.
- `git diff --check` không báo lỗi.
- Không có `graphify-out/` hoặc artifact build mới; dependency chỉ nằm trong thư mục ignored; các `.env` local được giữ nguyên và không stage.

## Plan thực thi

Xem [plan thực thi](../plans/2026-10-19-board-tools-repository-layout.md).
