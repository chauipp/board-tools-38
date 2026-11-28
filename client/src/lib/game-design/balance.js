import { GAME_DESIGN_BALANCE_LIMITS } from "../../../../shared/game-design-limits.js";
export function emptyGameDesignBalance() { return { metrics: [], curves: [] }; }

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
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `metric-${index + 1}`,
      key,
      name: typeof item.name === "string" ? item.name.trim() : "",
      value: typeof item.value === "string" ? item.value.trim() : "",
      min: typeof item.min === "string" ? item.min.trim() : "",
      max: typeof item.max === "string" ? item.max.trim() : "",
      unit: typeof item.unit === "string" ? item.unit.trim() : "",
      formula: typeof item.formula === "string" ? item.formula.trim() : "",
      cardIds: Array.isArray(item.cardIds) ? item.cardIds.map((id) => String(id).trim())
        .filter((id, i, ids) => id && ids.indexOf(id) === i && (!nodeIds || nodeIds.has(id))) : []
    };
  }).filter((item) => item.key && item.name && !used.has(item.key) && (used.add(item.key) || true)).slice(0, GAME_DESIGN_BALANCE_LIMITS.metrics);
  const metricKeys = new Set(metrics.map((item) => item.key));
  const curveIds = new Set();
  return {
    metrics,
    curves: (Array.isArray(balance.curves) ? balance.curves : []).filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => {
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `curve-${index + 1}`;
      const metricKey = typeof item.metricKey === "string" ? item.metricKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
      const steps = Math.max(2, Math.min(200, Number.parseInt(item.steps, 10) || 2));
      return {
        id,
        name: typeof item.name === "string" ? item.name.trim() : "",
        metricKey,
        start: typeof item.start === "string" ? item.start.trim() : "",
        end: typeof item.end === "string" ? item.end.trim() : "",
        steps,
        mode: item.mode === "exponential" ? "exponential" : "linear"
      };
    }).filter((item) => item.name && metricKeys.has(item.metricKey) && !curveIds.has(item.id) && (curveIds.add(item.id) || true)).slice(0, GAME_DESIGN_BALANCE_LIMITS.curves)
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
    if (token in priority) {
      const b = stack.pop(), a = stack.pop();
      if (!Number.isFinite(a) || !Number.isFinite(b)) return { value: null, error: "Thiếu giá trị trong công thức." };
      const value = token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : a / b;
      if (!Number.isFinite(value)) return { value: null, error: "Kết quả không hợp lệ." };
      stack.push(value);
    }
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
  if (rates.length >= 2) {
    const total = rates.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.01) warnings.push(`Tổng ${rates.length} drop/rate là ${total}%, không phải 100%.`);
  }
  const earned = metrics.filter((item) => /(earned|income|reward|source)/.test(item.key)).map(valueOf).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  const spent = metrics.filter((item) => /(spent|cost|sink)/.test(item.key)).map(valueOf).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  if (earned || spent) {
    warnings.push(`Economy flow ước tính: ${earned - spent >= 0 ? "+" : ""}${earned - spent} mỗi lượt (${earned} vào / ${spent} ra).`);
  }
  return warnings;
}
