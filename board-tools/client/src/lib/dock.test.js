import { test } from "node:test";
import assert from "node:assert/strict";
import { snapToEdges, snapPanel, loadLayouts, saveLayouts, DEFAULT_LAYOUTS } from "./dock.js";

test("giữa khung nhìn thì không hút đi đâu", () => {
  assert.deepEqual(snapToEdges(400, 300, 200, 100, 1000, 800), { x: 400, y: 300 });
});

test("gần mép thì hút vào mép", () => {
  assert.deepEqual(snapToEdges(20, 300, 200, 100, 1000, 800), { x: 8, y: 300 });   // trái
  assert.deepEqual(snapToEdges(780, 300, 200, 100, 1000, 800), { x: 792, y: 300 }); // phải
  assert.deepEqual(snapToEdges(400, 20, 200, 100, 1000, 800), { x: 400, y: 8 });   // trên
  assert.deepEqual(snapToEdges(400, 680, 200, 100, 1000, 800), { x: 400, y: 692 }); // dưới
});

test("ngoài ngưỡng hút thì đứng yên", () => {
  // 40px cách mép, ngưỡng 24 → không hút
  assert.deepEqual(snapToEdges(48, 300, 200, 100, 1000, 800), { x: 48, y: 300 });
});

test("thả ra ngoài khung nhìn thì bị kéo về trong — panel không được mất", () => {
  assert.deepEqual(snapToEdges(-500, -500, 200, 100, 1000, 800), { x: 8, y: 8 });
  assert.deepEqual(snapToEdges(9999, 9999, 200, 100, 1000, 800), { x: 792, y: 692 });
});

test("panel rộng hơn khung nhìn vẫn nằm ở lề, không ra số âm", () => {
  assert.deepEqual(snapToEdges(300, 300, 1200, 900, 1000, 800), { x: 8, y: 8 });
});

const PANEL = { w: 200, h: 40 };
const VW = 1000, VH = 800;
// Panel neo: trải hết chiều ngang bar, nằm ngay dưới topbar.
const DOCKED = { x: 16, y: 120, w: 968, h: 40 };

test("căn mép trên theo panel khác khi lệch trong ngưỡng", () => {
  // lệch 6px: cặp trên-trên (120↔126) là ứng viên gần nhất
  const r = snapPanel(500, 126, PANEL.w, PANEL.h, VW, VH, [DOCKED]);
  assert.equal(r.y, 120);
  assert.equal(r.guides.some((g) => g.axis === "h" && g.pos === 120), true);
});

test("chọn cặp mốc lệch ít nhất, không cố định phải là trên-trên", () => {
  // y=132: trên↔giữa (140-132) và giữa↔dưới đều lệch 8, gần hơn trên↔trên (12)
  assert.equal(snapPanel(500, 132, PANEL.w, PANEL.h, VW, VH, [DOCKED]).y, 140);
});

test("căn mép trái theo panel khác", () => {
  const r = snapPanel(30, 400, PANEL.w, PANEL.h, VW, VH, [DOCKED]);
  assert.equal(r.x, 16);
});

test("căn hàng thắng hút mép: đã thẳng hàng ở gần mép thì không bị mép giật đi", () => {
  // DOCKED.x = 16, cách mép trái 8px chỉ 8px → nằm trong ngưỡng hút mép.
  // Hút mép sẽ kéo về 8; căn hàng phải kéo trở lại 16.
  const r = snapPanel(18, 400, PANEL.w, PANEL.h, VW, VH, [DOCKED]);
  assert.equal(r.x, 16);
  // và khi đã đúng 16 rồi thì đứng yên, không bị mép nuốt
  assert.equal(snapPanel(16, 400, PANEL.w, PANEL.h, VW, VH, [DOCKED]).x, 16);
});

test("ngoài ngưỡng thì không căn, mép vẫn hút như trước", () => {
  const r = snapPanel(500, 400, PANEL.w, PANEL.h, VW, VH, [DOCKED]);
  assert.deepEqual({ x: r.x, y: r.y }, { x: 500, y: 400 });
  assert.deepEqual(r.guides, []);
  assert.equal(snapPanel(500, 10, PANEL.w, PANEL.h, VW, VH, []).y, 8);
});

test("không có panel nào khác → hành xử y như snapToEdges", () => {
  const r = snapPanel(20, 300, PANEL.w, PANEL.h, VW, VH, []);
  assert.deepEqual({ x: r.x, y: r.y }, snapToEdges(20, 300, PANEL.w, PANEL.h, VW, VH));
});

test("căn hàng không đẩy được panel ra ngoài khung nhìn", () => {
  const far = { x: 980, y: 400, w: 200, h: 40 };
  const r = snapPanel(970, 400, PANEL.w, PANEL.h, VW, VH, [far]);
  assert.equal(r.x + PANEL.w <= VW, true);
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
