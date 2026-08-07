import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBoardPayload, BOARD_LIMITS } from "./board-payload.js";

// Hình dạng gần đúng một cú autosave thật.
const good = () => ({
  nodes: [
    { id: 1, x: 10, y: 20, w: 260, title: "Ý tưởng", desc: "vài dòng" },
    { id: 2, x: 400, y: 20, w: 420, pdfH: 500, pdf: { fileId: "a.pdf", name: "a", size: 10 } }
  ],
  edges: [{ id: 1, from: 1, to: 2 }],
  groups: [{ id: 1, x: 0, y: 0, w: 900, h: 600 }],
  drawings: [{ id: 1, kind: "pen", pts: [0, 0, 10, 10, 20, 25] }],
  statuses: [{ id: 1, name: "Ý tưởng mới", color: "st-idea" }],
  tags: [],
  palette: [],
  nextNodeId: 3, nextEdgeId: 2, nextGroupId: 2,
  nextStatusId: 2, nextTagId: 1, nextPaletteId: 1, nextDrawingId: 2
});

test("payload autosave bình thường đi qua", () => {
  assert.equal(validateBoardPayload(good()), null);
});

// Đây là điều quan trọng nhất của cả file: chặn nhầm nghĩa là autosave hỏng và
// người ta mất bài đang vẽ. Payload thiếu field phải được coi là "không đổi
// phần này", không phải là lỗi.
test("thiếu field KHÔNG bị coi là lỗi", () => {
  assert.equal(validateBoardPayload({}), null);
  assert.equal(validateBoardPayload({ nodes: [] }), null);
  const partial = { nodes: [{ id: 1 }], nextNodeId: 2 };
  assert.equal(validateBoardPayload(partial), null);
});

test("thẻ không có toạ độ vẫn qua — không phải thẻ nào cũng có đủ field", () => {
  assert.equal(validateBoardPayload({ nodes: [{ id: 9, title: "chỉ có tiêu đề" }] }), null);
});

test("NaN và Infinity trong toạ độ bị chặn", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const body = good();
    body.nodes[0].x = bad;
    assert.match(validateBoardPayload(body), /node\.x/, String(bad));
  }
});

// Mongo lưu NaN không kêu ca gì; hậu quả chỉ lộ ra lúc board được đọc lên và
// không vẽ được, lúc đó chẳng còn dấu vết nào chỉ ra cú ghi nào gây ra.
test("NaN trong toạ độ nét vẽ bị chặn", () => {
  const body = good();
  body.drawings[0].pts = [0, 0, NaN, 10];
  assert.match(validateBoardPayload(body), /nét vẽ/);
});

test("sai kiểu ở danh sách bị chặn", () => {
  for (const field of ["nodes", "edges", "groups", "drawings", "statuses", "tags", "palette"]) {
    const body = good();
    body[field] = "không phải mảng";
    assert.match(validateBoardPayload(body), new RegExp(field), field);
  }
});

test("phần tử không phải object bị chặn", () => {
  const body = good();
  body.nodes = [{ id: 1 }, "thẻ", null];
  assert.match(validateBoardPayload(body), /không phải object/);
});

test("vượt trần số lượng bị chặn, và đúng ngay tại trần thì vẫn qua", () => {
  const atLimit = { nodes: Array.from({ length: BOARD_LIMITS.nodes }, (_, i) => ({ id: i })) };
  assert.equal(validateBoardPayload(atLimit), null);
  const over = { nodes: Array.from({ length: BOARD_LIMITS.nodes + 1 }, (_, i) => ({ id: i })) };
  assert.match(validateBoardPayload(over), /vượt trần/);
});

// Đếm nét vẽ thôi thì không đủ: 10 nét, mỗi nét một triệu điểm, vẫn lọt.
test("tổng số điểm được cộng dồn qua mọi nét, không chỉ đếm số nét", () => {
  const per = 40_000;
  const count = Math.ceil(BOARD_LIMITS.totalDrawingPoints / per) + 1;
  const body = {
    drawings: Array.from({ length: count }, (_, i) => ({ id: i, pts: new Array(per).fill(1) }))
  };
  assert.match(validateBoardPayload(body), /tổng số điểm/);
});

test("tiêu đề và mô tả quá dài bị chặn", () => {
  const long = good();
  long.nodes[0].title = "x".repeat(BOARD_LIMITS.titleLen + 1);
  assert.match(validateBoardPayload(long), /tiêu đề/);

  const longDesc = good();
  longDesc.nodes[0].desc = "x".repeat(BOARD_LIMITS.descLen + 1);
  assert.match(validateBoardPayload(longDesc), /mô tả/);
});

test("mô tả dài nhưng trong hạn vẫn qua — người ta có quyền ghi chú dài", () => {
  const body = good();
  body.nodes[0].desc = "x".repeat(BOARD_LIMITS.descLen);
  assert.equal(validateBoardPayload(body), null);
});

test("bộ đếm id hỏng bị chặn", () => {
  const body = good();
  body.nextNodeId = NaN;
  assert.match(validateBoardPayload(body), /nextNodeId/);
});

test("dây nối trỏ tới đâu bằng số hỏng thì bị chặn", () => {
  const body = good();
  body.edges[0].to = "hai";
  assert.match(validateBoardPayload(body), /dây nối/);
});

test("payload rác không làm nổ", () => {
  for (const bad of [null, undefined, 42, "chuỗi", []]) {
    assert.equal(typeof validateBoardPayload(bad), "string", JSON.stringify(bad));
  }
});
