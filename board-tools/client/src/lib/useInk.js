import { useCallback, useEffect, useRef, useState } from "react";
import { simplifyStroke } from "./stroke.js";
import {
  drawingsHitBy, drawingBox, normalizeBox, ptsFromBox, shapeKindOf, SHAPE_CLOSED, SHAPE_MIN_DIAGONAL
} from "./shape.js";
import { rafThrottle } from "./raf-throttle.js";
import { snapShape, snapLine, SNAP_HOLD_MS, SNAP_HINT_MS, SNAP_MOVE_TOL } from "./recognize.js";
import {
  snapPolygon, CLOSE_STICK_PX, CLOSE_UNSTICK_PX, CHAIN_MIN_PX, CHAIN_MIN_MS
} from "./polygon-snap.js";
import { ERASE_PART, eraseRadius, eraseBounds, cuttableOutline, cutPartsAlong } from "./erase.js";
import { isScribble, scribbleTargets } from "./scribble.js";
import { recognizeInk } from "./handwriting.js";
import { TEXT_SIZES, textBox } from "./text-el.js";
import { createStillWatch, STILL_TOL } from "./pointer-input.js";

// Bán kính gôm KIỂU "CẢ NÉT", đơn vị toạ độ canvas. Cộng thêm w/2 của từng nét
// trong drawingsHitBy, nên nét dày dễ chạm hơn nét mảnh — đúng cảm giác mong đợi.
//
// Cố định, KHÔNG theo `penPrefs.ew`: ở kiểu này cục tẩy là một cái que chỉ, việc
// của nó là nói "cái nét này" chứ không phải phủ một vùng. Cho nó bán kính 28
// thì trỏ vào một nét sẽ nuốt luôn ba nét nằm cạnh — mà ở kiểu "cả nét" thì mỗi
// cái nuốt oan là mất trọn một nét chứ không phải sứt một mẩu.
const ERASE_RADIUS = 8;

// Đang cầm BÚT, ấn xuống ĐÚNG một nét đã có rồi giữ yên chừng này thì nét đó bị
// tẩy. Cái lợi: xoá một nét lỡ tay không phải đi đổi sang cục gôm rồi đổi về.
//
// Ngắn hơn SNAP_HOLD_MS (giữ tay để bắt hình) và đó là chủ ý: hai cử chỉ này
// không bao giờ tranh nhau vì chúng xảy ra ở hai thời điểm khác hẳn — tẩy là
// giữ NGAY LÚC ẤN XUỐNG khi chưa vẽ gì, bắt hình là giữ SAU KHI đã vẽ xong một
// đường. Nhích tay một cái là chuyển hẳn từ cái đầu sang cái sau.
export const HOLD_ERASE_MS = 650;

// Ấn xuống CHỖ TRỐNG rồi giữ yên chừng này thì đổi qua lại giữa BÚT và CỤC GÔM.
// Vẽ rồi xoá là một nhịp lặp đi lặp lại, và đổi tool giữa nhịp đó vốn phải với
// tay lên thanh công cụ hoặc nhớ phím tắt — cử chỉ này giữ tay ở nguyên chỗ
// đang làm việc.
//
// Đúng bằng HOLD_ERASE_MS, và cùng một lý do: cả hai đều là "giữ tay tại chỗ
// ngay lúc ấn xuống". Hai nhịp chờ khác nhau cho hai cử chỉ mở đầu giống hệt
// nhau thì tay không bao giờ học được, nên chúng cố ý bằng nhau. Cái quyết định
// việc nào xảy ra không phải thời gian mà là CHỖ ẤN: trúng một nét thì tẩy nét
// đó, trúng chỗ trống thì đổi tool — hai chỗ không giao nhau bao giờ.
export const HOLD_SWAP_MS = HOLD_ERASE_MS;

// Mảng rỗng dùng chung cho setEraseIds: một mảng mới ở mỗi lần gọi làm InkLayer
// (memo) dựng lại toàn bộ nét đã lưu dù chẳng có nét nào đang bị đánh dấu.
const EMPTY_IDS = [];

// ── ĐỆM NÉT VỪA VIẾT (cho cử chỉ đọc chữ) ──────────────────────────────────
//
// Đọc chữ khác mọi cử chỉ khác của cây bút ở một điểm quyết định KIẾN TRÚC: một
// chữ cái không phải một nét. Chữ "i" là hai nét, số "4" là hai nét, cụm "42"
// là ba nét — mà toàn bộ máy móc trong file này sống trong lòng MỘT lượt
// mousedown→mouseup. Nên phải có một cái đệm nằm ngoài lượt vẽ, nhớ lại mấy nét
// bút vừa lưu, để lúc giữ tay còn có cái mà đọc.
//
// Đệm bị VỨT khi nét mới rõ ràng không thuộc cùng một cụm chữ với mấy nét cũ:
//   cách xa theo chiều NGANG quá HW_GAP lần chiều cao dòng → cụm khác;
//   lệch theo chiều DỌC quá HW_LINE lần chiều cao dòng → dòng khác.
// Đo bằng chiều cao dòng chứ không bằng một số tuyệt đối, vì đây là toạ độ
// canvas: viết chữ to hay nhỏ, phóng to hay thu nhỏ bảng, thì khoảng cách giữa
// hai chữ cũng co giãn theo đúng cỡ chữ.
//
// HW_GAP để rộng hơn hẳn ngưỡng khoảng-trắng bên handwriting.js (0,45) là cố ý:
// ở đó khe hở nghĩa là "có dấu cách", còn ở đây nghĩa là "thôi, hai chuyện khác
// nhau". Viết "80 90" phải còn nằm trong cùng một đệm thì mới đọc ra được cả
// cụm có dấu cách ở giữa.
const HW_GAP = 1.4;
const HW_LINE = 0.8;

// Đệm không giữ quá ngần này nét. Một dòng chữ dài hơn thế thì phần đầu đã trôi
// ra khỏi tầm nhìn của phép đọc rồi, mà giữ lại chỉ tổ làm mỗi lần giữ tay phải
// quét một đống nét không liên quan.
const HW_MAX_STROKES = 24;

// Chiều cao phần thân chữ hoa so với cỡ chữ. Dùng để chọn cỡ chữ máy cho khớp
// với cỡ chữ vừa viết tay: viết to thì ra chữ to.
const CAP_RATIO = 0.7;

// TỰ ĐỌC CHỮ SAU KHI NGỪNG TAY. Viết xong, NHẤC bút, rồi ngừng chừng này không
// viết tiếp thì cả cụm tự thành chữ máy. Khác hẳn cử chỉ bắt hình (giữ tay khi
// chuột VẪN đang ấn): ở đây tay đã nhả, thời gian đo từ lúc mouseup.
//
// Con số này là một đánh đổi không tránh được. Dài quá thì viết xong phải chờ
// mới thấy chữ; ngắn quá thì cái ngừng-tay-để-nghĩ ngay GIỮA lúc viết (giữa hai
// nét, giữa hai chữ) cũng kích hoạt, và nó đọc mất nửa cụm. Chọn hơi rộng tay —
// dài hơn nhịp nhấc-hạ bút thường giữa hai nét — vì đọc sớm nửa cụm khó chịu hơn
// là chờ thêm non một giây. Mỗi lần ấn bút mới huỷ cái hẹn cũ rồi finish() đặt
// lại, nên viết đều tay thì hẹn cứ bị dời tới lúc thật sự ngừng.
export const HW_PAUSE_MS = 900;

function bufBox(buf) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const e of buf) {
    for (let i = 0; i + 1 < e.pts.length; i += 2) {
      if (e.pts[i] < l) l = e.pts[i];
      if (e.pts[i] > r) r = e.pts[i];
      if (e.pts[i + 1] < t) t = e.pts[i + 1];
      if (e.pts[i + 1] > b) b = e.pts[i + 1];
    }
  }
  return { l, t, r, b, w: r - l, h: b - t };
}

// Ghi thêm một nét vào đệm, vứt đệm cũ nếu nét mới rõ ràng thuộc chuyện khác.
function extendInkBuf(buf, id, pts) {
  const box = bufBox([{ pts }]);
  if (buf.length) {
    const prev = bufBox(buf);
    // Sàn 1 đơn vị: nét đầu tiên có thể là một cái chấm (chiều cao 0), và chia
    // cho 0 thì mọi khoảng cách đều thành vô cực — đệm bị vứt ở mọi nét.
    const lineH = Math.max(prev.h, box.h, 1);
    const gapX = box.l - prev.r;
    const dy = Math.abs((box.t + box.h / 2) - (prev.t + prev.h / 2));
    if (gapX > HW_GAP * lineH || dy > HW_LINE * lineH) buf = [];
  }
  const next = buf.concat([{ id, pts }]);
  return next.length > HW_MAX_STROKES ? next.slice(next.length - HW_MAX_STROKES) : next;
}

// Cỡ chữ máy gần nhất với chiều cao vừa viết tay.
function nearestSize(capH) {
  const want = capH / CAP_RATIO;
  let best = TEXT_SIZES[0];
  for (const s of TEXT_SIZES) if (Math.abs(s - want) < Math.abs(best - want)) best = s;
  return best;
}

// Chuột → toạ độ canvas. Camera nằm trong board.view, đọc qua ref để handler
// gắn vào window không bị bám vào một bản chụp cũ.
function toCanvas(e, viewportEl, view) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - view.panX) / view.scale,
    y: (e.clientY - rect.top - view.panY) / view.scale
  };
}

