export const BADGE_PALETTE = [
  "st-idea", "st-considering", "st-chosen", "st-parked", "st-rejected",
  "dot-1", "dot-2", "dot-3", "dot-4", "dot-5", "dot-6", "dot-7", "dot-8"
];

export function colorVar(token) {
  return `var(--${token})`;
}

export function statusById(board, id) {
  return board.statuses.find((s) => s.id === id) || null;
}

export function tagById(board, id) {
  return board.tags.find((t) => t.id === id) || null;
}
