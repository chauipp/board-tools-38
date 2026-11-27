import { ItemFields, ListEditor } from "./ListEditor.jsx";

const ANALYTICS_FIELDS = [
  ["eventName", "Event name", "input"],
  ["trigger", "Trigger", "input"],
  ["properties", "Properties", "textarea"],
  ["kpi", "KPI liên quan", "input"],
  ["owner", "Owner", "input"]
];

function newAnalyticsEvent() {
  return { id: globalThis.crypto?.randomUUID?.() || `analytics-${Date.now()}`, eventName: "", trigger: "", properties: "", kpi: "", owner: "" };
}

export function AnalyticsSection({ events, canEdit, collapsed, onToggle, onChange }) {
  return (
    <ListEditor
      className="gd-analytics-section"
      title="Analytics events"
      items={events}
      itemLabel="Event"
      emptyText="Chưa có event cần tracking."
      addLabel="Thêm event"
      limit={20}
      newItem={newAnalyticsEvent}
      canEdit={canEdit}
      collapsed={collapsed}
      onToggle={onToggle}
      onChange={onChange}
      renderItem={(item, patch) => <ItemFields fields={ANALYTICS_FIELDS} item={item} canEdit={canEdit} onPatch={patch} />}
    />
  );
}
