export function emptyPlaytestSession() {
  return { objective: "", hypothesis: "", buildVersion: "", playerGroup: "", testDate: "", observations: "", metrics: "", playerFeedback: "", problemsFound: "", cardIds: [] };
}

export function normalizePlaytestSession(value, nodes) {
  const session = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  const cardIds = Array.isArray(session.cardIds) ? session.cardIds
    .map((id) => String(id).trim())
    .filter((id, index, ids) => id && ids.indexOf(id) === index && (!nodeIds || nodeIds.has(id)))
    : [];
  return {
    ...Object.fromEntries(["objective", "hypothesis", "buildVersion", "playerGroup", "testDate", "observations", "metrics", "playerFeedback", "problemsFound"]
      .map((field) => [field, typeof session[field] === "string" ? session[field].trim() : ""])),
    cardIds
  };
}

export function hasPlaytestSession(session) {
  return Object.entries(normalizePlaytestSession(session)).some(([key, value]) => key === "cardIds" ? value.length : Boolean(value));
}

export function playtestComparison(nodes) {
  return (Array.isArray(nodes) ? nodes : []).filter((node) => node.type === "playtest").map((node) => {
    const session = normalizePlaytestSession(node.design?.playtestSession, nodes);
    return { nodeId: node.id, title: node.title || `Thẻ ${node.id}`, ...session };
  }).filter((session) => hasPlaytestSession(session)).sort((a, b) => (b.testDate || "").localeCompare(a.testDate || ""));
}
