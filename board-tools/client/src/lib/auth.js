function apiError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

export async function getMe() {
  const res = await fetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw apiError("AUTH_ME_FAILED");
  const data = await res.json();
  return data.user;
}

export async function loginWithGoogle(idToken) {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (res.status === 403) throw apiError("NOT_ALLOWED");
  if (!res.ok) throw apiError("LOGIN_FAILED");
  const data = await res.json();
  return data.user;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}
