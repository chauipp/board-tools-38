import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { trailingThrottle } from "./raf-throttle.js";

const CURSOR_THROTTLE_MS = 50;
// Bôi đen chọn (marquee) đổi tập chọn ở mỗi nhịp chuột. Gửi từng nhịp là hàng
// trăm gói mỗi giây cho một thông tin thuần trang trí; "đuôi" của throttle bảo
// đảm tập chọn CUỐI luôn tới nơi.
const SELECTION_THROTTLE_MS = 120;
const EDGE_DRAFT_THROTTLE_MS = 50;
const EMPTY_PEERS = new Map();

export function cursorColor(email) {
  let h = 0;
  const s = String(email || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 55%)`;
}

// The server seeds a newly-connected socket into its own presence:sync
// payload (it registers the peer before emitting sync), so the client must
// drop its own socketId out of that list itself — otherwise the local user
// sees a ghost of their own cursor pinned at canvas (0,0), since the server
// only ever broadcasts later cursor:move updates to *other* sockets.
export function excludeSelf(list, selfId) {
  return list.filter((p) => p.socketId !== selfId);
}

// Chỉ giữ KẾT NỐI và các hàm gửi. Danh sách peer cố tình KHÔNG nằm ở đây:
// con trỏ của mỗi người bắn ~20 lần/giây, mà state đó lại được đọc ở IdeaMap
// thì mỗi nhịp chuột của người khác kéo theo một lượt render toàn bộ thẻ, dây
// và khung. usePeers() bên dưới cho PeerLayer đăng ký riêng, nên chỉ đúng lớp
// con trỏ vẽ lại.
export function usePresence(user, boardId) {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!user || !boardId) return;
    warnedRef.current = false;
    const socket = io({ query: { boardId } });
    socketRef.current = socket;
    setSocket(socket);

    socket.on("connect_error", (err) => {
      // Rejected handshake (e.g. missing/invalid gt_session): degrade to no
      // presence, board still works over REST. Warn once per connection
      // attempt sequence so automatic reconnection retries don't spam the
      // console.
      if (warnedRef.current) return;
      warnedRef.current = true;
      console.warn("[presence] socket connection rejected:", err.message);
    });
    socket.on("connect", () => {
      // A genuine, later connect (e.g. after the session cookie is renewed
      // or reconnection just succeeds) un-sticks the warn guard, so a
      // subsequent real rejection (session expires again) warns again
      // instead of being silently swallowed for the rest of the mount.
      warnedRef.current = false;
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user, boardId]);

  // Takes a lazy coordinate getter (rather than x/y directly) so callers can
  // defer any expensive work (e.g. getBoundingClientRect()) until after the
  // throttle gate below, instead of doing it on every raw mousemove.
  const sendCursor = useCallback((getXY) => {
    const socket = socketRef.current;
    if (!socket) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < CURSOR_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    const { x, y } = getXY();
    socket.emit("cursor:move", { x, y });
  }, []);

  const sendSelectionRef = useRef(null);
  if (!sendSelectionRef.current) {
    sendSelectionRef.current = trailingThrottle((ids) => {
      socketRef.current?.emit("selection:update", ids);
    }, SELECTION_THROTTLE_MS);
  }
  const sendEdgeDraftRef = useRef(null);
  if (!sendEdgeDraftRef.current) {
    sendEdgeDraftRef.current = trailingThrottle((draft) => {
      socketRef.current?.emit("edge-draft:update", draft);
    }, EDGE_DRAFT_THROTTLE_MS);
  }

  useEffect(() => () => {
    sendSelectionRef.current?.cancel();
    sendEdgeDraftRef.current?.cancel();
  }, []);

  // useCallback (không phải hàm thường): IdeaMap.jsx dùng sendSelection trong
  // deps của một useEffect theo dõi selectedIds — nếu hàm đổi định danh mỗi lần
  // render, effect đó chạy lại mỗi render thay vì chỉ khi selectedIds đổi.
  const sendSelection = useCallback((ids) => { sendSelectionRef.current(ids); }, []);
  const sendEdgeDraft = useCallback((draft) => { sendEdgeDraftRef.current(draft); }, []);

  return { sendCursor, sendSelection, sendEdgeDraft, socket };
}

// Danh sách người đang cùng xem board. Tách khỏi usePresence để component nào
// gọi nó thì chỉ mình component đó render lại theo nhịp con trỏ.
export function usePeers(socket) {
  const [peers, setPeers] = useState(EMPTY_PEERS);

  useEffect(() => {
    if (!socket) return;
    function onSync(list) {
      // socket.id is only populated once the connection completes; reading it
      // here (inside the handler) rather than at effect-setup time is what
      // makes this correct for the very first sync after connect.
      setPeers(new Map(excludeSelf(list, socket.id).map((p) => [p.socketId, p])));
    }
    function onJoin(peer) {
      if (peer.socketId === socket.id) return;
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    }
    function onLeave({ socketId }) {
      setPeers((prev) => {
        if (!prev.has(socketId)) return prev;
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    }
    function onCursor(peer) {
      if (peer.socketId === socket.id) return;
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    }
    function onSelection({ socketId, selectedIds }) {
      setPeers((prev) => {
        const p = prev.get(socketId);
        if (!p) return prev;
        return new Map(prev).set(socketId, { ...p, selectedIds });
      });
    }
    function onEdgeDraft({ socketId, edgeDraft }) {
      setPeers((prev) => {
        const p = prev.get(socketId);
        if (!p) return prev;
        return new Map(prev).set(socketId, { ...p, edgeDraft });
      });
    }
    socket.on("presence:sync", onSync);
    socket.on("presence:join", onJoin);
    socket.on("presence:leave", onLeave);
    socket.on("cursor:move", onCursor);
    socket.on("selection:update", onSelection);
    socket.on("edge-draft:update", onEdgeDraft);
    return () => {
      socket.off("presence:sync", onSync);
      socket.off("presence:join", onJoin);
      socket.off("presence:leave", onLeave);
      socket.off("cursor:move", onCursor);
      socket.off("selection:update", onSelection);
      socket.off("edge-draft:update", onEdgeDraft);
      setPeers(EMPTY_PEERS);
    };
  }, [socket]);

  return peers;
}
