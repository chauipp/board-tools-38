// Lịch sử hoàn tác / làm lại của bảng, dạng hàm thuần trên
// `{ past, future, nudgeBase }`. Trước nằm rải trong IdeaMap.jsx (state
// past/future + nudgeBaseRef); tách ra để test được bằng node:test.
//
// `nudgeBase`: bản board lúc BẮT ĐẦU một loạt nhích bằng phím mũi tên. Cả loạt
// chỉ ghi lịch sử MỘT lần, ở cuối loạt — nhích 20 nhịp rồi Ctrl+Z phải về chỗ
// trước loạt, không phải lùi 20 lần.
//
// Mọi hàm trả về object MỚI (hoặc chính `h` khi không có gì đổi) và không bao
// giờ sửa mảng cũ — IdeaMap dùng định danh `past`/`future` làm deps của effect.

export const MAX_HISTORY = 50;

export function emptyHistory() {
  return { past: [], future: [], nudgeBase: null };
}

function pushPast(past, board) {
  const nextPast = [...past, board];
  return nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast;
}

// Chốt loạt nhích đang dở (nếu có) thành một bước lịch sử.
export function flushNudge(h) {
  if (h.nudgeBase == null) return h;
  return { past: pushPast(h.past, h.nudgeBase), future: [], nudgeBase: null };
}

// Ghi một bước: `prevBoard` là bản TRƯỚC thao tác. Loạt nhích đang dở được chốt
// trước, nên nó thành một bước riêng nằm dưới bước này. Làm gì mới thì không
// còn gì để làm lại.
export function record(h, prevBoard) {
  const flushed = flushNudge(h);
  return { past: pushPast(flushed.past, prevBoard), future: [], nudgeBase: null };
}

// Nhịp nhích đầu tiên của một loạt ghi lại bản gốc; các nhịp sau giữ nguyên.
export function beginNudge(h, current) {
  if (h.nudgeBase != null) return h;
  return { ...h, nudgeBase: current };
}

// Lùi một bước. `current` là bản đang hiển thị, đi vào đầu `future`. Trả null
// khi không có gì để lùi, còn lại `{ history, board }` với `board` là bản phải
// hiện ra. Đang giữa loạt nhích thì lùi về đúng mốc trước loạt.
export function undo(h, current) {
  if (h.nudgeBase != null) {
    return { history: { past: h.past, future: [current, ...h.future], nudgeBase: null }, board: h.nudgeBase };
  }
  if (h.past.length === 0) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [current, ...h.future], nudgeBase: null },
    board: h.past[h.past.length - 1]
  };
}

// Làm lại một bước. Đang giữa loạt nhích thì CHỈ chốt loạt đó (board: null —
// màn hình không đổi): loạt nhích là thao tác mới nhất, không còn gì phía
// trước để làm lại. `past` ở nhánh làm lại không bị cắt trần — giữ đúng hành
// vi cũ.
export function redo(h, current) {
  if (h.nudgeBase != null) return { history: flushNudge(h), board: null };
  if (h.future.length === 0) return null;
  return {
    history: { past: [...h.past, current], future: h.future.slice(1), nudgeBase: null },
    board: h.future[0]
  };
}
