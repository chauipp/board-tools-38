import { Router } from "express";
import { User } from "./models.js";
import { isEmailAllowed, isGmailAddress } from "./auth.js";
import { AUTH_FIELDS, loadBoardWithRole } from "./board-access.js";

const router = Router();

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
    // Mời được người trong ALLOWED_EMAILS, hoặc bất kỳ địa chỉ Gmail nào. Gmail
    // ngoài danh sách được cấp quyền đăng nhập qua chính lời mời này (grantsLogin).
    const allowlisted = isEmailAllowed(email);
    if (!allowlisted && !isGmailAddress(email)) {
      return res.status(400).json({ error: "not_allowed" });
    }
    if (email === board.ownerEmail) {
      return res.status(400).json({ error: "already_owner" });
    }
    const grantsLogin = !allowlisted;
    const existing = board.members.find((m) => m.email === email);
    if (existing) {
      existing.role = role;
      if (grantsLogin) existing.grantsLogin = true;
    } else {
      board.members.push({ email, role, addedAt: new Date(), grantsLogin });
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
