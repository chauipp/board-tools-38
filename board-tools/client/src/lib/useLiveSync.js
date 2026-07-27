import { useCallback, useEffect, useRef, useState } from "react";
import { trailingThrottle } from "./raf-throttle.js";

// ~16 gói/giây lúc kéo. Mắt không phân biệt được với 60 gói/giây, còn số lần
// render bên người xem và tải đường truyền giảm gần 4 lần.
const GEOM_SEND_MS = 60;
// Gói "đang kéo" hết hạn nhanh: người kéo rớt mạng giữa chừng thì thẻ trở về vị
// trí thật sau chưa đầy một giây, thay vì treo mãi ở chỗ tạm.
const GEOM_LIVE_TTL_MS = 900;
// Gói CUỐI (done) phải sống lâu hơn hẳn: nó có nhiệm vụ cầm cự cho tới khi
// board:update chính thức của lần lưu đó về tới nơi. Nếu nó hết hạn trước, thẻ
// rơi về vị trí cũ rồi mới nhảy tới vị trí mới — đúng hiện tượng "giật đi giật
// lại giữa hai vị trí".
const GEOM_SETTLE_TTL_MS = 6000;
const TEXT_SEND_MS = 150;
const TEXT_TTL_MS = 2000;
const SWEEP_MS = 300;
// Sau khi mình thả chuột, gói geom muộn của người khác (chụp lúc màn hình họ
// còn thấy vị trí cũ) vẫn có thể tới nơi. Trong khoảng này mình bỏ qua chúng
// cho đúng những item mình vừa kéo.
const LOCAL_DRAG_GRACE_MS = 1500;

const EMPTY_MAP = new Map();

// Gói board:update đến sau bản mới nhất mình đã áp dụng (mạng giao gói không
// theo thứ tự, hoặc gói lặp) bị bỏ qua thay vì đè lùi board về trạng thái cũ
// hơn. Tái dùng `updatedAt` server đã có sẵn trên mỗi lần lưu.
export function isStaleUpdate(localUpdatedAt, incomingUpdatedAt) {
  if (!incomingUpdatedAt) return true;
  if (!localUpdatedAt) return false;
  return new Date(incomingUpdatedAt).getTime() <= new Date(localUpdatedAt).getTime();
}

// Trộn board:update từ người khác vào board hiện tại:
// - Giữ nguyên đúng 1 thẻ đang được sửa tại chỗ (editingId) — tránh xoá mất chữ
//   đang gõ dở của chính người xem.
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
// base64 thẳng trong node; gửi lại nguyên node lúc đang kéo sẽ rất nặng.
// Nhận vào MỘT TẬP item (thường là đúng những thẻ đang bị kéo), không phải cả
// board: kéo một thẻ trong bảng 200 thẻ chỉ tốn một gói một phần tử.
export function projectGeometry(items) {
  return {
    nodes: (items.nodes || []).map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w })),
    groups: (items.groups || []).map((g) => ({ id: g.id, x: g.x, y: g.y, w: g.w, h: g.h }))
  };
}

// Áp overlay hình học lên một danh sách node/group CHỈ ĐỂ VẼ. Tách thành hàm
// riêng vì thẻ, khung và lớp dây SVG bắt buộc phải nhìn cùng một toạ độ: nếu
// dây vẫn tính từ board gốc thì lúc người khác kéo, thẻ chạy còn dây đứng im.
// Item không có trong overlay được trả về nguyên tham chiếu cũ (và cả mảng cũng
// vậy khi overlay rỗng) để React không phải dựng lại cây khi không ai kéo.
export function applyGeomOverlay(items, overlay, prefix) {
  if (!overlay.size) return items;
  return items.map((it) => {
    const live = overlay.get(prefix + it.id);
    if (!live) return it;
    const next = { ...it, x: live.x, y: live.y };
    if (live.w != null) next.w = live.w;
    if (live.h != null) next.h = live.h;
    return next;
  });
}

// Trộn một gói live:geom vào overlay. Trả về CHÍNH map cũ khi không có gì đổi,
// để React bỏ qua trọn một lượt render (người kia giữ chuột đứng yên vẫn phát
// gói giữ nhịp, không có lý do gì phải vẽ lại vì thế).
export function mergeGeomPacket(prev, packet, now, skipKey) {
  const ttl = packet && packet.done ? GEOM_SETTLE_TTL_MS : GEOM_LIVE_TTL_MS;
  let next = null;
  function put(key, value) {
    if (skipKey && skipKey(key)) return;
    const cur = prev.get(key);
    const same = cur && cur.x === value.x && cur.y === value.y && cur.w === value.w && cur.h === value.h;
    if (same && cur.expiresAt - now > ttl / 2) return;
    if (!next) next = new Map(prev);
    next.set(key, { ...value, expiresAt: now + ttl });
  }
  for (const n of (packet && packet.nodes) || []) put("node:" + n.id, { x: n.x, y: n.y, w: n.w });
  for (const g of (packet && packet.groups) || []) put("group:" + g.id, { x: g.x, y: g.y, w: g.w, h: g.h });
  return next || prev;
}

