import { Router } from "express";
import { Board, User } from "./models.js";
import { getBoardRole, isEmailAllowed } from "./auth.js";

const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];

const router = Router();

// Board nhúng ảnh base64 trong nodes[] (giới hạn body 10mb), nên đọc cả document
// chỉ để xét quyền là rất đắt — nhất là ở PUT, nơi client autosave mỗi 500ms.
// Route nào không cần nội dung board thì truyền AUTH_FIELDS.
const AUTH_FIELDS = "ownerEmail members";
// PUT cần thêm `updatedAt` để so với mốc client khai là mình đang dựa trên —
// đó là toàn bộ cơ chế phát hiện hai người lưu đè nhau. Vẫn KHÔNG đọc nội dung
// board: một Date thì rẻ, còn nodes[] có ảnh base64 thì không.
const AUTH_FIELDS_VERSIONED = "ownerEmail members updatedAt";

// Nội dung board trả cho client. Dùng chung cho GET và cho thân của 409
// (conflict) — hai chỗ đó phải trả ĐÚNG một hình dạng, lệch nhau là phía client
// ghép nhầm một board thiếu field.
function boardPayload(obj) {
  return {
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
      .select("name ownerEmail members updatedAt")
      .lean();
    res.json(
      boards.map((b) => ({
        id: String(b._id),
        name: b.name,
        role: getBoardRole(b, email),
        updatedAt: b.updatedAt
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Không đọc được danh sách board." });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim() || "Untitled board";
    const board = await Board.create({
      name,
      ownerEmail: req.user.email.toLowerCase(),
      members: [],
      statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
      nextStatusId: 6
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
    const {
      nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view,
      clientId,
      baseUpdatedAt
    } = req.body;

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
      nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      view, updatedAt
    });
    // Phát cho người khác trong board ngay sau khi lưu thành công — không
    // gồm `view`: camera là riêng từng người, không đồng bộ qua kênh này.
    // clientId là socket.id của chính người lưu (nếu socket presence đã
    // kết nối) — .except() loại người gửi khỏi broadcast của chính họ.
    const io = req.app.get("io");
    // Cùng chuẩn hoá như phòng presence trong index.js: lấy id từ document,
    // không từ URL — hex viết hoa/thường khác nhau vẫn phải vào đúng phòng.
    const room = "board:" + String(found.board._id);
    const payload = {
      nodes, edges, groups, statuses, tags, palette, bg, grid, pack, drawings,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, nextDrawingId,
      updatedAt: updatedAt.toISOString()
    };
    if (clientId) io.in(room).except(clientId).emit("board:update", payload);
    else io.in(room).emit("board:update", payload);
    res.json({ ok: true, updatedAt: updatedAt.toISOString() });
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
