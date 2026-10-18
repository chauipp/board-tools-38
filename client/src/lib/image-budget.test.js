// client/src/lib/image-budget.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_HARD_LIMIT, BOARD_IMAGE_BUDGET, imageBytes, canAddImage, formatMB
} from "./image-budget.js";

const img = (n) => "data:image/png;base64," + "A".repeat(n);

test("ngân sách phải nằm dưới trần cứng của MongoDB", () => {
  assert.ok(BOARD_IMAGE_BUDGET < BOARD_HARD_LIMIT);
  assert.equal(BOARD_HARD_LIMIT, 16 * 1024 * 1024);
});

test("imageBytes: cộng độ dài mọi ảnh, bỏ qua thẻ không có ảnh", () => {
  assert.equal(imageBytes([{ id: 1, image: "abcd" }, { id: 2 }, { id: 3, image: "ef" }]), 6);
  assert.equal(imageBytes([]), 0);
  assert.equal(imageBytes(null), 0);
  assert.equal(imageBytes([{ id: 1, image: 12345 }]), 0, "ảnh không phải chuỗi thì không tính");
});

test("còn chỗ thì cho thêm", () => {
  const r = canAddImage([{ id: 1, image: img(1000) }], img(1000));
  assert.equal(r.ok, true);
  assert.equal(r.budget, BOARD_IMAGE_BUDGET);
});

test("vượt ngân sách thì chặn, và nói rõ đang dùng bao nhiêu", () => {
  const big = img(BOARD_IMAGE_BUDGET);
  const r = canAddImage([{ id: 1, image: big }], img(1000));
  assert.equal(r.ok, false);
  assert.ok(r.used >= BOARD_IMAGE_BUDGET);
  assert.equal(r.adding, 1000 + "data:image/png;base64,".length);
});

test("đúng bằng ngân sách vẫn cho qua (biên là <=)", () => {
  const half = "x".repeat(BOARD_IMAGE_BUDGET / 2);
  const r = canAddImage([{ id: 1, image: half }], half);
  assert.equal(r.ok, true);
});

test("dán đè lên thẻ đang có ảnh thì trừ ảnh cũ ra, không cộng dồn", () => {
  const nearly = "x".repeat(BOARD_IMAGE_BUDGET - 10);
  const nodes = [{ id: 7, image: nearly }];
  assert.equal(canAddImage(nodes, nearly).ok, false, "thêm thẻ mới thì hết chỗ");
  assert.equal(canAddImage(nodes, nearly, 7).ok, true, "thay ảnh của chính thẻ 7 thì vẫn vừa");
});

test("thay ảnh cho thẻ chưa có ảnh: không trừ nhầm của thẻ khác", () => {
  const nodes = [{ id: 1, image: "x".repeat(100) }, { id: 2 }];
  const r = canAddImage(nodes, "y".repeat(50), 2);
  assert.equal(r.used, 100);
});

test("formatMB: đọc ra được, một chữ số thập phân", () => {
  assert.equal(formatMB(14 * 1024 * 1024), "14.0");
  assert.equal(formatMB(1536 * 1024), "1.5");
});
