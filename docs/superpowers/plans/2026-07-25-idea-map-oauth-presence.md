# Idea Map: Google OAuth login + real-time presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the whole game-tools site behind an allowlisted Google login, and show Figma/Miro-style live cursors + names when multiple people view the Idea Map board at once.

**Architecture:** Server verifies a Google ID token, checks the email against an env-var allowlist, and issues its own signed JWT in an httpOnly cookie. That cookie gates every data API route and the Socket.IO handshake. Socket.IO attaches to the same HTTP server/port as the REST API (Render runs one process) and relays cursor positions in a single global room.

**Tech Stack:** `google-auth-library`, `jsonwebtoken`, `cookie-parser`, `socket.io` (server); `socket.io-client`, Google Identity Services `<script>` tag (client, no npm package).

## Global Constraints

- Access model: allowlist of specific emails (`ALLOWED_EMAILS`), not "any Google account."
- Provider: Google only.
- Login gate covers the whole site (every route), not just Idea Map.
- Presence transport: Socket.IO, not polling.
- The existing manual-nickname mechanism (`client/src/lib/user.js`, `localStorage["idea-map-user"]`, `window.prompt`) is deleted and replaced by the authenticated Google display name.
- Fail closed: if `ALLOWED_EMAILS` is unset/empty, deny every login attempt (never fail open).
- Claude must never read the real `server/.env` file — only `.env.example` files are edited; the user adds real values themselves.
- `GOOGLE_CLIENT_ID` is not a secret (Google client IDs are meant to be public/embedded in frontend code) — this plan uses **one** env var name, `VITE_GOOGLE_CLIENT_ID`, on both client (Vite auto-exposes `VITE_`-prefixed vars) and server, so the user only has to set the value once per environment instead of two differently-named copies of the same value.

---

## Task 1: Server auth module (`server/auth.js`)

**Files:**
- Create: `game-tools/server/auth.js`
- Create: `game-tools/server/auth.test.js`
- Modify: `game-tools/server/package.json`
- Modify: `game-tools/server/.env.example`

**Interfaces:**
- Produces (consumed by Task 2 and Task 3):
  - `isEmailAllowed(email: string): boolean`
  - `signSession(user: { email, name, picture }): string`
  - `verifySession(token: string): { email, name, picture } | null`
  - `parseSessionFromCookieHeader(cookieHeader: string | undefined): { email, name, picture } | null`
  - `requireAuth(req, res, next)` — Express middleware, sets `req.user`
  - `verifyGoogleIdToken(idToken: string): Promise<{ email, name, picture }>` — throws on invalid token
  - `SESSION_COOKIE_NAME: string`, `SESSION_COOKIE_MAX_AGE_MS: number`

- [ ] **Step 1: Add server dependencies**

```bash
cd game-tools/server
npm install jsonwebtoken@^9.0.2 google-auth-library@^9.14.1 cookie-parser@^1.4.6
```

- [ ] **Step 2: Add the new env vars to `.env.example`**

Replace the full contents of `game-tools/server/.env.example` with:

```
# 1. Tạo tài khoản free tại https://www.mongodb.com/atlas
# 2. Tạo cluster M0 (free forever), tạo user + mật khẩu database
# 3. Trong Atlas bấm "Connect" -> "Drivers" -> copy connection string, dán vào đây
# 4. Copy file này thành .env (không commit .env thật lên git) rồi điền giá trị thật
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/game-tools?retryWrites=true&w=majority

PORT=3001

# 5. Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID
#    (Web application). Authorized origins: http://localhost:5173 and your Render URL.
#    Same value must also be set as client/.env.local's VITE_GOOGLE_CLIENT_ID.
VITE_GOOGLE_CLIENT_ID=

# 6. Bất kỳ chuỗi ngẫu nhiên dài nào — dùng để ký session JWT.
SESSION_SECRET=

# 7. Danh sách email được phép đăng nhập, cách nhau bởi dấu phẩy.
ALLOWED_EMAILS=you@gmail.com,colleague@gmail.com
```

- [ ] **Step 3: Write `server/auth.js`**

