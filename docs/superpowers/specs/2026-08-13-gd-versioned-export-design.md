# Versioned Export cho Game Design Board

> Plan: [../plans/2026-08-13-gd-versioned-export.md](../plans/2026-08-13-gd-versioned-export.md)

Export GD được đóng gói với metadata `{ format, exportedAt, boardName, boardKind, version }`. Markdown/Handoff hiện dòng version ở đầu; JSON tải xuống bọc metadata và `board` để không làm thay đổi schema board khi import. Version mặc định lấy `updatedAt`, fallback thời điểm export. Không làm PDF trong phase này.
