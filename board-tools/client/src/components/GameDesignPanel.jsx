import { useEffect, useRef, useState } from "react";
import { DESIGN_FIELD_LABELS, TEAM_HANDOFF_TEAMS, balanceMetricsForCard, emptyReview, evaluateBalanceFormula, gameDesignType, normalizeABTests, normalizeAcceptanceCriteria, normalizeAnalyticsEvents, normalizeDecisionLog, normalizeDelivery, normalizeFollowUpTasks, normalizeGameDesignDetails, normalizeLiveOps, normalizePlaytestSession, normalizePostLaunchReview, normalizeReview, normalizeTeamHandoff, normalizeTechnicalNotes } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

const DETAIL_SECTIONS = [
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

function DetailSection({ section, items, canEdit, collapsed, onToggle, onAdd, onChange }) {
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

const PLAYTEST_FIELDS = [["objective", "Mục tiêu test", "textarea"], ["hypothesis", "Giả thuyết", "textarea"], ["buildVersion", "Build / version", "input"], ["playerGroup", "Nhóm người chơi", "input"], ["testDate", "Ngày test", "input"], ["observations", "Quan sát", "textarea"], ["metrics", "Metrics", "textarea"], ["playerFeedback", "Player feedback", "textarea"], ["problemsFound", "Problems found", "textarea"]];

function RelatedCards({ value, nodes, canEdit, onChange, label = "Thẻ liên quan" }) {
  return <label>{label}<select multiple value={value} disabled={!canEdit} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>
    {nodes.map((item) => <option key={item.id} value={String(item.id)}>{item.title || `Thẻ ${item.id}`}</option>)}
  </select><span className="gd-field-help">Giữ Ctrl/Cmd để chọn nhiều thẻ.</span></label>;
}

function PlaytestSection({ session, nodes, canEdit, collapsed, onToggle, onChange }) {
  return <section className="gd-detail-section">
    <div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Playtest session</button></div>
    {!collapsed && <div className="gd-detail-list"><p className="gd-detail-empty">Một thẻ Playtest tương ứng với một lần test.</p>
      {PLAYTEST_FIELDS.map(([key, label, control]) => <label key={key}>{label}{control === "textarea" ? <textarea rows={2} maxLength={4000} value={session[key]} disabled={!canEdit} onChange={(event) => onChange({ ...session, [key]: event.target.value })} /> : <input maxLength={4000} value={session[key]} disabled={!canEdit} onChange={(event) => onChange({ ...session, [key]: event.target.value })} />}</label>)}
      <RelatedCards value={session.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => onChange({ ...session, cardIds })} />
    </div>}
  </section>;
}

function newDecision() { return { id: globalThis.crypto?.randomUUID?.() || `decision-${Date.now()}-${Math.random().toString(36).slice(2)}`, decision: "", rationale: "", evidence: "", alternatives: "", owner: "", date: "", status: "active", cardIds: [] }; }

function DecisionLogSection({ decisions, nodes, canEdit, collapsed, onToggle, onChange }) {
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

const HANDOFF_STATUS_LABELS = { draft: "Bản nháp", ready: "Sẵn sàng bàn giao", "handed-off": "Đã bàn giao" };
const ASSET_HANDOFF_FIELDS = [["brief", "Brief"], ["requirements", "Asset requirements"], ["references", "Reference"], ["format", "Format"], ["naming", "Naming convention"]];

function TeamHandoffSection({ handoff, canEdit, collapsed, onToggle, onChange }) {
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

function newReviewComment() { return { id: globalThis.crypto?.randomUUID?.() || `review-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: "", author: "", resolved: false }; }
function ReviewSection({ review, canEdit, collapsed, onToggle, onChange }) {
  const replace = (id, patch) => onChange({ ...review, comments: review.comments.map((item) => item.id === id ? { ...item, ...patch } : item) });
  return <section className="gd-detail-section gd-review-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Review <span>{review.comments.filter((item) => !item.resolved).length}</span></button>{canEdit && <button className="btn ghost gd-detail-add" type="button" disabled={review.comments.length >= 20} onClick={() => onChange({ ...review, comments: [...review.comments, newReviewComment()] })}>+ Thêm yêu cầu</button>}</div>
    {!collapsed && <div className="gd-detail-list"><label>Outcome<select value={review.outcome} disabled={!canEdit} onChange={(event) => onChange({ ...review, outcome: event.target.value })}><option value="pending">Chưa review</option><option value="approved">Approved</option><option value="changes-requested">Changes requested</option><option value="rejected">Rejected</option></select></label><label>Reviewer<input maxLength={4000} value={review.reviewer} disabled={!canEdit} onChange={(event) => onChange({ ...review, reviewer: event.target.value })} /></label><label>Ngày review<input maxLength={4000} placeholder="YYYY-MM-DD" value={review.date} disabled={!canEdit} onChange={(event) => onChange({ ...review, date: event.target.value })} /></label>
      {review.comments.length === 0 && <p className="gd-detail-empty">Chưa có yêu cầu chỉnh sửa.</p>}{review.comments.map((item, index) => <article className="gd-detail-item" key={item.id}><div className="gd-detail-item-head"><strong>Yêu cầu {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => onChange({ ...review, comments: review.comments.filter((entry) => entry.id !== item.id) })}>Xóa</button>}</div><label>Nội dung<textarea rows={2} maxLength={4000} value={item.text} disabled={!canEdit} onChange={(event) => replace(item.id, { text: event.target.value })} /></label><label>Người ghi<input maxLength={4000} value={item.author} disabled={!canEdit} onChange={(event) => replace(item.id, { author: event.target.value })} /></label><label className="gd-review-resolved"><input type="checkbox" checked={item.resolved} disabled={!canEdit} onChange={(event) => replace(item.id, { resolved: event.target.checked })} /> Đã xử lý</label></article>)}</div>}
  </section>;
}

function DeliverySection({ delivery, canEdit, collapsed, onToggle, onChange }) {
  const change = (patch) => onChange({ ...delivery, ...patch });
  return <section className="gd-detail-section gd-delivery-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Delivery</button></div>
    {!collapsed && <div className="gd-detail-list"><label>Milestone<input maxLength={4000} value={delivery.milestone} disabled={!canEdit} placeholder="Ví dụ: Vertical slice" onChange={(event) => change({ milestone: event.target.value })} /></label><label>Assignee<input maxLength={4000} value={delivery.assignee} disabled={!canEdit} placeholder="Người phụ trách triển khai" onChange={(event) => change({ assignee: event.target.value })} /></label><label>Deadline<input type="date" value={delivery.deadline} disabled={!canEdit} onChange={(event) => change({ deadline: event.target.value })} /></label><label>Mức blocker<select value={delivery.blockerLevel} disabled={!canEdit} onChange={(event) => change({ blockerLevel: event.target.value })}><option value="none">Không có</option><option value="risk">Có rủi ro</option><option value="blocked">Đang bị chặn</option></select></label><label>Blocker / rủi ro<textarea rows={2} maxLength={4000} value={delivery.blocker} disabled={!canEdit} placeholder="Điều gì đang chặn hoặc có thể làm trễ card?" onChange={(event) => change({ blocker: event.target.value })} /></label></div>}
  </section>;
}

const ANALYTICS_FIELDS = [["eventName", "Event name"], ["trigger", "Trigger"], ["properties", "Properties"], ["kpi", "KPI liên quan"], ["owner", "Owner"]];
function newAnalyticsEvent() { return { id: globalThis.crypto?.randomUUID?.() || `analytics-${Date.now()}`, eventName: "", trigger: "", properties: "", kpi: "", owner: "" }; }
function AnalyticsSection({ events, canEdit, collapsed, onToggle, onChange }) {
  const replace = (id, patch) => onChange(events.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="gd-detail-section gd-analytics-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Analytics events <span>{events.length}</span></button>{canEdit && <button className="btn ghost gd-detail-add" type="button" disabled={events.length >= 20} onClick={() => onChange([...events, newAnalyticsEvent()])}>+ Thêm event</button>}</div>
    {!collapsed && <div className="gd-detail-list">{events.length === 0 && <p className="gd-detail-empty">Chưa có event cần tracking.</p>}{events.map((item, index) => <article className="gd-detail-item" key={item.id}><div className="gd-detail-item-head"><strong>Event {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => onChange(events.filter((entry) => entry.id !== item.id))}>Xóa</button>}</div>{ANALYTICS_FIELDS.map(([field, label]) => <label key={field}>{label}{field === "properties" ? <textarea rows={2} maxLength={4000} value={item[field]} disabled={!canEdit} onChange={(event) => replace(item.id, { [field]: event.target.value })} /> : <input maxLength={4000} value={item[field]} disabled={!canEdit} onChange={(event) => replace(item.id, { [field]: event.target.value })} />}</label>)}</article>)}</div>}
  </section>;
}

const AB_TEST_FIELDS = [["hypothesis", "Giả thuyết", "textarea"], ["control", "Control", "input"], ["variant", "Variant", "input"], ["primaryMetric", "Primary metric", "input"], ["successCriteria", "Tiêu chí thành công", "textarea"], ["segment", "Phân khúc người chơi", "input"]];
function newABTest() { return { id: globalThis.crypto?.randomUUID?.() || `ab-test-${Date.now()}`, hypothesis: "", control: "", variant: "", primaryMetric: "", successCriteria: "", segment: "", status: "draft" }; }
function ABTestsSection({ tests, canEdit, collapsed, onToggle, onChange }) {
  const replace = (id, patch) => onChange(tests.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="gd-detail-section gd-ab-tests-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} A/B test hypotheses <span>{tests.length}</span></button>{canEdit && <button className="btn ghost gd-detail-add" type="button" disabled={tests.length >= 20} onClick={() => onChange([...tests, newABTest()])}>+ Thêm hypothesis</button>}</div>
    {!collapsed && <div className="gd-detail-list">{tests.length === 0 && <p className="gd-detail-empty">Chưa có giả thuyết A/B test.</p>}{tests.map((item, index) => <article className="gd-detail-item" key={item.id}><div className="gd-detail-item-head"><strong>A/B test {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => onChange(tests.filter((entry) => entry.id !== item.id))}>Xóa</button>}</div>{AB_TEST_FIELDS.map(([field, label, control]) => <label key={field}>{label}{control === "textarea" ? <textarea rows={2} maxLength={4000} value={item[field]} disabled={!canEdit} onChange={(event) => replace(item.id, { [field]: event.target.value })} /> : <input maxLength={4000} value={item[field]} disabled={!canEdit} onChange={(event) => replace(item.id, { [field]: event.target.value })} />}</label>)}<label>Trạng thái<select value={item.status} disabled={!canEdit} onChange={(event) => replace(item.id, { status: event.target.value })}><option value="draft">Draft</option><option value="running">Running</option><option value="concluded">Concluded</option><option value="rejected">Rejected</option></select></label></article>)}</div>}
  </section>;
}

function LiveOpsSection({ liveOps, canEdit, collapsed, onToggle, onChange }) {
  const change = (patch) => onChange({ ...liveOps, ...patch });
  return <section className="gd-detail-section gd-live-ops-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Live tuning & rollout</button></div>
    {!collapsed && <div className="gd-detail-list"><label>Tuning notes<textarea rows={3} maxLength={4000} value={liveOps.tuningNotes} disabled={!canEdit} placeholder="Thay đổi cân bằng hoặc vận hành sẽ lên live…" onChange={(event) => change({ tuningNotes: event.target.value })} /></label><label>Version / build<input maxLength={4000} value={liveOps.version} disabled={!canEdit} placeholder="Ví dụ: 1.4.0" onChange={(event) => change({ version: event.target.value })} /></label><label>Feature flag<input maxLength={4000} value={liveOps.featureFlag} disabled={!canEdit} placeholder="Ví dụ: dash_cooldown_v2" onChange={(event) => change({ featureFlag: event.target.value })} /></label><label>Rollout (%)<input inputMode="numeric" maxLength={3} value={liveOps.rolloutPercent} disabled={!canEdit} placeholder="0–100" onChange={(event) => change({ rolloutPercent: event.target.value })} /></label><label>Audience / segment<input maxLength={4000} value={liveOps.audience} disabled={!canEdit} placeholder="Ví dụ: Người chơi mới" onChange={(event) => change({ audience: event.target.value })} /></label><label>Trạng thái<select value={liveOps.status} disabled={!canEdit} onChange={(event) => change({ status: event.target.value })}><option value="planned">Planned</option><option value="running">Running</option><option value="paused">Paused</option><option value="full">Full rollout</option><option value="rolled-back">Rolled back</option></select></label><label>Rollback plan<textarea rows={2} maxLength={4000} value={liveOps.rollbackPlan} disabled={!canEdit} placeholder="Điều kiện dừng và cách quay lại an toàn…" onChange={(event) => change({ rollbackPlan: event.target.value })} /></label></div>}
  </section>;
}

function PostLaunchReviewSection({ review, nodes, canEdit, collapsed, onToggle, onChange }) {
  const change = (patch) => onChange({ ...review, ...patch });
  return <section className="gd-detail-section gd-post-launch-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Post-launch review</button></div>
    {!collapsed && <div className="gd-detail-list"><label>Outcome<textarea rows={2} maxLength={4000} value={review.outcome} disabled={!canEdit} placeholder="Kết quả tổng quan sau phát hành…" onChange={(event) => change({ outcome: event.target.value })} /></label><label>Actual metrics<textarea rows={2} maxLength={4000} value={review.actualMetrics} disabled={!canEdit} placeholder="Kết quả metric thực tế, guardrail, lỗi…" onChange={(event) => change({ actualMetrics: event.target.value })} /></label><label>Learnings<textarea rows={2} maxLength={4000} value={review.learnings} disabled={!canEdit} placeholder="Điều team học được…" onChange={(event) => change({ learnings: event.target.value })} /></label><label>Next decision<textarea rows={2} maxLength={4000} value={review.nextDecision} disabled={!canEdit} placeholder="Giữ, tune tiếp, rollback hay sunset…" onChange={(event) => change({ nextDecision: event.target.value })} /></label><label>Owner<input maxLength={4000} value={review.owner} disabled={!canEdit} onChange={(event) => change({ owner: event.target.value })} /></label><label>Ngày review<input type="date" value={review.reviewDate} disabled={!canEdit} onChange={(event) => change({ reviewDate: event.target.value })} /></label><label>Trạng thái<select value={review.status} disabled={!canEdit} onChange={(event) => change({ status: event.target.value })}><option value="pending">Pending</option><option value="healthy">Healthy</option><option value="needs-iteration">Needs iteration</option><option value="sunset">Sunset</option></select></label><RelatedCards value={review.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => change({ cardIds })} label="Thẻ liên quan" /></div>}
  </section>;
}

function newFollowUpTask() { return { id: globalThis.crypto?.randomUUID?.() || `follow-up-${Date.now()}`, text: "", owner: "", deadline: "", done: false, cardIds: [] }; }
function FollowUpSection({ tasks, nodes, canEdit, collapsed, onToggle, onChange }) {
  const replace = (id, patch) => onChange(tasks.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="gd-detail-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Follow-up tasks <span>{tasks.filter((task) => !task.done).length}</span></button>{canEdit && <button className="btn ghost gd-detail-add" type="button" disabled={tasks.length >= 20} onClick={() => onChange([...tasks, newFollowUpTask()])}>+ Thêm việc</button>}</div>
    {!collapsed && <div className="gd-detail-list">{tasks.length === 0 && <p className="gd-detail-empty">Chưa có việc follow-up.</p>}{tasks.map((task, index) => <article className="gd-detail-item" key={task.id}><div className="gd-detail-item-head"><strong>Việc {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => onChange(tasks.filter((item) => item.id !== task.id))}>Xóa</button>}</div><label className="gd-review-resolved"><input type="checkbox" checked={task.done} disabled={!canEdit} onChange={(event) => replace(task.id, { done: event.target.checked })} /> Hoàn thành</label><label>Công việc<input maxLength={4000} value={task.text} disabled={!canEdit} onChange={(event) => replace(task.id, { text: event.target.value })} /></label><label>Owner<input maxLength={4000} value={task.owner} disabled={!canEdit} onChange={(event) => replace(task.id, { owner: event.target.value })} /></label><label>Deadline<input type="date" value={task.deadline} disabled={!canEdit} onChange={(event) => replace(task.id, { deadline: event.target.value })} /></label><RelatedCards value={task.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => replace(task.id, { cardIds })} label="Thẻ liên quan" /></article>)}</div>}
  </section>;
}

function BalanceLinksSection({ balance, node, nodes, collapsed, onToggle, onOpenBalance }) {
  const metrics = balanceMetricsForCard(balance, node.id, nodes);
  const vars = Object.fromEntries((balance?.metrics || []).map((item) => [item.key, item.value]));
  return <section className="gd-detail-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Balance links <span>{metrics.length}</span></button>{<button type="button" className="btn ghost gd-detail-add" onClick={onOpenBalance}>Mở Balance</button>}</div>
    {!collapsed && <div className="gd-detail-list">{metrics.length === 0 ? <p className="gd-detail-empty">Chưa có chỉ số Balance liên kết với card này.</p> : metrics.map((metric) => { const result = metric.formula ? evaluateBalanceFormula(metric.formula, vars) : { value: metric.value, error: "" }; return <div className="gd-balance-card-link" key={metric.id}><strong>{metric.name}</strong><span>{result.error ? "Lỗi công thức" : `${result.value ?? "—"}${metric.unit ? ` ${metric.unit}` : ""}`}</span><code>{metric.key}</code></div>; })}</div>}
  </section>;
}

export default function GameDesignPanel({ node, nodes, balance, canEdit, onSave, onClose, onOpenBalance, onCreateRelated, onDuplicate, outsideRef }) {
  const [title, setTitle] = useState(node.title);
  const [desc, setDesc] = useState(node.desc || "");
  const [design, setDesign] = useState({ ...(node.design || {}) });
  const [criteria, setCriteria] = useState(() => normalizeAcceptanceCriteria(node.design?.acceptanceCriteria));
  const [details, setDetails] = useState(() => normalizeGameDesignDetails(node.design));
  const [playtestSession, setPlaytestSession] = useState(() => normalizePlaytestSession(node.design?.playtestSession, nodes));
  const [decisionLog, setDecisionLog] = useState(() => normalizeDecisionLog(node.design?.decisionLog, nodes));
  const [teamHandoff, setTeamHandoff] = useState(() => normalizeTeamHandoff(node.design?.teamHandoff));
  const [review, setReview] = useState(() => normalizeReview(node.design?.review));
  const [delivery, setDelivery] = useState(() => normalizeDelivery(node.design?.delivery));
  const [analyticsEvents, setAnalyticsEvents] = useState(() => normalizeAnalyticsEvents(node.design?.analyticsEvents));
  const [abTests, setABTests] = useState(() => normalizeABTests(node.design?.abTests));
  const [liveOps, setLiveOps] = useState(() => normalizeLiveOps(node.design?.liveOps));
  const [postLaunchReview, setPostLaunchReview] = useState(() => normalizePostLaunchReview(node.design?.postLaunchReview, nodes));
  const [followUpTasks, setFollowUpTasks] = useState(() => normalizeFollowUpTasks(node.design?.followUpTasks, nodes));
  const [relatedType, setRelatedType] = useState("mechanic"); const [relatedRelation, setRelatedRelation] = useState("depends-on");
  const [collapsedDetails, setCollapsedDetails] = useState({ examples: true, failureStates: true, tuningParameters: true, playtest: true, decisions: true, handoff: true, review: true, delivery: true, analytics: true, abTests: true, liveOps: true, postLaunch: true, followUps: true, balanceLinks: true });
  const [dirty, setDirty] = useState(false);
  const panelRef = useRef(null);
  const template = gameDesignType(node.type);

  useEffect(() => {
    setTitle(node.title); setDesc(node.desc || ""); setDesign({ ...(node.design || {}) });
    setCriteria(normalizeAcceptanceCriteria(node.design?.acceptanceCriteria)); setDetails(normalizeGameDesignDetails(node.design)); setPlaytestSession(normalizePlaytestSession(node.design?.playtestSession, nodes)); setDecisionLog(normalizeDecisionLog(node.design?.decisionLog, nodes)); setTeamHandoff(normalizeTeamHandoff(node.design?.teamHandoff)); setReview(normalizeReview(node.design?.review)); setDelivery(normalizeDelivery(node.design?.delivery)); setAnalyticsEvents(normalizeAnalyticsEvents(node.design?.analyticsEvents)); setABTests(normalizeABTests(node.design?.abTests)); setLiveOps(normalizeLiveOps(node.design?.liveOps)); setPostLaunchReview(normalizePostLaunchReview(node.design?.postLaunchReview, nodes)); setFollowUpTasks(normalizeFollowUpTasks(node.design?.followUpTasks, nodes)); setDirty(false);
  }, [node.id, nodes]);

  function save() {
    const nextCriteria = criteria.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() }));
    onSave({ ...node, title: title.trim() || template.label, desc: desc.trim(), design: { ...node.design, ...design, technicalNotes: normalizeTechnicalNotes(design.technicalNotes), acceptanceCriteria: nextCriteria, ...normalizeGameDesignDetails(details), playtestSession: normalizePlaytestSession(playtestSession, nodes), decisionLog: normalizeDecisionLog(decisionLog, nodes), teamHandoff: normalizeTeamHandoff(teamHandoff), review: normalizeReview(review), delivery: normalizeDelivery(delivery), analyticsEvents: normalizeAnalyticsEvents(analyticsEvents), abTests: normalizeABTests(abTests), liveOps: normalizeLiveOps(liveOps), postLaunchReview: normalizePostLaunchReview(postLaunchReview, nodes), followUpTasks: normalizeFollowUpTasks(followUpTasks, nodes) } });
    setDirty(false);
  }

  // Bấm ra ngoài phải trả lại không gian cho canvas. Nhưng form có dữ liệu cục
  // bộ trước nút Lưu; đóng thẳng sẽ làm mất bài âm thầm. Vì vậy nếu đang sửa,
  // chốt thay đổi trước rồi mới thu inspector.
  function closeFromOutside() {
    if (dirty && canEdit) save();
    onClose();
  }
  useCloseOnOutside(outsideRef || panelRef, closeFromOutside);

  return (
    <div className="gd-panel" ref={panelRef}>
      <div className="gd-panel-head"><div><span className="gd-kicker">{template.label}</span><h2>Chi tiết thiết kế</h2></div><button className="btn ghost icon" onClick={onClose}>×</button></div>
      <label>Tên thẻ<input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} disabled={!canEdit} /></label>
      <label>Tóm tắt<textarea value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true); }} disabled={!canEdit} rows={2} /></label>
      {template.fields.map((field) => (
        <label key={field}>{DESIGN_FIELD_LABELS[field]}
          {field === "priority" ? (
            <select value={design[field] || "medium"} onChange={(e) => { setDesign((p) => ({ ...p, [field]: e.target.value })); setDirty(true); }} disabled={!canEdit}>
              <option value="low">Thấp</option><option value="medium">Vừa</option><option value="high">Cao</option>
            </select>
          ) : field === "acceptanceCriteria" ? (
            <div className="gd-criteria">
              {criteria.map((item, index) => (
                <div className="gd-criterion-row" key={item.id}>
                  <input
                    className="gd-criterion-toggle"
                    type="checkbox"
                    checked={item.done}
                    disabled={!canEdit}
                    aria-label={`Hoàn thành tiêu chí: ${item.text || `dòng ${index + 1}`}`}
                    onChange={(e) => { setCriteria((prev) => prev.map((criterion) => criterion.id === item.id ? { ...criterion, done: e.target.checked } : criterion)); setDirty(true); }}
                  />
                  <input
                    className="gd-criterion-text"
                    value={item.text}
                    placeholder="Tiêu chí nghiệm thu"
                    disabled={!canEdit}
                    onChange={(e) => { setCriteria((prev) => prev.map((criterion) => criterion.id === item.id ? { ...criterion, text: e.target.value } : criterion)); setDirty(true); }}
                  />
                  <button className="gd-criterion-remove danger" type="button" disabled={!canEdit} onClick={() => { setCriteria((prev) => prev.filter((criterion) => criterion.id !== item.id)); setDirty(true); }}>Xóa</button>
                </div>
              ))}
              {canEdit && <button className="btn ghost gd-add-criterion" type="button" onClick={() => { setCriteria((prev) => [...prev, { id: `ac-${Date.now()}-${prev.length + 1}`, text: "", done: false }]); setDirty(true); }}>+ Thêm tiêu chí</button>}
            </div>
          ) : <textarea rows={2} value={design[field] || ""} onChange={(e) => { setDesign((p) => ({ ...p, [field]: e.target.value })); setDirty(true); }} disabled={!canEdit} />}
        </label>
      ))}
      <label>Technical notes cho dev
        <textarea rows={3} maxLength={2000} value={design.technicalNotes || ""} disabled={!canEdit} placeholder="Ràng buộc kỹ thuật, event cần track, lưu ý triển khai…" onChange={(e) => { setDesign((p) => ({ ...p, technicalNotes: e.target.value })); setDirty(true); }} />
      </label>
      <label>Trải nghiệm người chơi / cảm xúc mong muốn
        <textarea rows={2} maxLength={2000} value={design.playerExperience || ""} disabled={!canEdit} placeholder="Ví dụ: Căng thẳng nhưng công bằng; cảm giác làm chủ khi né đúng lúc…" onChange={(e) => { setDesign((p) => ({ ...p, playerExperience: e.target.value })); setDirty(true); }} />
      </label>
      <div className="gd-details">
        {canEdit && <section className="gd-detail-section"><div className="gd-detail-section-head"><strong className="gd-detail-collapse">Biến thể card</strong></div><div className="gd-detail-list"><p className="gd-detail-empty">Sao chép toàn bộ spec để thử phương án khác. Bản sao không giữ status hoặc dây nối.</p><button className="btn ghost" type="button" onClick={onDuplicate}>Nhân bản thẻ</button></div></section>}
        {canEdit && <section className="gd-detail-section"><div className="gd-detail-section-head"><strong className="gd-detail-collapse">Tạo card liên quan</strong></div><div className="gd-detail-list"><label>Loại card<select value={relatedType} onChange={(event) => setRelatedType(event.target.value)}><option value="mechanic">Mechanic</option><option value="ui-ux">UI / UX</option><option value="quest-level">Quest / Level</option><option value="playtest">Playtest</option></select></label><label>Quan hệ<select value={relatedRelation} onChange={(event) => setRelatedRelation(event.target.value)}><option value="depends-on">Phụ thuộc</option><option value="unlocks">Mở khóa</option><option value="replaces">Thay thế</option></select></label><button className="btn ghost" type="button" onClick={() => onCreateRelated(relatedType, relatedRelation)}>+ Tạo & nối</button></div></section>}
        {DETAIL_SECTIONS.map((section) => <DetailSection key={section.key} section={section} items={details[section.key]} canEdit={canEdit} collapsed={collapsedDetails[section.key]} onToggle={() => setCollapsedDetails((current) => ({ ...current, [section.key]: !current[section.key] }))} onAdd={(item) => { setDetails((current) => ({ ...current, [section.key]: [...current[section.key], item] })); setCollapsedDetails((current) => ({ ...current, [section.key]: false })); setDirty(true); }} onChange={(items) => { setDetails((current) => ({ ...current, [section.key]: items })); setDirty(true); }} />)}
        {node.type === "playtest" && <PlaytestSection session={playtestSession} nodes={nodes.filter((item) => item.id !== node.id)} canEdit={canEdit} collapsed={collapsedDetails.playtest} onToggle={() => setCollapsedDetails((current) => ({ ...current, playtest: !current.playtest }))} onChange={(value) => { setPlaytestSession(value); setDirty(true); }} />}
        <DecisionLogSection decisions={decisionLog} nodes={nodes.filter((item) => item.id !== node.id)} canEdit={canEdit} collapsed={collapsedDetails.decisions} onToggle={() => setCollapsedDetails((current) => ({ ...current, decisions: !current.decisions }))} onChange={(value) => { setDecisionLog(value); setDirty(true); }} />
        <TeamHandoffSection handoff={teamHandoff} canEdit={canEdit} collapsed={collapsedDetails.handoff} onToggle={() => setCollapsedDetails((current) => ({ ...current, handoff: !current.handoff }))} onChange={(value) => { setTeamHandoff(value); setDirty(true); }} />
        <ReviewSection review={review} canEdit={canEdit} collapsed={collapsedDetails.review} onToggle={() => setCollapsedDetails((current) => ({ ...current, review: !current.review }))} onChange={(value) => { setReview(value); setDirty(true); }} />
        <DeliverySection delivery={delivery} canEdit={canEdit} collapsed={collapsedDetails.delivery} onToggle={() => setCollapsedDetails((current) => ({ ...current, delivery: !current.delivery }))} onChange={(value) => { setDelivery(value); setDirty(true); }} />
        <AnalyticsSection events={analyticsEvents} canEdit={canEdit} collapsed={collapsedDetails.analytics} onToggle={() => setCollapsedDetails((current) => ({ ...current, analytics: !current.analytics }))} onChange={(value) => { setAnalyticsEvents(value); setDirty(true); }} />
        <ABTestsSection tests={abTests} canEdit={canEdit} collapsed={collapsedDetails.abTests} onToggle={() => setCollapsedDetails((current) => ({ ...current, abTests: !current.abTests }))} onChange={(value) => { setABTests(value); setDirty(true); }} />
        <LiveOpsSection liveOps={liveOps} canEdit={canEdit} collapsed={collapsedDetails.liveOps} onToggle={() => setCollapsedDetails((current) => ({ ...current, liveOps: !current.liveOps }))} onChange={(value) => { setLiveOps(value); setDirty(true); }} />
        <PostLaunchReviewSection review={postLaunchReview} nodes={nodes.filter((item) => item.id !== node.id)} canEdit={canEdit} collapsed={collapsedDetails.postLaunch} onToggle={() => setCollapsedDetails((current) => ({ ...current, postLaunch: !current.postLaunch }))} onChange={(value) => { setPostLaunchReview(value); setDirty(true); }} />
        <FollowUpSection tasks={followUpTasks} nodes={nodes.filter((item) => item.id !== node.id)} canEdit={canEdit} collapsed={collapsedDetails.followUps} onToggle={() => setCollapsedDetails((current) => ({ ...current, followUps: !current.followUps }))} onChange={(value) => { setFollowUpTasks(value); setDirty(true); }} />
        <BalanceLinksSection balance={balance} node={node} nodes={nodes} collapsed={collapsedDetails.balanceLinks} onToggle={() => setCollapsedDetails((current) => ({ ...current, balanceLinks: !current.balanceLinks }))} onOpenBalance={onOpenBalance} />
      </div>
      {canEdit && <button className="btn gd-save" onClick={save}>Lưu chi tiết</button>}
    </div>
  );
}
