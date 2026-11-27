import { TEAM_HANDOFF_TEAMS } from "../../../lib/game-design.js";

const HANDOFF_STATUS_LABELS = { draft: "Bản nháp", ready: "Sẵn sàng bàn giao", "handed-off": "Đã bàn giao" };
const ASSET_HANDOFF_FIELDS = [["brief", "Brief"], ["requirements", "Asset requirements"], ["references", "Reference"], ["format", "Format"], ["naming", "Naming convention"]];

export function TeamHandoffSection({ handoff, canEdit, collapsed, onToggle, onChange }) {
  function replace(team, patch) { onChange({ ...handoff, [team.id]: { ...handoff[team.id], ...patch } }); }
  return <section className="gd-detail-section gd-team-handoff">
    <div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Team handoff</button></div>
    {!collapsed && <div className="gd-team-handoff-list">
      <p className="gd-detail-empty">Brief riêng cho từng team. Chọn “Đã bàn giao” sau khi bạn đã gửi tài liệu.</p>
      {TEAM_HANDOFF_TEAMS.map((team) => {
        const item = handoff[team.id];
        const fields = team.id === "dev" ? [["notes", "Ghi chú bàn giao"]] : ASSET_HANDOFF_FIELDS;
        return <article className="gd-team-handoff-item" key={team.id}>
          <div className="gd-team-handoff-head"><strong>{team.label}</strong><span className={`gd-handoff-status status-${item.status}`}>{HANDOFF_STATUS_LABELS[item.status]}</span></div>
          <label>Trạng thái<select value={item.status} disabled={!canEdit} onChange={(event) => replace(team, { status: event.target.value })}><option value="draft">Bản nháp</option><option value="ready">Sẵn sàng bàn giao</option><option value="handed-off">Đã bàn giao</option></select></label>
          <label>Người nhận<input maxLength={4000} value={item.owner} disabled={!canEdit} onChange={(event) => replace(team, { owner: event.target.value })} /></label>
          <label>Ngày bàn giao<input maxLength={4000} value={item.handedOffAt} placeholder="YYYY-MM-DD" disabled={!canEdit} onChange={(event) => replace(team, { handedOffAt: event.target.value })} /></label>
          {fields.map(([field, label]) => <label key={field}>{label}<textarea rows={2} maxLength={4000} value={item[field]} disabled={!canEdit} onChange={(event) => replace(team, { [field]: event.target.value })} /></label>)}
        </article>;
      })}
    </div>}
  </section>;
}
