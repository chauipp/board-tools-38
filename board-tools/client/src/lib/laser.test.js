import test from "node:test";
import assert from "node:assert/strict";
import {
  LASER_FADE_DEFAULT, LASER_FADE_MIN, LASER_FADE_MAX, LASER_FADE_STEP,
  LASER_MAX_POINTS, LASER_MIN_DIST, LASER_WIDTHS, LASER_DEFAULT,
  pushLaserPoint, trimLaserTrail, laserOutline,
  loadLaserPrefs, saveLaserPrefs, sanitizeLaserStyle, sanitizeLaserFade
} from "./laser.js";
import { PEN_COLORS, PEN_WIDTHS } from "./pen.js";

// localStorage giả — cùng khuôn với các test khác trong thư mục này.
function fakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map)
  };
}

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
  const kept = trimLaserTrail(pts, 1000 + LASER_FADE_DEFAULT + 1);
  assert.deepEqual(kept.map((p) => p.t), [1500, 1900]);
});

test("trimLaserTrail: hết hạn hết thì rỗng — đây là cách vệt tự biến mất", () => {
  const pts = [{ x: 0, y: 0, t: 1000 }, { x: 5, y: 0, t: 1010 }];
  assert.deepEqual(trimLaserTrail(pts, 1010 + LASER_FADE_DEFAULT + 1), []);
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

test("laserOutline: độ đậm khác nhau ra bề rộng khác nhau", () => {
  const pts = [{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 1 }, { x: 20, y: 0, t: 2 }];
  assert.notEqual(laserOutline(pts, LASER_WIDTHS[0]), laserOutline(pts, LASER_WIDTHS[2]));
});

// ── Kiểu vệt: màu + độ đậm ──────────────────────────────────────────────────

test("độ đậm laser là bảng RIÊNG, không dùng lại PEN_WIDTHS", () => {
  // Đơn vị khác nhau: laser là pixel màn hình, bút là đơn vị canvas. Dùng chung
  // bảng là sớm muộn cũng có người gom hai `w` vào một ô.
  assert.notDeepEqual(LASER_WIDTHS, PEN_WIDTHS);
  assert.ok(LASER_WIDTHS.includes(LASER_DEFAULT.w));
  assert.ok(PEN_COLORS.includes(LASER_DEFAULT.color));
});

test("loadLaserPrefs: chưa lưu gì thì về mặc định", () => {
  assert.deepEqual(loadLaserPrefs(fakeStorage()), LASER_DEFAULT);
});

test("loadLaserPrefs: JSON hỏng không làm sập, về mặc định", () => {
  assert.deepEqual(loadLaserPrefs(fakeStorage({ "ideamap.laser": "{{{" })), LASER_DEFAULT);
});

test("loadLaserPrefs: một giá trị hỏng không kéo theo giá trị còn lại", () => {
  const s = fakeStorage({ "ideamap.laser": JSON.stringify({ color: "pen-blue", w: 999 }) });
  assert.deepEqual(loadLaserPrefs(s), { color: "pen-blue", w: LASER_DEFAULT.w, fade: LASER_FADE_DEFAULT });
});

test("saveLaserPrefs → loadLaserPrefs giữ nguyên lựa chọn", () => {
  const s = fakeStorage();
  saveLaserPrefs(s, { color: "pen-green", w: LASER_WIDTHS[2], fade: 2500 });
  assert.deepEqual(loadLaserPrefs(s), { color: "pen-green", w: LASER_WIDTHS[2], fade: 2500 });
});

test("laser và bút lưu ở HAI khoá khác nhau", () => {
  const s = fakeStorage();
  saveLaserPrefs(s, { color: "pen-blue", w: LASER_WIDTHS[0], fade: LASER_FADE_DEFAULT });
  // Nếu hai thứ dùng chung khoá thì đổi độ đậm laser sẽ đổi luôn độ dày nét bút.
  assert.deepEqual(Object.keys(s.dump()), ["ideamap.laser"]);
});

test("sanitizeLaserStyle: gói từ mạng mang token màu lạ → về mặc định", () => {
  // Không lọc thì vệt thành var(--gì-đó) không tồn tại, tức mất màu hẳn.
  assert.deepEqual(sanitizeLaserStyle("red; }", 8, LASER_FADE_DEFAULT), LASER_DEFAULT);
});

test("sanitizeLaserStyle: gói từ mạng mang w ngoài bảng → về mặc định", () => {
  // Server chỉ chặn được biên độ 1..64; w = 63 lọt qua đó nhưng sẽ là một vệt
  // phủ ngang màn hình mọi người.
  assert.equal(sanitizeLaserStyle("pen-blue", 63).w, LASER_DEFAULT.w);
  assert.equal(sanitizeLaserStyle("pen-blue", 63).color, "pen-blue");
});

test("sanitizeLaserStyle: giá trị hợp lệ đi qua nguyên vẹn", () => {
  assert.deepEqual(
    sanitizeLaserStyle("pen-purple", LASER_WIDTHS[2], 1500),
    { color: "pen-purple", w: LASER_WIDTHS[2], fade: 1500 }
  );
});

// ── Thời gian tan: một DẢI liên tục, không phải một bảng giá trị ─────────────

test("sanitizeLaserFade: kẹp vào biên độ", () => {
  assert.equal(sanitizeLaserFade(10), LASER_FADE_MIN);
  assert.equal(sanitizeLaserFade(999999), LASER_FADE_MAX);
});

test("sanitizeLaserFade: làm tròn về bước của thanh trượt", () => {
  assert.equal(sanitizeLaserFade(1234), 1200);
  assert.equal(sanitizeLaserFade(1250), 1300);
  assert.equal(sanitizeLaserFade(LASER_FADE_DEFAULT) % LASER_FADE_STEP, 0);
});

test("sanitizeLaserFade: số rác / thiếu field → về mặc định", () => {
  // Client bản cũ không gửi field này; chặn gói thì vệt của họ mất hẳn với cả
  // phòng, nên phải lùi về mặc định.
  assert.equal(sanitizeLaserFade(undefined), LASER_FADE_DEFAULT);
  assert.equal(sanitizeLaserFade(NaN), LASER_FADE_DEFAULT);
  assert.equal(sanitizeLaserFade("2000"), LASER_FADE_DEFAULT);
});

test("trimLaserTrail: fade của TỪNG vệt quyết định, không phải một hằng số chung", () => {
  const pts = [{ x: 0, y: 0, t: 1000 }, { x: 5, y: 0, t: 1000 }];
  // Cùng một vệt, cùng một mốc `now`: vệt đặt 400ms đã tan, vệt đặt 3000ms chưa.
  assert.deepEqual(trimLaserTrail(pts, 1500, 400), []);
  assert.equal(trimLaserTrail(pts, 1500, 3000), pts);
});
