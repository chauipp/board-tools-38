export const BADGE_PALETTE = [
  "st-idea", "st-considering", "st-chosen", "st-parked", "st-rejected",
  "dot-1", "dot-2", "dot-3", "dot-4", "dot-5", "dot-6", "dot-7", "dot-8"
];

export function colorVar(token) {
  return `var(--${token})`;
}

// Chọn đen/trắng theo tỉ lệ tương phản WCAG thật với hex nền, để badge màu nào cũng đọc được.
export function pickInk(hex) {
  const m = hex && /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const lin = (c) => { c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [0, 2, 4].map((i) => lin(full.slice(i, i + 2)));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onBlack = (luminance + 0.05) / 0.05;
  const onWhite = 1.05 / (luminance + 0.05);
  return onBlack > onWhite ? "#000" : "#fff";
}

// Bảng token là mở (kể cả pal-N tuỳ chỉnh) nên không tra cứu hex tĩnh được —
// đọc thẳng giá trị CSS var đã resolve theo theme hiện tại.
export function contrastInk(token) {
  if (!token) return "#fff";
  return pickInk(getComputedStyle(document.documentElement).getPropertyValue(`--${token}`));
}

export function statusById(board, id) {
  return board.statuses.find((s) => s.id === id) || null;
}

export function tagById(board, id) {
  return board.tags.find((t) => t.id === id) || null;
}
