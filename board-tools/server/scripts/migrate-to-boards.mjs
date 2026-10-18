// Chạy một lần, thủ công, sau khi Task 1-3 đã deploy:
//   cd board-tools/server && node scripts/migrate-to-boards.mjs
// Chuyển IdeaBoard singleton cũ (collection "ideaboards") thành Board đầu
// tiên, owner = chaupt2823@gmail.com. Idempotent: nếu đã có Board nào rồi
// thì dừng ngay, không tạo trùng.
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Board } from "../models.js";

dotenv.config();

const OWNER_EMAIL = "chaupt2823@gmail.com";
const BOARD_NAME = "Board của Châu";

const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];
const STATUS_KEY_TO_ID = { idea: 1, considering: 2, chosen: 3, parked: 4, rejected: 5 };
const DOT_COUNT = 8;

function hashTagToken(name) {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "dot-" + ((h % DOT_COUNT) + 1);
}

// Bản sao một-lần-dùng của migrateBoard() cũ (đã xoá khỏi index.js ở Task 2)
// — chỉ để phòng trường hợp document thật vẫn còn ở định dạng cũ
// (status/tag kiểu chuỗi thay vì statusId/tagId keyed).
function migrateLegacyFormat(doc) {
  if (!Array.isArray(doc.statuses)) {
    doc.statuses = DEFAULT_STATUSES.map((s) => ({ ...s }));
    doc.nextStatusId = 6;
    (doc.nodes || []).forEach((n) => {
      n.statusId = STATUS_KEY_TO_ID[n.status] ?? null;
      delete n.status;
    });
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
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Thiếu MONGODB_URI trong server/.env — không thể chạy migration.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Đang kết nối tới ${mongoose.connection.host}/${mongoose.connection.name} …`);

  const existingBoard = await Board.findOne({ ownerEmail: OWNER_EMAIL, name: BOARD_NAME });
  if (existingBoard) {
    console.log(`Board "${BOARD_NAME}" (id ${existingBoard._id}) đã tồn tại — migration có thể đã chạy rồi. Dừng lại, không tạo trùng.`);
    await mongoose.disconnect();
    return;
  }

  const legacy = await mongoose.connection.collection("ideaboards").findOne({ singleton: "main" });
  if (!legacy) {
    console.log("Không tìm thấy IdeaBoard cũ — không có gì để migrate.");
    await mongoose.disconnect();
    return;
  }

  migrateLegacyFormat(legacy);

  await User.findOneAndUpdate(
    { email: OWNER_EMAIL },
    { $setOnInsert: { email: OWNER_EMAIL, lastLoginAt: new Date() } },
    { upsert: true }
  );

  const board = await Board.create({
    name: BOARD_NAME,
    ownerEmail: OWNER_EMAIL,
    members: [],
    nodes: legacy.nodes,
    edges: legacy.edges,
    groups: legacy.groups,
    statuses: legacy.statuses,
    tags: legacy.tags,
    palette: legacy.palette || [],
    nextNodeId: legacy.nextNodeId,
    nextEdgeId: legacy.nextEdgeId,
    nextGroupId: legacy.nextGroupId,
    nextStatusId: legacy.nextStatusId,
    nextTagId: legacy.nextTagId,
    nextPaletteId: legacy.nextPaletteId || 1,
    view: legacy.view
  });

  console.log(`Đã tạo Board "${board.name}" (id ${board._id}) với ${board.nodes.length} thẻ, owner ${OWNER_EMAIL}.`);
  console.log("Collection ideaboards cũ vẫn được giữ nguyên — có thể xoá thủ công sau khi xác nhận mọi thứ ổn.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("Migration thất bại:", e);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {});
  }
  process.exit(1);
});
