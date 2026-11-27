import { RelatedCards } from "./RelatedCards.jsx";

const PLAYTEST_FIELDS = [["objective", "Mục tiêu test", "textarea"], ["hypothesis", "Giả thuyết", "textarea"], ["buildVersion", "Build / version", "input"], ["playerGroup", "Nhóm người chơi", "input"], ["testDate", "Ngày test", "input"], ["observations", "Quan sát", "textarea"], ["metrics", "Metrics", "textarea"], ["playerFeedback", "Player feedback", "textarea"], ["problemsFound", "Problems found", "textarea"]];

export function PlaytestSection({ session, nodes, canEdit, collapsed, onToggle, onChange }) {
  return <section className="gd-detail-section">
    <div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Playtest session</button></div>
    {!collapsed && <div className="gd-detail-list"><p className="gd-detail-empty">Một thẻ Playtest tương ứng với một lần test.</p>
      {PLAYTEST_FIELDS.map(([key, label, control]) => <label key={key}>{label}{control === "textarea" ? <textarea rows={2} maxLength={4000} value={session[key]} disabled={!canEdit} onChange={(event) => onChange({ ...session, [key]: event.target.value })} /> : <input maxLength={4000} value={session[key]} disabled={!canEdit} onChange={(event) => onChange({ ...session, [key]: event.target.value })} />}</label>)}
      <RelatedCards value={session.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => onChange({ ...session, cardIds })} />
    </div>}
  </section>;
}