// Một bộ quét chung cho cả overlay hình học lẫn overlay chữ, chạy theo nhịp
// SWEEP_MS. Bản cũ đặt MỘT setTimeout cho MỖI khoá và huỷ/đặt lại nó ở mỗi gói
// — bảng 100 thẻ là hơn một nghìn lần tạo/huỷ timer mỗi giây.
export function sweepExpired(prev, now) {
  if (!prev.size) return prev;
  let next = null;
  for (const [key, value] of prev) {
    if (value.expiresAt > now) continue;
    if (!next) next = new Map(prev);
    next.delete(key);
  }
  return next || prev;
}

// Sau khi áp một board:update chính thức, overlay nào đã được board thật bắt
// kịp phải bỏ NGAY. Giữ lại nghĩa là tiếp tục vẽ một vị trí tạm (cũ hơn) đè lên
// dữ liệu thật vừa nhận. Overlay còn LỆCH với board thì giữ nguyên: nó mới hơn
// — cú kéo của người khác đang bay, hoặc lần lưu của họ chưa kịp về.
export function reconcileGeomOverlay(prev, board) {
  if (!prev.size || !board) return prev;
  let next = null;
  function drop(key, item, withHeight) {
    const live = prev.get(key);
    if (!live) return;
    if (live.x !== item.x || live.y !== item.y) return;
    if (live.w != null && live.w !== item.w) return;
    if (withHeight && live.h != null && live.h !== item.h) return;
    if (!next) next = new Map(prev);
    next.delete(key);
  }
  for (const n of board.nodes || []) drop("node:" + n.id, n, false);
  for (const g of board.groups || []) drop("group:" + g.id, g, true);
  return next || prev;
}

function sameGeom(a, b) {
  if (!a || !b) return false;
  if (a.nodes.length !== b.nodes.length || a.groups.length !== b.groups.length) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    const p = a.nodes[i], q = b.nodes[i];
    if (p.id !== q.id || p.x !== q.x || p.y !== q.y || p.w !== q.w) return false;
  }
  for (let i = 0; i < a.groups.length; i++) {
    const p = a.groups[i], q = b.groups[i];
    if (p.id !== q.id || p.x !== q.x || p.y !== q.y || p.w !== q.w || p.h !== q.h) return false;
  }
  return true;
}

