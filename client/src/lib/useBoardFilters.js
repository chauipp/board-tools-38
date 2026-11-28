import { useEffect, useMemo, useRef, useState } from "react";
import { buildNodeFilter, focusNeighborhood } from "./board-filters.js";
import { EMPTY_ARRAY } from "./board-constants.js";

// Bộ lọc thẻ (trạng thái, nhãn, yêu thích), ô tìm kiếm, chế độ tập trung
// (focusId → các thẻ cách ≤2 bước) và danh sách kết quả để nhảy qua lại.
// Trước nằm trong IdeaMap.jsx. jumpToCard gắn qua bind() mỗi lượt render.
export function useBoardFilters({ board }) {
  const depsRef = useRef({});
  const [filterStatus, setFilterStatus] = useState({});
  const [filterTags, setFilterTags] = useState({});
  const [filterFav, setFilterFav] = useState(false);
  const [search, setSearch] = useState("");
  // Ô tìm kiếm thu về một nút: 170px + nhãn là chỗ thường trực cho việc thỉnh
  // thoảng mới dùng. Đóng lại thì XOÁ luôn từ khoá — từ khoá còn sống mà ô nhập
  // biến mất là một bộ lọc vô hình, thẻ bị làm mờ mà không thấy vì sao.
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [matchIdx, setMatchIdx] = useState(-1);

  // Bộ lọc dựng MỘT lần cho mỗi lần đổi điều kiện, thay vì tính lại
  // Object.keys(...).filter(...) bên trong mỗi thẻ ở mỗi lần render.
  const passesFilter = useMemo(
    () => buildNodeFilter({ filterStatus, filterTags, filterFav, search }),
    [filterStatus, filterTags, filterFav, search]
  );

  const focusSet = useMemo(
    () => (board ? focusNeighborhood(board.nodes, board.edges, focusId) : null),
    [board?.nodes, board?.edges, focusId]
  );

  const matches = useMemo(
    () => (board ? board.nodes.filter(passesFilter).sort((a, b) => a.y - b.y || a.x - b.x) : EMPTY_ARRAY),
    [board?.nodes, passesFilter]
  );

  useEffect(() => { setMatchIdx(-1); }, [search]);

  const activeFilterCount =
    Object.values(filterStatus).filter(Boolean).length +
    Object.values(filterTags).filter(Boolean).length +
    (filterFav ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const matchCount = matches.length;

  function goToMatch(delta) {
    if (matches.length === 0) return;
    const next = matchIdx < 0
      ? (delta > 0 ? 0 : matches.length - 1)
      : (matchIdx + delta + matches.length) % matches.length;
    setMatchIdx(next);
    depsRef.current.jumpToCard(matches[next].id);
  }

  function clearFilters() {
    setFilterStatus({});
    setFilterTags({});
    setFilterFav(false);
    setSearch("");
  }

  function toggleSearch() {
    setSearchOpen((open) => {
      if (open) setSearch("");
      return !open;
    });
  }

  return {
    filterStatus, setFilterStatus, filterTags, setFilterTags, filterFav, setFilterFav,
    search, setSearch, searchOpen, setSearchOpen, toggleSearch, focusId, setFocusId, matchIdx,
    passesFilter, focusSet, matches, activeFilterCount, matchCount, goToMatch, clearFilters,
    bind: (d) => { depsRef.current = d; }
  };
}
