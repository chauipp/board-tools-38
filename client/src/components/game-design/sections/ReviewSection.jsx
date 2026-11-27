import { ListEditor } from "./ListEditor.jsx";

function newReviewComment() {
  return { id: globalThis.crypto?.randomUUID?.() || `review-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: "", author: "", resolved: false };
}

export function ReviewSection({ review, canEdit, collapsed, onToggle, onChange }) {
  const change = (patch) => onChange({ ...review, ...patch });
  const reviewFields = <>
    <label>
      Outcome
      <select value={review.outcome} disabled={!canEdit} onChange={(event) => change({ outcome: event.target.value })}>
        <option value="pending">Chưa review</option>
        <option value="approved">Approved</option>
        <option value="changes-requested">Changes requested</option>
        <option value="rejected">Rejected</option>
      </select>
    </label>
    <label>
      Reviewer
      <input maxLength={4000} value={review.reviewer} disabled={!canEdit} onChange={(event) => change({ reviewer: event.target.value })} />
    </label>
    <label>
      Ngày review
      <input maxLength={4000} placeholder="YYYY-MM-DD" value={review.date} disabled={!canEdit} onChange={(event) => change({ date: event.target.value })} />
    </label>
  </>;
  return (
    <ListEditor
      className="gd-review-section"
      title="Review"
      count={review.comments.filter((item) => !item.resolved).length}
      items={review.comments}
      itemLabel="Yêu cầu"
      emptyText="Chưa có yêu cầu chỉnh sửa."
      addLabel="Thêm yêu cầu"
      limit={20}
      newItem={newReviewComment}
      canEdit={canEdit}
      collapsed={collapsed}
      onToggle={onToggle}
      onChange={(comments) => change({ comments })}
      before={reviewFields}
      renderItem={(item, patch) => <>
        <label>
          Nội dung
          <textarea rows={2} maxLength={4000} value={item.text} disabled={!canEdit} onChange={(event) => patch({ text: event.target.value })} />
        </label>
        <label>
          Người ghi
          <input maxLength={4000} value={item.author} disabled={!canEdit} onChange={(event) => patch({ author: event.target.value })} />
        </label>
        <label className="gd-review-resolved">
          <input type="checkbox" checked={item.resolved} disabled={!canEdit} onChange={(event) => patch({ resolved: event.target.checked })} /> Đã xử lý
        </label>
      </>}
    />
  );
}
