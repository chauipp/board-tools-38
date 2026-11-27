import { normalizeGameDesignBalance } from "./game-design-balance.js";

export const GAME_DESIGN_TYPES = [
  { id: "pillar", label: "Game Pillar", fields: ["goal", "rules", "owner", "priority", "acceptanceCriteria"] },
  { id: "core-loop", label: "Core Loop", fields: ["goal", "inputs", "outputs", "rules", "acceptanceCriteria"] },
  { id: "mechanic", label: "Mechanic / System", fields: ["goal", "inputs", "rules", "outputs", "edgeCases", "dependencies", "owner", "priority", "acceptanceCriteria"] },
  { id: "character", label: "Character / Unit", fields: ["goal", "rules", "outputs", "dependencies", "owner", "acceptanceCriteria"] },
  { id: "skill-item", label: "Skill / Item", fields: ["goal", "inputs", "rules", "outputs", "edgeCases", "dependencies", "priority", "acceptanceCriteria"] },
  { id: "quest-level", label: "Quest / Level", fields: ["goal", "inputs", "rules", "outputs", "edgeCases", "dependencies", "owner", "priority", "acceptanceCriteria"] },
  { id: "ui-ux", label: "UI / UX", fields: ["goal", "inputs", "outputs", "edgeCases", "dependencies", "owner", "acceptanceCriteria"] },
  { id: "playtest", label: "Playtest", fields: ["goal", "inputs", "outputs", "edgeCases", "owner", "priority", "acceptanceCriteria"] }
];

export const DESIGN_FIELD_LABELS = {
  goal: "Mục tiêu người chơi",
  rules: "Luật hoạt động",
  inputs: "Input / điều khiển",
  outputs: "Kết quả / phần thưởng",
  edgeCases: "Trường hợp đặc biệt",
  dependencies: "Phụ thuộc / liên kết",
  owner: "Người phụ trách",
  priority: "Ưu tiên",
  acceptanceCriteria: "Acceptance criteria",
  playerExperience: "Trải nghiệm người chơi"
};

export const TEAM_HANDOFF_TEAMS = [
  { id: "dev", label: "Dev", fields: ["notes"] },
  { id: "art", label: "Art", fields: ["brief", "requirements", "references", "format", "naming"] },
  { id: "audio", label: "Audio", fields: ["brief", "requirements", "references", "format", "naming"] }
];
const TEAM_HANDOFF_STATUSES = new Set(["draft", "ready", "handed-off"]);

export function emptyGameDesignBrief() {
  return { genre: "", targetAudience: "", playerFantasy: "", playerJourney: [] };
}

export function normalizeGameDesignBrief(value) {
  const brief = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const text = (key) => typeof brief[key] === "string" ? brief[key].trim() : "";
  return {
    genre: text("genre"),
    targetAudience: text("targetAudience"),
    playerFantasy: text("playerFantasy"),
    playerJourney: Array.isArray(brief.playerJourney) ? brief.playerJourney
      .filter((stage) => stage && typeof stage === "object" && !Array.isArray(stage))
      .map((stage, index) => ({
        id: typeof stage.id === "string" && stage.id.trim() ? stage.id.trim() : `journey-${index + 1}`,
        title: typeof stage.title === "string" ? stage.title.trim() : "",
        experience: typeof stage.experience === "string" ? stage.experience.trim() : "",
        emotion: typeof stage.emotion === "string" ? stage.emotion.trim() : ""
      }))
      .filter((stage) => stage.title)
      : []
  };
}

export function hasGameDesignBrief(brief) {
  const normalized = normalizeGameDesignBrief(brief);
  return Boolean(normalized.genre || normalized.targetAudience || normalized.playerFantasy || normalized.playerJourney.length);
}

export function emptyGameDesignFlow() {
  return { playerLoop: [], progressionMap: [] };
}

export function emptyDelivery() { return { milestone: "", assignee: "", deadline: "", blocker: "", blockerLevel: "none" }; }

