import { useEffect, useRef, useState } from "react";
import {
  gameDesignType, normalizeABTests, normalizeAcceptanceCriteria, normalizeAnalyticsEvents, normalizeDecisionLog,
  normalizeDelivery, normalizeFollowUpTasks, normalizeGameDesignDetails, normalizeLiveOps, normalizePlaytestSession,
  normalizePostLaunchReview, normalizeReview, normalizeTeamHandoff, normalizeTechnicalNotes
} from "../../lib/game-design.js";
import { useCloseOnOutside } from "../../lib/useCloseOnOutside.js";
import { SpecSection } from "./sections/SpecSection.jsx";
import { CardVariantSection, RelatedCardSection } from "./sections/CardActionSections.jsx";
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

const ALL_COLLAPSED = {
  examples: true, failureStates: true, tuningParameters: true, playtest: true, decisions: true, handoff: true, review: true,
  delivery: true, analytics: true, abTests: true, liveOps: true, postLaunch: true, followUps: true, balanceLinks: true
};

export default function GameDesignPanel({
  node, nodes, balance, canEdit, onSave, onClose, onOpenBalance, onOpenImpact, onCreateRelated, onDuplicate, outsideRef
}) {
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
  const [relatedType, setRelatedType] = useState("mechanic");
  const [relatedRelation, setRelatedRelation] = useState("depends-on");
  const [collapsedDetails, setCollapsedDetails] = useState(ALL_COLLAPSED);
  const [dirty, setDirty] = useState(false);
  const panelRef = useRef(null);
  const template = gameDesignType(node.type);

  useEffect(() => {
    setTitle(node.title);
    setDesc(node.desc || "");
    setDesign({ ...(node.design || {}) });
    setCriteria(normalizeAcceptanceCriteria(node.design?.acceptanceCriteria));
    setDetails(normalizeGameDesignDetails(node.design));
    setPlaytestSession(normalizePlaytestSession(node.design?.playtestSession, nodes));
    setDecisionLog(normalizeDecisionLog(node.design?.decisionLog, nodes));
    setTeamHandoff(normalizeTeamHandoff(node.design?.teamHandoff));
    setReview(normalizeReview(node.design?.review));
    setDelivery(normalizeDelivery(node.design?.delivery));
    setAnalyticsEvents(normalizeAnalyticsEvents(node.design?.analyticsEvents));
    setABTests(normalizeABTests(node.design?.abTests));
    setLiveOps(normalizeLiveOps(node.design?.liveOps));
    setPostLaunchReview(normalizePostLaunchReview(node.design?.postLaunchReview, nodes));
    setFollowUpTasks(normalizeFollowUpTasks(node.design?.followUpTasks, nodes));
    setDirty(false);
  }, [node.id, nodes]);

  function save() {
    const nextCriteria = criteria.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() }));
    onSave({
      ...node,
      title: title.trim() || template.label,
      desc: desc.trim(),
      design: {
        ...node.design,
        ...design,
        technicalNotes: normalizeTechnicalNotes(design.technicalNotes),
        acceptanceCriteria: nextCriteria,
        ...normalizeGameDesignDetails(details),
        playtestSession: normalizePlaytestSession(playtestSession, nodes),
        decisionLog: normalizeDecisionLog(decisionLog, nodes),
        teamHandoff: normalizeTeamHandoff(teamHandoff),
        review: normalizeReview(review),
        delivery: normalizeDelivery(delivery),
        analyticsEvents: normalizeAnalyticsEvents(analyticsEvents),
        abTests: normalizeABTests(abTests),
        liveOps: normalizeLiveOps(liveOps),
        postLaunchReview: normalizePostLaunchReview(postLaunchReview, nodes),
        followUpTasks: normalizeFollowUpTasks(followUpTasks, nodes)
      }
    });
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

  // Mọi sửa đổi trong form đều đánh dấu dirty để closeFromOutside biết cần lưu.
  const edited = (setter) => (value) => { setter(value); setDirty(true); };
  const sectionProps = (key, setter) => ({
    canEdit,
    collapsed: collapsedDetails[key],
    onToggle: () => setCollapsedDetails((current) => ({ ...current, [key]: !current[key] })),
    onChange: edited(setter)
  });
  const otherNodes = nodes.filter((item) => item.id !== node.id);

  return (
    <div className="gd-panel" ref={panelRef}>
      <div className="gd-panel-head">
        <div><span className="gd-kicker">{template.label}</span><h2>Chi tiết thiết kế</h2></div>
        <div className="gd-panel-actions">
          {onOpenImpact && <button className="btn ghost" type="button" onClick={onOpenImpact}>Impact</button>}
          <button className="btn ghost icon" onClick={onClose}>×</button>
        </div>
      </div>
      <label>Tên thẻ<input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} disabled={!canEdit} /></label>
      <label>Tóm tắt<textarea value={desc} onChange={(e) => { setDesc(e.target.value); setDirty(true); }} disabled={!canEdit} rows={2} /></label>
      <SpecSection
        template={template}
        design={design}
        criteria={criteria}
        canEdit={canEdit}
        onDesignChange={edited(setDesign)}
        onCriteriaChange={edited(setCriteria)}
      />
      <div className="gd-details">
        {canEdit && <CardVariantSection onDuplicate={onDuplicate} />}
        {canEdit && (
          <RelatedCardSection
            relatedType={relatedType}
            relatedRelation={relatedRelation}
            setRelatedType={setRelatedType}
            setRelatedRelation={setRelatedRelation}
            onCreateRelated={onCreateRelated}
          />
        )}
        {DETAIL_SECTIONS.map((section) => (
          <DetailSection
            key={section.key}
            section={section}
            items={details[section.key]}
            {...sectionProps(section.key, (items) => setDetails((current) => ({ ...current, [section.key]: items })))}
            onAdd={(item) => {
              setDetails((current) => ({ ...current, [section.key]: [...current[section.key], item] }));
              setCollapsedDetails((current) => ({ ...current, [section.key]: false }));
              setDirty(true);
            }}
          />
        ))}
        {node.type === "playtest" && <PlaytestSection session={playtestSession} nodes={otherNodes} {...sectionProps("playtest", setPlaytestSession)} />}
        <DecisionLogSection decisions={decisionLog} nodes={otherNodes} {...sectionProps("decisions", setDecisionLog)} />
        <TeamHandoffSection handoff={teamHandoff} {...sectionProps("handoff", setTeamHandoff)} />
        <ReviewSection review={review} {...sectionProps("review", setReview)} />
        <DeliverySection delivery={delivery} {...sectionProps("delivery", setDelivery)} />
        <AnalyticsSection events={analyticsEvents} {...sectionProps("analytics", setAnalyticsEvents)} />
        <ABTestsSection tests={abTests} {...sectionProps("abTests", setABTests)} />
        <LiveOpsSection liveOps={liveOps} {...sectionProps("liveOps", setLiveOps)} />
        <PostLaunchReviewSection review={postLaunchReview} nodes={otherNodes} {...sectionProps("postLaunch", setPostLaunchReview)} />
        <FollowUpSection tasks={followUpTasks} nodes={otherNodes} {...sectionProps("followUps", setFollowUpTasks)} />
        <BalanceLinksSection
          balance={balance}
          node={node}
          nodes={nodes}
          collapsed={collapsedDetails.balanceLinks}
          onToggle={() => setCollapsedDetails((current) => ({ ...current, balanceLinks: !current.balanceLinks }))}
          onOpenBalance={onOpenBalance}
        />
      </div>
      {canEdit && <button className="btn gd-save" onClick={save}>Lưu chi tiết</button>}
    </div>
  );
}
