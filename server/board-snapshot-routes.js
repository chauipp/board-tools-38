import { Router } from "express";
import { Board, BoardSnapshot } from "./models.js";
import { AUTH_FIELDS, AUTH_FIELDS_VERSIONED, loadBoardWithRole } from "./board-access.js";
import { boardPayload, broadcastBoardUpdate, writeBoard } from "./board-route-content.js";
import { normalizeGameDesignFlow, resolveGameDesignFields, validateBoardPayload } from "./board-payload.js";
import { syncBoardRefs } from "./pdf-quota.js";

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
      nextDrawingId: normalized.nextDrawingId
    };
    const updatedAt = await writeBoard(req, res, found.board, restored);
    if (!updatedAt) return;
    const payload = { ...restored, updatedAt: updatedAt.toISOString() };
    await broadcastBoardUpdate(req, found.board._id, payload);
    res.json({ ok: true, board: payload });
    syncBoardRefs(found.board._id, normalized.nodes).catch(() => {});
  } catch (e) {
    if (e.name === "CastError") return res.status(404).json({ error: "not_found" });
    res.status(500).json({ error: "KhÃ´ng khÃ´i phá»¥c Ä‘Æ°á»£c snapshot." });
  }
});

export default router;
