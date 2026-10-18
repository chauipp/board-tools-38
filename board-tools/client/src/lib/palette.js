import { BADGE_PALETTE } from "./badges.js";

// Màu tự tạo mang token "pal-<id>", dùng y như token cố định ("dot-1"): mọi chỗ
// vẽ đều đi qua colorVar() → var(--pal-<id>). Giá trị thật do paletteCss() khai
// báo trong một thẻ <style> duy nhất, nên sửa hex là cả bản đồ đổi theo.
export function paletteCss(palette) {
  if (!palette.length) return "";
  return `:root {\n${palette.map((c) => `  --pal-${c.id}: ${c.hex};`).join("\n")}\n}`;
}

export function applyColorTo(board, target, color) {
  const { kind, id } = target;
  const set = (o) => (o.id === id ? { ...o, color } : o);
  if (kind === "node") return { ...board, nodes: board.nodes.map(set) };
  if (kind === "edge") return { ...board, edges: board.edges.map(set) };
  if (kind === "status") return { ...board, statuses: board.statuses.map(set) };
  if (kind === "tag") return { ...board, tags: board.tags.map(set) };
  return board;
}

export function removePaletteColor(board, id) {
  const token = `pal-${id}`;
  // Để nguyên token đã chết thì swatch mới trùng id sẽ làm các thẻ cũ "sống lại"
  // với màu khác — nên gỡ sạch ngay trong cùng một commit.
  const clear = (o) => (o.color === token ? { ...o, color: null } : o);
  const fallback = (o) => (o.color === token ? { ...o, color: BADGE_PALETTE[0] } : o);
  return {
    ...board,
    palette: board.palette.filter((c) => c.id !== id),
    nodes: board.nodes.map(clear),
    edges: board.edges.map(clear),
    statuses: board.statuses.map(fallback),
    tags: board.tags.map(fallback)
  };
}
