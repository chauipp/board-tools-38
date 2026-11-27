// Khung dùng chung cho các mục của Chi tiết thiết kế. Mọi mục đều có cùng một
// đầu mục (nút thu/mở + bộ đếm + nút hành động bên phải) và phần lớn là "danh
// sách item, mỗi item vài field" — gom về đây để từng mục chỉ khai báo field.

export function CollapsibleSection({ className, title, count, collapsed, onToggle, actions, bodyClassName = "gd-detail-list", children }) {
  return (
    <section className={className ? `gd-detail-section ${className}` : "gd-detail-section"}>
      <div className="gd-detail-section-head">
        <button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>
          {collapsed ? "▸" : "▾"} {title}{count !== undefined && <> <span>{count}</span></>}
        </button>
        {actions}
      </div>
      {!collapsed && <div className={bodyClassName}>{children}</div>}
    </section>
  );
}

// fields: [key, nhãn, "input" | "textarea"]
export function ItemFields({ fields, item, canEdit, maxLength = 4000, onPatch }) {
  return fields.map(([field, label, control]) => (
    <label key={field}>
      {label}
      {control === "textarea"
        ? <textarea rows={2} maxLength={maxLength} value={item[field]} disabled={!canEdit} onChange={(event) => onPatch({ [field]: event.target.value })} />
        : <input maxLength={maxLength} value={item[field]} disabled={!canEdit} onChange={(event) => onPatch({ [field]: event.target.value })} />}
    </label>
  ));
}

export function ListEditor({
  className, title, count, items, itemLabel, emptyText, addLabel, limit, newItem,
  canEdit, collapsed, onToggle, onAdd, onChange, before, renderItem
}) {
  const add = onAdd || ((item) => onChange([...items, item]));
  const replace = (id, patch) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addButton = canEdit && (
    <button className="btn ghost gd-detail-add" type="button" disabled={items.length >= limit} onClick={() => add(newItem())}>
      + {addLabel}
    </button>
  );
  return (
    <CollapsibleSection className={className} title={title} count={count ?? items.length} collapsed={collapsed} onToggle={onToggle} actions={addButton}>
      {before}
      {items.length === 0 && <p className="gd-detail-empty">{emptyText}</p>}
      {items.map((item, index) => (
        <article className="gd-detail-item" key={item.id}>
          <div className="gd-detail-item-head">
            <strong>{itemLabel} {index + 1}</strong>
            {canEdit && (
              <button className="gd-detail-remove danger" type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>
                Xóa
              </button>
            )}
          </div>
          {renderItem(item, (patch) => replace(item.id, patch))}
        </article>
      ))}
    </CollapsibleSection>
  );
}
