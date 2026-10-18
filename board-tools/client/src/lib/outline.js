import { nodesInFrame } from "./board-geometry.js";

export function buildOutline(board, sizeOf) {
  const used = new Set();
  const frames = board.groups.map((g) => {
    const nodeIds = nodesInFrame(board.nodes, g, sizeOf);
    nodeIds.forEach((id) => used.add(id));
    return { group: g, nodeIds };
  });
  const byStatus = new Map();
  board.nodes.forEach((n) => {
    if (used.has(n.id)) return;
    const key = n.statusId ?? "none";
    if (!byStatus.has(key)) byStatus.set(key, []);
    byStatus.get(key).push(n.id);
  });
  return { frames, byStatus };
}

export function outlineToMarkdown(board, sizeOf, labels) {
  const { frames, byStatus } = buildOutline(board, sizeOf);
  const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
  const statusName = (id) => board.statuses.find((s) => s.id === id)?.name ?? null;
  const tagName = (id) => board.tags.find((t) => t.id === id)?.name ?? null;
  const cardLine = (n) => {
    const meta = [statusName(n.statusId), tagName(n.tagId)].filter(Boolean).join(", ");
    const desc = n.desc ? `: ${n.desc.replace(/\n+/g, " ")}` : "";
    return `- ${n.title}${meta ? ` (${meta})` : ""}${desc}`;
  };
  const lines = [];
  frames.forEach(({ group, nodeIds }) => {
    lines.push(`## ${group.title}`, "");
    nodeIds.forEach((id) => lines.push(cardLine(nodeById.get(id))));
    lines.push("");
  });
  byStatus.forEach((ids, key) => {
    lines.push(`## ${key === "none" ? labels.other : statusName(key) ?? labels.other}`, "");
    ids.forEach((id) => lines.push(cardLine(nodeById.get(id))));
    lines.push("");
  });
  const endpointName = (id, kind) => (kind === "group"
    ? board.groups.find((g) => g.id === id)?.title
    : nodeById.get(id)?.title);
  const edgeLines = board.edges
    .map((e) => {
      const a = endpointName(e.from, e.fromKind || "node");
      const b = endpointName(e.to, e.toKind || "node");
      return a && b ? `- ${a} → ${b}` : null;
    })
    .filter(Boolean);
  if (edgeLines.length) lines.push(`## ${labels.links}`, "", ...edgeLines, "");
  return lines.join("\n");
}
