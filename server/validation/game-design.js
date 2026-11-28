// Kiểm phần game-design của payload board: các trần *_LIMITS, mọi validate* của
// game-design, normalizeGameDesignFlow và resolveGameDesignFields. Tách nguyên
// văn từ board-payload.js; nguyên tắc "chặn nhầm là mất bài" ở đầu
// validation/board.js áp cho cả file này.

import {
  GAME_DESIGN_BRIEF_LIMITS,
  GAME_DESIGN_FLOW_LIMITS,
  GAME_DESIGN_DETAIL_LIMITS,
  GAME_DESIGN_TECHNICAL_NOTES_LIMIT,
  GAME_DESIGN_PLAYTEST_LIMITS,
  GAME_DESIGN_DECISION_LIMITS,
  GAME_DESIGN_BALANCE_LIMITS,
  GAME_DESIGN_HANDOFF_LIMITS,
  GAME_DESIGN_REVIEW_LIMITS,
  GAME_DESIGN_DELIVERY_LIMITS,
  GAME_DESIGN_ANALYTICS_LIMITS,
  GAME_DESIGN_AB_TEST_LIMITS,
  GAME_DESIGN_LIVE_OPS_LIMITS,
  GAME_DESIGN_POST_LAUNCH_LIMITS,
  REVIEW_OUTCOMES,
  POST_LAUNCH_STATUSES,
  AB_TEST_STATUSES,
  LIVE_OPS_STATUSES,
  TEAM_HANDOFF_STATUSES
} from "../../shared/game-design-limits.js";

// Các trần *_LIMITS nằm ở shared/game-design-limits.js; re-export để mọi
// import cũ (board-payload.js, test) không phải đổi.
export {
  GAME_DESIGN_BRIEF_LIMITS,
  GAME_DESIGN_FLOW_LIMITS,
  GAME_DESIGN_DETAIL_LIMITS,
  GAME_DESIGN_TECHNICAL_NOTES_LIMIT,
  GAME_DESIGN_PLAYTEST_LIMITS,
  GAME_DESIGN_DECISION_LIMITS,
  GAME_DESIGN_BALANCE_LIMITS,
  GAME_DESIGN_HANDOFF_LIMITS,
  GAME_DESIGN_REVIEW_LIMITS,
  GAME_DESIGN_DELIVERY_LIMITS,
  GAME_DESIGN_ANALYTICS_LIMITS,
  GAME_DESIGN_AB_TEST_LIMITS,
  GAME_DESIGN_LIVE_OPS_LIMITS,
  GAME_DESIGN_POST_LAUNCH_LIMITS
};

export function validateGameDesignBrief(brief) {
  if (brief === undefined || brief === null) return null;
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) return "gameDesignBrief phải là object hoặc null";

  for (const field of ["genre", "targetAudience", "playerFantasy"]) {
    if (typeof brief[field] !== "string" || brief[field].length > GAME_DESIGN_BRIEF_LIMITS.text) {
      return `gameDesignBrief.${field} không hợp lệ`;
    }
  }

  if (!Array.isArray(brief.playerJourney) || brief.playerJourney.length > GAME_DESIGN_BRIEF_LIMITS.stages) {
    return "gameDesignBrief.playerJourney không hợp lệ";
  }
  for (const stage of brief.playerJourney) {
    if (!stage || typeof stage !== "object" || Array.isArray(stage)) return "gameDesignBrief.playerJourney chứa stage không hợp lệ";
    if (typeof stage.id !== "string" || !stage.id.trim() || stage.id.length > GAME_DESIGN_BRIEF_LIMITS.id) {
      return "gameDesignBrief.playerJourney.id không hợp lệ";
    }
    for (const field of ["title", "experience", "emotion"]) {
      if (typeof stage[field] !== "string" || stage[field].length > GAME_DESIGN_BRIEF_LIMITS.stageText) {
        return `gameDesignBrief.playerJourney.${field} không hợp lệ`;
      }
    }
  }
  return null;
}

function validateFlowItems(items, { collection, fields, limit, nodeIds }) {
  if (!Array.isArray(items) || items.length > limit) return `gameDesignFlow.${collection} không hợp lệ`;

  const itemIds = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return `gameDesignFlow.${collection} chứa item không hợp lệ`;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > GAME_DESIGN_FLOW_LIMITS.id || itemIds.has(item.id)) {
      return `gameDesignFlow.${collection}.id không hợp lệ`;
    }
    itemIds.add(item.id);
    for (const field of fields) {
      const required = field === "title";
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_FLOW_LIMITS.text || (required && !item[field].trim())) {
        return `gameDesignFlow.${collection}.${field} không hợp lệ`;
      }
    }
    if (!Array.isArray(item.cardIds)) return `gameDesignFlow.${collection}.cardIds không hợp lệ`;
    const references = new Set();
    for (const cardId of item.cardIds) {
      if (typeof cardId !== "string" || !cardId.trim() || cardId.length > GAME_DESIGN_FLOW_LIMITS.id || references.has(cardId) || !nodeIds.has(cardId)) {
        return `gameDesignFlow.${collection}.cardIds không hợp lệ`;
      }
      references.add(cardId);
    }
  }
  return null;
}

