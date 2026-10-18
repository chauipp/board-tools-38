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

export const RELATION_OPTIONS = [
  { id: "depends-on", label: "Phụ thuộc", description: "Nguồn cần đích hoàn tất hoặc tồn tại trước." },
  { id: "unlocks", label: "Mở khóa", description: "Nguồn mở ra hoặc cho phép sử dụng đích." },
  { id: "replaces", label: "Thay thế", description: "Nguồn thay cho phiên bản hoặc giải pháp ở đích." },
  { id: "conflicts-with", label: "Xung đột", description: "Hai thẻ không nên cùng được áp dụng." }
];

export const TEAM_HANDOFF_TEAMS = [
  { id: "dev", label: "Dev", fields: ["notes"] },
  { id: "art", label: "Art", fields: ["brief", "requirements", "references", "format", "naming"] },
  { id: "audio", label: "Audio", fields: ["brief", "requirements", "references", "format", "naming"] }
];
const TEAM_HANDOFF_STATUSES = new Set(["draft", "ready", "handed-off"]);

export function exportVersion(board) {
  return typeof board?.updatedAt === "string" && board.updatedAt.trim() ? board.updatedAt.trim() : "unsaved";
}

export function exportPackage(board, exportedAt = new Date().toISOString()) {
  return { format: "game-design-board-export/v1", exportedAt, boardName: String(board?.name || "Untitled").trim() || "Untitled", boardKind: board?.kind || "game-design", version: exportVersion(board), board };
}

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

const RELATION_IDS = new Set(RELATION_OPTIONS.map((item) => item.id));

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

export function emptyGameDesignBalance() { return { metrics: [], curves: [] }; }

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

export const BALANCE_TEMPLATES = [
  { id: "combat", label: "Combat", metrics: [
    { key: "damage", name: "Sát thương", value: "10", min: "1", max: "999", unit: "HP", formula: "" },
    { key: "cooldown", name: "Cooldown", value: "1", min: "0", max: "60", unit: "s", formula: "" },
    { key: "dps", name: "Sát thương/giây", value: "", min: "0", max: "", unit: "HP/s", formula: "damage / cooldown" }
  ] },
  { id: "xp-level", label: "XP & Level", metrics: [
    { key: "level", name: "Level", value: "1", min: "1", max: "100", unit: "level", formula: "" },
    { key: "xp_to_next", name: "XP cần để lên cấp", value: "100", min: "1", max: "", unit: "XP", formula: "" },
    { key: "xp_reward", name: "XP mỗi lượt", value: "20", min: "0", max: "", unit: "XP", formula: "" }
  ] },
  { id: "drop-rate", label: "Drop rate", metrics: [
    { key: "common_rate", name: "Tỉ lệ Common", value: "70", min: "0", max: "100", unit: "%", formula: "" },
    { key: "rare_rate", name: "Tỉ lệ Rare", value: "25", min: "0", max: "100", unit: "%", formula: "" },
    { key: "legendary_rate", name: "Tỉ lệ Legendary", value: "5", min: "0", max: "100", unit: "%", formula: "" }
  ] },
  { id: "currency-flow", label: "Currency flow", metrics: [
    { key: "currency_earned", name: "Tiền kiếm mỗi lượt", value: "100", min: "0", max: "", unit: "gold", formula: "" },
    { key: "currency_spent", name: "Tiền chi mỗi lượt", value: "80", min: "0", max: "", unit: "gold", formula: "" },
    { key: "currency_net", name: "Dòng tiền ròng", value: "", min: "", max: "", unit: "gold", formula: "currency_earned - currency_spent" }
  ] }
];

export function appendBalanceTemplate(balance, templateId, nodes) {
  const current = normalizeGameDesignBalance(balance, nodes);
  const template = BALANCE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return current;
  const keys = new Set(current.metrics.map((item) => item.key));
  const added = template.metrics.filter((item) => !keys.has(item.key)).map((item, index) => ({
    id: globalThis.crypto?.randomUUID?.() || `metric-${Date.now()}-${index + 1}`,
    ...item, cardIds: []
  }));
  return { ...current, metrics: [...current.metrics, ...added] };
}

