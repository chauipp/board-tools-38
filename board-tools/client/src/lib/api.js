function apiError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

export async function getIdeas() {
  const res = await fetch("/api/ideas");
  if (!res.ok) throw apiError("IDEAS_LOAD_FAILED");
  return res.json();
}

export async function saveIdeas(state) {
  const res = await fetch("/api/ideas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw apiError("IDEAS_SAVE_FAILED");
  return res.json();
}

export async function getCalculator() {
  const res = await fetch("/api/calculator");
  if (!res.ok) throw apiError("CALC_LOAD_FAILED");
  return res.json();
}

export async function saveCalculator(state) {
  const res = await fetch("/api/calculator", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw apiError("CALC_SAVE_FAILED");
  return res.json();
}