export function useInk({
  tool, penPrefs, boardRef, viewportRef,
  onStrokeDone, onEraseDone, onPick, onSwapTool, live, measureText
}) {
  const [draft, setDraft] = useState(null);
  const [eraseIds, setEraseIds] = useState([]);
  // Bản xem trước của CỤC TẨY THEO ĐỘ RỘNG: { ids, parts }. `ids` là các nét
  // đang bị cắt dở — InkLayer GIẤU HẲN chúng (không phải làm mờ như eraseIds),
  // còn `parts` là những mảnh còn sống, vẽ đè vào đúng chỗ.
  //
  // Phải thay cả nét chứ không chỉ làm mờ, vì ở kiểu này thứ người dùng cần thấy
  // không phải "nét này sắp mất" mà là "rãnh vừa cắt tới đâu rồi" — nó là phản
  // hồi để nhắm tay, không phải một lời cảnh báo.
  const [cut, setCut] = useState(null);
  // Vòng báo "đang giữ tay": { x, y, kind, ms } — toạ độ MÀN HÌNH (position:
  // fixed), `kind` là "snap" (sắp bắt hình) hay "erase" (sắp tẩy nét dưới tay),
  // `ms` là thời gian còn lại để vòng chạy cho khớp. null khi không có gì đang
  // chờ. Là state vì nó phải hiện ra trên DOM, nhưng chỉ đổi giá trị đúng hai
  // lần cho mỗi lần tay đứng lại — xem hideHint() bên dưới về việc vì sao không
  // được gọi setState ở mọi nhịp chuột.
  const [snapHint, setSnapHint] = useState(null);

  // `live` qua ref: effect nghe `blur` chỉ cần gắn MỘT lần, không phải gỡ/gắn
  // lại mỗi khi object live được dựng lại.
  const liveRef = useRef(live);
  liveRef.current = live;

  // Điểm thô nằm trong ref, KHÔNG trong state: setState cho mỗi mousemove là
  // dựng lại cây React 100+ lần/giây rồi vứt đi phần lớn.
  const ptsRef = useRef([]);
  // Điểm chưa gửi lên kênh live — gói mang ĐIỂM MỚI THÊM, không phải cả nét.
  const unsentRef = useRef([]);
  const eraseSetRef = useRef(new Set());
  // Map<id, { d, parts }> của lượt tẩy-theo-độ-rộng đang chạy: `d` là nét GỐC
  // (giữ màu/độ dày/nét đứt để dựng lại mảnh), `parts` là các mảnh còn sống sau
  // mọi nhát đã quét. Chỉ nét bút mới có mặt ở đây — xem ghi chú đầu erase.js.
  const partsRef = useRef(null);
  // Hộp bao của từng nét, nhớ lại theo TỪNG BẢN board. Cục tẩy phải hỏi hộp bao
  // của mọi nét ở mỗi nhịp chuột để loại sớm, mà drawingBox() của một nét bút là
  // một lượt quét toàn bộ điểm — tính lại cả trăm lần mỗi giây thì chính cái
  // phép loại-cho-rẻ lại thành thứ đắt nhất. Khoá theo tham chiếu mảng drawings:
  // board là bất biến nên mảng đổi tham chiếu đúng lúc nội dung đổi.
  const boxCacheRef = useRef({ list: null, map: null });
  // Mấy nét bút vừa lưu, [{ id, pts }], để cử chỉ đọc chữ còn có cái mà đọc.
  // Xem ghi chú dài ở HW_GAP về việc vì sao nó phải sống NGOÀI lượt vẽ.
  const inkBufRef = useRef([]);
  // Hẹn giờ tự-đọc-chữ đang chờ (id của setTimeout, 0 = không có). Phải nằm
  // NGOÀI lượt vẽ như inkBufRef, cùng một lý do: một cụm chữ trải qua nhiều lần
  // nhấc bút, mà cái hẹn phải sống xuyên suốt để lần nhấc bút CUỐI mới là lần
  // kích hoạt. Đặt ở finish() lúc nhấc bút, huỷ ở đầu handleMouseDown lúc ấn bút.
  const hwTimerRef = useRef(0);
  const activeRef = useRef(null);   // "pen" | "eraser" | "shape" | null
  const startRef = useRef(null);   // điểm bắt đầu của hình khối đang kéo
  // Hộp mới nhất phải nằm trong REF, không đọc lại từ state `draft`: pushDraft
  // là rafThrottle nên hộp cuối cùng có thể chưa kịp vào state lúc mouseup, và
  // finish() gắn listener vào window ngay từ mousedown nên closure của nó giữ
  // `draft` của lượt render tại thời điểm đó (luôn là null). Cùng lý do liveRef
  // bên dưới phải tồn tại.
  const boxRef = useRef(null);

  // Hàm dọn của lượt ĐANG chạy: gỡ hai listener window và xoá activeRef. Phải
  // nằm trong ref vì onMove/finish là closure dựng lại mỗi lần mousedown, còn
  // effect nghe `blur` gắn một lần với deps [] nên không có cách nào thấy được
  // closure đó. Nhờ ref này chỉ có MỘT đường dọn: cả `finish` (mouseup bình
  // thường) và `onBlur` (mất focus giữa nét) đều đi qua nó, không còn chuyện
  // blur xoá state mà để listener sống rồi lượt đã chết vẫn commit được.
  const cleanupRef = useRef(null);

  // Nhận trọn MỘT object chứ không phải một dãy tham số: nét vẽ đã có tới sáu
  // thuộc tính (màu, độ dày, điểm, kind, tô, nét đứt) và không phải chỗ nào cũng
  // truyền đủ — nét bút không có kind cũng không có fill. Dãy tham số vị trí ở
  // cỡ đó là chỗ để lọt một `undefined` nằm sai ô mà không ai thấy.
  const pushDraft = useRef(null);
  if (!pushDraft.current) {
    pushDraft.current = rafThrottle((next) => setDraft(next));
  }
  const pushErase = useRef(null);
  if (!pushErase.current) {
    pushErase.current = rafThrottle((ids) => setEraseIds(ids));
  }
  const pushCut = useRef(null);
  if (!pushCut.current) {
    pushCut.current = rafThrottle((next) => setCut(next));
  }

  useEffect(() => () => {
    pushDraft.current?.cancel();
    pushErase.current?.cancel();
    pushCut.current?.cancel();
    if (hwTimerRef.current) clearTimeout(hwTimerRef.current);
  }, []);

  const handleMouseDown = useCallback((e) => {
    const viewportEl = viewportRef.current;
    const board = boardRef.current;
    if (!viewportEl || !board) return;

    // ẤN BÚT MỚI → HUỶ HẸN TỰ-ĐỌC-CHỮ ĐANG CHỜ. Nếu đây là nét viết TIẾP của cùng
    // cụm thì finish() sẽ đặt lại hẹn lúc nhấc bút; nếu là việc khác (xoá, chọn,
    // đổi tool) thì đằng nào cũng phải dừng — không để cái hẹn đọc mất nửa cụm
    // hay đọc lên trên một nét vừa bị đụng tới. Đặt TRƯỚC mọi return bên dưới để
    // bất kỳ cú ấn nào cũng huỷ được.
    if (hwTimerRef.current) { clearTimeout(hwTimerRef.current); hwTimerRef.current = 0; }

    // Tool text KHÔNG đi qua đây: nó không có lượt kéo nào để theo dõi, ô nhập
    // do IdeaMap dựng. Thiếu chốt này thì nhánh `else` cuối hàm — nhánh bút —
    // nhận luôn cú bấm và vẽ ra một nét bút vô hình một điểm.
    if (tool === "text") return;

    const start = toCanvas(e, viewportEl, board.view);
    // Nét liền hay nét đứt là lựa chọn ở khu 4, dùng chung cho bút và hình khối —
    // và nó đi kèm nét từ lúc bắt đầu vẽ, không phải thứ chỉ chỉnh được sau khi
    // đã vẽ xong. Chốt về boolean ngay đây để mọi nhánh dưới khỏi hỏi lại.
    const dashed = penPrefs.dashed === true;

    // Cục gôm đang ở kiểu nào, và to bằng nào. Chốt về hai biến ngay đây để giữa
    // lượt không chỗ nào phải đọc lại penPrefs — đổi kiểu tẩy trong lúc tay còn
    // đang quét thì nửa cú quét chạy luật này, nửa kia chạy luật khác.
    const partMode = tool === "eraser" && penPrefs.erase === ERASE_PART;
    const cutR = eraseRadius(penPrefs.ew);

    // Ảnh chụp các mảnh còn sống, dạng InkLayer vẽ được. Dựng lại từ đầu ở mỗi
    // nhịp thay vì sửa tại chỗ: số mảnh của một nét thay đổi liên tục trong lúc
    // quét, và một mảng mới ở đây rẻ hơn nhiều so với việc lần ra mảnh nào vừa
    // bị chẻ.
    function snapshotCut() {
      const ids = new Set();
      const parts = [];
      for (const [id, entry] of partsRef.current) {
        ids.add(id);
        entry.parts.forEach((pts, i) => parts.push({
          key: id + ":" + i, color: entry.d.color, w: entry.d.w, dashed: entry.d.dashed, pts
        }));
      }
      return { ids, parts };
    }

    // Rê cục tẩy từ a tới b: cắt thứ cắt được, xoá CẢ với thứ không cắt được.
    function applyCut(a, b) {
      const b0 = boardRef.current;
      const list = b0?.drawings || [];
      if (boxCacheRef.current.list !== list) boxCacheRef.current = { list, map: new Map() };
      const boxes = boxCacheRef.current.map;
      // Vùng cục tẩy vừa quét qua. Nét nào có hộp bao không chạm hộp này thì bỏ
      // qua ngay: trên bảng đông nét thì tuyệt đại đa số rơi vào đây, và bốn
      // phép so số rẻ hơn hẳn một lượt quét toàn bộ điểm của nét đó.
      const reach = eraseBounds(a.x, a.y, b.x, b.y, cutR);
      const gone = [];
      let touched = false;
      let dimmed = false;

      for (const d of list) {
        let box = boxes.get(d.id);
        if (box === undefined) { box = drawingBox(d); boxes.set(d.id, box); }
        if (!box) continue;
        if (box.x > reach.x + reach.w || reach.x > box.x + box.w
          || box.y > reach.y + reach.h || reach.y > box.y + box.h) continue;

        const line = cuttableOutline(d);
        if (!line) {
          // Chữ và hình tô đặc: hỏi bằng hit-test cũ, nhưng với bán kính của
          // chính cục tẩy này — không thì cục tẩy to bằng nắm tay lại phải chạm
          // chính xác vào viền mới ăn được một cái chữ nhật tô đặc.
          if (eraseSetRef.current.has(d.id) || !drawingsHitBy([d], b, cutR).length) continue;
          eraseSetRef.current.add(d.id);
          gone.push(d.id);
          touched = true;
          dimmed = true;
          continue;
        }
        const entry = partsRef.current.get(d.id);
        // Đã cắt sạch: không còn mảnh nào để cắt tiếp, và cutPartsAlong với mảng
        // rỗng sẽ trả null nên nó cũng không tự thoát ra được.
        if (entry && !entry.parts.length) continue;
        const next = cutPartsAlong(entry ? entry.parts : [line], a.x, a.y, b.x, b.y, cutR);
        if (!next) continue;
        partsRef.current.set(d.id, { d, parts: next });
        touched = true;
        // Chỉ báo cho người khác những thứ MẤT HẲN. Nét chỉ bị sứt một mẩu thì
        // im lặng, để board:update mang bản đã cắt về một lượt: kênh live không
        // có khái niệm "nét này giờ là ba nét", nên cách duy nhất để báo giữa
        // chừng là bảo họ xoá cả nét — rồi vài trăm mili giây sau nó hiện lại
        // thành mấy mảnh. Cái nháy đó nói SAI (nét có mất đâu) và nói sai thì tệ
        // hơn là nói chậm.
        if (!next.length) gone.push(d.id);
      }

      if (gone.length) live?.pushErase(gone);
      // Hình khối / chữ bị quét trúng thì MỜ ĐI như ở kiểu "cả nét" — chúng mất
      // trọn vẹn chứ không sứt mẻ, nên tín hiệu đúng vẫn là tín hiệu cũ.
      if (dimmed) pushErase.current(Array.from(eraseSetRef.current));
      if (touched) pushCut.current(snapshotCut());
    }

    if (tool === "eraser") {
      activeRef.current = "eraser";
      // Gọi cả khi rỗng: beginErase phải tăng strokeId để lượt quét này có khoá
      // overlay riêng, không nối tiếp vào lượt trước.
      if (partMode) {
        partsRef.current = new Map();
        live?.beginErase([]);
        applyCut(start, start);
      } else {
        eraseSetRef.current = new Set(drawingsHitBy(board.drawings || [], start, ERASE_RADIUS));
        pushErase.current(Array.from(eraseSetRef.current));
        live?.beginErase(Array.from(eraseSetRef.current));
      }
    } else if (tool === "shape") {
      activeRef.current = "shape";
      startRef.current = start;
      // penPrefs.kind là ID CỦA NÚT ở khu 4; kind lưu vào board có thể khác tên
      // (hình bình hành và hình thang đều lưu ra "quad"). Mọi thứ dưới đây dùng
      // kind đã quy đổi, chỉ ptsFromBox mới cần biết bấm nút nào.
      const kind = shapeKindOf(penPrefs.kind);
      // Hình mở không có vùng trong: `fill` phải bị dập ở ĐÂY, không trông vào
      // nút ở khu 4 đã bị disable — prefs cũ trong localStorage vẫn có thể mang
      // fill: true cùng với kind: "line".
      const fill = SHAPE_CLOSED.has(kind) && penPrefs.fill === true;
      const box = normalizeBox(start.x, start.y, start.x, start.y);
      boxRef.current = box;
      // boxRef giữ HỘP (phép đo đường chéo lúc chốt cần nó), còn thứ đưa ra
      // ngoài luôn đi qua ptsFromBox — với hình bình hành đó là bốn đỉnh thật.
      const pts = ptsFromBox(penPrefs.kind, box);
      pushDraft.current({ color: penPrefs.color, w: penPrefs.w, pts, kind, fill, dashed });
      live?.beginShape(kind, penPrefs.color, penPrefs.w, fill, pts, dashed);
    } else {
      activeRef.current = "pen";
      ptsRef.current = [start.x, start.y];
      unsentRef.current = [];
      pushDraft.current({ color: penPrefs.color, w: penPrefs.w, pts: ptsRef.current.slice(), dashed });
      live?.beginStroke(penPrefs.color, penPrefs.w, [Math.round(start.x), Math.round(start.y)], dashed);
    }

    // Điểm chuột mới nhất và trạng thái Shift mới nhất của lượt này. Giữ lại để
    // phím Shift nhấn/nhả GIỮA CHỪNG tính lại được hình ngay tại chỗ: bản cũ chỉ
    // đọc ev.shiftKey trong mousemove, nên giữ Shift mà tay đứng yên thì hình
    // không nhúc nhích — người dùng tưởng tính năng không có.
    let lastPoint = start;
    let lastShift = false;
    // Đầu chặng cắt của cục tẩy theo độ rộng. Biến RIÊNG chứ không mượn
    // lastPoint: cái đó là của tool Hình khối (điểm chuột mới nhất để tính lại
    // khi bấm/nhả Shift), và hai thứ trùng nghĩa hôm nay thì mai một cái đổi
    // nghĩa là cái kia hỏng theo mà không ai ngờ tới.
    let cutFrom = start;

    // ── Hai cử chỉ GIỮ TAY của tool bút ──────────────────────────────────────
    //
    // 1. Ấn xuống ĐÚNG một nét đã có rồi giữ yên HOLD_ERASE_MS → tẩy nét đó.
    //    Xoá một nét lỡ tay không phải đi đổi sang cục gôm rồi đổi về.
    // 2. Vẽ một đường rồi ĐỨNG YÊN hơn SNAP_HOLD_MS → nét tự nhảy về hình chuẩn
    //    gần nhất (recognize.js). Ra một HÌNH KÍN thì lượt vẽ chốt tại đó: nét
    //    tay đã bị thay bằng hình rồi, "vẽ tiếp" từ đó không có nghĩa gì rõ ràng.
    // 3. Ra một ĐOẠN THẲNG thì ngược lại — lượt vẽ ĐI TIẾP từ đúng đầu mút vừa
    //    chốt, và giữ tay lần nữa lại chốt thêm một đoạn. Cứ thế dựng dần một nét
    //    gấp khúc. Kéo đoạn cuối về DÍNH vào điểm xuất phát rồi giữ tay ở đó thì
    //    cả vòng khép lại thành hình (polygon-snap.js).
    //
    //    Vì sao đoạn thẳng được đi tiếp còn hình kín thì không: một hình kín đã
    //    tả trọn thứ người ta vẽ, còn một đoạn thẳng thì gần như bao giờ cũng là
    //    một CẠNH của thứ gì đó lớn hơn. Và đi tiếp không mất gì cả — thả chuột
    //    lúc nào là chốt lúc đó, đúng bằng hành vi cũ.
    //
    // Hai cái KHÔNG tranh nhau vì chúng ở hai thời điểm khác hẳn: tẩy là giữ
    // ngay lúc ấn xuống khi chưa vẽ gì, bắt hình là giữ sau khi đã vẽ. Nhích tay
    // quá SNAP_MOVE_TOL là chuyển hẳn từ cái đầu sang cái sau, không quay lại.
    //
    // Mốc đứng yên đo bằng toạ độ MÀN HÌNH, không phải toạ độ canvas: tay người
    // rung chừng vài pixel bất kể bảng đang zoom bao nhiêu.
    const isPen = activeRef.current === "pen";
    const snapOn = isPen && penPrefs.snap !== false;
    const scratchOn = isPen && penPrefs.scratch !== false;
    const hwOn = isPen && penPrefs.hw === true;
    // Nét nằm ngay dưới chỗ vừa ấn xuống. Nét vẽ sau cùng nằm trên, nên trúng
    // nhiều thì lấy cái trên — cùng luật với cú bấm chọn ở mode Chuột.
    const pressHits = isPen ? drawingsHitBy(board.drawings || [], start, ERASE_RADIUS) : [];
    // Nét nằm dưới chỗ vừa ấn xuống, giữ NGUYÊN suốt lượt. Khác eraseTargetId
    // ngay dưới — cái đó bị xoá ngay khi tay rời khỏi chỗ ấn (để vẽ đè lên một
    // nét có sẵn không tẩy mất nó). Cái này thì không, vì nó chỉ được đọc ở
    // nhánh BẤM-MÀ-KHÔNG-DI trong finish(), lúc mà theo định nghĩa tay chưa đi
    // đâu cả. Hai biến, hai vòng đời, cố ý không gộp.
    const pickTargetId = pressHits.length ? pressHits[pressHits.length - 1] : null;
    const pickAdditive = e.ctrlKey === true || e.metaKey === true;
    let eraseTargetId = pickTargetId;

    // Ấn xuống mà KHÔNG chạm vào gì — điều kiện của cử chỉ đổi bút ↔ cục gôm.
    //
    // Bút thì hỏi thẳng pickTargetId. Cục gôm thì hỏi xem lượt quét vừa mở ra đã
    // ăn được gì chưa, chứ KHÔNG hỏi lại bằng ERASE_RADIUS: bán kính của nó là
    // bán kính riêng, và cục tẩy to bằng nắm tay chạm tới nét từ rất xa. Đo bằng
    // hai cái thước khác nhau thì có chỗ vừa cắt sứt một nét vẫn được tính là
    // "ấn vào chỗ trống", giữ yên thêm một nhịp là đổi sang bút và mất luôn nhát
    // tẩy vừa làm.
    const pressedEmpty = tool === "eraser"
      ? !eraseSetRef.current.size && !partsRef.current?.size
      : pickTargetId == null;
    const canSwap = (isPen || tool === "eraser") && pressedEmpty && !!onSwapTool;
    let anchor = { x: e.clientX, y: e.clientY };
    // Mới cho MỖI lượt vẽ: cửa sổ đo vận tốc không được mang theo mấy nhịp cuối
    // của nét trước, không thì nhịp đầu của nét này bị đọc thành một cú nhảy xa.
    // `let` chứ không `const`: mỗi lần chốt xong một đoạn của nét gấp khúc cũng
    // phải thay cửa sổ mới, vì lý do y hệt.
    let still = createStillWatch();

    // ── Nét gấp khúc đang dựng dở ────────────────────────────────────────────
    //
    // Các đỉnh ĐÃ CHỐT, phẳng [x,y,x,y,…], theo thứ tự đã vẽ. Rỗng nghĩa là chưa
    // chốt đoạn nào — và khi rỗng thì mọi thứ dưới đây im lặng đứng ngoài, lượt
    // vẽ chạy y hệt trước khi có tính năng này.
    //
    // Đỉnh CUỐI của mảng cũng chính là điểm ĐẦU của ptsRef: hai thứ chồng nhau
    // đúng một điểm, cố ý, để không chỗ nào phải nhớ "nối chúng lại thì cộng hay
    // trừ một điểm". Xem fullPts().
    let verts = [];
    // Vừa chốt một đoạn xong, đang đợi tay đi lại thật sự, và chỗ tay đứng lúc
    // chốt. Xem chỗ dùng trong onMove về việc vì sao không ghi điểm lúc này.
    let waiting = false;
    let waitFrom = null;
    // Chỗ con trỏ ở nhịp chuột gần nhất, toạ độ MÀN HÌNH. Khác `anchor`: cái kia
    // là mốc của bộ đếm giữ tay và chỉ đổi khi bộ đếm lên nòng lại, còn cái này
    // theo sát con trỏ. doSnap chạy từ một timer nên nó không có sự kiện chuột
    // nào để hỏi — đây là đường duy nhất để nó biết tay đang ở đâu.
    let lastScreen = { x: e.clientX, y: e.clientY };
    // Chỗ ẤN XUỐNG và tay đi xa nhất được bao nhiêu tính từ đó, pixel MÀN HÌNH,
    // giữ nguyên suốt lượt. Khác `anchor` ngay trên: anchor là mốc của bộ đếm
    // giữ tay nên nó nhảy theo mỗi lần bộ đếm lên nòng lại; cái này thì không,
    // vì nó trả lời một câu hỏi khác hẳn — "cú vừa rồi là một cú BẤM hay một
    // nét VẼ?". Xem chỗ dùng ở cuối finish().
    const pressScreen = { x: e.clientX, y: e.clientY };
    let moveFar = 0;
    // Đoạn đang vẽ dở SAU một cú chốt: đi xa nhất được bao nhiêu (pixel màn hình,
    // đo từ chỗ đã chốt), bắt đầu lúc nào, và mốc thời gian của nhịp chuột gần
    // nhất. Ba con số này quyết định cái đuôi ấy là một cạnh thật hay chỉ là cú
    // giật lúc nhả chuột — xem CHAIN_MIN_PX / CHAIN_MIN_MS.
    let tailFar = 0;
    let tailAt = 0;
    let lastTs = 0;
    // Đầu nét đang DÍNH vào điểm xuất phát (và bộ đếm khép hình đang chạy).
    let stuck = false;
    // Bộ đếm đang chạy là loại nào: "erase" / "swap" (đo từ CHỖ ẤN XUỐNG) hay
    // "snap" (đo VẬN TỐC). Hai loại bị huỷ bởi hai điều kiện khác hẳn nhau, nên
    // phải biết đang giữ loại nào mới huỷ đúng cái cần huỷ.
    let holdKind = null;
    let hintTimer = 0;
    let holdTimer = 0;
    let hintShown = false;
    let dimmed = false;
    let snapped = null;   // { kind, pts } sau khi đã bắt được hình
    let erased = false;   // đã tẩy nét dưới tay — lượt này không lưu gì nữa
    let swapped = false;  // đã đổi bút ↔ cục gôm — lượt này bỏ hẳn, không lưu gì

    // setState chỉ khi trạng thái THẬT SỰ đổi. Không có chốt hintShown/dimmed thì
    // mỗi nhịp chuột (cả trăm lần/giây) là một lời gọi setState — đúng thứ mà cả
    // file này tránh bằng ptsRef và rafThrottle.
    function hideHint() {
      if (hintShown) { hintShown = false; setSnapHint(null); }
      // Trả về danh sách của cú GẠCH XOÁ, không phải về rỗng: hai thứ cùng dùng
      // một ô `eraseIds` để làm nét mờ đi, mà bộ đếm giữ tay thì bị huỷ đi huỷ
      // lại suốt lượt vẽ (mỗi lần armHold lên nòng lại là một lần clearHold).
      // Trả về rỗng ở đây thì mấy nét đang bị gạch cứ nhấp nháy theo. Lúc không
      // gạch gì thì scratchDim CHÍNH LÀ EMPTY_IDS, nên hành vi cũ y nguyên.
      if (dimmed) { dimmed = false; setEraseIds(scratchDim); }
    }

    // Những nét cú gạch xoá đang nhắm tới, để chúng mờ đi NGAY TRONG LÚC gạch.
    // Cử chỉ này xoá đồ mà không hỏi và không có khoảng chờ nào, nên nó phải nói
    // trước là sắp xoá cái gì — còn kịp nhấc tay ra nếu nhắm sai.
    let scratchDim = EMPTY_IDS;
    function showScratch(ids) {
      if (ids.length === scratchDim.length && ids.every((v, i) => v === scratchDim[i])) return;
      scratchDim = ids.length ? ids : EMPTY_IDS;
      setEraseIds(scratchDim);
    }

    function clearHold() {
      if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
      holdKind = null;
      hideHint();
    }

    // Tẩy nét đang nằm dưới tay, và bỏ hẳn nét bút vừa chớm vẽ của lượt này.
    function doErase() {
      const id = eraseTargetId;
      clearHold();
      if (id == null) return;
      erased = true;
      pushDraft.current.cancel();
      setDraft(null);
      ptsRef.current = [];
      unsentRef.current = [];
      // Với người khác: huỷ nét bút đang phát, rồi đi ĐÚNG đường của cục gôm để
      // nét mờ đi rồi biến mất — thay vì đứng nguyên tới lúc board:update về.
      live?.cancelStroke();
      live?.beginErase([id]);
      live?.endErase();
      onEraseDone([id]);
      inkBufRef.current = [];
    }

    // ĐẶT HẸN TỰ ĐỌC CHỮ. Gọi ở finish() mỗi khi vừa lưu xong một nét bút trong
    // lúc bật đọc chữ. Cái hẹn cũ (nếu có) bị huỷ trước — viết đều tay thì hẹn cứ
    // bị dời tới lúc thật sự ngừng, và chỉ lần nhấc bút CUỐI mới để nó chạy hết.
    function scheduleAutoWrite() {
      if (hwTimerRef.current) clearTimeout(hwTimerRef.current);
      hwTimerRef.current = setTimeout(runAutoWrite, HW_PAUSE_MS);
    }

    // ĐỌC CHỮ: cả cụm nét trong đệm → một chuỗi ký tự, thay tại chỗ bằng một text
    // thật. Chạy từ HẸN GIỜ sau khi tay đã NHẤC và ngừng đủ lâu — khác hẳn bản
    // cũ chạy giữa lúc giữ tay. Nhờ tay đã nhả nên mọi nét đã được finish() lưu
    // vào đệm rồi: ở đây không còn nét "đang viết dở", không phải cứu nét đuôi,
    // không đụng tới React draft (đâu có lượt vẽ nào đang mở).
    //
    // Đọc không ra thì IM LẶNG để nguyên mấy nét tay — recognizeInk từ chối khá
    // nhiều (xem MAX_DIST), mà nét không đọc được thì gần như bao giờ cũng là
    // một nét vẽ thật, cứ để nó là nét vẽ.
    function runAutoWrite() {
      hwTimerRef.current = 0;
      // LỌC LẠI ĐỆM THEO NHỮNG NÉT CÒN SỐNG. Giữa lúc chờ, một nét trong đệm có
      // thể đã biến mất — người ngồi máy khác vừa tẩy nó. Không lọc thì chuỗi
      // đọc ra có cả ký tự đã mất, và nếu nét bị xoá đúng là nét ĐẦU cụm thì
      // `from` trỏ vào một id không còn tồn tại — commitErase đặt text vào đúng
      // chỗ nét cũ, nên cái text lặng lẽ rơi mất.
      const alive = new Set((boardRef.current?.drawings || []).map((d) => d.id));
      const buf = inkBufRef.current.filter((e) => alive.has(e.id));
      if (!buf.length) return;
      const rec = recognizeInk(buf.map((e) => e.pts));
      if (!rec) return;

      const size = nearestSize(rec.box.h);
      // Không đo được bề rộng (không có canvas 2d) thì ước lượng thô — cùng
      // cách IdeaMap.measureTextWidth đang lùi về. Hộp chỉ dùng cho vùng chạm.
      const box = textBox([rec.text], size, measureText || ((line, s) => line.length * s * 0.55));
      const el = {
        kind: "text",
        // Căn theo TÂM DỌC của chỗ vừa viết, không căn mép trên: hộp chữ máy
        // cao hơn phần thân chữ (còn chừa chỗ cho nét trên và nét dưới), nên
        // căn mép trên thì chữ hiện ra thấp hơn hẳn chỗ tay vừa viết.
        pts: [Math.round(rec.box.l), Math.round(rec.box.t + rec.box.h / 2 - box.h / 2)],
        text: rec.text, color: penPrefs.color, size, w: box.w, h: box.h
      };

      // Mọi nét của cụm đều đã nằm trong drawings (finish() lưu từng nét lúc nhấc
      // bút), nên chỉ việc THAY cả cụm bằng một text trong đúng một bước hoàn tác.
      const ids = buf.map((e) => e.id);
      inkBufRef.current = [];
      // Với người khác: đi ĐÚNG đường của cục gôm để mấy nét cũ mờ đi rồi biến
      // mất, y như doErase. Bản thân cái text thì tới cùng board:update — kênh
      // live không có đường phát một text do người khác sinh ra giữa chừng.
      live?.beginErase(ids);
      live?.endErase();
      // `from` là nét ĐẦU TIÊN của cụm: commitErase đặt text vào đúng chỗ nét đó
      // đang đứng trong mảng drawings, tức giữ nguyên tầng trên/dưới.
      onEraseDone(ids, [{ from: ids[0], ...el }]);
    }

    // Đổi bút ↔ cục gôm ngay giữa lượt. Lượt này bị BỎ HẲN: tay đang giữ nguyên
    // tại chỗ nên chưa có nét nào để lưu, mà cú nhả chuột sắp tới thì thuộc về
    // cử chỉ đổi tool chứ không phải một cú vẽ hay một cú chọn.
    function doSwap() {
      clearHold();
      swapped = true;
      const was = activeRef.current;
      pushDraft.current.cancel();
      setDraft(null);
      ptsRef.current = [];
      unsentRef.current = [];
      pushCut.current.cancel();
      setCut(null);
      pushErase.current.cancel();
      setEraseIds(EMPTY_IDS);
      partsRef.current = null;
      eraseSetRef.current = new Set();
      // Đóng đúng cái đang mở trên kênh live: bút mở beginStroke, cục gôm mở
      // beginErase. Gọi nhầm đường thì overlay của lượt này treo lại trên màn
      // hình người khác cho tới gói kế tiếp.
      if (was === "eraser") live?.endErase();
      else live?.cancelStroke();
      inkBufRef.current = [];
      onSwapTool();
    }

    // Toàn bộ nét đang thấy trên màn hình: các đỉnh đã chốt, nối tiếp bằng đoạn
    // tay đang vẽ dở. Cắt đỉnh cuối đi vì nó CHÍNH LÀ điểm đầu của ptsRef — hai
    // mảng chồng nhau đúng một điểm, cố ý (xem `verts`).
    function fullPts() {
      return verts.length ? verts.slice(0, -2).concat(ptsRef.current) : ptsRef.current.slice();
    }

    function drawPen(pts) {
      pushDraft.current({ color: penPrefs.color, w: penPrefs.w, pts, dashed });
    }

    // Mở LẠI lượt bút trên kênh live, lấy `pts` làm gói seq 0.
    //
    // Không phát thêm điểm nối tiếp được: gói giữa chừng của bút mang ĐIỂM MỚI
    // THÊM và người nhận NỐI chúng vào (xem mergeInkPacket), nên không có cách
    // nào bảo họ "quên mấy chục điểm tay vừa rồi đi, thay bằng một đoạn thẳng".
    // Mở lại là cách duy nhất, và nó rẻ: nét đã nắn chỉ còn vài cái đỉnh.
    function republish(pts) {
      live?.cancelStroke();
      live?.beginStroke(penPrefs.color, penPrefs.w, pts.map((v) => Math.round(v)), dashed);
      unsentRef.current = [];
    }

    // Chốt xong một đoạn: ghi đỉnh mới rồi mở đoạn kế tiếp NGAY TỪ đỉnh đó.
    function pushVertex(rec) {
      // Đoạn đầu tiên đóng góp cả hai đầu; từ đoạn thứ hai trở đi chỉ lấy đầu
      // MÚT, bỏ đầu kia. Đầu kia là chỗ trimHold đoán ra sau khi cắt vạt điểm
      // đứng yên, và nó xê dịch vài đơn vị so với cái đỉnh đã chốt lần trước —
      // giữ nó thì nét gấp khúc hở một mẩu ở mỗi khớp, mà ở mức zoom cao thì mẩu
      // đó nhìn thấy rõ.
      if (!verts.length) verts = rec.pts.slice(0, 4);
      else verts.push(rec.pts[2], rec.pts[3]);
      ptsRef.current = verts.slice(-2);
      waiting = true;
      waitFrom = lastScreen;
      tailFar = 0;
      tailAt = 0;
      // Cửa sổ đo vận tốc phải thay mới, cùng lý do với lúc bắt đầu lượt vẽ: giữ
      // lại thì nó còn nhớ mấy nhịp của đoạn vừa chốt và đọc ra "tay đang đi".
      still = createStillWatch();
      const pts = fullPts();
      drawPen(pts);
      republish(pts);
    }

    // Khép vòng: đoạn đang vẽ đã dính về điểm xuất phát và tay giữ đủ lâu.
    function doClose() {
      clearHold();
      // `verts` KHÔNG lặp lại điểm xuất phát ở cuối — cạnh khép kín là ngầm định
      // với mọi hình đóng, thêm nó vào là một tam giác đếm ra bốn đỉnh.
      const rec = snapPolygon(verts);
      if (rec) {
        snapped = rec;
        pushDraft.current({ color: penPrefs.color, w: penPrefs.w, pts: rec.pts, kind: rec.kind, fill: false, dashed });
        live?.cancelStroke();
        live?.beginShape(rec.kind, penPrefs.color, penPrefs.w, false, rec.pts, dashed);
        return;
      }
      // Không kind nào tả được (từ năm đỉnh trở lên): giữ nguyên nét gấp khúc,
      // chỉ khép kín nó lại. Vẫn CHỐT lượt vẽ ở đây chứ không im lặng bỏ qua —
      // người dùng đã giữ tay hơn một giây để yêu cầu khép hình, và cái vòng kín
      // đúng là thứ họ vừa yêu cầu, chỉ là nó không mang tên nào.
      const closed = verts.concat(verts.slice(0, 2));
      snapped = { kind: "pen", pts: closed };
      drawPen(closed);
      republish(closed);
    }

    function doSnap() {
      clearHold();
      // HẠN CHẾ ĐÃ BIẾT, chưa chữa ở đây: bàn tay tì trên chuột trôi đều chừng
      // 8–25 px/giây, nên vạt điểm sinh ra trong lúc giữ tay không phải một chùm
      // chồng nhau mà là một đoạn dài thật, và nó kéo ĐIỂM CUỐI của nét đi theo.
      // Đo trên 300 lượt mỗi ô: nét dài 120 đơn vị với tay trôi 16 px/giây cho
      // điểm B lệch 22 đơn vị. trimHold bên recognize.js không cứu được vì nó
      // chỉ có hình học, mà hình học không tách nổi một vạt TRÔI khỏi một đoạn
      // cuối vẽ chậm — thứ duy nhất tách được là THỜI GIAN của từng điểm, mà
      // ptsRef không giữ. Đã thử cắt tại mốc mà createStillWatch báo tay dừng:
      // không ăn, vì bộ dò chỉ biết tay đã đi SAU KHI đã đi quá ngưỡng, nên nó
      // cắt hụt mất đoạn cuối và tự tạo ra chừng 15 đơn vị sai số ngay cả khi
      // tay không trôi tí nào. Muốn chữa đúng thì phải gắn mốc thời gian cho
      // từng điểm.
      // ĐANG DỰNG NÉT GẤP KHÚC thì chỉ nhận đoạn thẳng, không cho đoán hình. Một
      // cạnh vẽ hơi vòng mà bị đoán ra ê-líp sẽ vứt luôn cả cái hình đang dựng
      // dở — mất mấy cái đỉnh đã đặt công phu để đổi lấy một hình chẳng ai muốn.
      // Việc đoán hình để dành cho lúc khép vòng, khi đã đủ đỉnh để nói chắc.
      // ĐANG GẠCH XOÁ thì không đoán hình. Người ta gạch qua lại vài nhát rồi
      // ngập ngừng một giây trước khi nhấc tay là chuyện thường, mà cú ngập ngừng
      // đó rơi đúng vào bộ đếm giữ tay: nét gạch sẽ bị nắn thành một cái đường
      // thẳng, `snapped` được đặt, và lúc nhả chuột thì nhánh gạch xoá dưới kia
      // không bao giờ chạy tới. Trả về lặng lẽ, để nguyên nét cho lúc nhả tay xử.
      if (scratchOn && isScribble(ptsRef.current)) return;
      // Tắt hết bắt hình thì cử chỉ giữ tay không còn việc gì.
      //
      // Không có nhánh đọc chữ ở đây, cố ý: đọc chữ giờ TỰ CHẠY sau khi nhấc bút
      // ngừng tay (xem HW_PAUSE_MS / runAutoWrite), không đi qua cú giữ tay nữa.
      // Và khi bật đọc chữ thì cú giữ-tay-bắt-hình còn bị CHẶN không lên nòng
      // (xem chỗ armHold("snap") — điều kiện `!hwOn`). Lý do là bài học từ cái
      // ảnh người dùng gửi về: viết chữ phải ngập ngừng giữa nét, mà mỗi lần
      // ngập ngừng quá SNAP_HOLD_MS là một lần doSnap chạy, nắn nửa cái chữ đang
      // cầm bút thành một đoạn thẳng rồi cả cụm biến thành đa giác gấp khúc. Bật
      // đọc chữ = "tôi đang viết", mà đang viết thì không được để bắt hình chen
      // vào giữa chừng — nên chặn hẳn nó, chứ không chia nhau cùng một cú giữ.
      if (!snapOn) return;
      const rec = verts.length ? snapLine(ptsRef.current) : snapShape(ptsRef.current);
      // Không ra được gì: im lặng bỏ qua, nét vẫn là nét tay và người dùng vẽ tiếp
      // bình thường. Tới đây thì hiếm — snapShape đã có sẵn phương án cuối là nắn
      // về đoạn thẳng nối hai đầu — chỉ còn nét KÍN mà không giống hình nào mới
      // rơi vào nhánh này. Nhích chuột một cái là bộ đếm lên nòng lại (xem
      // onMove), nên vẽ thêm rồi giữ tay lần nữa là thử lại được.
      if (!rec) return;
      // ĐOẠN THẲNG: chốt nó thành một cạnh rồi VẼ TIẾP — lượt vẽ chưa kết thúc.
      // Xem ghi chú "Hai cử chỉ GIỮ TAY" ở trên về việc vì sao đoạn thẳng được đi
      // tiếp còn hình kín thì không.
      // Cạnh NỐI TIẾP còn phải đủ dài mới được chốt: bàn tay tì trên chuột trôi
      // đều vài chục pixel mỗi giây, nên sau một cú chốt mà cứ để yên đó thì cái
      // trôi ấy tự nó thành một đoạn thẳng tí hon và được chốt thành đỉnh. Cạnh
      // ĐẦU TIÊN không phải qua cửa này — nó đã có cả nét vẽ đứng sau.
      if (rec.kind === "line") {
        if (verts.length && tailFar < CHAIN_MIN_PX) return;
        pushVertex(rec);
        return;
      }
      snapped = rec;
      // Nét đứt theo NGUYÊN cây bút vừa vẽ: vẽ bằng bút nét đứt rồi giữ tay cho
      // nó về hình chuẩn thì cái hình đó vẫn phải là nét đứt — nếu không, cử chỉ
      // bắt hình lại lặng lẽ đổi mất một lựa chọn mà người dùng đã đặt.
      pushDraft.current({ color: penPrefs.color, w: penPrefs.w, pts: rec.pts, kind: rec.kind, fill: false, dashed });
      // Đổi kênh live GIỮA lượt: huỷ nét bút đang phát rồi mở một lượt HÌNH ngay
      // tại chỗ. Thiếu bước này thì người khác còn thấy nét tay treo lại cho tới
      // khi board:update về mới nhảy thành hình — mà cái nhảy đó không có gì trên
      // màn hình họ giải thích được.
      live?.cancelStroke();
      live?.beginShape(rec.kind, penPrefs.color, penPrefs.w, false, rec.pts, dashed);
    }

    // Lên nòng lại từ một mốc mới. `kind` là việc sẽ xảy ra nếu tay đứng yên đủ
    // lâu. Gọi ở mỗi lần phép đo nói tay đang ĐI THẬT, nên rung tay hay trôi tay
    // tại chỗ KHÔNG làm mất công chờ, còn đi tiếp thì bộ đếm về 0.
    function armHold(kind, cx, cy) {
      clearHold();
      holdKind = kind;
      anchor = { x: cx, y: cy };
      // Hai cử chỉ ĐO TỪ CHỖ ẤN XUỐNG chờ ngắn; hai cử chỉ của bút ("snap" và
      // "close") chờ đúng bằng nhau — chúng là cùng một thao tác trong mắt người
      // dùng ("giữ tay để chốt"), nên hai nhịp chờ khác nhau thì tay không học được.
      const wait = kind === "erase" || kind === "swap" ? HOLD_ERASE_MS : SNAP_HOLD_MS;
      hintTimer = setTimeout(() => {
        hintTimer = 0;
        hintShown = true;
        // Vòng chỉ hiện ra SAU khoảng chờ này, nên phần thời gian CÒN LẠI mới là
        // phần nó phải chạy. Gửi kèm luôn để CSS khỏi phải biết hai hằng số.
        setSnapHint({ x: cx, y: cy, kind, ms: wait - SNAP_HINT_MS });
        // Nét sắp bị tẩy mờ đi ngay từ lúc vòng hiện: người dùng thấy MÌNH ĐANG
        // NHẮM VÀO CÁI NÀO trước khi nó mất, và còn kịp nhấc tay ra nếu nhắm sai.
        if (kind === "erase" && eraseTargetId != null) {
          dimmed = true;
          setEraseIds([eraseTargetId]);
        }
      }, SNAP_HINT_MS);
      holdTimer = setTimeout(() => {
        holdTimer = 0;
        if (kind === "erase") doErase();
        else if (kind === "swap") doSwap();
        else if (kind === "close") doClose();
        else doSnap();
      }, wait);
    }

    // Lên nòng ngay từ mousedown, và CHỖ ẤN quyết định việc gì sẽ xảy ra: trúng
    // một nét có sẵn thì tẩy nó, trúng chỗ trống thì đổi bút ↔ cục gôm. Hai
    // nhánh loại trừ nhau nên không có lúc nào hai bộ đếm cùng chạy.
    //
    // Ấn trúng nét mà đang cầm CỤC GÔM thì không lên nòng gì: ở đó cú ấn đã là
    // một nhát tẩy thật rồi, thêm một cử chỉ giữ tay nữa chỉ tổ giật mình.
    if (isPen && eraseTargetId != null) armHold("erase", e.clientX, e.clientY);
    else if (canSwap) armHold("swap", e.clientX, e.clientY);

    function drawShape(p, shift) {
      const s = startRef.current;
      if (!s) return;
      lastPoint = p;
      lastShift = shift;
      const kind = shapeKindOf(penPrefs.kind);
      const closed = SHAPE_CLOSED.has(kind);
      // Shift: hình đóng thì ép vuông/tròn đều, hình mở thì ép hướng 0/45/90.
      const box = normalizeBox(s.x, s.y, p.x, p.y, closed ? { square: shift } : { snap: shift });
      boxRef.current = box;
      const pts = ptsFromBox(penPrefs.kind, box);
      pushDraft.current({ color: penPrefs.color, w: penPrefs.w, pts, kind, fill: closed && penPrefs.fill === true, dashed });
      live?.pushShape(pts);
    }

    // Giữ Shift bắn keydown liên tục (auto-repeat): chỉ tính lại khi trạng thái
    // THẬT SỰ đổi, không thì mỗi nhịp lặp là một gói live thừa.
    function onShiftKey(ev) {
      if (ev.key !== "Shift" || activeRef.current !== "shape") return;
      const shift = ev.type === "keydown";
      if (shift === lastShift) return;
      drawShape(lastPoint, shift);
    }

    function onMove(ev) {
      // Đã bắt được hình, đã tẩy nét dưới tay, hoặc đã đổi tool: lượt vẽ chốt
      // tại đó, mọi cú di chuột sau đều bị bỏ.
      if (snapped || erased || swapped) return;
      const b = boardRef.current;
      if (!b) return;
      const p = toCanvas(ev, viewportEl, b.view);

      if (activeRef.current === "eraser") {
        // Tay đã rời chỗ ấn: đây là một cú quét thật, không còn là cú giữ để đổi
        // tool. Huỷ hẳn, không bao giờ lên nòng lại — dừng tay giữa một cú quét
        // dài mà bị đổi mất sang cây bút là mất trắng đoạn vừa quét.
        if (holdTimer && Math.hypot(ev.clientX - anchor.x, ev.clientY - anchor.y) > SNAP_MOVE_TOL) clearHold();
        // Cắt theo cả CHẶNG từ nhịp trước tới nhịp này, không cắt tại mỗi điểm
        // nhận được: nhịp chuột thưa hay mau là do tốc độ tay, nên cắt tại điểm
        // sẽ ra một rãnh liền với người rê chậm và một chuỗi lỗ với người rê
        // nhanh. cutPartsAlong nội suy dọc đường để hai người ra cùng kết quả.
        if (partMode) {
          applyCut(cutFrom, p);
          cutFrom = p;
          return;
        }
        const hit = drawingsHitBy(b.drawings || [], p, ERASE_RADIUS);
        let added = null;
        for (const id of hit) {
          if (eraseSetRef.current.has(id)) continue;
          eraseSetRef.current.add(id);
          (added || (added = [])).push(id);
        }
        if (added) {
          pushErase.current(Array.from(eraseSetRef.current));
          live?.pushErase(added);
        }
        return;
      }

      if (activeRef.current === "shape") {
        drawShape(p, ev.shiftKey);
        return;
      }

      // HAI PHÉP ĐO CHẠY TRƯỚC KHI ĐỤNG TỚI NÉT, vì chính chúng quyết định điểm
      // này có được ghi vào nét hay không. Cửa sổ vận tốc cũng phải được ăn đủ
      // MỌI nhịp chuột, kể cả nhịp bị bỏ ở mấy nhánh bên dưới — bỏ nhịp là nó đo
      // ra một cú nhảy xa ở lần gọi kế tiếp.
      //
      // Hai phép cố ý không dùng chung ngưỡng: `left` đo từ chỗ ấn xuống (cú này
      // còn là giữ tay hay đã thành kéo), còn `going` đo VẬN TỐC qua một cửa sổ
      // thời gian. Lấy `left` cho cả hai — như bản trước — thì cái trôi tay cộng
      // dồn tới lúc vượt 6px và đặt lại đồng hồ, nên bàn tay nào trượt đều vài
      // chục pixel mỗi giây sẽ không bao giờ bắt được hình. Xem createStillWatch.
      lastScreen = { x: ev.clientX, y: ev.clientY };
      lastTs = ev.timeStamp;
      moveFar = Math.max(moveFar, Math.hypot(ev.clientX - pressScreen.x, ev.clientY - pressScreen.y));
      const going = still.moving(ev.timeStamp, ev.clientX, ev.clientY);
      const left = Math.hypot(ev.clientX - anchor.x, ev.clientY - anchor.y) > SNAP_MOVE_TOL;
      // Tay đã rời khỏi chỗ ấn xuống: đây là một nét vẽ thật, không còn là cú
      // giữ để tẩy. Bỏ hẳn đích tẩy, không bao giờ quay lại — nếu còn giữ nó thì
      // vẽ một đường dài rồi dừng tay sẽ tẩy mất cái nét mà mình chỉ vô tình bắt
      // đầu vẽ đè lên.
      if (left) eraseTargetId = null;
      // Tay đã rời chỗ ấn xuống ⇒ HAI bộ đếm đo-từ-chỗ-ấn phải chết ngay, bất kể
      // sau đó có lên nòng bắt hình hay không. Trước đây việc này xảy ra nhờ ăn
      // may: lời gọi armHold("snap") ngay bên dưới tình cờ dọn hộ. Khi cửa chặn
      // của bắt hình đổi sang đo VẬN TỐC thì cái ăn may đó mất — vẽ chậm hơn 36
      // px/giây là `going` không bao giờ lên true, bộ đếm đổi tool sống sót và
      // nổ ở 650ms, cướp mất nét đang vẽ và lẳng lặng đổi sang cục gôm.
      //
      // "close" cũng đứng ngoài luật này, và vì một lý do khác hẳn "snap": nó
      // không đo từ chỗ ấn xuống mà đo từ ĐIỂM XUẤT PHÁT của nét, nên khoảng
      // cách tới chỗ ấn chẳng nói được gì về nó.
      if (left && holdKind !== "snap" && holdKind !== "close") clearHold();

      // VỪA CHỐT XONG MỘT ĐOẠN, TAY CÒN ĐANG ĐỨNG. Mọi điểm sinh ra lúc này là
      // TRÔI TAY chứ không phải nét, và ghi chúng vào thì đoạn kế tiếp mở đầu
      // bằng một cú ngoặt bịa ra — đủ để phép đo thẳng trượt ngưỡng, và cạnh sau
      // sẽ không bao giờ chốt được dù người ta kẻ thẳng tới đâu. Đợi tới khi phép
      // đo vận tốc nói tay ĐI THẬT.
      //
      // Mất chừng STILL_TOL pixel đầu đoạn, và đó không phải mất mát: điểm xuất
      // phát của đoạn đã bị ép về đúng đỉnh vừa chốt rồi (xem pushVertex), nên
      // mấy điểm đầu chỉ còn dùng cho phép đo thẳng — nơi bỏ chúng đi càng tốt.
      //
      // HAI đường thoát chứ không chỉ một, và đường thứ hai là bắt buộc: phép đo
      // vận tốc đọc "đang đi" ở mốc STILL_TOL trên một cửa sổ 500ms, tức 36
      // px/giây. Người vẽ chậm hơn thế thì `going` KHÔNG BAO GIỜ lên true, và
      // nếu đó là điều kiện duy nhất thì họ không mở nổi cạnh thứ hai — cái nét
      // của họ đứng im ở đỉnh vừa chốt cho tới lúc thả chuột. Nên cũng thoát khi
      // tay đã đi được ĐÚNG QUÃNG ẤY tính từ chỗ đứng, bất kể mất bao lâu: cùng
      // một con số cho cùng một câu hỏi, chỉ khác là bỏ vế thời gian đi.
      if (waiting) {
        const gone = waitFrom && Math.hypot(ev.clientX - waitFrom.x, ev.clientY - waitFrom.y) > STILL_TOL;
        if (!going && !gone) return;
        waiting = false;
        tailAt = ev.timeStamp;
      }
      // Đoạn sau một cú chốt đã đi được bao xa. Lấy XA NHẤT chứ không lấy chỗ
      // đang đứng: một cú giật đi ra rồi giật về sẽ có chỗ đang đứng gần bằng 0,
      // mà cái nét nó vẽ ra thì đã nằm đó rồi.
      if (verts.length && waitFrom) {
        tailFar = Math.max(tailFar, Math.hypot(ev.clientX - waitFrom.x, ev.clientY - waitFrom.y));
      }

      // DÍNH VÀO ĐIỂM XUẤT PHÁT, để khép nét gấp khúc thành hình. Chỉ mở từ đỉnh
      // thứ BA trở đi: khép vòng với hai đỉnh chỉ ra một cái lưỡi liềm dẹt lép.
      //
      // Đo bằng toạ độ CANVAS quy ra pixel màn hình (nhân scale) chứ không đo
      // bằng clientX/clientY: hỏi getBoundingClientRect ở mỗi nhịp chuột là mỗi
      // nhịp bắt trình duyệt tính lại layout, mà nhánh này chạy cả trăm lần mỗi
      // giây. Chỉ lúc DÍNH mới hỏi một lần, để đặt vòng chờ.
      const home = verts.length >= 6 ? { x: verts[0], y: verts[1] } : null;
      // Vào thì chặt, ra thì rộng — xem CLOSE_STICK_PX/CLOSE_UNSTICK_PX.
      const near = !!home
        && Math.hypot(p.x - home.x, p.y - home.y) * b.view.scale <= (stuck ? CLOSE_UNSTICK_PX : CLOSE_STICK_PX);
      if (near !== stuck) {
        stuck = near;
        if (!near) clearHold();
        else {
          // Vòng chờ đặt ở ĐIỂM XUẤT PHÁT chứ không ở đầu ngón tay: nó đang nói
          // "chỗ này sắp khép lại", mà chỗ đó là cái đỉnh chứ không phải con trỏ.
          const box = viewportEl.getBoundingClientRect();
          armHold("close",
            box.left + home.x * b.view.scale + b.view.panX,
            box.top + home.y * b.view.scale + b.view.panY);
        }
      } else if (stuck) {
        // Đã dính từ nhịp trước: nhích tay trong vùng dính không đổi được nét,
        // nên không có gì để ghi — và tuyệt đối không được đụng vào bộ đếm khép
        // hình đang chạy, không thì giữ tay mãi cũng không bao giờ khép được.
        return;
      }

      // Dính thì ghi ĐÚNG CÁI ĐỈNH, không ghi chỗ con trỏ: vòng phải khép kín
      // tuyệt đối, hở một hai pixel ở mức zoom cao là nhìn thấy ngay.
      const q = stuck ? home : p;
      ptsRef.current.push(q.x, q.y);
      unsentRef.current.push(Math.round(q.x), Math.round(q.y));
      drawPen(fullPts());
      // Gói mang đúng những điểm chưa gửi; trailingThrottle bên useInkLive gộp
      // các lần gọi trong cùng 40ms nên phải xả `unsent` ở ĐÓ, không phải ở đây.
      live?.pushPoints(unsentRef.current);
      if (stuck) return;

      // Nét đang thành một cú gạch xoá: làm mấy thứ nó gạch trúng mờ đi ngay.
      //
      // Chạy ở MỌI nhịp chuột chứ không thưa hơn: bỏ nhịp thì nét mờ đi trễ một
      // quãng, mà đây là lời cảnh báo trước khi xoá — trễ là hỏng ý nghĩa. Giá
      // của nó nằm trong tầm cục gôm vốn đã trả ở mỗi nhịp: một lượt rút gọn nét
      // đang vẽ, rồi loại theo hộp bao trước khi đếm giao điểm với số ít còn lại.
      if (scratchOn) showScratch(scribbleTargets(ptsRef.current, b.drawings || []));

      // Lên nòng bắt hình ở nhịp chuột ĐẦU TIÊN (chưa có bộ đếm nào chạy), rồi
      // chỉ lên nòng LẠI khi tay thật sự đang ĐI.
      //
      // `!hwOn`: BẬT ĐỌC CHỮ THÌ CHẶN HẲN bắt-hình-khi-giữ. Đang viết mà giữ tay
      // giữa nét (chuyện thường: đưa bút một khúc rồi ngắm) không được để nó nắn
      // nửa cái chữ thành hình — xem ghi chú dài ở doSnap. Đọc chữ có đường riêng:
      // tự chạy sau khi NHẤC bút ngừng tay, không mượn cú giữ tay này.
      if (snapOn && !hwOn && (!holdTimer || going)) armHold("snap", ev.clientX, ev.clientY);
    }

    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("keydown", onShiftKey);
      window.removeEventListener("keyup", onShiftKey);
      clearHold();
      // Lượt vẽ đóng lại thì vệt mờ của cú gạch cũng phải tắt, kể cả khi lượt bị
      // huỷ ngang (cửa sổ mất focus giữa nét) chứ không đi qua finish().
      showScratch([]);
      activeRef.current = null;
      cleanupRef.current = null;
    }

    function finish() {
      const was = activeRef.current;
      cleanup();
      // Không có lượt nào đang chạy thì không có gì để commit. Chốt phòng thủ
      // cho trường hợp `finish` vẫn bị gọi sau khi lượt đã bị huỷ bằng đường
      // khác (mouseup tới sau blur chẳng hạn): thiếu chốt này thì `was === null`
      // rơi xuống nhánh bút ở cuối hàm và lưu ra một nét chưa từng được vẽ.
      if (!was) return;

      // Cử chỉ đổi bút ↔ cục gôm đã ăn: doSwap() dọn sạch mọi thứ rồi. Chốt này
      // phải nằm TRƯỚC nhánh cục gôm ngay dưới, không thì cú nhả chuột vẫn commit
      // một lượt tẩy rỗng và đẩy một entry hoàn tác không có nội dung gì.
      if (swapped) return;

      if (was === "eraser") {
        const ids = Array.from(eraseSetRef.current);
        // Nét bút bị cắt: nét CŨ bỏ đi, các mảnh còn sống vào làm nét MỚI. Không
        // sửa pts tại chỗ vì một nét cắt đôi phải ra hai nét — mà "một bản ghi
        // thành hai bản ghi" thì không có phép sửa nào diễn tả được.
        //
        // Mảnh thừa hưởng màu / độ dày / nét đứt của nét gốc: chúng vẫn là chính
        // cái nét đó, chỉ ngắn đi.
        const adds = [];
        for (const [id, entry] of partsRef.current || []) {
          ids.push(id);
          for (const raw of entry.parts) {
            // Qua ĐÚNG bộ lọc của nét bút: mảnh cắt từ một cái ê-líp mang 96 đỉnh
            // của đường xấp xỉ, mà phần lớn trong số đó nằm thẳng hàng nhau ở
            // mức mắt thấy. Không lọc thì mỗi nhát cắt phình bản ghi lên hàng
            // chục lần mà không thêm được nét nào rõ hơn.
            const pts = simplifyStroke(raw);
            // Lọc xong mà còn dưới hai điểm: mảnh ngắn tới mức thành một cái
            // chấm. Bỏ, cùng lý do với ngưỡng MIN_PART trong erase.js.
            if (pts.length < 4) continue;
            // `from` là id nét gốc: chỗ commit dùng nó để đặt mảnh vào ĐÚNG chỗ
            // nét cũ đang đứng trong mảng drawings, tức giữ nguyên tầng trên/dưới.
            const part = { from: id, kind: "pen", color: entry.d.color, w: entry.d.w, pts };
            if (entry.d.dashed) part.dashed = true;
            adds.push(part);
          }
        }
        partsRef.current = null;
        eraseSetRef.current = new Set();
        pushErase.current.cancel();
        setEraseIds([]);
        pushCut.current.cancel();
        setCut(null);
        // Quét mà không chạm nét nào: không commit, không tạo entry hoàn tác rác.
        if (ids.length) onEraseDone(ids, adds);
        live?.endErase();
        inkBufRef.current = [];
        return;
      }

      if (was === "shape") {
        pushDraft.current.cancel();
        setDraft(null);
        const box = boxRef.current;
        boxRef.current = null;
        startRef.current = null;
        // Bấm rồi nhả gần như không di: hình suy biến, bỏ. Đo theo ĐƯỜNG CHÉO,
        // vì một đường thẳng ngang dài 200 có chiều cao 0 — đo từng chiều sẽ bỏ oan.
        const diag = box ? Math.hypot(box[2] - box[0], box[3] - box[1]) : 0;
        if (!box || diag < SHAPE_MIN_DIAGONAL) { live?.cancelStroke(); return; }
        const kind = shapeKindOf(penPrefs.kind);
        const stroke = { kind, color: penPrefs.color, w: penPrefs.w, pts: ptsFromBox(penPrefs.kind, box) };
        // `fill` chỉ có ở hình đóng — nét bút và hình mở không mang field này.
        if (SHAPE_CLOSED.has(kind)) stroke.fill = penPrefs.fill === true;
        // `dashed` chỉ ghi khi BẬT: vắng mặt nghĩa là nét liền, nên mọi nét đã
        // lưu từ trước tính năng này tự đúng, và bản ghi không phình thêm một
        // field `false` ở tuyệt đại đa số nét.
        if (dashed) stroke.dashed = true;
        const drawingId = onStrokeDone(stroke);
        live?.endShape(drawingId);
        inkBufRef.current = [];
        return;
      }

      // Cú giữ để tẩy đã ăn: doErase() làm hết mọi việc rồi (bỏ nét đang vẽ, báo
      // cho người khác, gọi onEraseDone). Ở đây chỉ việc không lưu thêm gì.
      if (erased) return;

      // Nét đã được bắt thành hình: lưu ra HÌNH, không lưu nét tay. Đi qua đúng
      // khuôn dữ liệu của tool Hình khối nên hit-test, cục gôm, hoàn tác và gói
      // live không có nhánh riêng nào cho trường hợp này.
      if (snapped) {
        pushDraft.current.cancel();
        setDraft(null);
        ptsRef.current = [];
        unsentRef.current = [];
        const stroke = { kind: snapped.kind, color: penPrefs.color, w: penPrefs.w, pts: snapped.pts };
        // Hình bắt từ nét bút luôn CHỈ CÓ VIỀN: cây bút không tô đặc bao giờ, và
        // nút chế độ tô ở khu 4 là lựa chọn của tool Hình khối, không phải của bút.
        if (SHAPE_CLOSED.has(snapped.kind)) stroke.fill = false;
        if (dashed) stroke.dashed = true;
        const snapId = onStrokeDone(stroke);
        // Vòng kín không mang tên nào thì lưu ra nét BÚT, và lượt live đang mở
        // cũng là lượt bút (xem doClose) — phải đóng đúng cái đang mở.
        if (snapped.kind === "pen") live?.endStroke(snapId);
        else live?.endShape(snapId);
        inkBufRef.current = [];
        return;
      }

      // NÉT GẤP KHÚC ĐANG DỞ: đã chốt được vài cạnh nhưng chưa khép vòng. Thả
      // chuột lúc nào là lưu lúc đó, đúng bằng hành vi của một nét bút thường.
      if (verts.length) {
        pushDraft.current.cancel();
        setDraft(null);
        // ĐUÔI CHƯA CHỐT chỉ được giữ nếu nó đi đủ XA và kéo dài đủ LÂU. Đây là
        // chỗ chặn cái móc — xem CHAIN_MIN_PX / CHAIN_MIN_MS bên polygon-snap.js
        // về việc vì sao phải cả hai điều kiện, và vì sao đây là cảnh thường gặp
        // nhất chứ không phải một ca hiếm.
        const real = tailFar >= CHAIN_MIN_PX && lastTs - tailAt >= CHAIN_MIN_MS;
        const tail = real ? simplifyStroke(ptsRef.current) : verts.slice(-2);
        const chain = verts.slice(0, -2).concat(tail);
        ptsRef.current = [];
        unsentRef.current = [];
        // Đúng hai đỉnh và không có đuôi: đó vẫn là một ĐOẠN THẲNG và phải lưu ra
        // kind "line", y như trước khi có tính năng nối tiếp này. Lưu ra nét bút
        // hai điểm thì nhìn giống hệt nhưng mất tay cầm hai đầu — tức cử chỉ bắt
        // hình lặng lẽ trả về ít hơn nó vẫn trả.
        const chained = chain.length === 4
          ? { kind: "line", color: penPrefs.color, w: penPrefs.w, pts: chain }
          : { kind: "pen", color: penPrefs.color, w: penPrefs.w, pts: chain };
        if (dashed) chained.dashed = true;
        const chainId = onStrokeDone(chained);
        live?.endStroke(chainId);
        inkBufRef.current = [];
        return;
      }

      pushDraft.current.cancel();
      setDraft(null);
      const pts = simplifyStroke(ptsRef.current);
      ptsRef.current = [];
      unsentRef.current = [];
      // BẤM RỒI NHẢ MÀ KHÔNG ĐI ĐÂU. Không phải một nét — vài pixel thì không vẽ
      // ra gì cả. Trước đây cú bấm này rơi vào hư không; giờ nó là cú CHỌN: trúng
      // một nét thì chọn nét đó, trúng chỗ trống thì bỏ chọn.
      //
      // Đo bằng PIXEL MÀN HÌNH (moveFar), không bằng số điểm đã ghi được. Bàn
      // tay rung chừng vài pixel ở mọi cú bấm, và ở mức zoom bình thường chỉ hai
      // ba pixel đó đã vượt MIN_DIST của simplifyStroke (2 ĐƠN VỊ CANVAS) và ghi
      // ra đủ hai điểm — tức cú bấm hoá thành "một nét vẽ", không chọn được gì
      // mà còn để lại một chấm mực bằng hạt bụi. Số điểm ghi được là hệ quả của
      // mức zoom và tốc độ tay, nên nó không bao giờ là thước đo đúng cho câu
      // hỏi này; tay rung bao nhiêu pixel mới là.
      //
      // Dùng lại đúng SNAP_MOVE_TOL chứ không đặt thêm một ngưỡng riêng: đó đã
      // là ngưỡng "tay còn coi như đứng ở chỗ ấn" của cả file này (nó giữ cho bộ
      // đếm tẩy sống). Hai con số khác nhau sẽ mở ra một khe mà cú nhả vừa không
      // phải cú bấm, vừa chưa đủ để huỷ bộ đếm tẩy.
      //
      // Vế `pts.length < 4` vẫn giữ cho chiều ngược lại: zoom rất nhỏ thì kéo
      // hẳn vài chục pixel màn hình cũng chỉ ra một điểm canvas duy nhất.
      //
      // Đang cầm bút mà chọn được nét thì vừa vẽ vừa sửa không phải đổi tool:
      // giữ tay cho nét về hình chuẩn, bấm một cái lên nó, rồi kéo góc / đổi
      // nét đứt / xoá — tất cả ngay tại chỗ.
      //
      // Không tranh với cử chỉ nào: cú bấm-không-di chưa bao giờ tạo ra nét, cử
      // chỉ giữ-để-tẩy đòi giữ 650ms nên một cú bấm nhanh không chạm tới nó, và
      // cử chỉ bấm-hai-lần-đổi-nét-đứt chỉ ăn từ lần bấm thứ HAI.
      if (moveFar <= SNAP_MOVE_TOL || pts.length < 4) {
        live?.cancelStroke();
        // Vứt đệm đọc chữ. Không phải vì cú bấm phá hỏng gì, mà vì thứ nó mở ra
        // sau đó thì có: chọn xong là kéo đi được, mà đệm giữ TOẠ ĐỘ đã chụp
        // lúc vẽ — kéo một nét đi rồi giữ tay đọc chữ sẽ đọc ra chuỗi ở chỗ cũ
        // rồi xoá mất cái nét ở chỗ mới.
        inkBufRef.current = [];
        onPick?.(pickTargetId, pickAdditive);
        return;
      }
      // GẠCH XOÁ: nét vừa vẽ là một cú gạch ngoằn ngoèo, và nó gạch trúng thứ gì
      // đó. Xoá những thứ đó, và chính nét gạch thì KHÔNG lưu lại — nó là một cử
      // chỉ, không phải một hình vẽ.
      //
      // Mảng rỗng là "không phải cú gạch, HOẶC gạch vào chỗ trống", và cả hai đều
      // rơi xuống nhánh lưu nét bình thường bên dưới. Nhờ vậy vẽ một cái răng cưa
      // giữa bãi đất trống vẫn ra đúng cái răng cưa đó — xem scribbleTargets.
      if (scratchOn) {
        const scratched = scribbleTargets(pts, boardRef.current?.drawings || []);
        if (scratched.length) {
          // Với người khác: huỷ nét bút đang phát rồi đi ĐÚNG đường của cục gôm,
          // y như doErase. Không có bước này thì nét gạch treo lại trên màn hình
          // họ cho tới lúc board:update về, rồi mọi thứ nhảy một phát.
          live?.cancelStroke();
          live?.beginErase(scratched);
          live?.endErase();
          onEraseDone(scratched);
          inkBufRef.current = [];
          return;
        }
      }

      const penStroke = { kind: "pen", color: penPrefs.color, w: penPrefs.w, pts };
      if (dashed) penStroke.dashed = true;
      const drawingId = onStrokeDone(penStroke);
      live?.endStroke(drawingId);
      // Chỗ DUY NHẤT đệm đọc chữ lớn lên. Ghi vô điều kiện chứ không hỏi
      // `hwOn`: bật nút đọc chữ lên giữa chừng thì mấy nét vừa viết phải đọc
      // được ngay, chứ không phải viết lại từ đầu mới ăn.
      if (drawingId != null) {
        inkBufRef.current = extendInkBuf(inkBufRef.current, drawingId, pts);
        // TỰ ĐỌC CHỮ: vừa lưu xong một nét trong lúc bật đọc chữ → đặt (hoặc dời)
        // hẹn. Ngừng tay HW_PAUSE_MS không viết tiếp thì runAutoWrite chạy và
        // thay cả cụm bằng chữ máy. Chỉ đặt khi hwOn: tắt thì mấy nét cứ là nét
        // vẽ, không có gì hẹn giờ đụng vào chúng.
        if (hwOn) scheduleAutoWrite();
      }
    }

    cleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", finish);
    // Chỉ hình khối mới nghe Shift: bút và cục gôm không có ràng buộc nào để ép.
    if (activeRef.current === "shape") {
      window.addEventListener("keydown", onShiftKey);
      window.addEventListener("keyup", onShiftKey);
    }
  }, [tool, penPrefs, boardRef, viewportRef, onStrokeDone, onEraseDone, onPick, onSwapTool, live, measureText]);

  // Cửa sổ mất focus giữa nét: mouseup sẽ không bao giờ tới, nên phải tự huỷ —
  // nếu không, nét treo lại trên màn hình mình và trên màn hình người khác.
  useEffect(() => {
    function onBlur() {
      if (!activeRef.current) return;
      // Dọn qua ĐÚNG đường dọn của lượt hiện tại: xoá activeRef mà để listener
      // mousemove/mouseup sống là cái đã sinh ra nét rác — mousemove sau đó vẫn
      // bơm điểm và mouseup vẫn gọi `finish`.
      cleanupRef.current?.();
      activeRef.current = null;
      ptsRef.current = [];
      unsentRef.current = [];
      startRef.current = null;
      boxRef.current = null;
      eraseSetRef.current = new Set();
      partsRef.current = null;
      pushDraft.current.cancel();
      pushErase.current.cancel();
      pushCut.current.cancel();
      setDraft(null);
      setEraseIds([]);
      setCut(null);
      // cleanupRef ở trên đã gọi clearHold() nên hai timer đã tắt; dòng này chỉ
      // để chắc chắn vòng chờ không treo lại trên màn hình khi lượt bị bỏ dở
      // bằng một đường khác (cleanupRef null vì lý do nào đó).
      setSnapHint(null);
      liveRef.current?.cancelStroke();
    }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return { draft, eraseIds, cut, snapHint, handleMouseDown };
}
