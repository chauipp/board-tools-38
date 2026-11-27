import { normalizeGameDesignBalance } from "./balance.js";
import { normalizeDecisionLog } from "./decisions.js";
import { hasDelivery } from "./delivery.js";
import { normalizeFollowUpTasks } from "./follow-ups.js";
import { gameDesignMarkdown } from "./export.js";

export const GAME_DESIGN_REPORTS = [
  { id: "gdd", label: "GDD tổng hợp", description: "Context, flow, balance và toàn bộ game design cards." },
  { id: "mechanics", label: "Mechanics catalogue", description: "Mechanic, character/unit và skill/item." },
  { id: "level-economy", label: "Level & economy", description: "Quest/level và các card được liên kết từ balance sheet." },
  { id: "playtest-decisions", label: "Playtest & decisions", description: "Playtest sessions cùng các card có decision log." },
  { id: "delivery", label: "Delivery report", description: "Các card có milestone, blocker hoặc follow-up task." }
];

export function gameDesignReportNodeIds(board, reportId) {
  const nodes = Array.isArray(board?.nodes) ? board.nodes : [];
  if (reportId === "gdd") return null;
  if (reportId === "mechanics") return nodes.filter((node) => ["mechanic", "character", "skill-item"].includes(node.type)).map((node) => node.id);
  if (reportId === "level-economy") {
    const balanceIds = normalizeGameDesignBalance(board?.gameDesignBalance, nodes).metrics.flatMap((metric) => metric.cardIds);
    return nodes.filter((node) => node.type === "quest-level" || balanceIds.includes(String(node.id))).map((node) => node.id);
  }
  if (reportId === "playtest-decisions") return nodes.filter((node) => node.type === "playtest" || normalizeDecisionLog(node.design?.decisionLog, nodes).length > 0).map((node) => node.id);
  if (reportId === "delivery") return nodes.filter((node) => hasDelivery(node.design?.delivery) || normalizeFollowUpTasks(node.design?.followUpTasks, nodes).length > 0).map((node) => node.id);
  return [];
}

export function gameDesignReport(board, reportId = "gdd") {
  const report = GAME_DESIGN_REPORTS.find((item) => item.id === reportId) || GAME_DESIGN_REPORTS[0];
  const nodeIds = gameDesignReportNodeIds(board, report.id);
  const markdown = gameDesignMarkdown({ ...board, name: `${board?.name || "Untitled"} — ${report.label}` }, nodeIds ? { nodeIds } : {});
  return `<!-- Report: ${report.id} -->\n\n${markdown}`;
}
