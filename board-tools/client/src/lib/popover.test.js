// board-tools/client/src/lib/popover.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampPopover, POPOVER_MARGIN as M } from "./popover.js";

// Màn hình 1000x800, popover 220x300 — cỡ thật của .badge-editor.
const VIEW = { vw: 1000, vh: 800 };
const SIZE = { w: 220, h: 300 };
const at = (x, y, extra) => clampPopover({ x, y, ...SIZE, ...VIEW, ...extra });

test("còn chỗ thì mở đúng ngay chỗ bấm", () => {
  assert.deepEqual(at(100, 120), { left: 100, top: 120 });
});

test("sát mép phải: lật sang TRÁI con trỏ, không tràn ra ngoài", () => {
  const p = at(950, 120);
  assert.equal(p.left, 950 - 220);
  assert.ok(p.left + 220 <= 1000 - M);
});

test("sát mép dưới: lật LÊN TRÊN con trỏ", () => {
  const p = at(100, 760);
  assert.equal(p.top, 760 - 300);
});

test("góc dưới-phải: lật cả hai trục cùng lúc", () => {
  const p = at(980, 780);
  assert.deepEqual(p, { left: 760, top: 480 });
});

test("bấm sát mép trái/trên vẫn chừa lề, không dính 0", () => {
  const p = at(1, 2);
  assert.equal(p.left, M);
  assert.equal(p.top, M);
});

test("lật xong vẫn lọt ra ngoài thì dán vào mép cuối", () => {
  // Màn hình hẹp 300, menu rộng 220: mở sang phải thì tràn, lật sang trái thì âm.
  // Vẫn phải nằm trọn trong màn hình, dán sát mép phải.
  const p = clampPopover({ x: 100, y: 20, w: 220, h: 100, vw: 300, vh: 800 });
  assert.equal(p.left, 300 - M - 220);
  assert.ok(p.left >= M);
});

test("lật sang phía kia mà vừa thì lật, không dán mép", () => {
  const p = clampPopover({ x: 250, y: 20, w: 220, h: 100, vw: 300, vh: 800 });
  assert.equal(p.left, 30, "250 - 220 = 30, vẫn nằm trong lề nên giữ nguyên chỗ lật");
});

test("popover to hơn cả màn hình: dán mép đầu để không mất phần đầu", () => {
  const p = clampPopover({ x: 500, y: 400, w: 220, h: 900, vw: 1000, vh: 800 });
  assert.equal(p.top, M, "phải thấy được đỉnh menu, phần dư để menu tự cuộn");
});

test("lề đổi được, và luôn được tôn trọng ở cả hai đầu", () => {
  const p = clampPopover({ x: 990, y: 795, w: 220, h: 300, vw: 1000, vh: 800, margin: 20 });
  assert.equal(p.left, 990 - 220);
  assert.equal(p.top, 795 - 300);
  const q = clampPopover({ x: 0, y: 0, w: 220, h: 300, vw: 1000, vh: 800, margin: 20 });
  assert.deepEqual(q, { left: 20, top: 20 });
});

test("trả về số nguyên — left/top đi thẳng vào style, tránh nửa pixel", () => {
  const p = clampPopover({ x: 10.4, y: 20.6, w: 100.3, h: 50.7, vw: 1000, vh: 800 });
  assert.equal(p.left, Math.round(p.left));
  assert.equal(p.top, Math.round(p.top));
});
