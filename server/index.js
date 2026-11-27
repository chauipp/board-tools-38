// config.js PHẢI là import đầu tiên: nó nạp .env trước khi các module phía sau
// đọc biến môi trường lúc nạp.
import { PORT, MONGODB_URI, assertStartupConfig } from "./config.js";
import mongoose from "mongoose";
import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { usageReport, describeUsage } from "./pdf-quota.js";
import { handshake } from "./realtime/handshake.js";
import { registerPresence } from "./realtime/presence.js";
import { scheduleQuotaChecks } from "./jobs/quota-cron.js";

assertStartupConfig();

await mongoose.connect(MONGODB_URI);

const app = createApp();

const server = http.createServer(app);
// maxHttpBufferSize mặc định của socket.io là 1MB. Sau mỗi lần lưu, server phát
// board:update kèm TOÀN BỘ board cho các peer — board có một tấm ảnh gốc là gói
// đó vượt 1MB và socket.io ngắt kết nối phía nhận. Nới cho khớp trần của REST.
const io = new Server(server, { maxHttpBufferSize: 20 * 1024 * 1024 });
// routes/boards.js và routes/board-snapshots.js (router riêng, mount trước io
// tồn tại) cần phát board:update sau khi lưu REST thành công — lấy io qua app,
// không import vòng.
app.set("io", io);

io.use(handshake);

registerPresence(io);

server.listen(PORT, async () => {
  console.log("Game tools server đang chạy tại http://localhost:" + PORT);
  try {
    console.log(`[pdf-quota] ${describeUsage(await usageReport())}`);
  } catch (e) {
    console.warn(`[pdf-quota] chưa đọc được dung lượng kho PDF: ${e.message}`);
  }
  scheduleQuotaChecks();
});
