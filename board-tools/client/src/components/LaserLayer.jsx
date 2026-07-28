import { memo, useEffect, useReducer, useRef } from "react";
import { cursorColor, usePeers } from "../lib/usePresence.js";
import { laserOutline, LASER_HEAD_PX } from "../lib/laser.js";
import { SELF_KEY } from "../lib/useLaser.js";

// Vệt của mình luôn đỏ — màu laser ai cũng nhận ra ngay, và mình không có
// "màu người" nào để lấy (cursorColor băm từ email, nhưng con trỏ của chính
// mình không bao giờ được vẽ nên màu đó chưa từng xuất hiện trước mắt mình).
// Vệt người khác lấy đúng màu con trỏ của họ, nên nhìn vệt là biết ai đang chỉ.
const SELF_COLOR = "#ff2f4a";

// Lớp vẽ mọi vệt laser đang sống — của mình và của người khác. Tự đăng ký
// socket và tự chạy vòng lặp khung hình, cùng lối PeerLayer.jsx: xem ghi chú
// dài đầu useLaser.js về lý do vệt không được nằm trong state của IdeaMap.
function LaserLayer({ socket, store, scale }) {
  const [, bump] = useReducer((n) => n + 1, 0);
  const rafRef = useRef(0);
  // Chỉ để tra màu theo socketId. Hook này vẽ lại theo nhịp con trỏ của người
  // khác, nhưng lớp này là lá — không thẻ, không dây — nên cái giá đó bằng 0.
  const peers = usePeers(socket);

  useEffect(() => {
    if (!socket) return;
    function onLaser(packet) {
      if (!packet || typeof packet.socketId !== "string") return;
      const pts = Array.isArray(packet.pts) ? packet.pts : null;
      if (!pts || pts.length < 2) return;
      // Đóng dấu thời gian bằng ĐỒNG HỒ CỦA MÌNH, không tin dấu của người gửi:
      // hai máy lệch giờ vài giây là vệt của họ hoặc tan ngay lập tức, hoặc
      // không bao giờ tan. Cả lô điểm trong một gói cùng một mốc — sai số tối đa
      // đúng bằng một nhịp phát (40ms), mắt không thấy.
      const now = Date.now();
      for (let i = 0; i + 1 < pts.length; i += 2) store.add(packet.socketId, pts[i], pts[i + 1], now);
    }
    // Người rời board giữa lúc đang chỉ: vệt vẫn tự tan sau LASER_FADE_MS, nhưng
    // bỏ ngay thì không có cái đuôi treo lại của một người đã đi.
    function onLeave(payload) {
      if (payload && typeof payload.socketId === "string") store.drop(payload.socketId);
    }
    socket.on("live:laser", onLaser);
    socket.on("presence:leave", onLeave);
    return () => {
      socket.off("live:laser", onLaser);
      socket.off("presence:leave", onLeave);
    };
  }, [socket, store]);

  // Vòng lặp khung hình CHỈ sống khi còn vệt. Không có vệt nào thì không có
  // rAF nào đang chờ, và lớp này không tốn gì cả — đúng trạng thái bình thường
  // của bảng, vì laser chỉ được dùng trong dăm phút thuyết trình.
  useEffect(() => {
    function frame() {
      store.sweep(Date.now());
      bump();
      rafRef.current = store.trails.size ? requestAnimationFrame(frame) : 0;
    }
    const stop = store.subscribe(() => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(frame);
    });
    return () => {
      stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [store]);

  if (!store.trails.size) return null;

  // Chia cho scale để vệt giữ nguyên bề rộng trên MÀN HÌNH khi phóng to/thu nhỏ
  // — xem ghi chú ở LASER_HEAD_PX.
  const headW = LASER_HEAD_PX / (scale || 1);

  return (
    <svg className="laser-layer">
      {Array.from(store.trails.entries()).map(([key, pts]) => {
        const d = laserOutline(pts, headW);
        if (!d) return null;
        const peer = key === SELF_KEY ? null : peers.get(key);
        const color = key === SELF_KEY ? SELF_COLOR : (peer ? cursorColor(peer.email) : SELF_COLOR);
        const head = pts[pts.length - 1];
        return (
          // Màu đặt MỘT lần trên <g> rồi mọi thứ bên trong lấy qua currentColor:
          // quầng sáng, lõi và chấm đầu luôn cùng một màu, không có chỗ nào để
          // lệch.
          <g key={key} style={{ color }}>
            {/* Quầng sáng: cùng chuỗi `d` với lõi, chỉ thêm một đường kẻ dày và
                mờ để bơm hình ra hai bên. Rẻ hơn hẳn việc tính lại viền ngoài
                lần thứ hai với bề rộng lớn hơn. */}
            <path className="laser-halo" d={d} strokeWidth={headW * 1.7} />
            <path className="laser-core" d={d} />
            {/* Chấm ở đầu: viền ngoài thon về 0 ở đuôi nhưng đầu vệt cũng chỉ
                là một điểm trên đường tâm, nên thiếu chấm này thì đúng chỗ con
                trỏ lại là chỗ vệt mảnh nhất. */}
            <circle className="laser-head" cx={head.x} cy={head.y} r={headW * 0.6} />
          </g>
        );
      })}
    </svg>
  );
}

export default memo(LaserLayer);
