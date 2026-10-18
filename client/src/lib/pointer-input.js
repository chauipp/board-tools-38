// Đọc sự kiện con trỏ THÔ và trả lời câu hỏi về Ý ĐỊNH của người dùng — thứ mà
// bản thân sự kiện không nói. Hai câu hỏi, hai bộ đọc:
//   createWheelReader — cú cuộn này là lia bảng hay thu phóng, mạnh bao nhiêu
//   createStillWatch  — tay đang ĐI hay đang ĐỨNG
// Không dính React, không đụng DOM — nhờ vậy test được bằng node:test, và
// IdeaMap chỉ còn ba dòng trong wheelHandler.
//
// VÌ SAO PHẢI CÓ FILE NÀY. Trên laptop, cuộn hai ngón trên touchpad và lăn nút
// chuột đều tới đây dưới dạng một sự kiện `wheel` giống hệt nhau về mặt kiểu.
// Nhưng ý người dùng thì trái ngược: lăn chuột là "thu phóng" (một nấc, dứt
// khoát), còn trượt hai ngón là "lia bảng" (dòng sự kiện dày, đi cả hai trục).
// Bản trước xử một kiểu cho cả hai, nên trên touchpad chỉ cần trượt nhẹ là bảng
// phóng to vọt lên — đúng thứ phải sửa.

// TAY ĐANG ĐI HAY ĐANG ĐỨNG — phép đo của mọi cử chỉ "giữ tay một chỗ".
//
// VÌ SAO KHÔNG ĐO BẰNG KHOẢNG CÁCH TỚI MỘT MỐC CỨNG, như bản trước làm. Bản
// trước chốt một mốc rồi bắt tay ở trong bán kính 6px của mốc đó suốt cả thời
// gian chờ; đi quá là đồng hồ về 0. Nghe thì đúng, nhưng nó gộp hai thứ khác
// hẳn nhau vào một con số:
//   RUNG  — lệch ngẫu nhiên vài pixel mỗi khung hình, trung bình bằng 0, không
//           đi tới đâu cả;
//   TRÔI  — bàn tay tì trên chuột trượt đều một hướng, chừng 5–25 px/giây.
// Khoảng cách tới mốc cứng CỘNG DỒN cái trôi. Giữ tay hơn một giây thì trôi
// vượt 6px là chuyện đương nhiên, mà mỗi lần vượt là đồng hồ về 0 — nên với bàn
// tay trôi từ 8 px/giây trở lên, cử chỉ KHÔNG BAO GIỜ nổ, giữ bao lâu cũng vậy.
// Đo trên 300 lượt mô phỏng mỗi ô: trôi 5 px/giây nổ 65–83%, trôi 10 px/giây trở
// lên nổ 0%. Đúng cái "lúc được lúc không" mà người dùng gặp: tay ai chắc thì
// chạy, tay ai hơi trượt thì chịu.
//
// Phép đúng là VẬN TỐC, và vận tốc phải đo bằng độ dời RÒNG qua một cửa sổ thời
// gian: cái rung có trung bình 0 nên tự triệt tiêu, còn lại đúng phần tay đi
// thật. Cửa sổ phải đủ dài để tách 20 px/giây (trôi) khỏi 40 px/giây (vẽ chậm)
// khi mỗi mẫu còn bị làm tròn về pixel nguyên — 500ms là chỗ hai đám tách hẳn
// nhau; ngắn hơn thì cái rung lấn át, dài hơn thì trả thêm độ trễ vô ích.
export const STILL_WINDOW_MS = 500;

// Đi quá chừng này TRONG cửa sổ trên là đang đi thật — tức 36 px/giây. Chọn
// bằng cách quét cả hai chiều, 400 lượt mỗi ô (rung 0,5–2,0 px/khung × trôi
// 0–25 px/giây):
//   14px (28 px/s) — tay rung mạnh không nổ nổi (0% ở góc rung 1,5 · trôi 25)
//   18px (36 px/s) — nổ 95–100% khắp lưới, và KHÔNG nổ oan khi vẽ từ 35 px/giây
//   22px (44 px/s) — nổ 100% nhưng cướp cả nét đang vẽ ở 35 px/giây
// Đơn vị là pixel MÀN HÌNH, không phải đơn vị canvas: tay người trôi chừng đó
// bất kể bảng đang phóng to hay thu nhỏ.
export const STILL_TOL = 18;

