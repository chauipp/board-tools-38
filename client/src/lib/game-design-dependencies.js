import {
  normalizeDelivery,
  hasDelivery,
  normalizePlaytestSession,
  hasPlaytestSession
} from "./game-design-model.js";

export const RELATION_OPTIONS = [
  { id: "depends-on", label: "Phụ thuộc", description: "Nguồn cần đích hoàn tất hoặc tồn tại trước." },
  { id: "unlocks", label: "Mở khóa", description: "Nguồn mở ra hoặc cho phép sử dụng đích." },
  { id: "replaces", label: "Thay thế", description: "Nguồn thay cho phiên bản hoặc giải pháp ở đích." },
  { id: "conflicts-with", label: "Xung đột", description: "Hai thẻ không nên cùng được áp dụng." }
];

const RELATION_IDS = new Set(RELATION_OPTIONS.map((item) => item.id));

export function relationDefinition(relation) {
  return RELATION_OPTIONS.find((item) => item.id === relation) || RELATION_OPTIONS[0];
}

export function isGameDesignRelation(relation) {
  return RELATION_IDS.has(relation);
}

export function dependencyAnalysis(board) {
  const nodes = Array.isArray(board?.nodes) ? board.nodes : [];
  const ids = new Set(nodes.map((node) => String(node.id)));
  const prerequisites = new Map(nodes.map((node) => [String(node.id), []]));
  const dependents = new Map(nodes.map((node) => [String(node.id), []]));
  const edges = (board?.edges || []).filter((edge) => edge?.relation === "depends-on" && (edge.fromKind || "node") === "node" && (edge.toKind || "node") === "node" && ids.has(String(edge.from)) && ids.has(String(edge.to)));
  for (const edge of edges) { prerequisites.get(String(edge.from)).push(String(edge.to)); dependents.get(String(edge.to)).push(String(edge.from)); }
  const cycleNodeIds = new Set(), cycleEdgeIds = new Set();
  function reachable(start, target, seen = new Set()) {
    if (start === target) return true;
    if (seen.has(start)) return false; seen.add(start);
    return (prerequisites.get(start) || []).some((next) => reachable(next, target, seen));
  }
  for (const edge of edges) if (reachable(String(edge.to), String(edge.from))) { cycleEdgeIds.add(edge.id); cycleNodeIds.add(String(edge.from)); cycleNodeIds.add(String(edge.to)); }
  const done = new Set(nodes.filter((node) => String((board?.statuses || []).find((status) => status.id === node.statusId)?.name || "").trim().toLowerCase() === "done").map((node) => String(node.id)));
  const blockedNodeIds = new Set(nodes.filter((node) => (prerequisites.get(String(node.id)) || []).some((id) => !done.has(id))).map((node) => String(node.id)));
  function chainFrom(id) {
    const chain = [], seen = new Set(); let current = String(id);
    while (current && !seen.has(current)) { chain.push(current); seen.add(current); current = prerequisites.get(current)?.[0]; }
    return chain;
  }
  return { prerequisites, dependents, blockedNodeIds, cycleNodeIds, cycleEdgeIds, chainFrom };
}

export function playtestComparison(nodes) {
  return (Array.isArray(nodes) ? nodes : []).filter((node) => node.type === "playtest").map((node) => {
    const session = normalizePlaytestSession(node.design?.playtestSession, nodes);
    return { nodeId: node.id, title: node.title || `Thẻ ${node.id}`, ...session };
  }).filter((session) => hasPlaytestSession(session)).sort((a, b) => (b.testDate || "").localeCompare(a.testDate || ""));
}

export function dependencyImpact(board, cardId) {
  const analysis = dependencyAnalysis(board);
  const rootId = String(cardId ?? "");
  if (!analysis.prerequisites.has(rootId)) return { rootId, upstreamIds: [], downstreamIds: [], milestoneIds: [], riskIds: [], hasCycle: false };
  function walk(source) {
    const seen = new Set(), queue = [...(source.get(rootId) || [])];
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id) || id === rootId) continue;
      seen.add(id); queue.push(...(source.get(id) || []));
    }
    return [...seen];
  }
  const upstreamIds = walk(analysis.prerequisites), downstreamIds = walk(analysis.dependents);
  const nodeById = new Map((board?.nodes || []).map((node) => [String(node.id), node]));
  const today = new Date().toISOString().slice(0, 10);
  const milestoneIds = downstreamIds.filter((id) => hasDelivery(nodeById.get(id)?.design?.delivery) && normalizeDelivery(nodeById.get(id)?.design?.delivery).milestone);
  const riskIds = downstreamIds.filter((id) => {
    const delivery = normalizeDelivery(nodeById.get(id)?.design?.delivery);
    return analysis.blockedNodeIds.has(id) || delivery.blockerLevel !== "none" || Boolean(delivery.deadline && delivery.deadline < today);
  });
  return { rootId, upstreamIds, downstreamIds, milestoneIds, riskIds, hasCycle: analysis.cycleNodeIds.has(rootId) };
}
