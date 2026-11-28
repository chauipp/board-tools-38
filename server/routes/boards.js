import { Router } from "express";
import { Board } from "../models.js";
import { getBoardRole, hasAllBoardsAccess } from "../auth.js";
import { rateLimit } from "../rate-limit.js";
import { asyncRoute } from "../http.js";
import { AUTH_FIELDS, AUTH_FIELDS_VERSIONED, loadBoardWithRole, nextUpdatedAt } from "../board-access.js";
import { DEFAULT_STATUSES, GAME_DESIGN_STATUSES, gameDesignTemplate, nextStatusIdFor } from "../board-templates.js";
import { normalizeGameDesignFlow, resolveGameDesignFields, validateBoardPayload } from "../board-payload.js";
import { boardPayload, pickBoardContent } from "../board-fields.js";
import { broadcastBoardUpdate } from "../realtime/broadcast.js";
import { syncBoardRefs, orphanBoardFiles } from "../pdf-quota.js";

// CRUD của chính board: danh sách, tạo, đọc, lưu, xoá.
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
    const statuses = (kind === "game-design" ? GAME_DESIGN_STATUSES : DEFAULT_STATUSES).map((s) => ({ ...s }));
    const board = await Board.create({
      name,
      kind,
      ownerEmail: email,
      members: [],
      statuses,
      nextStatusId: nextStatusIdFor(statuses),
      ...gameDesignTemplate(template)
    });
    res.status(201).json({ id: String(board._id) });
  } catch (e) {
    res.status(500).json({ error: "Không tạo được board." });
  }
});

router.get("/:id", asyncRoute(async (req, res) => {
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
}, "Không đọc được dữ liệu board."));

router.put("/:id", asyncRoute(async (req, res) => {
  const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS_VERSIONED);
  if (!found) return;

  // Kiểm TRƯỚC khi ghi. Client đã kiểm khá nhiều, nhưng client là thứ ai cũng
  // thay được — còn cái ghi vào Mongo thì cả phòng phải đọc lên và vẽ lại.
  const body = Object.prototype.hasOwnProperty.call(req.body, "gameDesignFlow")
    ? { ...req.body, gameDesignFlow: normalizeGameDesignFlow(req.body.gameDesignFlow) }
    : req.body;
  const invalid = validateBoardPayload(body);
  if (invalid) return res.status(400).json({ error: "invalid_board", detail: invalid });

  const { view, clientId, baseUpdatedAt } = body;
  const content = pickBoardContent(body);
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
    const stored = found.board.updatedAt;
    if (stored && new Date(baseUpdatedAt).getTime() !== new Date(stored).getTime()) {
      const fresh = await Board.findById(req.params.id);
      if (!fresh) return res.status(404).json({ error: "not_found" });
      return res.status(409).json({ error: "conflict", board: boardPayload(fresh.toObject()) });
    }
  }

  // Ghi CÓ ĐIỀU KIỆN ngay trong lệnh cập nhật. Chốt phía trên chỉ đọc mốc rồi so
  // — hai cú PUT cùng mốc có thể cùng đọc thấy "chưa ai lưu" trước khi cú nào
  // kịp ghi, rồi cả hai cùng ghi và cú sau xoá cú trước (review PR #5, vòng 2).
  // Đặt điều kiện mốc vào chính bộ lọc thì MongoDB chỉ cho đúng một cú thắng;
  // cú còn lại không khớp bản ghi nào và nhận 409 kèm bản mới để ghép.
  const current = found.board.updatedAt;
  const conditional = !!(baseUpdatedAt && current);
  // Mốc mới phải KHÁC mốc cũ: hai lần lưu trong cùng một mili-giây mà trùng mốc
  // thì người đang cầm mốc đó ghi đè được lần lưu thứ hai mà không ai hay.
  const updatedAt = nextUpdatedAt(current);
  const written = await Board.findOneAndUpdate(
    conditional ? { _id: found.board._id, updatedAt: current } : { _id: found.board._id },
    { ...gameDesign, ...content, view, updatedAt },
    { projection: { _id: 1 } }
  );
  if (!written && conditional) {
    const fresh = await Board.findById(req.params.id);
    if (!fresh) return res.status(404).json({ error: "not_found" });
    return res.status(409).json({ error: "conflict", board: boardPayload(fresh.toObject()) });
  }
  // Phát cho người khác trong board ngay sau khi lưu thành công — không
  // gồm `view`: camera là riêng từng người, không đồng bộ qua kênh này.
  // clientId là socket.id của chính người lưu (nếu socket presence đã
  // kết nối) — .except() loại người gửi khỏi broadcast của chính họ.
  // Cùng chuẩn hoá như phòng presence trong realtime/handshake.js: lấy id từ document,
  // không từ URL — hex viết hoa/thường khác nhau vẫn phải vào đúng phòng.
  const payload = {
    ...gameDesign, ...content,
    updatedAt: updatedAt.toISOString()
  };
  await broadcastBoardUpdate(req, found.board._id, payload, clientId);
  res.json({ ok: true, updatedAt: updatedAt.toISOString() });

  // Thẻ PDF nào vừa mất khỏi nodes[] thì ghi nhận là mồ côi, để bộ dọn rác trả
  // lại dung lượng sau thời gian chờ. Chạy SAU khi đã trả lời và không await:
  // đây là sổ sách nội bộ, không bao giờ được làm chậm hay làm chết một cú lưu
  // của người dùng — hỏng thì vòng reconcile của cron sửa lại.
  syncBoardRefs(found.board._id, content.nodes).catch((e) => {
    console.warn(`[pdf-quota] không đồng bộ được sổ PDF của board ${found.board._id}: ${e.message}`);
  });
}, "Không lưu được dữ liệu board."));

router.delete("/:id", asyncRoute(async (req, res) => {
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
}, "Không xoá được board."));

export default router;
