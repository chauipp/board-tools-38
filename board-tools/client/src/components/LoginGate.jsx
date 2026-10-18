import { useEffect, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useAuth } from "../context/AuthContext.jsx";
import { loginWithGoogle } from "../lib/auth.js";

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

export default function LoginGate() {
  const { setUser } = useAuth();
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);

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
              setError(e.code === "NOT_ALLOWED" ? "not_allowed" : "login_failed");
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
          <Trans>Đăng nhập bằng Google để tiếp tục.</Trans>
        </p>
        <div ref={buttonRef} />
        {error === "not_allowed" && (
          <p className="login-error">
            <Trans>Tài khoản này chưa được cấp quyền truy cập.</Trans>
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
