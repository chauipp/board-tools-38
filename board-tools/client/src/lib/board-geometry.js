export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
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