// Bộ dò có nhớ. Mỗi nhịp chuột hỏi một câu: "nhịp này có phải tay đang đi
// thật không?" — dùng để ĐẶT LẠI đồng hồ chờ. Cố ý theo chiều đó chứ không phải
// chiều "bấm giờ khi thấy yên": tay đứng im tuyệt đối thì trình duyệt không bắn
// nhịp nào cả, nên cái gì cần chạy khi KHÔNG có sự kiện phải là setTimeout đã
// đặt sẵn, còn sự kiện chỉ có quyền huỷ nó đi.
export function createStillWatch(windowMs = STILL_WINDOW_MS, tol = STILL_TOL) {
  const buf = [];
  return {
    // t: mốc thời gian (ms) — dùng thẳng event.timeStamp. x,y: pixel màn hình.
    moving(t, x, y) {
      buf.push({ t, x, y });
      // Cắt bớt nhưng LUÔN giữ lại một mẫu già hơn mép cửa sổ, nhờ `> 2`. Cắt
      // sạch tới mép thì hai nhịp cách nhau xa — con trỏ rời cửa sổ rồi quay
      // lại, chẳng hạn — chỉ còn đúng một mẫu, và một mẫu thì độ dời luôn bằng
      // 0, tức một cú nhảy xa bị đọc thành "đứng yên".
      while (buf.length > 2 && t - buf[1].t > windowMs) buf.shift();
      const a = buf[0];
      return Math.hypot(x - a.x, y - a.y) > tol;
    }
  };
}

const KEY = "ideamap.wheel";

// Ý nghĩa của cuộn hai ngón / lăn chuột khi KHÔNG giữ phím nào:
//   auto — tự nhận thiết bị (touchpad thì lia, chuột thì phóng)
//   pan  — luôn lia bảng
//   zoom — luôn thu phóng (hành vi của bản cũ)
// Pinch hai ngón và Shift+cuộn KHÔNG phụ thuộc lựa chọn này, xem readWheel.
export const WHEEL_MODES = ["auto", "pan", "zoom"];
export const WHEEL_MODE_DEFAULT = "auto";

export function loadWheelMode(storage) {
  let saved = null;
  try {
    saved = storage.getItem(KEY);
  } catch {
    saved = null;
  }
  return WHEEL_MODES.includes(saved) ? saved : WHEEL_MODE_DEFAULT;
}

export function saveWheelMode(storage, mode) {
  try {
    storage.setItem(KEY, WHEEL_MODES.includes(mode) ? mode : WHEEL_MODE_DEFAULT);
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn, không đáng làm sập app.
  }
}

// deltaMode: 0 = pixel, 1 = DÒNG, 2 = TRANG. Firefox báo lăn chuột theo DÒNG
// (deltaY = 3), nên công thức tính theo pixel áp thẳng vào đó ra hệ số 0.995 —
// tức lăn cả buổi mà bảng gần như không phóng. Đây là lỗi thật của bản cũ, và
// quy về pixel ở một chỗ duy nhất là cách chữa.
const LINE_PX = 16;
const PAGE_PX = 400;

export function deltaToPixels(v, deltaMode) {
  if (!Number.isFinite(v)) return 0;
  if (deltaMode === 1) return v * LINE_PX;
  if (deltaMode === 2) return v * PAGE_PX;
  return v;
}

// Hệ số nhân của scale trên MỖI sự kiện, tính theo e^(-dy*k). Ba con số vì ba
// nguồn có biên độ khác nhau hẳn nhau:
//   lăn chuột — một nấc là 100px, cần k nhỏ
//   touchpad  — trượt ngón cho hàng chục sự kiện dy chừng 2–20px, k phải lớn hơn
//               (chỉ dùng khi người dùng CỐ Ý chọn mode "zoom")
//   pinch     — dy còn nhỏ hơn nữa, thường 1–12px mỗi sự kiện
const WHEEL_ZOOM_K = 0.0015;
const TOUCHPAD_ZOOM_K = 0.006;
const PINCH_ZOOM_K = 0.012;

// Trần một nhịp. Cuộn quán tính của touchpad có thể bắn ra một sự kiện dy vài
// nghìn pixel; không kẹp thì một cú như vậy nhảy thẳng từ zoom 1.0 xuống đáy
// MIN_SCALE và người dùng mất phương hướng hoàn toàn.
const MAX_ZOOM_STEP = 0.25;

export function zoomFactor(dyPixels, k) {
  const raw = Math.exp(-dyPixels * k);
  return Math.min(1 + MAX_ZOOM_STEP, Math.max(1 - MAX_ZOOM_STEP, raw));
}

