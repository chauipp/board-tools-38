import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const CURSOR_THROTTLE_MS = 50;

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

export function usePresence(user) {
  const [peers, setPeers] = useState(new Map());
  const socketRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    warnedRef.current = false;
    const socket = io();
    socketRef.current = socket;

    socket.on("presence:sync", (list) => {
      // socket.id is only populated once the connection completes; reading
      // it here (inside the handler) rather than at effect-setup time is
      // what makes this correct for the very first sync after connect.
      setPeers(new Map(excludeSelf(list, socket.id).map((p) => [p.socketId, p])));
    });
    socket.on("presence:join", (peer) => {
      if (peer.socketId === socket.id) return;
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    });
    socket.on("presence:leave", ({ socketId }) => {
      setPeers((prev) => {
        if (!prev.has(socketId)) return prev;
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });
    socket.on("cursor:move", (peer) => {
      if (peer.socketId === socket.id) return;
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
    });
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
      setPeers(new Map());
    };
  }, [user]);

  function sendCursor(x, y) {
    const socket = socketRef.current;
    if (!socket) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < CURSOR_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    socket.emit("cursor:move", { x, y });
  }

  return { peers, sendCursor };
}
