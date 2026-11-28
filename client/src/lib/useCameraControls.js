import { useRef, useCallback } from "react";
import { useFollow } from "./useFollow.js";
import { panForCenter } from "./minimap.js";
import { startDrag } from "./drag-session.js";
import { MIN_SCALE, MAX_SCALE } from "./board-constants.js";
import { computeZoom } from "./camera.js";

// Các thao tác chỉ đổi camera: zoom bằng nút, vừa khung, nhảy tới
// thẻ/khung/người khác, bấm minimap, lia bằng chuột phải hoặc Space, và đổi toạ
// độ màn hình ↔ canvas. Trước nằm trong IdeaMap.jsx (task 2.5 để lại).
export function useCameraControls({
  store, board, boardRef, camera, view, setView, viewRef, viewportRef, frameCardSize, saveNow, selectedIds, setSelectedIds, setBoard, setFlashId, setIsPanning, setSpotlightPeerId, suppressContextMenuRef, undo, socket, sendFollow, viewportSize
}) {
  const depsRef = useRef({});

  // Đường ghi camera dành RIÊNG cho vòng bám khi ghim màn hình. Cố ý không đi
  // qua setCamera: setCamera là "người dùng chủ động đổi camera" nên nó huỷ
  // ghim, mà vòng bám cũng đổi camera — dùng chung một cửa thì vòng bám tự huỷ
  // mình ngay khung hình đầu tiên.
  const applyFollowCamera = useCallback((view) => {
    if (!boardRef.current) return;
    setView((prev) => ({ ...prev, ...view }));
  }, []);

  const { followingId, pendingId, followError, watcherCount, follow, stopFollow } = useFollow({
    socket, sendFollow, viewportSize,
    applyCamera: applyFollowCamera,
    minScale: MIN_SCALE, maxScale: MAX_SCALE
  });

  // Mọi thao tác CHỈ đổi camera đều đi qua đây. Camera là riêng từng người: nó
  // được lưu vào localStorage bằng effect theo view, còn api.js thì đã cắt
  // `view` khỏi payload PUT từ lâu. Vì vậy gọi saveNow/store.commit ở nhóm hàm
  // này (bản cũ có ở zoom, vừa khung, nhảy tới thẻ/khung, thoát trình chiếu)
  // KHÔNG ghi được gì lên server, nhưng vẫn đẩy cả board kèm ảnh base64 đi và
  // bắt server phát board:update cho mọi người — nghĩa là chỉ cần một người
  // cuộn chuột là màn hình của tất cả những người còn lại bị dựng lại.
  //
  // Đây cũng là chỗ huỷ ghim màn hình: người dùng tự lái camera thì thôi bám
  // theo người khác. Không có chốt này thì họ zoom xong màn hình bị kéo ngược
  // lại ngay lập tức — trông y như app treo. Vòng bám đi cửa riêng
  // (applyFollowCamera) nên không tự huỷ mình ở đây.
  function setCamera(nextView) {
    stopFollow();
    setView(nextView);
  }

  function zoomButton(factor) {
    const rect = viewportRef.current.getBoundingClientRect();
    setCamera(computeZoom(view, rect, rect.left + rect.width / 2, rect.top + rect.height / 2, factor));
  }

  // Bấm/kéo trên minimap: chỉ dời camera, giữ nguyên mức phóng. Camera là của
  // riêng từng người (api.js không gửi `view` lên server) nên đây không phải một
  // sửa đổi board — không ghi lịch sử, không lưu, không phát cho ai.
  function goToPoint(pt) {
    const el = viewportRef.current;
    if (!el) return;
    // Bấm/kéo trên minimap cũng là tự lái camera → thôi bám theo người khác.
    stopFollow();
    const rect = el.getBoundingClientRect();
    const view = viewRef.current;
    setView((prev) => ({ ...prev, ...panForCenter(pt, view, { w: rect.width, h: rect.height }) }));
  }

  function fitToView() {
    if (board.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    board.nodes.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function zoomToNodes(ids) {
    if (!ids || ids.length === 0) return;
    const targets = board.nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function zoomToSelection() {
    zoomToNodes(selectedIds.size > 0 ? Array.from(selectedIds) : board.nodes.map((n) => n.id));
  }

  function jumpToCard(id) {
    setSelectedIds(new Set([id]));
    zoomToNodes([id]);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

  // Đưa con trỏ của một người khác vào giữa màn hình. Camera là dữ liệu riêng
  // từng máy (lib/camera.js) nên chỉ setBoard, không commit vào lịch sử undo —
  // nhìn sang chỗ đồng đội không phải là một thao tác sửa board.
  //
  // Đi qua setCamera (không setBoard thẳng) để nó huỷ ghim: đang bám màn hình A
  // mà bấm nhảy tới con trỏ B thì vòng bám sẽ kéo ngược về A ngay khung hình
  // sau, và cú bấm trông như không có tác dụng gì.
  function jumpToPeer(peer) {
    const rect = viewportRef.current.getBoundingClientRect();
    const { scale } = view;
    setCamera({ scale, panX: rect.width / 2 - peer.x * scale, panY: rect.height / 2 - peer.y * scale });
    // Con trỏ peer nhỏ và có thể đang đứng yên giữa một rừng thẻ — nháy sáng
    // một nhịp để mắt bắt được sau khi màn hình vừa nhảy.
    setSpotlightPeerId(peer.socketId);
    setTimeout(() => setSpotlightPeerId((cur) => (cur === peer.socketId ? null : cur)), 1600);
  }

  function startPan(e) {
    e.preventDefault();
    // Tự lia nền → thôi bám theo người khác. Đặt ở đây (mousedown) chứ không
    // trong onMove: người dùng vừa chạm vào là dừng ngay, không phải đợi camera
    // giằng co với vòng bám qua vài khung hình.
    stopFollow();
    const startX = e.clientX, startY = e.clientY;
    const startPanX = view.panX, startPanY = view.panY;
    let dragging = false;
    const THRESHOLD = 4;

    const onMove = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) {
        dragging = true;
        setIsPanning(true);
      }
      if (!dragging) return;
      const nx = startPanX + (ev.clientX - startX);
      const ny = startPanY + (ev.clientY - startY);
      setView((prev) => ({ ...prev, panX: nx, panY: ny }));
    };
    function onUp() {
      if (dragging) {
        setIsPanning(false);
        // KHÔNG lưu: lia sa bàn chỉ đổi camera, mà camera là riêng từng người
        // (api.js đã bỏ `view` khỏi payload). Lần PUT ở đây không ghi được gì,
        // nhưng vẫn đẩy cả board — kể cả ảnh base64 — lên server rồi bắt server
        // phát board:update cho MỌI người khác. Mỗi cú lia nền của một người là
        // một cú giật trên màn hình tất cả những người còn lại.
        suppressContextMenuRef.current = true;
        setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
      }
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  // Chuột → toạ độ canvas. Bản sao của toCanvas trong useInk.js; không gom
  // chung được vì ở đó nó nhận `view` qua ref của hook, còn ở đây board đã có
  // sẵn trong tầm tay.
  function clientToCanvas(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.panX) / view.scale,
      y: (clientY - rect.top - view.panY) / view.scale
    };
  }

  // Điểm trên bảng (toạ độ canvas) ứng với một điểm trên màn hình. Đọc qua
  // boardRef chứ không phải `board`: hàm này được gọi từ trong listener của một
  // cú kéo dài vài giây, mà closure của listener giữ `board` của lượt render lúc
  // mousedown — camera có thể đã đổi từ lúc đó.
  function toCanvasPoint(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.panX) / view.scale,
      y: (clientY - rect.top - view.panY) / view.scale
    };
  }

  function eventToCanvas(e) {
    return clientToCanvas(e.clientX, e.clientY);
  }

  return {
    followingId, pendingId, followError, watcherCount, follow, stopFollow, setCamera, zoomButton, goToPoint, fitToView, zoomToNodes, zoomToSelection, jumpToCard, jumpToPeer, startPan, clientToCanvas, toCanvasPoint, eventToCanvas,
    bind: (d) => { depsRef.current = d; }
  };
}
