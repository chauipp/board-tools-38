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

export function isPublicMode() {
  return String(process.env.PUBLIC_MODE || "").trim().toLowerCase() === "true";
}

// Danh sách rỗng KHÔNG còn nghĩa là "cho tất cả". Muốn mở cửa thì phải khai
// PUBLIC_MODE=true.
//
// Lý do đổi: "quên cấu hình allowlist" và "cố ý làm app public" trước đây trông
// giống hệt nhau — cùng một biến để trống — mà hậu quả thì không giống. App này
// có board cộng tác và một kho PDF DÙNG CHUNG có hạn mức: người lạ đăng nhập
// được là chiếm được dung lượng của cả nhóm cho tới khi chạm trần, lúc đó chính
// chủ cũng không tải PDF lên được nữa.
export function isEmailAllowed(email) {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return isPublicMode();
  return allowed.includes(String(email || "").toLowerCase());
}

// Lý do phải dừng ngay lúc khởi động, hoặc null nếu cấu hình dùng được. Tách
// khỏi index.js để test được mà không phải dựng cả server lên.
export function allowlistStartupError() {
  if (getAllowedEmails().length > 0) return null;
  if (isPublicMode()) return null;
  return (
    "ALLOWED_EMAILS trống. Điền danh sách email được phép đăng nhập (cách nhau bởi dấu phẩy), " +
    "hoặc khai PUBLIC_MODE=true nếu thật sự muốn ai có tài khoản Google cũng vào được."
  );
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
