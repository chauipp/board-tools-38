import { rebaseBoard } from "./rebase.js";

// Ordered oldest to newest. Keep only the contiguous, safe end of the stack.
export function reconcileHistory(snapshots, previous, incoming) {
  const reconciled = [];
  for (let index = snapshots.length - 1; index >= 0; index--) {
    const snapshot = rebaseBoard(snapshots[index], previous, incoming, { strict: true });
    if (!snapshot) break;
    reconciled.push(snapshot);
  }
  return reconciled.reverse();
}
