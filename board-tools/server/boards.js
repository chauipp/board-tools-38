import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { Board, BoardSnapshot, User } from "./models.js";
import { getBoardRole, isEmailAllowed } from "./auth.js";
import { rateLimit } from "./rate-limit.js";
import { normalizeGameDesignFlow, resolveGameDesignFields, validateBoardPayload } from "./board-payload.js";
import { PDF_DIR, isR2Enabled, sendPdf, storePdf } from "./pdf-storage.js";
import {
  checkRoom,
  recordUpload,
  forgetUpload,
  syncBoardRefs,
  orphanBoardFiles,
  noteUsageAfterUpload,
  formatBytes
} from "./pdf-quota.js";

const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];

const GAME_DESIGN_STATUSES = [
  { id: 1, name: "Draft", color: "st-idea" },
  { id: 2, name: "Review", color: "st-considering" },
  { id: 3, name: "Ready for dev", color: "st-chosen" },
  { id: 4, name: "In dev", color: "st-parked" },
  { id: 5, name: "Testing", color: "st-rejected" },
  { id: 6, name: "Done", color: "st-done" }
  , { id: 7, name: "Approved", color: "st-done" }, { id: 8, name: "Rejected", color: "st-rejected" }, { id: 9, name: "Archived", color: "st-parked" }
];

const GAME_DESIGN_TEMPLATES = {
  combat: {
    gameDesignBrief: { genre: "Action", targetAudience: "", playerFantasy: "Làm chủ combat", playerJourney: [] },
    gameDesignFlow: { playerLoop: [{ id: "loop-1", title: "Engage", action: "Đọc tình huống", outcome: "Chọn hành động", note: "", cardIds: ["1"] }, { id: "loop-2", title: "Execute", action: "Dùng skill", outcome: "Tạo lợi thế", note: "", cardIds: ["2"] }], progressionMap: [] },
    gameDesignBalance: { metrics: [{ id: "metric-1", key: "damage", name: "Damage", value: "10", min: "1", max: "999", unit: "HP", formula: "", cardIds: ["2"] }, { id: "metric-2", key: "cooldown", name: "Cooldown", value: "1", min: "0", max: "60", unit: "s", formula: "", cardIds: ["2"] }] },
    nodes: [{ id: 1, x: 80, y: 150, title: "Combat loop", desc: "Vòng lặp chiến đấu cốt lõi", type: "core-loop", design: {} }, { id: 2, x: 380, y: 150, title: "Primary action", desc: "Đòn đánh hoặc skill chính", type: "mechanic", design: {} }, { id: 3, x: 680, y: 150, title: "Combat playtest", desc: "Kiểm nghiệm nhịp độ và độ rõ ràng", type: "playtest", design: {} }],
    edges: [{ id: 1, from: 1, to: 2, relation: "unlocks" }, { id: 2, from: 2, to: 3, relation: "depends-on" }]
  },
  level: {
    gameDesignBrief: { genre: "", targetAudience: "", playerFantasy: "Khám phá và chinh phục", playerJourney: [] },
    gameDesignFlow: { playerLoop: [], progressionMap: [{ id: "progress-1", title: "Tutorial", objective: "Học hành động cơ bản", unlocks: "Level 1", description: "", emotion: "", cardIds: ["1"] }, { id: "progress-2", title: "Challenge", objective: "Kết hợp kỹ năng", unlocks: "Level 2", description: "", emotion: "", cardIds: ["2"] }] },
    gameDesignBalance: { metrics: [{ id: "metric-1", key: "completion_rate", name: "Completion rate", value: "", min: "0", max: "100", unit: "%", formula: "", cardIds: ["2"] }] },
    nodes: [{ id: 1, x: 80, y: 150, title: "Tutorial level", desc: "Dạy một hành động mới", type: "quest-level", design: {} }, { id: 2, x: 380, y: 150, title: "Challenge level", desc: "Kết hợp kỹ năng trong áp lực", type: "quest-level", design: {} }, { id: 3, x: 680, y: 150, title: "Level playtest", desc: "Kiểm completion, nhịp độ và điểm kẹt", type: "playtest", design: {} }],
    edges: [{ id: 1, from: 1, to: 2, relation: "unlocks" }, { id: 2, from: 2, to: 3, relation: "depends-on" }]
  },
  economy: {
    gameDesignBrief: { genre: "", targetAudience: "", playerFantasy: "Lựa chọn và phát triển", playerJourney: [] },
    gameDesignFlow: { playerLoop: [{ id: "loop-1", title: "Earn", action: "Hoàn thành hoạt động", outcome: "Nhận tài nguyên", note: "", cardIds: ["1"] }, { id: "loop-2", title: "Spend", action: "Nâng cấp", outcome: "Mở sức mạnh mới", note: "", cardIds: ["2"] }], progressionMap: [] },
    gameDesignBalance: { metrics: [{ id: "metric-1", key: "currency_reward", name: "Currency reward", value: "100", min: "0", max: "", unit: "gold", formula: "", cardIds: ["1"] }, { id: "metric-2", key: "upgrade_cost", name: "Upgrade cost", value: "100", min: "0", max: "", unit: "gold", formula: "", cardIds: ["2"] }] },
    nodes: [{ id: 1, x: 80, y: 150, title: "Resource source", desc: "Nguồn nhận tài nguyên", type: "mechanic", design: {} }, { id: 2, x: 380, y: 150, title: "Upgrade sink", desc: "Nơi người chơi chi tiêu", type: "skill-item", design: {} }, { id: 3, x: 680, y: 150, title: "Economy playtest", desc: "Kiểm lựa chọn, nhịp kiếm và chi", type: "playtest", design: {} }],
    edges: [{ id: 1, from: 1, to: 2, relation: "unlocks" }, { id: 2, from: 2, to: 3, relation: "depends-on" }]
  }
};

