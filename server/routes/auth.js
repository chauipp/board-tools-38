import { Router } from "express";
import {
  requireAuth,
  canLogin,
  verifyPasswordLogin,
  signSession,
  verifyGoogleIdToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS
} from "../auth.js";
import { upsertUser } from "../models.js";
import { rateLimit } from "../rate-limit.js";

const router = Router();

// Đăng nhập: chặn theo IP. Mỗi lần gọi là một lượt xác minh token với Google,
// nên đây vừa là cửa chống dò tài khoản vừa là cửa giữ cho quota Google không
// bị đốt bởi một vòng lặp nào đó.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyOf: (req) => req.ip
});

// Dùng chung cho mọi cách đăng nhập: ghi user, ký JWT, đặt cookie.
async function startSession(res, user) {
  try {
    await upsertUser(user);
  } catch (e) {
    console.error("Không lưu được thông tin user:", e);
  }
  let token;
  try {
    token = signSession(user);
  } catch (e) {
    console.error("signSession thất bại:", e);
    return res.status(500).json({ error: "session_error" });
  }
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_MS
  });
  res.json({ user });
}

router.post("/google", loginLimiter, async (req, res) => {
  let googleUser;
  try {
    googleUser = await verifyGoogleIdToken(req.body.idToken);
  } catch (e) {
    return res.status(401).json({ error: "invalid_token" });
  }
  let allowed;
  try {
    allowed = await canLogin(googleUser.email);
  } catch (e) {
    console.error("Kiểm tra quyền đăng nhập thất bại:", e);
    return res.status(500).json({ error: "login_error" });
  }
  if (!allowed) {
    return res.status(403).json({ error: "not_allowed" });
  }
  return startSession(res, googleUser);
});

// Chặt hơn cửa Google: ở đây mỗi lượt là một lần đoán mật khẩu, không có Google
// đứng giữa lọc hộ. 10 lần / 10 phút / IP là dư cho người gõ nhầm.
const passwordLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyOf: (req) => req.ip
});

router.post("/password", passwordLoginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password ||
    username.length > 64 ||
    password.length > 256
  ) {
    return res.status(400).json({ error: "invalid_request" });
  }
  let user;
  try {
    user = await verifyPasswordLogin(username, password);
  } catch (e) {
    console.error("Kiểm tra mật khẩu thất bại:", e);
    return res.status(500).json({ error: "login_error" });
  }
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  return startSession(res, user);
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
});

export default router;
