import { Router } from "express";
import { Board, BoardSnapshot } from "../models.js";
import { asyncRoute } from "../http.js";
import { AUTH_FIELDS, AUTH_FIELDS_VERSIONED, loadBoardWithRole, nextUpdatedAt } from "../board-access.js";
import { normalizeGameDesignFlow, resolveGameDesignFields, validateBoardPayload } from "../board-payload.js";
import { boardPayload, pickBoardContent, safeNextStatusId } from "../board-fields.js";
import { broadcastBoardUpdate } from "../realtime/broadcast.js";
import { syncBoardRefs } from "../pdf-quota.js";

const router = Router();
const MAX_SNAPSHOTS_PER_BOARD = 30;

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

router.get("/:id/snapshots", asyncRoute(async (req, res) => {
  const found = await loadBoardWithRole(req, res, "viewer", AUTH_FIELDS);
  if (!found) return;
  const snapshots = await BoardSnapshot.find({ boardId: found.board._id })
    .sort({ createdAt: -1 })
    .limit(MAX_SNAPSHOTS_PER_BOARD)
    .lean();
  res.json({ snapshots: snapshots.map(snapshotSummary) });
}, "Không đọc được snapshot."));

router.post("/:id/snapshots", asyncRoute(async (req, res) => {
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
}, "Không tạo được snapshot."));

router.post("/:id/snapshots/:snapshotId/restore", asyncRoute(async (req, res) => {
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
  const updatedAt = nextUpdatedAt(found.board.updatedAt);
  const restored = {
    ...gameDesign,
    ...pickBoardContent(normalized),
    // Snapshot chụp trước bản sửa B1 còn mang bộ đếm trùng id (9 trạng thái,
    // nextStatusId = 9). Chuẩn hoá TRƯỚC khi ghi: bản lưu, gói broadcast và
    // phản hồi đều phải mang bộ đếm dùng được (review PR #5, vòng 2).
    nextStatusId: safeNextStatusId(normalized),
    updatedAt
  };
  await Board.findByIdAndUpdate(found.board._id, restored);
  const payload = { ...restored, updatedAt: updatedAt.toISOString() };
  await broadcastBoardUpdate(req, found.board._id, payload);
  res.json({ ok: true, board: payload });
  syncBoardRefs(found.board._id, normalized.nodes).catch(() => {});
}, "Không khôi phục được snapshot."));

export default router;
