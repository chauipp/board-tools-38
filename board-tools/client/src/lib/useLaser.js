import { useCallback, useEffect, useMemo, useRef } from "react";
import { trailingThrottle } from "./raf-throttle.js";
import { pushLaserPoint, trimLaserTrail } from "./laser.js";

// Cùng nhịp với useInkLive.js: ~25 gói/giây.
const LASER_SEND_MS = 40;

// Khoá của vệt do CHÍNH MÌNH vẽ. Vệt của người khác lấy khoá là socketId, mà
// socketId do server cấp và không bao giờ là chuỗi này.
export const SELF_KEY = "self";

// QUAN TRỌNG — vì sao vệt laser KHÔNG nằm trong state của React.
//
// Vệt tan dần theo thời gian, nên nó phải được vẽ lại mỗi khung hình trong suốt
// LASER_FADE_MS kể cả khi con trỏ đã đứng yên. Nếu để nó là state của IdeaMap
// thì mỗi khung hình đó kéo theo một lượt render TOÀN BỘ thẻ, dây và khung —
// đúng thứ mà PeerLayer.jsx sinh ra để tránh, chỉ tệ hơn vì đây là 60 lần/giây
// chứ không phải 20, và nó xảy ra đúng lúc người ta đang thuyết trình.
//
// Nên kho này là một object thường có đăng ký nghe. Chỉ LaserLayer nghe nó, nên
// chỉ LaserLayer vẽ lại. IdeaMap không render thêm một lượt nào.
export function createLaserStore() {
  const trails = new Map();          // khoá -> [{x, y, t}]
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn();
  }

  return {
    trails,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    add(key, x, y, now) {
      const cur = trails.get(key) || [];
      const next = pushLaserPoint(cur, x, y, now);
      if (next === cur) return false;   // điểm bị chối vì quá gần điểm cuối
      trails.set(key, next);
      notify();
      return true;
    },
    // Gọi từ vòng lặp rAF của LaserLayer. Không notify: người gọi đang ở giữa
    // một khung hình và sẽ tự vẽ lại — notify ở đây là bắt nó lên lịch thêm một
    // khung hình nữa cho chính mình, thành vòng lặp không bao giờ dừng.
    sweep(now) {
      for (const [key, pts] of trails) {
        const next = trimLaserTrail(pts, now);
        if (next === pts) continue;
        if (next.length) trails.set(key, next);
        else trails.delete(key);
      }
    },
    drop(key) {
      if (trails.delete(key)) notify();
    }
  };
}

// Phía PHÁT: nhận toạ độ canvas từ handler chuột của IdeaMap, đưa vào kho và
// đẩy lên kênh live:laser. Giống useInkLive.js, hook này KHÔNG có effect nào
// theo dõi dữ liệu rồi tự phát lại — chỉ người đang thật sự cầm laser mới phát,
// người nhận không bao giờ phát vọng lại.
export function useLaser(socket) {
  const store = useMemo(() => createLaserStore(), []);
  const socketRef = useRef(socket);

  useEffect(() => {
    socketRef.current = socket;
    return () => { socketRef.current = null; };
  }, [socket]);

  // Cùng bài học với useInkLive.js: trailingThrottle THAY tham số đang chờ, mà
  // gói này mang ĐIỂM MỚI THÊM — ba lần gọi trong cùng cửa sổ 40ms thì hai lô
  // đầu sẽ mất hẳn. Điểm phải cộng dồn ở đây, throttle chỉ quyết định lúc nào xả.
  const pendingRef = useRef([]);
  const flushRef = useRef(null);
  if (!flushRef.current) {
    flushRef.current = trailingThrottle(() => {
      if (!pendingRef.current.length) return;
      const pts = pendingRef.current;
      pendingRef.current = [];
      socketRef.current?.emit("live:laser", { pts });
    }, LASER_SEND_MS);
  }

  useEffect(() => () => flushRef.current?.cancel(), []);

  const track = useCallback((x, y) => {
    // Chỉ phát điểm nào THẬT SỰ vào được vệt của mình: pushLaserPoint chối
    // những điểm quá gần, và nếu vẫn phát chúng thì vệt người khác thấy sẽ dày
    // điểm hơn vệt mình thấy — hai bên tan theo hai nhịp khác nhau.
    if (!store.add(SELF_KEY, x, y, Date.now())) return;
    pendingRef.current.push(Math.round(x), Math.round(y));
    flushRef.current();
  }, [store]);

  return useMemo(() => ({ store, track }), [store, track]);
}
