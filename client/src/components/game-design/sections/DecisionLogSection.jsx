import { ItemFields, ListEditor } from "./ListEditor.jsx";
import { RelatedCards } from "./RelatedCards.jsx";

const DECISION_FIELDS = [
  ["decision", "Quyết định", "textarea"],
  ["rationale", "Lý do", "textarea"],
  ["evidence", "Evidence / Playtest", "textarea"],
  ["alternatives", "Phương án đã cân nhắc", "textarea"],
  ["owner", "Người quyết định", "textarea"],
  ["date", "Ngày quyết định", "textarea"]
];

function newDecision() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `decision-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    decision: "", rationale: "", evidence: "", alternatives: "", owner: "", date: "", status: "active", cardIds: []
  };
}

export function DecisionLogSection({ decisions, nodes, canEdit, collapsed, onToggle, onChange }) {
  return (
    <ListEditor
      title="Decision log"
      items={decisions}
      itemLabel="Quyết định"
      emptyText="Chưa có quyết định được ghi lại."
      addLabel="Thêm quyết định"
      limit={30}
      newItem={newDecision}
      canEdit={canEdit}
      collapsed={collapsed}
      onToggle={onToggle}
      onChange={onChange}
      renderItem={(item, patch) => <>
        <ItemFields fields={DECISION_FIELDS} item={item} canEdit={canEdit} onPatch={patch} />
        <label>
          Trạng thái
          <select value={item.status} disabled={!canEdit} onChange={(event) => patch({ status: event.target.value })}>
            <option value="active">Đang áp dụng</option>
            <option value="replaced">Đã thay thế</option>
          </select>
        </label>
        <RelatedCards value={item.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => patch({ cardIds })} />
      </>}
    />
  );
}
