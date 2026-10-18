import { useEffect, useMemo, useState } from "react";
import { dependencyImpact, normalizeDelivery } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

function cardTitle(node) { return node?.title || `Thẻ ${node?.id}`; }

export default function GameDesignImpactPanel({ board, initialCardId, onOpenCard, onClose, outsideRef }) {
  const nodes = Array.isArray(board?.nodes) ? board.nodes : [];
  const [cardId, setCardId] = useState(() => String(initialCardId ?? nodes[0]?.id ?? ""));
  useEffect(() => { setCardId(String(initialCardId ?? nodes[0]?.id ?? "")); }, [initialCardId, nodes]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [String(node.id), node])), [nodes]);
  const impact = useMemo(() => dependencyImpact(board, cardId), [board, cardId]);
  const open = (id) => onOpenCard(nodeById.get(String(id))?.id);
  return <section className="gd-panel gd-impact-panel" ref={outsideRef} aria-label="Dependency impact map">
    <div className="gd-panel-head"><div><span className="gd-kicker">Dependency map</span><h2>Impact</h2></div><button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Impact">×</button></div>
    <p className="gd-handoff-help">Xem thay đổi của một card sẽ chạm tới những card và milestone nào. Chỉ phân tích relation <code>depends-on</code>.</p>
    <label>Card đang phân tích<select value={cardId} onChange={(event) => setCardId(event.target.value)}>{nodes.map((node) => <option key={node.id} value={String(node.id)}>{cardTitle(node)}</option>)}</select></label>
    {!nodes.length ? <p className="gd-help">Chưa có card để phân tích.</p> : <>
      <div className="gd-insight-grid gd-impact-summary"><div><strong>{impact.upstreamIds.length}</strong><span>Prerequisites</span></div><div><strong>{impact.downstreamIds.length}</strong><span>Downstream</span></div><div><strong>{impact.milestoneIds.length}</strong><span>Milestones</span></div><div><strong>{impact.riskIds.length}</strong><span>At risk</span></div></div>
      {impact.hasCycle && <p className="gd-balance-warning">⚠ Card này nằm trong dependency cycle; hãy phá vòng lặp trước khi chốt scope.</p>}
      <ImpactList title="Cần có trước" empty="Không có prerequisite trực tiếp hoặc gián tiếp." ids={impact.upstreamIds} nodeById={nodeById} onOpen={open} />
      <ImpactList title="Bị ảnh hưởng downstream" empty="Không có card downstream bị ảnh hưởng." ids={impact.downstreamIds} nodeById={nodeById} onOpen={open} />
      <ImpactList title="Milestone bị ảnh hưởng" empty="Không có milestone downstream." ids={impact.milestoneIds} nodeById={nodeById} onOpen={open} detail={(node) => normalizeDelivery(node.design?.delivery).milestone} />
      <ImpactList title="Delivery risk" empty="Không có blocker, risk hay deadline quá hạn downstream." ids={impact.riskIds} nodeById={nodeById} onOpen={open} detail={(node) => { const delivery = normalizeDelivery(node.design?.delivery); return delivery.blocker || (delivery.deadline ? `Deadline ${delivery.deadline}` : "Blocked dependency"); }} />
    </>}
  </section>;
}

function ImpactList({ title, empty, ids, nodeById, onOpen, detail }) {
  return <section className="gd-insight-list"><h3>{title}</h3>{ids.length === 0 ? <p className="gd-help">{empty}</p> : ids.map((id) => { const node = nodeById.get(id); return <button className="gd-insight-item" key={id} type="button" onClick={() => onOpen(id)}><strong>{cardTitle(node)}</strong>{detail && <span>{detail(node)}</span>}</button>; })}</section>;
}
