import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isStaleUpdate, mergeRemoteBoard, projectGeometry, applyGeomOverlay,
  mergeGeomPacket, sweepExpired, reconcileGeomOverlay
} from "./useLiveSync.js";

test("isStaleUpdate: incoming with no timestamp is always stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:00.000Z", undefined), true);
});

test("isStaleUpdate: incoming newer than local is not stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z"), false);
});

test("isStaleUpdate: incoming equal to local is stale (already applied)", () => {
  const t = "2026-01-01T00:00:00.000Z";
  assert.equal(isStaleUpdate(t, t), true);
});

test("isStaleUpdate: incoming older than local is stale", () => {
  assert.equal(isStaleUpdate("2026-01-01T00:00:01.000Z", "2026-01-01T00:00:00.000Z"), true);
});

test("isStaleUpdate: no local timestamp yet accepts any incoming update", () => {
  assert.equal(isStaleUpdate(null, "2026-01-01T00:00:00.000Z"), false);
});

test("mergeRemoteBoard: takes incoming content but keeps local view (camera stays private)", () => {
  const local = { nodes: [], edges: [], view: { panX: 10, panY: 20, scale: 1 } };
  const incoming = { nodes: [{ id: 1, title: "a" }], edges: [], view: { panX: 999, panY: 999, scale: 9 } };
  const merged = mergeRemoteBoard(local, incoming, null);
  assert.deepEqual(merged.nodes, [{ id: 1, title: "a" }]);
  assert.deepEqual(merged.view, { panX: 10, panY: 20, scale: 1 });
});

test("mergeRemoteBoard: preserves the node currently being edited locally, takes the rest", () => {
  const local = { nodes: [{ id: 1, title: "typing…" }, { id: 2, title: "old" }], view: {} };
  const incoming = { nodes: [{ id: 1, title: "SHOULD NOT WIN" }, { id: 2, title: "new from remote" }], view: {} };
  const merged = mergeRemoteBoard(local, incoming, 1);
  assert.deepEqual(merged.nodes, [{ id: 1, title: "typing…" }, { id: 2, title: "new from remote" }]);
});

test("mergeRemoteBoard: editingId with no matching local node just takes incoming as-is", () => {
  const local = { nodes: [{ id: 2, title: "old" }], view: {} };
  const incoming = { nodes: [{ id: 2, title: "new" }], view: {} };
  const merged = mergeRemoteBoard(local, incoming, 999);
  assert.deepEqual(merged.nodes, [{ id: 2, title: "new" }]);
});

test("projectGeometry strips content fields, keeps only position/size", () => {
  const board = {
    nodes: [{ id: 1, x: 10, y: 20, w: 210, title: "t", desc: "d", image: "data:image/png;base64,xxxx" }],
    groups: [{ id: 5, x: 0, y: 0, w: 300, h: 200, title: "frame" }]
  };
  assert.deepEqual(projectGeometry(board), {
    nodes: [{ id: 1, x: 10, y: 20, w: 210 }],
    groups: [{ id: 5, x: 0, y: 0, w: 300, h: 200 }]
  });
});

test("projectGeometry handles empty board content", () => {
  assert.deepEqual(projectGeometry({ nodes: [], groups: [] }), { nodes: [], groups: [] });
});

test("projectGeometry: node without a w (no explicit width set) omits w as undefined-passthrough", () => {
  const board = { nodes: [{ id: 2, x: 1, y: 2 }], groups: [] };
  assert.deepEqual(projectGeometry(board), { nodes: [{ id: 2, x: 1, y: 2, w: undefined }], groups: [] });
});

test("applyGeomOverlay returns the very same array when nothing is live", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }];
  assert.equal(applyGeomOverlay(nodes, new Map(), "node:"), nodes);
});

test("applyGeomOverlay moves only the items the overlay mentions", () => {
  const nodes = [{ id: 1, x: 0, y: 0, title: "a" }, { id: 2, x: 5, y: 5, title: "b" }];
  const out = applyGeomOverlay(nodes, new Map([["node:1", { x: 100, y: 200 }]]), "node:");
  assert.deepEqual(out[0], { id: 1, x: 100, y: 200, title: "a" });
  assert.equal(out[1], nodes[1], "untouched items keep their identity");
});

test("applyGeomOverlay takes w and h when the overlay carries them (frame resize)", () => {
  const groups = [{ id: 7, x: 0, y: 0, w: 10, h: 10, title: "f" }];
  const out = applyGeomOverlay(groups, new Map([["group:7", { x: 1, y: 2, w: 300, h: 200 }]]), "group:");
  assert.deepEqual(out[0], { id: 7, x: 1, y: 2, w: 300, h: 200, title: "f" });
});

