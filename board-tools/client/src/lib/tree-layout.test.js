import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, edgeKey, treeLayout, carryGroupMembers, splitBranches } from "./tree-layout.js";

test("edgeKey ghép kind và id thành khoá chuỗi", () => {
  assert.equal(edgeKey("node", 3), "node:3");
  assert.equal(edgeKey("group", 1), "group:1");
});

test("buildTree: chuỗi thẳng 1→2→3 ra ba tầng", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 2, to: 3, fromKind: "node", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2", "node:3"]);
  assert.deepEqual(children.get("node:1"), ["node:2"]);
  assert.deepEqual(children.get("node:2"), ["node:3"]);
  assert.equal(children.has("node:3"), false);
});

test("buildTree: mũi tên đi vào gốc không tạo quan hệ cha-con", () => {
  // Dây vẽ từ 2 sang 1 (mũi tên chỉ vào gốc), nên 2 không phải con của 1.
  const edges = [{ id: 1, from: 2, to: 1, fromKind: "node", toKind: "node" }];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1"]);
  assert.equal(children.has("node:1"), false);
});

test("buildTree: dây vô hướng (arrow: none) không thuộc cây", () => {
  const edges = [{ id: 1, from: 1, to: 2, fromKind: "node", toKind: "node", arrow: "none" }];
  const { order } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1"]);
});

test("buildTree: chỉ theo đúng chiều mũi tên đi ra, bỏ qua dây vô hướng và dây đi vào", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },              // 1 → 2: con hợp lệ
    { id: 2, from: 3, to: 1, fromKind: "node", toKind: "node" },              // 3 → 1: mũi tên vào gốc, bỏ
    { id: 3, from: 1, to: 4, fromKind: "node", toKind: "node", arrow: "none" } // 1 → 4 nhưng vô hướng, bỏ
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
  assert.deepEqual(children.get("node:1"), ["node:2"]);
});

test("buildTree: edge thiếu fromKind/toKind hiểu là node", () => {
  const edges = [{ id: 1, from: 1, to: 2 }];
  const { order } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
});

test("buildTree: nhiều con giữ đúng thứ tự phát hiện", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 1, to: 3, fromKind: "node", toKind: "node" },
    { id: 3, from: 1, to: 4, fromKind: "node", toKind: "node" }
  ];
  const { children } = buildTree(edges, "node:1");
  assert.deepEqual(children.get("node:1"), ["node:2", "node:3", "node:4"]);
});

test("buildTree: chu trình không làm treo, mỗi thẻ chỉ ghé một lần", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 2, to: 3, fromKind: "node", toKind: "node" },
    { id: 3, from: 3, to: 1, fromKind: "node", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2", "node:3"]);
  assert.equal(children.has("node:3"), false);   // dây 3→1 bị bỏ, 1 đã ghé rồi
});

test("buildTree: thẻ có hai cha chỉ nhận cha gặp trước", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 1, to: 3, fromKind: "node", toKind: "node" },
    { id: 3, from: 2, to: 4, fromKind: "node", toKind: "node" },
    { id: 4, from: 3, to: 4, fromKind: "node", toKind: "node" }
  ];
  const { children } = buildTree(edges, "node:1");
  assert.deepEqual(children.get("node:2"), ["node:4"]);
  assert.equal(children.has("node:3"), false);
});

test("buildTree: dây không liên quan tới gốc không bị lôi vào cây", () => {
  const edges = [
    { id: 1, from: 1, to: 2, fromKind: "node", toKind: "node" },
    { id: 2, from: 8, to: 9, fromKind: "node", toKind: "node" }
  ];
  const { order } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
});

test("buildTree: khung (group) cũng là thành viên cây", () => {
  const edges = [
    { id: 1, from: 1, to: 5, fromKind: "node", toKind: "group" },
    { id: 2, from: 5, to: 2, fromKind: "group", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "group:5", "node:2"]);
  assert.deepEqual(children.get("group:5"), ["node:2"]);
});

test("buildTree: dây tự nối không tạo con của chính nó", () => {
  const edges = [
    { id: 1, from: 1, to: 1, fromKind: "node", toKind: "node" },
    { id: 2, from: 1, to: 2, fromKind: "node", toKind: "node" }
  ];
  const { order, children } = buildTree(edges, "node:1");
  assert.deepEqual(order, ["node:1", "node:2"]);
  assert.deepEqual(children.get("node:1"), ["node:2"]);
});

