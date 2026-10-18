import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOARD_BGS, BOARD_GRIDS, COLOR_PACKS, isBoardBg, isBoardGrid, isColorPack
} from "./board-theme.js";

test("id preset không trùng nhau", () => {
  assert.equal(new Set(BOARD_BGS).size, BOARD_BGS.length);
  assert.equal(new Set(BOARD_GRIDS).size, BOARD_GRIDS.length);
  assert.equal(new Set(COLOR_PACKS).size, COLOR_PACKS.length);
});

// "dots" là lưới chấm, nhưng nó KHÔNG có id: mặc định của board là null. Để nó
// lọt vào mảng thì cùng một kiểu lưới có hai cách lưu, và board cũ (null) với
// board mới ("dots") sẽ khác nhau trên giấy dù nhìn y hệt.
test("lưới chấm mặc định không có id riêng", () => {
  assert.equal(BOARD_GRIDS.includes("dots"), false);
  assert.equal(isBoardGrid("dots"), false);
  assert.equal(isBoardGrid(null), true);
  assert.equal(isBoardGrid("lines"), true);
  assert.equal(isBoardGrid("plain"), true);
});

// Ba trục là ba không gian id RIÊNG: một id của trục này không được vô tình
// hợp lệ ở trục kia, không thì "Nhập JSON" dán nhầm field vẫn lọt qua cửa.
test("id của trục nào chỉ hợp lệ ở trục đó", () => {
  for (const id of BOARD_BGS) assert.equal(isColorPack(id), false, id);
  for (const id of COLOR_PACKS) assert.equal(isBoardBg(id), false, id);
  for (const id of BOARD_GRIDS) {
    assert.equal(isBoardBg(id), false, id);
    assert.equal(isColorPack(id), false, id);
  }
});

// null = "theo giao diện", là giá trị hợp lệ và là mặc định của board cũ trong
// DB — board tạo trước đợt này không có field nào cả.
test("null hợp lệ, chuỗi lạ thì không", () => {
  assert.equal(isBoardBg(null), true);
  assert.equal(isBoardBg(undefined), true);
  assert.equal(isBoardBg("mint"), true);
  assert.equal(isBoardBg("chartreuse"), false);
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
    assert.equal(isBoardGrid(bad), false, String(bad));
    assert.equal(isColorPack(bad), false, String(bad));
  }
});

test("mọi id đều là chuỗi kebab thường, để dùng thẳng trong selector CSS", () => {
  for (const id of [...BOARD_BGS, ...BOARD_GRIDS, ...COLOR_PACKS]) {
    assert.match(id, /^[a-z][a-z-]*$/);
  }
});

// Danh sách id ở đây và bảng màu trong CSS là HAI file phải đi cùng nhau: thêm
// một id mà quên khối CSS thì nút vẫn hiện, bấm vẫn lưu, mà bảng không đổi gì —
// một lỗi im lặng. Đọc thẳng file CSS là cách duy nhất bắt được nó ở tầng
// node:test (không có trình duyệt nào ở đây để hỏi).
const CSS = readFileSync(new URL("../styles/idea-map.css", import.meta.url), "utf8");

test("mỗi preset nền có cả khối màu lẫn màu cho nút swatch", () => {
  for (const id of BOARD_BGS) {
    assert.ok(CSS.includes(`:root[data-bg="${id}"]`), `thiếu khối :root[data-bg="${id}"]`);
    assert.ok(CSS.includes(`.bg-swatch[data-bg="${id}"]`), `thiếu màu nút cho "${id}"`);
    // Bản tối là chỗ dễ quên nhất: bản sáng viết trước, chạy thử ở giao diện
    // sáng thấy đúng rồi đi tiếp.
    assert.ok(
      CSS.includes(`:root[data-theme="dark"][data-bg="${id}"]`),
      `thiếu bản tối cho "${id}"`
    );
  }
});

test("mỗi kiểu lưới và mỗi bộ màu có khối CSS của nó", () => {
  for (const id of BOARD_GRIDS) {
    assert.ok(CSS.includes(`:root[data-grid="${id}"]`), `thiếu khối lưới "${id}"`);
  }
  for (const id of COLOR_PACKS) {
    assert.ok(CSS.includes(`:root[data-pack="${id}"]`), `thiếu khối bộ màu "${id}"`);
  }
});

// Bộ màu chỉ được gán lại ĐÚNG tám --dot-*: thiếu một cái thì màu đó rơi về bộ
// Cổ điển và bảng lẫn lộn hai hệ màu.
test("mỗi bộ màu khai đủ tám --dot-*", () => {
  for (const id of COLOR_PACKS) {
    const start = CSS.indexOf(`:root[data-pack="${id}"]`);
    const block = CSS.slice(start, CSS.indexOf("}", start));
    for (let i = 1; i <= 8; i++) {
      assert.ok(block.includes(`--dot-${i}:`), `bộ "${id}" thiếu --dot-${i}`);
    }
  }
});