```js
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

export const SESSION_COOKIE_NAME = "gt_session";
export const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email) {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) {
    console.error("ALLOWED_EMAILS chưa được cấu hình — từ chối mọi đăng nhập.");
    return false;
  }
  return allowed.includes(String(email || "").toLowerCase());
}

export function signSession(user) {
  return jwt.sign(
    { email: user.email, name: user.name, picture: user.picture },
    process.env.SESSION_SECRET,
    { expiresIn: "30d" }
  );
}

export function verifySession(token) {
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    return { email: payload.email, name: payload.name, picture: payload.picture };
  } catch (e) {
    return null;
  }
}

export function parseSessionFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;
  const prefix = SESSION_COOKIE_NAME + "=";
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix));
  if (!match) return null;
  return verifySession(decodeURIComponent(match.slice(prefix.length)));
}

export function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE_NAME];
  const user = token && verifySession(token);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  req.user = user;
  next();
}

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.VITE_GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return { email: payload.email, name: payload.name, picture: payload.picture };
}
```

- [ ] **Step 4: Write `server/auth.test.js`**

Only the pure, network-free functions are unit tested — `verifyGoogleIdToken` needs a real Google token and is covered by manual verification in Task 7.

```js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  isEmailAllowed,
  signSession,
  verifySession,
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME
} from "./auth.js";

before(() => {
  process.env.SESSION_SECRET = "test-secret";
});

test("isEmailAllowed: denies everyone when ALLOWED_EMAILS is unset", () => {
  delete process.env.ALLOWED_EMAILS;
  assert.equal(isEmailAllowed("anyone@gmail.com"), false);
});

test("isEmailAllowed: matches case-insensitively against the list", () => {
  process.env.ALLOWED_EMAILS = "Alice@Gmail.com, bob@gmail.com";
  assert.equal(isEmailAllowed("alice@gmail.com"), true);
  assert.equal(isEmailAllowed("BOB@GMAIL.COM"), true);
  assert.equal(isEmailAllowed("carol@gmail.com"), false);
});

test("signSession/verifySession round-trip preserves user fields", () => {
  const token = signSession({ email: "a@b.com", name: "A B", picture: "http://x/p.png" });
  const decoded = verifySession(token);
  assert.deepEqual(decoded, { email: "a@b.com", name: "A B", picture: "http://x/p.png" });
});

test("verifySession returns null for a garbage token", () => {
  assert.equal(verifySession("not-a-jwt"), null);
});

test("parseSessionFromCookieHeader finds the session cookie among others", () => {
  const token = signSession({ email: "a@b.com", name: "A B", picture: null });
  const header = `theme-pref=dark; ${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; other=1`;
  assert.deepEqual(parseSessionFromCookieHeader(header), { email: "a@b.com", name: "A B", picture: null });
});

test("parseSessionFromCookieHeader returns null when the cookie is absent", () => {
  assert.equal(parseSessionFromCookieHeader("theme-pref=dark"), null);
  assert.equal(parseSessionFromCookieHeader(undefined), null);
});
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd game-tools/server && node --test auth.test.js`
Expected: 6 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add game-tools/server/auth.js game-tools/server/auth.test.js game-tools/server/package.json game-tools/server/package-lock.json game-tools/server/.env.example
git commit -m "feat(server): add Google OAuth + session JWT auth module"
```

---

## Task 2: Wire auth routes and middleware into the server

**Files:**
- Modify: `game-tools/server/index.js`

**Interfaces:**
- Consumes: everything exported from Task 1's `server/auth.js`.
- Produces: `POST /api/auth/google`, `GET /api/auth/me`, `POST /api/auth/logout`; `/api/ideas` and `/api/calculator` now require a valid session cookie.

- [ ] **Step 1: Add the new imports and `cookie-parser` middleware**

In `game-tools/server/index.js`, change the top imports (lines 1-5) from:

```js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
```

to:

```js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import {
  requireAuth,
  isEmailAllowed,
  signSession,
  verifyGoogleIdToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS
} from "./auth.js";
```

Then change (around line 166-167):

```js
const app = express();
app.use(express.json({ limit: "10mb" }));
```

to:

```js
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
```

- [ ] **Step 2: Add the auth routes**

Right after the `app.use(cookieParser());` line, add:

```js
app.post("/api/auth/google", async (req, res) => {
  let googleUser;
  try {
    googleUser = await verifyGoogleIdToken(req.body.idToken);
  } catch (e) {
    return res.status(401).json({ error: "invalid_token" });
  }
  if (!isEmailAllowed(googleUser.email)) {
    return res.status(403).json({ error: "not_allowed" });
  }
  const token = signSession(googleUser);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_MS
  });
  res.json({ user: googleUser });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Require auth on the data routes**

Change each of the four data-route declarations to add `requireAuth` as middleware:

```js
app.get("/api/ideas", requireAuth, async (req, res) => {
```

```js
app.put("/api/ideas", requireAuth, async (req, res) => {
```

```js
app.get("/api/calculator", requireAuth, async (req, res) => {
```

```js
app.put("/api/calculator", requireAuth, async (req, res) => {
```

(Only the signature line changes for each — the handler bodies stay exactly as they are today.)

- [ ] **Step 4: Manually verify the 401/403 behavior**

Run: `cd game-tools/server && npm run dev` (needs a real `.env` with `MONGODB_URI` — this is the user's existing local setup, not something Claude configures).

In another terminal:
```bash
curl -i http://localhost:3001/api/ideas
```
Expected: `HTTP/1.1 401` with body `{"error":"unauthorized"}`.

```bash
curl -i -X POST http://localhost:3001/api/auth/google -H "Content-Type: application/json" -d '{"idToken":"garbage"}'
```
Expected: `HTTP/1.1 401` with body `{"error":"invalid_token"}`.

- [ ] **Step 5: Commit**

```bash
git add game-tools/server/index.js
git commit -m "feat(server): gate /api/ideas and /api/calculator behind Google login"
```

---

## Task 3: Socket.IO presence server

**Files:**
- Modify: `game-tools/server/index.js`
- Modify: `game-tools/server/package.json`
- Modify: `game-tools/client/vite.config.js`

**Interfaces:**
- Consumes: `parseSessionFromCookieHeader` from Task 1.
- Produces (consumed by Task 6's client `usePresence.js`): Socket.IO events —
  - server→client `presence:sync` — array of `{ socketId, email, name, picture, x, y }`
  - server→client `presence:join` — single peer object, same shape
  - server→client `presence:leave` — `{ socketId }`
  - server→client `cursor:move` — single peer object, same shape (x/y updated)
  - client→server `cursor:move` — `{ x, y }`

- [ ] **Step 1: Add the `socket.io` dependency**

```bash
cd game-tools/server
npm install socket.io@^4.8.0
```

- [ ] **Step 2: Switch to an explicit HTTP server and mount Socket.IO**

In `game-tools/server/index.js`, add to the imports:

```js
import http from "node:http";
import { Server } from "socket.io";
```

Replace the final block of the file:

```js
app.listen(PORT, () => {
  console.log("Game tools server đang chạy tại http://localhost:" + PORT);
});
```

with:

```js
const server = http.createServer(app);
const io = new Server(server);

io.use((socket, next) => {
  const user = parseSessionFromCookieHeader(socket.handshake.headers.cookie);
  if (!user) return next(new Error("unauthorized"));
  socket.data.user = user;
  next();
});

const presencePeers = new Map(); // socket.id -> { socketId, email, name, picture, x, y }

io.on("connection", (socket) => {
  const peer = { socketId: socket.id, ...socket.data.user, x: 0, y: 0 };
  presencePeers.set(socket.id, peer);
  socket.emit("presence:sync", Array.from(presencePeers.values()));
  socket.broadcast.emit("presence:join", peer);

  socket.on("cursor:move", ({ x, y }) => {
    const p = presencePeers.get(socket.id);
    if (!p || typeof x !== "number" || typeof y !== "number") return;
    p.x = x;
    p.y = y;
    socket.broadcast.emit("cursor:move", p);
  });

  socket.on("disconnect", () => {
    presencePeers.delete(socket.id);
    socket.broadcast.emit("presence:leave", { socketId: socket.id });
  });
});

server.listen(PORT, () => {
  console.log("Game tools server đang chạy tại http://localhost:" + PORT);
});
```

And add `parseSessionFromCookieHeader` to the existing `import { ... } from "./auth.js"` block from Task 2.

- [ ] **Step 3: Proxy Socket.IO's path in local dev**

Socket.IO's default client connects to `/socket.io/` with a WebSocket upgrade. Vite's dev server only proxies `/api` today, so the local `:5173` client can't reach the `:3001` socket server without this.

In `game-tools/client/vite.config.js`, change:

```js
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001"
    }
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:3001"
    }
  }
```

to:

```js
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true }
    }
  }
```

- [ ] **Step 4: Manually verify a socket connection is accepted/rejected correctly**

This needs a real session cookie, so full verification happens in Task 7 after the client login flow exists. For now, just confirm the server still boots and serves REST as before:

Run: `cd game-tools/server && npm run dev`
Expected: no startup errors, log line `Game tools server đang chạy tại http://localhost:3001`.

- [ ] **Step 5: Commit**

```bash
git add game-tools/server/index.js game-tools/server/package.json game-tools/server/package-lock.json game-tools/client/vite.config.js
git commit -m "feat(server): add Socket.IO presence channel on the same HTTP server"
```

---

## Task 4: Client auth plumbing (`AuthContext`, `LoginGate`, site-wide gate)

**Files:**
- Create: `game-tools/client/src/lib/auth.js`
- Create: `game-tools/client/src/context/AuthContext.jsx`
- Create: `game-tools/client/src/components/LoginGate.jsx`
- Create: `game-tools/client/.env.example`
- Modify: `game-tools/client/.gitignore`
- Modify: `game-tools/client/src/main.jsx`
- Modify: `game-tools/client/src/index.css`
- Modify: `game-tools/client/src/lib/api.js`

**Interfaces:**
- Produces (consumed by Task 5 and Task 6):
  - `getMe(): Promise<{email,name,picture} | null>`, `loginWithGoogle(idToken: string): Promise<{email,name,picture}>`, `logout(): Promise<void>` from `lib/auth.js`
  - `AuthProvider` component, `useAuth(): { user, loading, setUser, logout }` from `context/AuthContext.jsx`
  - A `window` event `"auth:expired"`, dispatched by `lib/api.js` whenever a data request comes back `401`, consumed by `AuthContext` to clear the session client-side the moment it expires mid-use (not just at initial load).

- [ ] **Step 1: `client/.env.example` and `.gitignore`**

Create `game-tools/client/.env.example`:

```
# Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID
# (Web application). Same value as server/.env's VITE_GOOGLE_CLIENT_ID.
# Copy this file to .env.local (gitignored) and fill in the real value.
VITE_GOOGLE_CLIENT_ID=
```

Change `game-tools/client/.gitignore` from:

```
node_modules/
dist/
```

to:

```
node_modules/
dist/
.env.local
```

- [ ] **Step 2: `client/src/lib/auth.js`**

```js
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
```

- [ ] **Step 3: `client/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout as apiLogout } from "../lib/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 4: Make `lib/api.js` signal when a session has expired**

Replace the full contents of `game-tools/client/src/lib/api.js` with:

```js
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
```

- [ ] **Step 5: Listen for `"auth:expired"` in `AuthContext`**

In `game-tools/client/src/context/AuthContext.jsx`, add a second `useEffect` inside `AuthProvider`, right after the existing one:

```jsx
  useEffect(() => {
    function onExpired() {
      setUser(null);
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);
```

- [ ] **Step 6: `client/src/components/LoginGate.jsx`**

```jsx
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
```

- [ ] **Step 7: Add `.login-gate` styles**

Append to `game-tools/client/src/index.css`:

```css
.login-gate {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg);
}
.login-card {
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  padding: 32px 40px; text-align: center; max-width: 320px;
}
.login-card h1 { font-size: 20px; margin-bottom: 8px; }
.login-card p { color: var(--ink-dim); font-size: 13px; margin-bottom: 16px; }
.login-card > div:not(.login-error) { display: flex; justify-content: center; }
.login-error { color: var(--accent); font-size: 12px; margin-top: 12px; }
```

- [ ] **Step 8: Wire `AuthProvider` + `LoginGate` into `main.jsx`**

Replace `game-tools/client/src/main.jsx` entirely with:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
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

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LoginGate />;
  return children;
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
```

- [ ] **Step 9: Verify the app builds**

Run: `cd game-tools/client && npm run build`
Expected: build succeeds with no errors. `import.meta.env.VITE_GOOGLE_CLIENT_ID` is inlined by Vite at build time from whatever `.env.local`/env vars are present when the build command runs — a missing value here just means `client_id: undefined` gets baked in (the Google button will fail to initialize until the real value is set at build time), it does not fail the build itself.

- [ ] **Step 10: Commit**

```bash
git add game-tools/client/src/lib/auth.js game-tools/client/src/context/AuthContext.jsx game-tools/client/src/components/LoginGate.jsx game-tools/client/.env.example game-tools/client/.gitignore game-tools/client/src/main.jsx game-tools/client/src/index.css game-tools/client/src/lib/api.js
git commit -m "feat(client): add Google sign-in gate covering the whole site"
```

---

## Task 5: Replace the manual nickname system with the real Google identity

**Files:**
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Delete: `game-tools/client/src/lib/user.js`
- Delete: `game-tools/client/src/lib/user.test.js`

**Interfaces:**
- Consumes: `useAuth()` from Task 4.

- [ ] **Step 1: Confirm the file to delete has no other importers**

Run: `cd game-tools/client && grep -rl "lib/user.js" src`
Expected: only `src/pages/IdeaMap.jsx` (this task removes that one remaining reference next).

- [ ] **Step 2: Swap the import and drop the local-storage read**

In `game-tools/client/src/pages/IdeaMap.jsx`, change line 20 from:

```js
import { getUserName } from "../lib/user.js";
```

to:

```js
import { useAuth } from "../context/AuthContext.jsx";
```

Add `const { user } = useAuth();` near the top of the `IdeaMap` component, alongside the other hooks around line 85 (right before `const viewportRef = useRef(null);`), so it runs unconditionally before any early return in the function body.

Then change line 366 from:

```js
  const currentUser = window.localStorage.getItem("idea-map-user");
```

to:

```js
  const currentUser = user.name;
```

- [ ] **Step 3: Replace the two `getUserName` call sites**

Change `toggleFavorite` (around line 1528) from:

```js
  function toggleFavorite(nodeId) {
    const user = getUserName(window.localStorage, () => window.prompt(t`Tên của bạn (hiện cạnh ⭐ và comment):`));
    if (!user) return;
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const favs = n.favorites ?? [];
        return { ...n, favorites: favs.includes(user) ? favs.filter((f) => f !== user) : [...favs, user] };
      })
    });
  }
```

to:

```js
  function toggleFavorite(nodeId) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const favs = n.favorites ?? [];
        return { ...n, favorites: favs.includes(currentUser) ? favs.filter((f) => f !== currentUser) : [...favs, currentUser] };
      })
    });
  }
```

Change `addComment` (around line 1541) from:

```js
  function addComment(nodeId, text) {
    const user = getUserName(window.localStorage, () => window.prompt(t`Tên của bạn (hiện cạnh ⭐ và comment):`));
    if (!user || !text.trim()) return false;
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: [...(n.comments ?? []), { text: text.trim(), author: user, at: new Date().toISOString() }] }
        : n))
    });
    return true;
  }
```

to:

```js
  function addComment(nodeId, text) {
    if (!text.trim()) return false;
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: [...(n.comments ?? []), { text: text.trim(), author: currentUser, at: new Date().toISOString() }] }
        : n))
    });
    return true;
  }
```

- [ ] **Step 4: Delete the superseded files**

```bash
git rm game-tools/client/src/lib/user.js game-tools/client/src/lib/user.test.js
```

- [ ] **Step 5: Run the unit test suite**

Run: `cd game-tools/client && node --test src/lib/*.test.js`
Expected: all remaining tests pass (one fewer test file than before, `user.test.js` is gone).

- [ ] **Step 6: Verify the build still compiles**

Run: `cd game-tools/client && npm run build`
Expected: no errors, no unresolved-import warnings for `lib/user.js`.

- [ ] **Step 7: Commit**

```bash
git add game-tools/client/src/pages/IdeaMap.jsx
git commit -m "refactor(client): replace manual nickname prompt with authenticated Google identity"
```

---

## Task 6: Live cursors (`usePresence` hook + rendering in Idea Map)

**Files:**
- Create: `game-tools/client/src/lib/usePresence.js`
- Create: `game-tools/client/src/lib/usePresence.test.js`
- Modify: `game-tools/client/src/pages/IdeaMap.jsx`
- Modify: `game-tools/client/src/styles/idea-map.css`
- Modify: `game-tools/client/package.json`

**Interfaces:**
- Consumes: Socket.IO events from Task 3; `useAuth()` from Task 4.
- Produces: `usePresence(user): { peers: Map<string, PeerCursor>, sendCursor(x: number, y: number): void }` where `PeerCursor = { socketId, email, name, picture, x, y }`; `cursorColor(email: string): string` (hex/HSL CSS color string).

- [ ] **Step 1: Add the `socket.io-client` dependency**

```bash
cd game-tools/client
npm install socket.io-client@^4.8.0
```

- [ ] **Step 2: Write the failing test for `cursorColor`**

Create `game-tools/client/src/lib/usePresence.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cursorColor } from "./usePresence.js";

test("cursorColor is deterministic for the same email", () => {
  assert.equal(cursorColor("a@b.com"), cursorColor("a@b.com"));
});

test("cursorColor returns an hsl() string", () => {
  assert.match(cursorColor("a@b.com"), /^hsl\(\d+, 70%, 55%\)$/);
});

test("cursorColor differs for different emails (no collision for this pair)", () => {
  assert.notEqual(cursorColor("a@b.com"), cursorColor("z@y.com"));
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd game-tools/client && node --test src/lib/usePresence.test.js`
Expected: FAIL — `usePresence.js` does not exist yet.

- [ ] **Step 4: Write `client/src/lib/usePresence.js`**

```js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const CURSOR_THROTTLE_MS = 50;

export function cursorColor(email) {
  let h = 0;
  const s = String(email || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 55%)`;
}

export function usePresence(user) {
  const [peers, setPeers] = useState(new Map());
  const socketRef = useRef(null);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    const socket = io();
    socketRef.current = socket;

    socket.on("presence:sync", (list) => {
      setPeers(new Map(list.map((p) => [p.socketId, p])));
    });
    socket.on("presence:join", (peer) => {
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    });
    socket.on("presence:leave", ({ socketId }) => {
      setPeers((prev) => {
        if (!prev.has(socketId)) return prev;
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });
    socket.on("cursor:move", (peer) => {
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setPeers(new Map());
    };
  }, [user]);

  function sendCursor(x, y) {
    const socket = socketRef.current;
    if (!socket) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < CURSOR_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    socket.emit("cursor:move", { x, y });
  }

  return { peers, sendCursor };
}
```

- [ ] **Step 5: Run the test again to verify it passes**

Run: `cd game-tools/client && node --test src/lib/usePresence.test.js`
Expected: 3 passing, 0 failing.

- [ ] **Step 6: Wire the hook into `IdeaMap.jsx`**

Add the import near the top of `game-tools/client/src/pages/IdeaMap.jsx` (next to the `useAuth` import added in Task 5):

```js
import { usePresence, cursorColor } from "../lib/usePresence.js";
```

Add the hook call next to `const { user } = useAuth();` (added in Task 5, Step 2):

```js
  const { peers: presencePeers, sendCursor } = usePresence(user);
```

Add a mouse-move handler for the viewport. Place this function definition near `entityAtPoint` (around line 368), after the early-return guards so `boardRef`/`viewportRef` are populated:

```js
  function handlePresenceMouseMove(e) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = boardRef.current.view;
    sendCursor(
      (e.clientX - rect.left - view.panX) / view.scale,
      (e.clientY - rect.top - view.panY) / view.scale
    );
  }
```

Wire it onto the `.viewport` div (around line 1832-1839), changing:

```jsx
      <div
        className={"viewport" + (isPanning ? " panning" : "")}
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onDoubleClick={handleViewportDoubleClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleViewportImageDrop}
      >
```

to:

```jsx
      <div
        className={"viewport" + (isPanning ? " panning" : "")}
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onDoubleClick={handleViewportDoubleClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleViewportImageDrop}
        onMouseMove={handlePresenceMouseMove}
      >
```

- [ ] **Step 7: Render peer cursors**

Inside the `.canvas` div, right after the `{board.nodes.map(...)}` block and before the edge-handle-layer comment/block added by the earlier edge-drag feature (around line 1946), add:

```jsx
          {Array.from(presencePeers.values()).map((peer) => (
            <div
              key={peer.socketId}
              className="peer-cursor"
              style={{ left: peer.x, top: peer.y, "--peer-color": cursorColor(peer.email) }}
            >
              <svg viewBox="0 0 20 20" width="16" height="16">
                <path d="M2 2 L18 9 L10 11 L8 18 Z" fill="var(--peer-color)" stroke="var(--bg)" strokeWidth="1" />
              </svg>
              <span className="peer-cursor-label" style={{ background: "var(--peer-color)" }}>{peer.name}</span>
            </div>
          ))}
```

- [ ] **Step 8: Add `.peer-cursor` styles**

Append to `game-tools/client/src/styles/idea-map.css`:

```css
.peer-cursor {
  position: absolute; pointer-events: none; z-index: 6;
  transform: translate(0, 0);
}
.peer-cursor-label {
  display: inline-block; margin-left: 14px; margin-top: -4px;
  padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; color: var(--accent-ink);
  white-space: nowrap;
}
```

- [ ] **Step 9: Verify the build compiles**

Run: `cd game-tools/client && npm run build`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add game-tools/client/src/lib/usePresence.js game-tools/client/src/lib/usePresence.test.js game-tools/client/src/pages/IdeaMap.jsx game-tools/client/src/styles/idea-map.css game-tools/client/package.json game-tools/client/package-lock.json
git commit -m "feat(client): show live peer cursors on the Idea Map board"
```

---

## Task 7: Render deployment config + manual end-to-end verification

**Files:**
- Modify: `render.yaml` (repo root)

- [ ] **Step 1: Add the new Render env vars**

In `g:\game-lab\render.yaml`, change:

```yaml
    envVars:
      - key: MONGODB_URI
        sync: false
      # Node 22+ required: @lingui/cli imports fs.globSync, which does not
      # exist before Node 22 (build fails on 20 with a node:fs SyntaxError).
      - key: NODE_VERSION
        value: 22.11.0
```

to:

```yaml
    envVars:
      - key: MONGODB_URI
        sync: false
      # Google Cloud Console OAuth client ID. Not secret (meant to be public/
      # embedded in frontend code) but set via dashboard since it doesn't
      # exist until the operator creates it — same value used by both the
      # client build (Vite auto-exposes VITE_-prefixed vars) and the server's
      # token-audience check.
      - key: VITE_GOOGLE_CLIENT_ID
        sync: false
      - key: SESSION_SECRET
        sync: false
      - key: ALLOWED_EMAILS
        sync: false
      # Node 22+ required: @lingui/cli imports fs.globSync, which does not
      # exist before Node 22 (build fails on 20 with a node:fs SyntaxError).
      - key: NODE_VERSION
        value: 22.11.0
```

- [ ] **Step 2: Commit**

```bash
git add render.yaml
git commit -m "chore(deploy): add OAuth env vars to the Render blueprint"
```

- [ ] **Step 3: Manual setup (the user does this, not Claude)**

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application. Authorized JavaScript origins: `http://localhost:5173` and `https://game-tools.onrender.com`.
2. Create `game-tools/client/.env.local` with `VITE_GOOGLE_CLIENT_ID=<the client ID>`.
3. Add three lines to the real `game-tools/server/.env` (Claude will not do this — the user edits it directly): `VITE_GOOGLE_CLIENT_ID=<same client ID>`, `SESSION_SECRET=<any long random string>`, `ALLOWED_EMAILS=<comma-separated emails>`.
4. On the Render dashboard, set the same three as service env vars (matching the `sync: false` entries added in Step 1).

- [ ] **Step 4: Manual end-to-end verification (local)**

1. `cd game-tools/server && npm run dev`
2. `cd game-tools/client && npm run dev`
3. Open `http://localhost:5173` — expect the `LoginGate` overlay with a Google sign-in button, not the app.
4. Sign in with an email **not** on `ALLOWED_EMAILS` — expect "Tài khoản này chưa được cấp quyền truy cập."
5. Sign in with an email that **is** on `ALLOWED_EMAILS` — expect the gate to disappear and the Home page to render.
6. Go to `/idea-map`. Open a second browser (or an incognito window) signed in as a different allowlisted email, also on `/idea-map`. Move the mouse in one window — expect a colored cursor + name to appear at the corresponding position in the other window within ~100ms. Close one tab — expect its cursor to disappear from the other within a couple seconds.
7. Add a favorite/comment — expect the author name shown to be the real Google display name, not a prompt.

Report back which of these passed/failed; this step cannot be automated because it requires a real Google OAuth client and two live browser sessions.