test("buildTree: gốc không có dây nào thì cây chỉ có một thẻ", () => {
  const { order, children } = buildTree([], "node:1");
  assert.deepEqual(order, ["node:1"]);
  assert.equal(children.size, 0);
});

// Thẻ vuông 100x40 cho dễ tính tay; gap mặc định depth 70, breadth 28.
const SIZE = () => ({ w: 100, h: 40 });
const E = (from, to) => ({ id: from * 100 + to, from, to, fromKind: "node", toKind: "node" });

test("treeLayout: gốc luôn giữ đúng toạ độ truyền vào, cả bốn hướng", () => {
  const edges = [E(1, 2), E(1, 3)];
  ["down", "up", "right", "left"].forEach((direction) => {
    const pos = treeLayout({
      edges, rootKey: "node:1", rootPos: { x: 500, y: 300 }, sizeOf: SIZE, direction
    });
    assert.deepEqual(pos.get("node:1"), { x: 500, y: 300 }, direction);
  });
});

test("treeLayout hướng xuống: cha nằm giữa hai con, con cách nhau đúng gap", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  // Hai con rộng 100, cách nhau 28 → khối con rộng 228, tâm khối trùng tâm cha (50).
  assert.deepEqual(pos.get("node:2"), { x: -64, y: 110 });   // 50 - 228/2 = -64
  assert.deepEqual(pos.get("node:3"), { x: 64, y: 110 });    // -64 + 100 + 28
  // Tầng 1 cách tầng 0: 40 (cao thẻ) + 70 (gap depth)
});

test("treeLayout hướng xuống: nhánh một con thì con nằm thẳng dưới cha", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(2, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  assert.deepEqual(pos.get("node:2"), { x: 0, y: 110 });
  assert.deepEqual(pos.get("node:3"), { x: 0, y: 220 });
});

test("treeLayout: mọi thẻ cùng tầng thẳng hàng theo trục sâu", () => {
  // 1 → (2, 3); 2 → 4. Thẻ 3 và 2 cùng tầng 1, thẻ 4 tầng 2.
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(2, 4)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  assert.equal(pos.get("node:2").y, pos.get("node:3").y);
  assert.equal(pos.get("node:4").y, 220);
});

test("treeLayout: nhánh nhiều con chiếm chỗ ngang rộng hơn nhánh một con", () => {
  // 1 → (2, 3); 2 → (4, 5); 3 → 6.
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(2, 4), E(2, 5), E(3, 6)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  });
  const spanOf = (a, b) => Math.abs(pos.get(b).x - pos.get(a).x);
  // Nhánh 2 có hai con nên bề ngang của nó lớn hơn nhánh 3 (một con, bề ngang 0).
  assert.equal(spanOf("node:4", "node:5"), 128);
  assert.equal(pos.get("node:6").x, pos.get("node:3").x);   // một con: thẳng dưới cha
});

test("treeLayout: kích thước thẻ thật quyết định khoảng cách", () => {
  const wide = (key) => (key === "node:2" ? { w: 300, h: 40 } : { w: 100, h: 40 });
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: wide, direction: "down"
  });
  // Thẻ 2 rộng 300 nên thẻ 3 phải đứng cách nó 300 + 28, không phải 100 + 28.
  assert.equal(pos.get("node:3").x - pos.get("node:2").x, 328);
});

test("treeLayout: thẻ cao quyết định khoảng cách tầng khi xếp dọc", () => {
  const tall = (key) => (key === "node:1" ? { w: 100, h: 200 } : { w: 100, h: 40 });
  const pos = treeLayout({
    edges: [E(1, 2)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: tall, direction: "down"
  });
  assert.equal(pos.get("node:2").y, 270);   // 200 (cao gốc) + 70 (gap)
});

test("treeLayout hướng lên là ảnh gương của hướng xuống theo trục dọc", () => {
  const args = {
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE
  };
  const down = treeLayout({ ...args, direction: "down" });
  const up = treeLayout({ ...args, direction: "up" });
  assert.equal(up.get("node:2").x, down.get("node:2").x);     // trục ngang không đổi
  assert.equal(up.get("node:2").y, -down.get("node:2").y);
  assert.equal(up.get("node:2").y, -110);
});

test("treeLayout hướng phải: tầng đi theo trục ngang, con xếp theo trục dọc", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "right"
  });
  // Tầng cách nhau theo bề ngang thẻ: 100 + 70 = 170.
  assert.equal(pos.get("node:2").x, 170);
  assert.equal(pos.get("node:3").x, 170);
  // Con xếp dọc, cách nhau theo chiều cao: 40 + 28 = 68; tâm khối trùng tâm cha (20).
  assert.deepEqual(pos.get("node:2"), { x: 170, y: -34 });    // 20 - 68/2 = -34
  assert.deepEqual(pos.get("node:3"), { x: 170, y: 34 });
});

