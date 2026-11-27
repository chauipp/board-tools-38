import { ItemFields, ListEditor } from "./ListEditor.jsx";

const AB_TEST_FIELDS = [
  ["hypothesis", "Giả thuyết", "textarea"],
  ["control", "Control", "input"],
  ["variant", "Variant", "input"],
  ["primaryMetric", "Primary metric", "input"],
  ["successCriteria", "Tiêu chí thành công", "textarea"],
  ["segment", "Phân khúc người chơi", "input"]
];

function newABTest() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `ab-test-${Date.now()}`,
    hypothesis: "", control: "", variant: "", primaryMetric: "", successCriteria: "", segment: "", status: "draft"
  };
}

export function ABTestsSection({ tests, canEdit, collapsed, onToggle, onChange }) {
  return (
    <ListEditor
      className="gd-ab-tests-section"
      title="A/B test hypotheses"
      items={tests}
      itemLabel="A/B test"
      emptyText="Chưa có giả thuyết A/B test."
      addLabel="Thêm hypothesis"
      limit={20}
      newItem={newABTest}
      canEdit={canEdit}
      collapsed={collapsed}
      onToggle={onToggle}
      onChange={onChange}
      renderItem={(item, patch) => <>
        <ItemFields fields={AB_TEST_FIELDS} item={item} canEdit={canEdit} onPatch={patch} />
        <label>
          Trạng thái
          <select value={item.status} disabled={!canEdit} onChange={(event) => patch({ status: event.target.value })}>
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="concluded">Concluded</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </>}
    />
  );
}
