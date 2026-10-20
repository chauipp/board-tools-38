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

if (process.env.SMOKE_SCENARIO === "tree-panel") board.kind = "game-design";

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

// jsdom KHÔNG có document.elementFromPoint (không layout thì không hit-test
// được) — nên tới giờ mọi cú kéo đi qua nó, kể cả kéo badge/màu thả vào thẻ,
// chưa từng chạy được trong smoke test. Bản thay thế trả về phần tử mà bài kiểm
// tự đặt sẵn qua __hitAt().
//
// Nó KHÔNG kiểm được phép hit-test (việc đó thuộc trình duyệt), nhưng kiểm được
// đúng thứ đáng lo ở đây: thả vào một thẻ rồi thì NHỮNG THẺ NÀO nhận. Trả null
// khi chưa đặt gì, giống hệt lúc thả ra vùng trống.
let hitTarget = null;
window.document.elementFromPoint = () => hitTarget;
globalThis.__hitAt = (el) => { hitTarget = el; };

globalThis.__board = board;
globalThis.__puts = [];

// Bản mà "server" đang giữ — chính là thân của lần PUT được nhận gần nhất. Cần
// nó để dựng được một cú 409 THẬT: bản server trả về lúc va chạm phải là bản
// nền của client CỘNG thay đổi của người kia, chứ không phải bản client vừa gửi
// (bản đó đã chứa sẵn thay đổi của client, dùng nó thì bài kiểm tự đúng).
let lastAccepted = structuredClone(board);
let pendingConflict = null;
// __conflictOnce(mutate): cú PUT KẾ TIẾP bị từ chối 409, kèm bản server đã được
// `mutate` sửa — đúng cảnh "có người lưu chen vào giữa".
globalThis.__conflictOnce = (mutate) => { pendingConflict = mutate; };

globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  if (url.includes("/api/auth/me")) return json({ user: { name: "Tôi", email: "toi@example.com" } });
  if (url.includes("/api/boards/b1") && method === "GET") return json(board);
  if (url.includes("/api/boards/b1") && method === "PUT") {
    const body = JSON.parse(opts.body);
    globalThis.__puts.push(body);
    if (pendingConflict) {
      const mutate = pendingConflict;
      pendingConflict = null;
      const server = mutate(structuredClone(lastAccepted));
      // Cùng hình dạng với server thật (boardPayload trong server/boards.js):
      // không có id/name/role/view.
      delete server.id; delete server.name; delete server.role; delete server.view;
      delete server.clientId; delete server.baseUpdatedAt;
      server.updatedAt = new Date().toISOString();
      lastAccepted = structuredClone(server);
      return { ok: false, status: 409, json: async () => ({ error: "conflict", board: server }) };
    }
    lastAccepted = structuredClone(body);
    return json({ ok: true, updatedAt: new Date().toISOString() });
  }
  return json({});
};
function json(body) { return { ok: true, status: 200, json: async () => body }; }

// Chốt chặn "có gì đó treo", không phải hạn mức hiệu năng. Cả bộ hiện chạy chừng
// 62 giây, và phần lớn con số đó là CHỜ THẬT chứ không phải tính toán: mấy cử chỉ
// giữ tay (bắt hình, khép nét gấp khúc) mỗi lần chốt là 900ms đồng hồ treo, mà
// một nét gấp khúc bốn cạnh thì chốt bốn lần. Để gấp đôi thời gian thật: rộng để
// máy chậm không báo động giả, mà vẫn đủ chặt để một vòng lặp vô hạn lộ ra trong
// vòng hai phút thay vì treo mãi.
setTimeout(() => { console.log("⏱  QUÁ HẠN — có gì đó treo"); process.exit(2); }, 120000).unref();

