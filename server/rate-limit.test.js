import { test } from "node:test";
import assert from "node:assert/strict";
import { hit, prune } from "./rate-limit.js";

const WINDOW = 60_000;

test("cho qua tới đúng trần rồi mới chặn", () => {
  const store = new Map();
  for (let i = 1; i <= 3; i++) {
    assert.equal(hit(store, "a", 1000, WINDOW, 3).allowed, true, `lần ${i}`);
  }
  assert.equal(hit(store, "a", 1000, WINDOW, 3).allowed, false);
});

test("remaining đếm lùi đúng", () => {
  const store = new Map();
  assert.equal(hit(store, "a", 0, WINDOW, 3).remaining, 2);
  assert.equal(hit(store, "a", 0, WINDOW, 3).remaining, 1);
  assert.equal(hit(store, "a", 0, WINDOW, 3).remaining, 0);
});

test("mỗi key một bộ đếm riêng", () => {
  const store = new Map();
  hit(store, "a", 0, WINDOW, 1);
  assert.equal(hit(store, "a", 0, WINDOW, 1).allowed, false);
  assert.equal(hit(store, "b", 0, WINDOW, 1).allowed, true);
});

test("qua cửa sổ thì được cấp lại từ đầu", () => {
  const store = new Map();
  hit(store, "a", 0, WINDOW, 1);
  assert.equal(hit(store, "a", WINDOW - 1, WINDOW, 1).allowed, false);
  assert.equal(hit(store, "a", WINDOW, WINDOW, 1).allowed, true);
});

// Đây là lỗi kinh điển của rate limiter tự viết: mỗi lần bị chặn lại dời hạn ra
// xa, nên ai cứ thử lại đều đặn thì không bao giờ được cấp lại — giới hạn tần
// suất biến thành lệnh cấm vĩnh viễn.
test("bị chặn KHÔNG dời hạn cấp lại", () => {
  const store = new Map();
  hit(store, "a", 0, WINDOW, 1);
  for (let t = 100; t < WINDOW; t += 100) hit(store, "a", t, WINDOW, 1);
  assert.equal(hit(store, "a", WINDOW, WINDOW, 1).allowed, true);
});

test("retryAfterMs là thời gian còn lại thật của cửa sổ", () => {
  const store = new Map();
  hit(store, "a", 1000, WINDOW, 1);
  const blocked = hit(store, "a", 21_000, WINDOW, 1);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 40_000);
});

test("prune bỏ cửa sổ hết hạn, giữ cửa sổ còn hiệu lực", () => {
  const store = new Map();
  hit(store, "cu", 0, WINDOW, 5);
  hit(store, "moi", WINDOW, WINDOW, 5);
  assert.equal(store.size, 2);
  assert.equal(prune(store, WINDOW + 1), 1);
  assert.equal(store.has("cu"), false);
  assert.equal(store.has("moi"), true);
});

test("trần 0 thì chặn ngay từ lần đầu", () => {
  assert.equal(hit(new Map(), "a", 0, WINDOW, 0).allowed, false);
});
