// Camera (pan/zoom) là riêng từng người xem — không còn đồng bộ qua server
// (xem docs/superpowers/specs/2026-07-26-idea-map-realtime-sync-design.md,
// mục E). Lưu local theo từng board.
const PREFIX = "idea-map-camera:";

export function loadCamera(storage, boardId) {
  let v = null;
  try {
    v = JSON.parse(storage.getItem(PREFIX + boardId));
  } catch {
    return null;
  }
  if (typeof v?.panX !== "number" || typeof v?.panY !== "number" || typeof v?.scale !== "number") return null;
  return { panX: v.panX, panY: v.panY, scale: v.scale };
}

export function saveCamera(storage, boardId, view) {
  try {
    storage.setItem(PREFIX + boardId, JSON.stringify({ panX: view.panX, panY: view.panY, scale: view.scale }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất vị trí camera, không đáng làm sập app.
  }
}
