import { useMemo, useRef } from "react";
import { decisionTimeline } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

const STATUS_LABELS = { active: "Đang áp dụng", replaced: "Đã thay thế" };

export default function DecisionTimelinePanel({ nodes, onOpenCard, onClose, outsideRef }) {
  const panelRef = useRef(null);
  const items = useMemo(() => decisionTimeline(nodes), [nodes]);
  useCloseOnOutside(outsideRef || panelRef, onClose);
  return <section className="gd-panel gd-timeline-panel" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
    <div className="gd-panel-head"><div><span className="gd-kicker">Decision history</span><h2>Decisions</h2></div><button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Decisions">×</button></div>
    <p className="gd-handoff-help">Tổng hợp quyết định từ tất cả card, mới nhất ở trên. Bấm card nguồn để mở spec.</p>
    <div className="gd-timeline-list">
      {items.length === 0 && <p className="gd-detail-empty">Chưa có quyết định nào được ghi lại trên board này.</p>}
      {items.map((item) => <article className="gd-timeline-item" key={`${item.cardId}-${item.decisionId}`}>
        <div className="gd-timeline-meta"><span>{item.date || "Chưa có ngày"}</span><span className={`gd-timeline-status status-${item.status}`}>{STATUS_LABELS[item.status]}</span></div>
        <strong>{item.decision}</strong>
        {item.owner && <span className="gd-timeline-owner">Quyết định bởi {item.owner}</span>}
        {item.rationale && <p><b>Lý do:</b> {item.rationale}</p>}
        {item.evidence && <p><b>Evidence:</b> {item.evidence}</p>}
        <button className="btn ghost gd-timeline-card" type="button" onClick={() => onOpenCard(Number(item.cardId))}>Mở: {item.cardTitle}</button>
      </article>)}
    </div>
  </section>;
}