export function normalizeDelivery(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const text = (key) => typeof source[key] === "string" ? source[key].trim() : "";
  const deadline = text("deadline");
  return {
    milestone: text("milestone"), assignee: text("assignee"),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : "",
    blocker: text("blocker"),
    blockerLevel: ["risk", "blocked"].includes(source.blockerLevel) ? source.blockerLevel : "none"
  };
}

export function hasDelivery(value) {
  const delivery = normalizeDelivery(value);
  return Boolean(delivery.milestone || delivery.assignee || delivery.deadline || delivery.blocker);
}

export function normalizeAnalyticsEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => ({
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `analytics-${index + 1}`,
    eventName: typeof item.eventName === "string" ? item.eventName.trim() : "",
    trigger: typeof item.trigger === "string" ? item.trigger.trim() : "",
    properties: typeof item.properties === "string" ? item.properties.trim() : "",
    kpi: typeof item.kpi === "string" ? item.kpi.trim() : "",
    owner: typeof item.owner === "string" ? item.owner.trim() : ""
  })).filter((item) => item.eventName).slice(0, 20);
}

const AB_TEST_STATUSES = new Set(["draft", "running", "concluded", "rejected"]);

export function normalizeABTests(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => ({
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `ab-test-${index + 1}`,
    hypothesis: typeof item.hypothesis === "string" ? item.hypothesis.trim() : "",
    control: typeof item.control === "string" ? item.control.trim() : "",
    variant: typeof item.variant === "string" ? item.variant.trim() : "",
    primaryMetric: typeof item.primaryMetric === "string" ? item.primaryMetric.trim() : "",
    successCriteria: typeof item.successCriteria === "string" ? item.successCriteria.trim() : "",
    segment: typeof item.segment === "string" ? item.segment.trim() : "",
    status: AB_TEST_STATUSES.has(item.status) ? item.status : "draft"
  })).filter((item) => item.hypothesis).slice(0, 20);
}

export function abTestProgress(node) {
  const tests = normalizeABTests(node?.design?.abTests);
  return { total: tests.length, running: tests.filter((item) => item.status === "running").length };
}

const LIVE_OPS_STATUSES = new Set(["planned", "running", "paused", "full", "rolled-back"]);

export function emptyLiveOps() {
  return { tuningNotes: "", version: "", featureFlag: "", rolloutPercent: "", audience: "", status: "planned", rollbackPlan: "" };
}

export function normalizeLiveOps(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const text = (key) => typeof source[key] === "string" ? source[key].trim() : "";
  const rolloutPercent = text("rolloutPercent");
  return {
    tuningNotes: text("tuningNotes"), version: text("version"), featureFlag: text("featureFlag"),
    rolloutPercent: /^(0|[1-9]\d?|100)$/.test(rolloutPercent) ? rolloutPercent : "",
    audience: text("audience"), status: LIVE_OPS_STATUSES.has(source.status) ? source.status : "planned", rollbackPlan: text("rollbackPlan")
  };
}

export function hasLiveOps(value) {
  const liveOps = normalizeLiveOps(value);
  return Boolean(liveOps.tuningNotes || liveOps.version || liveOps.featureFlag || liveOps.rolloutPercent || liveOps.audience || liveOps.rollbackPlan);
}

const POST_LAUNCH_STATUSES = new Set(["pending", "healthy", "needs-iteration", "sunset"]);

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
    reviewDate: /^\d{4}-\d{2}-\d{2}$/.test(reviewDate) ? reviewDate : "", status: POST_LAUNCH_STATUSES.has(source.status) ? source.status : "pending",
    cardIds: Array.isArray(source.cardIds) ? source.cardIds.map((id) => String(id).trim()).filter((id, index, ids) => id && ids.indexOf(id) === index && (!nodeIds || nodeIds.has(id))) : []
  };
}

export function hasPostLaunchReview(value) {
  const review = normalizePostLaunchReview(value);
  return Boolean(review.outcome || review.actualMetrics || review.learnings || review.nextDecision || review.owner || review.reviewDate || review.cardIds.length);
}

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

