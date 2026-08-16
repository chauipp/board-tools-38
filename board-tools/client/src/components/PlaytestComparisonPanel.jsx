import { playtestComparison } from "../lib/game-design.js";

export default function PlaytestComparisonPanel({ nodes, onOpenCard, onClose, outsideRef }) {
  const rows = playtestComparison(nodes);
  return <section className="gd-panel gd-insights-panel" ref={outsideRef}><div className="gd-panel-head"><div><span className="gd-kicker">Research</span><h2>Playtest comparison</h2></div><button className="btn ghost icon" type="button" onClick={onClose}>×</button></div>
    {rows.length === 0 ? <p className="gd-help">Chưa có playtest session có dữ liệu.</p> : rows.map((row) => <article className="gd-insight-list" key={row.nodeId}><button className="gd-insight-item" type="button" onClick={() => onOpenCard(row.nodeId)}><strong>{row.title}</strong><span>{[row.testDate, row.buildVersion, row.playerGroup].filter(Boolean).join(" · ") || "Chưa có metadata"}</span></button>{[["Objective", row.objective], ["Hypothesis", row.hypothesis], ["Metrics", row.metrics], ["Observations", row.observations], ["Problems", row.problemsFound], ["Feedback", row.playerFeedback]].filter(([, value]) => value).map(([label, value]) => <p className="gd-help" key={label}><strong>{label}:</strong> {value}</p>)}</article>)}
  </section>;
}
