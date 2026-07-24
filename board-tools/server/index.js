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
    groups: { type: Array, default: [] },
    statuses: { type: Array, default: undefined },
    tags: { type: Array, default: undefined },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    nextGroupId: { type: Number, default: 1 },
    nextStatusId: { type: Number, default: 1 },
    nextTagId: { type: Number, default: 1 },
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

const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];
const STATUS_KEY_TO_ID = { idea: 1, considering: 2, chosen: 3, parked: 4, rejected: 5 };

const defaultIdeas = {
  nodes: [
    { id: 1, title: "Ngân sách điểm chiến đấu", desc: "500 điểm chia vào Máu / Giáp / Xuyên giáp / Tấn công. Đây là cốt lõi giữ chân người chơi.", tagId: 1, statusId: 3, x: 60, y: 40 },
    { id: 2, title: "Hệ vũ khí (tam giác)", desc: "3 loại khắc chế vòng tròn, kiểu Fire Emblem. Làm trước hệ nguyên tố.", tagId: 1, statusId: 2, x: 360, y: 40 },
    { id: 3, title: "5 phe", desc: "Đề xuất bắt đầu 2-3 phe để giảm khối lượng cân bằng ban đầu.", tagId: 2, statusId: 4, x: 60, y: 260 },
    { id: 4, title: "Leo hạng / Elo online", desc: "Chỉ thêm sau khi core loop đã vui và có đủ người chơi để ghép trận.", tagId: 3, statusId: 4, x: 360, y: 260 }
  ],
  edges: [
    { id: 1, from: 1, to: 2 },
    { id: 2, from: 1, to: 3 }
  ],
  groups: [],
  statuses: DEFAULT_STATUSES,
  tags: [
    { id: 1, name: "Cơ chế", color: "dot-1" },
    { id: 2, name: "Nội dung", color: "dot-2" },
    { id: 3, name: "Kỹ thuật", color: "dot-3" }
  ],
  nextNodeId: 5,
  nextEdgeId: 3,
  nextGroupId: 1,
  nextStatusId: 6,
  nextTagId: 4,
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

const DOT_COUNT = 8;
function hashTagToken(name) {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "dot-" + ((h % DOT_COUNT) + 1);
}

// Di trú một board cũ (node.status key + node.tag string) sang mô hình keyed.
// Idempotent: chỉ chạy phần còn thiếu. Trả về true nếu có thay đổi.
function migrateBoard(doc) {
  let changed = false;

  if (!Array.isArray(doc.statuses)) {
    doc.statuses = DEFAULT_STATUSES.map((s) => ({ ...s }));
    doc.nextStatusId = 6;
    (doc.nodes || []).forEach((n) => {
      n.statusId = STATUS_KEY_TO_ID[n.status] ?? null;
      delete n.status;
    });
    changed = true;
  }

  if (!Array.isArray(doc.tags)) {
    const nameToId = new Map();
    const tags = [];
    let nextId = 1;
    (doc.nodes || []).forEach((n) => {
      const name = (n.tag || "").trim();
      if (name && !nameToId.has(name)) {
        nameToId.set(name, nextId);
        tags.push({ id: nextId, name, color: hashTagToken(name) });
        nextId++;
      }
    });
    doc.tags = tags;
    doc.nextTagId = nextId;
    (doc.nodes || []).forEach((n) => {
      const name = (n.tag || "").trim();
      n.tagId = name ? nameToId.get(name) : null;
      delete n.tag;
    });
    changed = true;
  }

  return changed;
}

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
app.use(express.json({ limit: "10mb" }));

app.get("/api/ideas", async (req, res) => {
  try {
    const doc = await IdeaBoard.findOne({ singleton: "main" });
    const obj = doc.toObject();
    if (migrateBoard(obj)) {
      await IdeaBoard.findOneAndUpdate(
        { singleton: "main" },
        {
          nodes: obj.nodes,
          statuses: obj.statuses,
          tags: obj.tags,
          nextStatusId: obj.nextStatusId,
          nextTagId: obj.nextTagId
        }
      );
    }
    delete obj._id;
    delete obj.singleton;
    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu ý tưởng." });
  }
});

app.put("/api/ideas", async (req, res) => {
  try {
    const { nodes, edges, groups, statuses, tags, nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, view } = req.body;
    await IdeaBoard.findOneAndUpdate(
      { singleton: "main" },
      { nodes, edges, groups, statuses, tags, nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, view },
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
