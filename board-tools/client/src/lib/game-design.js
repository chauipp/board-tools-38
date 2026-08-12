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
  acceptanceCriteria: "Acceptance criteria"
};

export const RELATION_OPTIONS = [
  { id: "depends-on", label: "Phụ thuộc", description: "Nguồn cần đích hoàn tất hoặc tồn tại trước." },
  { id: "unlocks", label: "Mở khóa", description: "Nguồn mở ra hoặc cho phép sử dụng đích." },
  { id: "replaces", label: "Thay thế", description: "Nguồn thay cho phiên bản hoặc giải pháp ở đích." },
  { id: "conflicts-with", label: "Xung đột", description: "Hai thẻ không nên cùng được áp dụng." }
];

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

export function emptyGameDesignBalance() { return { metrics: [] }; }

export function normalizeGameDesignBalance(value, nodes) {
  const balance = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nodeIds = Array.isArray(nodes) ? new Set(nodes.map((node) => String(node?.id))) : null;
  const used = new Set();
  return {
    metrics: (Array.isArray(balance.metrics) ? balance.metrics : []).filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => {
      const key = typeof item.key === "string" ? item.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
      return { id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `metric-${index + 1}`, key, name: typeof item.name === "string" ? item.name.trim() : "", value: typeof item.value === "string" ? item.value.trim() : "", min: typeof item.min === "string" ? item.min.trim() : "", max: typeof item.max === "string" ? item.max.trim() : "", unit: typeof item.unit === "string" ? item.unit.trim() : "", formula: typeof item.formula === "string" ? item.formula.trim() : "", cardIds: Array.isArray(item.cardIds) ? item.cardIds.map((id) => String(id).trim()).filter((id, i, ids) => id && ids.indexOf(id) === i && (!nodeIds || nodeIds.has(id))) : [] };
    }).filter((item) => item.key && item.name && !used.has(item.key) && (used.add(item.key) || true)).slice(0, 100)
  };
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

export function normalizeTechnicalNotes(value) {
  return typeof value === "string" ? value.trim() : "";
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

export function gameDesignType(type) {
  return GAME_DESIGN_TYPES.find((item) => item.id === type) || GAME_DESIGN_TYPES[2];
}

export function emptyDesign(type = "mechanic") {
  return {
    type,
    design: Object.fromEntries(Object.keys(DESIGN_FIELD_LABELS).map((key) => [
      key,
      key === "priority" ? "medium" : key === "acceptanceCriteria" ? [] : ""
    ]).concat([["technicalNotes", ""]]))
  };
}

export function createGameDesignNode(id, x, y, type = "mechanic") {
  const preset = emptyDesign(type);
  return { id, title: gameDesignType(type).label, desc: "", tagId: null, statusId: null, x: Math.round(x), y: Math.round(y), ...preset };
}

// Canvas là nơi nhìn toàn cục, không phải nơi đọc nguyên một spec. Chỉ lấy vài
// field đã điền đầu tiên để thẻ nói được "nó làm gì" mà không phình thành văn
// bản dài che mất quan hệ giữa các hệ thống.
export function gameDesignPreview(node, max = 3) {
  const fields = gameDesignType(node.type).fields;
  return fields
    .filter((field) => field !== "acceptanceCriteria")
    .map((field) => ({ field, label: DESIGN_FIELD_LABELS[field], value: String(node.design?.[field] || "").replace(/\s+/g, " ").trim() }))
    .filter((item) => item.value)
    .slice(0, max)
    .map((item) => ({ ...item, value: item.value.length > 78 ? item.value.slice(0, 77) + "…" : item.value }));
}

export function gameDesignMarkdown(board, options = {}) {
  const lines = [`# ${board.name}`, ""];
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
    if (technicalNotes) lines.push("**Technical notes**", "", technicalNotes, "");
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
