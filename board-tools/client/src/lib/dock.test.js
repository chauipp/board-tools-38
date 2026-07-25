import { test } from "node:test";
import assert from "node:assert/strict";
import { snapToEdges, loadLayouts, saveLayouts, DEFAULT_LAYOUTS } from "./dock.js";

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
