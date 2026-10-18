function apiError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function checkAuthExpired(res) {
  if (res.status === 401) window.dispatchEvent(new Event("auth:expired"));
}

export async function getIdeas() {
  const res = await fetch("/api/ideas");
  checkAuthExpired(res);
  if (!res.ok) throw apiError("IDEAS_LOAD_FAILED");
  return res.json();
}

export async function saveIdeas(state) {
  const res = await fetch("/api/ideas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("IDEAS_SAVE_FAILED");
  return res.json();
}

export async function getCalculator() {
  const res = await fetch("/api/calculator");
  checkAuthExpired(res);
  if (!res.ok) throw apiError("CALC_LOAD_FAILED");
  return res.json();
}

export async function saveCalculator(state) {
  const res = await fetch("/api/calculator", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("CALC_SAVE_FAILED");
  return res.json();
}
