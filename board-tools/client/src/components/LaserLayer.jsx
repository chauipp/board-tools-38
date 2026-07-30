import { memo, useEffect, useReducer, useRef } from "react";
import { penVar } from "../lib/pen.js";
import { laserOutline, sanitizeLaserStyle } from "../lib/laser.js";

// Lớp vẽ mọi vệt laser đang sống — của mình và của người khác. Tự đăng ký
// socket và tự chạy vòng lặp khung hình, cùng lối PeerLayer.jsx: xem ghi chú
// dài đầu useLaser.js về lý do vệt không được nằm trong state của IdeaMap.
function LaserLayer({ socket, store, scale }) {
  const [, bump] = useReducer((n) => n + 1, 0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!socket) return;
    function onLaser(packet) {
      if (!packet || typeof packet.socketId !== "string") return;
      const pts = Array.isArray(packet.pts) ? packet.pts : null;
      if (!pts || pts.length < 2) return;
      // Server chỉ chặn được "chuỗi ngắn" và "số trong biên độ"; lọc lần hai ở
      // đây mới biết đâu là token màu THẬT và đâu là bề rộng có trong bảng.
      const { color, w, fade } = sanitizeLaserStyle(packet.color, packet.w, packet.fade);
      // Bấm chuột lần mới bên kia = bỏ vệt cũ. Không có bước này thì thả chuột
      // ở một góc rồi bấm lại ở góc kia sẽ nối thành một vạch băng qua bảng.
      if (packet.reset === true) store.drop(packet.socketId);
      // Đóng dấu thời gian bằng ĐỒNG HỒ CỦA MÌNH, không tin dấu của người gửi:
      // hai máy lệch giờ vài giây là vệt của họ hoặc tan ngay lập tức, hoặc
      // không bao giờ tan. Cả lô điểm trong một gói cùng một mốc — sai số tối đa
      // đúng bằng một nhịp phát (40ms), mắt không thấy.
      const now = Date.now();
      for (let i = 0; i + 1 < pts.length; i += 2) store.add(packet.socketId, color, w, fade, pts[i], pts[i + 1], now);
    }
    // Người rời board giữa lúc đang chỉ: vệt vẫn tự tan sau `fade` của nó, nhưng
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

  return (
    <svg className="laser-layer">
      {Array.from(store.trails.entries()).map(([key, trail]) => {
        const { pts } = trail;
        // Chia cho scale để vệt giữ nguyên bề rộng trên MÀN HÌNH khi phóng
        // to/thu nhỏ — xem ghi chú ở LASER_WIDTHS. Mỗi vệt một bề rộng riêng:
        // độ đậm là lựa chọn của NGƯỜI CHỈ, không phải thiết lập của bảng.
        const headW = trail.w / (scale || 1);
        const d = laserOutline(pts, headW);
        if (!d) return null;
        const color = penVar(trail.color);
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
