// Hàm thuần của bộ lọc thẻ (lib/useBoardFilters.js). Trước nằm trong IdeaMap.jsx.

// Dựng hàm lọc một thẻ từ điều kiện hiện tại. `filterStatus`/`filterTags` là
// map khoá → bật/tắt, khoá "none" = thẻ chưa có trạng thái/nhãn.
export function buildNodeFilter({ filterStatus, filterTags, filterFav, search }) {
  const statusKeys = Object.keys(filterStatus).filter((k) => filterStatus[k]);
  const tagKeys = Object.keys(filterTags).filter((k) => filterTags[k]);
  const q = search.trim().toLowerCase();
  return function passes(node) {
    if (statusKeys.length && !filterStatus[node.statusId == null ? "none" : String(node.statusId)]) return false;
    if (tagKeys.length && !filterTags[node.tagId == null ? "none" : String(node.tagId)]) return false;
    if (filterFav && !(node.favorites?.length > 0)) return false;
    if (q && (node.title + " " + node.desc).toLowerCase().indexOf(q) === -1) return false;
    return true;
  };
}

// Chế độ tập trung: thẻ đang xét và mọi thẻ cách nó ≤2 bước. null khi không
// tập trung vào thẻ nào (hoặc thẻ đó không còn).
export function focusNeighborhood(nodes, edges, focusId) {
  if (focusId == null || !nodes.some((n) => n.id === focusId)) return null;
  // BFS ≤2 hop trên edge node↔node (bỏ qua edge dính group)
  const adj = new Map();
  edges.forEach((e) => {
    if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  });
  const seen = new Set([focusId]);
  let frontier = [focusId];
  for (let hop = 0; hop < 2; hop++) {
    const nextFrontier = [];
    frontier.forEach((id) => (adj.get(id) || []).forEach((nb) => {
      if (!seen.has(nb)) { seen.add(nb); nextFrontier.push(nb); }
    }));
    frontier = nextFrontier;
  }
  return seen;
}
