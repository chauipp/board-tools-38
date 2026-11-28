import { CollapsibleSection } from "./ListEditor.jsx";

export function DeliverySection({ delivery, canEdit, collapsed, onToggle, onChange }) {
  const change = (patch) => onChange({ ...delivery, ...patch });
  return (
    <CollapsibleSection className="gd-delivery-section" title="Delivery" collapsed={collapsed} onToggle={onToggle}>
      <label>
        Milestone
        <input
          maxLength={4000}
          value={delivery.milestone}
          disabled={!canEdit}
          placeholder="Ví dụ: Vertical slice"
          onChange={(event) => change({ milestone: event.target.value })}
        />
      </label>
      <label>
        Assignee
        <input
          maxLength={4000}
          value={delivery.assignee}
          disabled={!canEdit}
          placeholder="Người phụ trách triển khai"
          onChange={(event) => change({ assignee: event.target.value })}
        />
      </label>
      <label>
        Deadline
        <input type="date" value={delivery.deadline} disabled={!canEdit} onChange={(event) => change({ deadline: event.target.value })} />
      </label>
      <label>
        Mức blocker
        <select value={delivery.blockerLevel} disabled={!canEdit} onChange={(event) => change({ blockerLevel: event.target.value })}>
          <option value="none">Không có</option>
          <option value="risk">Có rủi ro</option>
          <option value="blocked">Đang bị chặn</option>
        </select>
      </label>
      <label>
        Blocker / rủi ro
        <textarea
          rows={2}
          maxLength={4000}
          value={delivery.blocker}
          disabled={!canEdit}
          placeholder="Điều gì đang chặn hoặc có thể làm trễ card?"
          onChange={(event) => change({ blocker: event.target.value })}
        />
      </label>
    </CollapsibleSection>
  );
}
