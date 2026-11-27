import { Board } from "./models.js";
import { loadBoardWithRole } from "./board-access.js";
import { writeBoardAtVersion } from "./board-write.js";

// Nội dung board trả cho client. Dùng chung cho GET và cho thân của 409
// (conflict) — hai chỗ đó phải trả ĐÚNG một hình dạng, lệch nhau là phía client
// ghép nhầm một board thiếu field.
export function boardPayload(obj) {
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

export async function broadcastBoardUpdate(req, boardId, payload, clientId) {
  const io = req.app.get("io");
  const room = "board:" + String(boardId);
  if (clientId) io.in(room).except(clientId).emit("board:update", payload);
  else io.in(room).emit("board:update", payload);
}

export async function writeBoard(req, res, board, fields) {
  const base = req.body?.baseUpdatedAt;
  if (typeof base !== "string" || !Number.isFinite(Date.parse(base))) {
    res.status(428).json({ error: "board_version_required" });
    return null;
  }
  const version = new Date(base);
  if (+version === +board.updatedAt) {
    const written = await writeBoardAtVersion(Board, board._id, version, fields);
    if (written) return written;
  }
  const fresh = await loadBoardWithRole(req, res, "editor");
  if (fresh) res.status(409).json({ error: "conflict", board: boardPayload(fresh.board.toObject()) });
  return null;
}
