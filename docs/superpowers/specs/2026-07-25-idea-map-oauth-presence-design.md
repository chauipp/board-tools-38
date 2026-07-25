# Idea Map: Google OAuth login + real-time presence (live cursors)

## Goal

Gate the entire game-tools site behind Google login (allowlisted emails only), and show
Figma/Miro-style live cursors + names when multiple people view the Idea Map board at once.

## Decisions (from brainstorming)

- **Purpose of OAuth:** access control, not just identification. Unauthenticated visitors
  must not be able to read or write board data.
- **Who gets in:** allowlist of specific emails (`ALLOWED_EMAILS` env var), not "any Google
  account."
- **Provider:** Google only.
- **Presence transport:** Socket.IO (real-time, not polling).
- **Scope of the login gate:** the whole site (Idea Map, Calculator, any future page), not
  just Idea Map.
- **Identity unification:** the existing manual-nickname mechanism
  (`client/src/lib/user.js`, `localStorage["idea-map-user"]`, `window.prompt`) is replaced
  by the real Google name/avatar. `lib/user.js` and its test are deleted.

## Current state (established during research)

- Server is a single Express app (`server/index.js`), no `models/`/`routes/` split, deps
  are only `express`, `mongoose`, `dotenv`. No auth, no sessions, no WebSocket/SSE.
- Client deps: React 18, react-router-dom, @lingui. No auth or realtime libs.
- `render.yaml` runs **one** web service — REST API and built client share one Node
  process/port, so Socket.IO can attach to the same HTTP server with no extra
  infrastructure.
- `server/.env` currently declares only `MONGODB_URI` and `PORT`. Never read directly by
  Claude per standing project rule.
- `IdeaBoard` is a single Mongoose singleton document (`singleton: "main"`) shared by
  everyone — no per-user ownership today, and this spec does not add any.

## Architecture

### Auth flow

1. Client loads Google Identity Services via `<script src="https://accounts.google.com/gsi/client">`
   (no npm package). A `LoginGate` component renders the Google sign-in button when the
   user is not authenticated.
2. On success, GIS gives the client a Google **ID token**. Client sends it to
   `POST /api/auth/google { idToken }`.
3. Server verifies the ID token with `google-auth-library`'s `OAuth2Client.verifyIdToken`
   against `GOOGLE_CLIENT_ID`, extracting `{ email, name, picture }`.
4. Server checks `email` (case-insensitive) against `ALLOWED_EMAILS` (comma-separated env
   var, split + trimmed + lowercased).
   - Not in list → `403 { error: "not_allowed" }`, no cookie set.
   - In list → server signs its own JWT (`{ email, name, picture }`, `SESSION_SECRET`,
     30 day expiry) and sets it as an `httpOnly, Secure, SameSite=Lax` cookie
     (`gt_session`). Responds `200 { user: { email, name, picture } }`.
5. `GET /api/auth/me` — verifies the cookie, returns `{ user }` or `401`.
6. `POST /api/auth/logout` — clears the cookie.
7. `requireAuth` Express middleware (in new `server/auth.js`) verifies the `gt_session`
   cookie and attaches `req.user`; returns `401` if missing/invalid/expired. Applied to
   `/api/ideas` (GET+PUT) and `/api/calculator` (GET+PUT). Auth routes themselves
   (`/api/auth/*`) are exempt, as is static asset serving (the SPA shell always loads; the
   client-side `AuthContext` is what decides whether to show `LoginGate` vs. the real app,
   based on `GET /api/auth/me`).
8. **Fail-closed on misconfiguration:** if `ALLOWED_EMAILS` is unset/empty at server start,
   log an error and treat the allowlist as empty (deny everyone), never fail open.

### Presence flow (Socket.IO)

1. `server/index.js` switches from `app.listen(...)` to
   `const server = http.createServer(app); const io = new Server(server, ...); server.listen(...)`.
2. Socket.IO middleware (`io.use(...)`) parses the `gt_session` cookie from
   `socket.handshake.headers.cookie`, verifies it the same way `requireAuth` does, and
   rejects the connection (`next(new Error("unauthorized"))`) if invalid. On success,
   attaches `{ email, name, picture }` to `socket.data.user`.