export function normalizeGameDesignBalance(value, nodes) {
  const balance = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  const used = new Set();
  const metrics = (Array.isArray(balance.metrics) ? balance.metrics : []).filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => {
    const key = typeof item.key === "string" ? item.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
    return { id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `metric-${index + 1}`, key, name: typeof item.name === "string" ? item.name.trim() : "", value: typeof item.value === "string" ? item.value.trim() : "", min: typeof item.min === "string" ? item.min.trim() : "", max: typeof item.max === "string" ? item.max.trim() : "", unit: typeof item.unit === "string" ? item.unit.trim() : "", formula: typeof item.formula === "string" ? item.formula.trim() : "", cardIds: Array.isArray(item.cardIds) ? item.cardIds.map((id) => String(id).trim()).filter((id, i, ids) => id && ids.indexOf(id) === i && (!nodeIds || nodeIds.has(id))) : [] };
  }).filter((item) => item.key && item.name && !used.has(item.key) && (used.add(item.key) || true)).slice(0, 100);
  const metricKeys = new Set(metrics.map((item) => item.key));
  const curveIds = new Set();
  return {
    metrics,
    curves: (Array.isArray(balance.curves) ? balance.curves : []).filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => {
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `curve-${index + 1}`;
      const metricKey = typeof item.metricKey === "string" ? item.metricKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
      const steps = Math.max(2, Math.min(200, Number.parseInt(item.steps, 10) || 2));
      return { id, name: typeof item.name === "string" ? item.name.trim() : "", metricKey, start: typeof item.start === "string" ? item.start.trim() : "", end: typeof item.end === "string" ? item.end.trim() : "", steps, mode: item.mode === "exponential" ? "exponential" : "linear" };
    }).filter((item) => item.name && metricKeys.has(item.metricKey) && !curveIds.has(item.id) && (curveIds.add(item.id) || true)).slice(0, 30)
  };
}

export function balanceCurveTable(curve) {
  const start = Number(curve?.start), end = Number(curve?.end), steps = Number(curve?.steps);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isInteger(steps) || steps < 2) return { rows: [], error: "Nhập điểm đầu, điểm cuối và ít nhất 2 mốc hợp lệ." };
  if (curve?.mode === "exponential" && (start <= 0 || end <= 0)) return { rows: [], error: "Curve mũ cần điểm đầu và điểm cuối lớn hơn 0." };
  const rows = Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    const value = curve?.mode === "exponential" ? start * ((end / start) ** t) : start + (end - start) * t;
    return { step: index + 1, value: Number(value.toFixed(3)) };
  });
  return { rows, error: "" };
}

export function balanceMetricsForCard(balance, cardId, nodes) {
  const id = String(cardId);
  return normalizeGameDesignBalance(balance, nodes).metrics.filter((metric) => metric.cardIds.includes(id));
}

export function evaluateBalanceFormula(formula, variables = {}) {
  const input = String(formula || "").trim();
  if (!input) return { value: null, error: "" };
  const tokens = input.match(/\d*\.?\d+|[a-zA-Z_][a-zA-Z0-9_]*|[()+\-*/]/g);
  if (!tokens || tokens.join("") !== input.replace(/\s+/g, "")) return { value: null, error: "Công thức chỉ nhận số, key, + - * / và ngoặc." };
  const output = [], ops = [], priority = { "+": 1, "-": 1, "*": 2, "/": 2 };
  for (const token of tokens) {
    if (/^\d/.test(token) || /^[a-zA-Z_]/.test(token)) output.push(token);
    else if (token in priority) { while (ops.length && priority[ops.at(-1)] >= priority[token]) output.push(ops.pop()); ops.push(token); }
    else if (token === "(") ops.push(token);
    else { while (ops.length && ops.at(-1) !== "(") output.push(ops.pop()); if (ops.pop() !== "(") return { value: null, error: "Ngoặc không khớp." }; }
  }
  while (ops.length) { const op = ops.pop(); if (op === "(") return { value: null, error: "Ngoặc không khớp." }; output.push(op); }
  const stack = [];
  for (const token of output) {
    if (token in priority) { const b = stack.pop(), a = stack.pop(); if (!Number.isFinite(a) || !Number.isFinite(b)) return { value: null, error: "Thiếu giá trị trong công thức." }; const value = token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : a / b; if (!Number.isFinite(value)) return { value: null, error: "Kết quả không hợp lệ." }; stack.push(value); }
    else if (/^\d/.test(token)) stack.push(Number(token));
    else { const value = Number(variables[token]); if (!Number.isFinite(value)) return { value: null, error: `Chưa có giá trị cho ${token}.` }; stack.push(value); }
  }
  return stack.length === 1 ? { value: stack[0], error: "" } : { value: null, error: "Công thức không hợp lệ." };
}

