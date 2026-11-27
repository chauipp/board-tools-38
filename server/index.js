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
import { requireAuth } from "./auth.js";
import boardsRouter from "./boards.js";
import workspaceRouter from "./workspace.js";
import { runQuotaCheck, usageReport, usageReportFor, describeUsage } from "./pdf-quota.js";
import authRouter from "./routes/auth.js";
import calculatorRouter from "./routes/calculator.js";
import { handshake } from "./realtime/handshake.js";
import { registerPresence } from "./realtime/presence.js";

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

io.use(handshake);

registerPresence(io);

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
