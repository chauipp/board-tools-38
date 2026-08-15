// Kiểm payload của PUT /boards/:id trước khi ghi.
//
// Nguyên tắc quan trọng nhất ở file này: CHẶN NHẦM LÀ MẤT BÀI. Client autosave
// mỗi 500ms, nên một cú 400 sai chỗ nghĩa là người ta đang vẽ mà không có gì
// được lưu lại. Vì vậy chỗ này chỉ chặn những thứ KHÔNG THỂ là dữ liệu thật:
//
//   - sai kiểu (đáng lẽ là mảng mà lại là chuỗi)
//   - NaN / Infinity trong toạ độ — Mongo nhận tuốt, nhưng board đọc lên sau đó
//     không vẽ được và không có gì trên màn hình nói vì sao
//   - số lượng phi lý
//
// Ngưỡng đặt cao hơn board lớn nhất đang có hàng chục lần (lúc viết: 55 node,
// 64 nét vẽ, 702 điểm), nên việc dùng bình thường không bao giờ chạm tới. Đây là
// cửa chặn payload độc hại, không phải luật về việc bảng được to đến đâu.
//
// Field nào KHÔNG có trong payload thì bỏ qua, không coi là lỗi: findByIdAndUpdate
// bỏ qua field undefined, nên thiếu field nghĩa là "không đổi phần này".

export const BOARD_LIMITS = {
  nodes: 5000,
  edges: 10000,
  groups: 1000,
  drawings: 20000,
  statuses: 500,
  tags: 500,
  palette: 500,
  totalDrawingPoints: 300_000,
  titleLen: 1000,
  descLen: 100_000
};

export const GAME_DESIGN_BRIEF_LIMITS = { text: 4000, stageText: 1000, stages: 50, id: 120 };
export const GAME_DESIGN_FLOW_LIMITS = { text: 1000, playerLoop: 20, progressionMap: 30, id: 120 };
export const GAME_DESIGN_DETAIL_LIMITS = { text: 1000, id: 120, examples: 20, failureStates: 20, tuningParameters: 30 };
export const GAME_DESIGN_TECHNICAL_NOTES_LIMIT = 2000;
export const GAME_DESIGN_PLAYTEST_LIMITS = { text: 4000, references: 100 };
export const GAME_DESIGN_DECISION_LIMITS = { entries: 30, text: 4000, id: 120, references: 100 };
export const GAME_DESIGN_BALANCE_LIMITS = { metrics: 100, text: 4000, id: 120, references: 100 };
export const GAME_DESIGN_HANDOFF_LIMITS = { text: 4000 };
export const GAME_DESIGN_REVIEW_LIMITS = { comments: 20, text: 4000, id: 120 };
export const GAME_DESIGN_DELIVERY_LIMITS = { text: 4000 };
export const GAME_DESIGN_ANALYTICS_LIMITS = { events: 20, text: 4000 };
export const GAME_DESIGN_AB_TEST_LIMITS = { tests: 20, text: 4000, id: 120 };
export const GAME_DESIGN_LIVE_OPS_LIMITS = { text: 4000 };
export const GAME_DESIGN_POST_LAUNCH_LIMITS = { text: 4000, references: 100 };

const BOARD_KINDS = new Set(["idea", "game-design"]);
const RELATION_IDS = new Set(["depends-on", "unlocks", "replaces", "conflicts-with"]);

const LIST_FIELDS = ["nodes", "edges", "groups", "drawings", "statuses", "tags", "palette"];
const COUNTER_FIELDS = [
  "nextNodeId", "nextEdgeId", "nextGroupId",
  "nextStatusId", "nextTagId", "nextPaletteId", "nextDrawingId"
];

// Số "dùng được": phải là number thật, không NaN, không Infinity. Chuỗi số cũng
// bị loại — client luôn gửi number, nên chuỗi ở đây là dấu hiệu dữ liệu đã méo
// từ đâu đó chứ không phải người dùng làm gì lạ.
function badNumber(v) {
  return v !== undefined && v !== null && (typeof v !== "number" || !Number.isFinite(v));
}

function checkGeometry(item, where) {
  for (const key of ["id", "x", "y", "w", "h", "pdfH"]) {
    if (badNumber(item[key])) return `${where}.${key} không phải số dùng được`;
  }
  return null;
}

