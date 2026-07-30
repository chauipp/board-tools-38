import { useCallback, useEffect, useMemo, useRef } from "react";
import { trailingThrottle } from "./raf-throttle.js";
import { pushLaserPoint, trimLaserTrail, sanitizeLaserStyle, LASER_DEFAULT } from "./laser.js";

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
  const trails = new Map();          // khoá -> { color, w, fade, pts: [{x, y, t}] }
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
    // Bắt đầu một lượt chỉ MỚI. Bỏ hẳn vệt cũ chứ không nối tiếp: thả chuột ở
    // một góc màn hình rồi bấm lại ở góc kia mà vẫn nối thì có một vạch thẳng
    // băng qua cả bảng, đúng chỗ người ta vừa không hề rê chuột.
    begin(key, color, w, fade, x, y, now) {
      trails.set(key, { color, w, fade, pts: [{ x, y, t: now }] });
      notify();
    },
    add(key, color, w, fade, x, y, now) {
      const cur = trails.get(key);
      // Chưa có lượt nào mà đã có điểm: gói `reset` bị rơi trên đường truyền
      // (kênh này .volatile). Dựng lượt mới thay vì bỏ điểm — mất một chỗ ngắt
      // còn hơn mất cả vệt.
      if (!cur) {
        trails.set(key, { color, w, fade, pts: [{ x, y, t: now }] });
        notify();
        return true;
      }
      const next = pushLaserPoint(cur.pts, x, y, now);
      if (next === cur.pts) return false;   // điểm bị chối vì quá gần điểm cuối
      // Màu, độ đậm và thời gian tan đi kèm MỌI gói, không chỉ gói đầu, nên đổi
      // màu hay kéo thanh thời gian giữa lượt là vệt đổi ngay trên màn hình mọi
      // người.
      trails.set(key, { color, w, fade, pts: next });
      notify();
      return true;
    },
    // Gọi từ vòng lặp rAF của LaserLayer. Không notify: người gọi đang ở giữa
    // một khung hình và sẽ tự vẽ lại — notify ở đây là bắt nó lên lịch thêm một
    // khung hình nữa cho chính mình, thành vòng lặp không bao giờ dừng.
    sweep(now) {
      for (const [key, trail] of trails) {
        const next = trimLaserTrail(trail.pts, now, trail.fade);
        if (next === trail.pts) continue;
        if (next.length) trails.set(key, { ...trail, pts: next });
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
  // Kiểu vệt của lượt đang chạy. Nằm trong ref vì hàm xả của throttle được dựng
  // MỘT lần và không thấy được prefs của lượt render hiện tại.
  const styleRef = useRef(LASER_DEFAULT);
  const flushRef = useRef(null);
  if (!flushRef.current) {
    flushRef.current = trailingThrottle(() => {
      if (!pendingRef.current.length) return;
      const pts = pendingRef.current;
      pendingRef.current = [];
      const { color, w, fade } = styleRef.current;
      socketRef.current?.emit("live:laser", { pts, color, w, fade });
    }, LASER_SEND_MS);
  }

  useEffect(() => () => flushRef.current?.cancel(), []);

  // Bấm chuột = bắt đầu một lượt chỉ. Gói đầu đi NGAY, không nằm chờ trong
  // throttle: nó mang cờ `reset` báo cho người khác bỏ vệt cũ, mà 40ms chậm trễ
  // của cờ đó là 40ms người ta thấy một vạch nối sai.
  const begin = useCallback((x, y, prefs) => {
    const style = sanitizeLaserStyle(prefs?.color, prefs?.w, prefs?.fade);
    styleRef.current = style;
    flushRef.current.cancel();
    pendingRef.current = [];
    store.begin(SELF_KEY, style.color, style.w, style.fade, x, y, Date.now());
    socketRef.current?.emit("live:laser", {
      pts: [Math.round(x), Math.round(y)], color: style.color, w: style.w, fade: style.fade, reset: true
    });
  }, [store]);

  const track = useCallback((x, y, prefs) => {
    const style = sanitizeLaserStyle(prefs?.color, prefs?.w, prefs?.fade);
    styleRef.current = style;
    // Chỉ phát điểm nào THẬT SỰ vào được vệt của mình: pushLaserPoint chối
    // những điểm quá gần, và nếu vẫn phát chúng thì vệt người khác thấy sẽ dày
    // điểm hơn vệt mình thấy — hai bên tan theo hai nhịp khác nhau.
    if (!store.add(SELF_KEY, style.color, style.w, style.fade, x, y, Date.now())) return;
    pendingRef.current.push(Math.round(x), Math.round(y));
    flushRef.current();
  }, [store]);

  // Thả chuột: xả nốt điểm còn treo. Thiếu bước này thì đuôi vệt trên màn hình
  // người khác bị cắt mất tới 40ms cuối — mà 40ms cuối chính là chỗ con trỏ
  // dừng lại, tức đúng chỗ người ta đang chỉ vào.
  const end = useCallback(() => {
    flushRef.current.flush();
  }, []);

  return useMemo(() => ({ store, begin, track, end }), [store, begin, track, end]);
}
