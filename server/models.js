import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    picture: String,
    lastLoginAt: { type: Date, default: Date.now }
  },
  { minimize: false, versionKey: false }
);

export const User = mongoose.model("User", userSchema);

export async function upsertUser({ email, name, picture }) {
  const normalized = String(email).toLowerCase();
  return User.findOneAndUpdate(
    { email: normalized },
    { email: normalized, name, picture, lastLoginAt: new Date() },
    { upsert: true, new: true }
  );
}

const boardMemberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["editor", "viewer"], required: true },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: "Untitled board" },
    // Board cũ không có field này; phía API/client coi thiếu là board tư duy.
    kind: { type: String, enum: ["idea", "game-design"], default: "idea" },
    // Context chỉ có một bản ở cấp board, không lặp lại trong từng thẻ design.
    gameDesignBrief: { type: Object, default: null },
    // Overview Player Loop/Progression Map cấp board; card chỉ được tham chiếu một chiều.
    gameDesignFlow: { type: Object, default: null },
    gameDesignBalance: { type: Object, default: null },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    members: { type: [boardMemberSchema], default: [] },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    groups: { type: Array, default: [] },
    statuses: { type: Array, default: [] },
    tags: { type: Array, default: [] },
    palette: { type: Array, default: [] },
    // Giao diện của bảng: id preset nền, id kiểu lưới và id bộ màu (xem client
    // lib/board-theme.js). null = như trước khi có ba field này, nên board cũ
    // không cần migration.
    bg: { type: String, default: null },
    grid: { type: String, default: null },
    pack: { type: String, default: null },
    drawings: { type: Array, default: [] },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    nextGroupId: { type: Number, default: 1 },
    nextStatusId: { type: Number, default: 1 },
    nextTagId: { type: Number, default: 1 },
    nextPaletteId: { type: Number, default: 1 },
    nextDrawingId: { type: Number, default: 1 },
    view: { type: Object, default: () => ({ panX: 0, panY: 0, scale: 1 }) },
    updatedAt: { type: Date, default: Date.now }
  },
  { minimize: false, versionKey: false }
);

export const Board = mongoose.model("Board", boardSchema);

// Trạng thái riêng của từng người/profile, không sửa document Board.
const workspaceStateSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    boardId: { type: mongoose.Schema.Types.ObjectId, required: true },
    profile: { type: String, enum: ["desktop", "mobile"], required: true },
    state: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    updatedAt: { type: Date, required: true }
  },
  { minimize: false, versionKey: false }
);
workspaceStateSchema.index({ email: 1, boardId: 1, profile: 1 }, { unique: true });
export const WorkspaceState = mongoose.model("WorkspaceState", workspaceStateSchema);

// Snapshot tách collection thay vì nhét vào Board: mỗi snapshot có thể chứa cả
// ảnh base64 trong nodes[], nên để chúng trong document board sẽ rất dễ chạm
// giới hạn 16 MB của Mongo. 30 snapshot vẫn đủ cho một vòng review/iteration,
// còn board hiện tại luôn chỉ phải đọc đúng một document.
const boardSnapshotSchema = new mongoose.Schema(
  {
    boardId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    label: { type: String, default: "", trim: true, maxlength: 160 },
    createdBy: { type: String, required: true, lowercase: true, trim: true },
    board: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { minimize: false, versionKey: false }
);

boardSnapshotSchema.index({ boardId: 1, createdAt: -1 });

export const BoardSnapshot = mongoose.model("BoardSnapshot", boardSnapshotSchema);

// Một dòng cho mỗi PDF đã đẩy lên kho. Bytes thật nằm ở Cloudflare R2 (hoặc ở
// server/uploads/pdf khi chạy local); collection này chỉ là sổ sách để biết
// đang chiếm bao nhiêu dung lượng và file nào không còn thẻ nào trỏ tới.
//
// Vì sao cần sổ riêng thay vì đếm từ nodes[]: metadata PDF nằm trong node, mà
// nodes[] có ảnh base64 — quét mọi board chỉ để cộng vài con số là đắt vô lý,
// và cú upload nào cũng phải biết tổng dung lượng trước khi cho ghi.
const pdfFileSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    // "unknown" cho file đã có bytes trên R2 nhưng chưa có dòng sổ (upload chết
    // giữa đường, hoặc file có từ trước khi có sổ sách này) — chỉ nodes[] mới
    // biết file thuộc board nào, mà lúc nhận vào sổ thì chưa tra ra được.
    boardId: { type: String, required: true, default: "unknown", index: true },
    // Người ĐẨY LÊN, không phải chủ board: hạn mức riêng phải tính vào đầu người
    // tiêu dung lượng. Thả PDF vào board người khác thì vẫn là phần của mình.
    //
    // Rỗng với những file có từ trước khi có cột này, và với file được nhận vào
    // sổ lúc đối chiếu (chỉ đọc được từ kho R2 nên không biết ai đẩy lên). Chúng
    // vẫn tính vào hạn mức CHUNG, chỉ là không tính vào đầu ai cả.
    email: { type: String, default: "", lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    size: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    // null = còn ít nhất một thẻ trỏ tới. Có mốc = mồ côi từ lúc đó, và chỉ khi
    // quá thời gian chờ thì bytes trên R2 mới bị xoá — để Ctrl+Z sau khi xoá
    // thẻ còn cứu được, và để một cú lưu cũ (thiếu thẻ vì client chưa rebase)
    // không kịp làm mất file thật.
    orphanedAt: { type: Date, default: null, index: true }
  },
  { versionKey: false }
);

export const PdfFile = mongoose.model("PdfFile", pdfFileSchema);

// Mức cảnh báo dung lượng đã gửi lần gần nhất. Không có nó thì cron 6 tiếng một
// lần sẽ nhắc lại đúng một cảnh báo mãi mãi; lưu ở DB (không phải biến trong
// tiến trình) để Render restart hay redeploy cũng không làm nó nhắc lại.
const pdfQuotaStateSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },
    level: { type: String, default: "ok" },
    notifiedAt: { type: Date, default: null }
  },
  { versionKey: false }
);

export const PdfQuotaState = mongoose.model("PdfQuotaState", pdfQuotaStateSchema);
