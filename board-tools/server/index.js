import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

await mongoose.connect(MONGODB_URI);

const ideaBoardSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    view: { type: Object, default: () => ({ panX: 0, panY: 0, scale: 1 }) }
  },
  { minimize: false, versionKey: false }
);

const calculatorSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },
    budget: { type: Number, default: 500 },
    nextStatId: { type: Number, default: 1 },
    stats: { type: Array, default: [] }
  },
  { minimize: false, versionKey: false }
);

const IdeaBoard = mongoose.model("IdeaBoard", ideaBoardSchema);
const Calculator = mongoose.model("Calculator", calculatorSchema);

const defaultIdeas = {
  nodes: [
    { id: 1, title: "Ngân sách điểm chiến đấu", desc: "500 điểm chia vào Máu / Giáp / Xuyên giáp / Tấn công. Đây là cốt lõi giữ chân người chơi.", tag: "Cơ chế", status: "chosen", x: 60, y: 40 },
    { id: 2, title: "Hệ vũ khí (tam giác)", desc: "3 loại khắc chế vòng tròn, kiểu Fire Emblem. Làm trước hệ nguyên tố.", tag: "Cơ chế", status: "considering", x: 360, y: 40 },
    { id: 3, title: "5 phe", desc: "Đề xuất bắt đầu 2-3 phe để giảm khối lượng cân bằng ban đầu.", tag: "Nội dung", status: "parked", x: 60, y: 260 },
    { id: 4, title: "Leo hạng / Elo online", desc: "Chỉ thêm sau khi core loop đã vui và có đủ người chơi để ghép trận.", tag: "Kỹ thuật", status: "parked", x: 360, y: 260 }
  ],
  edges: [
    { id: 1, from: 1, to: 2 },
    { id: 2, from: 1, to: 3 }
  ],
  nextNodeId: 5,
  nextEdgeId: 3,
  view: { panX: 60, panY: 60, scale: 1 }
};

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
  const ideaCount = await IdeaBoard.countDocuments({ singleton: "main" });
  if (ideaCount === 0) await IdeaBoard.create({ singleton: "main", ...defaultIdeas });

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
app.use(express.json({ limit: "2mb" }));

app.get("/api/ideas", async (req, res) => {
  try {
    const doc = await IdeaBoard.findOne({ singleton: "main" });
    res.json(stripMongoMeta(doc));
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu ý tưởng." });
  }
});

app.put("/api/ideas", async (req, res) => {
  try {
    const { nodes, edges, nextNodeId, nextEdgeId, view } = req.body;
    await IdeaBoard.findOneAndUpdate(
      { singleton: "main" },
      { nodes, edges, nextNodeId, nextEdgeId, view },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không lưu được dữ liệu ý tưởng." });
  }
});

app.get("/api/calculator", async (req, res) => {
  try {
    const doc = await Calculator.findOne({ singleton: "main" });
    res.json(stripMongoMeta(doc));
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu bàn tính." });
  }
});

app.put("/api/calculator", async (req, res) => {
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

app.listen(PORT, () => {
  console.log("Game tools server đang chạy tại http://localhost:" + PORT);
});
