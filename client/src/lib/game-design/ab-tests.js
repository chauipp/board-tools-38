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