test("applyGeomOverlay keeps the committed w when the overlay carries none", () => {
  const nodes = [{ id: 1, x: 0, y: 0, w: 210 }];
  const out = applyGeomOverlay(nodes, new Map([["node:1", { x: 9, y: 9, w: undefined }]]), "node:");
  assert.equal(out[0].w, 210);
});

test("applyGeomOverlay ignores overlay entries for a different kind (node vs group ids collide)", () => {
  const nodes = [{ id: 7, x: 0, y: 0 }];
  const out = applyGeomOverlay(nodes, new Map([["group:7", { x: 999, y: 999 }]]), "node:");
  assert.equal(out[0], nodes[0]);
});

// --- overlay hình học: gộp gói, quét hết hạn, hoà giải với board thật --------

test("mergeGeomPacket: gói đầu tiên tạo entry kèm hạn dùng", () => {
  const out = mergeGeomPacket(new Map(), { nodes: [{ id: 1, x: 5, y: 6, w: 210 }] }, 1000);
  assert.deepEqual(out.get("node:1"), { x: 5, y: 6, w: 210, expiresAt: 1000 + 900 });
});

test("mergeGeomPacket: gói `done` được giữ lâu hơn hẳn — nó phải cầm cự tới khi board:update về", () => {
  const live = mergeGeomPacket(new Map(), { nodes: [{ id: 1, x: 5, y: 6 }] }, 1000);
  const done = mergeGeomPacket(new Map(), { nodes: [{ id: 1, x: 5, y: 6 }], done: true }, 1000);
  assert.ok(done.get("node:1").expiresAt > live.get("node:1").expiresAt);
});

test("mergeGeomPacket: cùng vị trí và hạn còn quá nửa → trả về CHÍNH map cũ (React khỏi render)", () => {
  const first = mergeGeomPacket(new Map(), { nodes: [{ id: 1, x: 5, y: 6 }] }, 1000);
  const second = mergeGeomPacket(first, { nodes: [{ id: 1, x: 5, y: 6 }] }, 1060);
  assert.equal(second, first);
});

test("mergeGeomPacket: cùng vị trí nhưng sắp hết hạn thì được gia hạn", () => {
  const first = mergeGeomPacket(new Map(), { nodes: [{ id: 1, x: 5, y: 6 }] }, 1000);
  const later = mergeGeomPacket(first, { nodes: [{ id: 1, x: 5, y: 6 }] }, 1600);
  assert.notEqual(later, first);
  assert.equal(later.get("node:1").expiresAt, 1600 + 900);
});

test("mergeGeomPacket: bỏ qua item mình đang tự kéo — gói muộn của người khác không giật thẻ khỏi tay mình", () => {
  const out = mergeGeomPacket(
    new Map(),
    { nodes: [{ id: 1, x: 999, y: 999 }, { id: 2, x: 5, y: 5 }] },
    1000,
    (key) => key === "node:1"
  );
  assert.equal(out.has("node:1"), false);
  assert.equal(out.has("node:2"), true);
});

test("mergeGeomPacket: gói rỗng không đụng vào map", () => {
  const prev = new Map([["node:1", { x: 0, y: 0, expiresAt: 9e9 }]]);
  assert.equal(mergeGeomPacket(prev, {}, 1000), prev);
});

test("sweepExpired: bỏ entry quá hạn, giữ entry còn hạn", () => {
  const prev = new Map([
    ["node:1", { x: 0, y: 0, expiresAt: 500 }],
    ["node:2", { x: 0, y: 0, expiresAt: 5000 }]
  ]);
  const out = sweepExpired(prev, 1000);
  assert.deepEqual(Array.from(out.keys()), ["node:2"]);
});

test("sweepExpired: không có gì quá hạn thì trả về chính map cũ", () => {
  const prev = new Map([["node:1", { x: 0, y: 0, expiresAt: 5000 }]]);
  assert.equal(sweepExpired(prev, 1000), prev);
});

test("reconcileGeomOverlay: board thật đã bắt kịp → bỏ overlay (nếu giữ, thẻ nhảy về vị trí tạm cũ)", () => {
  const prev = new Map([["node:1", { x: 10, y: 20, expiresAt: 9e9 }]]);
  const out = reconcileGeomOverlay(prev, { nodes: [{ id: 1, x: 10, y: 20 }], groups: [] });
  assert.equal(out.size, 0);
});