3. Single global room (matches the single `IdeaBoard` singleton — no multi-board concept
   exists). On connect: server sends `presence:sync` (current peer list) to the new socket,
   and broadcasts `presence:join` (this user's info) to everyone else.
4. Client (`usePresence.js` hook, mounted only in `IdeaMap.jsx`):
   - Opens `io()` (same-origin) once authenticated.
   - On canvas `mousemove`, converts screen coordinates to canvas coordinates (reusing the
     existing pan/zoom transform math already present in `IdeaMap.jsx` for drop-target
     hit-testing), throttles to ~50ms, emits `cursor:move { x, y }`.
   - Listens for `cursor:move`, `presence:join`, `presence:leave`, `presence:sync` from the
     server and maintains a `Map<socketId, { email, name, picture, x, y, color }>`.
   - Color per user: deterministic hash of `email` → HSL string, stable across the session.
5. Server relays `cursor:move` from one socket to all others in the room, attaching the
   sender's `socket.data.user` and `socket.id`.
6. On `disconnect`, server broadcasts `presence:leave { socketId }`; client drops that
   entry.
7. Rendering: peer cursors render as small colored arrow/dot + name label, absolutely
   positioned **inside the same transformed canvas container** cards already render in, so
   canvas coordinates map directly without a second transform step.

## Data model changes

None persisted. `ALLOWED_EMAILS` lives in env config, not a DB collection — a dedicated
`User` collection is unnecessary for a handful of trusted colleagues (revisit if the
allowlist grows past ~20 people). Presence state is ephemeral, socket-only, never written
to Mongo. `comment.author` (existing string field on board comments) is now populated from
the authenticated user's Google name instead of the old prompted nickname.

## Files touched

**Server**
- `server/index.js` — modify: `http.createServer` + Socket.IO mount, new `/api/auth/*`
  routes, `requireAuth` applied to `/api/ideas` and `/api/calculator`.
- `server/auth.js` — new: JWT sign/verify, allowlist check, Google ID token verification,
  `requireAuth` middleware, socket auth middleware.
- `server/.env.example` — add `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `ALLOWED_EMAILS`.
- `server/package.json` — add `google-auth-library`, `jsonwebtoken`, `socket.io`,
  `cookie-parser`.

**Client**
- `client/src/lib/auth.js` — new: `getMe()`, `loginWithGoogle(idToken)`, `logout()`.
- `client/src/context/AuthContext.jsx` — new: provides `{ user, loading, logout }`,
  mounted once at the app root so it gates every route.
- `client/src/components/LoginGate.jsx` — new: full-screen overlay with the GIS button,
  shown when `user` is null.
- `client/src/lib/usePresence.js` — new: Socket.IO connection + peer cursor state hook.
- `client/src/pages/IdeaMap.jsx` — modify: consume `usePresence`, render peer cursor
  overlay, replace `getUserName`/`currentUser` local-storage reads with `useContext(AuthContext).user`.
- `client/src/lib/user.js` + `client/src/lib/user.test.js` — deleted (superseded).
- `client/package.json` — add `socket.io-client`.

## Error handling

- Invalid/expired Google ID token → `401` from `/api/auth/google`; client shows the sign-in
  button again with a retry hint.
- Email not on the allowlist → `403 { error: "not_allowed" }`; `LoginGate` shows
  "Tài khoản {email} chưa được cấp quyền truy cập."
- Any data API call returning `401` → client's `api.js` fetch wrapper clears
  `AuthContext.user`, `LoginGate` reappears immediately (handles expired sessions
  mid-session, not just at load).
- Socket handshake rejected → client just doesn't get presence; board still works over
  REST. Log a console warning, not a fatal error.
- `ALLOWED_EMAILS` empty/unset at boot → server logs an error; every login attempt gets
  `403` until the operator sets it (never fail open).

## Manual setup required (outside code, by the user)

1. Create an OAuth Client ID in Google Cloud Console (OAuth consent screen + Web
   application client), authorized origins `http://localhost:5173` and
   `https://game-tools.onrender.com`.
2. Set `GOOGLE_CLIENT_ID`, `SESSION_SECRET` (any random string), and `ALLOWED_EMAILS`
   (comma-separated) as Render dashboard secrets (`sync: false`, same pattern as
   `MONGODB_URI`), and add the same three to local `server/.env` (Claude will not read or
   write the real `.env` file directly — the plan will state exactly what keys/values to
   add).

## Testing

- `server/auth.js` pure functions (allowlist check, JWT sign/verify roundtrip) — Node
  built-in test runner, no network mocking needed for these.
- Client coordinate-transform / throttle logic extracted where reasonably testable,
  following the existing `*.test.js` pattern next to the source file.
- Manual verification: login flow, allowlist rejection (a non-allowlisted test email),
  and a two-browser-tab presence check against a real Google OAuth Client ID — the offline
  `stub-api.mjs` Playwright harness cannot faithfully stand in for real Google token
  verification, so this step is manual, not automated.
