import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trailingThrottle } from "./raf-throttle.js";
import { sweepExpired } from "./useLiveSync.js";
import { mergeInkPacket, reconcileInkOverlay } from "./ink-live.js";

// Nhịp phát: ~25 gói/giây. Nhanh hơn nhịp 60ms của kéo thẻ vì mắt bắt nét vẽ
// nhạy hơn bắt thẻ chạy. Một người vẽ liên tục tốn chừng 1KB/giây.
const INK_SEND_MS = 40;
const SWEEP_MS = 300;
const EMPTY_MAP = new Map();

// QUAN TRỌNG — chỉ người ĐANG THẬT SỰ vẽ mới được phát; người nhận không bao
// giờ phát lại. Đây đúng cái bẫy mà ghi chú dài trong useLiveSync.js mô tả: nếu
// người nhận phát lại thì A → B → A thành vòng vọng và nét nhảy đi nhảy lại.
// Hook này chỉ phát từ trong các hàm được handler chuột gọi tay, không có effect
// nào theo dõi board rồi phát lại.
export function useInkLive(socket) {
  const [liveStrokes, setLiveStrokes] = useState(EMPTY_MAP);
  const socketRef = useRef(socket);
  const strokeIdRef = useRef(0);       // số đếm cục bộ; server đính socketId
  const seqRef = useRef(0);
  const kindRef = useRef("pen");       // kind của hình đang kéo, để gói giữa chừng tự mang theo

  useEffect(() => {
    socketRef.current = socket;
    return () => { socketRef.current = null; };
  }, [socket]);

  // QUAN TRỌNG — vì sao phải có bộ tích luỹ riêng thay vì throttle thẳng lời
  // gọi: trailingThrottle THAY tham số đang chờ (`pending = args`). Gói này mang
  // ĐIỂM MỚI THÊM, nên nếu ba lần gọi rơi vào cùng một cửa sổ 40ms thì hai lô
  // điểm đầu bị ghi đè và mất vĩnh viễn — đúng cái "nét khuyết khúc" mà cả thiết
  // kế này sinh ra để tránh. Điểm phải cộng dồn vào `pendingPtsRef`, và throttle
  // chỉ quyết định LÚC NÀO xả, không quyết định xả cái gì.
  const pendingPtsRef = useRef([]);
  const pendingEraseRef = useRef([]);

  const emitNow = useCallback((payload) => {
    socketRef.current?.emit("live:ink", payload);
  }, []);

  const flushPtsRef = useRef(null);
  if (!flushPtsRef.current) {
    flushPtsRef.current = trailingThrottle(() => {
      if (!pendingPtsRef.current.length) return;
      const pts = pendingPtsRef.current;
      pendingPtsRef.current = [];
      // seq chỉ tăng khi THẬT SỰ phát: nó đánh số gói đã gửi, không đánh số lần
      // chuột nhích.
      seqRef.current += 1;
      socketRef.current?.emit("live:ink", { strokeId: strokeIdRef.current, seq: seqRef.current, pts });
    }, INK_SEND_MS);
  }

  const flushEraseRef = useRef(null);
  if (!flushEraseRef.current) {
    flushEraseRef.current = trailingThrottle(() => {
      if (!pendingEraseRef.current.length) return;
      const erase = pendingEraseRef.current;
      pendingEraseRef.current = [];
      socketRef.current?.emit("live:ink", { strokeId: strokeIdRef.current, erase });
    }, INK_SEND_MS);
  }

  // KHÁC bút: ở đây KHÔNG cần bộ tích luỹ, và đó không phải sơ suất.
  // trailingThrottle THAY tham số đang chờ (`pending = args`) — với gói mang
  // ĐIỂM MỚI THÊM thì đó là mất dữ liệu, nhưng với gói mang CẢ HỘP thì đó đúng
  // là hành vi mong muốn: hộp sau đã chứa trọn thông tin của hộp trước.
  const flushBoxRef = useRef(null);
  if (!flushBoxRef.current) {
    flushBoxRef.current = trailingThrottle((box) => {
      seqRef.current += 1;
      socketRef.current?.emit("live:ink", {
        strokeId: strokeIdRef.current, seq: seqRef.current, kind: kindRef.current, pts: box
      });
    }, INK_SEND_MS);
  }

  useEffect(() => () => {
    flushPtsRef.current?.cancel();
    flushEraseRef.current?.cancel();
    flushBoxRef.current?.cancel();
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onInk(packet) {
      setLiveStrokes((prev) => mergeInkPacket(prev, packet, Date.now()));
    }
    socket.on("live:ink", onInk);
    return () => socket.off("live:ink", onInk);
  }, [socket]);

  // Một bộ quét theo nhịp, cùng cách useLiveSync.js làm: người vẽ rớt mạng giữa
  // nét thì nét tạm tự dọn sau INK_LIVE_TTL_MS.
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveStrokes((prev) => sweepExpired(prev, Date.now()));
    }, SWEEP_MS);
    return () => clearInterval(timer);
  }, []);

  // Gói đầu phải đi NGAY, không nằm chờ trong throttle: nó mang màu và độ dày,
  // thiếu nó thì mọi gói sau bị người nhận bỏ (xem mergeInkPacket).
  const beginStroke = useCallback((color, w, pts, dashed) => {
    flushPtsRef.current.cancel();
    pendingPtsRef.current = [];
    strokeIdRef.current += 1;
    seqRef.current = 0;
    emitNow({ strokeId: strokeIdRef.current, seq: 0, color, w, pts, dashed: dashed === true });
  }, [emitNow]);

  const pushPoints = useCallback((unsent) => {
    if (!unsent.length) return;
    for (const v of unsent) pendingPtsRef.current.push(v);
    // Xả mảng của người gọi: mỗi điểm chỉ được gửi đúng một lần, vì người nhận
    // NỐI THÊM chứ không thay cả nét.
    unsent.length = 0;
    flushPtsRef.current();
  }, []);

  // Xả nốt điểm còn treo TRƯỚC gói done, không thì đuôi nét bị cắt trên màn hình
  // người khác cho tới khi board:update về.
  const endStroke = useCallback((drawingId) => {
    flushPtsRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, done: true, drawingId: drawingId ?? null });
  }, [emitNow]);

  // Gói đầu phải đi NGAY: nó mang kind, màu, độ dày và chế độ tô; thiếu nó thì
  // mọi gói sau bị người nhận bỏ (xem mergeInkPacket).
  const beginShape = useCallback((kind, color, w, fill, box, dashed) => {
    flushBoxRef.current.cancel();
    strokeIdRef.current += 1;
    seqRef.current = 0;
    kindRef.current = kind;
    emitNow({
      strokeId: strokeIdRef.current, seq: 0, kind, color, w,
      fill: fill === true, dashed: dashed === true, pts: box
    });
  }, [emitNow]);

  const pushShape = useCallback((box) => {
    flushBoxRef.current(box);
  }, []);

  // Xả nốt hộp còn treo TRƯỚC gói done, không thì hình trên màn hình người khác
  // đứng ở kích thước của gói gần nhất cho tới khi board:update về.
  const endShape = useCallback((drawingId) => {
    flushBoxRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, done: true, drawingId: drawingId ?? null });
  }, [emitNow]);

  // Gọi từ onBlur trong useInk.js để bỏ dở BẤT KỲ thứ gì đang dở — bút hay cục
  // gôm — nên phải huỷ cả hai bộ tích luỹ, không chỉ của bút. Chỉ một trong
  // hai (pendingPtsRef/pendingEraseRef) thật sự có gì để huỷ tại một thời
  // điểm (một phiên mousedown chỉ là "pen" hoặc "eraser", không bao giờ cả
  // hai), nên huỷ luôn cả hai vô hại. Thiếu vế erase thì timer trailingThrottle
  // của flushEraseRef còn treo có thể bắn SAU gói cancel, dựng lại đúng entry
  // vừa bị xoá trong mergeInkPacket (packet.erase là mảng thì nó tạo/gộp lại
  // entry, không quan tâm gói cancel trước đó) — nét/vệt gôm cũ sống lại trên
  // màn hình người khác tới hết INK_LIVE_TTL_MS dù người vẽ đã rời tab.
  const cancelStroke = useCallback(() => {
    flushPtsRef.current.cancel();
    pendingPtsRef.current = [];
    flushEraseRef.current.cancel();
    pendingEraseRef.current = [];
    flushBoxRef.current.cancel();
    emitNow({ strokeId: strokeIdRef.current, cancel: true });
  }, [emitNow]);

  // Lượt gôm cũng chiếm một strokeId riêng, vì các gói erase của cùng một lần
  // quét phải gom vào MỘT entry overlay. Tăng số đếm ở đầu lượt (kể cả khi cú
  // bấm đầu chưa chạm nét nào) để lần quét sau không nối tiếp vào lần trước.
  const beginErase = useCallback((ids) => {
    flushEraseRef.current.cancel();
    pendingEraseRef.current = [];
    strokeIdRef.current += 1;
    if (ids.length) emitNow({ strokeId: strokeIdRef.current, erase: ids.slice() });
  }, [emitNow]);

  const pushErase = useCallback((ids) => {
    if (!ids.length) return;
    for (const id of ids) pendingEraseRef.current.push(id);
    flushEraseRef.current();
  }, []);

  const endErase = useCallback(() => {
    flushEraseRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, erase: [], done: true });
  }, [emitNow]);

  const reconcile = useCallback((board) => {
    setLiveStrokes((prev) => reconcileInkOverlay(prev, board));
  }, []);

  // useMemo: object này là dependency của useInk và của applyRemoteBoard. Trả
  // một object mới mỗi render là bắt chúng dựng lại theo, kể cả khi không có gì
  // thật sự đổi.
  return useMemo(
    () => ({
      liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke,
      beginShape, pushShape, endShape,
      beginErase, pushErase, endErase, reconcile
    }),
    [
      liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke,
      beginShape, pushShape, endShape,
      beginErase, pushErase, endErase, reconcile
    ]
  );
}
