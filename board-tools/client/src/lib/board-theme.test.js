import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_BGS, COLOR_PACKS, isBoardBg, isColorPack } from "./board-theme.js";

test("id preset không trùng nhau", () => {
  assert.equal(new Set(BOARD_BGS).size, BOARD_BGS.length);
  assert.equal(new Set(COLOR_PACKS).size, COLOR_PACKS.length);
});

// null = "theo giao diện", là giá trị hợp lệ và là mặc định của board cũ trong
// DB — board tạo trước đợt này không có field nào cả.
test("null hợp lệ, chuỗi lạ thì không", () => {
  assert.equal(isBoardBg(null), true);
  assert.equal(isBoardBg(undefined), true);
  assert.equal(isBoardBg("mint"), true);
  assert.equal(isBoardBg("neon"), false);
  assert.equal(isBoardBg(7), false);
  assert.equal(isColorPack(null), true);
  assert.equal(isColorPack("pastel"), true);
  assert.equal(isColorPack("Pastel"), false);
});

// Hai hàm này canh cửa cho DOM: giá trị đi thẳng vào setAttribute("data-bg", …).
// Nguồn của nó có thể là "Nhập JSON" — người dùng dán một board tay viết vào.
test("chặn thứ không phải chuỗi id, kể cả chuỗi có ký tự lạ", () => {
  for (const bad of ['" onload="x', "mint mint", "", {}, [], 0, true]) {
    assert.equal(isBoardBg(bad), false, String(bad));
    assert.equal(isColorPack(bad), false, String(bad));
  }
});

test("mọi id đều là chuỗi kebab thường, để dùng thẳng trong selector CSS", () => {
  for (const id of [...BOARD_BGS, ...COLOR_PACKS]) {
    assert.match(id, /^[a-z][a-z-]*$/);
  }
});
