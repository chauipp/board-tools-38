import { test } from "node:test";
import assert from "node:assert/strict";
import { snapToEdges, snapPanel, loadLayouts, saveLayouts, DEFAULT_LAYOUTS } from "./dock.js";

const PANEL = { w: 200, h: 40 };
const VW = 1000, VH = 800;
// Vùng vẽ: cả cửa sổ trong test cũ, để kỳ vọng cũ giữ nguyên.
const FULL = { x: 0, y: 0, w: VW, h: VH };
// Vùng vẽ thật: nằm dưới thanh trên + bar, cao 800 - 149.
const CANVAS = { x: 0, y: 149, w: VW, h: VH - 149 };
// Panel neo: trải hết chiều ngang bar, nằm ngay dưới topbar.
const DOCKED = { x: 16, y: 120, w: 968, h: 40 };

test("giữa khung nhìn thì không hút đi đâu", () => {
  assert.deepEqual(snapToEdges(400, 300, 200, 100, FULL), { x: 400, y: 300 });
});

test("gần mép thì hút vào mép", () => {
  assert.deepEqual(snapToEdges(20, 300, 200, 100, FULL), { x: 8, y: 300 });   // trái
  assert.deepEqual(snapToEdges(780, 300, 200, 100, FULL), { x: 792, y: 300 }); // phải
  assert.deepEqual(snapToEdges(400, 20, 200, 100, FULL), { x: 400, y: 8 });   // trên
  assert.deepEqual(snapToEdges(400, 680, 200, 100, FULL), { x: 400, y: 692 }); // dưới
});

test("ngoài ngưỡng hút thì đứng yên", () => {
  // 40px cách mép, ngưỡng 24 → không hút
  assert.deepEqual(snapToEdges(48, 300, 200, 100, FULL), { x: 48, y: 300 });
});

test("thả ra ngoài khung nhìn thì bị kéo về trong — panel không được mất", () => {
  assert.deepEqual(snapToEdges(-500, -500, 200, 100, FULL), { x: 8, y: 8 });
  assert.deepEqual(snapToEdges(9999, 9999, 200, 100, FULL), { x: 792, y: 692 });
});

test("panel rộng hơn khung nhìn vẫn nằm ở lề, không ra số âm", () => {
  assert.deepEqual(snapToEdges(300, 300, 1200, 900, FULL), { x: 8, y: 8 });
});

test("căn mép trên theo panel khác khi lệch trong ngưỡng", () => {
  // lệch 6px: cặp trên-trên (120↔126) là ứng viên gần nhất
  const r = snapPanel(500, 126, PANEL.w, PANEL.h, FULL, [DOCKED]);
  assert.equal(r.y, 120);
  assert.equal(r.guides.some((g) => g.axis === "h" && g.pos === 120), true);
});

test("chọn cặp mốc lệch ít nhất, không cố định phải là trên-trên", () => {
  // y=132: trên↔giữa (140-132) và giữa↔dưới đều lệch 8, gần hơn trên↔trên (12)
  assert.equal(snapPanel(500, 132, PANEL.w, PANEL.h, FULL, [DOCKED]).y, 140);
});

test("căn mép trái theo panel khác", () => {
  const r = snapPanel(30, 400, PANEL.w, PANEL.h, FULL, [DOCKED]);
  assert.equal(r.x, 16);
});

test("căn hàng thắng hút mép: đã thẳng hàng ở gần mép thì không bị mép giật đi", () => {
  // DOCKED.x = 16, cách mép trái 8px chỉ 8px → nằm trong ngưỡng hút mép.
  // Hút mép sẽ kéo về 8; căn hàng phải kéo trở lại 16.
  const r = snapPanel(18, 400, PANEL.w, PANEL.h, FULL, [DOCKED]);
  assert.equal(r.x, 16);
  // và khi đã đúng 16 rồi thì đứng yên, không bị mép nuốt
  assert.equal(snapPanel(16, 400, PANEL.w, PANEL.h, FULL, [DOCKED]).x, 16);
});

