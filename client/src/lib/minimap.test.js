import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINI_NODE_H, rectsOf, boundsOf, viewRect, unionRect,
  fitTransform, toMini, toCanvas, panForCenter
} from "./minimap.js";
import { drawingBox } from "./shape.js";

const BOARD = {
  nodes: [{ id: 1, x: 0, y: 0, color: "dot-1" }, { id: 2, x: 400, y: 200, w: 300 }],
  groups: [{ id: 5, x: -100, y: -50, w: 200, h: 150 }],
  drawings: [{ id: 9, w: 4, pts: [800, 600, 900, 700] }]
};

test("rectsOf: thẻ dùng bề rộng đã lưu, thiếu thì lấy mặc định; cao là trị danh nghĩa", () => {
  const { nodes } = rectsOf(BOARD, 210, drawingBox);
  assert.deepEqual(nodes[0], { id: 1, x: 0, y: 0, w: 210, h: MINI_NODE_H, color: "dot-1" });
  assert.equal(nodes[1].w, 300, "thẻ có w riêng phải giữ w đó");
  assert.equal(nodes[1].color, null);
});

test("rectsOf: khung giữ nguyên kích thước thật, nét vẽ lấy hộp bao", () => {
  const { groups, inks } = rectsOf(BOARD, 210, drawingBox);
  assert.deepEqual(groups[0], { id: 5, x: -100, y: -50, w: 200, h: 150, color: null });
  assert.deepEqual(inks[0], { id: 9, x: 798, y: 598, w: 104, h: 104 });
});

test("rectsOf: board thiếu mảng nào cũng không nổ", () => {
  const out = rectsOf({}, 210, drawingBox);
  assert.deepEqual(out, { nodes: [], groups: [], inks: [] });
});

test("boundsOf: ôm hết mọi danh sách, kể cả toạ độ âm", () => {
  const { nodes, groups, inks } = rectsOf(BOARD, 210, drawingBox);
  assert.deepEqual(boundsOf([groups, nodes, inks]), { x: -100, y: -50, w: 1002, h: 752 });
});

test("boundsOf: không có gì thì trả null, không trả hộp rỗng", () => {
  assert.equal(boundsOf([[], []]), null);
});

test("viewRect: đổi camera thành vùng canvas đang nhìn thấy", () => {
  // pan (-100,-50) ở zoom 2 nghĩa là góc trên trái khung nhìn đang ở (50,25).
  assert.deepEqual(
    viewRect({ panX: -100, panY: -50, scale: 2 }, { w: 800, h: 600 }),
    { x: 50, y: 25, w: 400, h: 300 }
  );
});

test("unionRect: gộp hai hộp, bên nào null thì trả bên kia", () => {
  const a = { x: 0, y: 0, w: 100, h: 100 };
  const b = { x: 50, y: -20, w: 100, h: 40 };
  assert.deepEqual(unionRect(a, b), { x: 0, y: -20, w: 150, h: 120 });
  assert.deepEqual(unionRect(null, b), b);
  assert.deepEqual(unionRect(a, null), a);
});

test("fitTransform: co vừa khung theo chiều CHẬT hơn, giữ tỉ lệ", () => {
  // Vùng 1000×200 vào khung 176×120 (chừa 6 mỗi bên → 164×108): chật theo chiều
  // ngang, nên scale = 164/1000.
  const t = fitTransform({ x: 0, y: 0, w: 1000, h: 200 }, { w: 176, h: 120 });
  assert.equal(t.scale, 0.164);
  const a = toMini(0, 0, t), b = toMini(1000, 200, t);
  assert.ok(a.x >= 6 && b.x <= 170, `x phải nằm trong khung: ${a.x}..${b.x}`);
  assert.ok(a.y >= 6 && b.y <= 114, `y phải nằm trong khung: ${a.y}..${b.y}`);
});

test("fitTransform: nội dung được căn GIỮA khung theo chiều còn dư", () => {
  const t = fitTransform({ x: 0, y: 0, w: 1000, h: 200 }, { w: 176, h: 120 });
  const top = toMini(0, 0, t).y, bottom = 120 - toMini(0, 200, t).y;
  assert.ok(Math.abs(top - bottom) < 0.001, `lề trên ${top} phải bằng lề dưới ${bottom}`);
});

test("fitTransform: vùng suy biến (một điểm) không chia cho 0", () => {
  const t = fitTransform({ x: 5, y: 5, w: 0, h: 0 }, { w: 176, h: 120 });
  assert.ok(Number.isFinite(t.scale) && t.scale > 0);
  assert.ok(Number.isFinite(toMini(5, 5, t).x));
});

test("toCanvas là phép nghịch của toMini", () => {
  const t = fitTransform({ x: -300, y: 40, w: 900, h: 500 }, { w: 176, h: 120 });
  const p = toMini(120, 260, t);
  const back = toCanvas(p.x, p.y, t);
  assert.ok(Math.abs(back.x - 120) < 1e-9 && Math.abs(back.y - 260) < 1e-9);
});

test("panForCenter: điểm được bấm rơi đúng vào giữa khung nhìn", () => {
  const view = { panX: 0, panY: 0, scale: 1.5 };
  const size = { w: 800, h: 600 };
  const pan = panForCenter({ x: 1000, y: 500 }, view, size);
  // Áp pan mới rồi soi lại: tâm vùng nhìn phải là đúng điểm đó.
  const seen = viewRect({ ...view, ...pan }, size);
  assert.ok(Math.abs(seen.x + seen.w / 2 - 1000) < 1e-9);
  assert.ok(Math.abs(seen.y + seen.h / 2 - 500) < 1e-9);
});

test("panForCenter: không đụng tới mức phóng", () => {
  const pan = panForCenter({ x: 10, y: 10 }, { panX: 3, panY: 4, scale: 2 }, { w: 100, h: 100 });
  assert.deepEqual(Object.keys(pan).sort(), ["panX", "panY"]);
});
