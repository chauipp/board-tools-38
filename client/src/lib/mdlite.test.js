import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseDesc } from "./mdlite.js";

test("parseInline: text + bold + link", () => {
  assert.deepEqual(parseInline("xem **cái này** tại https://a.bc/x nhé"), [
    { type: "text", value: "xem " },
    { type: "bold", value: "cái này" },
    { type: "text", value: " tại " },
    { type: "link", value: "https://a.bc/x" },
    { type: "text", value: " nhé" }
  ]);
});

test("parseInline: chuỗi thuần không markup trả về 1 token text", () => {
  assert.deepEqual(parseInline("abc"), [{ type: "text", value: "abc" }]);
});

test("parseDesc: bullet và đoạn thường", () => {
  const out = parseDesc("- một\nhai");
  assert.equal(out[0].type, "bullet");
  assert.deepEqual(out[0].inline, [{ type: "text", value: "một" }]);
  assert.equal(out[1].type, "para");
});
