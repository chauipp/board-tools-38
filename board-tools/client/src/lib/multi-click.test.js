import test from "node:test";
import assert from "node:assert/strict";
import {
  MULTI_CLICK_MS, CLICK_DRAG_TOL, multiClickAction, createMultiClick
} from "./multi-click.js";

test("2 lần là hoàn tác, 3 lần là làm lại", () => {
  assert.equal(multiClickAction(2), "undo");
  assert.equal(multiClickAction(3), "redo");
});

test("1 lần và từ 4 lần trở lên KHÔNG làm gì", () => {
  // Một lần bấm là chọn/bỏ chọn, đã có nghĩa sẵn. Từ bốn lần là bấm loạn tay —
  // không được biến thành một chuỗi thao tác lên dữ liệu.
  assert.equal(multiClickAction(1), null);
  for (const n of [0, 4, 5, 12]) assert.equal(multiClickAction(n), null, String(n));
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
