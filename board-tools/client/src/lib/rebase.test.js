import test from "node:test";
import assert from "node:assert/strict";
import { diffCollection, diffBoard, isEmptyDelta, rebaseBoard, isSaneBoard } from "./rebase.js";

// Board tối thiểu nhưng ĐỦ mọi bộ sưu tập: thiếu một bộ thì rebaseBoard vẫn
// chạy (nó tự lùi về mảng rỗng), và một bài kiểm chạy trên board thiếu field sẽ
// không phát hiện được lỗi ở chính bộ đó.
function boardOf(patch = {}) {
  return {
    nodes: [], edges: [], groups: [], statuses: [], tags: [], palette: [], drawings: [],
    nextNodeId: 1, nextEdgeId: 1, nextGroupId: 1, nextStatusId: 1,
    nextTagId: 1, nextPaletteId: 1, nextDrawingId: 1,
    bg: null, grid: null, pack: null,
    ...patch
  };
}

const N = (id, patch = {}) => ({ id, title: "T" + id, desc: "", x: 0, y: 0, tagId: null, statusId: null, ...patch });

test("diffCollection tách đúng thêm / sửa / xoá", () => {
  const d = diffCollection([N(1), N(2), N(3)], [N(1), N(2, { x: 99 }), N(4)]);
  assert.deepEqual(d.removed, [3]);
  assert.deepEqual(d.added.map((o) => o.id), [4]);
  assert.deepEqual(d.changed.map((o) => o.id), [2]);
});

test("không đổi gì thì delta rỗng", () => {
  const b = boardOf({ nodes: [N(1)] });
  assert.equal(isEmptyDelta(diffBoard(b, b)), true);
});

test("đổi thiết lập cấp bảng cũng vào delta", () => {
  const base = boardOf();
  const next = boardOf({ pack: "neon" });
  assert.equal(isEmptyDelta(diffBoard(base, next)), false);
  assert.deepEqual(diffBoard(base, next).scalars, { pack: "neon" });
});

// Đây là chính cái cảnh cần chữa: hai người kéo hai thẻ khác nhau cùng lúc.
test("hai người sửa hai thẻ khác nhau → cả hai thay đổi cùng sống", () => {
  const base = boardOf({ nodes: [N(1), N(2)], nextNodeId: 3 });
  const server = boardOf({ nodes: [N(1, { x: 500 }), N(2)], nextNodeId: 3 });   // người kia kéo thẻ 1
  const mine = boardOf({ nodes: [N(1), N(2, { y: 300 })], nextNodeId: 3 });     // mình kéo thẻ 2

  const out = rebaseBoard(server, base, mine);
  assert.equal(out.nodes.find((n) => n.id === 1).x, 500, "thay đổi của người kia phải còn");
  assert.equal(out.nodes.find((n) => n.id === 2).y, 300, "thay đổi của mình phải còn");
});

test("mình thêm thẻ, người kia thêm thẻ khác → giữ cả hai", () => {
  const base = boardOf({ nodes: [N(1)], nextNodeId: 2 });
  const server = boardOf({ nodes: [N(1), N(2)], nextNodeId: 3 });
  const mine = boardOf({ nodes: [N(1), N(9)], nextNodeId: 10 });

  const out = rebaseBoard(server, base, mine);
  assert.deepEqual(out.nodes.map((n) => n.id).sort((a, b) => a - b), [1, 2, 9]);
  assert.equal(out.nextNodeId, 10);
});

test("mình xoá thẻ → cú xoá thắng, và dây nối vào nó bị cắt theo", () => {
  const base = boardOf({ nodes: [N(1), N(2)], edges: [], nextNodeId: 3, nextEdgeId: 1 });
  // Người kia vừa nối một dây mới vào đúng cái thẻ mình sắp xoá.
  const server = boardOf({ nodes: [N(1), N(2)], edges: [{ id: 1, from: 1, to: 2 }], nextNodeId: 3, nextEdgeId: 2 });
  const mine = boardOf({ nodes: [N(1)], edges: [], nextNodeId: 3, nextEdgeId: 1 });

  const out = rebaseBoard(server, base, mine);
  assert.deepEqual(out.nodes.map((n) => n.id), [1]);
  assert.deepEqual(out.edges, [], "dây mồ côi phải bị cắt, không được để treo");
  assert.equal(isSaneBoard(out), true);
});

