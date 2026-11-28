import { test } from "node:test";
import assert from "node:assert/strict";
import { bindAll } from "./bind-all.js";

test("bindAll đưa cùng một bảng cho mọi hook", () => {
  const got = [];
  const hook = () => ({ bind: (d) => got.push(d) });
  const deps = { a: () => 1 };
  bindAll([hook(), hook()], deps);
  assert.equal(got.length, 2);
  assert.ok(got.every((d) => d === deps));
});
