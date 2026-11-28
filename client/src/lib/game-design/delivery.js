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
