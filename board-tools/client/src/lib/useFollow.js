import { useCallback, useEffect, useRef, useState } from "react";
import { followCamera, isUsableView, stepFollow } from "./follow.js";

// Hằng số thời gian của phép bám. Mỗi khung hình đi được `1 - e^(-dt/TAU)` phần
// quãng đường còn lại, nên tốc độ tính theo GIÂY chứ không theo số khung hình —
// màn hình 144Hz và 60Hz bám như nhau. 90ms đủ mượt để không giật theo từng gói
// mạng, đủ nhanh để không tụt lại sau lời người đang nói.
const TAU_MS = 90;

// Chờ server ừ bao lâu trước khi coi như hỏng. Đây là đường đi socket trong một
// phòng đã kết nối sẵn, nên hồi âm bình thường tính bằng mili giây; 2.5s rộng
// rãi cho mạng tệ mà vẫn đủ ngắn để người dùng không ngồi nhìn màn hình đứng im
// tự hỏi mình bấm trượt hay app hỏng.
const ACK_TIMEOUT_MS = 2500;
// Báo lỗi tự tan sau ngần này. Nó là thông báo nhất thời, không phải trạng thái.
const ERROR_FADE_MS = 5000;

/**
 * Ghim màn hình một người: camera của mình bám theo camera của họ.
 *
 * Gói view của người bị ghim về ~20 lần/giây. Nó cố ý KHÔNG đi vào state peer
 * (usePresence) mà nằm trong ref ở đây: nhịp đó mà chạm vào state dùng chung là
 * PresenceBar với PeerLayer render lại 20 lần/giây trong suốt buổi họp.
 *
 * `applyCamera` phải là đường ghi camera KHÔNG kèm huỷ ghim — nếu nó gọi vào
 * cùng hàm mà cú cuộn chuột của người dùng gọi, thì chính vòng bám sẽ tự huỷ
 * mình ngay khung hình đầu tiên.
 *
 * Trạng thái ghim KHÔNG tự bật lúc bấm mà chờ server xác nhận. Lý do rất cụ
 * thể: bản đầu tự bật, và khi server đang chạy code cũ (chưa biết sự kiện
 * `follow:update`), giao diện hiện đủ viền màu lẫn chip "đang xem màn hình
 * của X" trong khi thực tế không một gói nào được relay. Giao diện nói dối là
 * kiểu lỗi tốn nhiều thời gian nhất để lần ra, nên ở đây phải im cho tới khi
 * server ừ, và phải kêu lên nếu quá 2.5s không ai trả lời.
 */