test("treeLayout hướng trái là ảnh gương của hướng phải theo trục ngang", () => {
  const args = {
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE
  };
  const right = treeLayout({ ...args, direction: "right" });
  const left = treeLayout({ ...args, direction: "left" });
  assert.equal(left.get("node:2").y, right.get("node:2").y);   // trục dọc không đổi
  assert.equal(left.get("node:2").x, -right.get("node:2").x);
  assert.equal(left.get("node:2").x, -170);
});

test("treeLayout: cha to hơn tổng các con thì con dồn vào giữa dưới cha", () => {
  const bigRoot = (key) => (key === "node:1" ? { w: 500, h: 40 } : { w: 100, h: 40 });
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: bigRoot, direction: "down"
  });
  // Gốc rộng 500 (tâm 250); khối hai con rộng 228 → dồn vào giữa: 250 - 114 = 136.
  assert.deepEqual(pos.get("node:2"), { x: 136, y: 110 });
  assert.deepEqual(pos.get("node:3"), { x: 264, y: 110 });
});

test("treeLayout: gốc không có dây nào thì map chỉ chứa gốc", () => {
  const pos = treeLayout({
    edges: [], rootKey: "node:1", rootPos: { x: 7, y: 9 }, sizeOf: SIZE, direction: "down"
  });
  assert.equal(pos.size, 1);
  assert.deepEqual(pos.get("node:1"), { x: 7, y: 9 });
});

const CENTER_SIZE = () => ({ w: 0, h: 0 });   // tâm thẻ trùng x/y, dễ tính "nằm trong khung"

test("carryGroupMembers: khung dời chỗ kéo theo thẻ không có dây nối riêng", () => {
  const group = { id: 5, x: 0, y: 0, w: 200, h: 200 };
  const node = { id: 1, x: 50, y: 50 };
  const pos = new Map([[edgeKey("group", 5), { x: 100, y: 100 }]]);
  const extra = carryGroupMembers(pos, [group], [node], CENTER_SIZE);
  assert.deepEqual(extra.get(1), { x: 150, y: 150 });
});

test("carryGroupMembers: thẻ đã có chỗ riêng trong cây thì không bị dời thêm", () => {
  const group = { id: 5, x: 0, y: 0, w: 200, h: 200 };
  const node = { id: 2, x: 50, y: 50 };
  const pos = new Map([
    [edgeKey("group", 5), { x: 100, y: 100 }],
    [edgeKey("node", 2), { x: 999, y: 999 }]
  ]);
  const extra = carryGroupMembers(pos, [group], [node], CENTER_SIZE);
  assert.equal(extra.has(2), false);
});

test("carryGroupMembers: khung khoá thì không kéo theo thẻ", () => {
  const group = { id: 5, x: 0, y: 0, w: 200, h: 200, locked: true };
  const node = { id: 1, x: 50, y: 50 };
  const pos = new Map([[edgeKey("group", 5), { x: 100, y: 100 }]]);
  const extra = carryGroupMembers(pos, [group], [node], CENTER_SIZE);
  assert.equal(extra.size, 0);
});

test("carryGroupMembers: thẻ khoá đứng yên dù khung của nó dời chỗ", () => {
  const group = { id: 5, x: 0, y: 0, w: 200, h: 200 };
  const node = { id: 1, x: 50, y: 50, locked: true };
  const pos = new Map([[edgeKey("group", 5), { x: 100, y: 100 }]]);
  const extra = carryGroupMembers(pos, [group], [node], CENTER_SIZE);
  assert.equal(extra.size, 0);
});

