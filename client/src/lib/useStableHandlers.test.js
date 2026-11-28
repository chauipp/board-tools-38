import { test } from "node:test";
import assert from "node:assert/strict";
import { stableHandlersFor } from "./useStableHandlers.js";

test("vỏ gọi xuyên tới bản MỚI NHẤT, định danh vỏ không đổi", () => {
  const ref = { current: { save: (x) => "v1:" + x } };
  const shell = stableHandlersFor(ref);
  const save = shell.save;
  assert.equal(shell.save("a"), "v1:a");
  ref.current = { save: (x) => "v2:" + x };
  assert.equal(shell.save("a"), "v2:a");
  assert.equal(shell.save, save);
});

test("chuyển nguyên mọi tham số", () => {
  const ref = { current: { f: (...a) => a } };
  assert.deepEqual(stableHandlersFor(ref).f(1, 2, 3), [1, 2, 3]);
});
