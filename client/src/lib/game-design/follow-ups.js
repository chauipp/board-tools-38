export function normalizeFollowUpTasks(value, nodes) {
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => ({
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `follow-up-${index + 1}`,
    text: typeof item.text === "string" ? item.text.trim() : "",
    owner: typeof item.owner === "string" ? item.owner.trim() : "",
    deadline: typeof item.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : "",
    done: item.done === true,
    cardIds: Array.isArray(item.cardIds) ? item.cardIds.map((id) => String(id).trim()).filter((id, i, ids) => id && ids.indexOf(id) === i && (!nodeIds || nodeIds.has(id))) : []
  })).filter((item) => item.text).slice(0, 20);
}

export function followUpProgress(node) { const tasks = normalizeFollowUpTasks(node?.design?.followUpTasks); return { done: tasks.filter((task) => task.done).length, total: tasks.length }; }