function normalizeFlowItems(items, { prefix, fields, limit }, nodeIds) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => {
      const cardIds = Array.isArray(item.cardIds) ? item.cardIds
        .map((id) => String(id).trim())
        .filter((id, itemIndex, ids) => id && ids.indexOf(id) === itemIndex && (!nodeIds || nodeIds.has(id)))
        : [];
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${prefix}-${index + 1}`,
        ...Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""])),
        cardIds
      };
    })
    .filter((item) => item.title)
    .slice(0, limit);
}

export function normalizeGameDesignFlow(value, nodes) {
  const flow = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  return {
    playerLoop: normalizeFlowItems(flow.playerLoop, {
      prefix: "loop", fields: ["title", "action", "outcome", "note"], limit: 20
    }, nodeIds),
    progressionMap: normalizeFlowItems(flow.progressionMap, {
      prefix: "progression", fields: ["title", "objective", "unlocks", "description", "emotion"], limit: 30
    }, nodeIds)
  };
}

export function hasGameDesignFlow(flow) {
  const normalized = normalizeGameDesignFlow(flow);
  return Boolean(normalized.playerLoop.length || normalized.progressionMap.length);
}

export function emptyGameDesignDetails() {
  return { examples: [], failureStates: [], tuningParameters: [] };
}

export function emptyTeamHandoff() {
  return {
    dev: { status: "draft", owner: "", handedOffAt: "", notes: "" },
    art: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" },
    audio: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" }
  };
}

export function normalizeTeamHandoff(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const empty = emptyTeamHandoff();
  return Object.fromEntries(TEAM_HANDOFF_TEAMS.map(({ id, fields }) => {
    const item = input[id] && typeof input[id] === "object" && !Array.isArray(input[id]) ? input[id] : {};
    return [id, {
      status: TEAM_HANDOFF_STATUSES.has(item.status) ? item.status : "draft",
      owner: typeof item.owner === "string" ? item.owner.trim() : "",
      handedOffAt: typeof item.handedOffAt === "string" ? item.handedOffAt.trim() : "",
      ...Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : empty[id][field]]))
    }];
  }));
}

export function emptyPlaytestSession() {
  return { objective: "", hypothesis: "", buildVersion: "", playerGroup: "", testDate: "", observations: "", metrics: "", playerFeedback: "", problemsFound: "", cardIds: [] };
}

export function normalizePlaytestSession(value, nodes) {
  const session = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  const cardIds = Array.isArray(session.cardIds) ? session.cardIds
    .map((id) => String(id).trim())
    .filter((id, index, ids) => id && ids.indexOf(id) === index && (!nodeIds || nodeIds.has(id)))
    : [];
  return {
    ...Object.fromEntries(["objective", "hypothesis", "buildVersion", "playerGroup", "testDate", "observations", "metrics", "playerFeedback", "problemsFound"]
      .map((field) => [field, typeof session[field] === "string" ? session[field].trim() : ""])),
    cardIds
  };
}

export function hasPlaytestSession(session) {
  return Object.entries(normalizePlaytestSession(session)).some(([key, value]) => key === "cardIds" ? value.length : Boolean(value));
}

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

export function normalizeTechnicalNotes(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function emptyReview() { return { reviewer: "", date: "", outcome: "pending", comments: [] }; }
export function normalizeReview(value) {
  const review = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const outcomes = new Set(["pending", "approved", "changes-requested", "rejected"]);
  return {
    reviewer: typeof review.reviewer === "string" ? review.reviewer.trim() : "",
    date: typeof review.date === "string" ? review.date.trim() : "",
    outcome: outcomes.has(review.outcome) ? review.outcome : "pending",
    comments: (Array.isArray(review.comments) ? review.comments : []).filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `review-comment-${index + 1}`,
      text: typeof item.text === "string" ? item.text.trim() : "",
      author: typeof item.author === "string" ? item.author.trim() : "",
      resolved: item.resolved === true
    })).filter((item) => item.text).slice(0, 20)
  };
}

function normalizeDetailItems(items, { prefix, key, fields, limit }) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${prefix}-${index + 1}`,
      ...Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""]))
    }))
    .filter((item) => item[key])
    .slice(0, limit);
}

