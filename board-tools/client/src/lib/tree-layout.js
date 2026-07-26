// Cây dựng từ dây nối, không phải từ toạ độ: một thẻ là con của thẻ nào phụ
// thuộc vào đường đi ngắn nhất từ gốc, nên duyệt theo chiều rộng (BFS).
export function edgeKey(kind, id) {
  return kind + ":" + id;
}

export function buildTree(edges, rootKey) {
  // Dây coi là hai chiều: mũi tên chỉ hướng nào không nói gì về quan hệ cha-con
  // trên bản đồ ý tưởng — nối là có quan hệ.
  const neighbors = new Map();
  function link(a, b) {
    if (a === b) return;                      // dây tự nối: không phải quan hệ
    if (!neighbors.has(a)) neighbors.set(a, []);
    neighbors.get(a).push(b);
  }
  edges.forEach((e) => {
    const a = edgeKey(e.fromKind || "node", e.from);
    const b = edgeKey(e.toKind || "node", e.to);
    link(a, b);
    link(b, a);
  });

  const order = [rootKey];
  const children = new Map();
  const visited = new Set([rootKey]);
  // BFS: thẻ đã ghé thì bỏ qua, nên chu trình tự dừng và thẻ có hai "cha" chỉ
  // thuộc về cha gặp trước — không cần dò vòng lặp riêng.
  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    (neighbors.get(key) || []).forEach((next) => {
      if (visited.has(next)) return;
      visited.add(next);
      order.push(next);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(next);
    });
  }
  return { order, children };
}
