import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { Board, BoardSnapshot, PdfFile } from "./models.js";
import boardFilesRouter from "./routes/board-files.js";
import boardsRouter from "./routes/boards.js";
import boardSnapshotsRouter from "./routes/board-snapshots.js";
import boardMembersRouter from "./routes/board-members.js";
import {
  BOARD_LIST_FIELDS, BOARD_COUNTER_FIELDS, BOARD_THEME_FIELDS, BOARD_GAME_DESIGN_FIELDS, pickBoardContent,
  boardPayload, safeNextStatusId
} from "./board-fields.js";

// Tập key của các payload board, chụp lại TRƯỚC khi gom danh sách field về
// board-fields.js. Đổi một tập ở đây là đổi hợp đồng với client: thiếu một key
// trong broadcast/restore là mất dữ liệu âm thầm phía người nhận.
const CONTENT_KEYS = [
  "kind", "gameDesignBrief", "gameDesignFlow", "gameDesignBalance",
  "nodes", "edges", "groups", "statuses", "tags", "palette", "bg", "grid", "pack", "drawings",
  "nextNodeId", "nextEdgeId", "nextGroupId", "nextStatusId", "nextTagId", "nextPaletteId", "nextDrawingId"
];
const GET_KEYS = ["id", "name", "role", ...CONTENT_KEYS, "updatedAt", "view"];
const CONFLICT_KEYS = [...CONTENT_KEYS, "updatedAt"];
const PUT_UPDATE_KEYS = [...CONTENT_KEYS, "view", "updatedAt"];
const PUT_BROADCAST_KEYS = [...CONTENT_KEYS, "updatedAt"];
const RESTORE_KEYS = [...CONTENT_KEYS, "updatedAt"];

const ID = "abcdefabcdefabcdefabcdef";
const OWNER = "owner@example.test";

const sorted = (keys) => [...keys].sort();

