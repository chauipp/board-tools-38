// Smoke test cho bản đồ ý tưởng: dựng IdeaMap THẬT trong jsdom với API và
// socket giả, rồi kéo một thẻ bằng sự kiện chuột thật.
//
// Vì sao cần: các test trong src/lib chỉ phủ được hàm thuần. Thứ từng làm bản
// đồ giật lại nằm ở chỗ ghép nối — cụ thể là việc ÁP một board:update lại kích
// hoạt việc PHÁT hình học, tạo vòng vọng giữa hai máy và làm thẻ nhảy qua nhảy
// lại giữa vị trí cũ và mới. Không hàm thuần nào bắt được lỗi đó; phải dựng cả
// component lên mới thấy. Kiểm tra cuối cùng trong entry.jsx chốt đúng bất biến
// ấy: nhận board:update thì số gói live:geom phát ra phải bằng 0.
//
// Chạy: npm run test:smoke
import { JSDOM } from "jsdom";

const board = {
  id: "b1", name: "Bảng thử", role: "owner", updatedAt: new Date().toISOString(),
  nodes: [
    { id: 1, title: "Thẻ A", desc: "mô tả", x: 0, y: 0, tagId: 1, statusId: 1 },
    { id: 2, title: "Thẻ B", desc: "", x: 300, y: 0, tagId: null, statusId: null },
    { id: 3, title: "Thẻ C", desc: "**đậm**", x: 0, y: 300, tagId: null, statusId: 2 }
  ],
  edges: [{ id: 1, from: 1, to: 2 }, { id: 2, from: 2, to: 3 }],
  groups: [{ id: 1, title: "Khung", x: -40, y: -40, w: 400, h: 400 }],
  statuses: [{ id: 1, name: "Mới", color: "st-idea" }, { id: 2, name: "Xong", color: "st-chosen" }],
  tags: [{ id: 1, name: "Nhãn", color: "dot-1" }],
  palette: [{ id: 1, hex: "#ff0000" }],
  drawings: [],
  nextNodeId: 4, nextEdgeId: 3, nextGroupId: 2, nextStatusId: 3, nextTagId: 2, nextPaletteId: 2, nextDrawingId: 1,
  view: { panX: 0, panY: 0, scale: 1 }
};

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
  pretendToBeVisual: true
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.MouseEvent = window.MouseEvent;
globalThis.Event = window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom không có ResizeObserver và cũng không có layout thật. Bản thay thế này
// gán một kích thước cố định rồi gọi callback ngay — đủ để kiểm luồng dữ liệu,
// không kiểm được số đo thật (số đo thật thuộc về trình duyệt).
//
// __resize() cho bài kiểm chạy lại observer với số đo khác, tức dựng lại đúng
// tình huống thẻ co/giãn sau khi đã render (lưu thẻ mới xong, ảnh tải xong…).
const observers = new Set();
window.ResizeObserver = globalThis.ResizeObserver = class {
  constructor(cb) { this.cb = cb; this.els = new Set(); observers.add(this); }
  observe(el) {
    this.els.add(el);
    setSize(el, 210, 110);
    this.cb([{ target: el }]);
  }
  unobserve(el) { this.els.delete(el); }
  disconnect() { this.els.clear(); observers.delete(this); }
};
function setSize(el, w, h) {
  Object.defineProperty(el, "offsetWidth", { value: w, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: h, configurable: true });
}
globalThis.__resize = (el, w, h) => {
  setSize(el, w, h);
  for (const o of observers) if (o.els.has(el)) o.cb([{ target: el }]);
};

globalThis.__board = board;
globalThis.__puts = [];
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  if (url.includes("/api/auth/me")) return json({ user: { name: "Tôi", email: "toi@example.com" } });
  if (url.includes("/api/boards/b1") && method === "GET") return json(board);
  if (url.includes("/api/boards/b1") && method === "PUT") {
    globalThis.__puts.push(JSON.parse(opts.body));
    return json({ ok: true, updatedAt: new Date().toISOString() });
  }
  return json({});
};
function json(body) { return { ok: true, status: 200, json: async () => body }; }

setTimeout(() => { console.log("⏱  QUÁ HẠN — có gì đó treo"); process.exit(2); }, 60000).unref();

const { run } = await import("./smoke-dist/smoke.js");
try {
  await run((m) => console.log("  ·", m));
  console.log("\n✅ SMOKE PASS");
  process.exit(0);
} catch (e) {
  console.log("\n❌ SMOKE FAIL:", e.message);
  console.log(e.stack);
  process.exit(1);
}
