# Game Design Team Handoff — Design

> Plan thực thi: [../plans/2026-08-12-gd-team-handoff.md](../plans/2026-08-12-gd-team-handoff.md)

## Mục tiêu

Biến một card Game Design thành brief có thể giao thẳng cho Dev, Art hoặc Audio, đồng thời cho GD biết phần nào đã sẵn sàng hoặc đã được bàn giao.

## Phạm vi

- Mỗi card GD lưu `design.teamHandoff` với ba brief độc lập: `dev`, `art`, `audio`.
- Mỗi brief có trạng thái `draft`, `ready`, `handed-off`, người nhận và ngày bàn giao.
- Dev dùng technical notes/spec hiện có, thêm ghi chú bàn giao ngắn; Art và Audio có brief, asset/requirement, reference, format và naming convention riêng.
- Inspector có một section `Team handoff` thu gọn; tất cả thao tác sửa vẫn ở dock phải 275px.
- Panel Handoff đổi thành chọn team + phạm vi tất cả/card đang chọn và tạo Markdown chỉ chứa thông tin phù hợp team đó. Nó cũng hiện tóm tắt số card theo trạng thái.
- Dữ liệu được normalize ở client, validate ở server, đi qua realtime/rebase/persistence và export Markdown.

## Ngoài phạm vi

- Không upload/quản lý file asset, không tích hợp Jira/Figma/Discord.
- Không tạo task assignee, milestone, comment review hay analytics; chúng thuộc workflow/analytics phase sau.
- Không thay đổi board Idea.

## Mô hình dữ liệu

`node.design.teamHandoff` luôn có ba key:

```js
{
  dev: { status: "draft", owner: "", handedOffAt: "", notes: "" },
  art: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" },
  audio: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" }
}
```

Chuỗi được trim, card tham chiếu không áp dụng ở phase này. `handedOffAt` là chuỗi ngày do GD nhập; không tự ghi ngày để tránh tạo một thay đổi khó thấy khi chỉ đổi status.

## Luồng UX

1. GD mở card, mở `Team handoff`, điền nội dung cho một team và chọn trạng thái.
2. Khi đủ, GD đặt `Ready`; sau khi gửi brief, đặt `Handed off`, người nhận và ngày.
3. GD mở `Handoff` trên header, chọn Dev/Art/Audio và phạm vi. Preview cho thấy chính xác Markdown sẽ copy/download.
4. Export chỉ bao gồm card trong phạm vi và các field liên quan team đích; Game Context/Flow/Balance vẫn được đưa vào khi có vì là context chung cần cho việc triển khai.

## Độ đúng và an toàn

- Viewer chỉ đọc, không thay đổi team handoff.
- Server từ chối shape/status/chuỗi quá giới hạn; board idea không nhận dữ liệu GD mới.
- Markdown không chèn section trống; `selected` chỉ đưa relations nội bộ của các card chọn.
- Unit test cover normalizer, Markdown filter và payload invalid; browser check cover dock, persistence, export và readonly UI (nếu có account viewer).

## Kết quả chấp nhận

- Một card mechanic có thể được giao riêng cho Art và Audio với nội dung khác nhau, lưu/reload không mất.
- Dev export có technical notes và note Dev, không lẫn asset/audio fields.
- Art/Audio export có đúng brief asset của team, status/owner/date và không lẫn technical implementation details.
- Dock không vượt 275px, controls xếp dọc, preview/download/copy dùng đúng Markdown.
