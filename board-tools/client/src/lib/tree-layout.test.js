import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, edgeKey } from "./tree-layout.js";

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

test("buildTree: dây ngược chiều vẫn tính là quan hệ cha-con", () => {
  // Dây vẽ từ 2 sang 1, nhưng gốc là 1 → 2 vẫn phải là con của 1.
  const edges = [{ id: 1, from: 2, to: 1, fromKind: "node", toKind: "node" }];
  const { children } = buildTree(edges, "node:1");
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