export function normalizeGameDesignDetails(value) {
  const details = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    examples: normalizeDetailItems(details.examples, { prefix: "example", key: "title", fields: ["title", "scenario", "expectedResult"], limit: 20 }),
    failureStates: normalizeDetailItems(details.failureStates, { prefix: "failure", key: "condition", fields: ["condition", "playerFeedback", "recovery"], limit: 20 }),
    tuningParameters: normalizeDetailItems(details.tuningParameters, { prefix: "tuning", key: "name", fields: ["name", "defaultValue", "min", "max", "unit", "note"], limit: 30 })
  };
}

export function normalizeAcceptanceCriteria(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [{ id: "ac-legacy-1", text, done: false }] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `ac-${index + 1}`,
      text: typeof item.text === "string" ? item.text.trim() : "",
      done: item.done === true
    }))
    .filter((item) => item.text);
}

export function acceptanceProgress(node) {
  const criteria = normalizeAcceptanceCriteria(node?.design?.acceptanceCriteria);
  return { done: criteria.filter((item) => item.done).length, total: criteria.length };
}

export function gameDesignType(type) {
  return GAME_DESIGN_TYPES.find((item) => item.id === type) || GAME_DESIGN_TYPES[2];
}

export function emptyDesign(type = "mechanic") {
  return {
    type,
    design: Object.fromEntries(Object.keys(DESIGN_FIELD_LABELS).map((key) => [
      key,
      key === "priority" ? "medium" : key === "acceptanceCriteria" ? [] : ""
    ]).concat([["technicalNotes", ""], ["playerExperience", ""], ["delivery", emptyDelivery()], ["teamHandoff", emptyTeamHandoff()], ["review", emptyReview()], ["analyticsEvents", []], ["followUpTasks", []], ["abTests", []], ["liveOps", emptyLiveOps()], ["postLaunchReview", emptyPostLaunchReview()]]))
  };
}

export function normalizeGameDesignCardDesign(design, nodes) {
  return {
    ...design,
    technicalNotes: normalizeTechnicalNotes(design?.technicalNotes),
    acceptanceCriteria: normalizeAcceptanceCriteria(design?.acceptanceCriteria),
    ...normalizeGameDesignDetails(design),
    playtestSession: normalizePlaytestSession(design?.playtestSession, nodes),
    decisionLog: normalizeDecisionLog(design?.decisionLog, nodes),
    teamHandoff: normalizeTeamHandoff(design?.teamHandoff),
    review: normalizeReview(design?.review),
    delivery: normalizeDelivery(design?.delivery),
    analyticsEvents: normalizeAnalyticsEvents(design?.analyticsEvents),
    followUpTasks: normalizeFollowUpTasks(design?.followUpTasks, nodes),
    abTests: normalizeABTests(design?.abTests),
    liveOps: normalizeLiveOps(design?.liveOps),
    postLaunchReview: normalizePostLaunchReview(design?.postLaunchReview, nodes)
  };
}

export function normalizeGameDesignBoard(board) {
  if (!board || board.kind !== "game-design") return board;
  // Older Game Design boards may point the counter at the seeded Archived status.
  const statuses = Array.isArray(board.statuses) ? board.statuses : [];
  const nextStatusId = statuses.reduce(
    (next, status) => Number.isFinite(status?.id) ? Math.max(next, status.id + 1) : next,
    board.nextStatusId || 1
  );
  return {
    ...board,
    nextStatusId,
    gameDesignBrief: normalizeGameDesignBrief(board.gameDesignBrief),
    gameDesignFlow: normalizeGameDesignFlow(board.gameDesignFlow, board.nodes),
    gameDesignBalance: normalizeGameDesignBalance(board.gameDesignBalance, board.nodes),
    nodes: (board.nodes || []).map((node) => node?.design ? {
      ...node,
      design: normalizeGameDesignCardDesign(node.design, board.nodes)
    } : node)
  };
}
