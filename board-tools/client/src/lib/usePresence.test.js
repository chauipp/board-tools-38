import { test } from "node:test";
import assert from "node:assert/strict";
import { cursorColor } from "./usePresence.js";

test("cursorColor is deterministic for the same email", () => {
  assert.equal(cursorColor("a@b.com"), cursorColor("a@b.com"));
});

test("cursorColor returns an hsl() string", () => {
  assert.match(cursorColor("a@b.com"), /^hsl\(\d+, 70%, 55%\)$/);
});

test("cursorColor differs for different emails (no collision for this pair)", () => {
  assert.notEqual(cursorColor("a@b.com"), cursorColor("z@y.com"));
});
