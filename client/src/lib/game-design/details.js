export function emptyGameDesignDetails() {
  return { examples: [], failureStates: [], tuningParameters: [] };
}

export function normalizeTechnicalNotes(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDetailItems(items, { prefix, key, fields, limit }) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${prefix}-${index + 1}`,
      ...Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""]))
    }))
    .filter((item) => item[key])
    .slice(0, limit);
}

export function normalizeGameDesignDetails(value) {
  const details = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    examples: normalizeDetailItems(details.examples, { prefix: "example", key: "title", fields: ["title", "scenario", "expectedResult"], limit: 20 }),
    failureStates: normalizeDetailItems(details.failureStates, { prefix: "failure", key: "condition", fields: ["condition", "playerFeedback", "recovery"], limit: 20 }),
    tuningParameters: normalizeDetailItems(details.tuningParameters, { prefix: "tuning", key: "name", fields: ["name", "defaultValue", "min", "max", "unit", "note"], limit: 30 })
  };
}

export function normalizeAcceptanceCriteria(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [{ id: "ac-legacy-1", text, done: false }] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `ac-${index + 1}`,
      text: typeof item.text === "string" ? item.text.trim() : "",
      done: item.done === true
    }))
    .filter((item) => item.text);
}

export function acceptanceProgress(node) {
  const criteria = normalizeAcceptanceCriteria(node?.design?.acceptanceCriteria);
  return { done: criteria.filter((item) => item.done).length, total: criteria.length };
}