test("carryGroupMembers: khung đứng yên (gốc của cây) thì không dời thẻ nào", () => {
  const group = { id: 5, x: 0, y: 0, w: 200, h: 200 };
  const node = { id: 1, x: 50, y: 50 };
  const pos = new Map([[edgeKey("group", 5), { x: 0, y: 0 }]]);
  const extra = carryGroupMembers(pos, [group], [node], CENTER_SIZE);
  assert.equal(extra.size, 0);
});

test("carryGroupMembers: thẻ ngoài khung không bị ảnh hưởng", () => {
  const group = { id: 5, x: 0, y: 0, w: 200, h: 200 };
  const node = { id: 1, x: 500, y: 500 };
  const pos = new Map([[edgeKey("group", 5), { x: 100, y: 100 }]]);
  const extra = carryGroupMembers(pos, [group], [node], CENTER_SIZE);
  assert.equal(extra.size, 0);
});

test("splitBranches: một hướng thì giữ nguyên cả hàng con", () => {
  assert.deepEqual(splitBranches(["a", "b", "c"], () => 1, 1), [["a", "b", "c"]]);
});

test("splitBranches: nhánh nặng và nhánh nhẹ chia về hai phía cho cân", () => {
  // Trọng số 10, 1, 1: nhánh 10 một mình một phía, hai nhánh nhỏ gom phía kia.
  const w = { a: 10, b: 1, c: 1 };
  assert.deepEqual(splitBranches(["a", "b", "c"], (k) => w[k], 2), [["a"], ["b", "c"]]);
});

test("splitBranches: trong mỗi phía vẫn giữ đúng thứ tự nối dây", () => {
  const w = { a: 1, b: 5, c: 1, d: 5 };
  // b và d (nặng 5) chia mỗi phía một cái, a và c (nhẹ) lấp vào; trong từng phía
  // thứ tự chạy lại theo chỉ số ban đầu chứ không theo thứ tự được chia.
  const [one, two] = splitBranches(["a", "b", "c", "d"], (k) => w[k], 2);
  assert.deepEqual(one, ["a", "b"]);
  assert.deepEqual(two, ["c", "d"]);
});

test("splitBranches: bốn hướng nhưng chỉ hai nhánh thì hai phía rỗng", () => {
  assert.deepEqual(splitBranches(["a", "b"], () => 1, 4), [["a"], ["b"], [], []]);
});

test("treeLayout: hai hướng lên+xuống tách cây ra hai phía của gốc", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, directions: ["down", "up"]
  });
  assert.deepEqual(pos.get("node:1"), { x: 0, y: 0 });
  // Mỗi phía một con, nên con nằm thẳng trên/dưới gốc chứ không lệch sang bên.
  assert.deepEqual(pos.get("node:2"), { x: 0, y: 110 });
  assert.deepEqual(pos.get("node:3"), { x: 0, y: -110 });
});

test("treeLayout: hai hướng thì con cháu đi theo đúng phía của nhánh mình", () => {
  // 1 → (2, 3); 2 → 4; 3 → 5. Cháu phải cùng phía với cha nó.
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(2, 4), E(3, 5)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, directions: ["down", "up"]
  });
  assert.equal(Math.sign(pos.get("node:4").y), Math.sign(pos.get("node:2").y));
  assert.equal(Math.sign(pos.get("node:5").y), Math.sign(pos.get("node:3").y));
  assert.equal(Math.abs(pos.get("node:4").y), 220);
  assert.equal(Math.abs(pos.get("node:5").y), 220);
});

test("treeLayout: hai hướng cân theo bề rộng nhánh, không cắt theo số lượng", () => {
  // 1 → (2, 3, 4); nhánh 2 có ba con nên nặng hơn hẳn → đi một mình một phía.
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(1, 4), E(2, 5), E(2, 6), E(2, 7)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, directions: ["down", "up"]
  });
  const side = (k) => Math.sign(pos.get(k).y);
  assert.notEqual(side("node:2"), side("node:3"));
  assert.equal(side("node:3"), side("node:4"));
});

test("treeLayout: trộn trục dọc và ngang cũng chạy, gốc vẫn đứng yên", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 40, y: 60 }, sizeOf: SIZE, directions: ["up", "right"]
  });
  assert.deepEqual(pos.get("node:1"), { x: 40, y: 60 });
  assert.equal(pos.size, 3);
  const away = Array.from(pos.entries()).filter(([k]) => k !== "node:1");
  assert.equal(away.some(([, p]) => p.y < 60), true);   // một nhánh đi lên
  assert.equal(away.some(([, p]) => p.x > 40), true);   // nhánh kia sang phải
});

