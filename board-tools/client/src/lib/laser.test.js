import test from "node:test";
import assert from "node:assert/strict";
import {
  LASER_FADE_MS, LASER_MAX_POINTS, LASER_MIN_DIST,
  pushLaserPoint, trimLaserTrail, laserOutline
} from "./laser.js";

test("pushLaserPoint: điểm đầu luôn vào", () => {
  const pts = pushLaserPoint([], 10, 20, 1000);
  assert.deepEqual(pts, [{ x: 10, y: 20, t: 1000 }]);
});

test("pushLaserPoint: điểm quá gần bị chối và trả về CHÍNH mảng cũ", () => {
  const a = pushLaserPoint([], 0, 0, 1000);
  const b = pushLaserPoint(a, LASER_MIN_DIST - 0.5, 0, 1010);
  // Phép so tham chiếu này là hợp đồng: useLaser dựa vào nó để biết có phát gói
  // lên mạng hay không. Trả một mảng mới có cùng nội dung sẽ làm vệt người khác
  // thấy dày điểm hơn vệt mình thấy.
  assert.equal(b, a);
});

test("pushLaserPoint: đi đủ xa thì điểm vào", () => {
  const a = pushLaserPoint([], 0, 0, 1000);
  const b = pushLaserPoint(a, LASER_MIN_DIST + 0.5, 0, 1010);
  assert.equal(b.length, 2);
});

test("pushLaserPoint: khoảng cách đo theo đường chéo, không theo từng trục", () => {
  const a = pushLaserPoint([], 0, 0, 1000);
  // Mỗi trục chỉ đi 1.5 (< LASER_MIN_DIST = 2) nhưng đường chéo là ~2.12 nên
  // điểm này phải được nhận. Đo từng trục sẽ chối oan.
  const b = pushLaserPoint(a, 1.5, 1.5, 1010);
  assert.equal(b.length, 2);
});

test("pushLaserPoint: vượt trần thì rụng từ ĐẦU mảng, giữ lại đuôi mới nhất", () => {
  let pts = [];
  for (let i = 0; i < LASER_MAX_POINTS + 10; i++) pts = pushLaserPoint(pts, i * 10, 0, 1000 + i);
  assert.equal(pts.length, LASER_MAX_POINTS);
  assert.equal(pts[pts.length - 1].t, 1000 + LASER_MAX_POINTS + 9);
});

test("trimLaserTrail: chưa điểm nào hết hạn thì trả về CHÍNH mảng cũ", () => {
  const pts = [{ x: 0, y: 0, t: 1000 }, { x: 5, y: 0, t: 1100 }];
  assert.equal(trimLaserTrail(pts, 1200), pts);
});

test("trimLaserTrail: điểm quá hạn rụng khỏi đuôi vệt", () => {
  const pts = [{ x: 0, y: 0, t: 1000 }, { x: 5, y: 0, t: 1500 }, { x: 9, y: 0, t: 1900 }];
  const kept = trimLaserTrail(pts, 1000 + LASER_FADE_MS + 1);
  assert.deepEqual(kept.map((p) => p.t), [1500, 1900]);
});

test("trimLaserTrail: hết hạn hết thì rỗng — đây là cách vệt tự biến mất", () => {
  const pts = [{ x: 0, y: 0, t: 1000 }, { x: 5, y: 0, t: 1010 }];
  assert.deepEqual(trimLaserTrail(pts, 1010 + LASER_FADE_MS + 1), []);
});

test("laserOutline: dưới 2 điểm thì không có hình", () => {
  assert.equal(laserOutline([], 6), "");
  assert.equal(laserOutline([{ x: 1, y: 1, t: 0 }], 6), "");
});

test("laserOutline: hình KÍN để tô, không phải đường để kẻ", () => {
  const d = laserOutline([{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 1 }, { x: 20, y: 0, t: 2 }], 6);
  assert.match(d, /^M/);
  assert.match(d, /Z$/);
});

test("laserOutline: thon dần — đuôi nhọn, đầu rộng đúng headW", () => {
  const headW = 6;
  const pts = [{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 1 }, { x: 20, y: 0, t: 2 }];
  const d = laserOutline(pts, headW);
  // Vệt nằm ngang nên pháp tuyến là trục y: đọc thẳng bề rộng ra khỏi chuỗi.
  const nums = d.slice(1, -1).split("L").map((s) => s.trim().split(" ").map(Number));
  const yAt = (x) => nums.filter((p) => p[0] === x).map((p) => p[1]);
  // Đuôi (x=0): hai mép trùng nhau ở đúng đường tâm → bề rộng 0.
  assert.deepEqual(yAt(0), [0, 0]);
  // Đầu (x=20): hai mép cách nhau đúng headW.
  const head = yAt(20).sort((a, b) => a - b);
  assert.equal(head[1] - head[0], headW);
});

test("laserOutline: hai điểm trùng nhau không làm hỏng chuỗi (gói từ mạng không được bảo đảm)", () => {
  const d = laserOutline([{ x: 5, y: 5, t: 0 }, { x: 5, y: 5, t: 1 }, { x: 30, y: 5, t: 2 }], 6);
  assert.doesNotMatch(d, /NaN/);
});
