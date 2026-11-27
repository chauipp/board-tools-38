export function emptyDecisionLog() { return []; }

export function normalizeDecisionLog(value, nodes) {
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `decision-${index + 1}`,
      decision: typeof item.decision === "string" ? item.decision.trim() : "",
      rationale: typeof item.rationale === "string" ? item.rationale.trim() : "",
      evidence: typeof item.evidence === "string" ? item.evidence.trim() : "",
      alternatives: typeof item.alternatives === "string" ? item.alternatives.trim() : "",
      owner: typeof item.owner === "string" ? item.owner.trim() : "",
      date: typeof item.date === "string" ? item.date.trim() : "",
      status: item.status === "replaced" ? "replaced" : "active",
      cardIds: Array.isArray(item.cardIds) ? item.cardIds.map((id) => String(id).trim())
        .filter((id, itemIndex, ids) => id && ids.indexOf(id) === itemIndex && (!nodeIds || nodeIds.has(id))) : []
    }))
    .filter((item) => item.decision)
    .slice(0, 30);
}

export function decisionTimeline(nodes) {
  return (Array.isArray(nodes) ? nodes : []).flatMap((node) => normalizeDecisionLog(node?.design?.decisionLog, nodes).map((decision) => ({
    ...decision,
    decisionId: decision.id,
    cardId: String(node.id),
    cardTitle: node.title || `Thẻ ${node.id}`
  }))).sort((left, right) => {
    const leftDate = /^\d{4}-\d{2}-\d{2}$/.test(left.date) ? left.date : "";
    const rightDate = /^\d{4}-\d{2}-\d{2}$/.test(right.date) ? right.date : "";
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    return left.cardTitle.localeCompare(right.cardTitle);
  });
}
