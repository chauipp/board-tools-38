import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import { requireAuth } from "./auth.js";
import boardsRouter from "./boards.js";
import workspaceRouter from "./workspace.js";
import { usageReportFor } from "./pdf-quota.js";
import authRouter from "./routes/auth.js";
import calculatorRouter from "./routes/calculator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

// Dựng express app: middleware, API, rồi static. Thứ tự mount giữ nguyên như khi
// còn nằm trong index.js — workspaceRouter trước boardsRouter, static sau API.
//
// io KHÔNG truyền vào đây: io cần http server, http server cần app, nên index.js
// dựng io sau rồi gắn bằng app.set("io", io) như trước.
export function createApp() {
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

  return app;
}
