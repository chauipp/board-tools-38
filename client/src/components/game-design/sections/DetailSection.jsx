export const DETAIL_SECTIONS = [
  {
    key: "examples", title: "Examples", addLabel: "Thêm ví dụ", itemLabel: "Ví dụ", identity: "title", limit: 20,
    fields: [["title", "Tên ví dụ", "input"], ["scenario", "Tình huống", "textarea"], ["expectedResult", "Kết quả mong đợi", "textarea"]]
  },
  {
    key: "failureStates", title: "Failure States", addLabel: "Thêm failure state", itemLabel: "Failure state", identity: "condition", limit: 20,
    fields: [["condition", "Điều kiện thất bại", "input"], ["playerFeedback", "Phản hồi cho người chơi", "textarea"], ["recovery", "Cách phục hồi", "textarea"]]
  },
  {
    key: "tuningParameters", title: "Tuning Parameters", addLabel: "Thêm parameter", itemLabel: "Parameter", identity: "name", limit: 30,
    fields: [["name", "Tên parameter", "input"], ["defaultValue", "Giá trị mặc định", "input"], ["min", "Tối thiểu", "input"], ["max", "Tối đa", "input"], ["unit", "Đơn vị", "input"], ["note", "Ghi chú", "textarea"]]
  }
];

function newDetailItem(section) {
  const id = globalThis.crypto?.randomUUID?.() || `detail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, ...Object.fromEntries(section.fields.map(([key]) => [key, ""])) };
}

export function DetailSection({ section, items, canEdit, collapsed, onToggle, onAdd, onChange }) {
  const replaceItem = (id, patch) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="gd-detail-section">
    <div className="gd-detail-section-head">
      <button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} {section.title} <span>{items.length}</span></button>
      {canEdit && <button className="btn ghost gd-detail-add" type="button" disabled={items.length >= section.limit} onClick={() => onAdd(newDetailItem(section))}>+ {section.addLabel}</button>}
    </div>
    {!collapsed && <div className="gd-detail-list">
      {items.length === 0 && <p className="gd-detail-empty">Chưa có {section.itemLabel.toLowerCase()}.</p>}
      {items.map((item, index) => <article className="gd-detail-item" key={item.id}>
        <div className="gd-detail-item-head"><strong>{section.itemLabel} {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Xóa</button>}</div>
        {section.fields.map(([field, label, control]) => <label key={field}>{label}
          {control === "textarea"
            ? <textarea rows={2} maxLength={1000} value={item[field]} disabled={!canEdit} onChange={(event) => replaceItem(item.id, { [field]: event.target.value })} />
            : <input maxLength={1000} value={item[field]} disabled={!canEdit} onChange={(event) => replaceItem(item.id, { [field]: event.target.value })} />}
        </label>)}
      </article>)}
    </div>}
  </section>;
}
