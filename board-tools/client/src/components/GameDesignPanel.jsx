import { useEffect, useRef, useState } from "react";
import { DESIGN_FIELD_LABELS, gameDesignType, normalizeAcceptanceCriteria, normalizeDecisionLog, normalizeGameDesignDetails, normalizePlaytestSession, normalizeTechnicalNotes } from "../lib/game-design.js";
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

export default function GameDesignPanel({ node, nodes, canEdit, onSave, onClose, outsideRef }) {
  const [title, setTitle] = useState(node.title);
  const [desc, setDesc] = useState(node.desc || "");
  const [design, setDesign] = useState({ ...(node.design || {}) });
  const [criteria, setCriteria] = useState(() => normalizeAcceptanceCriteria(node.design?.acceptanceCriteria));
  const [details, setDetails] = useState(() => normalizeGameDesignDetails(node.design));
  const [playtestSession, setPlaytestSession] = useState(() => normalizePlaytestSession(node.design?.playtestSession, nodes));
  const [decisionLog, setDecisionLog] = useState(() => normalizeDecisionLog(node.design?.decisionLog, nodes));
  const [collapsedDetails, setCollapsedDetails] = useState({ examples: true, failureStates: true, tuningParameters: true, playtest: true, decisions: true });
  const [dirty, setDirty] = useState(false);
  const panelRef = useRef(null);
  const template = gameDesignType(node.type);

  useEffect(() => {
    setTitle(node.title); setDesc(node.desc || ""); setDesign({ ...(node.design || {}) });
    setCriteria(normalizeAcceptanceCriteria(node.design?.acceptanceCriteria)); setDetails(normalizeGameDesignDetails(node.design)); setPlaytestSession(normalizePlaytestSession(node.design?.playtestSession, nodes)); setDecisionLog(normalizeDecisionLog(node.design?.decisionLog, nodes)); setDirty(false);
  }, [node.id, nodes]);

  function save() {
    const nextCriteria = criteria.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() }));
    onSave({ ...node, title: title.trim() || template.label, desc: desc.trim(), design: { ...node.design, ...design, technicalNotes: normalizeTechnicalNotes(design.technicalNotes), acceptanceCriteria: nextCriteria, ...normalizeGameDesignDetails(details), playtestSession: normalizePlaytestSession(playtestSession, nodes), decisionLog: normalizeDecisionLog(decisionLog, nodes) } });
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
      <div className="gd-details">
        {DETAIL_SECTIONS.map((section) => <DetailSection key={section.key} section={section} items={details[section.key]} canEdit={canEdit} collapsed={collapsedDetails[section.key]} onToggle={() => setCollapsedDetails((current) => ({ ...current, [section.key]: !current[section.key] }))} onAdd={(item) => { setDetails((current) => ({ ...current, [section.key]: [...current[section.key], item] })); setCollapsedDetails((current) => ({ ...current, [section.key]: false })); setDirty(true); }} onChange={(items) => { setDetails((current) => ({ ...current, [section.key]: items })); setDirty(true); }} />)}
        {node.type === "playtest" && <PlaytestSection session={playtestSession} nodes={nodes.filter((item) => item.id !== node.id)} canEdit={canEdit} collapsed={collapsedDetails.playtest} onToggle={() => setCollapsedDetails((current) => ({ ...current, playtest: !current.playtest }))} onChange={(value) => { setPlaytestSession(value); setDirty(true); }} />}
        <DecisionLogSection decisions={decisionLog} nodes={nodes.filter((item) => item.id !== node.id)} canEdit={canEdit} collapsed={collapsedDetails.decisions} onToggle={() => setCollapsedDetails((current) => ({ ...current, decisions: !current.decisions }))} onChange={(value) => { setDecisionLog(value); setDirty(true); }} />
      </div>
      {canEdit && <button className="btn gd-save" onClick={save}>Lưu chi tiết</button>}
    </div>
  );
}
