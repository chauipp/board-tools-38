import { useMemo, useRef } from "react";
import { drawingBox, shapeHandles } from "./shape.js";
import { paletteCss } from "./palette.js";
import { rectsOf } from "./minimap.js";
import { buildEdgeRoutes } from "./edge-routing.js";
import { applyGeomOverlay } from "./useLiveSync.js";
import { applyInkMoves } from "./ink-live.js";
import { CARD_W, EMPTY_ARRAY, EMPTY_MAP } from "./board-constants.js";

// Các giá trị DẪN XUẤT từ board để vẽ: thẻ/khung đã đắp vị trí tạm của người
// khác, bảng tra theo id, đường đi của dây, định nghĩa trạng thái/nhãn, CSS bảng
// màu, danh sách nét vẽ đã đắp nét đang kéo/đang vẽ của người khác, hình đang
// sửa tay cầm, hình khối cho minimap, và gói live của các nét đang dời. Chỉ đọc,
// không ghi gì. Trước nằm trong IdeaMap.jsx.
export function useBoardDerived({
  board, frameCardSize, geomOverlay, inkLive, textDrag, selectedIds, selectedGroupIds, selectedDrawingIds
}) {
  const depsRef = useRef({});

  // Toạ độ dùng để VẼ: board thật + vị trí tạm của người khác đang kéo. Mọi thứ
  // hiển thị (thẻ, khung, dây, tay cầm dây) phải đọc từ đây, còn handler tương
  // tác vẫn đọc `board` gốc — nếu không, phép tính kéo sẽ lấy vị trí tạm của
  // người khác làm mốc.
  const liveNodes = useMemo(
    () => (board ? applyGeomOverlay(board.nodes, geomOverlay, "node:") : EMPTY_ARRAY),
    [board?.nodes, geomOverlay]
  );

  const liveGroups = useMemo(
    () => (board ? applyGeomOverlay(board.groups, geomOverlay, "group:") : EMPTY_ARRAY),
    [board?.groups, geomOverlay]
  );

  // Chỉ mục tra cứu O(1) cho lớp dây và lớp peer. Trước đây mỗi đầu dây quét
  // lại cả mảng thẻ ở mỗi lần render: bảng 150 cạnh × 100 thẻ là 30.000 phép so
  // sánh cho một khung hình, nhân với 60 khung hình mỗi giây lúc kéo.
  const nodeById = useMemo(() => new Map(liveNodes.map((n) => [n.id, n])), [liveNodes]);

  const groupById = useMemo(() => new Map(liveGroups.map((g) => [g.id, g])), [liveGroups]);

  const edgeRoutes = useMemo(
    () => buildEdgeRoutes(board?.edges || EMPTY_ARRAY, nodeById, groupById, frameCardSize),
    [board?.edges, nodeById, groupById, frameCardSize]
  );

  const edgeRoutesRef = useRef(edgeRoutes);

  edgeRoutesRef.current = edgeRoutes;

  const statusDefById = useMemo(
    () => (board ? new Map(board.statuses.map((s) => [s.id, s])) : EMPTY_MAP),
    [board?.statuses]
  );

  const tagDefById = useMemo(
    () => (board ? new Map(board.tags.map((tg) => [tg.id, tg])) : EMPTY_MAP),
    [board?.tags]
  );

  const paletteStyle = useMemo(() => paletteCss(board?.palette ?? EMPTY_ARRAY), [board?.palette]);

  const inkDrawings = useMemo(() => {
    const list = board?.drawings ?? EMPTY_ARRAY;
    const dragged = !textDrag
      ? list
      : list.map((d) => (d.id === textDrag.id ? { ...d, pts: [textDrag.x, textDrag.y] } : d));
    // Nét người KHÁC đang dời / co giãn / sửa hình. Đắp ở đây chứ không trong
    // InkLayer, để đối xứng với liveNodes/liveGroups: mọi thứ hiển thị đọc từ
    // bản đã đắp overlay, còn handler tương tác vẫn đọc `board` gốc.
    return applyInkMoves(dragged, inkLive.liveStrokes);
  }, [board?.drawings, textDrag, inkLive.liveStrokes]);

  // Trạng thái HIỆN TẠI của các nét đang bị thao tác, dạng gói live. Chỉ mang
  // phần hình học — kiểu dáng thì người nhận đã có trong board của họ.
  function movingPayload(b, ids) {
    const out = [];
    for (const d of b?.drawings || []) {
      if (!ids.has(d.id)) continue;
      const m = { id: d.id, pts: d.pts };
      // kind chỉ đổi khi kéo tay cầm một góc; gửi luôn cho mọi nét thì gói to ra
      // vô ích, nên chỉ gửi khi nó thật sự khác bản người nhận đang có... mà
      // "bản người nhận đang có" thì mình không biết. Gửi cho hình khối là đủ:
      // nét bút và chữ không bao giờ đổi kind.
      if (d.kind && d.kind !== "pen" && d.kind !== "text") m.kind = d.kind;
      if (d.kind === "text") {
        if (Number.isFinite(d.size)) m.size = d.size;
        if (Number.isFinite(d.w)) m.w = d.w;
        if (Number.isFinite(d.h)) m.h = d.h;
      }
      out.push(m);
    }
    return out;
  }

  // Hình đang được sửa từng góc/cạnh: chọn ĐÚNG MỘT hình khối, không kèm thẻ hay
  // khung nào. Chỉ một hình mới có tay cầm — chọn hai hình thì tay cầm của chúng
  // chen vào nhau và không ai biết cái nào của cái nào; ở đó việc cần làm là kéo
  // cả cụm, mà hộp bao vùng chọn đã lo (xem selBounds).
  const editShape = useMemo(() => {
    if (!board || selectedDrawingIds.size !== 1) return null;
    if (selectedIds.size || selectedGroupIds.size) return null;
    const id = Array.from(selectedDrawingIds)[0];
    const d = (board.drawings || []).find((x) => x.id === id);
    if (!d) return null;
    const handles = shapeHandles(d);
    return handles.length ? { d, handles } : null;
  }, [board?.drawings, selectedDrawingIds, selectedIds, selectedGroupIds]);

  // Hình khối cho minimap. Tính lại khi NỘI DUNG đổi, không phải khi camera đổi:
  // lia bảng là chuyện xảy ra liên tục, mà lia thì mấy cái hộp này không hề khác.
  const miniShapes = useMemo(
    () => (board ? rectsOf(board, CARD_W, drawingBox) : null),
    [board?.nodes, board?.groups, board?.drawings]
  );

  return {
    liveNodes, liveGroups, nodeById, groupById, edgeRoutes, edgeRoutesRef, statusDefById, tagDefById, paletteStyle, inkDrawings, editShape, miniShapes, movingPayload,
    bind: (d) => { depsRef.current = d; }
  };
}
