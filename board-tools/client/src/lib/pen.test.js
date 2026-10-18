// game-tools/client/src/lib/pen.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PEN_COLORS, PEN_WIDTHS, PEN_DEFAULT, penVar, loadPenPrefs, savePenPrefs } from "./pen.js";

// localStorage giả: chỉ cần getItem/setItem, không cần cả Storage API.
function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test("PEN_DEFAULT phải nằm trong danh sách hợp lệ", () => {
  assert.ok(PEN_COLORS.includes(PEN_DEFAULT.color));
  assert.ok(PEN_WIDTHS.includes(PEN_DEFAULT.w));
  assert.equal(PEN_COLORS.length, 7);
  assert.deepEqual(PEN_WIDTHS, [2, 4, 8]);
});

test("penVar: token thành biến CSS", () => {
  assert.equal(penVar("pen-red"), "var(--pen-red)");
  assert.equal(penVar("pen-mono"), "var(--pen-mono)");
});

test("loadPenPrefs: chưa có khoá thì trả mặc định", () => {
  assert.deepEqual(loadPenPrefs(fakeStorage()), PEN_DEFAULT);
});

test("loadPenPrefs: JSON hỏng thì trả mặc định chứ không nổ", () => {
  assert.deepEqual(loadPenPrefs(fakeStorage({ "ideamap.pen": "{{{" })), PEN_DEFAULT);
});

// Token cũ bị bỏ khỏi bộ màu không được làm người dùng kẹt với một giá trị
// không còn vẽ ra màu gì.
test("loadPenPrefs: giá trị lạ lùi về mặc định theo từng phần", () => {
  const bothBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-neon", w: 999 }) });
  assert.deepEqual(loadPenPrefs(bothBad), PEN_DEFAULT);

  const onlyWidthBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 999 }) });
  assert.deepEqual(loadPenPrefs(onlyWidthBad), { color: "pen-blue", w: PEN_DEFAULT.w });
});

test("savePenPrefs rồi loadPenPrefs trả lại đúng giá trị", () => {
  const s = fakeStorage();
  savePenPrefs(s, { color: "pen-green", w: 8 });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-green", w: 8 });
});

// Hết quota hoặc chế độ riêng tư — mất lựa chọn bút không đáng làm sập app.
test("savePenPrefs: storage ném lỗi thì im lặng bỏ qua", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.doesNotThrow(() => savePenPrefs(broken, PEN_DEFAULT));
});
