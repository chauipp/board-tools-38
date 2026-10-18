# Dock có thanh cuộn nhưng không cuộn được

## Khi nào gặp lại

Con trỏ ở một panel/dock nổi trên canvas nhưng lăn chuột lại làm canvas lia/zoom, hoặc scrollbar hiện ra mà `scrollTop` không đổi.

## Cách làm đúng

Trong `board-tools/client/src/pages/IdeaMap.jsx`, thêm selector của panel vào guard đầu `wheelHandler` trước `e.preventDefault()`:

```js
if (e.target.closest(".outline-panel, .io-drawer, .tree-panel, .edit-dock")) return;
```

Để chính `.edit-dock` có `overflow-y: auto` và style scrollbar theo token `--line`, `--accent`, `--surface` trong `idea-map.css`. Không đặt scrollbar ở `.gd-panel`, vì nó nằm trong padding nên thanh bị thụt khỏi mép dock.

## Cái bẫy

`overflow: auto` một mình không đủ. Listener `wheel` native của viewport chạy khi event bubble lên canvas và gọi `preventDefault()`, nên scroll native bị chặn âm thầm; không có lỗi console hay test unit đỏ.

## Kiểm thế nào là đúng

Dùng Playwright mở spec dài, hover `.edit-dock`, gọi `mouse.wheel(0, 700)` và assert `scrollTop > 0`; đồng thời ở viewport 375×667 assert `document.documentElement.scrollWidth <= window.innerWidth`.
