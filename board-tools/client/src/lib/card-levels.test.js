// board-tools/client/src/lib/card-levels.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_LEVELS, DEFAULT_CARD_LEVEL, CARD_LEVEL_W,
  cardLevel, cardLevelW, levelPatch, loadCardLevel, saveCardLevel
} from "./card-levels.js";

// localStorage giả: chỉ cần getItem/setItem, không cần cả Storage API.
function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test("CARD_LEVELS: năm bậc, mỗi bậc có một bề rộng, nhỏ dần", () => {
  assert.deepEqual(CARD_LEVELS, [1, 2, 3, 4, 5]);
  assert.ok(CARD_LEVELS.includes(DEFAULT_CARD_LEVEL));
  const widths = CARD_LEVELS.map((lv) => CARD_LEVEL_W[lv]);
  assert.equal(widths.filter(Number.isFinite).length, 5);
  for (let i = 1; i < widths.length; i++) {
    assert.ok(widths[i] < widths[i - 1], `bậc ${i + 1} phải hẹp hơn bậc ${i}`);
  }
  // Bậc 3 giữ đúng bề rộng thẻ thường cũ, bậc 1 giữ đúng bề rộng thẻ gốc cũ:
  // board đã có từ trước không được đổi hình khi lên bản này.
  assert.equal(CARD_LEVEL_W[3], 210);
  assert.equal(CARD_LEVEL_W[1], 260);
});

test("cardLevel: đọc node.level, thiếu thì về bậc mặc định", () => {
  assert.equal(cardLevel({ level: 1 }), 1);
  assert.equal(cardLevel({ level: 5 }), 5);
  assert.equal(cardLevel({}), DEFAULT_CARD_LEVEL);
  assert.equal(cardLevel(null), DEFAULT_CARD_LEVEL);
  assert.equal(cardLevel(undefined), DEFAULT_CARD_LEVEL);
});

// Board lưu trước đợt này chỉ có cờ isRoot. Đọc sai chỗ này là mọi thẻ gốc cũ
// tụt xuống thẻ thường ngay lần mở đầu tiên.
test("cardLevel: board cũ chỉ có isRoot vẫn ra đúng bậc", () => {
  assert.equal(cardLevel({ isRoot: true }), 1);
  assert.equal(cardLevel({ isRoot: false }), DEFAULT_CARD_LEVEL);
  // `level` mới đè cờ cũ: đổi bậc xong thì cờ chỉ còn là bản sao, không phải
  // nguồn sự thật.
  assert.equal(cardLevel({ isRoot: true, level: 4 }), 4);
});

test("cardLevel: giá trị rác lùi về bậc mặc định chứ không nổ", () => {
  assert.equal(cardLevel({ level: 0 }), DEFAULT_CARD_LEVEL);
  assert.equal(cardLevel({ level: 9 }), DEFAULT_CARD_LEVEL);
  assert.equal(cardLevel({ level: "to nhất" }), DEFAULT_CARD_LEVEL);
  assert.equal(cardLevel({ level: null }), DEFAULT_CARD_LEVEL);
});

test("cardLevelW: bề rộng theo bậc của node", () => {
  assert.equal(cardLevelW({ level: 1 }), CARD_LEVEL_W[1]);
  assert.equal(cardLevelW({ isRoot: true }), CARD_LEVEL_W[1]);
  assert.equal(cardLevelW({}), CARD_LEVEL_W[DEFAULT_CARD_LEVEL]);
});

test("levelPatch: ghi kèm isRoot cho khớp bậc 1", () => {
  assert.deepEqual(levelPatch(1), { level: 1, isRoot: true });
  assert.deepEqual(levelPatch(3), { level: 3, isRoot: false });
  assert.deepEqual(levelPatch(5), { level: 5, isRoot: false });
  // Hạ bậc một thẻ gốc phải TẮT cờ cũ, không để lại 👑 mồ côi.
  assert.equal(levelPatch(2).isRoot, false);
});

test("levelPatch: bậc lạ rơi về mặc định thay vì ghi rác vào board", () => {
  assert.deepEqual(levelPatch(undefined), { level: DEFAULT_CARD_LEVEL, isRoot: false });
  assert.deepEqual(levelPatch(0), { level: DEFAULT_CARD_LEVEL, isRoot: false });
  assert.deepEqual(levelPatch("1"), { level: 1, isRoot: true });
});

test("loadCardLevel: chưa có khoá / JSON hỏng thì trả mặc định", () => {
  assert.equal(loadCardLevel(fakeStorage()), DEFAULT_CARD_LEVEL);
  assert.equal(loadCardLevel(fakeStorage({ "ideamap.card": "{{{" })), DEFAULT_CARD_LEVEL);
  assert.equal(loadCardLevel(fakeStorage({ "ideamap.card": '{"level":8}' })), DEFAULT_CARD_LEVEL);
});

test("saveCardLevel → loadCardLevel: đi một vòng ra đúng bậc cũ", () => {
  const storage = fakeStorage();
  saveCardLevel(storage, 5);
  assert.equal(loadCardLevel(storage), 5);
  saveCardLevel(storage, 1);
  assert.equal(loadCardLevel(storage), 1);
});

test("saveCardLevel: storage nổ thì nuốt lỗi, không làm sập app", () => {
  const boom = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.doesNotThrow(() => saveCardLevel(boom, 2));
});