test("reconcileGeomOverlay: overlay còn lệch board → giữ, vì nó mới hơn bản lưu vừa nhận", () => {
  const prev = new Map([["node:1", { x: 10, y: 20, expiresAt: 9e9 }]]);
  const out = reconcileGeomOverlay(prev, { nodes: [{ id: 1, x: 0, y: 0 }], groups: [] });
  assert.equal(out, prev);
});

test("reconcileGeomOverlay: khung chỉ được bỏ khi khớp cả kích thước", () => {
  const prev = new Map([["group:3", { x: 0, y: 0, w: 300, h: 200, expiresAt: 9e9 }]]);
  const sameSize = reconcileGeomOverlay(prev, { nodes: [], groups: [{ id: 3, x: 0, y: 0, w: 300, h: 200 }] });
  const otherSize = reconcileGeomOverlay(prev, { nodes: [], groups: [{ id: 3, x: 0, y: 0, w: 999, h: 200 }] });
  assert.equal(sameSize.size, 0);
  assert.equal(otherSize, prev);
});

test("reconcileGeomOverlay: overlay rỗng là no-op", () => {
  const prev = new Map();
  assert.equal(reconcileGeomOverlay(prev, { nodes: [{ id: 1, x: 0, y: 0 }] }), prev);
});

test("projectGeometry nhận một TẬP item đang kéo, không cần cả board", () => {
  assert.deepEqual(projectGeometry({ nodes: [{ id: 7, x: 1, y: 2, w: 210 }] }), {
    nodes: [{ id: 7, x: 1, y: 2, w: 210 }],
    groups: []
  });
});

// --- Kịch bản đầy đủ: đúng lỗi "kéo thẻ xong nó giật đi giật lại giữa 2 vị trí"
//
// Người A kéo thẻ 1 từ (0,0) sang (100,100) rồi thả. Đây là những gì màn hình
// người B phải thấy, theo đúng thứ tự sự kiện trên dây.
test("kịch bản: thẻ người khác kéo không được rơi về vị trí cũ trong lúc chờ bản lưu", () => {
  const nodes = [{ id: 1, x: 0, y: 0, title: "thẻ" }];
  let overlay = new Map();
  const at = (t) => applyGeomOverlay(nodes, overlay, "node:")[0];

  // t=0: gói giữa chừng của cú kéo
  overlay = mergeGeomPacket(overlay, { nodes: [{ id: 1, x: 50, y: 50 }] }, 0);
  assert.deepEqual([at(0).x, at(0).y], [50, 50]);

  // t=200: A thả chuột → gói `done` mang vị trí cuối
  overlay = mergeGeomPacket(overlay, { nodes: [{ id: 1, x: 100, y: 100 }], done: true }, 200);
  assert.deepEqual([at().x, at().y], [100, 100]);

  // t=2000: PUT của A vẫn chưa xong (mạng chậm). Gói kéo thường đã hết hạn từ
  // lâu, nhưng gói `done` thì chưa — nếu nó hết hạn ở đây, thẻ nhảy về (0,0)
  // rồi lát nữa nhảy lại (100,100): đúng hiện tượng giật giữa hai vị trí.
  overlay = sweepExpired(overlay, 2000);
  assert.deepEqual([at().x, at().y], [100, 100], "vẫn phải đứng ở vị trí mới");

  // t=2100: board:update chính thức về, đã mang đúng (100,100)
  const savedBoard = { nodes: [{ id: 1, x: 100, y: 100, title: "thẻ" }], groups: [] };
  overlay = reconcileGeomOverlay(overlay, savedBoard);
  assert.equal(overlay.size, 0, "overlay được nhả ra, từ đây vẽ theo dữ liệu thật");
  assert.deepEqual(
    [applyGeomOverlay(savedBoard.nodes, overlay, "node:")[0].x, applyGeomOverlay(savedBoard.nodes, overlay, "node:")[0].y],
    [100, 100],
    "không có một khung hình nào thẻ quay lại (0,0)"
  );
});

test("kịch bản: board:update mang vị trí CŨ (bản lưu của người thứ ba) không kéo thẻ lùi lại", () => {
  const overlay = mergeGeomPacket(new Map(), { nodes: [{ id: 1, x: 100, y: 100 }], done: true }, 0);
  const staleBoard = { nodes: [{ id: 1, x: 0, y: 0 }], groups: [] };
  const after = reconcileGeomOverlay(overlay, staleBoard);
  const drawn = applyGeomOverlay(staleBoard.nodes, after, "node:")[0];
  assert.deepEqual([drawn.x, drawn.y], [100, 100]);
});