test("người kia xoá thứ mình vừa sửa → không hồi sinh nó", () => {
  const base = boardOf({ nodes: [N(1), N(2)], nextNodeId: 3 });
  const server = boardOf({ nodes: [N(1)], nextNodeId: 3 });
  const mine = boardOf({ nodes: [N(1), N(2, { color: "dot-1" })], nextNodeId: 3 });

  const out = rebaseBoard(server, base, mine);
  assert.deepEqual(out.nodes.map((n) => n.id), [1]);
});

// Cảnh hiếm nhất nhưng hỏng nặng nhất: hai máy cùng đọc nextNodeId = 3 rồi cùng
// cấp id 3 cho hai thẻ KHÁC NHAU.
test("hai người cùng tạo thẻ trùng id → thẻ của mình được cấp id mới", () => {
  const base = boardOf({ nodes: [N(1)], nextNodeId: 2 });
  const server = boardOf({ nodes: [N(1), N(2, { title: "của người kia" })], nextNodeId: 3 });
  const mine = boardOf({ nodes: [N(1), N(2, { title: "của mình" })], nextNodeId: 3 });

  const out = rebaseBoard(server, base, mine);
  assert.equal(out.nodes.length, 3);
  assert.equal(out.nodes.find((n) => n.title === "của người kia").id, 2);
  const mineNode = out.nodes.find((n) => n.title === "của mình");
  assert.notEqual(mineNode.id, 2, "không được để hai thẻ cùng id 2");
  assert.ok(out.nextNodeId > mineNode.id, "bộ đếm phải vượt qua id vừa cấp");
  assert.equal(isSaneBoard(out), true);
});

test("id thẻ bị cấp lại thì dây nối của mình phải trỏ theo id mới", () => {
  const base = boardOf({ nodes: [N(1)], nextNodeId: 2, nextEdgeId: 1 });
  const server = boardOf({ nodes: [N(1), N(2, { title: "người kia" })], nextNodeId: 3, nextEdgeId: 1 });
  // Mình tạo thẻ 2 rồi nối 1 → 2 ngay trong cùng một lượt.
  const mine = boardOf({
    nodes: [N(1), N(2, { title: "của mình" })],
    edges: [{ id: 1, from: 1, to: 2 }],
    nextNodeId: 3, nextEdgeId: 2
  });

  const out = rebaseBoard(server, base, mine);
  const mineNode = out.nodes.find((n) => n.title === "của mình");
  assert.equal(out.edges.length, 1);
  assert.equal(out.edges[0].to, mineNode.id, "dây phải bám theo id mới, không trỏ vào thẻ của người kia");
  assert.equal(isSaneBoard(out), true);
});

test("id khung bị cấp lại thì dây nối vào KHUNG cũng trỏ theo", () => {
  const base = boardOf({ nodes: [N(1)], nextNodeId: 2, nextGroupId: 1, nextEdgeId: 1 });
  const server = boardOf({
    nodes: [N(1)], groups: [{ id: 1, title: "khung người kia", x: 0, y: 0, w: 200, h: 200 }],
    nextNodeId: 2, nextGroupId: 2, nextEdgeId: 1
  });
  const mine = boardOf({
    nodes: [N(1)], groups: [{ id: 1, title: "khung của mình", x: 0, y: 0, w: 300, h: 300 }],
    edges: [{ id: 1, from: 1, fromKind: "node", to: 1, toKind: "group" }],
    nextNodeId: 2, nextGroupId: 2, nextEdgeId: 2
  });

  const out = rebaseBoard(server, base, mine);
  const mineGroup = out.groups.find((g) => g.title === "khung của mình");
  assert.notEqual(mineGroup.id, 1);
  assert.equal(out.edges[0].to, mineGroup.id);
  assert.equal(out.edges[0].toKind, "group");
  assert.equal(isSaneBoard(out), true);
});