test("treeLayout: bốn hướng cùng lúc thì mỗi nhánh một phía", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(1, 3), E(1, 4), E(1, 5)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, directions: ["down", "up", "right", "left"]
  });
  assert.equal(pos.size, 5);
  const spots = ["node:2", "node:3", "node:4", "node:5"].map((k) => pos.get(k));
  assert.equal(spots.filter((p) => p.y > 0).length, 1);
  assert.equal(spots.filter((p) => p.y < 0).length, 1);
  assert.equal(spots.filter((p) => p.x > 0).length, 1);
  assert.equal(spots.filter((p) => p.x < 0).length, 1);
});

test("treeLayout: gap.depth quyết định khoảng cách giữa các cấp", () => {
  const pos = treeLayout({
    edges: [E(1, 2), E(2, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down", gap: { depth: 200 }
  });
  assert.equal(pos.get("node:2").y, 240);   // 40 (cao thẻ) + 200
  assert.equal(pos.get("node:3").y, 480);
});

test("treeLayout: gap.leaf chỉ nới hai lá kề nhau, không đụng khoảng cách nhánh", () => {
  // 1 → (2, 3); 2 → (4, 5). Thẻ 4,5 là lá kề nhau; 2 và 3 không phải cả hai đều lá.
  const args = {
    edges: [E(1, 2), E(1, 3), E(2, 4), E(2, 5)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  };
  const tight = treeLayout({ ...args, gap: { breadth: 40, leaf: 10 } });
  const loose = treeLayout({ ...args, gap: { breadth: 40, leaf: 100 } });
  assert.equal(tight.get("node:5").x - tight.get("node:4").x, 110);   // 100 + 10
  assert.equal(loose.get("node:5").x - loose.get("node:4").x, 200);   // 100 + 100
});

test("treeLayout: gap.leaf không truyền thì bằng gap.breadth", () => {
  const args = {
    edges: [E(1, 2), E(1, 3)], rootKey: "node:1",
    rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction: "down"
  };
  const a = treeLayout({ ...args, gap: { breadth: 50 } });
  const b = treeLayout({ ...args, gap: { breadth: 50, leaf: 50 } });
  assert.deepEqual(a.get("node:3"), b.get("node:3"));
});

test("treeLayout: nhiều hướng, thẻ vẫn không chồng nhau", () => {
  const edges = [
    E(1, 2), E(1, 3), E(1, 4), E(1, 5),
    E(2, 6), E(2, 7), E(3, 8), E(4, 9), E(4, 10), E(6, 11)
  ];
  [["down", "up"], ["right", "left"], ["down", "up", "right", "left"]].forEach((directions) => {
    const pos = treeLayout({
      edges, rootKey: "node:1", rootPos: { x: 0, y: 0 }, sizeOf: SIZE, directions,
      gap: { depth: 80, breadth: 40, leaf: 20 }
    });
    assert.equal(pos.size, 11, directions.join("+"));
    const rects = Array.from(pos.entries()).map(([key, p]) => ({ key, ...p, ...SIZE() }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w &&
          a.y < b.y + b.h && b.y < a.y + a.h;
        assert.equal(overlap, false, `${directions.join("+")}: ${a.key} chồng ${b.key}`);
      }
    }
  });
});

test("treeLayout: cây nhiều tầng nhiều nhánh không có hai thẻ nào chồng nhau", () => {
  const edges = [
    E(1, 2), E(1, 3), E(1, 4),
    E(2, 5), E(2, 6),
    E(3, 7),
    E(4, 8), E(4, 9), E(4, 10),
    E(5, 11), E(9, 12)
  ];
  ["down", "up", "right", "left"].forEach((direction) => {
    const pos = treeLayout({
      edges, rootKey: "node:1", rootPos: { x: 0, y: 0 }, sizeOf: SIZE, direction
    });
    assert.equal(pos.size, 12, direction);
    const rects = Array.from(pos.entries()).map(([key, p]) => {
      const { w, h } = SIZE(key);
      return { key, x: p.x, y: p.y, w, h };
    });
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w &&
          a.y < b.y + b.h && b.y < a.y + a.h;
        assert.equal(overlap, false, `${direction}: ${a.key} chồng ${b.key}`);
      }
    }
  });
});
