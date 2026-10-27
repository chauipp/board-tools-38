import test from "node:test";
import assert from "node:assert/strict";
import {
  MULTI_CLICK_MS, CLICK_DRAG_TOL, createMultiClick, isDragGesture
} from "./multi-click.js";

test("phân biệt click với drag theo khoảng cách con trỏ", () => {
  assert.equal(isDragGesture({ x: 100, y: 100 }, { x: 102, y: 102 }), false);
  assert.equal(isDragGesture({ x: 100, y: 100 }, { x: 104, y: 100 }), false);
  assert.equal(isDragGesture({ x: 100, y: 100 }, { x: 105, y: 100 }), true);
});

test("bấm liên tiếp trong cửa sổ thì cộng dồn", () => {
  const mc = createMultiClick();
  assert.equal(mc.click(1000), 1);
  assert.equal(mc.click(1100), 2);
  assert.equal(mc.click(1200), 3);
});

test("bấm cách nhau quá cửa sổ thì đếm lại từ đầu", () => {
  const mc = createMultiClick();
  assert.equal(mc.click(1000), 1);
  assert.equal(mc.click(1000 + MULTI_CLICK_MS + 1), 1);
});

test("đúng bằng cửa sổ vẫn tính là liên tiếp", () => {
  // Biên phải nằm về phía "vẫn tính": người dùng bấm chậm một nhịp thì cử chỉ
  // trượt, còn tính rộng ra một mili giây thì không hại ai.
  const mc = createMultiClick();
  mc.click(1000);
  assert.equal(mc.click(1000 + MULTI_CLICK_MS), 2);
});

test("cửa sổ đo từ lần bấm GẦN NHẤT, không từ lần đầu chuỗi", () => {
  // Bấm ba lần đều tay, mỗi lần cách nhau 200ms: tổng 400ms > cửa sổ, nhưng đây
  // vẫn là một chuỗi ba lần. Đo từ lần đầu thì cú thứ ba rơi ra ngoài.
  const mc = createMultiClick();
  mc.click(1000);
  mc.click(1200);
  assert.equal(mc.click(1400), 3);
});

test("cancel() cắt chuỗi: lần bấm ngay sau đó là lần thứ nhất", () => {
  const mc = createMultiClick();
  mc.click(1000);
  mc.click(1050);
  mc.cancel();
  assert.equal(mc.click(1060), 1, "một cú kéo chen vào phải cắt chuỗi");
});

test("các hằng số ở mức hợp lý", () => {
  assert.ok(MULTI_CLICK_MS >= 200 && MULTI_CLICK_MS <= 600, "cửa sổ bấm nhiều lần");
  assert.ok(CLICK_DRAG_TOL > 0 && CLICK_DRAG_TOL <= 10, "ngưỡng phân biệt bấm với kéo");
});

// ── Đích của cú bấm ────────────────────────────────────────────────────────
//
// Nền trống (null) và một nét vẽ (id) là hai đích khác nhau, và cả hai đều có
// cử chỉ bấm nhiều lần riêng. Không phân biệt được đích thì hai chuỗi trộn vào
// nhau và người dùng ăn thao tác mình không gọi.

test("đổi đích thì chuỗi bắt đầu lại từ 1", () => {
  const mc = createMultiClick(300);
  assert.equal(mc.click(0, 7), 1, "bấm lên nét 7");
  // Trong cửa sổ thời gian, nhưng sang nền trống: KHÔNG được thành 2 (tức không
  // được thành một cú hoàn tác).
  assert.equal(mc.click(50, null), 1, "sang nền trống");
  assert.equal(mc.click(100, 7), 1, "quay lại nét 7");
});

test("hai nét khác nhau cũng là hai đích khác nhau", () => {
  const mc = createMultiClick(300);
  assert.equal(mc.click(0, 7), 1);
  assert.equal(mc.click(50, 9), 1, "nét 9 không nối tiếp chuỗi của nét 7");
  assert.equal(mc.click(100, 9), 2, "nhưng nét 9 tự đếm tiếp được");
});

test("cùng một đích thì đếm dồn như thường", () => {
  const mc = createMultiClick(300);
  assert.equal(mc.click(0, 7), 1);
  assert.equal(mc.click(100, 7), 2);
  assert.equal(mc.click(200, 7), 3);
});

// Không truyền đích = nền trống.
test("không truyền đích thì mặc định là nền trống, đếm dồn bình thường", () => {
  const mc = createMultiClick(300);
  assert.equal(mc.click(0), 1);
  assert.equal(mc.click(100), 2);
  assert.equal(mc.click(200, null), 3, "null và bỏ trống là CÙNG một đích");
});

// Đúng đích nhưng quá cửa sổ vẫn phải đứt — chốt thời gian không được biến mất
// khi thêm chốt đích.
test("cùng đích mà quá cửa sổ thì vẫn bắt đầu lại", () => {
  const mc = createMultiClick(300);
  assert.equal(mc.click(0, 7), 1);
  assert.equal(mc.click(301, 7), 1);
});

test("cancel() xoá cả đích, không chỉ xoá bộ đếm", () => {
  const mc = createMultiClick(300);
  assert.equal(mc.click(0, 7), 1);
  mc.cancel();
  assert.equal(mc.click(50, 7), 1, "cùng đích cũ nhưng chuỗi đã bị cắt");
});
