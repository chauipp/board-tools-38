import { balanceMetricsForCard, evaluateBalanceFormula } from "../../../lib/game-design.js";

export function BalanceLinksSection({ balance, node, nodes, collapsed, onToggle, onOpenBalance }) {
  const metrics = balanceMetricsForCard(balance, node.id, nodes);
  const vars = Object.fromEntries((balance?.metrics || []).map((item) => [item.key, item.value]));
  return <section className="gd-detail-section"><div className="gd-detail-section-head"><button className="gd-detail-collapse" type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} Balance links <span>{metrics.length}</span></button>{<button type="button" className="btn ghost gd-detail-add" onClick={onOpenBalance}>Mở Balance</button>}</div>
    {!collapsed && <div className="gd-detail-list">{metrics.length === 0 ? <p className="gd-detail-empty">Chưa có chỉ số Balance liên kết với card này.</p> : metrics.map((metric) => { const result = metric.formula ? evaluateBalanceFormula(metric.formula, vars) : { value: metric.value, error: "" }; return <div className="gd-balance-card-link" key={metric.id}><strong>{metric.name}</strong><span>{result.error ? "Lỗi công thức" : `${result.value ?? "—"}${metric.unit ? ` ${metric.unit}` : ""}`}</span><code>{metric.key}</code></div>; })}</div>}
  </section>;
}