function fullBoard() {
  return {
    _id: ID,
    name: "Board",
    ownerEmail: OWNER,
    members: [],
    kind: "idea",
    gameDesignBrief: null,
    gameDesignFlow: null,
    gameDesignBalance: null,
    nodes: [{ id: 1, x: 0, y: 0, title: "A" }],
    edges: [],
    groups: [],
    statuses: [{ id: 1, name: "S" }],
    tags: [],
    palette: [],
    bg: "dots",
    grid: true,
    pack: "default",
    drawings: [],
    nextNodeId: 2,
    nextEdgeId: 1,
    nextGroupId: 1,
    nextStatusId: 2,
    nextTagId: 1,
    nextPaletteId: 1,
    nextDrawingId: 1,
    view: { x: 0, y: 0, scale: 1 },
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

// Query giả: loadBoardWithRole gọi .select() rồi await, GET thì await thẳng.
function fakeQuery(value) {
  return {
    select() { return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

const originals = {
  findById: Board.findById,
  findByIdAndUpdate: Board.findByIdAndUpdate,
  snapshotFindOne: BoardSnapshot.findOne,
  pdfFind: PdfFile.find
};
after(() => {
  Board.findById = originals.findById;
  Board.findByIdAndUpdate = originals.findByIdAndUpdate;
  BoardSnapshot.findOne = originals.snapshotFindOne;
  PdfFile.find = originals.pdfFind;
});

async function fixture(t) {
  const doc = fullBoard();
  const calls = { updates: [], emits: [] };
  Board.findById = () => fakeQuery({ ...doc, toObject: () => ({ ...doc }) });
  Board.findByIdAndUpdate = async (id, update) => { calls.updates.push(update); return null; };
  BoardSnapshot.findOne = () => fakeQuery({ _id: "s1", boardId: ID, board: (({ _id, name, ownerEmail, members, view, updatedAt, ...rest }) => rest)(fullBoard()) });
  // syncBoardRefs chạy sau khi trả lời; không có PDF thì nó dừng ngay.
  PdfFile.find = () => fakeQuery([]);

  const io = {
    in() {
      const target = { except() { return target; }, emit(event, payload) { calls.emits.push({ event, payload }); } };
      return target;
    }
  };
  const app = express();
  app.set("io", io);
  app.use(express.json({ limit: "10mb" }));
  app.use((req, _res, next) => { req.user = { email: OWNER }; next(); });
  app.use("/api/boards", boardFilesRouter, boardsRouter, boardSnapshotsRouter, boardMembersRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = async (method, url, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  return { request, calls };
}

test("board shape: GET /:id trả đúng tập key", async (t) => {
  const { request } = await fixture(t);
  const res = await request("GET", `/api/boards/${ID}`);
  assert.equal(res.status, 200);
  assert.deepEqual(sorted(Object.keys(res.body)), sorted(GET_KEYS));
});

test("board shape: PUT ghi đúng tập key (có view) và broadcast đúng tập key (không có view)", async (t) => {
  const { request, calls } = await fixture(t);
  const { _id, name, ownerEmail, members, updatedAt, ...body } = fullBoard();
  const res = await request("PUT", `/api/boards/${ID}`, { ...body, clientId: "sock-1" });
  assert.equal(res.status, 200);
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(sorted(Object.keys(calls.updates[0])), sorted(PUT_UPDATE_KEYS));
  assert.equal(calls.emits.length, 1);
  assert.equal(calls.emits[0].event, "board:update");
  assert.deepEqual(sorted(Object.keys(calls.emits[0].payload)), sorted(PUT_BROADCAST_KEYS));
  assert.equal(Object.hasOwn(calls.emits[0].payload, "view"), false);
});

test("board shape: PUT thiếu field vẫn giữ key (undefined) để findByIdAndUpdate bỏ qua", async (t) => {
  const { request, calls } = await fixture(t);
  const res = await request("PUT", `/api/boards/${ID}`, { nodes: [] });
  assert.equal(res.status, 200);
  assert.deepEqual(sorted(Object.keys(calls.updates[0])), sorted(PUT_UPDATE_KEYS));
  assert.equal(calls.updates[0].edges, undefined);
  assert.deepEqual(calls.updates[0].nodes, []);
});

test("board shape: PUT 409 trả board cùng hình dạng với GET (bỏ id/name/role/view)", async (t) => {
  const { request } = await fixture(t);
  const res = await request("PUT", `/api/boards/${ID}`, { nodes: [], baseUpdatedAt: "2020-01-01T00:00:00.000Z" });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "conflict");
  assert.deepEqual(sorted(Object.keys(res.body.board)), sorted(CONFLICT_KEYS));
});

test("board shape: restore snapshot ghi, broadcast và trả về đúng tập key", async (t) => {
  const { request, calls } = await fixture(t);
  const res = await request("POST", `/api/boards/${ID}/snapshots/s1/restore`);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(sorted(Object.keys(res.body.board)), sorted(RESTORE_KEYS));
  assert.deepEqual(sorted(Object.keys(calls.updates[0])), sorted(RESTORE_KEYS));
  assert.deepEqual(sorted(Object.keys(calls.emits[0].payload)), sorted(RESTORE_KEYS));
});

test("board-fields: các danh sách field khớp hợp đồng đã chụp", () => {
  assert.deepEqual(BOARD_LIST_FIELDS, ["nodes", "edges", "groups", "drawings", "statuses", "tags", "palette"]);
  assert.deepEqual(BOARD_COUNTER_FIELDS, [
    "nextNodeId", "nextEdgeId", "nextGroupId", "nextStatusId", "nextTagId", "nextPaletteId", "nextDrawingId"
  ]);
  assert.deepEqual(BOARD_THEME_FIELDS, ["bg", "grid", "pack"]);
  assert.deepEqual(BOARD_GAME_DESIGN_FIELDS, ["gameDesignBrief", "gameDesignFlow", "gameDesignBalance"]);
  assert.deepEqual(
    sorted(["kind", ...BOARD_GAME_DESIGN_FIELDS, ...BOARD_LIST_FIELDS, ...BOARD_THEME_FIELDS, ...BOARD_COUNTER_FIELDS]),
    sorted(CONTENT_KEYS)
  );
});

test("board-fields: pickBoardContent chỉ lấy field nội dung, luôn đủ key", () => {
  const picked = pickBoardContent({ nodes: [1], bg: "dots", view: { x: 1 }, kind: "idea", gameDesignBrief: {}, clientId: "x" });
  assert.deepEqual(sorted(Object.keys(picked)), sorted([...BOARD_LIST_FIELDS, ...BOARD_THEME_FIELDS, ...BOARD_COUNTER_FIELDS]));
  assert.deepEqual(picked.nodes, [1]);
  assert.equal(picked.bg, "dots");
  assert.equal(picked.edges, undefined);
  assert.equal(Object.hasOwn(picked, "view"), false);
  assert.equal(Object.hasOwn(picked, "kind"), false);
});

// Review PR #5: board game-design cũ lưu nextStatusId = 9 trong khi đã có id 9.
test("safeNextStatusId: board cũ có bộ đếm trùng id thì nâng lên max(id)+1", () => {
  const statuses = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: "s" + (i + 1) }));
  assert.equal(safeNextStatusId({ statuses, nextStatusId: 9 }), 10);
  // Bộ đếm hợp lệ (lớn hơn) giữ nguyên — không lùi bộ đếm của ai.
  assert.equal(safeNextStatusId({ statuses, nextStatusId: 15 }), 15);
  // Thiếu hoặc rác thì vẫn ra số dùng được.
  assert.equal(safeNextStatusId({ statuses }), 10);
  assert.equal(safeNextStatusId({ statuses: [], nextStatusId: "x" }), 1);
});

test("boardPayload: board cũ đọc → thêm trạng thái → id mới không trùng, id cũ và tham chiếu giữ nguyên", () => {
  const statuses = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: "s" + (i + 1) }));
  const stored = { kind: "game-design", statuses, nextStatusId: 9, nodes: [{ id: 1, statusId: 9 }], updatedAt: "t" };
  const payload = boardPayload(stored);
  assert.equal(payload.nextStatusId, 10);
  assert.deepEqual(payload.statuses.map((s) => s.id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(payload.nodes[0].statusId, 9);
  // Luồng của client (createBadge): cấp id = nextStatusId rồi tăng.
  const id = payload.nextStatusId;
  assert.ok(!payload.statuses.some((s) => s.id === id));
});
