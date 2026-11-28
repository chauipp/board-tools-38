export function RelatedCards({ value, nodes, canEdit, onChange, label = "Thẻ liên quan" }) {
  return (
    <label>
      {label}
      <select multiple value={value} disabled={!canEdit} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>
        {nodes.map((item) => <option key={item.id} value={String(item.id)}>{item.title || `Thẻ ${item.id}`}</option>)}
      </select>
      <span className="gd-field-help">Giữ Ctrl/Cmd để chọn nhiều thẻ.</span>
    </label>
  );
}
