import { useCallback, useEffect, useRef, useState } from "react";

const GEOM_THROTTLE_MS = 80;
const GEOM_TTL_MS = 400;

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

// Chỉ gửi vị trí/kích thước — KHÔNG BAO GIỜ gửi ảnh/tiêu đề/mô tả. Ảnh nhúng
// base64 thẳng trong node; gửi lại nguyên node mỗi ~80ms lúc đang kéo sẽ
// rất nặng nếu thẻ có ảnh lớn.
export function projectGeometry(board) {
  return {
    nodes: board.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w })),
    groups: board.groups.map((g) => ({ id: g.id, x: g.x, y: g.y, w: g.w, h: g.h }))
  };
}

// Map<key, value> tự xoá entry sau `ttlMs` không có cập nhật mới — không
// cần sự kiện "kết thúc kéo" riêng: nếu người kéo mất kết nối giữa chừng,
// overlay tự hết hạn thay vì treo vị trí cũ mãi. upsert nhận value hoặc
// updater (prev) => value, giống setState, để caller merge từng phần (vd
// live text chỉ có 1 field mỗi lần) mà không cần đọc `map` trực tiếp.
function useTtlOverlay(ttlMs) {
  const [map, setMap] = useState(new Map());
  const timersRef = useRef(new Map());

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
  }, []);

  const upsert = useCallback((key, valueOrUpdater) => {
    setMap((prev) => {
      const value = typeof valueOrUpdater === "function" ? valueOrUpdater(prev.get(key)) : valueOrUpdater;
      return new Map(prev).set(key, value);
    });
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      timersRef.current.delete(key);
      setMap((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }, ttlMs);
    timersRef.current.set(key, timer);
  }, [ttlMs]);

  return { map, upsert };
}

// Một socket cho mỗi board (usePresence.js sở hữu kết nối) — hook này chỉ
// lắng nghe thêm sự kiện trên socket có sẵn, không tự mở kết nối mới.
// boardRef/editingIdRef/lastUpdatedAtRef đọc qua ref để luôn lấy giá trị
// mới nhất trong closure của socket handler, cùng lý do các ref khác
// trong IdeaMap.jsx đã dùng (xem comment cạnh roleRef).
export function useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard) {
  const geom = useTtlOverlay(GEOM_TTL_MS);
  const lastGeomSentRef = useRef(0);
  const geomTimerRef = useRef(null);

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

  useEffect(() => {
    if (!socket) return;
    function onLiveGeom(payload) {
      const at = Date.now();
      for (const n of payload.nodes || []) geom.upsert("node:" + n.id, { x: n.x, y: n.y, w: n.w, at });
      for (const g of payload.groups || []) geom.upsert("group:" + g.id, { x: g.x, y: g.y, w: g.w, h: g.h, at });
    }
    socket.on("live:geom", onLiveGeom);
    return () => socket.off("live:geom", onLiveGeom);
  }, [socket, geom.upsert]);

  // Một effect DUY NHẤT theo dõi `board` — không cần sửa từng handler kéo
  // (card, khung, resize ảnh, resize khung...) vì tất cả đều đã tự cập
  // nhật `board` mỗi mousemove để vẽ cho chính người kéo thấy. Effect này
  // "ăn theo" đúng cơ chế đó, throttle riêng ở đầu gửi.
  const boardForGeom = boardRef.current;
  useEffect(() => {
    if (!socket || !boardForGeom) return;
    const projected = projectGeometry(boardForGeom);
    const elapsed = Date.now() - lastGeomSentRef.current;
    function send() {
      lastGeomSentRef.current = Date.now();
      socket.emit("live:geom", projected);
    }
    if (elapsed >= GEOM_THROTTLE_MS) {
      send();
    } else {
      if (geomTimerRef.current) clearTimeout(geomTimerRef.current);
      geomTimerRef.current = setTimeout(send, GEOM_THROTTLE_MS - elapsed);
    }
    return () => { if (geomTimerRef.current) clearTimeout(geomTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, boardForGeom]);

  return { geomOverlay: geom.map };
}
