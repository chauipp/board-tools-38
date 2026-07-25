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

export function getBoardRole(board, email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized) return null;
  if (String(board.ownerEmail || "").toLowerCase() === normalized) return "owner";
  const member = (board.members || []).find(
    (m) => String(m.email || "").toLowerCase() === normalized
  );
  return member ? member.role : null;
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
  if (!user || !isEmailAllowed(user.email)) {
    return res.status(401).json({ error: "unauthorized" });
  }
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