export function validateGameDesignFlow(flow, nodes) {
  if (flow === undefined || flow === null) return null;
  if (!flow || typeof flow !== "object" || Array.isArray(flow)) return "gameDesignFlow phải là object hoặc null";
  const nodeIds = new Set(Array.isArray(nodes) ? nodes.map((node) => String(node?.id)) : []);
  const loopInvalid = validateFlowItems(flow.playerLoop, {
    collection: "playerLoop", fields: ["title", "action", "outcome", "note"],
    limit: GAME_DESIGN_FLOW_LIMITS.playerLoop, nodeIds
  });
  if (loopInvalid) return loopInvalid;
  return validateFlowItems(flow.progressionMap, {
    collection: "progressionMap", fields: ["title", "objective", "unlocks", "description", "emotion"],
    limit: GAME_DESIGN_FLOW_LIMITS.progressionMap, nodeIds
  });
}

export function validateDesignDetailCollection(value, { key, fields, limit }) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > limit) return `${key} không hợp lệ`;
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return `${key} chứa item không hợp lệ`;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > GAME_DESIGN_DETAIL_LIMITS.id || ids.has(item.id)) return `${key}.id không hợp lệ`;
    ids.add(item.id);
    for (const field of fields) {
      const required = field === "title" || field === "condition" || field === "name";
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_DETAIL_LIMITS.text || (required && !item[field].trim())) return `${key}.${field} không hợp lệ`;
    }
  }
  return null;
}

function validateCardReferences(cardIds, key, nodeIds, limit) {
  if (!Array.isArray(cardIds) || cardIds.length > limit) return `${key}.cardIds không hợp lệ`;
  const references = new Set();
  for (const cardId of cardIds) {
    if (typeof cardId !== "string" || !cardId.trim() || cardId.length > GAME_DESIGN_DECISION_LIMITS.id || references.has(cardId) || !nodeIds.has(cardId)) return `${key}.cardIds không hợp lệ`;
    references.add(cardId);
  }
  return null;
}

export function validatePlaytestSession(value, nodeIds) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "playtestSession không hợp lệ";
  for (const field of ["objective", "hypothesis", "buildVersion", "playerGroup", "testDate", "observations", "metrics", "playerFeedback", "problemsFound"]) {
    if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_PLAYTEST_LIMITS.text) return `playtestSession.${field} không hợp lệ`;
  }
  return validateCardReferences(value.cardIds, "playtestSession", nodeIds, GAME_DESIGN_PLAYTEST_LIMITS.references);
}

export function validateDecisionLog(value, nodeIds) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > GAME_DESIGN_DECISION_LIMITS.entries) return "decisionLog không hợp lệ";
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "decisionLog chứa item không hợp lệ";
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > GAME_DESIGN_DECISION_LIMITS.id || ids.has(item.id)) return "decisionLog.id không hợp lệ";
    ids.add(item.id);
    for (const field of ["decision", "rationale", "evidence", "alternatives", "owner", "date"]) {
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_DECISION_LIMITS.text || (field === "decision" && !item[field].trim())) return `decisionLog.${field} không hợp lệ`;
    }
    if (item.status !== "active" && item.status !== "replaced") return "decisionLog.status không hợp lệ";
    const invalidReferences = validateCardReferences(item.cardIds, "decisionLog", nodeIds, GAME_DESIGN_DECISION_LIMITS.references);
    if (invalidReferences) return invalidReferences;
  }
  return null;
}

