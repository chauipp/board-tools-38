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
  isEmailAllowed,
  signSession,
  verifyGoogleIdToken,
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS
} from "./auth.js";
import { User, Board, upsertUser } from "./models.js";
import boardsRouter from "./boards.js";

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

if (!process.env.ALLOWED_EMAILS) {
  console.error(
    "Thiếu ALLOWED_EMAILS — mọi đăng nhập sẽ bị từ chối cho đến khi biến này được cấu hình trong server/.env."
  );
}

await mongoose.connect(MONGODB_URI);

const calculatorSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },
    budget: { type: Number, default: 500 },
    nextStatId: { type: Number, default: 1 },
    stats: { type: Array, default: [] }
  },
  { minimize: false, versionKey: false }
);

const Calculator = mongoose.model("Calculator", calculatorSchema);

const defaultCalculator = {
  budget: 500,
  nextStatId: 5,
  stats: [
    { id: 1, name: "Máu", cost: 1, a: 200, b: 220 },
    { id: 2, name: "Giáp", cost: 2, a: 60, b: 30 },
    { id: 3, name: "Xuyên giáp", cost: 2, a: 20, b: 50 },
    { id: 4, name: "Tấn công", cost: 1, a: 80, b: 70 }
  ]
};

async function ensureSeed() {
  const calcCount = await Calculator.countDocuments({ singleton: "main" });
  if (calcCount === 0) await Calculator.create({ singleton: "main", ...defaultCalculator });
}
await ensureSeed();

function stripMongoMeta(doc) {
  const obj = doc.toObject();
  delete obj._id;
  delete obj.singleton;
  return obj;
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use("/api/boards", requireAuth, boardsRouter);

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
  try {
    await upsertUser(googleUser);
  } catch (e) {
    console.error("Không lưu được thông tin user:", e);
  }
  let token;
  try {
    token = signSession(googleUser);
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
  res.json({ user: googleUser });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/calculator", requireAuth, async (req, res) => {
  try {
    const doc = await Calculator.findOne({ singleton: "main" });
    res.json(stripMongoMeta(doc));
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu bàn tính." });
  }
});

app.put("/api/calculator", requireAuth, async (req, res) => {
  try {
    const { budget, nextStatId, stats } = req.body;
    await Calculator.findOneAndUpdate(
      { singleton: "main" },
      { budget, nextStatId, stats },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không lưu được dữ liệu bàn tính." });
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
const io = new Server(server);

io.use((socket, next) => {
  const user = parseSessionFromCookieHeader(socket.handshake.headers.cookie);
  if (!user || !isEmailAllowed(user.email)) return next(new Error("unauthorized"));
  socket.data.user = user;
  next();
});

const presencePeers = new Map(); // socket.id -> { socketId, email, name, picture, x, y }

io.on("connection", (socket) => {
  const peer = { socketId: socket.id, ...socket.data.user, x: 0, y: 0 };
  presencePeers.set(socket.id, peer);
  socket.emit("presence:sync", Array.from(presencePeers.values()));
  socket.broadcast.emit("presence:join", peer);

  socket.on("cursor:move", (payload) => {
    const { x, y } = payload || {};
    const p = presencePeers.get(socket.id);
    if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
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