// Điểm tin cậy của bộ nhận dạng bị kẹp trong khoảng này. Có trần vì nếu để cộng
// dồn vô hạn thì cuộn touchpad một phút rồi đổi sang chuột phải mất cả trăm nấc
// lăn mới lật lại được.
const SCORE_MIN = -4;
const SCORE_MAX = 4;

// Hai sự kiện cách nhau dưới chừng này là một DÒNG liên tục — dấu hiệu của ngón
// đang trượt, không phải nấc lăn rời rạc.
const STREAM_GAP_MS = 30;

// Một sự kiện bỏ bao nhiêu phiếu cho "đây là touchpad" (dương) hay "đây là
// chuột" (âm). Tách riêng và export để test được từng dấu hiệu một.
//
// HẠN CHẾ ĐÃ BIẾT: trên macOS, lăn chuột cũng đi qua lớp cuộn mượt của hệ điều
// hành nên nó cho ra đúng những con số nhỏ mà touchpad cho — không có dấu hiệu
// nào tách được hai thứ. Ở đó bộ này sẽ đoán là touchpad, và người dùng phải
// chọn tay mode "zoom" trong panel Giao diện. Đây là lý do lựa chọn tay tồn tại.
export function wheelDeviceVote(e, gapMs) {
  // Báo theo DÒNG hoặc TRANG: chỉ nút lăn mới thế, touchpad luôn báo theo pixel.
  if (e.deltaMode !== 0) return -3;
  const dx = e.deltaX || 0;
  const dy = e.deltaY || 0;
  // Số không nguyên: chỉ touchpad chính xác mới sinh ra được.
  if (dx % 1 !== 0 || dy % 1 !== 0) return 3;
  // Nút lăn không có trục ngang. Một cú đi chéo là hai ngón.
  if (dx !== 0) return 2;
  // Một nấc lăn tiêu chuẩn là 100px (Chrome/Edge) hoặc 120px.
  if (Math.abs(dy) >= 100) return -2;
  if (gapMs != null && gapMs <= STREAM_GAP_MS) return 2;
  // Bước nhỏ mà vẫn nguyên: touchpad Windows/Linux điển hình.
  if (Math.abs(dy) < 40) return 1;
  return 0;
}

// Bộ đọc có nhớ: điểm tin cậy sống qua các sự kiện nên chỉ cần một hai cú đầu là
// nó chốt được thiết bị, và không lật qua lật lại giữa dòng cuộn.
export function createWheelReader() {
  let score = 0;
  let prevTs = null;

  return {
    // Chỉ dùng cho test và cho việc soi lỗi — UI không hiện thiết bị đã đoán ra.
    device() {
      return score > 0 ? "touchpad" : "mouse";
    },
    // e: sự kiện wheel thật, hoặc một object có đủ deltaX/deltaY/deltaMode/
    // ctrlKey/shiftKey/timeStamp. mode: một trong WHEEL_MODES.
    read(e, mode) {
      const ts = Number.isFinite(e.timeStamp) ? e.timeStamp : null;
      const gap = prevTs == null || ts == null ? null : ts - prevTs;
      if (ts != null) prevTs = ts;
      score = Math.min(SCORE_MAX, Math.max(SCORE_MIN, score + wheelDeviceVote(e, gap)));
      const device = score > 0 ? "touchpad" : "mouse";
      const dx = deltaToPixels(e.deltaX, e.deltaMode);
      const dy = deltaToPixels(e.deltaY, e.deltaMode);

      // Chụm/xoè hai ngón: trình duyệt gửi nó xuống dưới dạng Ctrl+wheel. LUÔN
      // là thu phóng, không phụ thuộc `mode` — đó là cử chỉ phóng của hệ điều
      // hành, không phải cú cuộn. Ctrl+lăn chuột cũng vào đây, cùng nghĩa.
      if (e.ctrlKey || e.metaKey) {
        return { intent: "zoom", dx, dy, factor: zoomFactor(dy, PINCH_ZOOM_K), device, pinch: true };
      }
      // Shift+cuộn = lia, giữ nguyên như bản cũ.
      if (e.shiftKey) {
        return { intent: "pan", dx, dy, factor: 1, device, pinch: false };
      }
      const wantPan = mode === "pan" || (mode !== "zoom" && device === "touchpad");
      if (wantPan) {
        return { intent: "pan", dx, dy, factor: 1, device, pinch: false };
      }
      const k = device === "touchpad" ? TOUCHPAD_ZOOM_K : WHEEL_ZOOM_K;
      return { intent: "zoom", dx, dy, factor: zoomFactor(dy, k), device, pinch: false };
    }
  };
}