function gameDesignTemplate(templateId) {
  const template = GAME_DESIGN_TEMPLATES[templateId];
  if (!template) return {};
  return {
    ...structuredClone(template),
    nextNodeId: template.nodes.length + 1,
    nextEdgeId: template.edges.length + 1
  };
}

const router = Router();
const MAX_SNAPSHOTS_PER_BOARD = 30;

// PDF không nằm trong document MongoDB của board: chỉ metadata sống trong node.
// Nếu đủ biến R2, bytes ở Cloudflare R2; còn local thì dùng disk để phát triển.
fs.mkdirSync(PDF_DIR, { recursive: true });
const PDF_MAX_BYTES = 30 * 1024 * 1024;
const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PDF_DIR),
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`)
  }),
  limits: { fileSize: PDF_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("pdf_only"));
  }
}).single("file");

// Board nhúng ảnh base64 trong nodes[] (giới hạn body 10mb), nên đọc cả document
// chỉ để xét quyền là rất đắt — nhất là ở PUT, nơi client autosave mỗi 500ms.
// Route nào không cần nội dung board thì truyền AUTH_FIELDS.
const AUTH_FIELDS = "ownerEmail members";
// PUT cần thêm `updatedAt` để so với mốc client khai là mình đang dựa trên —
// đó là toàn bộ cơ chế phát hiện hai người lưu đè nhau. Vẫn KHÔNG đọc nội dung
// board: một Date thì rẻ, còn nodes[] có ảnh base64 thì không.
const AUTH_FIELDS_VERSIONED = "ownerEmail members updatedAt kind gameDesignBrief gameDesignFlow gameDesignBalance";

// Nội dung board trả cho client. Dùng chung cho GET và cho thân của 409
// (conflict) — hai chỗ đó phải trả ĐÚNG một hình dạng, lệch nhau là phía client
// ghép nhầm một board thiếu field.
function boardPayload(obj) {
  return {
    kind: obj.kind || "idea",
    gameDesignBrief: obj.gameDesignBrief ?? null,
    gameDesignFlow: obj.gameDesignFlow ?? null,
    gameDesignBalance: obj.gameDesignBalance ?? null,
    nodes: obj.nodes,
    edges: obj.edges,
    groups: obj.groups,
    statuses: obj.statuses,
    tags: obj.tags,
    palette: obj.palette,
    bg: obj.bg,
    grid: obj.grid,
    pack: obj.pack,
    drawings: obj.drawings,
    nextNodeId: obj.nextNodeId,
    nextEdgeId: obj.nextEdgeId,
    nextGroupId: obj.nextGroupId,
    nextStatusId: obj.nextStatusId,
    nextTagId: obj.nextTagId,
    nextPaletteId: obj.nextPaletteId,
    nextDrawingId: obj.nextDrawingId,
    updatedAt: obj.updatedAt
  };
}

function snapshotPayload(obj) {
  const { updatedAt, ...payload } = boardPayload(obj);
  return payload;
}

function snapshotSummary(snapshot) {
  return {
    id: String(snapshot._id),
    label: snapshot.label || "",
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt
  };
}

async function broadcastBoardUpdate(req, boardId, payload, clientId) {
  const io = req.app.get("io");
  const room = "board:" + String(boardId);
  if (clientId) io.in(room).except(clientId).emit("board:update", payload);
  else io.in(room).emit("board:update", payload);
}

// Trả 404 (không phải 403) khi người gọi không có role nào trên board —
// tránh lộ việc board có tồn tại hay không cho người ngoài.
async function loadBoardWithRole(req, res, minRole, projection) {
  const query = Board.findById(req.params.id);
  if (projection) query.select(projection);
  const board = await query;
  if (!board) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  const role = getBoardRole(board, req.user.email);
  if (!role) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  if (minRole === "editor" && role === "viewer") {
    res.status(403).json({ error: "read_only" });
    return null;
  }
  if (minRole === "owner" && role !== "owner") {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  return { board, role };
}

router.get("/", async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    const boards = await Board.find({
      $or: [{ ownerEmail: email }, { "members.email": email }]
    })
      .select("name kind ownerEmail members updatedAt")
      .lean();
    res.json(
      boards.map((b) => ({
        id: String(b._id),
        name: b.name,
        kind: b.kind || "idea",
        role: getBoardRole(b, email),
        updatedAt: b.updatedAt
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Không đọc được danh sách board." });
  }
});

// Tạo board là thao tác rẻ với người gọi nhưng đắt với hệ thống: mỗi board là
// một document trong Atlas M0 free, vốn chỉ có 512 MB cho TOÀN BỘ dữ liệu, và
// board có ảnh base64 thì một cái đã gần 5 MB. Không chặn thì một vòng lặp gọi
// API vài phút là lấp đầy DB và cả app ngừng ghi được — rẻ hơn nhiều so với
// việc lấp 8 GB kho PDF.
//
// Hai lớp: trần theo giờ chặn cú bùng phát, trần tổng chặn việc tích tụ chậm.
// Người dùng thật đang có nhiều nhất 5 board, nên cả hai đều rất rộng rãi.
const MAX_BOARDS_PER_USER = 100;
const createBoardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyOf: (req) => req.user?.email,
  error: "too_many_boards"
});

router.post("/", createBoardLimiter, async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    const owned = await Board.countDocuments({ ownerEmail: email });
    if (owned >= MAX_BOARDS_PER_USER) {
      return res.status(403).json({ error: "board_limit_reached", limit: MAX_BOARDS_PER_USER });
    }
    const name = (req.body.name || "").trim() || "Untitled board";
    const kind = req.body.kind === "game-design" ? "game-design" : "idea";
    const template = kind === "game-design" && typeof req.body.template === "string" ? req.body.template : "";
    const board = await Board.create({
      name,
      kind,
      ownerEmail: email,
      members: [],
      statuses: (kind === "game-design" ? GAME_DESIGN_STATUSES : DEFAULT_STATUSES).map((s) => ({ ...s })),
      nextStatusId: kind === "game-design" ? 9 : 7,
      ...gameDesignTemplate(template)
    });
    res.status(201).json({ id: String(board._id) });
  } catch (e) {
    res.status(500).json({ error: "Không tạo được board." });
  }
});

// Upload phải kiểm quyền board ngay trong route, và nếu người dùng không có
// quyền thì xoá file Multer vừa ghi trước khi trả lỗi. URL file đi qua route GET
// bên dưới, nên không có PDF nào bị public chỉ vì biết tên file.
// Chặn theo EMAIL chứ không theo IP: kho PDF là tài nguyên dùng chung có hạn
// mức, nên thứ cần giới hạn là "một người ngốn bao nhiêu", không phải "một
// đường mạng gửi bao nhiêu" — cả văn phòng ngồi chung một IP là chuyện thường.
// 20 file/giờ × 30MB là 600MB/giờ cho mỗi người: thoải mái cho việc dùng thật,
// nhưng để lấp 8 GB thì một tài khoản phải cày liên tục hơn nửa ngày.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyOf: (req) => req.user?.email,
  error: "too_many_uploads"
});

router.post("/:id/files", uploadLimiter, (req, res, next) => {
  pdfUpload(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "file_too_large" : "pdf_only" });
  });
}, async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS);
    if (!found) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return;
    }
    if (!req.file) return res.status(400).json({ error: "missing_file" });

    // Trần dung lượng, đặt trước cú PutObject: đây là chỗ duy nhất giữ cho kho
    // không bò tới mốc 10 GB mà Cloudflare bắt đầu tính tiền, và giữ cho một
    // người không chiếm hết chỗ của những người còn lại.
    const room = await checkRoom(req.file.size, req.user.email);
    if (!room.ok) {
      fs.unlink(req.file.path, () => {});
      const full = room.reason === "storage_full";
      return res.status(507).json({
        error: room.reason,
        used: formatBytes(full ? room.report.usedBytes : room.userUsed),
        limit: formatBytes(full ? room.report.limitBytes : room.userLimit)
      });
    }

    const name = path.basename(req.file.originalname || "Tài liệu.pdf").slice(0, 180) || "Tài liệu.pdf";
    // Ghi sổ TRƯỚC khi đẩy bytes lên. Làm ngược lại thì một lỗi Mongo sẽ để lại
    // bytes trên R2 mà không dòng sổ nào đếm — dung lượng bị chiếm âm thầm. Theo
    // thứ tự này, lỗi tệ nhất là một dòng sổ không có bytes, và reconcile dọn được.
    await recordUpload({
      fileId: req.file.filename,
      boardId: String(found.board._id),
      email: req.user.email,
      name,
      size: req.file.size
    });
    try {
      await storePdf(req.file.filename, req.file.path);
    } catch (e) {
      await forgetUpload(req.file.filename).catch(() => {});
      throw e;
    }
    if (isR2Enabled) fs.unlink(req.file.path, () => {});
    // Không chờ: cảnh báo vượt ngưỡng không được làm người ta đợi lâu hơn khi tải
    // PDF, và cron vẫn là cái chốt nếu cú này lỗi.
    noteUsageAfterUpload().catch(() => {});
    res.status(201).json({
      fileId: req.file.filename,
      name,
      size: req.file.size,
      url: `/api/boards/${encodeURIComponent(req.params.id)}/files/${encodeURIComponent(req.file.filename)}`
    });
  } catch (e) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không tải được PDF." });
  }
});

router.get("/:id/files/:fileId", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "viewer", AUTH_FIELDS);
    if (!found) return;
    // fileId do server sinh ra; chặn path traversal trước cả khi ghép đường dẫn.
    if (!/^[0-9a-f-]{36}\.pdf$/i.test(req.params.fileId)) return res.status(404).json({ error: "not_found" });
    if (!await sendPdf(req.params.fileId, res)) return res.status(404).json({ error: "not_found" });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đọc được PDF." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "viewer");
    if (!found) return;
    const { board, role } = found;
    const obj = board.toObject();
    res.json({
      id: String(obj._id),
      name: obj.name,
      role,
      ...boardPayload(obj),
      view: obj.view
    });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đọc được dữ liệu board." });
  }
});

router.get("/:id/snapshots", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "viewer", AUTH_FIELDS);
    if (!found) return;
    const snapshots = await BoardSnapshot.find({ boardId: found.board._id })
      .sort({ createdAt: -1 })
      .limit(MAX_SNAPSHOTS_PER_BOARD)
      .lean();
    res.json({ snapshots: snapshots.map(snapshotSummary) });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "KhÃ´ng Ä‘á»c Ä‘Æ°á»£c snapshot." });
  }
});

router.post("/:id/snapshots", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS);
    if (!found) return;
    const label = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 160) : "";
    const current = await Board.findById(found.board._id);
    if (!current) return res.status(404).json({ error: "not_found" });
    const snapshot = await BoardSnapshot.create({
      boardId: current._id,
      label,
      createdBy: req.user.email,
      board: snapshotPayload(current.toObject())
    });
    const overflow = await BoardSnapshot.find({ boardId: current._id })
      .sort({ createdAt: -1 })
      .skip(MAX_SNAPSHOTS_PER_BOARD)
      .select("_id")
      .lean();
    if (overflow.length) await BoardSnapshot.deleteMany({ _id: { $in: overflow.map((item) => item._id) } });
    res.status(201).json({ snapshot: snapshotSummary(snapshot) });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "KhÃ´ng táº¡o Ä‘Æ°á»£c snapshot." });
  }
});

router.post("/:id/snapshots/:snapshotId/restore", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS_VERSIONED);
    if (!found) return;
    const snapshot = await BoardSnapshot.findOne({ _id: req.params.snapshotId, boardId: found.board._id }).lean();
    if (!snapshot) return res.status(404).json({ error: "snapshot_not_found" });

    const source = snapshot.board;
    const normalized = Object.prototype.hasOwnProperty.call(source, "gameDesignFlow")
      ? { ...source, gameDesignFlow: normalizeGameDesignFlow(source.gameDesignFlow) }
      : source;
    const invalid = validateBoardPayload(normalized);
    if (invalid) return res.status(409).json({ error: "invalid_snapshot", detail: invalid });
    const gameDesign = resolveGameDesignFields(normalized, found.board);
    const updatedAt = new Date();
    const restored = {
      kind: gameDesign.kind,
      gameDesignBrief: gameDesign.gameDesignBrief,
      gameDesignFlow: gameDesign.gameDesignFlow,
      gameDesignBalance: gameDesign.gameDesignBalance,
      nodes: normalized.nodes,
      edges: normalized.edges,
      groups: normalized.groups,
      statuses: normalized.statuses,
      tags: normalized.tags,
      palette: normalized.palette,
      bg: normalized.bg,
      grid: normalized.grid,
      pack: normalized.pack,
      drawings: normalized.drawings,
      nextNodeId: normalized.nextNodeId,
      nextEdgeId: normalized.nextEdgeId,
      nextGroupId: normalized.nextGroupId,
      nextStatusId: normalized.nextStatusId,
      nextTagId: normalized.nextTagId,
      nextPaletteId: normalized.nextPaletteId,
      nextDrawingId: normalized.nextDrawingId,
      updatedAt
    };
    await Board.findByIdAndUpdate(found.board._id, restored);
    const payload = { ...restored, updatedAt: updatedAt.toISOString() };
    await broadcastBoardUpdate(req, found.board._id, payload);
    res.json({ ok: true, board: payload });
    syncBoardRefs(found.board._id, normalized.nodes).catch(() => {});
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "KhÃ´ng khÃ´i phá»¥c Ä‘Æ°á»£c snapshot." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS_VERSIONED);
    if (!found) return;

    // Kiểm TRƯỚC khi ghi. Client đã kiểm khá nhiều, nhưng client là thứ ai cũng
    // thay được — còn cái ghi vào Mongo thì cả phòng phải đọc lên và vẽ lại.
    const body = Object.prototype.hasOwnProperty.call(req.body, "gameDesignFlow")
      ? { ...req.body, gameDesignFlow: normalizeGameDesignFlow(req.body.gameDesignFlow) }
      : req.body;
    const invalid = validateBoardPayload(body);
    if (invalid) return res.status(400).json({ error: "invalid_board", detail: invalid });

    const {
      kind, gameDesignBrief, gameDesignFlow, gameDesignBalance, nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view,
      clientId,
      baseUpdatedAt
    } = body;
    const gameDesign = resolveGameDesignFields(body, found.board);

    // Kiểm phiên bản. Client khai "bản tôi đang dựa trên có mốc này"; nếu mốc
    // trên server đã khác thì trong lúc client dựng payload đã có người khác lưu
    // xong, và cú PUT này mang một board KHÔNG chứa thay đổi của họ — ghi thẳng
    // là xoá sổ nó, âm thầm, cả trên server lẫn trên màn hình họ khi gói
    // board:update phát lại về.
    //
    // Trả kèm luôn nội dung mới nhất để client ghép thay đổi của mình lên đó rồi
    // lưu lại (client/src/lib/rebase.js) — đỡ một vòng mạng nữa đúng vào lúc hai
    // người đang thao tác nhanh. Đây là chỗ DUY NHẤT ở PUT đọc nội dung board,
    // và nó chỉ chạy khi thật sự va chạm.
    //
    // Không khai `baseUpdatedAt` thì bỏ qua chốt này: client cũ, và luồng "Nhập
    // JSON" (cố ý thay cả bảng) vẫn ghi đè được như trước.
    if (baseUpdatedAt) {
      const current = found.board.updatedAt;
      if (current && new Date(baseUpdatedAt).getTime() !== new Date(current).getTime()) {
        const fresh = await Board.findById(req.params.id);
        if (!fresh) return res.status(404).json({ error: "not_found" });
        return res.status(409).json({ error: "conflict", board: boardPayload(fresh.toObject()) });
      }
    }

    const updatedAt = new Date();
    await Board.findByIdAndUpdate(req.params.id, {
      kind: gameDesign.kind, gameDesignBrief: gameDesign.gameDesignBrief, gameDesignFlow: gameDesign.gameDesignFlow, gameDesignBalance: gameDesign.gameDesignBalance, nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view, updatedAt
    });
    // Phát cho người khác trong board ngay sau khi lưu thành công — không
    // gồm `view`: camera là riêng từng người, không đồng bộ qua kênh này.
    // clientId là socket.id của chính người lưu (nếu socket presence đã
    // kết nối) — .except() loại người gửi khỏi broadcast của chính họ.
    // Cùng chuẩn hoá như phòng presence trong index.js: lấy id từ document,
    // không từ URL — hex viết hoa/thường khác nhau vẫn phải vào đúng phòng.
    const payload = {
      kind: gameDesign.kind, gameDesignBrief: gameDesign.gameDesignBrief, gameDesignFlow: gameDesign.gameDesignFlow, gameDesignBalance: gameDesign.gameDesignBalance, nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      updatedAt: updatedAt.toISOString()
    };
    await broadcastBoardUpdate(req, found.board._id, payload, clientId);
    res.json({ ok: true, updatedAt: updatedAt.toISOString() });

    // Thẻ PDF nào vừa mất khỏi nodes[] thì ghi nhận là mồ côi, để bộ dọn rác trả
    // lại dung lượng sau thời gian chờ. Chạy SAU khi đã trả lời và không await:
    // đây là sổ sách nội bộ, không bao giờ được làm chậm hay làm chết một cú lưu
    // của người dùng — hỏng thì vòng reconcile của cron sửa lại.
    syncBoardRefs(found.board._id, nodes).catch((e) => {
      console.warn(`[pdf-quota] không đồng bộ được sổ PDF của board ${found.board._id}: ${e.message}`);
    });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không lưu được dữ liệu board." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner", AUTH_FIELDS);
    if (!found) return;
    await Board.findByIdAndDelete(req.params.id);
    // Xoá board là xoá mọi thẻ trong đó, nên PDF của nó cũng thành mồ côi. Vẫn
    // qua thời gian chờ như xoá thẻ lẻ, không xoá thẳng: xoá board nhầm là chuyện
    // xảy ra được, và trong thời gian chờ thì bytes vẫn còn để cứu.
    await orphanBoardFiles(found.board._id).catch((e) => {
      console.warn(`[pdf-quota] không đánh dấu được PDF của board vừa xoá: ${e.message}`);
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không xoá được board." });
  }
});

router.get("/:id/members", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner", AUTH_FIELDS);
    if (!found) return;
    const { board } = found;
    const emails = board.members.map((m) => m.email);
    const users = await User.find({ email: { $in: emails } }).select("email name picture").lean();
    const byEmail = new Map(users.map((u) => [u.email, u]));
    res.json(
      board.members.map((m) => ({
        email: m.email,
        role: m.role,
        name: byEmail.get(m.email)?.name || null,
        picture: byEmail.get(m.email)?.picture || null
      }))
    );
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đọc được danh sách thành viên." });
  }
});

router.post("/:id/members", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner", AUTH_FIELDS);
    if (!found) return;
    const { board } = found;
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = req.body.role;
    if (!email || !["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "invalid_input" });
    }
    if (!isEmailAllowed(email)) {
      return res.status(400).json({ error: "not_allowed" });
    }
    if (email === board.ownerEmail) {
      return res.status(400).json({ error: "already_owner" });
    }
    const existing = board.members.find((m) => m.email === email);
    if (existing) {
      existing.role = role;
    } else {
      board.members.push({ email, role, addedAt: new Date() });
    }
    await board.save();
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không mời được thành viên." });
  }
});

router.patch("/:id/members/:email", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner", AUTH_FIELDS);
    if (!found) return;
    const { board } = found;
    const email = req.params.email.toLowerCase();
    const role = req.body.role;
    if (!["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const member = board.members.find((m) => m.email === email);
    if (!member) return res.status(404).json({ error: "not_found" });
    member.role = role;
    await board.save();
    res.json({ ok: true });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đổi được vai trò." });
  }
});

router.delete("/:id/members/:email", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "owner", AUTH_FIELDS);
    if (!found) return;
    const { board } = found;
    const email = req.params.email.toLowerCase();
    board.members = board.members.filter((m) => m.email !== email);
    await board.save();
    res.json({ ok: true });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không xoá được thành viên." });
  }
});

export default router;
