import { clipToRect, rectForEndpoint } from "./board-geometry.js";

const PAD = 60, SCALE = 2;

export function drawBoardToCanvas(board, sizeOf, theme) {
  // theme: { bg, surface, line, ink, inkDim, accent, colorOf(token) -> css color }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  board.nodes.forEach((n) => {
    const { w, h } = sizeOf(n.id);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  });
  board.groups.forEach((g) => {
    minX = Math.min(minX, g.x); minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w); maxY = Math.max(maxY, g.y + g.h);
  });
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  const w = Math.ceil(maxX - minX + PAD * 2), h = Math.ceil(maxY - minY + PAD * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w * SCALE; canvas.height = h * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.translate(PAD - minX, PAD - minY);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(minX - PAD, minY - PAD, w, h);

  ctx.font = "11px sans-serif";
  board.groups.forEach((g) => {
    ctx.strokeStyle = g.color ? theme.colorOf(g.color) : theme.line;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.setLineDash([]);
    ctx.fillStyle = theme.inkDim;
    ctx.fillText(g.title || "", g.x + 10, g.y - 6);
  });

  board.edges.forEach((e) => {
    const r1 = rectForEndpoint(e.fromKind || "node", e.from, board.nodes, board.groups, sizeOf);
    const r2 = rectForEndpoint(e.toKind || "node", e.to, board.nodes, board.groups, sizeOf);
    if (!r1 || !r2) return;
    const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
    const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
    ctx.strokeStyle = theme.inkDim;
    ctx.lineWidth = 1.4;
    if (e.style === "dashed") ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - 8 * Math.cos(ang - 0.4), p2.y - 8 * Math.sin(ang - 0.4));
    ctx.lineTo(p2.x - 8 * Math.cos(ang + 0.4), p2.y - 8 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = theme.inkDim;
    ctx.fill();
    if (e.label) {
      ctx.fillStyle = theme.inkDim;
      ctx.fillText(e.label, (p1.x + p2.x) / 2 - ctx.measureText(e.label).width / 2, (p1.y + p2.y) / 2 - 5);
    }
  });

  board.nodes.forEach((n) => {
    const { w: cw, h: ch } = sizeOf(n.id);
    ctx.fillStyle = theme.surface;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(n.x, n.y, cw, ch, 6);
    ctx.fill(); ctx.stroke();
    if (n.color) {
      ctx.fillStyle = theme.colorOf(n.color);
      ctx.fillRect(n.x, n.y + 1, 4, ch - 2);
    }
    ctx.fillStyle = theme.ink;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(n.title, n.x + 10, n.y + 18, cw - 20);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = theme.inkDim;
    const desc = (n.desc || "").replace(/\n/g, " ");
    if (desc) ctx.fillText(desc.length > 60 ? desc.slice(0, 57) + "…" : desc, n.x + 10, n.y + 34, cw - 20);
  });

  return canvas;
}