function validateGameDesignBrief(brief) {
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

function validateGameDesignFlow(flow, nodes) {
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

function validateDesignDetailCollection(value, { key, fields, limit }) {
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

function validatePlaytestSession(value, nodeIds) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "playtestSession không hợp lệ";
  for (const field of ["objective", "hypothesis", "buildVersion", "playerGroup", "testDate", "observations", "metrics", "playerFeedback", "problemsFound"]) {
    if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_PLAYTEST_LIMITS.text) return `playtestSession.${field} không hợp lệ`;
  }
  return validateCardReferences(value.cardIds, "playtestSession", nodeIds, GAME_DESIGN_PLAYTEST_LIMITS.references);
}

function validateDecisionLog(value, nodeIds) {
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

function validateGameDesignBalance(value, nodes) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.metrics) || value.metrics.length > GAME_DESIGN_BALANCE_LIMITS.metrics) return "gameDesignBalance không hợp lệ";
  const keys = new Set(), ids = new Set(), nodeIds = new Set((nodes || []).map((node) => String(node?.id)));
  for (const item of value.metrics) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) || typeof item.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(item.key) || keys.has(item.key)) return "gameDesignBalance.metric không hợp lệ";
    ids.add(item.id); keys.add(item.key);
    for (const field of ["name", "value", "min", "max", "unit", "formula"]) if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_BALANCE_LIMITS.text || (field === "name" && !item[field].trim())) return `gameDesignBalance.${field} không hợp lệ`;
    const invalid = validateCardReferences(item.cardIds, "gameDesignBalance", nodeIds, GAME_DESIGN_BALANCE_LIMITS.references); if (invalid) return invalid;
  }
  return null;
}

