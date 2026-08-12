import { useEffect, useRef, useState } from "react";
import { normalizeGameDesignFlow } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

const LOOP_FIELDS = [["title", "Tên bước"], ["action", "Hành động người chơi"], ["outcome", "Kết quả / reward"], ["note", "Ghi chú"]];
const PROGRESSION_FIELDS = [["title", "Tên mốc"], ["objective", "Mục tiêu"], ["unlocks", "Mở khóa"], ["description", "Mô tả"], ["emotion", "Cảm xúc mong muốn"]];

function newItem(kind) {
  return kind === "loop"
    ? { id: crypto.randomUUID(), title: "", action: "", outcome: "", note: "", cardIds: [] }
    : { id: crypto.randomUUID(), title: "", objective: "", unlocks: "", description: "", emotion: "", cardIds: [] };
}

function ReferenceCards({ item, nodes, canEdit, onChange }) {
  const selected = new Set(item.cardIds);
  return <label>Thẻ liên quan
    <select multiple value={item.cardIds} disabled={!canEdit} onChange={(event) => onChange({ cardIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>
      {nodes.map((node) => <option key={node.id} value={String(node.id)}>{node.title || `Thẻ ${node.id}`}</option>)}
    </select>
    {nodes.length > 0 && <span className="gd-flow-reference-help">Giữ Ctrl/Cmd để chọn nhiều thẻ.</span>}
  </label>;
}

function FlowSection({ title, kind, items, fields, nodes, canEdit, collapsed, onToggle, onChange }) {
  const replaceItem = (id, patch) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="gd-flow-section">
    <div className="gd-flow-section-head">
      <button type="button" className="gd-flow-collapse" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? "▸" : "▾"} {title} <span>{items.length}</span></button>
      {canEdit && <button className="btn ghost gd-flow-add" type="button" onClick={() => onChange([...items, newItem(kind)])}>+ {kind === "loop" ? "Thêm bước" : "Thêm mốc"}</button>}
    </div>
    {!collapsed && <div className="gd-flow-list">
      {items.length === 0 && <p className="gd-flow-empty">Chưa có {kind === "loop" ? "bước loop" : "mốc progression"}.</p>}
      {items.map((item, index) => <article className="gd-flow-item" key={item.id}>
        <div className="gd-flow-item-head"><strong>{kind === "loop" ? "Bước" : "Mốc"} {index + 1}</strong>{canEdit && <button className="gd-journey-remove danger" type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Xóa</button>}</div>
        {fields.map(([field, label]) => <label key={field}>{label}
          {field === "action" || field === "outcome" || field === "note" || field === "description" ? <textarea rows={2} value={item[field]} disabled={!canEdit} onChange={(event) => replaceItem(item.id, { [field]: event.target.value })} /> : <input value={item[field]} disabled={!canEdit} onChange={(event) => replaceItem(item.id, { [field]: event.target.value })} />}
        </label>)}
        <ReferenceCards item={item} nodes={nodes} canEdit={canEdit} onChange={(patch) => replaceItem(item.id, patch)} />
      </article>)}
    </div>}
  </section>;
}

export default function GameDesignFlowPanel({ flow, nodes = [], canEdit, onSave, onClose, outsideRef }) {
  const [localFlow, setLocalFlow] = useState(() => normalizeGameDesignFlow(flow, nodes));
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState({ loop: false, progression: false });
  const panelRef = useRef(null);
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];

  useEffect(() => { setLocalFlow(normalizeGameDesignFlow(flow, normalizedNodes)); setDirty(false); }, [flow, nodes]);
  const change = (patch) => { setLocalFlow((current) => ({ ...current, ...patch })); setDirty(true); };
  const save = () => { onSave(normalizeGameDesignFlow(localFlow, normalizedNodes)); setDirty(false); };
  const closeFromOutside = () => { if (dirty && canEdit) save(); onClose(); };
  useCloseOnOutside(outsideRef || panelRef, closeFromOutside);

  return <div className="gd-flow-panel" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
    <div className="gd-panel-head"><div><span className="gd-kicker">Game structure</span><h2>Game flow</h2></div><button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Game flow">×</button></div>
    <FlowSection title="Player Loop" kind="loop" items={localFlow.playerLoop} fields={LOOP_FIELDS} nodes={normalizedNodes} canEdit={canEdit} collapsed={collapsed.loop} onToggle={() => setCollapsed((value) => ({ ...value, loop: !value.loop }))} onChange={(playerLoop) => change({ playerLoop })} />
    <FlowSection title="Progression Map" kind="progression" items={localFlow.progressionMap} fields={PROGRESSION_FIELDS} nodes={normalizedNodes} canEdit={canEdit} collapsed={collapsed.progression} onToggle={() => setCollapsed((value) => ({ ...value, progression: !value.progression }))} onChange={(progressionMap) => change({ progressionMap })} />
    {canEdit && <button className="btn gd-save" type="button" onClick={save}>Lưu Game flow</button>}
  </div>;
}
