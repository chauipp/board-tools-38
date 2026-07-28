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
  getBoardRole,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS
} from "./auth.js";
import { Board, upsertUser } from "./models.js";
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
  console.warn(
    "ALLOWED_EMAILS trống — app đang public, ai có tài khoản Google cũng đăng nhập được. Điền ALLOWED_EMAILS trong server/.env nếu muốn giới hạn."
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
// 20mb: ảnh nằm thẳng trong board dưới dạng data URL và từ nay giữ nguyên chất
// lượng gốc, nên một lần PUT có thể mang theo vài MB ảnh. Phải lớn hơn trần
// 16MB của một document MongoDB, nếu không request chết ở đây trước khi tới chỗ
// báo lỗi tử tế; client đã tự chặn ở ngưỡng 14MB (lib/image-budget.js).
app.use(express.json({ limit: "20mb" }));
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
// maxHttpBufferSize mặc định của socket.io là 1MB. Sau mỗi lần lưu, server phát
// board:update kèm TOÀN BỘ board cho các peer — board có một tấm ảnh gốc là gói
// đó vượt 1MB và socket.io ngắt kết nối phía nhận. Nới cho khớp trần của REST.
const io = new Server(server, { maxHttpBufferSize: 20 * 1024 * 1024 });
// boards.js (router riêng, mount trước io tồn tại) cần phát board:update
// sau khi lưu REST thành công — lấy io qua app, không import vòng.
app.set("io", io);

io.use(async (socket, next) => {
  const user = parseSessionFromCookieHeader(socket.handshake.headers.cookie);
  if (!user || !isEmailAllowed(user.email)) return next(new Error("unauthorized"));
  const boardId = socket.handshake.query.boardId;
  if (!boardId) return next(new Error("missing_board"));
  let board;
  try {
    board = await Board.findById(boardId).select("ownerEmail members").lean();
  } catch (e) {
    // Mongo chết và "board id không hợp lệ" cùng ra `forbidden` ở phía client;
    // không log thì lỗi hạ tầng trông hệt như từ chối quyền và không debug được.
    console.error("Socket handshake: không đọc được board", boardId, e);
    return next(new Error("forbidden"));
  }
  if (!board) return next(new Error("forbidden"));
  const role = getBoardRole(board, user.email);
  if (!role) return next(new Error("forbidden"));
  socket.data.user = user;
  // Chuẩn hoá từ document, không từ query: hex id viết hoa/thường khác nhau vẫn
  // trỏ về cùng board nhưng sẽ tạo hai phòng presence riêng nếu lấy nguyên chuỗi.
  socket.data.boardId = String(board._id);
  socket.data.role = role;
  next();
});

// boardId -> Map<socket.id, { socketId, email, name, picture, x, y }>
const presencePeers = new Map();

// Kênh live:geom giờ chỉ mang ĐÚNG những item đang bị kéo (thường là 1), không
// mang cả board như trước. Chặn ở đây để một client lỗi (hoặc cố tình) không
// bơm được mảng khổng lồ rồi bắt server phát cho cả phòng.
const MAX_LIVE_GEOM_ITEMS = 200;
const MAX_LIVE_TEXT_LEN = 20000;

// Gói live:ink mang ĐIỂM MỚI THÊM của một nét đang vẽ. Trần này để một client
// lỗi (hoặc cố tình) không bơm được mảng khổng lồ rồi bắt server phát cho cả
// phòng — cùng lý do với MAX_LIVE_GEOM_ITEMS.
const MAX_LIVE_INK_NUMBERS = 200;
const MAX_LIVE_ERASE_IDS = 200;
// color là token kiểu "pen-red" — 32 ký tự là quá rộng rãi cho nó. w hợp lệ từ
// client hiện là 2/4/8; chấp một dải rộng hơn thay vì đúng ba giá trị đó để
// không phải redeploy server mỗi khi client đổi danh sách độ dày. Chặn ở đây
// để một client lỗi (hoặc cố tình) không bơm chuỗi màu khổng lồ hay w khổng lồ
// rồi bắt server phát vệt bút phủ kín màn hình cho cả phòng tới khi hết TTL.
const MAX_LIVE_INK_COLOR_LEN = 32;
const MIN_LIVE_INK_W = 1;
const MAX_LIVE_INK_W = 64;

// Biên độ tuyệt đối cho từng số trong `pts`. Number.isFinite một mình KHÔNG đủ:
// nó cho qua 1e9. Với nét bút, thiệt hại tối đa của toạ độ khổng lồ chỉ là một
// VỆT rộng ≤ MAX_LIVE_INK_W — đó là lý do MAX_LIVE_INK_W tồn tại. Nhưng hình
// khối có `fill`, nên gói {kind:"rect", fill:true, pts:[-1e9,-1e9,1e9,1e9]} đi
// vòng qua chốt đó và phủ kín màn hình cả phòng tới khi hết TTL.
//
// .canvas là 4200×3200 nên 20000 (gần 5 lần cạnh dài) rộng hơn mọi thao tác
// thật rất nhiều — kể cả kéo hình vượt ra ngoài mép canvas — mà vẫn giữ vùng
// hiển thị hữu hạn. Chốt này áp cho MỌI kind, cả nét bút.
const MAX_LIVE_INK_COORD = 20000;

// Gói live:laser mang các điểm mới của vệt laser. Cùng lý do trần với
// MAX_LIVE_INK_NUMBERS; nhỏ hơn vì client chỉ gom điểm trong 40ms rồi xả.
const MAX_LIVE_LASER_NUMBERS = 120;

// Bản sao TAY của SHAPE_KINDS trong game-tools/client/src/lib/shape.js, cộng
// "pen". Server không import được lib của client. Thêm một kind mới thì phải
// sửa cả hai chỗ — client sẽ vẽ được nhưng server sẽ chặn gói nếu quên.
const LIVE_INK_KINDS = new Set(["pen", "rect", "ellipse", "line", "arrow", "triangle", "diamond"]);
// Bản sao TAY của SHAPE_CLOSED trong game-tools/client/src/lib/shape.js — cũng
// vì server không import được lib client, cũng phải sửa hai chỗ nếu đổi.
// Chỉ bốn hình ĐÓNG mới có vùng trong để tô. Client không bao giờ gắn `fill`
// cho line/arrow, nên nếu server chấp thì một gói {kind:"arrow", fill:true} làm
// đầu mũi tên hiện thành nêm tô đặc lúc peer kéo rồi biến mất khi board:update
// về — nhấp nháy không giải thích được.
const LIVE_INK_FILLABLE_KINDS = new Set(["rect", "ellipse", "triangle", "diamond"]);
const LIVE_INK_BOX_NUMBERS = 4;

function sanitizeInk(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!Number.isFinite(payload.strokeId)) return null;
  const strokeId = payload.strokeId;
  const done = payload.done === true;

  if (payload.cancel === true) return { strokeId, cancel: true };

  if (Array.isArray(payload.erase)) {
    const erase = payload.erase
      .filter((id) => Number.isFinite(id))
      .slice(0, MAX_LIVE_ERASE_IDS);
    return { strokeId, erase, done };
  }

  if (done) {
    return {
      strokeId, done: true,
      drawingId: Number.isFinite(payload.drawingId) ? payload.drawingId : null
    };
  }

  // pts phải là mảng số ĐỘ DÀI CHẴN: nó là [x0,y0,x1,y1,…], lẻ một số là dữ
  // liệu hỏng chứ không phải thiếu điểm cuối.
  if (!Array.isArray(payload.pts)) return null;

  let kind = "pen";
  if (payload.kind !== undefined) {
    if (typeof payload.kind !== "string" || !LIVE_INK_KINDS.has(payload.kind)) return null;
    kind = payload.kind;
  }
  // Hình khối: pts là hai góc đối, đúng 4 số. Kiểm ĐỘ DÀI GỐC trước khi slice —
  // nếu kiểm sau thì một mảng 4000 số bị cắt còn MAX_LIVE_INK_NUMBERS rồi vẫn
  // không phải 4, nhưng một mảng gửi kèm kind sai vẫn có thể lọt qua nhờ bị cắt.
  if (kind !== "pen" && payload.pts.length !== LIVE_INK_BOX_NUMBERS) return null;

  const pts = payload.pts.slice(0, MAX_LIVE_INK_NUMBERS);
  if (pts.length < 2 || pts.length % 2 !== 0) return null;
  if (!pts.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_LIVE_INK_COORD)) return null;

  const clean = { strokeId, seq: Number.isFinite(payload.seq) ? payload.seq : 0, pts };
  // Nét bút không mang kind, đúng như client phát — giữ gói nhẹ và giữ
  // mergeInkPacket mặc định về "pen".
  if (kind !== "pen") clean.kind = kind;
  if (clean.seq === 0) {
    if (typeof payload.color !== "string" || payload.color.length > MAX_LIVE_INK_COLOR_LEN) return null;
    if (!Number.isFinite(payload.w) || payload.w < MIN_LIVE_INK_W || payload.w > MAX_LIVE_INK_W) return null;
    clean.color = payload.color;
    clean.w = payload.w;
    // Không tin kiểu client gửi: chỉ đúng `true` mới là tô đặc. Và chỉ hình
    // ĐÓNG mới được mang `fill` — nét bút, line, arrow thì không có field này.
    if (LIVE_INK_FILLABLE_KINDS.has(kind)) clean.fill = payload.fill === true;
  }
  return clean;
}