// Một socket cho mỗi board (usePresence.js sở hữu kết nối) — hook này chỉ lắng
// nghe thêm sự kiện trên socket có sẵn, không tự mở kết nối mới.
//
// QUAN TRỌNG — vì sao việc phát live:geom phải do handler kéo gọi tay, chứ
// KHÔNG theo dõi `board`: bản trước dùng một effect nghe mọi thay đổi của
// `board` rồi phát lại toàn bộ hình học. Nhưng `board` cũng đổi khi ÁP một
// board:update của người khác, nên A lưu → B nhận → B phát lại hình học (theo
// bản chụp của B) → A nhận và vẽ đè vị trí cũ lên vị trí mới của chính mình →
// hết TTL lại về đúng chỗ. Đó chính là vòng vọng làm thẻ "giật đi giật lại giữa
// hai vị trí". Chỉ người ĐANG THẬT SỰ kéo mới được phát; người nhận không bao
// giờ phát lại, nên vòng lặp không thể hình thành.
export function useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard) {
  const [geomOverlay, setGeomOverlay] = useState(EMPTY_MAP);
  const [textOverlay, setTextOverlay] = useState(EMPTY_MAP);
  const socketRef = useRef(socket);
  const localDragRef = useRef(new Map());   // key -> bỏ qua gói của người khác tới mốc nào
  const lastSentRef = useRef(null);

  useEffect(() => {
    socketRef.current = socket;
    return () => { socketRef.current = null; };
  }, [socket]);

  const isLocallyDragged = useCallback((key) => {
    const until = localDragRef.current.get(key);
    if (until == null) return false;
    if (until > Date.now()) return true;
    localDragRef.current.delete(key);
    return false;
  }, []);

  const sendGeomRef = useRef(null);
  if (!sendGeomRef.current) {
    sendGeomRef.current = trailingThrottle((payload) => {
      socketRef.current?.emit("live:geom", payload);
    }, GEOM_SEND_MS);
  }
  const sendTextRef = useRef(null);
  if (!sendTextRef.current) {
    sendTextRef.current = trailingThrottle((payload) => {
      socketRef.current?.emit("live:text", payload);
    }, TEXT_SEND_MS);
  }

  useEffect(() => () => {
    sendGeomRef.current?.cancel();
    sendTextRef.current?.cancel();
  }, []);

  // Mốc "bỏ qua tới lúc nào" luôn là một thời điểm hữu hạn, KHÔNG phải Infinity:
  // publish được gọi liên tục trong lúc kéo nên nó tự gia hạn, còn nếu cú kéo
  // chết giữa chừng (cửa sổ mất focus, mouseup không bao giờ tới) thì mốc tự hết
  // hạn — thay vì khoá vĩnh viễn thẻ đó không nhận được cập nhật của người khác.
  function markLocal(payload, until) {
    for (const n of payload.nodes) localDragRef.current.set("node:" + n.id, until);
    for (const g of payload.groups) localDragRef.current.set("group:" + g.id, until);
  }

  // Gọi từ trong mỗi vòng kéo, với ĐÚNG những item đang bị kéo.
  const publishGeom = useCallback((items) => {
    if (!socketRef.current) return;
    const payload = projectGeometry(items);
    markLocal(payload, Date.now() + LOCAL_DRAG_GRACE_MS);
    if (sameGeom(lastSentRef.current, payload)) return;   // chuột đứng yên: không tốn gói nào
    lastSentRef.current = payload;
    sendGeomRef.current(payload);
  }, []);

  // Gọi đúng một lần lúc thả chuột: gói `done` giữ vị trí cuối bên người xem
  // cho tới khi bản lưu chính thức về, nên không có khoảng hở nào để thẻ nhảy.
  const finishGeom = useCallback((items) => {
    const payload = { ...projectGeometry(items), done: true };
    markLocal(payload, Date.now() + LOCAL_DRAG_GRACE_MS);
    lastSentRef.current = null;
    sendGeomRef.current.cancel();
    socketRef.current?.emit("live:geom", payload);
  }, []);

  const sendLiveText = useCallback((payload) => {
    if (!socketRef.current) return;
    sendTextRef.current(payload);
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onLiveGeom(payload) {
      setGeomOverlay((prev) => mergeGeomPacket(prev, payload || {}, Date.now(), isLocallyDragged));
    }
    function onLiveText(payload) {
      const { nodeId, field, value } = payload || {};
      if (nodeId == null || !field) return;
      setTextOverlay((prev) => {
        const key = String(nodeId);
        const next = new Map(prev);
        next.set(key, { ...(prev.get(key) || {}), [field]: value, expiresAt: Date.now() + TEXT_TTL_MS });
        return next;
      });
    }
    function onBoardUpdate(incoming) {
      const local = boardRef.current;
      if (!local) return;
      if (isStaleUpdate(lastUpdatedAtRef.current, incoming.updatedAt)) return;
      lastUpdatedAtRef.current = incoming.updatedAt;
      const merged = mergeRemoteBoard(local, incoming, editingIdRef.current);
      applyRemoteBoard(merged);
      setGeomOverlay((prev) => reconcileGeomOverlay(prev, merged));
    }
    socket.on("live:geom", onLiveGeom);
    socket.on("live:text", onLiveText);
    socket.on("board:update", onBoardUpdate);
    return () => {
      socket.off("live:geom", onLiveGeom);
      socket.off("live:text", onLiveText);
      socket.off("board:update", onBoardUpdate);
      // Mất kết nối thì mọi vị trí tạm của người khác thành vô nghĩa — xoá ngay
      // thay vì để chúng treo trên màn hình cho tới lúc hết hạn.
      setGeomOverlay(EMPTY_MAP);
      setTextOverlay(EMPTY_MAP);
    };
  }, [socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard, isLocallyDragged]);

  // Một interval duy nhất, và chỉ chạy khi thật sự có gì để dọn.
  const hasOverlay = geomOverlay.size > 0 || textOverlay.size > 0;
  useEffect(() => {
    if (!hasOverlay) return;
    const id = setInterval(() => {
      const now = Date.now();
      setGeomOverlay((prev) => sweepExpired(prev, now));
      setTextOverlay((prev) => sweepExpired(prev, now));
      // Dọn luôn danh sách "item mình vừa kéo": nó chỉ được xoá lười lúc tra
      // cứu, nên phiên làm việc dài sẽ tích lại một entry cho mỗi thẻ từng kéo.
      for (const [key, until] of localDragRef.current) {
        if (until <= now) localDragRef.current.delete(key);
      }
    }, SWEEP_MS);
    return () => clearInterval(id);
  }, [hasOverlay]);

  return { geomOverlay, textOverlay, sendLiveText, publishGeom, finishGeom };
}
