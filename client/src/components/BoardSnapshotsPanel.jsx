import { useState } from "react";

function timestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

export default function BoardSnapshotsPanel({ snapshots, loading, canEdit, onCreate, onRestore, onClose, outsideRef }) {
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  async function create() {
    if (creating) return;
    setCreating(true);
    try {
      await onCreate(label);
      setLabel("");
    } finally {
      setCreating(false);
    }
  }

  async function restore(snapshot) {
    if (restoringId || !window.confirm(`Khôi phục snapshot “${snapshot.label || timestamp(snapshot.createdAt)}”? Các thay đổi hiện tại trên board sẽ bị thay thế.`)) return;
    setRestoringId(snapshot.id);
    try {
      await onRestore(snapshot.id);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <aside className="gd-panel snapshot-panel" ref={outsideRef} aria-label="Version snapshots">
      <div className="gd-panel-head"><div><span className="gd-kicker">Version history</span><h2>Snapshots</h2></div><button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Snapshots">×</button></div>
      <p className="gd-help">Lưu tối đa 30 mốc an toàn cho board. Khôi phục sẽ thay toàn bộ nội dung board và đồng bộ cho mọi người đang xem.</p>
      {canEdit && <div className="snapshot-create">
        <input value={label} maxLength={160} placeholder="Tên mốc, ví dụ: Trước playtest 03" onChange={(event) => setLabel(event.target.value)} />
        <button className="btn primary" type="button" disabled={creating} onClick={create}>{creating ? "Đang lưu…" : "Tạo snapshot"}</button>
      </div>}
      {loading ? <p className="gd-help">Đang tải snapshots…</p> : snapshots.length === 0 ? <p className="gd-help">Chưa có snapshot. Hãy tạo một mốc trước khi thử nghiệm hoặc review lớn.</p> : <div className="snapshot-list">
        {snapshots.map((snapshot) => <article className="snapshot-item" key={snapshot.id}>
          <strong>{snapshot.label || "Snapshot không tên"}</strong>
          <span>{timestamp(snapshot.createdAt)}</span>
          <small>{snapshot.createdBy}</small>
          {canEdit && <button className="btn ghost small" type="button" disabled={restoringId === snapshot.id} onClick={() => restore(snapshot)}>{restoringId === snapshot.id ? "Đang khôi phục…" : "Khôi phục"}</button>}
        </article>)}
      </div>}
    </aside>
  );
}
