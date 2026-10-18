import { test } from "node:test";
import assert from "node:assert/strict";
import { cursorColor, excludeSelf } from "./usePresence.js";

test("cursorColor is deterministic for the same email", () => {
  assert.equal(cursorColor("a@b.com"), cursorColor("a@b.com"));
});

test("cursorColor returns an hsl() string", () => {
  assert.match(cursorColor("a@b.com"), /^hsl\(\d+, 70%, 55%\)$/);
});

test("cursorColor differs for different emails (no collision for this pair)", () => {
  assert.notEqual(cursorColor("a@b.com"), cursorColor("z@y.com"));
});

test("excludeSelf drops the peer matching selfId (server seeds self into presence:sync)", () => {
  const list = [
    { socketId: "self-1", email: "me@x.com" },
    { socketId: "peer-2", email: "other@x.com" },
  ];
  assert.deepEqual(excludeSelf(list, "self-1"), [{ socketId: "peer-2", email: "other@x.com" }]);
});

test("excludeSelf returns every peer unchanged when selfId is not in the list", () => {
  const list = [{ socketId: "peer-1" }, { socketId: "peer-2" }];
  assert.deepEqual(excludeSelf(list, "not-present"), list);
});

test("excludeSelf returns an empty list for an empty sync payload", () => {
  assert.deepEqual(excludeSelf([], "self-1"), []);
});
