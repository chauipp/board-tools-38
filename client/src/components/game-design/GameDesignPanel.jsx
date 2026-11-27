import { useEffect, useRef, useState } from "react";
import { DESIGN_FIELD_LABELS, emptyReview, gameDesignType, normalizeABTests, normalizeAcceptanceCriteria, normalizeAnalyticsEvents, normalizeDecisionLog, normalizeDelivery, normalizeFollowUpTasks, normalizeGameDesignDetails, normalizeLiveOps, normalizePlaytestSession, normalizePostLaunchReview, normalizeReview, normalizeTeamHandoff, normalizeTechnicalNotes } from "../../lib/game-design.js";
import { useCloseOnOutside } from "../../lib/useCloseOnOutside.js";
import { DETAIL_SECTIONS, DetailSection } from "./sections/DetailSection.jsx";
import { PlaytestSection } from "./sections/PlaytestSection.jsx";
import { DecisionLogSection } from "./sections/DecisionLogSection.jsx";
import { TeamHandoffSection } from "./sections/TeamHandoffSection.jsx";
import { ReviewSection } from "./sections/ReviewSection.jsx";
import { DeliverySection } from "./sections/DeliverySection.jsx";
import { AnalyticsSection } from "./sections/AnalyticsSection.jsx";
import { ABTestsSection } from "./sections/ABTestsSection.jsx";
import { LiveOpsSection } from "./sections/LiveOpsSection.jsx";
import { PostLaunchReviewSection } from "./sections/PostLaunchReviewSection.jsx";
import { FollowUpSection } from "./sections/FollowUpSection.jsx";
import { BalanceLinksSection } from "./sections/BalanceLinksSection.jsx";

export default function GameDesignPanel({ node, nodes, balance, canEdit, onSave, onClose, onOpenBalance, onOpenImpact, onCreateRelated, onDuplicate, outsideRef }) {
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
      <div className="gd-panel-head"><div><span className="gd-kicker">{template.label}</span><h2>Chi tiết thiết kế</h2></div><div className="gd-panel-actions">{onOpenImpact && <button className="btn ghost" type="button" onClick={onOpenImpact}>Impact</button>}<button className="btn ghost icon" onClick={onClose}>×</button></div></div>
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
