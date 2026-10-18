import test from "node:test";
import assert from "node:assert/strict";
import {
  WHEEL_MODES, WHEEL_MODE_DEFAULT, loadWheelMode, saveWheelMode,
  deltaToPixels, zoomFactor, wheelDeviceVote, createWheelReader,
  createStillWatch, STILL_WINDOW_MS, STILL_TOL
} from "./pointer-input.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    map
  };
}

// Một cú lăn chuột: Chrome/Edge báo theo pixel, một nấc 100px, không có trục ngang.
function mouseWheel(dy, ts) {
  return { deltaX: 0, deltaY: dy, deltaMode: 0, ctrlKey: false, shiftKey: false, timeStamp: ts };
}
// Một nhịp trượt hai ngón: bước nhỏ, dày, thường có cả trục ngang.
function padScroll(dx, dy, ts) {
  return { deltaX: dx, deltaY: dy, deltaMode: 0, ctrlKey: false, shiftKey: false, timeStamp: ts };
}

test("loadWheelMode: chưa lưu gì → auto", () => {
  assert.equal(loadWheelMode(fakeStorage()), WHEEL_MODE_DEFAULT);
  assert.equal(WHEEL_MODE_DEFAULT, "auto");
});

test("loadWheelMode: giá trị lạ trong localStorage → về auto", () => {
  assert.equal(loadWheelMode(fakeStorage({ "ideamap.wheel": "rotate" })), "auto");
});

test("loadWheelMode: đọc lại đúng giá trị đã lưu", () => {
  const s = fakeStorage();
  saveWheelMode(s, "pan");
  assert.equal(loadWheelMode(s), "pan");
});

test("saveWheelMode: giá trị lạ bị quy về auto chứ không ghi vào ô", () => {
  const s = fakeStorage();
  saveWheelMode(s, "nonsense");
  assert.equal(loadWheelMode(s), "auto");
});

test("saveWheelMode: localStorage hỏng không làm nổ", () => {
  const s = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.doesNotThrow(() => saveWheelMode(s, "zoom"));
});

test("WHEEL_MODES đúng ba lựa chọn của panel Giao diện", () => {
  assert.deepEqual(WHEEL_MODES, ["auto", "pan", "zoom"]);
});

test("deltaToPixels: Firefox báo theo DÒNG được quy về pixel", () => {
  assert.equal(deltaToPixels(3, 1), 48);
  assert.equal(deltaToPixels(-3, 1), -48);
});

test("deltaToPixels: theo TRANG cũng quy về pixel, theo pixel thì giữ nguyên", () => {
  assert.equal(deltaToPixels(1, 2), 400);
  assert.equal(deltaToPixels(100, 0), 100);
});

test("deltaToPixels: giá trị không phải số → 0, không lan NaN vào camera", () => {
  assert.equal(deltaToPixels(undefined, 0), 0);
  assert.equal(deltaToPixels(NaN, 0), 0);
});

test("zoomFactor: cuộn lên thì phóng to, cuộn xuống thì thu nhỏ", () => {
  assert.ok(zoomFactor(-100, 0.0015) > 1);
  assert.ok(zoomFactor(100, 0.0015) < 1);
});

test("zoomFactor: một cú fling khổng lồ bị kẹp, không nhảy thẳng xuống đáy", () => {
  assert.ok(zoomFactor(5000, 0.0015) >= 0.75);
  assert.ok(zoomFactor(-5000, 0.0015) <= 1.25);
});

test("wheelDeviceVote: báo theo DÒNG là dấu hiệu chắc nhất của nút lăn", () => {
  assert.ok(wheelDeviceVote({ deltaX: 0, deltaY: 3, deltaMode: 1 }, null) < 0);
});

test("wheelDeviceVote: một nấc 100px là nút lăn", () => {
  assert.ok(wheelDeviceVote(mouseWheel(100), null) < 0);
});

test("wheelDeviceVote: số lẻ chỉ có ở touchpad chính xác", () => {
  assert.ok(wheelDeviceVote(padScroll(0, 3.5), null) > 0);
});

test("wheelDeviceVote: có trục ngang là hai ngón, nút lăn không đi chéo", () => {
  assert.ok(wheelDeviceVote(padScroll(12, 4), null) > 0);
});

test("wheelDeviceVote: sự kiện dày sát nhau là ngón đang trượt", () => {
  assert.ok(wheelDeviceVote(padScroll(0, 40), 8) > 0);
});

test("auto + lăn chuột → thu phóng (giữ nguyên hành vi cũ)", () => {
  const r = createWheelReader();
  const got = r.read(mouseWheel(-100, 1000), "auto");
  assert.equal(got.intent, "zoom");
  assert.ok(got.factor > 1);
  assert.equal(r.device(), "mouse");
});

