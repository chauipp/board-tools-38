import { test } from "node:test";
import assert from "node:assert/strict";
import { pickInk } from "./badges.js";

test("pickInk chọn chữ đen trên nền sáng, chữ trắng trên nền tối", () => {
  assert.equal(pickInk("#ffffff"), "#000");
  assert.equal(pickInk("#000000"), "#fff");
  assert.equal(pickInk("#ffff00"), "#000");
  assert.equal(pickInk("#1A1C16"), "#fff");
});

test("pickInk trả về mặc định #fff khi hex không hợp lệ", () => {
  assert.equal(pickInk(""), "#fff");
  assert.equal(pickInk(null), "#fff");
  assert.equal(pickInk("not-a-color"), "#fff");
});
