// config.js PHẢI là import đầu tiên: nó nạp .env trước khi các module phía sau
// đọc biến môi trường lúc nạp.
import { PORT, MONGODB_URI, assertStartupConfig } from "./config.js";
import express from "express";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import http from "node:http";
import { Server } from "socket.io";
import {
  requireAuth,
  canLogin,
  parseSessionFromCookieHeader,
  getBoardRole
} from "./auth.js";
import { Board } from "./models.js";
import boardsRouter from "./boards.js";
import workspaceRouter from "./workspace.js";
import { sanitizeView, resolveFollow, countWatchers, releaseFollowersOf } from "./follow.js";
import { sanitizeInk } from "./realtime/sanitize-ink.js";
import { sanitizeGeom } from "./realtime/sanitize-geom.js";
import { sanitizeLaser } from "./realtime/sanitize-laser.js";
import { runQuotaCheck, usageReport, usageReportFor, describeUsage } from "./pdf-quota.js";
import authRouter from "./routes/auth.js";
import calculatorRouter from "./routes/calculator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

assertStartupConfig();

await mongoose.connect(MONGODB_URI);

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

app.use("/api/auth", authRouter);
app.use("/api/calculator", calculatorRouter);

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

io.use(async (socket, next) => {
  const user = parseSessionFromCookieHeader(socket.handshake.headers.cookie);
  if (!user) return next(new Error("unauthorized"));
  let allowed;
  try {
    allowed = await canLogin(user.email);
  } catch (e) {
    console.error("Socket handshake: không kiểm tra được quyền đăng nhập", e);
    return next(new Error("forbidden"));
  }
  if (!allowed) return next(new Error("unauthorized"));
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

// boardId -> Map<socket.id, { socketId, email, name, picture, x, y, followingId }>
const presencePeers = new Map();

const MAX_LIVE_TEXT_LEN = 20000;

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
  const peer = {
    socketId: socket.id, ...socket.data.user,
    x: 0, y: 0, selectedIds: [], edgeDraft: null,
    // Ai người này đang ghim màn hình. Nằm trong peer (không phải state riêng)
    // để nó đi kèm presence:sync — người mới vào thấy ngay ai đang xem theo ai.
    followingId: null
  };
  peers.set(socket.id, peer);

  // Báo cho MỘT người biết hiện có bao nhiêu người đang xem màn hình họ. Client
  // dùng con số này làm công tắc: bằng 0 thì không phát view:update lấy một gói
  // nào. Ghim là tính năng dùng theo đợt (lúc họp), nên mặc định phải là im
  // lặng tuyệt đối chứ không phải "cứ phát rồi ai cần thì nghe".
  function sendWatchedCount(targetId) {
    if (!targetId) return;
    io.to(targetId).emit("follow:watched", { count: countWatchers(peers, targetId) });
  }
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
    const clean = sanitizeLaser(payload);
    if (!clean) return;
    // socketId do SERVER đính vào, không tin id client tự khai — cùng cách
    // live:ink và selection:update đang làm.
    socket.volatile.to(room).emit("live:laser", { ...clean, socketId: socket.id });
  });

  // Khung nhìn (pan/zoom) của người này, cho tính năng ghim màn hình. Presence
  // thuần như cursor/laser: không ghi một chữ nào vào board, nên KHÔNG chặn
  // viewer — người được mời vào chỉ để xem vẫn phải bám theo màn hình người
  // đang thuyết trình.
  //
  // .volatile: đây là "vị trí camera HIỆN TẠI", gói cũ xếp hàng rồi phát bù là
  // cảnh màn hình người xem chạy giật lùi qua cả chuỗi khung nhìn đã lỗi thời —
  // cùng lý do với cursor:move.
  socket.on("view:update", (payload) => {
    const view = sanitizeView(payload);
    if (!view) return;
    // Chỉ gửi cho ĐÚNG những người đang ghim mình, không phát cả phòng: trong
    // một cuộc họp 6 người mà 5 người ghim 1, người còn lại không việc gì phải
    // nhận 20 gói/giây về camera của người khác.
    for (const [id, p] of peers) {
      if (p.followingId === socket.id) io.to(id).volatile.emit("view:update", { socketId: socket.id, view });
    }
  });

  // Bắt đầu / ngừng ghim màn hình một người. targetId = null là bỏ ghim.
  socket.on("follow:update", (payload) => {
    const p = peers.get(socket.id);
    if (!p) return;
    const targetId = payload?.targetId ?? null;
    const res = resolveFollow(peers, socket.id, targetId);
    if (!res.ok) {
      // Báo lại cho chính người bấm: nút ghim của họ đang ở trạng thái "đang
      // ghim" trên màn hình, không nói gì thì nó kẹt ở đó vĩnh viễn.
      socket.emit("follow:denied", { targetId, reason: res.reason });
      return;
    }
    const prevId = p.followingId;
    if (prevId === res.targetId) return;
    p.followingId = res.targetId;
    // io.to chứ KHÔNG socket.to: chính người bấm cũng phải nhận gói này. Client
    // cố ý không tự bật trạng thái ghim mà chờ server ừ — nếu không, một server
    // đang chạy code cũ (không hiểu sự kiện này) sẽ để giao diện hiện "đang
    // ghim" với đủ viền và chip, trong khi thực tế không có gì xảy ra cả.
    io.to(room).emit("follow:update", { socketId: socket.id, followingId: p.followingId });
    // Cả mục tiêu CŨ lẫn MỚI đều đổi số người xem — quên bên cũ thì người vừa
    // bị bỏ ghim cứ phát view mãi cho một khán giả không còn ai.
    sendWatchedCount(prevId);
    sendWatchedCount(res.targetId);
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
    const leaving = peers.get(socket.id);
    peers.delete(socket.id);

    // Người vừa rời đang bị người khác ghim: thả họ ra. Không thả thì họ ngồi
    // chờ view của một socket đã chết — màn hình đứng im, trông hệt như mạng
    // lag, và cái viền "đang xem màn hình của X" treo lại vĩnh viễn.
    for (const id of releaseFollowersOf(peers, socket.id)) {
      io.to(room).emit("follow:update", { socketId: id, followingId: null });
    }
    // Người vừa rời đang ghim ai đó: người đó nay ít đi một khán giả, và nếu về
    // 0 thì ngừng phát view. Tính SAU khi đã xoá khỏi peers để không đếm nhầm
    // chính người vừa đi.
    if (leaving?.followingId) sendWatchedCount(leaving.followingId);

    if (peers.size === 0) presencePeers.delete(socket.data.boardId);
    socket.to(room).emit("presence:leave", { socketId: socket.id });
  });
});

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