test("auto + trượt hai ngón → lia bảng, đi cả hai trục", () => {
  const r = createWheelReader();
  let got = r.read(padScroll(6, 12, 100), "auto");
  got = r.read(padScroll(7, 14, 112), "auto");
  assert.equal(r.device(), "touchpad");
  assert.equal(got.intent, "pan");
  assert.equal(got.dx, 7);
  assert.equal(got.dy, 14);
});

test("pinch hai ngón (ctrl+wheel) luôn là thu phóng, kể cả khi chọn mode pan", () => {
  const r = createWheelReader();
  const got = r.read({ deltaX: 0, deltaY: -8, deltaMode: 0, ctrlKey: true, shiftKey: false, timeStamp: 5 }, "pan");
  assert.equal(got.intent, "zoom");
  assert.equal(got.pinch, true);
  assert.ok(got.factor > 1);
});

test("pinch nhỏ vẫn phóng thấy được — hệ số riêng, không dùng hệ số của nút lăn", () => {
  const r = createWheelReader();
  const pinch = r.read({ deltaX: 0, deltaY: -10, deltaMode: 0, ctrlKey: true, shiftKey: false, timeStamp: 5 }, "auto");
  // 0.0015 là hệ số của nút lăn: với dy 10px nó cho ra 1.015, tức gần như không
  // nhúc nhích. Pinch phải mạnh hơn hẳn thế.
  assert.ok(pinch.factor > zoomFactor(-10, 0.0015) * 1.05, `pinch = ${pinch.factor}`);
});

test("Shift+cuộn là lia, kể cả khi chọn mode zoom", () => {
  const r = createWheelReader();
  const got = r.read({ deltaX: 0, deltaY: 90, deltaMode: 0, ctrlKey: false, shiftKey: true, timeStamp: 5 }, "zoom");
  assert.equal(got.intent, "pan");
  assert.equal(got.dy, 90);
});

test("mode pan: nút lăn cũng lia — người dùng chọn tay thì thắng bộ nhận dạng", () => {
  const r = createWheelReader();
  assert.equal(r.read(mouseWheel(100, 5), "pan").intent, "pan");
});

test("mode zoom: trượt hai ngón cũng phóng, và phóng bằng hệ số của touchpad", () => {
  const r = createWheelReader();
  r.read(padScroll(3, 4.5, 100), "zoom");
  const got = r.read(padScroll(3, -4.5, 108), "zoom");
  assert.equal(r.device(), "touchpad");
  assert.equal(got.intent, "zoom");
  // Cùng dy nhưng hệ số touchpad phải mạnh hơn hệ số nút lăn, không thì trượt
  // cả buổi mà bảng không nhúc nhích.
  assert.ok(got.factor > zoomFactor(-4.5, 0.0015), `factor = ${got.factor}`);
});

test("đang là touchpad rồi cắm chuột lăn: vài nấc là lật lại được", () => {
  const r = createWheelReader();
  for (let i = 0; i < 10; i++) r.read(padScroll(4, 8, 100 + i * 10), "auto");
  assert.equal(r.device(), "touchpad");
  for (let i = 0; i < 4; i++) r.read(mouseWheel(100, 2000 + i * 300), "auto");
  assert.equal(r.device(), "mouse");
  assert.equal(r.read(mouseWheel(-100, 4000), "auto").intent, "zoom");
});

// ── createStillWatch: tay đang đi hay đang đứng ──────────────────────────────
//
// Mọi test dưới đây bắn nhịp chuột 60Hz như trình duyệt thật, và toạ độ được
// LÀM TRÒN về pixel nguyên đúng như clientX/clientY — cái làm tròn đó là một
// phần của bài toán, bỏ nó đi thì test dễ hơn thực tế.
const FRAME = 1000 / 60;

// Chạy `ms` mili-giây với vận tốc (vx,vy) px/giây cộng rung tay biên độ `tremor`.
// Trả về số nhịp bị đọc thành "đang đi".
function drive(watch, ms, vx, vy, tremor, t0 = 0, x0 = 0, y0 = 0) {
  let moving = 0, t = t0, last = null;
  // Rung tay giả lập bằng chuỗi tuần hoàn cố định: test phải chạy lại ra y hệt,
  // mà Math.random thì không.
  const wob = [0.9, -0.7, 0.4, -1.0, 0.6, -0.3, 1.0, -0.8, 0.2, -0.6];
  for (let i = 0; i * FRAME <= ms; i++) {
    t = t0 + i * FRAME;
    const s = (t - t0) / 1000;
    const x = Math.round(x0 + vx * s + wob[i % wob.length] * tremor);
    const y = Math.round(y0 + vy * s + wob[(i + 5) % wob.length] * tremor);
    if (watch.moving(t, x, y)) moving++;
    last = { t, x, y };
  }
  return { moving, last };
}

