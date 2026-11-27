import { RelatedCards } from "./RelatedCards.jsx";

function newDecision() { return { id: globalThis.crypto?.randomUUID?.() || `decision-${Date.now()}-${Math.random().toString(36).slice(2)}`, decision: "", rationale: "", evidence: "", alternatives: "", owner: "", date: "", status: "active", cardIds: [] }; }

export function DecisionLogSection({ decisions, nodes, canEdit, collapsed, onToggle, onChange }) {
  const replace = (id, patch) => onChange(decisions.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="gd-detail-section">
    <div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Decision log <span>{decisions.length}</span></button>{canEdit && <button className="btn ghost gd-detail-add" type="button" disabled={decisions.length >= 30} onClick={() => onChange([...decisions, newDecision()])}>+ Thêm quyết định</button>}</div>
    {!collapsed && <div className="gd-detail-list">{decisions.length === 0 && <p className="gd-detail-empty">Chưa có quyết định được ghi lại.</p>}
      {decisions.map((item, index) => <article className="gd-detail-item" key={item.id}><div className="gd-detail-item-head"><strong>Quyết định {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => onChange(decisions.filter((entry) => entry.id !== item.id))}>Xóa</button>}</div>
        {[ ["decision", "Quyết định"], ["rationale", "Lý do"], ["evidence", "Evidence / Playtest"], ["alternatives", "Phương án đã cân nhắc"], ["owner", "Người quyết định"], ["date", "Ngày quyết định"] ].map(([key, label]) => <label key={key}>{label}<textarea rows={2} maxLength={4000} value={item[key]} disabled={!canEdit} onChange={(event) => replace(item.id, { [key]: event.target.value })} /></label>)}
        <label>Trạng thái<select value={item.status} disabled={!canEdit} onChange={(event) => replace(item.id, { status: event.target.value })}><option value="active">Đang áp dụng</option><option value="replaced">Đã thay thế</option></select></label>
        <RelatedCards value={item.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => replace(item.id, { cardIds })} />
      </article>)}</div>}
  </section>;
}
