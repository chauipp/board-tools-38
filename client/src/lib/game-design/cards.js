import { DESIGN_FIELD_LABELS, RELATION_IDS, gameDesignType } from "./types.js";
import { emptyTeamHandoff } from "./handoff.js";
import { emptyReview, normalizeReview } from "./review.js";
import { emptyDelivery, normalizeDelivery } from "./delivery.js";
import { normalizeAnalyticsEvents } from "./analytics.js";
import { abTestProgress } from "./ab-tests.js";
import { emptyLiveOps, hasLiveOps, normalizeLiveOps } from "./live-ops.js";
import { emptyPostLaunchReview, hasPostLaunchReview, normalizePostLaunchReview } from "./post-launch.js";

export function emptyDesign(type = "mechanic") {
  return {
    type,
    design: Object.fromEntries(Object.keys(DESIGN_FIELD_LABELS).map((key) => [
      key,
      key === "priority" ? "medium" : key === "acceptanceCriteria" ? [] : ""
    ]).concat([["technicalNotes", ""], ["playerExperience", ""], ["delivery", emptyDelivery()], ["teamHandoff", emptyTeamHandoff()], ["review", emptyReview()], ["analyticsEvents", []], ["followUpTasks", []], ["abTests", []], ["liveOps", emptyLiveOps()], ["postLaunchReview", emptyPostLaunchReview()]]))
  };
}

export function createGameDesignNode(id, x, y, type = "mechanic") {
  const preset = emptyDesign(type);
  return { id, title: gameDesignType(type).label, desc: "", tagId: null, statusId: null, x: Math.round(x), y: Math.round(y), ...preset };
}
export function createRelatedGameDesignCard(board, sourceId, type = "mechanic", relation = "depends-on") {
  const source = board.nodes.find((node) => node.id === sourceId);
  if (!source) return board;
  const node = createGameDesignNode(board.nextNodeId, source.x + 300, source.y, type);
  return { ...board, nodes: [...board.nodes, node], edges: [...board.edges, { id: board.nextEdgeId, from: sourceId, fromKind: "node", to: node.id, toKind: "node", relation: RELATION_IDS.has(relation) ? relation : "depends-on" }], nextNodeId: node.id + 1, nextEdgeId: board.nextEdgeId + 1 };
}

function cloneDesign(value) {
  if (typeof structuredClone === "function") return structuredClone(value || {});
  return JSON.parse(JSON.stringify(value || {}));
}

export function duplicateGameDesignCard(board, sourceId) {
  const source = board.nodes.find((node) => node.id === sourceId);
  if (!source) return board;
  const node = {
    ...source,
    id: board.nextNodeId,
    title: `${source.title || gameDesignType(source.type).label} — bản sao`,
    tagId: null,
    statusId: null,
    x: Math.round(source.x + 300),
    y: Math.round(source.y),
    design: cloneDesign(source.design)
  };
  return { ...board, nodes: [...board.nodes, node], nextNodeId: node.id + 1 };
}

// Canvas là nơi nhìn toàn cục, không phải nơi đọc nguyên một spec. Chỉ lấy vài
// field đã điền đầu tiên để thẻ nói được "nó làm gì" mà không phình thành văn
// bản dài che mất quan hệ giữa các hệ thống.
export function gameDesignPreview(node, max = 3) {
  const fields = gameDesignType(node.type).fields;
  const preview = fields
    .filter((field) => field !== "acceptanceCriteria")
    .map((field) => ({ field, label: DESIGN_FIELD_LABELS[field], value: String(node.design?.[field] || "").replace(/\s+/g, " ").trim() }))
    .filter((item) => item.value)
    .slice(0, max)
    .map((item) => ({ ...item, value: item.value.length > 78 ? item.value.slice(0, 77) + "…" : item.value }));
  const playerExperience = String(node.design?.playerExperience || "").replace(/\s+/g, " ").trim();
  if (playerExperience && preview.length < max) preview.push({ field: "playerExperience", label: DESIGN_FIELD_LABELS.playerExperience, value: playerExperience.length > 78 ? playerExperience.slice(0, 77) + "…" : playerExperience });
  const review = normalizeReview(node?.design?.review);
  if (review.outcome !== "pending" && preview.length < max) preview.push({ field: "review", label: "Review", value: review.outcome === "approved" ? "Approved" : review.outcome === "rejected" ? "Rejected" : "Changes requested" });
  const delivery = normalizeDelivery(node?.design?.delivery);
  if (delivery.milestone && preview.length < max) preview.push({ field: "milestone", label: "Milestone", value: delivery.milestone });
  const analyticsCount = normalizeAnalyticsEvents(node?.design?.analyticsEvents).length;
  if (analyticsCount && preview.length < max) preview.push({ field: "analytics", label: "Analytics", value: `${analyticsCount} event${analyticsCount > 1 ? "s" : ""}` });
  const abTests = abTestProgress(node);
  if (abTests.total && preview.length < max) preview.push({ field: "ab-tests", label: "A/B test", value: `${abTests.total} test${abTests.total > 1 ? "s" : ""}${abTests.running ? " · Running" : ""}` });
  const liveOps = normalizeLiveOps(node?.design?.liveOps);
  if (hasLiveOps(liveOps) && preview.length < max) preview.push({ field: "live-ops", label: "Live ops", value: liveOps.status === "paused" ? "Paused" : liveOps.status === "rolled-back" ? "Rolled back" : liveOps.rolloutPercent ? `${liveOps.status === "running" ? "Live" : liveOps.status === "full" ? "Full" : "Planned"} · ${liveOps.rolloutPercent}%` : liveOps.status === "running" ? "Live" : liveOps.status === "full" ? "Full rollout" : "Planned" });
  const postLaunch = normalizePostLaunchReview(node?.design?.postLaunchReview);
  if (hasPostLaunchReview(postLaunch) && preview.length < max) preview.push({ field: "post-launch", label: "Post-launch", value: postLaunch.status === "healthy" ? "Healthy" : postLaunch.status === "needs-iteration" ? "Needs iteration" : postLaunch.status === "sunset" ? "Sunset" : "Pending" });
  return preview.slice(0, max);
}