test("ngoài ngưỡng thì không căn, mép vẫn hút như trước", () => {
  const r = snapPanel(500, 400, PANEL.w, PANEL.h, FULL, [DOCKED]);
  assert.deepEqual({ x: r.x, y: r.y }, { x: 500, y: 400 });
  assert.deepEqual(r.guides, []);
  assert.equal(snapPanel(500, 10, PANEL.w, PANEL.h, FULL, []).y, 8);
});

test("không có panel nào khác → hành xử y như snapToEdges", () => {
  const r = snapPanel(20, 300, PANEL.w, PANEL.h, FULL, []);
  assert.deepEqual({ x: r.x, y: r.y }, snapToEdges(20, 300, PANEL.w, PANEL.h, FULL));
});

test("căn hàng không đẩy được panel ra ngoài khung nhìn", () => {
  const far = { x: 980, y: 400, w: 200, h: 40 };
  const r = snapPanel(970, 400, PANEL.w, PANEL.h, FULL, [far]);
  assert.equal(r.x + PANEL.w <= VW, true);
});

test("panel nổi không lấn được vào dải bar — kéo lên trên thì dính mép trên vùng vẽ", () => {
  // Bar chiếm 0..149. Kéo panel lên y = 20 (giữa bar) và lên hẳn y = -300.
  assert.equal(snapToEdges(400, 20, PANEL.w, PANEL.h, CANVAS).y, CANVAS.y + 8);
  assert.equal(snapToEdges(400, -300, PANEL.w, PANEL.h, CANVAS).y, CANVAS.y + 8);
  // và mép trên panel vẫn nằm dưới đáy bar
  assert.equal(snapToEdges(400, 20, PANEL.w, PANEL.h, CANVAS).y >= CANVAS.y, true);
});

test("căn hàng cũng không kéo được panel vào dải bar", () => {
  // DOCKED nằm trong bar (y 120..160). Mốc y của nó ở ngay trên mép vùng vẽ, nhưng
  // kẹp phải thắng: panel không được đi lên theo.
  const r = snapPanel(400, CANVAS.y + 10, PANEL.w, PANEL.h, CANVAS, [DOCKED]);
  assert.equal(r.y >= CANVAS.y, true);
});

test("mép dưới vùng vẽ tính theo vùng vẽ, không theo cửa sổ", () => {
  const maxY = CANVAS.y + CANVAS.h - PANEL.h - 8;
  assert.equal(snapToEdges(400, 9999, PANEL.w, PANEL.h, CANVAS).y, maxY);
});

function fakeStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    dump: () => Object.fromEntries(map)
  };
}

test("chưa lưu gì → mặc định cả ba panel neo trong bar", () => {
  assert.deepEqual(loadLayouts(fakeStorage()), DEFAULT_LAYOUTS);
});

test("lưu rồi đọc lại ra đúng cái đã lưu", () => {
  const s = fakeStorage();
  const layouts = { ...DEFAULT_LAYOUTS, palette: { free: true, vertical: true, x: 40, y: 120 } };
  saveLayouts(s, layouts);
  assert.deepEqual(loadLayouts(s), layouts);
});

test("giá trị hỏng lùi về mặc định từng key, không nổ", () => {
  assert.deepEqual(loadLayouts(fakeStorage({ "idea-map-panel-layout": "{{{" })), DEFAULT_LAYOUTS);
  assert.deepEqual(loadLayouts(fakeStorage({ "idea-map-panel-layout": "null" })), DEFAULT_LAYOUTS);
  // thiếu key tag, và status là rác → cả hai về mặc định, palette vẫn nhận được
  const partial = JSON.stringify({ status: 5, palette: { free: true, vertical: false, x: 10, y: 20 } });
  assert.deepEqual(loadLayouts(fakeStorage({ "idea-map-panel-layout": partial })), {
    status: DEFAULT_LAYOUTS.status,
    tag: DEFAULT_LAYOUTS.tag,
    palette: { free: true, vertical: false, x: 10, y: 20 }
  });
});

test("storage chặn ghi thì không làm sập app", () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  saveLayouts(blocked, DEFAULT_LAYOUTS);
});
