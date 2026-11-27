import { Router } from "express";
import { Board } from "./models.js";
import { getBoardRole, hasAllBoardsAccess } from "./auth.js";
import { rateLimit } from "./rate-limit.js";
import { normalizeGameDesignFlow, resolveGameDesignFields, validateBoardPayload } from "./board-payload.js";
import { syncBoardRefs, orphanBoardFiles } from "./pdf-quota.js";
import { AUTH_FIELDS, AUTH_FIELDS_VERSIONED, loadBoardWithRole } from "./board-access.js";
import { boardPayload, broadcastBoardUpdate, writeBoard } from "./board-route-content.js";
import files from "./board-file-routes.js";
import members from "./board-member-routes.js";
import snapshots from "./board-snapshot-routes.js";

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
  { id: 6, name: "Done", color: "st-done" },
  { id: 7, name: "Approved", color: "st-done" },
  { id: 8, name: "Rejected", color: "st-rejected" },
  { id: 9, name: "Archived", color: "st-parked" }
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

router.get("/", async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    // Tài khoản có quyền xem mọi board thì danh sách không lọc theo thành viên.
    const scope = hasAllBoardsAccess(email)
      ? {}
      : { $or: [{ ownerEmail: email }, { "members.email": email }] };
    const boards = await Board.find(scope)
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
    const statuses = kind === "game-design" ? GAME_DESIGN_STATUSES : DEFAULT_STATUSES;
    const board = await Board.create({
      name,
      kind,
      ownerEmail: email,
      members: [],
      statuses: statuses.map((status) => ({ ...status })),
      nextStatusId: kind === "game-design" ? Math.max(...statuses.map(({ id }) => id)) + 1 : 7,
      ...gameDesignTemplate(template)
    });
    res.status(201).json({ id: String(board._id) });
  } catch (e) {
    res.status(500).json({ error: "Không tạo được board." });
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
      nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view,
      clientId
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
    const updatedAt = await writeBoard(req, res, found.board, {
      kind: gameDesign.kind, gameDesignBrief: gameDesign.gameDesignBrief, gameDesignFlow: gameDesign.gameDesignFlow, gameDesignBalance: gameDesign.gameDesignBalance, nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view
    });
    if (!updatedAt) return;
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

router.use(files, snapshots, members);

export default router;