// Bẫy CSS-vs-attribute của hình khối (Task 5): nếu rule `.ink-layer path`
// khai lại `fill` thì trong SVG, CSS thắng presentation attribute, nên mọi
// hình tô đặc mà InkLayer gán `fill` tường minh trên <path> sẽ biến thành
// chỉ-viền. Bài kiểm `getAttribute("fill")` trong entry.jsx KHÔNG bắt được
// lỗi này: nó chạy trong jsdom, đọc lại đúng attribute InkLayer vừa gán, chứ
// không phải kết quả cascade — mà smoke-run.mjs này cũng không nạp CSS nào
// vào jsdom nên cascade thật cũng không có ở đó để soi. Cách duy nhất là đọc
// trực tiếp FILE CSS thật, và việc đó chỉ làm được ở đây (chạy trong node),
// không làm được trong entry.jsx (chạy trong bundle jsdom).
{
  const fs = await import("node:fs");
  const cssPath = new URL("./src/styles/idea-map.css", import.meta.url);
  const css = fs.readFileSync(cssPath, "utf8");
  // Tìm rule chọn ĐÚNG ".ink-layer path" — không phải ".ink-layer path.erasing".
  // Chỉ lấy DÒNG CUỐI trước "{": rule này có một ghi chú nhiều dòng đứng ngay
  // trên nó, và split("}") gộp cả ghi chú vào cùng một khối với selector.
  let body = null;
  for (const block of css.split("}")) {
    const open = block.indexOf("{");
    if (open < 0) continue;
    const lastLine = block.slice(0, open).split("\n").pop().trim();
    const selectors = lastLine.split(",").map((s) => s.trim());
    if (selectors.includes(".ink-layer path")) { body = block.slice(open + 1); break; }
  }
  if (body === null) {
    console.log("\n❌ SMOKE FAIL: không tìm thấy rule `.ink-layer path` trong idea-map.css — rule bị đổi tên hay xoá thì bài kiểm fill-vs-CSS này vô nghĩa mà vẫn xanh");
    process.exit(1);
  }
  if (/fill\s*:/.test(body)) {
    console.log("\n❌ SMOKE FAIL: rule `.ink-layer path` trong idea-map.css khai `fill` — trong SVG, CSS thắng presentation attribute, nên dòng này sẽ làm mọi hình khối tô đặc biến thành chỉ-viền; bài kiểm getAttribute(\"fill\") trong entry.jsx chạy trong jsdom (không nạp CSS) không bắt được lỗi này");
    process.exit(1);
  }
  console.log("  ·", "CSS: rule `.ink-layer path` không khai `fill` (đúng — fill do InkLayer gán tường minh trên từng <path>)");

  // Cùng lý do như trên, một lớp lỗi khác mà jsdom không bắt được: THỨ TỰ NGUỒN.
  // `.tool-btn` và `.shape-pick`/`.fill-pick` đều là selector MỘT class nên độ
  // đặc hiệu bằng nhau, và khi đó cái đứng SAU thắng. Nếu `.shape-pick` đứng
  // trước `.tool-btn` thì `width: 34px` của `.tool-btn` đè mất bề rộng 22px,
  // track của `.tool-grid` bị min-content đội lên 34px, và cột phải của bảng
  // chọn hình bị cắt khỏi panel 62px. Lỗi thuần layout + cascade: jsdom không
  // tính cả hai thứ đó, nên chỉ đọc thứ tự trong file mới chốt được.
  const iBtn = css.indexOf(".tool-btn {");
  const iPick = css.search(/^\.shape-pick,\s*\.fill-pick,\s*\.dash-pick,\s*\.erase-pick\s*\{/m);
  if (iBtn < 0 || iPick < 0) {
    console.log("\n❌ SMOKE FAIL: không tìm thấy rule `.tool-btn` hoặc `.shape-pick, .fill-pick, .dash-pick, .erase-pick` trong idea-map.css — rule bị đổi tên, hoặc có nút MỚI trong .tool-grid chưa được thêm vào rule thu 22px; cả hai đều làm bài kiểm thứ tự nguồn này vô nghĩa mà vẫn xanh");
    process.exit(1);
  }
  if (iPick < iBtn) {
    console.log("\n❌ SMOKE FAIL: `.shape-pick, .fill-pick, .dash-pick, .erase-pick` đứng TRƯỚC `.tool-btn` trong idea-map.css — cùng độ đặc hiệu một class nên `.tool-btn { width: 34px }` sẽ đè mất bề rộng 22px, và cột phải của bảng chọn hình ở khu 4 bị cắt khỏi panel");
    process.exit(1);
  }
  console.log("  ·", "CSS: `.shape-pick/.fill-pick/.dash-pick/.erase-pick` đứng sau `.tool-btn` (đúng — cùng độ đặc hiệu thì thứ tự nguồn quyết định)");

  // Thanh công cụ chia thành khung rời: bao ngoài .tool-rail bỏ pointer-events
  // để khoảng hở giữa hai khung không nuốt cú bấm xuống canvas, và .tool-group
  // PHẢI bật lại. Thiếu dòng bật lại thì cả thanh công cụ hết bấm được — mà
  // smoke test không thấy, vì nó dispatch sự kiện THẲNG vào phần tử chứ không
  // đi qua phép hit-test (jsdom không có hit-test).
  // Cùng lý do, mặt kính (nền/viền/đổ bóng) đã dời từ .tool-rail sang
  // .tool-group; thiếu nó thì thanh công cụ trong suốt, jsdom cũng không thấy.
  const railRule = css.match(/^\.tool-rail\s*\{([^}]*)\}/m);
  const groupRule = css.match(/^\.tool-group\s*\{([^}]*)\}/m);
  const chromeRule = css.match(/^\.tool-group,\s*\.tool-options\s*\{([^}]*)\}/m);
  if (!railRule || !groupRule || !chromeRule) {
    console.log("\n❌ SMOKE FAIL: không tìm thấy đủ ba rule `.tool-rail`, `.tool-group`, `.tool-group, .tool-options` trong idea-map.css — rule bị đổi tên thì các bài kiểm dưới đây vô nghĩa mà vẫn xanh");
    process.exit(1);
  }
  if (/pointer-events\s*:\s*none/.test(railRule[1]) && !/pointer-events\s*:\s*auto/.test(groupRule[1])) {
    console.log("\n❌ SMOKE FAIL: `.tool-rail` khai `pointer-events: none` mà `.tool-group` không bật lại `auto` — cả thanh công cụ sẽ không bấm được. Smoke test không bắt được vì nó dispatch sự kiện thẳng vào nút, không qua hit-test");
    process.exit(1);
  }
  if (!/background\s*:/.test(chromeRule[1])) {
    console.log("\n❌ SMOKE FAIL: rule `.tool-group, .tool-options` không khai `background` — mặt kính đã dời khỏi `.tool-rail` nên thiếu dòng này là thanh công cụ trong suốt, trôi trên canvas");
    process.exit(1);
  }
  console.log("  ·", "CSS: `.tool-group` bật lại pointer-events và mang mặt kính (nền/viền/đổ bóng)");

  // Cùng loại "chỉ đọc được từ nguồn" như mấy bài CSS trên, nhưng lý do khác:
  // đây là bài kiểm HIỆU NĂNG, mà hiệu năng thì jsdom không đo được — nó không
  // có layout, không có paint, và một component thiếu memo vẫn cho ra đúng cây
  // DOM ấy, chỉ tốn thêm thời gian. Không có bài kiểm nào ở tầng DOM bắt được.
  //
  // Vì sao đáng canh: InkLayer render lại ở MỌI khung hình trong lúc có người vẽ
  // (`draft` đổi mỗi nhịp chuột của mình, `liveStrokes` đổi mỗi gói của người
  // khác). Nếu Stroke/TextEl không memo thì mỗi lượt đó dựng lại chuỗi `d` cho
  // TOÀN BỘ nét đã lưu — đo được 28.8µs cho một nét bút 120 điểm, tức 500 nét
  // ngốn 14.4ms/khung hình trên ngân sách 16.7ms. Bỏ memo đi là bảng vẽ nhiều
  // nét giật đúng lúc đang vẽ, mà mọi test khác vẫn xanh.
  const ink = fs.readFileSync(new URL("./src/components/InkLayer.jsx", import.meta.url), "utf8");
  for (const name of ["Stroke", "TextEl"]) {
    if (!new RegExp(`const ${name}\\s*=\\s*memo\\(`).test(ink)) {
      console.log(`\n❌ SMOKE FAIL: \`${name}\` trong InkLayer.jsx không còn bọc memo() — cả lớp vẽ render lại mỗi khung hình lúc đang vẽ, nên mọi nét đã lưu sẽ dựng lại chuỗi path ở từng khung (28.8µs/nét bút; 500 nét = 14.4ms trên ngân sách 16.7ms). jsdom không đo được hiệu năng nên không bài kiểm DOM nào bắt được lỗi này`);
      process.exit(1);
    }
  }
  console.log("  ·", "InkLayer: Stroke và TextEl đều bọc memo (nét đã lưu không dựng lại path ở mỗi khung hình lúc đang vẽ)");
}

const scenarios = await import("./smoke-dist/smoke.js");
const run = process.env.SMOKE_SCENARIO === "tree-panel" ? scenarios.runTreePanelExclusive : scenarios.run;
try {
  await run((m) => console.log("  ·", m));
  console.log("\n✅ SMOKE PASS");
  process.exit(0);
} catch (e) {
  console.log("\n❌ SMOKE FAIL:", e.message);
  console.log(e.stack);
  process.exit(1);
}
