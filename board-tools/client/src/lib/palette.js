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
  // Nét bút / hình khối / chữ. Token màu bảng ("dot-3", "pal-7") dùng thẳng được
  // trên nét vẽ vì cả hai hệ đều vẽ ra `var(--token)` — thả màu bảng vào một nét
  // là nét đó rời hệ bảy màu bút sang hệ màu bảng, và đó là điều người dùng
  // thấy đúng: trên bảng chỉ có MỘT hộp màu.
  if (kind === "drawing") return { ...board, drawings: (board.drawings || []).map(set) };
  return board;
}

// Thả màu vào một thẻ/dây đang nằm trong vùng chọn nhiều thì cả vùng chọn nhận.
// Chỉ nhận "node" và "edge": badge (status/tag) là ĐỊNH NGHĨA dùng chung cho cả
// bảng, không phải đối tượng chọn được, nên không có "vùng chọn badge" nào để áp.
export function applyColorToMany(board, kind, ids, color) {
  const idSet = ids instanceof Set ? ids : new Set(ids);
  if (idSet.size === 0) return board;
  const set = (o) => (idSet.has(o.id) ? { ...o, color } : o);
  if (kind === "node") return { ...board, nodes: board.nodes.map(set) };
  if (kind === "edge") return { ...board, edges: board.edges.map(set) };
  if (kind === "drawing") return { ...board, drawings: (board.drawings || []).map(set) };
  return board;
}

export function removePaletteColor(board, id) {
  const token = `pal-${id}`;
  // Để nguyên token đã chết thì swatch mới trùng id sẽ làm các thẻ cũ "sống lại"
  // với màu khác — nên gỡ sạch ngay trong cùng một commit.
  const clear = (o) => (o.color === token ? { ...o, color: null } : o);
  const fallback = (o) => (o.color === token ? { ...o, color: BADGE_PALETTE[0] } : o);
  // Nét vẽ KHÔNG được về null: thẻ không màu thì vẫn là cái thẻ, còn nét vẽ
  // không màu là `var(--null)` — một nét vô hình. Trả nó về mực đen của hệ màu
  // bút, thứ gần nhất với "không màu gì đặc biệt".
  const toInk = (o) => (o.color === token ? { ...o, color: "pen-mono" } : o);
  return {
    ...board,
    palette: board.palette.filter((c) => c.id !== id),
    nodes: board.nodes.map(clear),
    edges: board.edges.map(clear),
    drawings: (board.drawings || []).map(toInk),
    statuses: board.statuses.map(fallback),
    tags: board.tags.map(fallback)
  };
}
