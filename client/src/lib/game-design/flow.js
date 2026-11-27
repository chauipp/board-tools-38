export function emptyGameDesignFlow() {
  return { playerLoop: [], progressionMap: [] };
}

function normalizeFlowItems(items, { prefix, fields, limit }, nodeIds) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => {
      const cardIds = Array.isArray(item.cardIds) ? item.cardIds
        .map((id) => String(id).trim())
        .filter((id, itemIndex, ids) => id && ids.indexOf(id) === itemIndex && (!nodeIds || nodeIds.has(id)))
        : [];
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${prefix}-${index + 1}`,
        ...Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""])),
        cardIds
      };
    })
    .filter((item) => item.title)
    .slice(0, limit);
}

export function normalizeGameDesignFlow(value, nodes) {
  const flow = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  return {
    playerLoop: normalizeFlowItems(flow.playerLoop, {
      prefix: "loop", fields: ["title", "action", "outcome", "note"], limit: 20
    }, nodeIds),
    progressionMap: normalizeFlowItems(flow.progressionMap, {
      prefix: "progression", fields: ["title", "objective", "unlocks", "description", "emotion"], limit: 30
    }, nodeIds)
  };
}

export function hasGameDesignFlow(flow) {
  const normalized = normalizeGameDesignFlow(flow);
  return Boolean(normalized.playerLoop.length || normalized.progressionMap.length);
}