test("id badge bị cấp lại thì statusId/tagId trên thẻ của mình trỏ theo", () => {
  const base = boardOf({ nextStatusId: 1, nextTagId: 1, nextNodeId: 1 });
  const server = boardOf({
    statuses: [{ id: 1, name: "của người kia", color: "st-idea" }],
    tags: [{ id: 1, name: "nhãn người kia", color: "dot-1" }],
    nextStatusId: 2, nextTagId: 2, nextNodeId: 1
  });
  const mine = boardOf({
    statuses: [{ id: 1, name: "của mình", color: "st-chosen" }],
    tags: [{ id: 1, name: "nhãn của mình", color: "dot-2" }],
    nodes: [N(1, { statusId: 1, tagId: 1 })],
    nextStatusId: 2, nextTagId: 2, nextNodeId: 2
  });

  const out = rebaseBoard(server, base, mine);
  const mineStatus = out.statuses.find((s) => s.name === "của mình");
  const mineTag = out.tags.find((tg) => tg.name === "nhãn của mình");
  const node = out.nodes.find((n) => n.id === 1);
  assert.notEqual(mineStatus.id, 1);
  assert.notEqual(mineTag.id, 1);
  assert.equal(node.statusId, mineStatus.id);
  assert.equal(node.tagId, mineTag.id);
});

// Màu tự tạo được trỏ tới bằng CHUỖI token "pal-<id>", không phải bằng số —
// nên nó là chỗ dễ bị bỏ sót nhất khi cấp lại id.
test("id màu tự tạo bị cấp lại thì token pal-N trên thẻ/dây/nét vẽ trỏ theo", () => {
  const base = boardOf({ nextPaletteId: 1, nextNodeId: 1, nextDrawingId: 1 });
  const server = boardOf({ palette: [{ id: 1, hex: "#111111" }], nextPaletteId: 2 });
  const mine = boardOf({
    palette: [{ id: 1, hex: "#ff0000" }],
    nodes: [N(1, { color: "pal-1" })],
    drawings: [{ id: 1, kind: "pen", pts: [0, 0, 5, 5], color: "pal-1", w: 2 }],
    nextPaletteId: 2, nextNodeId: 2, nextDrawingId: 2
  });

  const out = rebaseBoard(server, base, mine);
  const minePal = out.palette.find((c) => c.hex === "#ff0000");
  assert.notEqual(minePal.id, 1);
  assert.equal(out.nodes[0].color, "pal-" + minePal.id);
  assert.equal(out.drawings[0].color, "pal-" + minePal.id);
  assert.equal(out.palette.find((c) => c.hex === "#111111").id, 1, "màu của người kia giữ nguyên id");
});

test("token màu cố định (dot-1) không bị đụng tới", () => {
  const base = boardOf({ nodes: [N(1)], nextNodeId: 2 });
  const server = boardOf({ nodes: [N(1)], nextNodeId: 2 });
  const mine = boardOf({ nodes: [N(1, { color: "dot-1" })], nextNodeId: 2 });
  assert.equal(rebaseBoard(server, base, mine).nodes[0].color, "dot-1");
});

test("bộ đếm luôn tiến, không bao giờ lùi", () => {
  const base = boardOf({ nodes: [N(1)], nextNodeId: 2 });
  const server = boardOf({ nodes: [N(1), N(2), N(3)], nextNodeId: 4 });
  const mine = boardOf({ nodes: [N(1, { x: 5 })], nextNodeId: 2 });
  assert.equal(rebaseBoard(server, base, mine).nextNodeId, 4);
});

