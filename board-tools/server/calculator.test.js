import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeCalculator, isStaleWrite, CALC_LIMITS } from "./calculator.js";

const good = () => ({
  budget: 500,
  nextStatId: 3,
  stats: [
    { id: 1, name: "Máu", cost: 1, a: 200, b: 220 },
    { id: 2, name: "Giáp", cost: 2, a: 60, b: 30 }
  ]
});

test("payload hợp lệ đi qua nguyên vẹn", () => {
  assert.deepEqual(sanitizeCalculator(good()), good());
});

test("field lạ không được chép sang document", () => {
  const body = good();
  body.hacked = true;
  body.stats[0].__proto__field = 1;
  body.stats[0].extra = "x";
  const got = sanitizeCalculator(body);
  assert.deepEqual(Object.keys(got).sort(), ["budget", "nextStatId", "stats"]);
  assert.deepEqual(Object.keys(got.stats[0]).sort(), ["a", "b", "cost", "id", "name"]);
});

test("NaN và Infinity bị loại — Mongo nhận nhưng mọi phép tính sau đó thành NaN", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const body = good();
    body.budget = bad;
    assert.equal(sanitizeCalculator(body), null, String(bad));
  }
  const body = good();
  body.stats[0].a = NaN;
  assert.equal(sanitizeCalculator(body), null);
});

test("số âm và số vượt trần bị loại", () => {
  const neg = good(); neg.budget = -1;
  assert.equal(sanitizeCalculator(neg), null);
  const huge = good(); huge.stats[1].cost = CALC_LIMITS.maxNumber + 1;
  assert.equal(sanitizeCalculator(huge), null);
});

test("số gửi dưới dạng chuỗi bị loại, không tự ép kiểu", () => {
  const body = good();
  body.budget = "500";
  assert.equal(sanitizeCalculator(body), null);
});

test("tên quá dài bị loại", () => {
  const body = good();
  body.stats[0].name = "x".repeat(CALC_LIMITS.maxNameLen + 1);
  assert.equal(sanitizeCalculator(body), null);
  body.stats[0].name = "x".repeat(CALC_LIMITS.maxNameLen);
  assert.notEqual(sanitizeCalculator(body), null);
});

test("quá nhiều chỉ số thì LOẠI cả gói, không cắt bớt danh sách", () => {
  const body = good();
  body.stats = Array.from({ length: CALC_LIMITS.maxStats + 1 }, (_, i) => ({
    id: i, name: "s", cost: 1, a: 1, b: 1
  }));
  assert.equal(sanitizeCalculator(body), null);
});

// Client tra chỉ số theo id khi sửa; hai chỉ số trùng id thì gõ vào ô này lại
// đổi giá trị ô kia, và không có gì trên màn hình giải thích vì sao.
test("id trùng nhau bị loại", () => {
  const body = good();
  body.stats[1].id = 1;
  assert.equal(sanitizeCalculator(body), null);
});

test("nextStatId phải là số nguyên từ 1 trở lên", () => {
  for (const bad of [0, -1, 1.5, "3", null, undefined]) {
    const body = good();
    body.nextStatId = bad;
    assert.equal(sanitizeCalculator(body), null, String(bad));
  }
});

test("payload rác không làm nổ", () => {
  for (const bad of [null, undefined, 42, "chuỗi", [], [1, 2]]) {
    assert.equal(sanitizeCalculator(bad), null, JSON.stringify(bad));
  }
  const noStats = { budget: 1, nextStatId: 1 };
  assert.equal(sanitizeCalculator(noStats), null);
});

test("bảng chỉ số rỗng là hợp lệ — người ta xoá hết để làm lại từ đầu", () => {
  assert.deepEqual(sanitizeCalculator({ budget: 0, nextStatId: 1, stats: [] }), {
    budget: 0, nextStatId: 1, stats: []
  });
});

// Đây là cái chặn cú "gõ nhanh, mạng chậm": hai request chồng nhau, cú cũ về
// sau và ghi đè cú mới, người dùng thấy chữ vừa gõ tự lùi lại.
test("isStaleWrite: mốc cũ hơn bản đang lưu thì bị bỏ", () => {
  assert.equal(isStaleWrite(1000, 2000), true);
  assert.equal(isStaleWrite(2000, 1000), false);
  assert.equal(isStaleWrite(1000, 1000), false);
});

test("isStaleWrite: thiếu mốc ở bất kỳ bên nào thì CHO ghi", () => {
  // Client cũ không gửi savedAt, và document cũ chưa có field này — chặn ở đây
  // là khoá luôn tính năng lưu của họ.
  assert.equal(isStaleWrite(undefined, 2000), false);
  assert.equal(isStaleWrite(1000, undefined), false);
  assert.equal(isStaleWrite(NaN, 2000), false);
  assert.equal(isStaleWrite("2000", 1000), false);
});
