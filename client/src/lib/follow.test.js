import { test } from "node:test";
import assert from "node:assert/strict";
import {
  viewToRect, fitRect, followCamera, isUsableView,
  viewSettled, shouldSnap, lerpView, stepFollow
} from "./follow.js";

// Cùng cặp giới hạn với MIN_SCALE/MAX_SCALE trong pages/IdeaMap.jsx.
const MIN = 0.3, MAX = 2.4;

test("viewToRect đảo đúng phép biến hình của .canvas", () => {
  // panX = -100, scale = 2 → điểm canvas ở góc trái trên màn hình là x = 50.
  const rect = viewToRect({ panX: -100, panY: -60, scale: 2, w: 800, h: 600 });
  assert.deepEqual(rect, { x: 50, y: 30, w: 400, h: 300 });
});

test("cùng cỡ màn hình thì khung nhìn trùng khít với người kia", () => {
  const peer = { panX: -320, panY: 140, scale: 1.25, w: 1440, h: 900 };
  const mine = followCamera(peer, { w: 1440, h: 900 }, MIN, MAX);
  assert.ok(Math.abs(mine.scale - peer.scale) < 1e-9, "scale phải y hệt");
  assert.ok(Math.abs(mine.panX - peer.panX) < 1e-9);
  assert.ok(Math.abs(mine.panY - peer.panY) < 1e-9);
});

// Đây là lý do tính năng này không thể chỉ copy panX/panY/scale.
test("màn hình mình nhỏ hơn thì thu nhỏ lại để vẫn thấy TRỌN cái họ thấy", () => {
  const peer = { panX: 0, panY: 0, scale: 1, w: 2560, h: 1440 };
  const mine = followCamera(peer, { w: 1280, h: 720 }, MIN, MAX);
  assert.equal(mine.scale, 0.5);
  // Vùng canvas mình thấy phải phủ trọn vùng họ thấy.
  const theirs = viewToRect(peer);
  const ours = viewToRect({ ...mine, w: 1280, h: 720 });
  assert.ok(ours.x <= theirs.x + 1e-9 && ours.y <= theirs.y + 1e-9);
  assert.ok(ours.x + ours.w >= theirs.x + theirs.w - 1e-9);
  assert.ok(ours.y + ours.h >= theirs.y + theirs.h - 1e-9);
});

// Màn hình khác TỈ LỆ (siêu rộng theo dọc), không chỉ khác kích thước: phải lấy
// min của hai tỉ lệ, lấy max là thấy thiếu mất chiều còn lại.
test("khác tỉ lệ khung thì thừa ra ngoài rìa, không bao giờ thiếu", () => {
  const peer = { panX: 0, panY: 0, scale: 1, w: 2000, h: 500 };
  const mine = followCamera(peer, { w: 1000, h: 1000 }, MIN, MAX);
  assert.equal(mine.scale, 0.5, "bị chặn bởi chiều rộng, không phải chiều cao");
  const ours = viewToRect({ ...mine, w: 1000, h: 1000 });
  assert.ok(ours.h > viewToRect(peer).h, "chiều dọc thấy thừa ra là đúng");
});

test("scale cần thiết vượt trần thì kẹp lại nhưng vẫn canh giữa", () => {
  const peer = { panX: 0, panY: 0, scale: 1, w: 100, h: 100 };
  const mine = followCamera(peer, { w: 1400, h: 900 }, MIN, MAX);
  assert.equal(mine.scale, MAX);
  // Tâm vùng họ thấy là (50, 50); nó phải rơi đúng giữa màn hình mình.
  assert.ok(Math.abs(50 * mine.scale + mine.panX - 700) < 1e-9);
  assert.ok(Math.abs(50 * mine.scale + mine.panY - 450) < 1e-9);
});

