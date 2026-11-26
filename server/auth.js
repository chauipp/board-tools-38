import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Board } from "./models.js";

const scrypt = promisify(scryptCallback);

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
//
// Tài khoản mật khẩu (PASSWORD_ACCOUNTS) luôn được vào: khai tài khoản trong
// biến môi trường đã là một quyết định cấp quyền rõ ràng, không cần chép email
// của nó sang ALLOWED_EMAILS lần nữa.
export function isEmailAllowed(email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized) return false;
  if (getPasswordAccounts().some((a) => a.email === normalized)) return true;
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return isPublicMode();
  return allowed.includes(normalized);
}

// Chỉ địa chỉ Gmail mới được mời ngoài ALLOWED_EMAILS. Giới hạn theo miền chứ
// không theo "bất kỳ email nào" để lời mời không biến thành mở cửa cho mọi người.
const GMAIL_RE = /@(gmail|googlemail)\.com$/;
export function isGmailAddress(email) {
  return GMAIL_RE.test(String(email || "").trim().toLowerCase());
}

// Ai được đăng nhập: có trong ALLOWED_EMAILS (hoặc tài khoản mật khẩu, PUBLIC_MODE),
// hoặc đang là thành viên của ít nhất một board với lời mời có grantsLogin.
// Tách khỏi isEmailAllowed để phần tra cứu board (cần Mongo) chỉ chạy khi cần.
export async function canLogin(email, models = { Board }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  if (isEmailAllowed(normalized)) return true;
  const grant = await models.Board.exists({
    members: { $elemMatch: { email: normalized, grantsLogin: true } }
  });
  return Boolean(grant);
}

// Lý do phải dừng ngay lúc khởi động, hoặc null nếu cấu hình dùng được. Tách
// khỏi index.js để test được mà không phải dựng cả server lên.
export function allowlistStartupError() {
  if (getAllowedEmails().length > 0) return null;
  if (getPasswordAccounts().length > 0) return null;
  if (isPublicMode()) return null;
  return (
    "ALLOWED_EMAILS trống. Điền danh sách email được phép đăng nhập (cách nhau bởi dấu phẩy), " +
    "hoặc khai PUBLIC_MODE=true nếu thật sự muốn ai có tài khoản Google cũng vào được."
  );
}

// Tài khoản mật khẩu có tên trong FULL_BOARD_ACCESS_ACCOUNTS (tên đăng nhập, cách
// nhau bởi dấu phẩy) thấy và sửa được MỌI board với quyền editor, không cần là
// thành viên. Cố ý không cấp owner: không xoá board, không mời hay gỡ thành viên.
export function hasAllBoardsAccess(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  const names = (process.env.FULL_BOARD_ACCESS_ACCOUNTS || "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  if (names.length === 0) return false;
  return getPasswordAccounts().some((a) => a.email === normalized && names.includes(a.username));
}

export function getBoardRole(board, email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized) return null;
  if (String(board.ownerEmail || "").toLowerCase() === normalized) return "owner";
  if (hasAllBoardsAccess(normalized)) return "editor";
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

export async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE_NAME];
  const user = token && verifySession(token);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  let allowed;
  try {
    allowed = await canLogin(user.email);
  } catch (e) {
    return next(e);
  }
  if (!allowed) return res.status(401).json({ error: "unauthorized" });
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

// ---------------------------------------------------------------------------
// Đăng nhập bằng tên đăng nhập + mật khẩu.
//
// Tài khoản khai trong PASSWORD_ACCOUNTS, cách nhau bởi dấu phẩy, mỗi tài khoản
// có dạng `username:email:saltHex:hashHex` (email để trống được). Không bao giờ
// lưu mật khẩu gốc: chỉ có salt + scrypt hash, tạo bằng
// `node scripts/hash-password.mjs <username> [email]`.
//
// Vì sao để trong biến môi trường mà không có bảng user trong Mongo: app chỉ có
// vài tài khoản do người vận hành cấp tay, giống hệt ALLOWED_EMAILS — không có
// màn hình đăng ký, nên cũng không có gì cần ghi vào DB.
//
// Mọi thứ trong app (chủ board, thành viên, hạn mức PDF) đều neo vào email, nên
// mỗi tài khoản mật khẩu cũng phải có một email. Không khai thì dùng email nội
// bộ `<username>@password.local` — một danh tính riêng, không trùng ai.

const PASSWORD_KEYLEN = 64;
const USERNAME_RE = /^[a-z0-9._-]{3,64}$/;
export const PASSWORD_LOCAL_DOMAIN = "password.local";

function parsePasswordAccountsRaw(raw) {
  const accounts = [];
  const errors = [];
  for (const entry of String(raw || "").split(",").map((e) => e.trim()).filter(Boolean)) {
    const parts = entry.split(":");
    const [rawUsername, rawEmail, salt, hash] = parts;
    const username = String(rawUsername || "").trim().toLowerCase();
    if (
      parts.length !== 4 ||
      !USERNAME_RE.test(username) ||
      !/^[0-9a-f]{32}$/i.test(salt || "") ||
      !new RegExp(`^[0-9a-f]{${PASSWORD_KEYLEN * 2}}$`, "i").test(hash || "")
    ) {
      // Không in cả entry ra log: trong đó có hash.
      errors.push(username || "(không có tên)");
      continue;
    }
    const email = String(rawEmail || "").trim().toLowerCase() || `${username}@${PASSWORD_LOCAL_DOMAIN}`;
    accounts.push({ username, email, salt: salt.toLowerCase(), hash: hash.toLowerCase() });
  }
  return { accounts, errors };
}

export function getPasswordAccounts() {
  return parsePasswordAccountsRaw(process.env.PASSWORD_ACCOUNTS).accounts;
}

// Entry viết sai thì dừng lúc khởi động, đừng để nó lặng lẽ thành "sai mật khẩu".
export function passwordAccountsStartupError() {
  const { accounts, errors } = parsePasswordAccountsRaw(process.env.PASSWORD_ACCOUNTS);
  if (errors.length > 0) {
    return (
      `PASSWORD_ACCOUNTS có tài khoản viết sai định dạng: ${errors.join(", ")}. ` +
      "Mỗi tài khoản phải là username:email:saltHex:hashHex — tạo bằng `node scripts/hash-password.mjs <username> [email]`."
    );
  }
  const seen = new Set();
  for (const a of accounts) {
    if (seen.has(a.username)) return `PASSWORD_ACCOUNTS khai trùng tên đăng nhập: ${a.username}.`;
    seen.add(a.username);
  }
  return null;
}

export async function hashPassword(password, saltHex = randomBytes(16).toString("hex")) {
  const hash = await scrypt(String(password), Buffer.from(saltHex, "hex"), PASSWORD_KEYLEN);
  return { salt: saltHex, hash: hash.toString("hex") };
}

// Dùng khi tên đăng nhập không tồn tại: vẫn tính scrypt một lần để thời gian trả
// lời giống hệt trường hợp sai mật khẩu, không lộ ra tên nào có thật.
const DUMMY_SALT = "00".repeat(16);

// Trả về user ({ email, name, picture }) nếu đúng, null nếu sai.
export async function verifyPasswordLogin(username, password) {
  const normalized = String(username || "").trim().toLowerCase();
  const account = getPasswordAccounts().find((a) => a.username === normalized);
  const { hash } = await hashPassword(password, account ? account.salt : DUMMY_SALT);
  if (!account) return null;
  const expected = Buffer.from(account.hash, "hex");
  const actual = Buffer.from(hash, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { email: account.email, name: account.username, picture: null };
}
