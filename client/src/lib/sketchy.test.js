import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFrom, amplitude, sketchyLine, sketchyPath } from "./sketchy.js";

// Đây là test QUAN TRỌNG NHẤT của module. Nếu nó đỏ thì độ lệch đang lấy từ
// Math.random(): mỗi khung hình nét lại rung một kiểu, và kéo một thẻ là cả bản
// đồ giật.
test("cùng seed ra cùng chuỗi, khác seed ra khác chuỗi", () => {
  const a = sketchyLine(0, 0, 100, 40, seedFrom(7));
  assert.equal(sketchyLine(0, 0, 100, 40, seedFrom(7)), a);
  assert.notEqual(sketchyLine(0, 0, 100, 40, seedFrom(8)), a);
});

test("sketchyPath cũng ổn định theo seed", () => {
  const a = sketchyPath("rect", [0, 0, 100, 60], 42);
  assert.equal(sketchyPath("rect", [0, 0, 100, 60], 42), a);
  assert.notEqual(sketchyPath("rect", [0, 0, 100, 60], 43), a);
});

test("seedFrom nhận cả số lẫn chuỗi, luôn ra số nguyên không âm", () => {
  for (const v of [0, 1, 999, "e12", "node:3", ""]) {
    const s = seedFrom(v);
    assert.equal(Number.isInteger(s), true, String(v));
    assert.equal(s >= 0, true, String(v));
  }
  assert.notEqual(seedFrom(1), seedFrom(2));
});

test("đoạn dài 0 trả chuỗi rỗng, không NaN", () => {
  assert.equal(sketchyLine(10, 10, 10, 10, 1), "");
  assert.equal(/NaN/.test(sketchyLine(0, 0, 300, 0, 5)), false);
});

test("biên độ có trần: dây rất dài không uốn thành con rắn", () => {
  assert.equal(amplitude(0), 0.6);
  assert.equal(amplitude(5000), 4);
  assert.equal(amplitude(100), 2);
});

// Vẽ hai lượt chồng nhau cho giống nét bút chì, nhưng nằm trong MỘT chuỗi d
// (hai đoạn con "M"), không phải hai thẻ <path>: 200 dây thì đó là 200 nút DOM
// chênh nhau.
test("mặc định hai lượt trong một chuỗi d", () => {
  const d = sketchyLine(0, 0, 100, 0, 3);
  assert.equal(d.split("M").length - 1, 2);
  assert.equal(sketchyLine(0, 0, 100, 0, 3, { passes: 1 }).split("M").length - 1, 1);
});

test("sketchyPath: sáu kind đều ra chuỗi d dùng được", () => {
  for (const k of ["rect", "ellipse", "line", "arrow", "triangle", "diamond"]) {
    const d = sketchyPath(k, [10, 20, 110, 90], seedFrom(k));
    assert.ok(d.length > 0, k);
    assert.equal(/NaN|undefined|Infinity/.test(d), false, k);
    assert.match(d, /^M/, k);
  }
});

test("sketchyPath: kind lạ hoặc pts thiếu → chuỗi rỗng, cùng cách shapePath", () => {
  assert.equal(sketchyPath("star", [0, 0, 10, 10], 1), "");
  assert.equal(sketchyPath("rect", [0, 0], 1), "");
  assert.equal(sketchyPath("pen", [0, 0, 10, 10], 1), "");
});

// Hình đóng phải khép: nếu thiếu Z thì hình tô đặc rò màu ra ngoài.
test("bốn hình đóng có Z, hai hình mở thì không", () => {
  for (const k of ["rect", "ellipse", "triangle", "diamond"]) {
    assert.match(sketchyPath(k, [0, 0, 80, 50], 9), /Z/, k);
  }
  for (const k of ["line", "arrow"]) {
    assert.equal(/Z/.test(sketchyPath(k, [0, 0, 80, 50], 9)), false, k);
  }
});

// Rung là chuyện hiển thị, không được kéo hình đi chỗ khác: mọi toạ độ sinh ra
// phải nằm quanh hộp gốc trong đúng biên độ (cộng chút dư cho điểm điều khiển
// bezier, vốn nằm ngoài đường cong).
test("nét rung bám sát hộp gốc, không trôi đi đâu", () => {
  const d = sketchyPath("rect", [0, 0, 100, 60], 11);
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) > -8 && Math.max(...xs) < 108, "x ngoài khung");
  assert.ok(Math.min(...ys) > -8 && Math.max(...ys) < 68, "y ngoài khung");
});

// Hai đầu dây phải gần như dính vào mép thẻ — lệch nhiều là nhìn ra ngay chỗ hở
// giữa đầu dây và viền thẻ.
test("hai đầu đoạn lệch ít hơn hẳn phần thân", () => {
  const d = sketchyLine(0, 0, 200, 0, 4, { passes: 1 });
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const startY = n[1], endY = n[7];
  const amp = amplitude(200);
  assert.ok(Math.abs(startY) <= amp * 0.5, `đầu lệch ${startY}`);
  assert.ok(Math.abs(endY) <= amp * 0.5, `cuối lệch ${endY}`);
});