export function balanceWarnings(metric, variables = {}) {
  const warnings = [];
  const number = (value) => value === "" ? null : Number(value);
  const min = number(metric?.min), max = number(metric?.max);
  if (min !== null && max !== null && Number.isFinite(min) && Number.isFinite(max) && min > max) warnings.push("Tối thiểu đang lớn hơn tối đa.");
  const calculated = metric?.formula ? evaluateBalanceFormula(metric.formula, variables) : { value: number(metric?.value), error: "" };
  if (!calculated.error && Number.isFinite(calculated.value)) {
    if (min !== null && Number.isFinite(min) && calculated.value < min) warnings.push(`Kết quả thấp hơn tối thiểu (${min}).`);
    if (max !== null && Number.isFinite(max) && calculated.value > max) warnings.push(`Kết quả vượt tối đa (${max}).`);
    const isRate = metric?.unit === "%" || /_rate$/.test(metric?.key || "");
    if (isRate && (calculated.value < 0 || calculated.value > 100)) warnings.push("Drop rate nên nằm trong khoảng 0–100%.");
  }
  return warnings;
}

export function balanceHealth(balance, nodes) {
  const metrics = normalizeGameDesignBalance(balance, nodes).metrics;
  const vars = Object.fromEntries(metrics.map((item) => [item.key, item.value]));
  const valueOf = (item) => Number(item.formula ? evaluateBalanceFormula(item.formula, vars).value : item.value);
  const rates = metrics.filter((item) => item.unit === "%" || /_rate$/.test(item.key)).map(valueOf).filter(Number.isFinite);
  const warnings = [];
  if (rates.length >= 2) { const total = rates.reduce((sum, value) => sum + value, 0); if (Math.abs(total - 100) > 0.01) warnings.push(`Tổng ${rates.length} drop/rate là ${total}%, không phải 100%.`); }
  const earned = metrics.filter((item) => /(earned|income|reward|source)/.test(item.key)).map(valueOf).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  const spent = metrics.filter((item) => /(spent|cost|sink)/.test(item.key)).map(valueOf).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  if (earned || spent) warnings.push(`Economy flow ước tính: ${earned - spent >= 0 ? "+" : ""}${earned - spent} mỗi lượt (${earned} vào / ${spent} ra).`);
  return warnings;
}

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
        const detail = [milestone.objective, milestone.unlocks && `Mở khóa: ${milestone.unlocks}`, milestone.description, milestone.emotion, formatReferences(milestone.cardIds)].filter(Boolean).join(" · ");
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
      const extras = [metric.unit, metric.min && `Min ${metric.min}`, metric.max && `Max ${metric.max}`, metric.formula && `Formula: ${metric.formula}`, metric.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ") && `Cards: ${metric.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ")}`].filter(Boolean).join(" · ");
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
      details.examples.forEach((item, index) => lines.push(`${index + 1}. **${item.title}**${[item.scenario, item.expectedResult].filter(Boolean).length ? ` — ${[item.scenario, item.expectedResult].filter(Boolean).join(" → ")}` : ""}`));
      lines.push("");
    }
    if (details.failureStates.length) {
      lines.push("**Failure states**", "");
      details.failureStates.forEach((item, index) => lines.push(`${index + 1}. **${item.condition}**${[item.playerFeedback, item.recovery].filter(Boolean).length ? ` — ${[item.playerFeedback, item.recovery].filter(Boolean).join(" · ")}` : ""}`));
      lines.push("");
    }
    if (details.tuningParameters.length) {
      lines.push("**Tuning parameters**", "");
      details.tuningParameters.forEach((item) => {
        const values = [item.defaultValue && `Default: ${item.defaultValue}`, item.min && `Min: ${item.min}`, item.max && `Max: ${item.max}`, item.unit && `Unit: ${item.unit}`, item.note].filter(Boolean);
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
      const fields = [["Milestone", delivery.milestone], ["Assignee", delivery.assignee], ["Deadline", delivery.deadline], [delivery.blockerLevel === "blocked" ? "Blocker" : "Risk", delivery.blocker]];
      lines.push("**Delivery**", "");
      for (const [label, value] of fields) if (value) lines.push(`- **${label}:** ${value}`);
      lines.push("");
    }
    const analyticsEvents = normalizeAnalyticsEvents(node.design?.analyticsEvents);
    if (analyticsEvents.length) {
      lines.push("**Analytics events**", "");
      analyticsEvents.forEach((event) => {
        const details = [["Trigger", event.trigger], ["Properties", event.properties], ["KPI", event.kpi], ["Owner", event.owner]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
        lines.push(`- **${event.eventName}**${details ? ` — ${details}` : ""}`);
      });
      lines.push("");
    }
    const abTests = normalizeABTests(node.design?.abTests);
    if (abTests.length) {
      lines.push("**A/B test hypotheses**", "");
      abTests.forEach((item) => {
        const status = { draft: "Draft", running: "Running", concluded: "Concluded", rejected: "Rejected" }[item.status];
        const details = [["Control", item.control], ["Variant", item.variant], ["Primary metric", item.primaryMetric], ["Success criteria", item.successCriteria], ["Segment", item.segment], ["Status", status]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
        lines.push(`- **${item.hypothesis}**${details ? ` — ${details}` : ""}`);
      });
      lines.push("");
    }
    const liveOps = normalizeLiveOps(node.design?.liveOps);
    if (hasLiveOps(liveOps)) {
      const status = { planned: "Planned", running: "Running", paused: "Paused", full: "Full rollout", "rolled-back": "Rolled back" }[liveOps.status];
      const fields = [["Version", liveOps.version], ["Feature flag", liveOps.featureFlag], ["Rollout", liveOps.rolloutPercent && `${liveOps.rolloutPercent}%`], ["Audience", liveOps.audience], ["Status", status], ["Tuning notes", liveOps.tuningNotes], ["Rollback plan", liveOps.rollbackPlan]];
      lines.push("**Live tuning & rollout**", "");
      for (const [label, value] of fields) if (value) lines.push(`- **${label}:** ${value}`);
      lines.push("");
    }
    const postLaunch = normalizePostLaunchReview(node.design?.postLaunchReview, board.nodes);
    if (hasPostLaunchReview(postLaunch)) {
      const status = { pending: "Pending", healthy: "Healthy", "needs-iteration": "Needs iteration", sunset: "Sunset" }[postLaunch.status];
      const refs = postLaunch.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ");
      const fields = [["Status", status], ["Outcome", postLaunch.outcome], ["Actual metrics", postLaunch.actualMetrics], ["Learnings", postLaunch.learnings], ["Next decision", postLaunch.nextDecision], ["Owner", postLaunch.owner], ["Review date", postLaunch.reviewDate], ["Related cards", refs]];
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
      const fields = handoffTeam.id === "dev" ? [["Ghi chú bàn giao", handoff.notes]] : [["Brief", handoff.brief], ["Requirements", handoff.requirements], ["Reference", handoff.references], ["Format", handoff.format], ["Naming convention", handoff.naming]];
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
        const fields = [["Objective", session.objective], ["Hypothesis", session.hypothesis], ["Build/version", session.buildVersion], ["Player group", session.playerGroup], ["Date", session.testDate], ["Observations", session.observations], ["Metrics", session.metrics], ["Player feedback", session.playerFeedback], ["Problems found", session.problemsFound]];
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
        const detail = [["Status", item.status === "replaced" ? "Replaced" : "Active"], ["Rationale", item.rationale], ["Evidence", item.evidence], ["Alternatives", item.alternatives], ["Owner", item.owner], ["Date", item.date], ["Related cards", item.cardIds.map((id) => nodeById.get(id)?.title).filter(Boolean).join(", ")]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ");
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
