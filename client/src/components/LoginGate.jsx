import { useEffect, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useAuth } from "../context/AuthContext.jsx";
import { loginWithGoogle, loginWithPassword } from "../lib/auth.js";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GSI_LOAD_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GSI_LOAD_FAILED"));
    document.head.appendChild(script);
  });
}

// Decode-only (no signature check — the server is the one that verifies the
// token). Used purely to show the user which account was rejected.
function decodeEmailFromIdToken(idToken) {
  try {
    const payload = idToken.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json).email || null;
  } catch (e) {
    return null;
  }
}

export default function LoginGate() {
  const { setUser } = useAuth();
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);
  const [rejectedEmail, setRejectedEmail] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (submitting || !username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await loginWithPassword(username.trim(), password);
      setUser(user);
    } catch (e) {
      setPassword("");
      if (e.code === "INVALID_CREDENTIALS") setError("invalid_credentials");
      else if (e.code === "TOO_MANY_ATTEMPTS") setError("too_many_attempts");
      else setError("login_failed");
      setSubmitting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: async (response) => {
            try {
              const user = await loginWithGoogle(response.credential);
              setUser(user);
            } catch (e) {
              if (e.code === "NOT_ALLOWED") {
                setRejectedEmail(decodeEmailFromIdToken(response.credential));
                setError("not_allowed");
              } else {
                setError("login_failed");
              }
            }
          }
        });
        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large" });
        }
      })
      .catch(() => setError("login_failed"));
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return (
    <div className="login-gate">
      <div className="login-card">
        <h1>
          <Trans>Xưởng Game Của Tôi</Trans>
        </h1>
        <p>
          <Trans>Đăng nhập để tiếp tục.</Trans>
        </p>
        <div ref={buttonRef} />
        <div className="login-divider">
          <span>
            <Trans>hoặc</Trans>
          </span>
        </div>
        <form className="login-form" onSubmit={handlePasswordSubmit}>
          <label>
            <span>
              <Trans>Tên đăng nhập</Trans>
            </span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            <span>
              <Trans>Mật khẩu</Trans>
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn" disabled={submitting || !username.trim() || !password}>
            {submitting ? <Trans>Đang đăng nhập…</Trans> : <Trans>Đăng nhập</Trans>}
          </button>
        </form>
        {error === "not_allowed" && (
          <p className="login-error">
            {rejectedEmail ? (
              <Trans>Tài khoản {rejectedEmail} chưa được cấp quyền truy cập.</Trans>
            ) : (
              <Trans>Tài khoản này chưa được cấp quyền truy cập.</Trans>
            )}
          </p>
        )}
        {error === "invalid_credentials" && (
          <p className="login-error">
            <Trans>Sai tên đăng nhập hoặc mật khẩu.</Trans>
          </p>
        )}
        {error === "too_many_attempts" && (
          <p className="login-error">
            <Trans>Thử sai quá nhiều lần, đợi vài phút rồi thử lại.</Trans>
          </p>
        )}
        {error === "login_failed" && (
          <p className="login-error">
            <Trans>Đăng nhập thất bại, thử lại.</Trans>
          </p>
        )}
      </div>
    </div>
  );
}