function validateTeamHandoff(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "teamHandoff không hợp lệ";
  const configs = {
    dev: ["notes"], art: ["brief", "requirements", "references", "format", "naming"], audio: ["brief", "requirements", "references", "format", "naming"]
  };
  for (const [team, fields] of Object.entries(configs)) {
    const item = value[team];
    if (!item || typeof item !== "object" || Array.isArray(item)) return `teamHandoff.${team} không hợp lệ`;
    if (!["draft", "ready", "handed-off"].includes(item.status)) return `teamHandoff.${team}.status không hợp lệ`;
    for (const field of ["owner", "handedOffAt", ...fields]) {
      if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_HANDOFF_LIMITS.text) return `teamHandoff.${team}.${field} không hợp lệ`;
    }
  }
  return null;
}
function validateReview(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "review không hợp lệ";
  if (typeof value.reviewer !== "string" || value.reviewer.length > 4000 || typeof value.date !== "string" || value.date.length > 4000 || !["pending", "approved", "changes-requested", "rejected"].includes(value.outcome)) return "review metadata không hợp lệ";
  if (!Array.isArray(value.comments) || value.comments.length > GAME_DESIGN_REVIEW_LIMITS.comments) return "review.comments không hợp lệ";
  const ids = new Set();
  for (const item of value.comments) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) || typeof item.text !== "string" || !item.text.trim() || item.text.length > GAME_DESIGN_REVIEW_LIMITS.text || typeof item.author !== "string" || item.author.length > GAME_DESIGN_REVIEW_LIMITS.text || typeof item.resolved !== "boolean") return "review.comment không hợp lệ";
    ids.add(item.id);
  }
  return null;
}
function validateDelivery(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "delivery không hợp lệ";
  for (const field of ["milestone", "assignee", "deadline", "blocker"]) if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_DELIVERY_LIMITS.text) return `delivery.${field} không hợp lệ`;
  if (value.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(value.deadline)) return "delivery.deadline không hợp lệ";
  if (!["none", "risk", "blocked"].includes(value.blockerLevel)) return "delivery.blockerLevel không hợp lệ";
  return null;
}
function validateAnalyticsEvents(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > GAME_DESIGN_ANALYTICS_LIMITS.events) return "analyticsEvents không hợp lệ";
  const ids = new Set();
  for (const event of value) {
    if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.id !== "string" || !event.id.trim() || ids.has(event.id)) return "analyticsEvents.id không hợp lệ";
    ids.add(event.id);
    for (const field of ["eventName", "trigger", "properties", "kpi", "owner"]) if (typeof event[field] !== "string" || event[field].length > GAME_DESIGN_ANALYTICS_LIMITS.text || (field === "eventName" && !event[field].trim())) return `analyticsEvents.${field} không hợp lệ`;
  }
  return null;
}
function validateABTests(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > GAME_DESIGN_AB_TEST_LIMITS.tests) return "abTests không hợp lệ";
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string" || !item.id.trim() || item.id.length > GAME_DESIGN_AB_TEST_LIMITS.id || ids.has(item.id)) return "abTests.id không hợp lệ";
    ids.add(item.id);
    for (const field of ["hypothesis", "control", "variant", "primaryMetric", "successCriteria", "segment"]) if (typeof item[field] !== "string" || item[field].length > GAME_DESIGN_AB_TEST_LIMITS.text || (field === "hypothesis" && !item[field].trim())) return `abTests.${field} không hợp lệ`;
    if (!["draft", "running", "concluded", "rejected"].includes(item.status)) return "abTests.status không hợp lệ";
  }
  return null;
}
function validateLiveOps(value) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "liveOps không hợp lệ";
  for (const field of ["tuningNotes", "version", "featureFlag", "rolloutPercent", "audience", "rollbackPlan"]) if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_LIVE_OPS_LIMITS.text) return `liveOps.${field} không hợp lệ`;
  if (value.rolloutPercent && !/^(0|[1-9]\d?|100)$/.test(value.rolloutPercent)) return "liveOps.rolloutPercent không hợp lệ";
  if (!["planned", "running", "paused", "full", "rolled-back"].includes(value.status)) return "liveOps.status không hợp lệ";
  return null;
}
function validatePostLaunchReview(value, nodeIds) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "postLaunchReview không hợp lệ";
  for (const field of ["outcome", "actualMetrics", "learnings", "nextDecision", "owner", "reviewDate"]) if (typeof value[field] !== "string" || value[field].length > GAME_DESIGN_POST_LAUNCH_LIMITS.text) return `postLaunchReview.${field} không hợp lệ`;
  if (value.reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewDate)) return "postLaunchReview.reviewDate không hợp lệ";
  if (!["pending", "healthy", "needs-iteration", "sunset"].includes(value.status)) return "postLaunchReview.status không hợp lệ";
  return validateCardReferences(value.cardIds, "postLaunchReview", nodeIds, GAME_DESIGN_POST_LAUNCH_LIMITS.references);
}
function validateFollowUpTasks(value, nodeIds) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 20) return "followUpTasks không hợp lệ";
  const ids = new Set();
  for (const task of value) {
    if (!task || typeof task !== "object" || Array.isArray(task) || typeof task.id !== "string" || !task.id.trim() || ids.has(task.id)) return "followUpTasks.id không hợp lệ";
    ids.add(task.id);
    for (const field of ["text", "owner", "deadline"]) if (typeof task[field] !== "string" || task[field].length > 4000 || (field === "text" && !task[field].trim())) return `followUpTasks.${field} không hợp lệ`;
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

// Trả về null nếu payload dùng được, hoặc một câu mô tả chỗ hỏng.
export function validateBoardPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "payload không phải object";
  if (body.kind !== undefined && !BOARD_KINDS.has(body.kind)) return "kind không hợp lệ";
  const briefInvalid = validateGameDesignBrief(body.gameDesignBrief);
  if (briefInvalid) return briefInvalid;
  if (body.gameDesignFlow !== undefined && body.gameDesignFlow !== null && body.kind !== "game-design") {
    return "gameDesignFlow chỉ dùng cho board game-design";
  }
  const flowInvalid = validateGameDesignFlow(body.gameDesignFlow, body.nodes);
  if (flowInvalid) return flowInvalid;
  if (body.gameDesignBalance !== undefined && body.gameDesignBalance !== null && body.kind !== "game-design") return "gameDesignBalance chỉ dùng cho board game-design";
  const balanceInvalid = validateGameDesignBalance(body.gameDesignBalance, body.nodes);
  if (balanceInvalid) return balanceInvalid;

  for (const field of LIST_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return `${field} phải là mảng`;
    if (value.length > BOARD_LIMITS[field]) {
      return `${field} có ${value.length} phần tử, vượt trần ${BOARD_LIMITS[field]}`;
    }
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return `${field} chứa phần tử không phải object`;
    }
  }

  for (const field of COUNTER_FIELDS) {
    if (badNumber(body[field])) return `${field} không phải số dùng được`;
  }

  for (const node of body.nodes || []) {
    const nodeIds = new Set((body.nodes || []).map((item) => String(item?.id)));
    const geo = checkGeometry(node, "node");
    if (geo) return geo;
    if (typeof node.title === "string" && node.title.length > BOARD_LIMITS.titleLen) {
      return `tiêu đề thẻ dài ${node.title.length} ký tự, vượt trần ${BOARD_LIMITS.titleLen}`;
    }
    if (typeof node.desc === "string" && node.desc.length > BOARD_LIMITS.descLen) {
      return `mô tả thẻ dài ${node.desc.length} ký tự, vượt trần ${BOARD_LIMITS.descLen}`;
    }
    if (node.type !== undefined && (typeof node.type !== "string" || node.type.length > 80)) {
      return "node.type không hợp lệ";
    }
    if (node.design !== undefined && (!node.design || typeof node.design !== "object" || Array.isArray(node.design))) {
      return "node.design phải là object";
    }
    if (node.design?.technicalNotes !== undefined && (typeof node.design.technicalNotes !== "string" || node.design.technicalNotes.length > GAME_DESIGN_TECHNICAL_NOTES_LIMIT)) {
      return "technicalNotes không hợp lệ";
    }
    if (node.design?.playerExperience !== undefined && (typeof node.design.playerExperience !== "string" || node.design.playerExperience.length > GAME_DESIGN_TECHNICAL_NOTES_LIMIT)) return "playerExperience không hợp lệ";
    const invalidTeamHandoff = validateTeamHandoff(node.design?.teamHandoff);
    if (invalidTeamHandoff) return invalidTeamHandoff;
    const invalidReview = validateReview(node.design?.review);
    if (invalidReview) return invalidReview;
    const invalidDelivery = validateDelivery(node.design?.delivery);
    if (invalidDelivery) return invalidDelivery;
    const invalidAnalytics = validateAnalyticsEvents(node.design?.analyticsEvents);
    if (invalidAnalytics) return invalidAnalytics;
    const invalidABTests = validateABTests(node.design?.abTests);
    if (invalidABTests) return invalidABTests;
    const invalidLiveOps = validateLiveOps(node.design?.liveOps);
    if (invalidLiveOps) return invalidLiveOps;
    const invalidPostLaunch = validatePostLaunchReview(node.design?.postLaunchReview, nodeIds);
    if (invalidPostLaunch) return invalidPostLaunch;
    const invalidFollowUps = validateFollowUpTasks(node.design?.followUpTasks, nodeIds);
    if (invalidFollowUps) return invalidFollowUps;
    const invalidPlaytest = validatePlaytestSession(node.design?.playtestSession, nodeIds);
    if (invalidPlaytest) return invalidPlaytest;
    const invalidDecisionLog = validateDecisionLog(node.design?.decisionLog, nodeIds);
    if (invalidDecisionLog) return invalidDecisionLog;
    const criteria = node.design?.acceptanceCriteria;
    if (criteria !== undefined) {
      if (typeof criteria !== "string" && !Array.isArray(criteria)) return "acceptanceCriteria phải là chuỗi hoặc mảng";
      if (Array.isArray(criteria)) {
        for (const item of criteria) {
          if (!item || typeof item !== "object" || Array.isArray(item)) return "acceptanceCriteria chứa phần tử không phải object";
          if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 120) return "acceptanceCriteria.id không hợp lệ";
          if (typeof item.text !== "string" || !item.text.trim() || item.text.length > BOARD_LIMITS.descLen) return "acceptanceCriteria.text không hợp lệ";
          if (typeof item.done !== "boolean") return "acceptanceCriteria.done không hợp lệ";
        }
      }
    }
    for (const spec of [
      { key: "examples", fields: ["title", "scenario", "expectedResult"], limit: GAME_DESIGN_DETAIL_LIMITS.examples },
      { key: "failureStates", fields: ["condition", "playerFeedback", "recovery"], limit: GAME_DESIGN_DETAIL_LIMITS.failureStates },
      { key: "tuningParameters", fields: ["name", "defaultValue", "min", "max", "unit", "note"], limit: GAME_DESIGN_DETAIL_LIMITS.tuningParameters }
    ]) {
      const invalidDetail = validateDesignDetailCollection(node.design?.[spec.key], spec);
      if (invalidDetail) return invalidDetail;
    }
  }

  for (const edge of body.edges || []) {
    if (badNumber(edge.id) || badNumber(edge.from) || badNumber(edge.to)) {
      return "dây nối có id/from/to không phải số dùng được";
    }
    if (edge.relation !== undefined && !RELATION_IDS.has(edge.relation)) return "relation không hợp lệ";
  }

  for (const group of body.groups || []) {
    const geo = checkGeometry(group, "khung");
    if (geo) return geo;
  }

  // Nét vẽ là chỗ dễ phình nhất: một nét là một mảng toạ độ, và số nét thì không
  // giới hạn. Đếm tổng số điểm chứ không chỉ đếm số nét — 10 nét mỗi nét một
  // triệu điểm vẫn lọt qua nếu chỉ đếm nét.
  let totalPoints = 0;
  for (const drawing of body.drawings || []) {
    if (badNumber(drawing.id)) return "nét vẽ có id không phải số dùng được";
    const pts = drawing.pts;
    if (pts === undefined) continue;
    if (!Array.isArray(pts)) return "nét vẽ có pts không phải mảng";
    totalPoints += pts.length;
    if (totalPoints > BOARD_LIMITS.totalDrawingPoints) {
      return `tổng số điểm của nét vẽ vượt trần ${BOARD_LIMITS.totalDrawingPoints}`;
    }
    for (const n of pts) {
      if (typeof n !== "number" || !Number.isFinite(n)) return "nét vẽ chứa toạ độ không phải số dùng được";
    }
  }

  return null;
}