function sanitizeGeom(payload) {
  if (!payload || typeof payload !== "object") return null;
  const nodes = [];
  const groups = [];
  for (const n of Array.isArray(payload.nodes) ? payload.nodes : []) {
    if (nodes.length >= MAX_LIVE_GEOM_ITEMS) break;
    if (!n || !Number.isFinite(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    nodes.push({ id: n.id, x: n.x, y: n.y, w: Number.isFinite(n.w) ? n.w : undefined });
  }
  for (const g of Array.isArray(payload.groups) ? payload.groups : []) {
    if (groups.length >= MAX_LIVE_GEOM_ITEMS) break;
    if (!g || !Number.isFinite(g.id) || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    groups.push({
      id: g.id, x: g.x, y: g.y,
      w: Number.isFinite(g.w) ? g.w : undefined,
      h: Number.isFinite(g.h) ? g.h : undefined
    });
  }
  if (!nodes.length && !groups.length) return null;
  return { nodes, groups, done: payload.done === true };
}

function peersForBoard(boardId) {
  let m = presencePeers.get(boardId);
  if (!m) {
    m = new Map();
    presencePeers.set(boardId, m);
  }
  return m;
}

io.on("connection", (socket) => {
  const room = "board:" + socket.data.boardId;
  socket.join(room);
  const peers = peersForBoard(socket.data.boardId);
  const peer = { socketId: socket.id, ...socket.data.user, x: 0, y: 0, selectedIds: [], edgeDraft: null };
  peers.set(socket.id, peer);
  socket.emit("presence:sync", Array.from(peers.values()));
  socket.to(room).emit("presence:join", peer);

  // Cursor position là presence, không phải chỉnh sửa dữ liệu — viewer vẫn
  // được thấy và được người khác thấy con trỏ, chỉ bị chặn ghi dữ liệu thật
  // ở PUT /api/boards/:id (403 read_only).
  //
  // `.volatile`: nếu đường truyền tới một người nào đó đang tắc, gói này bị BỎ
  // thay vì xếp hàng đợi. Đúng thứ ta muốn cho dữ liệu "vị trí hiện tại": gói
  // cũ xếp hàng rồi phát bù một lượt chính là cảnh con trỏ/thẻ chạy giật lùi
  // qua cả chuỗi vị trí đã lỗi thời. Mạng chậm thì thà cập nhật thưa hơn.
  socket.on("cursor:move", (payload) => {
    const { x, y } = payload || {};
    const p = peers.get(socket.id);
    if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = x;
    p.y = y;
    socket.volatile.to(room).emit("cursor:move", p);
  });

  // Vị trí/kích thước tạm thời lúc đang kéo — không lưu DB, không giữ
  // state trên server, chỉ relay cho người khác trong room.
  socket.on("live:geom", (payload) => {
    const clean = sanitizeGeom(payload);
    if (!clean) return;
    // Gói CUỐI (done) là gói giữ vị trí bên người xem cho tới khi bản lưu chính
    // thức về — mất nó là thẻ nhảy về chỗ cũ, nên nó phải đi đường tin cậy.
    // Các gói giữa chừng thì volatile.
    if (clean.done) socket.to(room).emit("live:geom", clean);
    else socket.volatile.to(room).emit("live:geom", clean);
  });

  // Nét đang vẽ dở — không lưu DB, chỉ relay. Khác cursor/geom/text: vẽ là GHI
  // dữ liệu chứ không phải presence, nên chặn viewer ngay tại đây. Middleware
  // trên đã đặt socket.data.role.
  //
  // KHÔNG dùng .volatile: gói này mang ĐIỂM MỚI THÊM, mất một gói là nét khuyết
  // hẳn một khúc và không bao giờ tự lành (khác live:geom, nơi gói sau mang vị
  // trí tuyệt đối và tự sửa cho gói bị mất).
  socket.on("live:ink", (payload) => {
    if (socket.data.role === "viewer") return;
    const clean = sanitizeInk(payload);
    if (!clean) return;
    // socketId do SERVER đính vào, không tin id do client tự đặt — cùng cách
    // selection:update và edge-draft:update đang làm.
    socket.to(room).emit("live:ink", { ...clean, socketId: socket.id });
  });

  // Vệt laser đang chạy — không lưu DB, chỉ relay.
  //
  // KHÔNG chặn viewer, khác hẳn live:ink ngay trên: laser không ghi một chữ nào
  // vào board, nó cùng loại với cursor:move — presence thuần. Người được mời
  // vào chỉ để xem vẫn phải chỉ trỏ được khi họp.
  //
  // .volatile, cũng khác live:ink: mất một gói ở đây chỉ làm vệt thưa điểm đi
  // một khúc trong chưa tới một giây rồi biến mất cùng cả vệt — không có gì để
  // "không bao giờ tự lành" như nét bút sẽ được lưu lại vĩnh viễn.
  socket.on("live:laser", (payload) => {
    if (!payload || !Array.isArray(payload.pts)) return;
    const pts = payload.pts.slice(0, MAX_LIVE_LASER_NUMBERS);
    // pts là [x0,y0,x1,y1,…] — lẻ một số là dữ liệu hỏng, không phải thiếu điểm.
    if (pts.length < 2 || pts.length % 2 !== 0) return;
    // Number.isFinite một mình không đủ: nó cho qua 1e9, và một vệt laser toạ
    // độ khổng lồ vẫn là một vạch phủ ngang màn hình cả phòng. Dùng chung biên
    // độ với live:ink.
    if (!pts.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_LIVE_INK_COORD)) return;
    // socketId do SERVER đính vào — client dùng nó để tra ra màu con trỏ của
    // người chỉ, nên nó không được là thứ client tự khai.
    socket.volatile.to(room).emit("live:laser", { pts, socketId: socket.id });
  });

  // Nội dung đang gõ dở — không lưu DB, chỉ relay để người khác thấy chữ
  // chạy gần real-time; bản chính thức vẫn qua saveNodeEdit → PUT như cũ.
  socket.on("live:text", (payload) => {
    const { nodeId, field, value } = payload || {};
    if (!Number.isFinite(nodeId) || (field !== "title" && field !== "desc")) return;
    if (typeof value !== "string" || value.length > MAX_LIVE_TEXT_LEN) return;
    socket.volatile.to(room).emit("live:text", { nodeId, field, value });
  });

  // Vùng đang chọn của người này — presence nhẹ, không phải chỉnh sửa dữ
  // liệu, viewer vẫn gửi/nhận được như cursor.
  socket.on("selection:update", (payload) => {
    const ids = Array.isArray(payload) ? payload.filter((id) => Number.isFinite(id)) : [];
    const p = peers.get(socket.id);
    if (!p) return;
    p.selectedIds = ids;
    socket.to(room).emit("selection:update", { socketId: socket.id, selectedIds: ids });
  });

  // Đầu dây đang được kéo (link mới hoặc kéo lại đầu dây có sẵn) — cùng
  // bản chất với cursor: điểm bám theo chuột, không phải dữ liệu board.
  socket.on("edge-draft:update", (payload) => {
    const p = peers.get(socket.id);
    if (!p) return;
    p.edgeDraft = payload && Number.isFinite(payload.x) && Number.isFinite(payload.y) ? payload : null;
    // Bám theo chuột như cursor:move → cũng volatile. Riêng lúc BUÔNG dây
    // (edgeDraft = null) phải tin cậy, không thì đầu dây nháp treo lại trên màn
    // hình người khác cho tới lần kéo sau.
    const target = p.edgeDraft ? socket.volatile.to(room) : socket.to(room);
    target.emit("edge-draft:update", { socketId: socket.id, edgeDraft: p.edgeDraft });
  });

  socket.on("disconnect", () => {
    peers.delete(socket.id);
    if (peers.size === 0) presencePeers.delete(socket.data.boardId);
    socket.to(room).emit("presence:leave", { socketId: socket.id });
  });
});

server.listen(PORT, () => {
  console.log("Game tools server đang chạy tại http://localhost:" + PORT);
});