export function validateGameDesignBalance(value, nodes) {
  if (value === undefined || value === null) return null;
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    !Array.isArray(value.metrics) || value.metrics.length > GAME_DESIGN_BALANCE_LIMITS.metrics ||
    (value.curves !== undefined && (!Array.isArray(value.curves) || value.curves.length > GAME_DESIGN_BALANCE_LIMITS.curves))
  ) return "gameDesignBalance không hợp lệ";
  const keys = new Set(), ids = new Set(), nodeIds = new Set((nodes || []).map((node) => String(node?.id)));
  for (const item of value.metrics) {
    if (
      !item || typeof item !== "object" || Array.isArray(item) ||
      typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) ||
      typeof item.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(item.key) || keys.has(item.key)
    ) return "gameDesignBalance.metric không hợp lệ";
    ids.add(item.id); keys.add(item.key);
    for (const field of ["name", "value", "min", "max", "unit", "formula"]) {
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_BALANCE_LIMITS.text || (field === "name" && !item[field].trim())) {
        return `gameDesignBalance.${field} không hợp lệ`;
      }
    }
    const invalid = validateCardReferences(item.cardIds, "gameDesignBalance", nodeIds, GAME_DESIGN_BALANCE_LIMITS.references); if (invalid) return invalid;
  }
  const curveIds = new Set();
  for (const curve of value.curves || []) {
    if (
      !curve || typeof curve !== "object" || Array.isArray(curve) ||
      typeof curve.id !== "string" || !curve.id.trim() || curveIds.has(curve.id) ||
      typeof curve.name !== "string" || !curve.name.trim() ||
      typeof curve.metricKey !== "string" || !keys.has(curve.metricKey) ||
      typeof curve.start !== "string" || typeof curve.end !== "string" ||
      curve.start.length > GAME_DESIGN_BALANCE_LIMITS.text || curve.end.length > GAME_DESIGN_BALANCE_LIMITS.text ||
      !Number.isInteger(curve.steps) || curve.steps < 2 || curve.steps > GAME_DESIGN_BALANCE_LIMITS.curveSteps ||
      !["linear", "exponential"].includes(curve.mode)
    ) return "gameDesignBalance.curve không hợp lệ";
    curveIds.add(curve.id);
  }
  return null;
}

export function validateTeamHandoff(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "teamHandoff không hợp lệ";
  const configs = {
    dev: ["notes"], art: ["brief", "requirements", "references", "format", "naming"], audio: ["brief", "requirements", "references", "format", "naming"]
  };
  for (const [team, fields] of Object.entries(configs)) {
    const item = value[team];
    if (!item || typeof item !== "object" || Array.isArray(item)) return `teamHandoff.${team} không hợp lệ`;
    if (!TEAM_HANDOFF_STATUSES.includes(item.status)) return `teamHandoff.${team}.status không hợp lệ`;
    for (const field of ["owner", "handedOffAt", ...fields]) {
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_HANDOFF_LIMITS.text) return `teamHandoff.${team}.${field} không hợp lệ`;
    }
  }
  return null;
}
export function validateReview(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "review không hợp lệ";
  if (
    typeof value.reviewer !== "string" || value.reviewer.length > 4000 ||
    typeof value.date !== "string" || value.date.length > 4000 ||
    !REVIEW_OUTCOMES.includes(value.outcome)
  ) return "review metadata không hợp lệ";
  if (!Array.isArray(value.comments) || value.comments.length > GAME_DESIGN_REVIEW_LIMITS.comments) return "review.comments không hợp lệ";
  const ids = new Set();
  for (const item of value.comments) {
    if (
      !item || typeof item !== "object" ||
      typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) ||
      typeof item.text !== "string" || !item.text.trim() || item.text.length > GAME_DESIGN_REVIEW_LIMITS.text ||
      typeof item.author !== "string" || item.author.length > GAME_DESIGN_REVIEW_LIMITS.text ||
      typeof item.resolved !== "boolean"
    ) return "review.comment không hợp lệ";
    ids.add(item.id);
  }
  return null;
}
export function validateDelivery(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "delivery không hợp lệ";
  for (const field of ["milestone", "assignee", "deadline", "blocker"]) {
    if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_DELIVERY_LIMITS.text) return `delivery.${field} không hợp lệ`;
  }
  if (value.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(value.deadline)) return "delivery.deadline không hợp lệ";
  if (!["none", "risk", "blocked"].includes(value.blockerLevel)) return "delivery.blockerLevel không hợp lệ";
  return null;
}
export function validateAnalyticsEvents(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > GAME_DESIGN_ANALYTICS_LIMITS.events) return "analyticsEvents không hợp lệ";
  const ids = new Set();
  for (const event of value) {
    if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.id !== "string" || !event.id.trim() || ids.has(event.id)) return "analyticsEvents.id không hợp lệ";
    ids.add(event.id);
    for (const field of ["eventName", "trigger", "properties", "kpi", "owner"]) {
      if (typeof event[field] !== "string" || event[field].length > GAME_DESIGN_ANALYTICS_LIMITS.text || (field === "eventName" && !event[field].trim())) {
        return `analyticsEvents.${field} không hợp lệ`;
      }
    }
  }
  return null;
}
export function validateABTests(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > GAME_DESIGN_AB_TEST_LIMITS.tests) return "abTests không hợp lệ";
  const ids = new Set();
  for (const item of value) {
    if (
      !item || typeof item !== "object" || Array.isArray(item) ||
      typeof item.id !== "string" || !item.id.trim() || item.id.length > GAME_DESIGN_AB_TEST_LIMITS.id || ids.has(item.id)
    ) return "abTests.id không hợp lệ";
    ids.add(item.id);
    for (const field of ["hypothesis", "control", "variant", "primaryMetric", "successCriteria", "segment"]) {
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_AB_TEST_LIMITS.text || (field === "hypothesis" && !item[field].trim())) {
        return `abTests.${field} không hợp lệ`;
      }
    }
    if (!AB_TEST_STATUSES.includes(item.status)) return "abTests.status không hợp lệ";
  }
  return null;
}
export function validateLiveOps(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "liveOps không hợp lệ";
  for (const field of ["tuningNotes", "version", "featureFlag", "rolloutPercent", "audience", "rollbackPlan"]) {
    if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_LIVE_OPS_LIMITS.text) return `liveOps.${field} không hợp lệ`;
  }
  if (value.rolloutPercent && !/^(0|[1-9]\d?|100)$/.test(value.rolloutPercent)) return "liveOps.rolloutPercent không hợp lệ";
  if (!LIVE_OPS_STATUSES.includes(value.status)) return "liveOps.status không hợp lệ";
  return null;
}
export function validatePostLaunchReview(value, nodeIds) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "postLaunchReview không hợp lệ";
  for (const field of ["outcome", "actualMetrics", "learnings", "nextDecision", "owner", "reviewDate"]) {
    if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_POST_LAUNCH_LIMITS.text) return `postLaunchReview.${field} không hợp lệ`;
  }
  if (value.reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewDate)) return "postLaunchReview.reviewDate không hợp lệ";
  if (!POST_LAUNCH_STATUSES.includes(value.status)) return "postLaunchReview.status không hợp lệ";
  return validateCardReferences(value.cardIds, "postLaunchReview", nodeIds, GAME_DESIGN_POST_LAUNCH_LIMITS.references);
}
export function validateFollowUpTasks(value, nodeIds) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 20) return "followUpTasks không hợp lệ";
  const ids = new Set();
  for (const task of value) {
    if (!task || typeof task !== "object" || Array.isArray(task) || typeof task.id !== "string" || !task.id.trim() || ids.has(task.id)) return "followUpTasks.id không hợp lệ";
    ids.add(task.id);
    for (const field of ["text", "owner", "deadline"]) {
      if (typeof task[field] !== "string" || task[field].length > 4000 || (field === "text" && !task[field].trim())) return `followUpTasks.${field} không hợp lệ`;
    }
    if (task.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(task.deadline)) return "followUpTasks.deadline không hợp lệ";
    if (typeof task.done !== "boolean") return "followUpTasks.done không hợp lệ";
    const invalidRefs = validateCardReferences(task.cardIds, "followUpTasks", nodeIds, 100); if (invalidRefs) return invalidRefs;
  }
  return null;
}

