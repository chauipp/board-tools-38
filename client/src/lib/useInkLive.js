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
  // Chỗ đặt của ô chữ đang gõ. Nằm trong ref vì gói giữa chừng chỉ mang chữ,
  // còn vị trí thì không đổi trong suốt một lượt gõ.
  const textPosRef = useRef([0, 0]);

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

  // CHỮ ĐANG GÕ. Cùng lý do với hộp, không cần bộ tích luỹ: mỗi gói mang TRỌN
  // đoạn văn bản hiện tại, nên gói sau thay được gói trước và việc
  // trailingThrottle bỏ gói đang chờ đúng là điều mong muốn — gõ nhanh mười
  // phím trong 40ms thì chỉ có trạng thái cuối cùng là đáng gửi.
  const flushTextRef = useRef(null);
  if (!flushTextRef.current) {
    flushTextRef.current = trailingThrottle((text) => {
      seqRef.current += 1;
      socketRef.current?.emit("live:ink", {
        strokeId: strokeIdRef.current, seq: seqRef.current, kind: "text",
        pts: textPosRef.current, text
      });
    }, INK_SEND_MS);
  }

  // NÉT ĐANG BỊ DỜI / CO GIÃN / SỬA HÌNH. Cùng lý do với hộp và chữ, không cần
  // bộ tích luỹ: gói mang trạng thái tuyệt đối nên gói sau thay được gói trước.
  const flushMoveRef = useRef(null);
  if (!flushMoveRef.current) {
    flushMoveRef.current = trailingThrottle((moving) => {
      seqRef.current += 1;
      socketRef.current?.emit("live:ink", {
        strokeId: strokeIdRef.current, seq: seqRef.current, moving
      });
    }, INK_SEND_MS);
  }

  useEffect(() => () => {
    flushPtsRef.current?.cancel();
    flushEraseRef.current?.cancel();
    flushBoxRef.current?.cancel();
    flushTextRef.current?.cancel();
    flushMoveRef.current?.cancel();
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

  // Mở ô nhập chữ. Gói đầu phải đi NGAY vì nó mang màu, cỡ chữ và `editId`;
  // thiếu nó thì mọi gói sau bị người nhận bỏ (xem mergeInkPacket).
  //
  // `editId` là id đoạn text đang sửa, null nếu đang tạo mới. Người nhận dùng nó
  // để GIẤU bản đã lưu đi trong lúc mình còn đang gõ — không giấu thì họ thấy
  // chồng hai lớp chữ lệch nhau, đúng như bản thân mình thấy nếu thiếu
  // editingTextId ở phía local.
  const beginText = useCallback((pts, text, color, size, editId) => {
    flushTextRef.current.cancel();
    strokeIdRef.current += 1;
    seqRef.current = 0;
    textPosRef.current = pts;
    emitNow({
      strokeId: strokeIdRef.current, seq: 0, kind: "text",
      pts, text, color, size, editId: editId ?? null
    });
  }, [emitNow]);

  const pushText = useCallback((text) => {
    flushTextRef.current(text);
  }, []);

  // Xả nốt chữ còn treo TRƯỚC gói done, không thì mấy ký tự cuối không bao giờ
  // tới màn hình người khác — họ thấy đoạn văn cụt cho tới khi board:update về.
  const endText = useCallback((drawingId) => {
    flushTextRef.current.flush();
    emitNow({ strokeId: strokeIdRef.current, done: true, drawingId: drawingId ?? null });
  }, [emitNow]);

  // Đóng ô nhập mà KHÔNG lưu gì (gõ rỗng, hoặc xoá sạch một đoạn đang sửa). Phải
  // là `cancel` chứ không phải `done`: gói done không có drawingId thì overlay
  // sống tới hết INK_SETTLE_TTL_MS — sáu giây một đoạn chữ ma nằm trên bảng
  // người khác sau khi mình đã xoá nó.
  const cancelText = useCallback(() => {
    flushTextRef.current.cancel();
    emitNow({ strokeId: strokeIdRef.current, cancel: true });
  }, [emitNow]);

  // Bao nhiêu nét, và tổng bao nhiêu con số, thì còn phát live cho một cú kéo.
  //
  // Kéo cả cụm thì gói mang pts của MỌI nét trong cụm, ở nhịp 25 gói/giây. Một
  // nét bút đã rút gọn cỡ 60 điểm là 120 số; vài nét thì không sao, nhưng bôi
  // chọn cả bảng rồi kéo có thể là hàng vạn số mỗi gói. Quá trần thì THÔI phát,
  // và cú kéo đó quay về hành vi cũ: người khác thấy cụm nhảy tới chỗ mới ở lần
  // lưu. Cố ý chọn "im lặng bỏ" thay vì "cắt bớt danh sách" — kéo 100 nét mà
  // người kia chỉ thấy 40 nét nhúc nhích còn 60 nét đứng yên thì khó hiểu hơn
  // hẳn việc cả cụm cùng đứng yên rồi nhảy một phát.
  const MOVE_MAX_ITEMS = 60;
  const MOVE_MAX_NUMBERS = 4000;

  // `list` là [{ id, pts, size?, w?, h? }] — trạng thái HIỆN TẠI của các nét
  // đang bị thao tác. Xem ghi chú ở applyInkMoves về việc vì sao là tuyệt đối.
  const moveTooBig = useCallback((list) => {
    if (!list || !list.length || list.length > MOVE_MAX_ITEMS) return true;
    let n = 0;
    for (const m of list) {
      n += (m.pts || []).length;
      if (n > MOVE_MAX_NUMBERS) return true;
    }
    return false;
  }, []);

  const beginMove = useCallback(() => {
    flushMoveRef.current.cancel();
    strokeIdRef.current += 1;
    seqRef.current = 0;
  }, []);

  const pushMove = useCallback((list) => {
    if (moveTooBig(list)) return;
    flushMoveRef.current(list);
  }, [moveTooBig]);

  // Gói chốt mang trạng thái CUỐI CÙNG: nó phải sống qua khoảng trống giữa lúc
  // nhả chuột và lúc board:update về, không thì cụm nhảy về chỗ cũ rồi lại nhảy
  // tới chỗ mới. reconcileInkOverlay dọn nó đúng lúc bản lưu khớp.
  const endMove = useCallback((list) => {
    flushMoveRef.current.cancel();
    if (moveTooBig(list)) {
      // Không phát gì suốt cú kéo thì cũng đừng phát gói chốt: một gói duy nhất
      // mang cả vạn số vẫn là cả vạn số.
      emitNow({ strokeId: strokeIdRef.current, cancel: true });
      return;
    }
    emitNow({ strokeId: strokeIdRef.current, seq: seqRef.current + 1, moving: list, done: true });
  }, [emitNow, moveTooBig]);

  // Bỏ dở một cú kéo (mất focus giữa chừng): overlay phải biến ngay, không thì
  // cụm treo ở vị trí dở dang trên màn hình người khác tới hết TTL.
  const cancelMove = useCallback(() => {
    flushMoveRef.current.cancel();
    emitNow({ strokeId: strokeIdRef.current, cancel: true });
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
      beginText, pushText, endText, cancelText,
      beginMove, pushMove, endMove, cancelMove,
      beginErase, pushErase, endErase, reconcile
    }),
    [
      liveStrokes, beginStroke, pushPoints, endStroke, cancelStroke,
      beginShape, pushShape, endShape,
      beginText, pushText, endText, cancelText,
      beginMove, pushMove, endMove, cancelMove,
      beginErase, pushErase, endErase, reconcile
    ]
  );
}
