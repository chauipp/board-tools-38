import { POST_LAUNCH_STATUSES } from "../../../../shared/game-design-limits.js";
const POST_LAUNCH_STATUS_SET = new Set(POST_LAUNCH_STATUSES);

export function emptyPostLaunchReview() {
  return { outcome: "", actualMetrics: "", learnings: "", nextDecision: "", owner: "", reviewDate: "", status: "pending", cardIds: [] };
}

export function normalizePostLaunchReview(value, nodes) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  const text = (key) => typeof source[key] === "string" ? source[key].trim() : "";
  const reviewDate = text("reviewDate");
  return {
    outcome: text("outcome"), actualMetrics: text("actualMetrics"), learnings: text("learnings"), nextDecision: text("nextDecision"), owner: text("owner"),
    reviewDate: /^\d{4}-\d{2}-\d{2}$/.test(reviewDate) ? reviewDate : "", status: POST_LAUNCH_STATUS_SET.has(source.status) ? source.status : "pending",
    cardIds: Array.isArray(source.cardIds) ? source.cardIds.map((id) => String(id).trim()).filter((id, index, ids) => id && ids.indexOf(id) === index && (!nodeIds || nodeIds.has(id))) : []
  };
}

export function hasPostLaunchReview(value) {
  const review = normalizePostLaunchReview(value);
  return Boolean(review.outcome || review.actualMetrics || review.learnings || review.nextDecision || review.owner || review.reviewDate || review.cardIds.length);
}
