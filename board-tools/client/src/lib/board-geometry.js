export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// Đường dây chọn được qua marquee nếu 1 trong 2 đầu nằm trong khung, hoặc
// đoạn dây cắt qua một trong 4 cạnh khung — giống kiểu "crossing selection"
// của Figma, không cần bao trọn cả dây.
export function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;
  const { x, y, w, h } = rect;
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners[i];
    const [dx, dy] = corners[(i + 1) % 4];
    if (segmentsIntersect(x1, y1, x2, y2, cx, cy, dx, dy)) return true;
  }
  return false;
}

export function nodesInFrame(nodes, frame, sizeOf) {
  return nodes
    .filter((n) => {
      const { w, h } = sizeOf(n.id);
      return pointInRect(n.x + w / 2, n.y + h / 2, frame);
    })
    .map((n) => n.id);
}

export function edgeEndpoint(kind, id, nodes, groups, sizeOf) {
  if (kind === "group") {
    const g = groups.find((gr) => gr.id === id);
    return g ? { x: g.x + g.w / 2, y: g.y + g.h / 2 } : null;
  }
  const n = nodes.find((nn) => nn.id === id);
  if (!n) return null;
  const { w, h } = sizeOf(id);
  return { x: n.x + w / 2, y: n.y + h / 2 };
}

export function edgesMatch(edge, a, aKind, b, bKind) {
  const fromKind = edge.fromKind || "node";
  const toKind = edge.toKind || "node";
  return (
    (edge.from === a && fromKind === aKind && edge.to === b && toKind === bKind) ||
    (edge.from === b && fromKind === bKind && edge.to === a && toKind === aKind)
  );
}

export function clipToRect(cx, cy, w, h, tx, ty) {
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tCandidates = [];
  if (dx !== 0) tCandidates.push((w / 2) / Math.abs(dx));
  if (dy !== 0) tCandidates.push((h / 2) / Math.abs(dy));
  const t = Math.min(...tCandidates);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function rectForEndpoint(kind, id, nodes, groups, sizeOf) {
  if (kind === "group") {
    const g = groups.find((gr) => gr.id === id);
    return g ? { cx: g.x + g.w / 2, cy: g.y + g.h / 2, w: g.w, h: g.h } : null;
  }
  const n = nodes.find((nn) => nn.id === id);
  if (!n) return null;
  const { w, h } = sizeOf(id);
  return { cx: n.x + w / 2, cy: n.y + h / 2, w, h };
}