test("gói view hỏng bị chặn trước khi thành NaN trong transform", () => {
  assert.equal(isUsableView({ panX: 0, panY: 0, scale: 1, w: 800, h: 600 }), true);
  for (const bad of [
    null, undefined, {},
    { panX: 0, panY: 0, scale: 0, w: 800, h: 600 },
    { panX: NaN, panY: 0, scale: 1, w: 800, h: 600 },
    { panX: 0, panY: 0, scale: 1, w: 0, h: 600 }
  ]) {
    assert.equal(isUsableView(bad), false, JSON.stringify(bad));
  }
});

// Thu phóng là phép NHÂN. Nội suy tuyến tính từ 0.3 tới 2.4 thì nửa quãng đường
// đã ở 1.35 — tức đã phóng gấp 4.5 lần trong nửa thời gian rồi bò nốt phần còn
// lại. Trong log thì nửa quãng là trung bình nhân, mắt thấy đều tốc độ.
test("scale nội suy theo logarit, nửa quãng là trung bình nhân", () => {
  const mid = lerpView({ panX: 0, panY: 0, scale: 0.5 }, { panX: 0, panY: 0, scale: 2 }, 0.5);
  assert.ok(Math.abs(mid.scale - 1) < 1e-9, `nửa quãng phải là 1, đang là ${mid.scale}`);
});

test("nội suy pan tuyến tính và kẹp t vào [0,1]", () => {
  const a = { panX: 0, panY: 0, scale: 1 }, b = { panX: 100, panY: -50, scale: 1 };
  assert.equal(lerpView(a, b, 0.25).panX, 25);
  assert.equal(lerpView(a, b, 0.25).panY, -12.5);
  assert.equal(lerpView(a, b, 5).panX, 100, "t > 1 không được vọt quá đích");
  assert.equal(lerpView(a, b, -1).panX, 0);
});

test("dưới một pixel thì coi như tới đích, vòng lặp dừng", () => {
  const cur = { panX: 100, panY: 100, scale: 1 };
  assert.equal(viewSettled(cur, { panX: 100.2, panY: 100, scale: 1.001 }), true);
  assert.equal(viewSettled(cur, { panX: 105, panY: 100, scale: 1 }), false);
  assert.equal(stepFollow(cur, { panX: 100.2, panY: 100, scale: 1.001 }, 0.2), null);
});

// Người kia bấm "nhảy tới thẻ" ở góc kia board: bò mượt qua quãng đó vừa chóng
// mặt vừa tới nơi muộn hơn lời họ đang nói.
test("người kia nhảy xa hoặc đổi zoom lớn thì cắt thẳng, không nội suy", () => {
  const cur = { panX: 0, panY: 0, scale: 1 };
  assert.equal(shouldSnap(cur, { panX: 2000, panY: 0, scale: 1 }), true);
  assert.equal(shouldSnap(cur, { panX: 0, panY: 0, scale: 2.2 }), true);
  assert.equal(shouldSnap(cur, { panX: 0, panY: 0, scale: 0.4 }), true, "thu nhỏ mạnh cũng phải cắt");
  assert.equal(shouldSnap(cur, { panX: 60, panY: 40, scale: 1.1 }), false);
  assert.deepEqual(
    stepFollow(cur, { panX: 2000, panY: 0, scale: 1 }, 0.2),
    { panX: 2000, panY: 0, scale: 1 }
  );
});

// Vòng bám phải HỘI TỤ: mỗi nhịp lại lấy kết quả nhịp trước làm đầu vào, nên
// nếu phép nội suy có sai số tích luỹ thì camera rung mãi không đứng yên.
test("bám một đích đứng yên thì hội tụ và dừng hẳn", () => {
  const target = { panX: 240, panY: -130, scale: 1.6 };
  let cur = { panX: 0, panY: 0, scale: 1 };
  let steps = 0;
  for (; steps < 600; steps++) {
    const next = stepFollow(cur, target, 0.2);
    if (next === null) break;
    cur = next;
  }
  assert.ok(steps < 600, "không hội tụ sau 600 nhịp");
  assert.ok(viewSettled(cur, target), "dừng rồi mà vẫn chưa tới đích");
});
