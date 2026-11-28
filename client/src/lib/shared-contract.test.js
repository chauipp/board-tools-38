import { test } from "node:test";
import assert from "node:assert/strict";
import { RELATION_OPTIONS, RELATION_IDS } from "./game-design/types.js";
import { SHAPE_KINDS, SHAPE_CLOSED, VERTEX_NUMBERS } from "./shape.js";
import * as shared from "../../../shared/ink-kinds.js";

// Nhãn quan hệ ở client phải phủ ĐÚNG tập id server chấp nhận — thêm một quan
// hệ ở shared mà quên nhãn (hoặc ngược lại) là test này đỏ.
test("RELATION_OPTIONS liệt kê đúng RELATION_IDS dùng chung", () => {
  assert.deepEqual(RELATION_OPTIONS.map((item) => item.id).sort(), [...RELATION_IDS].sort());
});

test("shape.js re-export đúng các bảng của shared/ink-kinds.js", () => {
  assert.equal(SHAPE_KINDS, shared.SHAPE_KINDS);
  assert.equal(SHAPE_CLOSED, shared.SHAPE_CLOSED);
  assert.equal(VERTEX_NUMBERS, shared.VERTEX_NUMBERS);
});
