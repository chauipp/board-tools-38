import { Router } from "express";
import { Board, WorkspaceState } from "./models.js";
import { getBoardRole } from "./auth.js";

const toggles = ["miniOpen", "outlineOpen", "statusOpen", "tagOpen", "paletteOpen"];
const panels = ["brief", "flow", "balance", "handoff", "decisions", "insights", "impact", "playtests", "reports", "snapshots"];
const fields = ["camera", ...toggles, "inspector"];
const plain = (value) => value !== null && typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;
const keysOnly = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

function validInspector(value) {
  if (value === null) return true;
  if (!plain(value)) return false;
  if (value.type === "tree") return keysOnly(value, ["type", "kind", "id"]) &&
    ["node", "group"].includes(value.kind) && positiveId(value.id);
  if (value.type === "design") return keysOnly(value, ["type", "id"]) && positiveId(value.id);
  if (!panels.includes(value.type)) return false;
  if (value.type === "impact") return keysOnly(value, ["type", "id"]) &&
    (!Object.hasOwn(value, "id") || positiveId(value.id));
  return keysOnly(value, ["type"]);
}

function validChanges(body) {
  if (!keysOnly(body, ["changes"]) || !keysOnly(body.changes, fields) ||
      Object.keys(body.changes).length === 0) return false;
  return Object.entries(body.changes).every(([key, value]) => {
    if (toggles.includes(key)) return typeof value === "boolean";
    if (key === "inspector") return validInspector(value);
    return keysOnly(value, ["x", "y", "scale"]) &&
      Number.isFinite(value.x) && Math.abs(value.x) <= 1e8 &&
      Number.isFinite(value.y) && Math.abs(value.y) <= 1e8 &&
      Number.isFinite(value.scale) && value.scale >= 0.1 && value.scale <= 4;
  });
}

const response = (doc) => ({
  version: 1,
  state: doc?.state || {},
  updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null
});

export function createWorkspaceRouter(models = { Board, WorkspaceState }) {
  const router = Router();
  const pending = new Map();
  async function handle(req, res) {
    const expectedUser = req.get("X-Workspace-User");
    if (typeof expectedUser !== "string" || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(expectedUser)) {
      return res.status(400).json({ error: "invalid_workspace" });
    }
    const email = String(req.user.email || "").trim().toLowerCase();
    // Header chỉ kiểm tra tài khoản tab kỳ vọng; quyền và key vẫn lấy từ session.
    if (expectedUser !== email) {
      return res.status(409).json({ error: "workspace_account_changed" });
    }
    const { id, profile } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id) || !["desktop", "mobile"].includes(profile)) {
      return res.status(400).json({ error: "invalid_workspace" });
    }
    if (req.method === "PATCH" && !validChanges(req.body)) {
      return res.status(400).json({ error: "invalid_workspace" });
    }
    const queueKey = JSON.stringify([email, id.toLowerCase(), profile]);
    // Xếp thứ tự trước lần await đầu tiên để truy vấn quyền chậm không đảo
    // thứ tự nhận PATCH. Các user/board/profile khác nhau không chặn nhau.
    const previous = pending.get(queueKey) || Promise.resolve();
    const operation = previous.then(async () => {
      const board = await models.Board.findById(id).select("ownerEmail members");
      if (!board || !getBoardRole(board, email)) return res.status(404).json({ error: "not_found" });
      const workspaceKey = { email, boardId: board._id, profile };
      if (req.method === "GET") return res.json(response(await models.WorkspaceState.findOne(workspaceKey)));
      if (req.method === "DELETE") {
        await models.WorkspaceState.deleteOne(workspaceKey);
        return res.json(response(null));
      }
      const $set = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(req.body.changes)) $set[`state.${key}`] = value;
      const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: false };
      let doc;
      try {
        doc = await models.WorkspaceState.findOneAndUpdate(workspaceKey, { $set }, options);
      } catch (error) {
        if (error.code !== 11000) throw error;
        // Một request khác vừa tạo cùng key: cập nhật đúng các field của request này.
        doc = await models.WorkspaceState.findOneAndUpdate(workspaceKey, { $set }, { ...options, upsert: false });
      }
      if (!doc) return res.status(500).json({ error: "workspace_unavailable" });
      res.json(response(doc));
    }).catch(() => {
      res.status(500).json({ error: "workspace_unavailable" });
    });
    pending.set(queueKey, operation);
    try {
      await operation;
    } finally {
      if (pending.get(queueKey) === operation) pending.delete(queueKey);
    }
  }
  router.route("/:id/workspace/:profile").get(handle).patch(handle).delete(handle);
  return router;
}

export default createWorkspaceRouter();
