import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const CURSOR_THROTTLE_MS = 50;

export function cursorColor(email) {
  let h = 0;
  const s = String(email || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 55%)`;
}

export function usePresence(user) {
  const [peers, setPeers] = useState(new Map());
  const socketRef = useRef(null);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    const socket = io();
    socketRef.current = socket;

    socket.on("presence:sync", (list) => {
      setPeers(new Map(list.map((p) => [p.socketId, p])));
    });
    socket.on("presence:join", (peer) => {
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
      setPeers((prev) => new Map(prev).set(peer.socketId, peer));
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