export function normalizeGameDesignFlow(flow) {
  if (flow === undefined || flow === null) return flow;
  if (!flow || typeof flow !== "object" || Array.isArray(flow)) return flow;
  const canNormalizeItems = (items, fields) => Array.isArray(items) && items.every((item) => (
    item && typeof item === "object" && !Array.isArray(item) &&
    typeof item.id === "string" && fields.every((field) => typeof item[field] === "string") &&
    Array.isArray(item.cardIds) && item.cardIds.every((cardId) => typeof cardId === "string")
  ));
  const loopFields = ["title", "action", "outcome", "note"];
  const progressionFields = ["title", "objective", "unlocks", "description", "emotion"];
  if (!canNormalizeItems(flow.playerLoop, loopFields) || !canNormalizeItems(flow.progressionMap, progressionFields)) return flow;
  const normalizeItems = (items, fields) => items.map((item) => ({
    ...Object.fromEntries(fields.map((field) => [field, item[field].trim()])),
    id: item.id.trim(),
    cardIds: item.cardIds.map((cardId) => cardId.trim())
  }));
  return {
    playerLoop: normalizeItems(flow.playerLoop, loopFields),
    progressionMap: normalizeItems(flow.progressionMap, progressionFields)
  };
}

// Client cũ không biết các field GD mới. Thiếu field vì vậy nghĩa là giữ lại,
// còn `null` là yêu cầu xóa tường minh từ client mới.
export function resolveGameDesignFields(body, current) {
  const owns = (field) => Object.prototype.hasOwnProperty.call(body, field);
  return {
    kind: owns("kind") ? body.kind : (current.kind || "idea"),
    gameDesignBrief: owns("gameDesignBrief") ? body.gameDesignBrief : (current.gameDesignBrief ?? null),
    gameDesignFlow: owns("gameDesignFlow") ? normalizeGameDesignFlow(body.gameDesignFlow) : (current.gameDesignFlow ?? null)
    , gameDesignBalance: owns("gameDesignBalance") ? body.gameDesignBalance : (current.gameDesignBalance ?? null)
  };
}
