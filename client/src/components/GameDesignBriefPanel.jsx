import { useEffect, useRef, useState } from "react";
import { emptyGameDesignBrief, normalizeGameDesignBrief } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

function newStage() {
  return { id: crypto.randomUUID(), title: "", experience: "", emotion: "" };
}

export default function GameDesignBriefPanel({ brief, canEdit, onSave, onClose, outsideRef }) {
  const [localBrief, setLocalBrief] = useState(() => normalizeGameDesignBrief(brief));
  const [dirty, setDirty] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => { setLocalBrief(normalizeGameDesignBrief(brief)); setDirty(false); }, [brief]);
  const change = (patch) => { setLocalBrief((current) => ({ ...current, ...patch })); setDirty(true); };
  const save = () => { onSave(normalizeGameDesignBrief(localBrief)); setDirty(false); };
  const closeFromOutside = () => { if (dirty && canEdit) save(); onClose(); };
  useCloseOnOutside(outsideRef || panelRef, closeFromOutside);

  return <div className="gd-brief-panel" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
    <div className="gd-panel-head">
      <div><span className="gd-kicker">Game context</span><h2>Game brief</h2></div>
      <button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Game brief">×</button>
    </div>
    <label>Genre
      <input value={localBrief.genre} disabled={!canEdit} onChange={(event) => change({ genre: event.target.value })} />
    </label>
    <label>Target audience
      <textarea rows={2} value={localBrief.targetAudience} disabled={!canEdit} onChange={(event) => change({ targetAudience: event.target.value })} />
    </label>
    <label>Player fantasy
      <textarea rows={2} value={localBrief.playerFantasy} disabled={!canEdit} onChange={(event) => change({ playerFantasy: event.target.value })} />
    </label>
    <div className="gd-journey-head"><span>Player journey</span>{canEdit && <button className="btn ghost gd-add-journey" type="button" onClick={() => change({ playerJourney: [...localBrief.playerJourney, newStage()] })}>+ Thêm giai đoạn</button>}</div>
    <div className="gd-journey-list">
      {localBrief.playerJourney.map((stage, index) => <section className="gd-journey-stage" key={stage.id}>
        <div className="gd-journey-stage-head"><strong>Giai đoạn {index + 1}</strong>{canEdit && <button className="gd-journey-remove danger" type="button" onClick={() => change({ playerJourney: localBrief.playerJourney.filter((item) => item.id !== stage.id) })}>Xóa</button>}</div>
        <label>Title<input value={stage.title} disabled={!canEdit} onChange={(event) => change({ playerJourney: localBrief.playerJourney.map((item) => item.id === stage.id ? { ...item, title: event.target.value } : item) })} /></label>
        <label>Experience<textarea rows={2} value={stage.experience} disabled={!canEdit} onChange={(event) => change({ playerJourney: localBrief.playerJourney.map((item) => item.id === stage.id ? { ...item, experience: event.target.value } : item) })} /></label>
        <label>Emotion<input value={stage.emotion} disabled={!canEdit} onChange={(event) => change({ playerJourney: localBrief.playerJourney.map((item) => item.id === stage.id ? { ...item, emotion: event.target.value } : item) })} /></label>
      </section>)}
    </div>
    {canEdit && <button className="btn gd-save" type="button" onClick={save}>Lưu Game brief</button>}
  </div>;
}
