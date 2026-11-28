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