export function useFollow({ socket, sendFollow, viewportSize, applyCamera, minScale, maxScale }) {
  const [followingId, setFollowingId] = useState(null);
  // Đã bấm, đã gửi, chưa được xác nhận. Tách hẳn khỏi followingId để giao diện
  // nói đúng ba trạng thái: chưa ghim / đang chờ / đang bám.
  const [pendingId, setPendingId] = useState(null);
  const [followError, setFollowError] = useState(null);
  const [watcherCount, setWatcherCount] = useState(0);

  const targetViewRef = useRef(null);   // view mới nhất của người bị ghim
  const curRef = useRef(null);          // camera mình đang ở, do vòng lặp tự giữ
  // Bản ref của followingId. Handler socket và stopFollow đều cần giá trị MỚI
  // NHẤT: stopFollow được gọi từ mọi cú cuộn/lia nên không được là closure cũ,
  // còn onView mà phụ thuộc state thì cứ mỗi lần đổi mục tiêu lại gỡ và gắn lại
  // toàn bộ listener.
  const followingIdRef = useRef(null);
  followingIdRef.current = followingId;
  const pendingIdRef = useRef(null);
  const ackTimerRef = useRef(null);
  const frameRef = useRef(0);
  const lastTsRef = useRef(0);
  const applyRef = useRef(applyCamera);
  applyRef.current = applyCamera;

  const clearAck = useCallback(() => {
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    ackTimerRef.current = null;
    pendingIdRef.current = null;
    setPendingId(null);
  }, []);

  const stopLoop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    curRef.current = null;
    lastTsRef.current = 0;
  }, []);

  // Kích thước khung nhìn lấy từ state đã đo sẵn (ResizeObserver ở IdeaMap) chứ
  // KHÔNG gọi getBoundingClientRect ở đây: gọi nó trong vòng rAF là ép trình
  // duyệt tính lại layout đồng bộ ở mỗi khung hình, đúng lúc đang muốn mượt
  // nhất. Kích thước cửa sổ thì lại gần như không đổi trong lúc bám.
  const sizeRef = useRef(viewportSize);
  sizeRef.current = viewportSize;

  // Vòng bám tự giữ camera hiện tại trong curRef thay vì đọc ngược ra từ state ở
  // mỗi khung hình: setState là bất đồng bộ, đọc ngược sẽ lấy phải giá trị của
  // khung trước và phép nội suy đứng yên tại chỗ. Không sợ lệch với state thật,
  // vì mọi thứ khác động vào camera đều huỷ ghim.
  const tick = useCallback((ts) => {
    frameRef.current = 0;
    const size = sizeRef.current;
    const held = targetViewRef.current;
    // View được cất kèm CHỦ của nó, và kiểm lại ngay tại đây. Trước đây chủ được
    // "bảo đảm" bằng một effect xoá sạch view mỗi lần đổi mục tiêu — mà effect
    // chạy sau khi vẽ xong, nên gói view đầu tiên (về ngay sát gói xác nhận) bị
    // effect đó xoá mất, và màn hình đứng im cho tới khi người kia lia tiếp.
    if (!held || held.socketId !== followingIdRef.current) return;
    if (!size || size.w <= 0 || size.h <= 0) return;

    const target = followCamera(held.view, size, minScale, maxScale);

    // curRef rỗng = vừa bấm ghim (stopLoop xoá nó mỗi lần đổi mục tiêu). Nhảy
    // THẲNG tới khung nhìn của họ thay vì nội suy: bò từ chỗ mình đang đứng qua
    // nửa board là vài giây chóng mặt, mà ý của cú bấm là "cho tôi thấy cái anh
    // đang thấy, ngay bây giờ". Từ gói sau mới là bám mượt.
    //
    // Đây cũng là lý do không thể lấy chính `target` làm điểm xuất phát: khi ấy
    // stepFollow thấy đã-tới-đích và trả về null, không ghi lấy một lần nào.
    if (curRef.current === null) {
      curRef.current = target;
      lastTsRef.current = 0;
      applyRef.current(target);
      return;
    }

    const dt = lastTsRef.current ? Math.min(100, ts - lastTsRef.current) : 16;
    lastTsRef.current = ts;

    const next = stepFollow(curRef.current, target, 1 - Math.exp(-dt / TAU_MS));
    if (next === null) {
      // Tới đích: dừng hẳn thay vì quay rAF không tải. Gói view kế tiếp của
      // người kia sẽ tự khởi động lại vòng.
      curRef.current = target;
      lastTsRef.current = 0;
      return;
    }
    curRef.current = next;
    applyRef.current(next);
    frameRef.current = requestAnimationFrame(tick);
  }, [minScale, maxScale]);

  const kick = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    if (!socket) return;

    function onView({ socketId, view }) {
      // Gói của người mình KHÔNG ghim (đang trong lúc đổi mục tiêu, gói cũ còn
      // trên đường) thì bỏ — không thì camera giật một nhịp sang chỗ người cũ.
      if (socketId !== followingIdRef.current || !isUsableView(view)) return;
      targetViewRef.current = { socketId, view };
      kick();
    }
    // Server phát cho cả phòng, KỂ CẢ chính mình — và gói gửi cho chính mình
    // chính là lời xác nhận: chỉ tới đây trạng thái ghim mới thật sự bật. Nó
    // cũng là đường về khi mục tiêu rời phòng và server thả mình ra; usePeers
    // không bắt được ca đó vì nó đã loại socket của mình khỏi danh sách peer.
    function onFollow({ socketId, followingId: id }) {
      if (socketId !== socket.id) return;
      clearAck();
      setFollowError(null);
      // Gán ref NGAY, không đợi lượt render của setFollowingId. Gói view đầu
      // tiên về ngay sát gói xác nhận này (server báo cho người kia là có khán
      // giả đúng lúc nhận cú ghim, họ trả lời tức thì) — mà lúc đó React chưa
      // vẽ lại, nên nếu chỉ dựa vào ref gán lúc render thì onView đọc ra `null`
      // và VỨT đúng cái gói làm nên cú nhảy đầu tiên. Người dùng bấm ghim rồi
      // ngồi nhìn màn hình đứng im cho tới khi người kia lia tiếp.
      followingIdRef.current = id;
      setFollowingId(id);
    }
    function onDenied({ reason } = {}) {
      clearAck();
      followingIdRef.current = null;
      setFollowingId(null);
      setFollowError(reason || "denied");
    }
    function onWatched({ count }) {
      setWatcherCount(Number.isFinite(count) ? count : 0);
    }

    socket.on("view:update", onView);
    socket.on("follow:update", onFollow);
    socket.on("follow:denied", onDenied);
    socket.on("follow:watched", onWatched);
    return () => {
      socket.off("view:update", onView);
      socket.off("follow:update", onFollow);
      socket.off("follow:denied", onDenied);
      socket.off("follow:watched", onWatched);
    };
  }, [socket, kick, clearAck]);

  // Mất kết nối là mất luôn cả hai chiều: mình không còn nhận view của ai, và
  // server đã quên mất ai đang xem mình. Giữ nguyên trạng thái cũ trên màn hình
  // là hiển thị một lời nói dối cho tới khi kết nối lại.
  useEffect(() => {
    if (!socket) return;
    function onDown() {
      clearAck();
      followingIdRef.current = null;
      setFollowingId(null);
      setWatcherCount(0);
    }
    socket.on("disconnect", onDown);
    socket.on("connect_error", onDown);
    return () => {
      socket.off("disconnect", onDown);
      socket.off("connect_error", onDown);
    };
  }, [socket, clearAck]);

  // Báo lỗi là thông báo nhất thời, không phải trạng thái — tự tan để không nằm
  // lì trên màn hình sau khi người dùng đã đọc và đã thử lại.
  useEffect(() => {
    if (!followError) return;
    const id = setTimeout(() => setFollowError(null), ERROR_FADE_MS);
    return () => clearTimeout(id);
  }, [followError]);

  // Đổi mục tiêu (hoặc bỏ ghim): dừng vòng ngay, không để camera bò nốt quãng
  // còn lại về chỗ người cũ. stopLoop cũng xoá curRef, nên lần bám mới bắt đầu
  // bằng một cú NHẢY thẳng tới khung nhìn của người mới thay vì nội suy.
  //
  // KHÔNG xoá targetViewRef ở đây nữa: effect chạy sau khi vẽ xong, mà gói view
  // đầu tiên về ngay sát gói xác nhận, nên lần xoá này hay nuốt mất đúng cái gói
  // làm nên cú nhảy — người dùng bấm ghim rồi ngồi nhìn màn hình đứng im. View
  // cũ giờ vô hại vì nó mang theo socketId chủ và tick tự loại.
  //
  // kick lại ngay sau khi dừng, vì gói view có thể đã tới TRƯỚC effect này và
  // vòng vừa bị stopLoop cắt mất; tick sẽ tự thoát nếu chưa có view đúng chủ.
  useEffect(() => {
    stopLoop();
    if (followingId) kick();
  }, [followingId, stopLoop, kick]);

  useEffect(() => stopLoop, [stopLoop]);

  // Bấm ghim: CHỈ gửi và chờ. Trạng thái thật do onFollow bật khi server ừ.
  const follow = useCallback((targetId) => {
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    setFollowError(null);
    pendingIdRef.current = targetId;
    setPendingId(targetId);
    sendFollow(targetId);
    ackTimerRef.current = setTimeout(() => {
      ackTimerRef.current = null;
      // Người dùng có thể đã bấm sang người khác trong lúc chờ — cú hết giờ của
      // lần bấm cũ không được xoá trạng thái của lần bấm mới.
      if (pendingIdRef.current !== targetId) return;
      pendingIdRef.current = null;
      setPendingId(null);
      setFollowError("timeout");
    }, ACK_TIMEOUT_MS);
  }, [sendFollow]);

  const stopFollow = useCallback(() => {
    // Ra sớm khi không ghim và không chờ ai: hàm này được gọi từ MỌI thao tác
    // camera của người dùng (cuộn, lia, zoom) — hàng chục lần mỗi giây lúc kéo
    // nền, mà tuyệt đại đa số thời gian là chẳng ghim ai cả.
    if (followingIdRef.current === null && pendingIdRef.current === null) return;
    // Bỏ ghim thì KHÔNG chờ xác nhận, khác hẳn lúc bấm ghim: người dùng vừa đòi
    // lại quyền lái camera, bắt họ đợi một vòng mạng là camera còn bị kéo thêm
    // vài khung hình nữa. Gói null vẫn gửi đi để server ngừng relay.
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    ackTimerRef.current = null;
    followingIdRef.current = null;
    pendingIdRef.current = null;
    setFollowingId(null);
    setPendingId(null);
    sendFollow(null);
  }, [sendFollow]);

  return { followingId, pendingId, followError, watcherCount, follow, stopFollow };
}
