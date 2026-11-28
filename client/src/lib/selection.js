import { nodesInFrame } from "./board-geometry.js";
import { treeLockOwners } from "./locked-tree.js";
import { edgeKey } from "./tree-layout.js";

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

/**
 * Những gì một cú kéo trong vùng chọn mang theo: các khung đang chọn, các thẻ
 * đang chọn, CỘNG mọi thẻ nằm trong những khung đó — kéo khung mà bỏ ruột lại
 * là hỏng ý nghĩa của cái khung. Thẻ/khung đang khoá bị loại ngay ở đây, nên
 * mọi phần sau của cú kéo không phải nghĩ tới `locked` nữa.
 */
export function selectionDragSet(base, groupIds, nodeIds, frameCardSize) {
  const owners = treeLockOwners(base, frameCardSize);
  const groups = base.groups.filter((g) => groupIds.has(g.id) && !g.locked && !owners.has(edgeKey("group", g.id)));
  const nodeSet = new Set();
  base.nodes.forEach((n) => { if (nodeIds.has(n.id) && !n.locked && !owners.has(edgeKey("node", n.id))) nodeSet.add(n.id); });
  const lockedById = new Map(base.nodes.map((n) => [n.id, !!n.locked || owners.has(edgeKey("node", n.id))]));
  groups.forEach((g) => {
    nodesInFrame(base.nodes, g, frameCardSize).forEach((id) => {
      if (!lockedById.get(id)) nodeSet.add(id);
    });
  });
  return { groupIds: groups.map((g) => g.id), nodeIds: Array.from(nodeSet) };
}
