import { useEffect, useRef, useState } from "react";
import { BALANCE_TEMPLATES, appendBalanceTemplate, balanceCurveTable, balanceHealth, balanceWarnings, evaluateBalanceFormula, normalizeGameDesignBalance } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

function newMetric() { return { id: globalThis.crypto?.randomUUID?.() || `metric-${Date.now()}`, key: "", name: "", value: "", min: "", max: "", unit: "", formula: "", cardIds: [] }; }
function newCurve(metrics) { return { id: globalThis.crypto?.randomUUID?.() || `curve-${Date.now()}`, name: "Level progression", metricKey: metrics[0]?.key || "", start: "1", end: "10", steps: 10, mode: "linear" }; }

export default function GameDesignBalancePanel({ balance, nodes, canEdit, onSave, onClose, outsideRef }) {
  const [local, setLocal] = useState(() => normalizeGameDesignBalance(balance, nodes));
  const [dirty, setDirty] = useState(false); const panelRef = useRef(null);
  useEffect(() => { setLocal(normalizeGameDesignBalance(balance, nodes)); setDirty(false); }, [balance, nodes]);
  const vars = Object.fromEntries(local.metrics.map((item) => [item.key, item.value]));
  const health = balanceHealth(local, nodes);
  const change = (id, patch) => { setLocal((current) => ({ ...current, metrics: current.metrics.map((item) => item.id === id ? { ...item, ...patch } : item) })); setDirty(true); };
  const changeCurve = (id, patch) => { setLocal((current) => ({ ...current, curves: current.curves.map((item) => item.id === id ? { ...item, ...patch } : item) })); setDirty(true); };
  const save = () => { onSave(normalizeGameDesignBalance(local, nodes)); setDirty(false); };
  const close = () => { if (dirty && canEdit) save(); onClose(); };
  useCloseOnOutside(outsideRef || panelRef, close);
  return <section className="gd-balance-panel" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
    <div className="gd-panel-head"><div><span className="gd-kicker">Balance & progression</span><h2>Balance sheet</h2></div><button className="btn ghost icon" type="button" onClick={onClose}>×</button></div>
    <p className="gd-handoff-help">Công thức nhận số, key và + − × ÷. Ví dụ: <code>damage * 1.2</code>.</p>
    {health.length > 0 && <section className="gd-balance-health"><strong>Balance health</strong>{health.map((warning) => <p className="gd-balance-warning" key={warning}>⚠ {warning}</p>)}</section>}
    {canEdit && <div className="gd-balance-templates"><span>Template nhanh</span>{BALANCE_TEMPLATES.map((template) => <button className="btn ghost" type="button" key={template.id} onClick={() => { setLocal((current) => appendBalanceTemplate(current, template.id, nodes)); setDirty(true); }}>+ {template.label}</button>)}</div>}
    {local.metrics.map((item, index) => { const result = item.formula ? evaluateBalanceFormula(item.formula, vars) : { value: item.value, error: "" }; const warnings = balanceWarnings(item, vars); return <article className="gd-detail-item" key={item.id}><div className="gd-detail-item-head"><strong>Chỉ số {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" onClick={() => { setLocal((current) => ({ ...current, metrics: current.metrics.filter((entry) => entry.id !== item.id), curves: current.curves.filter((curve) => curve.metricKey !== item.key) })); setDirty(true); }}>Xóa</button>}</div>
      {[['key','Key công thức'],['name','Tên chỉ số'],['value','Giá trị'],['min','Tối thiểu'],['max','Tối đa'],['unit','Đơn vị'],['formula','Công thức']].map(([key,label]) => <label key={key}>{label}<input maxLength={4000} value={item[key]} disabled={!canEdit} onChange={(event) => change(item.id, { [key]: key === 'key' ? event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') : event.target.value })} /></label>)}
      <p className={result.error ? "gd-balance-error" : "gd-balance-result"}>{result.error || `Kết quả: ${result.value ?? "—"} ${item.unit}`}</p>
      {warnings.map((warning) => <p className="gd-balance-warning" key={warning}>⚠ {warning}</p>)}
      <label>Thẻ liên quan<select multiple value={item.cardIds} disabled={!canEdit} onChange={(event) => change(item.id, { cardIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{nodes.map((node) => <option key={node.id} value={String(node.id)}>{node.title || `Thẻ ${node.id}`}</option>)}</select><span className="gd-field-help">Giữ Ctrl/Cmd để chọn nhiều thẻ.</span></label>
    </article>; })}
    <section className="gd-balance-curves"><div className="gd-detail-section-head"><div><span className="gd-kicker">Progression simulator</span><h3>Curve level & economy</h3></div></div><p className="gd-field-help">Tạo bảng tăng trưởng theo level, wave hoặc mốc economy. Curve được lưu cùng Balance sheet.</p>
      {local.curves.length === 0 && <p className="gd-detail-empty">Chưa có curve. Thêm một metric trước, rồi tạo curve để mô phỏng progression.</p>}
      {local.curves.map((curve) => { const table = balanceCurveTable(curve); const metric = local.metrics.find((item) => item.key === curve.metricKey); return <article className="gd-detail-item gd-balance-curve" key={curve.id}><div className="gd-detail-item-head"><strong>{curve.name || "Curve mới"}</strong>{canEdit && <button className="gd-detail-remove danger" type="button" onClick={() => { setLocal((current) => ({ ...current, curves: current.curves.filter((item) => item.id !== curve.id) })); setDirty(true); }}>Xóa</button>}</div>
        <label>Tên curve<input maxLength={4000} value={curve.name} disabled={!canEdit} onChange={(event) => changeCurve(curve.id, { name: event.target.value })} /></label>
        <label>Metric<select value={curve.metricKey} disabled={!canEdit} onChange={(event) => changeCurve(curve.id, { metricKey: event.target.value })}>{local.metrics.map((item) => <option key={item.key} value={item.key}>{item.name} ({item.key})</option>)}</select></label>
        <div className="gd-curve-fields"><label>Điểm đầu<input inputMode="decimal" value={curve.start} disabled={!canEdit} onChange={(event) => changeCurve(curve.id, { start: event.target.value })} /></label><label>Điểm cuối<input inputMode="decimal" value={curve.end} disabled={!canEdit} onChange={(event) => changeCurve(curve.id, { end: event.target.value })} /></label><label>Số mốc<input type="number" min="2" max="200" value={curve.steps} disabled={!canEdit} onChange={(event) => changeCurve(curve.id, { steps: event.target.value })} /></label><label>Kiểu<select value={curve.mode} disabled={!canEdit} onChange={(event) => changeCurve(curve.id, { mode: event.target.value })}><option value="linear">Linear</option><option value="exponential">Exponential</option></select></label></div>
        {table.error ? <p className="gd-balance-error">{table.error}</p> : <div className="gd-curve-table-wrap"><table className="gd-curve-table"><thead><tr><th>Mốc</th><th>{metric?.name || curve.metricKey}{metric?.unit ? ` (${metric.unit})` : ""}</th></tr></thead><tbody>{table.rows.map((row) => <tr key={row.step}><td>{row.step}</td><td>{row.value}</td></tr>)}</tbody></table></div>}
      </article>; })}
      {canEdit && <button className="btn ghost gd-balance-add" type="button" disabled={!local.metrics.length || local.curves.length >= 30} onClick={() => { setLocal((current) => ({ ...current, curves: [...current.curves, newCurve(current.metrics)] })); setDirty(true); }}>+ Thêm progression curve</button>}
    </section>
    {canEdit && <><button className="btn ghost gd-balance-add" type="button" disabled={local.metrics.length >= 100} onClick={() => { setLocal((current) => ({ ...current, metrics: [...current.metrics, newMetric()] })); setDirty(true); }}>+ Thêm chỉ số</button><button className="btn gd-save" type="button" onClick={save}>Lưu Balance sheet</button></>}
  </section>;
}
