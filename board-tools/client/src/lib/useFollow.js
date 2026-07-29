import { useCallback, useEffect, useRef, useState } from "react";
import { followCamera, isUsableView, stepFollow } from "./follow.js";

// Hằng số thời gian của phép bám. Mỗi khung hình đi được `1 - e^(-dt/TAU)` phần
// quãng đường còn lại, nên tốc độ tính theo GIÂY chứ không theo số khung hình —
// màn hình 144Hz và 60Hz bám như nhau. 90ms đủ mượt để không giật theo từng gói
// mạng, đủ nhanh để không tụt lại sau lời người đang nói.
const TAU_MS = 90;

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
 */
export function useFollow({ socket, sendFollow, viewportSize, applyCamera, minScale, maxScale }) {
  const [followingId, setFollowingId] = useState(null);
  const [watcherCount, setWatcherCount] = useState(0);

  const targetViewRef = useRef(null);   // view mới nhất của người bị ghim
  const curRef = useRef(null);          // camera mình đang ở, do vòng lặp tự giữ
  // Bản ref của followingId. Handler socket và stopFollow đều cần giá trị MỚI
  // NHẤT: stopFollow được gọi từ mọi cú cuộn/lia nên không được là closure cũ,
  // còn onView mà phụ thuộc state thì cứ mỗi lần đổi mục tiêu lại gỡ và gắn lại
  // toàn bộ listener.
  const followingIdRef = useRef(null);
  followingIdRef.current = followingId;
  const frameRef = useRef(0);
  const lastTsRef = useRef(0);
  const applyRef = useRef(applyCamera);
  applyRef.current = applyCamera;

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
    const peerView = targetViewRef.current;
    if (!peerView || !size || size.w <= 0 || size.h <= 0) return;

    const target = followCamera(peerView, size, minScale, maxScale);

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
      targetViewRef.current = view;
      kick();
    }
    // Server phát cho cả phòng, kể cả chính mình — và "chính mình" ở đây là lúc
    // mục tiêu rời phòng nên server thả mình ra. usePeers không bắt được ca này
    // vì nó đã loại socket của mình khỏi danh sách peer.
    function onFollow({ socketId, followingId: id }) {
      if (socketId === socket.id) setFollowingId(id);
    }
    function onDenied() {
      // Nút đang hiển thị "đang ghim"; không trả trạng thái về thì nó kẹt ở đó.
      setFollowingId(null);
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
  }, [socket, kick]);

  // Mất kết nối là mất luôn cả hai chiều: mình không còn nhận view của ai, và
  // server đã quên mất ai đang xem mình. Giữ nguyên trạng thái cũ trên màn hình
  // là hiển thị một lời nói dối cho tới khi kết nối lại.
  useEffect(() => {
    if (!socket) return;
    function onDown() {
      setFollowingId(null);
      setWatcherCount(0);
    }
    socket.on("disconnect", onDown);
    socket.on("connect_error", onDown);
    return () => {
      socket.off("disconnect", onDown);
      socket.off("connect_error", onDown);
    };
  }, [socket]);

  // Đổi mục tiêu (hoặc bỏ ghim): xoá view cũ và dừng vòng ngay, không để camera
  // bò nốt quãng còn lại về chỗ người cũ sau khi đã bỏ ghim.
  useEffect(() => {
    targetViewRef.current = null;
    stopLoop();
  }, [followingId, stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  const follow = useCallback((targetId) => {
    setFollowingId(targetId);
    sendFollow(targetId);
  }, [sendFollow]);

  const stopFollow = useCallback(() => {
    // Ra sớm khi không ghim ai: hàm này được gọi từ MỌI thao tác camera của
    // người dùng (cuộn, lia, zoom) — tức là hàng chục lần mỗi giây lúc kéo nền,
    // và tuyệt đại đa số thời gian là chẳng ghim ai cả.
    if (followingIdRef.current === null) return;
    followingIdRef.current = null;
    setFollowingId(null);
    sendFollow(null);
  }, [sendFollow]);

  return { followingId, watcherCount, follow, stopFollow };
}
