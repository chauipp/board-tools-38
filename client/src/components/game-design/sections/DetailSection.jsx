import { ItemFields, ListEditor } from "./ListEditor.jsx";

export const DETAIL_SECTIONS = [
  {
    key: "examples", title: "Examples", addLabel: "Thêm ví dụ", itemLabel: "Ví dụ", identity: "title", limit: 20,
    fields: [["title", "Tên ví dụ", "input"], ["scenario", "Tình huống", "textarea"], ["expectedResult", "Kết quả mong đợi", "textarea"]]
  },
  {
    key: "failureStates", title: "Failure States", addLabel: "Thêm failure state", itemLabel: "Failure state", identity: "condition", limit: 20,
    fields: [
      ["condition", "Điều kiện thất bại", "input"],
      ["playerFeedback", "Phản hồi cho người chơi", "textarea"],
      ["recovery", "Cách phục hồi", "textarea"]
    ]
  },
  {
    key: "tuningParameters", title: "Tuning Parameters", addLabel: "Thêm parameter", itemLabel: "Parameter", identity: "name", limit: 30,
    fields: [
      ["name", "Tên parameter", "input"],
      ["defaultValue", "Giá trị mặc định", "input"],
      ["min", "Tối thiểu", "input"],
      ["max", "Tối đa", "input"],
      ["unit", "Đơn vị", "input"],
      ["note", "Ghi chú", "textarea"]
    ]
  }
];

function newDetailItem(section) {
  const id = globalThis.crypto?.randomUUID?.() || `detail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, ...Object.fromEntries(section.fields.map(([key]) => [key, ""])) };
}

export function DetailSection({ section, items, canEdit, collapsed, onToggle, onAdd, onChange }) {
  return (
    <ListEditor
      title={section.title}
      items={items}
      itemLabel={section.itemLabel}
      emptyText={`Chưa có ${section.itemLabel.toLowerCase()}.`}
      addLabel={section.addLabel}
      limit={section.limit}
      newItem={() => newDetailItem(section)}
      canEdit={canEdit}
      collapsed={collapsed}
      onToggle={onToggle}
      onAdd={onAdd}
      onChange={onChange}
      renderItem={(item, patch) => <ItemFields fields={section.fields} item={item} canEdit={canEdit} maxLength={1000} onPatch={patch} />}
    />
  );
}
