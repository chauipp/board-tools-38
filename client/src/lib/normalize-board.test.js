import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGameDesignBoard } from "./normalize-board.js";

test("board không phải game-design đi qua nguyên vẹn (cùng định danh)", () => {
  const board = { kind: "idea", nodes: [{ id: 1, design: { technicalNotes: "  x  " } }] };
  assert.equal(normalizeGameDesignBoard(board), board);
  assert.equal(normalizeGameDesignBoard(null), null);
});

test("board game-design: chuẩn hoá brief/flow/balance và design của từng thẻ", () => {
  const plain = { id: 2, title: "Không có design" };
  const board = {
    kind: "game-design",
    nodes: [{ id: 1, title: "Dash", design: { technicalNotes: "  ghi chú  " } }, plain]
  };
  const out = normalizeGameDesignBoard(board);
  assert.notEqual(out, board);
  assert.equal(out.kind, "game-design");
  assert.equal(typeof out.gameDesignBrief, "object");
  assert.ok(out.gameDesignFlow !== undefined);
  assert.ok(out.gameDesignBalance !== undefined);
  assert.equal(out.nodes[0].design.technicalNotes, "ghi chú");
  for (const key of ["playtestSession", "decisionLog", "teamHandoff", "review", "delivery", "analyticsEvents", "followUpTasks", "abTests", "liveOps", "postLaunchReview"]) {
    assert.ok(key in out.nodes[0].design, `thiếu ${key}`);
  }
  // Thẻ không có design giữ nguyên định danh.
  assert.equal(out.nodes[1], plain);
});

test("board game-design thiếu nodes vẫn chạy", () => {
  const out = normalizeGameDesignBoard({ kind: "game-design" });
  assert.deepEqual(out.nodes, []);
});
