import { DESIGN_FIELD_LABELS } from "../../../lib/game-design.js";

// Phần spec chính của thẻ: các field theo loại thẻ, acceptance criteria và hai
// ô ghi chú luôn có. onDesignChange/onCriteriaChange đã tự đánh dấu dirty.
export function SpecSection({ template, design, criteria, canEdit, onDesignChange, onCriteriaChange }) {
  const setField = (field) => (e) => onDesignChange((p) => ({ ...p, [field]: e.target.value }));
  const patchCriterion = (id, patch) => onCriteriaChange((prev) => prev.map((criterion) => criterion.id === id ? { ...criterion, ...patch } : criterion));
  return <>
    {template.fields.map((field) => (
      <label key={field}>{DESIGN_FIELD_LABELS[field]}
        {field === "priority" ? (
          <select value={design[field] || "medium"} onChange={setField(field)} disabled={!canEdit}>
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
                  onChange={(e) => patchCriterion(item.id, { done: e.target.checked })}
                />
                <input
                  className="gd-criterion-text"
                  value={item.text}
                  placeholder="Tiêu chí nghiệm thu"
                  disabled={!canEdit}
                  onChange={(e) => patchCriterion(item.id, { text: e.target.value })}
                />
                <button
                  className="gd-criterion-remove danger"
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onCriteriaChange((prev) => prev.filter((criterion) => criterion.id !== item.id))}
                >
                  Xóa
                </button>
              </div>
            ))}
            {canEdit && (
              <button
                className="btn ghost gd-add-criterion"
                type="button"
                onClick={() => onCriteriaChange((prev) => [...prev, { id: `ac-${Date.now()}-${prev.length + 1}`, text: "", done: false }])}
              >
                + Thêm tiêu chí
              </button>
            )}
          </div>
        ) : <textarea rows={2} value={design[field] || ""} onChange={setField(field)} disabled={!canEdit} />}
      </label>
    ))}
    <label>Technical notes cho dev
      <textarea
        rows={3}
        maxLength={2000}
        value={design.technicalNotes || ""}
        disabled={!canEdit}
        placeholder="Ràng buộc kỹ thuật, event cần track, lưu ý triển khai…"
        onChange={setField("technicalNotes")}
      />
    </label>
    <label>Trải nghiệm người chơi / cảm xúc mong muốn
      <textarea
        rows={2}
        maxLength={2000}
        value={design.playerExperience || ""}
        disabled={!canEdit}
        placeholder="Ví dụ: Căng thẳng nhưng công bằng; cảm giác làm chủ khi né đúng lúc…"
        onChange={setField("playerExperience")}
      />
    </label>
  </>;
}
