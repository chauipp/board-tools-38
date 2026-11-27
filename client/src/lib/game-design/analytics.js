export function normalizeAnalyticsEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => ({
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `analytics-${index + 1}`,
    eventName: typeof item.eventName === "string" ? item.eventName.trim() : "",
    trigger: typeof item.trigger === "string" ? item.trigger.trim() : "",
    properties: typeof item.properties === "string" ? item.properties.trim() : "",
    kpi: typeof item.kpi === "string" ? item.kpi.trim() : "",
    owner: typeof item.owner === "string" ? item.owner.trim() : ""
  })).filter((item) => item.eventName).slice(0, 20);
}
