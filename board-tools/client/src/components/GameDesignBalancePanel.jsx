import { useEffect, useRef, useState } from "react";
import { BALANCE_TEMPLATES, appendBalanceTemplate, balanceWarnings, evaluateBalanceFormula, normalizeGameDesignBalance } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

function newMetric() { return { id: globalThis.crypto?.randomUUID?.() || `metric-${Date.now()}`, key: "", name: "", value: "", min: "", max: "", unit: "", formula: "", cardIds: [] }; }

export default function GameDesignBalancePanel({ balance, nodes, canEdit, onSave, onClose, outsideRef }) {
  const [local, setLocal] = useState(() => normalizeGameDesignBalance(balance, nodes));
  const [dirty, setDirty] = useState(false); const panelRef = useRef(null);
  useEffect(() => { setLocal(normalizeGameDesignBalance(balance, nodes)); setDirty(false); }, [balance, nodes]);
  const vars = Object.fromEntries(local.metrics.map((item) => [item.key, item.value]));
  const change = (id, patch) => { setLocal((current) => ({ metrics: current.metrics.map((item) => item.id === id ? { ...item, ...patch } : item) })); setDirty(true); };
  const save = () => { onSave(normalizeGameDesignBalance(local, nodes)); setDirty(false); };
  const close = () => { if (dirty && canEdit) save(); onClose(); };
  useCloseOnOutside(outsideRef || panelRef, close);
  return <section className="gd-balance-panel" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
    <div className="gd-panel-head"><div><span className="gd-kicker">Balance & progression</span><h2>Balance sheet</h2></div><button className="btn ghost icon" type="button" onClick={onClose}>×</button></div>
    <p className="gd-handoff-help">Công thức nhận số, key và + − × ÷. Ví dụ: <code>damage * 1.2</code>.</p>
    {canEdit && <div className="gd-balance-templates"><span>Template nhanh</span>{BALANCE_TEMPLATES.map((template) => <button className="btn ghost" type="button" key={template.id} onClick={() => { setLocal((current) => appendBalanceTemplate(current, template.id, nodes)); setDirty(true); }}>+ {template.label}</button>)}</div>}
    {local.metrics.map((item, index) => { const result = item.formula ? evaluateBalanceFormula(item.formula, vars) : { value: item.value, error: "" }; const warnings = balanceWarnings(item, vars); return <article className="gd-detail-item" key={item.id}><div className="gd-detail-item-head"><strong>Chỉ số {index + 1}</strong>{canEdit && <button className="gd-detail-remove danger" onClick={() => { setLocal((current) => ({ metrics: current.metrics.filter((entry) => entry.id !== item.id) })); setDirty(true); }}>Xóa</button>}</div>
      {[['key','Key công thức'],['name','Tên chỉ số'],['value','Giá trị'],['min','Tối thiểu'],['max','Tối đa'],['unit','Đơn vị'],['formula','Công thức']].map(([key,label]) => <label key={key}>{label}<input maxLength={4000} value={item[key]} disabled={!canEdit} onChange={(event) => change(item.id, { [key]: key === 'key' ? event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') : event.target.value })} /></label>)}
      <p className={result.error ? "gd-balance-error" : "gd-balance-result"}>{result.error || `Kết quả: ${result.value ?? "—"} ${item.unit}`}</p>
      {warnings.map((warning) => <p className="gd-balance-warning" key={warning}>⚠ {warning}</p>)}
      <label>Thẻ liên quan<select multiple value={item.cardIds} disabled={!canEdit} onChange={(event) => change(item.id, { cardIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{nodes.map((node) => <option key={node.id} value={String(node.id)}>{node.title || `Thẻ ${node.id}`}</option>)}</select><span className="gd-field-help">Giữ Ctrl/Cmd để chọn nhiều thẻ.</span></label>
    </article>; })}
    {canEdit && <><button className="btn ghost gd-balance-add" type="button" disabled={local.metrics.length >= 100} onClick={() => { setLocal((current) => ({ metrics: [...current.metrics, newMetric()] })); setDirty(true); }}>+ Thêm chỉ số</button><button className="btn gd-save" type="button" onClick={save}>Lưu Balance sheet</button></>}
  </section>;
}
