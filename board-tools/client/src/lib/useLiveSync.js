import { useEffect } from "react";

// Gói board:update đến sau bản mới nhất mình đã áp dụng (mạng giao gói
// không theo thứ tự, hoặc gói lặp) bị bỏ qua thay vì đè lùi board về
// trạng thái cũ hơn. Tái dùng `updatedAt` server đã có sẵn trên mỗi lần
// lưu — không cần thêm field rev mới.
export function isStaleUpdate(localUpdatedAt, incomingUpdatedAt) {
  if (!incomingUpdatedAt) return true;
  if (!localUpdatedAt) return false;
  return new Date(incomingUpdatedAt).getTime() <= new Date(localUpdatedAt).getTime();
}

// Trộn board:update từ người khác vào board hiện tại:
// - Giữ nguyên đúng 1 thẻ đang được sửa tại chỗ (editingId) — tránh xoá
//   mất chữ đang gõ dở của chính người xem.
// - Giữ nguyên view (camera) — camera là riêng từng người, không đồng bộ.
export function mergeRemoteBoard(local, incoming, editingId) {
  const merged = { ...local, ...incoming, view: local.view };
  if (editingId != null) {
    const localNode = local.nodes.find((n) => n.id === editingId);
    if (localNode) {
      merged.nodes = merged.nodes.map((n) => (n.id === editingId ? localNode : n));
    }
  }
  return merged;
}

// Một socket cho mỗi board (usePresence.js sở hữu kết nối) — hook này chỉ
// lắng nghe thêm sự kiện trên socket có sẵn, không tự mở kết nối mới.
// boardRef/editingIdRef/lastUpdatedAtRef đọc qua ref để luôn lấy giá trị
// mới nhất trong closure của socket handler, cùng lý do các ref khác
// trong IdeaMap.jsx đã dùng (xem comment cạnh roleRef).
export function useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard) {
  useEffect(() => {
    if (!socket) return;
    function onBoardUpdate(incoming) {
      if (!boardRef.current) return;
      if (isStaleUpdate(lastUpdatedAtRef.current, incoming.updatedAt)) return;
      lastUpdatedAtRef.current = incoming.updatedAt;
      applyRemoteBoard(mergeRemoteBoard(boardRef.current, incoming, editingIdRef.current));
    }
    socket.on("board:update", onBoardUpdate);
    return () => socket.off("board:update", onBoardUpdate);
  }, [socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard]);
}
