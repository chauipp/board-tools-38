import { DESIGN_FIELD_LABELS, gameDesignType, isGameDesignRelation, relationDefinition } from "./types.js";
import { hasGameDesignBrief, normalizeGameDesignBrief } from "./brief.js";
import { hasGameDesignFlow, normalizeGameDesignFlow } from "./flow.js";
import { balanceCurveTable, evaluateBalanceFormula, normalizeGameDesignBalance } from "./balance.js";
import { normalizeAcceptanceCriteria, normalizeGameDesignDetails, normalizeTechnicalNotes } from "./details.js";
import { hasPlaytestSession, normalizePlaytestSession } from "./playtest.js";
import { normalizeDecisionLog } from "./decisions.js";
import { TEAM_HANDOFF_TEAMS, normalizeTeamHandoff } from "./handoff.js";
import { normalizeReview } from "./review.js";
import { hasDelivery, normalizeDelivery } from "./delivery.js";
import { normalizeAnalyticsEvents } from "./analytics.js";
import { normalizeABTests } from "./ab-tests.js";
import { hasLiveOps, normalizeLiveOps } from "./live-ops.js";
import { hasPostLaunchReview, normalizePostLaunchReview } from "./post-launch.js";
import { normalizeFollowUpTasks } from "./follow-ups.js";

export function exportVersion(board) {
  return typeof board?.updatedAt === "string" && board.updatedAt.trim() ? board.updatedAt.trim() : "unsaved";
}

export function exportPackage(board, exportedAt = new Date().toISOString()) {
  return {
    format: "game-design-board-export/v1",
    exportedAt,
    boardName: String(board?.name || "Untitled").trim() || "Untitled",
    boardKind: board?.kind || "game-design",
    version: exportVersion(board),
    board
  };
}

