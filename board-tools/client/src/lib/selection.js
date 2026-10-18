// Bôi đen chọn (marquee) tính lại tập thẻ/dây trúng khung ở mỗi nhịp chuột.
// Nếu lần nào cũng dựng một Set mới thì React coi lựa chọn là "đã đổi" và mọi
// effect bám theo nó đều nổ oan: ghi lại URL, phát selection lên socket, tô lại
// viền chọn. Trả về CHÍNH Set cũ khi nội dung không đổi để cắt hẳn chuỗi đó.
export function replaceIdSet(prev, ids) {
  if (prev.size === ids.length && ids.every((id) => prev.has(id))) return prev;
  return new Set(ids);
}
