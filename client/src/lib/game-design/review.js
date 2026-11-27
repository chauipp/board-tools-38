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