export function gameDesignMarkdown(board, options = {}) {
  const lines = [`# ${board.name}`, "", `**Export version:** ${exportVersion(board)}`, ""];
  const handoffTeam = TEAM_HANDOFF_TEAMS.find((team) => team.id === options.team) || null;
  const selectedNodeIds = Array.isArray(options.nodeIds) ? new Set(options.nodeIds.map((id) => String(id))) : null;
  const nodes = (board.nodes || []).filter((node) => !selectedNodeIds || selectedNodeIds.has(String(node.id)));
  const brief = normalizeGameDesignBrief(board.gameDesignBrief);
  if (hasGameDesignBrief(brief)) {
    lines.push("## Game Context", "");
    const contextFields = [
      ["Genre", brief.genre],
      ["Target audience", brief.targetAudience],
      ["Player fantasy", brief.playerFantasy]
    ];
    for (const [label, value] of contextFields) {
      if (value) lines.push(`**${label}**`, "", value, "");
    }
    if (brief.playerJourney.length) {
      lines.push("**Player journey**", "");
      brief.playerJourney.forEach((stage, index) => {
        const details = [stage.experience, stage.emotion].filter(Boolean).join(" · ");
        lines.push(`${index + 1}. **${stage.title}**${details ? ` — ${details}` : ""}`);
      });
      lines.push("");
    }
  }
  const nodeById = new Map((board.nodes || []).map((node) => [String(node.id), node]));
  const flow = normalizeGameDesignFlow(board.gameDesignFlow, board.nodes);
  if (hasGameDesignFlow(flow)) {
    lines.push("## Game Flow", "");
    const formatReferences = (cardIds) => {
      const titles = cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean);
      return titles.length ? `Thẻ: ${titles.join(", ")}` : "";
    };
    if (flow.playerLoop.length) {
      lines.push("**Player Loop**", "");
      flow.playerLoop.forEach((step, index) => {
        const detail = [step.action && step.outcome ? `${step.action} → ${step.outcome}` : step.action || step.outcome, step.note, formatReferences(step.cardIds)].filter(Boolean).join(" · ");
        lines.push(`${index + 1}. **${step.title}**${detail ? ` — ${detail}` : ""}`);
      });
      lines.push("");
    }
    if (flow.progressionMap.length) {
      lines.push("**Progression Map**", "");
      flow.progressionMap.forEach((milestone, index) => {
        const detail = [
          milestone.objective,
          milestone.unlocks && `Mở khóa: ${milestone.unlocks}`,
          milestone.description,
          milestone.emotion,
          formatReferences(milestone.cardIds)
        ].filter(Boolean).join(" · ");
        lines.push(`${index + 1}. **${milestone.title}**${detail ? ` — ${detail}` : ""}`);
      });
      lines.push("");
    }
  }
  const balance = normalizeGameDesignBalance(board.gameDesignBalance, board.nodes);
  if (balance.metrics.length) {
    lines.push("## Balance Sheet", "");
    const nodeById = new Map((board.nodes || []).map((node) => [String(node.id), node]));
    const vars = Object.fromEntries(balance.metrics.map((metric) => [metric.key, metric.value]));
    balance.metrics.forEach((metric) => {
      const calculated = metric.formula ? evaluateBalanceFormula(metric.formula, vars) : { value: metric.value, error: "" };
      const value = calculated.error ? `Lỗi: ${calculated.error}` : calculated.value;
      const extras = [
        metric.unit,
        metric.min && `Min ${metric.min}`,
        metric.max && `Max ${metric.max}`,
        metric.formula && `Formula: ${metric.formula}`,
        metric.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ")
          && `Cards: ${metric.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ")}`
      ].filter(Boolean).join(" · ");
      lines.push(`- **${metric.name}** (${metric.key}): ${value ?? ""}${extras ? ` — ${extras}` : ""}`);
    }); lines.push("");
    if (balance.curves.length) {
      lines.push("**Progression Curves**", "");
      balance.curves.forEach((curve) => {
        const table = balanceCurveTable(curve);
        const range = table.error ? `Lỗi: ${table.error}` : `${curve.start} → ${curve.end} · ${curve.steps} mốc · ${curve.mode}`;
        lines.push(`- **${curve.name}** (${curve.metricKey}): ${range}`);
      });
      lines.push("");
    }
  }
  lines.push("## Game Design", "");
  for (const node of nodes) {
    const template = gameDesignType(node.type);
    lines.push(`### ${node.title} — ${template.label}`, "");
    if (node.desc) lines.push(node.desc, "");
    for (const field of template.fields) {
      const value = node.design?.[field];
      if (field === "acceptanceCriteria") {
        const criteria = normalizeAcceptanceCriteria(value);
        if (criteria.length) {
          lines.push(`**${DESIGN_FIELD_LABELS[field]}**`, "");
          for (const item of criteria) lines.push(`- [${item.done ? "x" : " "}] ${item.text}`);
          lines.push("");
        }
        continue;
      }
      if (value) lines.push(`**${DESIGN_FIELD_LABELS[field]}**`, "", value, "");
    }
    const details = normalizeGameDesignDetails(node.design);
    if (details.examples.length) {
      lines.push("**Examples**", "");
      details.examples.forEach((item, index) => lines.push(
        `${index + 1}. **${item.title}**${[item.scenario, item.expectedResult].filter(Boolean).length
          ? ` — ${[item.scenario, item.expectedResult].filter(Boolean).join(" → ")}`
          : ""}`
      ));
      lines.push("");
    }
    if (details.failureStates.length) {
      lines.push("**Failure states**", "");
      details.failureStates.forEach((item, index) => lines.push(
        `${index + 1}. **${item.condition}**${[item.playerFeedback, item.recovery].filter(Boolean).length
          ? ` — ${[item.playerFeedback, item.recovery].filter(Boolean).join(" · ")}`
          : ""}`
      ));
      lines.push("");
    }
    if (details.tuningParameters.length) {
      lines.push("**Tuning parameters**", "");
      details.tuningParameters.forEach((item) => {
        const values = [
          item.defaultValue && `Default: ${item.defaultValue}`,
          item.min && `Min: ${item.min}`,
          item.max && `Max: ${item.max}`,
          item.unit && `Unit: ${item.unit}`,
          item.note
        ].filter(Boolean);
        lines.push(`- **${item.name}**${values.length ? ` — ${values.join(" · ")}` : ""}`);
      });
      lines.push("");
    }
    const technicalNotes = normalizeTechnicalNotes(node.design?.technicalNotes);
    const playerExperience = String(node.design?.playerExperience || "").trim();
    if (playerExperience) lines.push(`**${DESIGN_FIELD_LABELS.playerExperience}**`, "", playerExperience, "");
    if (!handoffTeam || handoffTeam.id === "dev") {
      if (technicalNotes) lines.push("**Technical notes**", "", technicalNotes, "");
    }
    const delivery = normalizeDelivery(node.design?.delivery);
    if (hasDelivery(delivery)) {
      const fields = [
        ["Milestone", delivery.milestone],
        ["Assignee", delivery.assignee],
        ["Deadline", delivery.deadline],
        [delivery.blockerLevel === "blocked" ? "Blocker" : "Risk", delivery.blocker]
      ];
      lines.push("**Delivery**", "");
      for (const [label, value] of fields) if (value) lines.push(`- **${label}:** ${value}`);
      lines.push("");
    }
    const analyticsEvents = normalizeAnalyticsEvents(node.design?.analyticsEvents);
    if (analyticsEvents.length) {
      lines.push("**Analytics events**", "");
      analyticsEvents.forEach((event) => {
        const details = [["Trigger", event.trigger], ["Properties", event.properties], ["KPI", event.kpi], ["Owner", event.owner]]
          .filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
        lines.push(`- **${event.eventName}**${details ? ` — ${details}` : ""}`);
      });
      lines.push("");
    }
    const abTests = normalizeABTests(node.design?.abTests);
    if (abTests.length) {
      lines.push("**A/B test hypotheses**", "");
      abTests.forEach((item) => {
        const status = { draft: "Draft", running: "Running", concluded: "Concluded", rejected: "Rejected" }[item.status];
        const details = [
          ["Control", item.control],
          ["Variant", item.variant],
          ["Primary metric", item.primaryMetric],
          ["Success criteria", item.successCriteria],
          ["Segment", item.segment],
          ["Status", status]
        ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
        lines.push(`- **${item.hypothesis}**${details ? ` — ${details}` : ""}`);
      });
      lines.push("");
    }
    const liveOps = normalizeLiveOps(node.design?.liveOps);
    if (hasLiveOps(liveOps)) {
      const status = { planned: "Planned", running: "Running", paused: "Paused", full: "Full rollout", "rolled-back": "Rolled back" }[liveOps.status];
      const fields = [
        ["Version", liveOps.version],
        ["Feature flag", liveOps.featureFlag],
        ["Rollout", liveOps.rolloutPercent && `${liveOps.rolloutPercent}%`],
        ["Audience", liveOps.audience],
        ["Status", status],
        ["Tuning notes", liveOps.tuningNotes],
        ["Rollback plan", liveOps.rollbackPlan]
      ];
      lines.push("**Live tuning & rollout**", "");
      for (const [label, value] of fields) if (value) lines.push(`- **${label}:** ${value}`);
      lines.push("");
    }
    const postLaunch = normalizePostLaunchReview(node.design?.postLaunchReview, board.nodes);
    if (hasPostLaunchReview(postLaunch)) {
      const status = { pending: "Pending", healthy: "Healthy", "needs-iteration": "Needs iteration", sunset: "Sunset" }[postLaunch.status];
      const refs = postLaunch.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ");
      const fields = [
        ["Status", status],
        ["Outcome", postLaunch.outcome],
        ["Actual metrics", postLaunch.actualMetrics],
        ["Learnings", postLaunch.learnings],
        ["Next decision", postLaunch.nextDecision],
        ["Owner", postLaunch.owner],
        ["Review date", postLaunch.reviewDate],
        ["Related cards", refs]
      ];
      lines.push("**Post-launch review**", "");
      for (const [label, value] of fields) if (value) lines.push(`- **${label}:** ${value}`);
      lines.push("");
    }
    const followUps = normalizeFollowUpTasks(node.design?.followUpTasks, board.nodes);
    if (followUps.length) {
      lines.push("**Follow-up tasks**", "");
      followUps.forEach((task) => {
        const refs = task.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ");
        const details = [["Owner", task.owner], ["Deadline", task.deadline], ["Cards", refs]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
        lines.push(`- [${task.done ? "x" : " "}] ${task.text}${details ? ` — ${details}` : ""}`);
      }); lines.push("");
    }
    if (handoffTeam) {
      const handoff = normalizeTeamHandoff(node.design?.teamHandoff)[handoffTeam.id];
      const status = handoff.status === "handed-off" ? "Đã bàn giao" : handoff.status === "ready" ? "Sẵn sàng bàn giao" : "Bản nháp";
      const meta = [["Trạng thái", status], ["Người nhận", handoff.owner], ["Ngày bàn giao", handoff.handedOffAt]];
      const fields = handoffTeam.id === "dev" ? [["Ghi chú bàn giao", handoff.notes]] : [
        ["Brief", handoff.brief],
        ["Requirements", handoff.requirements],
        ["Reference", handoff.references],
        ["Format", handoff.format],
        ["Naming convention", handoff.naming]
      ];
      if (meta.some(([, value]) => value) || fields.some(([, value]) => value)) {
        lines.push(`**${handoffTeam.label} handoff**`, "");
        for (const [label, value] of [...meta, ...fields]) if (value) lines.push(`- **${label}:** ${value}`);
        lines.push("");
      }
    }
    const review = normalizeReview(node.design?.review);
    if (review.outcome !== "pending" || review.comments.length) {
      lines.push("**Review**", "", ...[`- **Outcome:** ${review.outcome}`, review.reviewer && `- **Reviewer:** ${review.reviewer}`, review.date && `- **Date:** ${review.date}`].filter(Boolean));
      review.comments.filter((item) => !item.resolved).forEach((item) => lines.push(`- [ ] ${item.text}${item.author ? ` — ${item.author}` : ""}`));
      lines.push("");
    }
    if (node.type === "playtest") {
      const session = normalizePlaytestSession(node.design?.playtestSession, board.nodes);
      if (hasPlaytestSession(session)) {
        lines.push("**Playtest session**", "");
        const fields = [
          ["Objective", session.objective],
          ["Hypothesis", session.hypothesis],
          ["Build/version", session.buildVersion],
          ["Player group", session.playerGroup],
          ["Date", session.testDate],
          ["Observations", session.observations],
          ["Metrics", session.metrics],
          ["Player feedback", session.playerFeedback],
          ["Problems found", session.problemsFound]
        ];
        for (const [label, value] of fields) if (value) lines.push(`- **${label}:** ${value}`);
        const references = session.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean);
        if (references.length) lines.push(`- **Related cards:** ${references.join(", ")}`);
        lines.push("");
      }
    }
    const decisions = normalizeDecisionLog(node.design?.decisionLog, board.nodes);
    if (decisions.length) {
      lines.push("**Decision log**", "");
      decisions.forEach((item, index) => {
        const detail = [
          ["Status", item.status === "replaced" ? "Replaced" : "Active"],
          ["Rationale", item.rationale],
          ["Evidence", item.evidence],
          ["Alternatives", item.alternatives],
          ["Owner", item.owner],
          ["Date", item.date],
          ["Related cards", item.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ")]
        ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
        lines.push(`${index + 1}. **${item.decision}**${detail ? ` — ${detail}` : ""}`);
      });
      lines.push("");
    }
  }
  const relations = (board.edges || []).filter((edge) => isGameDesignRelation(edge.relation) &&
    (!selectedNodeIds || (selectedNodeIds.has(String(edge.from)) && selectedNodeIds.has(String(edge.to)))));
  if (relations.length) {
    lines.push("## Quan hệ", "");
    for (const edge of relations) {
      const from = nodeById.get(String(edge.from));
      const to = nodeById.get(String(edge.to));
      if (from && to) lines.push(`- ${from.title} — ${relationDefinition(edge.relation).label} → ${to.title}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
