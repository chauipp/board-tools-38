import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { i18n } from "./lib/i18n.js";
import "@fontsource/anton";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./index.css";
import Home from "./pages/Home.jsx";
import IdeaMap from "./pages/IdeaMap.jsx";
import Calculator from "./pages/Calculator.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginGate from "./components/LoginGate.jsx";

function IdentityChip() {
  const { user, logout } = useAuth();
  const [imgOk, setImgOk] = React.useState(true);

  return (
    <div className="identity-chip">
      {user.picture && imgOk && (
        <img
          className="identity-chip-avatar"
          src={user.picture}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
        />
      )}
      <span className="identity-chip-name">{user.name}</span>
      <button type="button" className="btn ghost identity-chip-logout" onClick={logout}>
        <Trans>Đăng xuất</Trans>
      </button>
    </div>
  );
}

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LoginGate />;
  return (
    <>
      <IdentityChip />
      {children}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <AuthProvider>
        <AuthGate>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/idea-map" element={<IdeaMap />} />
              <Route path="/calculator" element={<Calculator />} />
            </Routes>
          </BrowserRouter>
        </AuthGate>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);