test("nét vẽ ghép được như mọi bộ khác", () => {
  const stroke = (id, x) => ({ id, kind: "pen", pts: [x, 0, x + 10, 10], color: "pen-mono", w: 2 });
  const base = boardOf({ drawings: [stroke(1, 0)], nextDrawingId: 2 });
  const server = boardOf({ drawings: [stroke(1, 0), stroke(2, 50)], nextDrawingId: 3 });
  const mine = boardOf({ drawings: [], nextDrawingId: 2 });               // mình gôm nét 1
  const out = rebaseBoard(server, base, mine);
  assert.deepEqual(out.drawings.map((d) => d.id), [2], "nét người kia vừa vẽ phải còn, nét mình gôm phải mất");
});

test("thiếu tham số thì trả null chứ không ném lỗi", () => {
  assert.equal(rebaseBoard(null, boardOf(), boardOf()), null);
  assert.equal(rebaseBoard(boardOf(), null, boardOf()), null);
  assert.equal(rebaseBoard(boardOf(), boardOf(), null), null);
});

test("isSaneBoard bắt id trùng và dây trỏ vào hư không", () => {
  assert.equal(isSaneBoard(boardOf({ nodes: [N(1), N(1)] })), false);
  assert.equal(isSaneBoard(boardOf({ nodes: [N(1)], edges: [{ id: 1, from: 1, to: 99 }] })), false);
  assert.equal(isSaneBoard(boardOf({ nodes: [N(1), N(2)], edges: [{ id: 1, from: 1, to: 2 }] })), true);
});

// Đây là cái hố mà savingRef ở IdeaMap.jsx (saveNow) phải chặn TRƯỚC khi gọi
// tới đây: nếu `base` bị đọc quá sớm (từ một cú saveNow bắn chồng lên cú vừa
// rồi của CHÍNH MÌNH), nó sẽ không biết thẻ mình vừa tạo đã tồn tại trên
// server rồi — hàm này khi đó không cách nào phân biệt "server có id này vì
// chính mình vừa lưu xong" với "server có id này vì người lạ trùng id", nên xử
// lý (đúng luật cho trường hợp thứ hai) là cấp id mới và giữ lại CẢ HAI. Kết
// quả: thẻ vừa tạo bị nhân bản. Test này không kiểm code sửa (nó nằm ở
// IdeaMap.jsx, không thể unit-test tới đây) — nó ghi lại vì sao `base` không
// được phép stale, để không ai "tối ưu" bỏ mất chốt savingRef sau này.
test("base không cập nhật kịp thẻ mình vừa tạo → tưởng lầm là trùng id, nhân bản thẻ", () => {
  const base = boardOf({ nodes: [], nextNodeId: 5 });                        // trước khi dán ảnh
  const server = boardOf({ nodes: [N(5, { w: 200 })], nextNodeId: 6 });      // lần lưu (paste) của MÌNH đã lên server
  const mine = boardOf({ nodes: [N(5, { w: 500 })], nextNodeId: 6 });        // mình vừa kéo rộng thẻ đó ra

  const out = rebaseBoard(server, base, mine);
  assert.equal(out.nodes.length, 2, "base stale khiến thẻ 5 bị coi là VỪA THÊM nên nhân bản thành 2");
  assert.ok(out.nodes.some((n) => n.w === 200), "bản gốc (cỡ cũ) vẫn còn nguyên — đúng hiện tượng người dùng thấy");
});

// Board thiếu hẳn field (bản cũ chưa có `drawings`/`palette`) không được làm vỡ
// đường ghép — nếu vỡ thì người dùng board cũ mất luôn cả đường dự phòng.
test("board cũ thiếu field vẫn ghép được", () => {
  const base = { nodes: [N(1)], edges: [], groups: [], statuses: [], tags: [], nextNodeId: 2 };
  const server = { nodes: [N(1, { x: 40 })], edges: [], groups: [], statuses: [], tags: [], nextNodeId: 2 };
  const mine = { nodes: [N(1), N(2)], edges: [], groups: [], statuses: [], tags: [], nextNodeId: 3 };
  const out = rebaseBoard(server, base, mine);
  assert.equal(out.nodes.length, 2);
  assert.equal(out.nodes.find((n) => n.id === 1).x, 40);
  assert.deepEqual(out.drawings, []);
});