test("đứng yên hoàn toàn: không nhịp nào bị đọc thành đang đi", () => {
  const w = createStillWatch();
  const { moving } = drive(w, 2000, 0, 0, 0);
  assert.equal(moving, 0);
});

test("rung tay mạnh tại chỗ vẫn là đứng yên", () => {
  const w = createStillWatch();
  // Rung ±2px mỗi khung là mức của bàn tay run trên touchpad.
  const { moving } = drive(w, 2000, 0, 0, 2);
  assert.equal(moving, 0);
});

// ĐÂY LÀ LỖI ĐÃ GẶP, viết thành test. Bàn tay tì trên chuột trượt đều chừng
// 8–25 px/giây; luật cũ (khoảng cách tới một mốc cứng 6px) cộng dồn cái trôi đó
// nên đồng hồ chờ về 0 liên tục và cử chỉ giữ tay KHÔNG BAO GIỜ nổ.
for (const drift of [8, 16, 25]) {
  test(`trôi tay ${drift} px/giây vẫn phải là đứng yên — mốc cứng 6px chết ở đây`, () => {
    const w = createStillWatch();
    const { moving } = drive(w, 2000, drift, 0, 1.2);
    assert.equal(moving, 0, `${moving} nhịp bị đọc nhầm thành đang đi`);
  });
}

test("vẽ thật thì mọi nhịp đều là đang đi", () => {
  const w = createStillWatch();
  // 120 px/giây là tốc độ vẽ bình thường. Bỏ qua đúng cửa sổ đầu, lúc bộ đệm
  // chưa đủ dài để đo được gì.
  const w2 = createStillWatch();
  drive(w2, STILL_WINDOW_MS, 120, 0, 1);
  const { moving } = drive(w, 1500, 120, 0, 1);
  assert.ok(moving > 60, `chỉ ${moving} nhịp được đọc là đang đi`);
});

test("vẽ chậm 45 px/giây vẫn là đang đi — không được cướp nét đang vẽ", () => {
  const w = createStillWatch();
  const { moving } = drive(w, 2000, 45, 0, 1.2);
  assert.ok(moving > 50, `chỉ ${moving} nhịp được đọc là đang đi`);
});

test("vẽ xong rồi dừng: chuyển sang đứng yên trong vòng một cửa sổ", () => {
  const w = createStillWatch();
  const { last } = drive(w, 1000, 150, 0, 1);
  // Cái đuôi của nét vừa vẽ còn nằm trong cửa sổ nên khoảng một cửa sổ đầu vẫn
  // đọc ra "đang đi" — đúng như thiết kế, và đó chính là khoản độ trễ mà
  // SNAP_HOLD_MS đã trừ đi. Điều phải bảo đảm là sau đó nó DỪNG HẲN.
  const tail = drive(w, STILL_WINDOW_MS, 10, 0, 1.2, last.t + FRAME, last.x, last.y);
  const settled = drive(w, 1500, 10, 0, 1.2, tail.last.t + FRAME, tail.last.x, tail.last.y);
  assert.equal(settled.moving, 0, "vẫn còn nhịp bị đọc thành đang đi sau khi tay đã dừng");
  // và phải dừng trong vòng một cửa sổ, không lâu hơn
  const w3 = createStillWatch();
  const r3 = drive(w3, 1000, 150, 0, 1);
  let firstStill = null, t = r3.last.t;
  for (let i = 1; i * FRAME < STILL_WINDOW_MS * 2; i++) {
    t = r3.last.t + i * FRAME;
    if (!w3.moving(t, r3.last.x, r3.last.y) && firstStill === null) firstStill = t - r3.last.t;
  }
  assert.ok(firstStill !== null && firstStill <= STILL_WINDOW_MS + FRAME * 2,
    `mất ${firstStill}ms mới nhận ra tay đã dừng`);
});

test("hai nhịp cách nhau rất xa mà nhảy xa: vẫn phải là đang đi", () => {
  // Con trỏ rời cửa sổ rồi quay lại chỗ khác. Cắt bộ đệm sạch tới mép cửa sổ thì
  // chỉ còn một mẫu, độ dời bằng 0, và cú nhảy bị đọc thành "đứng yên".
  const w = createStillWatch();
  w.moving(0, 100, 100);
  assert.equal(w.moving(3000, 100 + STILL_TOL * 5, 100), true);
});
