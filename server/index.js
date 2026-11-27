import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import http from "node:http";
import { Server } from "socket.io";
import {
  requireAuth,
  canLogin,
  isPublicMode,
  allowlistStartupError,
  passwordAccountsStartupError,
  verifyPasswordLogin,
  signSession,
  verifyGoogleIdToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS
} from "./auth.js";
import { upsertUser } from "./models.js";
import { registerBoardRealtime } from "./board-realtime.js";
import boardsRouter from "./boards.js";
import workspaceRouter from "./workspace.js";
import { runQuotaCheck, usageReport, usageReportFor, describeUsage } from "./pdf-quota.js";
import { rateLimit } from "./rate-limit.js";
import calculatorRouter from "./calculator-routes.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(
    "Thiếu MONGODB_URI. Copy server/.env.example thành server/.env rồi điền connection string từ MongoDB Atlas."
  );
  process.exit(1);
}

if (!process.env.VITE_GOOGLE_CLIENT_ID) {
  console.error(
    "Thiếu VITE_GOOGLE_CLIENT_ID. Copy server/.env.example thành server/.env rồi điền Google OAuth client ID."
  );
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error(
    "Thiếu SESSION_SECRET. Copy server/.env.example thành server/.env rồi điền một chuỗi ngẫu nhiên dài để ký session JWT."
  );
  process.exit(1);
}

// Dừng hẳn chứ không cảnh báo. Cảnh báo cũ nằm lẫn giữa hàng chục dòng log lúc
// khởi động và đã bị bỏ qua suốt nhiều tháng — app chạy public mà không ai để ý.
// Mở cửa là một quyết định, nên phải viết ra thành PUBLIC_MODE=true.
const passwordAccountsError = passwordAccountsStartupError();
if (passwordAccountsError) {
  console.error(passwordAccountsError);
  process.exit(1);
}

const allowlistError = allowlistStartupError();
if (allowlistError) {
  console.error(allowlistError);
  process.exit(1);
}
if (isPublicMode()) {
  console.warn(
    "PUBLIC_MODE=true — ai có tài khoản Google cũng đăng nhập được, và cùng tiêu chung hạn mức kho PDF."
  );
}

await mongoose.connect(MONGODB_URI);

// Mỗi người một bàn tính riêng.
//

const app = express();
// 20mb: ảnh nằm thẳng trong board dưới dạng data URL và từ nay giữ nguyên chất
// lượng gốc, nên một lần PUT có thể mang theo vài MB ảnh. Phải lớn hơn trần
// 16MB của một document MongoDB, nếu không request chết ở đây trước khi tới chỗ
// báo lỗi tử tế; client đã tự chặn ở ngưỡng 14MB (lib/image-budget.js).
// Render đứng sau một lớp proxy. Không khai trust proxy thì req.ip là IP của
// proxy — mọi người dùng chung một ô đếm, và bộ giới hạn đăng nhập sẽ khoá cả
// thiên hạ ngay khi một người gõ sai vài lần. Số 1 = tin đúng một lớp proxy,
// không tin cả chuỗi X-Forwarded-For do client tự bịa ra.
app.set("trust proxy", 1);
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use("/api/boards", requireAuth, workspaceRouter);
app.use("/api/boards", requireAuth, boardsRouter);

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

app.post("/api/auth/google", loginLimiter, async (req, res) => {
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

app.post("/api/auth/password", passwordLoginLimiter, async (req, res) => {
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

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
});

app.use("/api/calculator", requireAuth, calculatorRouter);

// Xem dung lượng kho PDF từ trình duyệt, không phải đi mò log Render. Ai đăng
// nhập được cũng xem được: đây là con số của cả hệ thống, và người dùng cần biết
// vì sắp tới lúc họ không upload được nữa.
app.get("/api/pdf-usage", requireAuth, async (req, res) => {
  try {
    res.json(await usageReportFor(req.user.email));
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dung lượng kho PDF." });
  }
});

app.use(express.static(CLIENT_DIST));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(CLIENT_DIST, "index.html"), (err) => {
    if (err) {
      res
        .status(404)
        .send('Chưa build client — chạy "npm run build" trong thư mục client, hoặc dùng "npm run dev" ở chế độ phát triển.');
    }
  });
});

const server = http.createServer(app);
// maxHttpBufferSize mặc định của socket.io là 1MB. Sau mỗi lần lưu, server phát
// board:update kèm TOÀN BỘ board cho các peer — board có một tấm ảnh gốc là gói
// đó vượt 1MB và socket.io ngắt kết nối phía nhận. Nới cho khớp trần của REST.
const io = new Server(server, { maxHttpBufferSize: 20 * 1024 * 1024 });
// boards.js (router riêng, mount trước io tồn tại) cần phát board:update
// sau khi lưu REST thành công — lấy io qua app, không import vòng.
app.set("io", io);

registerBoardRealtime(io);

// Cron dọn rác + đo dung lượng kho PDF. Là setInterval trong tiến trình, không
// phải Render Cron Job: cron của Render là dịch vụ trả tiền, còn cái này chạy
// miễn phí ngay trong web service.
//
// Đánh đổi phải biết: web service free của Render ngủ sau 15 phút không ai truy
// cập, và lúc ngủ thì interval không chạy. Nên đây là "mỗi 6 giờ nếu app còn
// thức", không phải đúng giờ tuyệt đối. Với việc chỉ để cảnh báo dung lượng thì
// đủ, vì dung lượng chỉ tăng khi có người dùng app — mà lúc đó app đang thức.
const QUOTA_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function scheduleQuotaChecks() {
  const run = () =>
    runQuotaCheck().catch((e) => console.warn(`[pdf-quota] vòng kiểm tra lỗi: ${e.message}`));
  // Chạy một lượt sau khi khởi động, chậm 30 giây để không giành tài nguyên với
  // lúc app đang lên và phục vụ request đầu tiên.
  setTimeout(run, 30_000).unref();
  setInterval(run, QUOTA_CHECK_INTERVAL_MS).unref();
}

server.listen(PORT, async () => {
  console.log("Game tools server đang chạy tại http://localhost:" + PORT);
  try {
    console.log(`[pdf-quota] ${describeUsage(await usageReport())}`);
  } catch (e) {
    console.warn(`[pdf-quota] chưa đọc được dung lượng kho PDF: ${e.message}`);
  }
  scheduleQuotaChecks();
});
