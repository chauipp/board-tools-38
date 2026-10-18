// Bôi đen chọn (marquee) tính lại tập thẻ/dây trúng khung ở mỗi nhịp chuột.
// Nếu lần nào cũng dựng một Set mới thì React coi lựa chọn là "đã đổi" và mọi
// effect bám theo nó đều nổ oan: ghi lại URL, phát selection lên socket, tô lại
// viền chọn. Trả về CHÍNH Set cũ khi nội dung không đổi để cắt hẳn chuỗi đó.
export function replaceIdSet(prev, ids) {
  if (prev.size === ids.length && ids.every((id) => prev.has(id))) return prev;
  return new Set(ids);
}

// Ctrl/Cmd+click vào thẻ: có thì bớt ra, chưa có thì thêm vào. Luôn trả Set mới
// vì nội dung luôn đổi — khác replaceIdSet ở trên, ở đây không có trường hợp
// "gọi lại mà kết quả y cũ".
export function toggleId(prev, id) {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Marquee có giữ Ctrl = CỘNG vào lựa chọn đang có, không thay thế. `base` là
// lựa chọn ở thời điểm bắt đầu quét, không phải lựa chọn hiện tại: mỗi nhịp
// chuột phải tính lại từ mốc đó, nếu cộng dồn vào kết quả nhịp trước thì thẻ đã
// từng lướt qua sẽ dính luôn dù khung quét đã rời khỏi nó.
export function unionIdSet(prev, base, ids) {
  const merged = new Set(base);
  for (const id of ids) merged.add(id);
  return replaceIdSet(prev, Array.from(merged));
}
