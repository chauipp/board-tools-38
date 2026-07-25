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
      nodes: obj.nodes,
      edges: obj.edges,
      groups: obj.groups,
      statuses: obj.statuses,
      tags: obj.tags,
      palette: obj.palette,
      nextNodeId: obj.nextNodeId,
      nextEdgeId: obj.nextEdgeId,
      nextGroupId: obj.nextGroupId,
      nextStatusId: obj.nextStatusId,
      nextTagId: obj.nextTagId,
      nextPaletteId: obj.nextPaletteId,
      view: obj.view
    });
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "Không đọc được dữ liệu board." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS);
    if (!found) return;
    const {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId, view
    } = req.body;
    await Board.findByIdAndUpdate(req.params.id, {
      nodes, edges, groups, statuses, tags, palette,
      nextNodeId, nextEdgeId, nextGroupId, nextStatusId, nextTagId, nextPaletteId,
      view, updatedAt: new Date()
    });
    res.json({ ok: true });
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
