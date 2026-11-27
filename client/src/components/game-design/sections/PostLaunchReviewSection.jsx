import { CollapsibleSection } from "./ListEditor.jsx";
import { RelatedCards } from "./RelatedCards.jsx";

const REVIEW_TEXT_FIELDS = [
  ["outcome", "Outcome", "Kết quả tổng quan sau phát hành…"],
  ["actualMetrics", "Actual metrics", "Kết quả metric thực tế, guardrail, lỗi…"],
  ["learnings", "Learnings", "Điều team học được…"],
  ["nextDecision", "Next decision", "Giữ, tune tiếp, rollback hay sunset…"]
];

export function PostLaunchReviewSection({ review, nodes, canEdit, collapsed, onToggle, onChange }) {
  const change = (patch) => onChange({ ...review, ...patch });
  return (
    <CollapsibleSection className="gd-post-launch-section" title="Post-launch review" collapsed={collapsed} onToggle={onToggle}>
      {REVIEW_TEXT_FIELDS.map(([field, label, placeholder]) => (
        <label key={field}>
          {label}
          <textarea
            rows={2}
            maxLength={4000}
            value={review[field]}
            disabled={!canEdit}
            placeholder={placeholder}
            onChange={(event) => change({ [field]: event.target.value })}
          />
        </label>
      ))}
      <label>
        Owner
        <input maxLength={4000} value={review.owner} disabled={!canEdit} onChange={(event) => change({ owner: event.target.value })} />
      </label>
      <label>
        Ngày review
        <input type="date" value={review.reviewDate} disabled={!canEdit} onChange={(event) => change({ reviewDate: event.target.value })} />
      </label>
      <label>
        Trạng thái
        <select value={review.status} disabled={!canEdit} onChange={(event) => change({ status: event.target.value })}>
          <option value="pending">Pending</option>
          <option value="healthy">Healthy</option>
          <option value="needs-iteration">Needs iteration</option>
          <option value="sunset">Sunset</option>
        </select>
      </label>
      <RelatedCards value={review.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => change({ cardIds })} label="Thẻ liên quan" />
    </CollapsibleSection>
  );
}
