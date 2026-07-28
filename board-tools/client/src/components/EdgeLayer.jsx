import { memo } from "react";
import { colorVar } from "../lib/badges.js";
import { edgeEndpoint, rectForEndpoint, clipToRect } from "../lib/board-geometry.js";
import { seedFrom, sketchyLine } from "../lib/sketchy.js";

// Toàn bộ lớp dây tách riêng và bọc memo: nó là phần đắt nhất của mỗi lần
// render (mỗi cạnh phải tra hai đầu rồi cắt đoạn thẳng vào biên hai hình chữ
// nhật), mà phần lớn thứ làm IdeaMap render lại — con trỏ người khác, mở/đóng
// menu, gõ vào ô tìm kiếm — không đụng gì tới dây cả.
//
// nodeById/groupById là Map (không phải mảng) nên tra đầu dây là O(1);
// trước đây mỗi đầu dây quét lại cả mảng thẻ.
function EdgeLayer({
  edges, nodeById, groupById, cardSize, sketch,
  hoveredEdgeId, selectedEdgeIds, edgeDragId, snapGuides, linkDraft, edgeDraft,
  onEdgeEnter, onEdgeLeave, onEdgeClick
}) {
  return (
    <svg className="edge-layer">
      <defs>
        <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {edges.map((edge) => {
        if (edgeDragId === edge.id) return null;
        const r1 = rectForEndpoint(edge.fromKind || "node", edge.from, nodeById, groupById, cardSize);
        const r2 = rectForEndpoint(edge.toKind || "node", edge.to, nodeById, groupById, cardSize);
        if (!r1 || !r2) return null;
        const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
        const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
        const hot = hoveredEdgeId === edge.id;
        return (
          <g
            key={edge.id}
            onMouseEnter={() => onEdgeEnter(edge.id)}
            onMouseLeave={() => onEdgeLeave(edge.id)}
          >
            <line
              className="hit"
              data-edge-id={edge.id}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              onClick={(e) => onEdgeClick(e, edge.id)}
            />
            {/* Chỉ nét NHÌN THẤY đổi sang path rung. Thẻ <line className="hit">
                bên trên — vùng bấm dày 16px — giữ nguyên đường thẳng: vùng bấm
                không việc gì phải rung theo, và hit-test thẳng thì rẻ hơn. */}
            {sketch ? (
              <path
                className={"visible" + (hot ? " hot" : "") + (selectedEdgeIds.has(edge.id) ? " selected" : "")}
                d={sketchyLine(p1.x, p1.y, p2.x, p2.y, seedFrom(edge.id))}
                // fill="none" là BẮT BUỘC: CSS của .edge-layer chưa bao giờ khai
                // fill cho path, thiếu attribute này là dây thành mảng đen đặc.
                fill="none"
                style={edge.color ? { stroke: colorVar(edge.color) } : undefined}
                strokeDasharray={edge.style === "dashed" ? "6 5" : undefined}
                markerEnd={edge.arrow === "none" ? undefined : "url(#edge-arrow)"}
              />
            ) : (
              <line
                className={"visible" + (hot ? " hot" : "") + (selectedEdgeIds.has(edge.id) ? " selected" : "")}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                style={edge.color ? { stroke: colorVar(edge.color) } : undefined}
                strokeDasharray={edge.style === "dashed" ? "6 5" : undefined}
                markerEnd={edge.arrow === "none" ? undefined : "url(#edge-arrow)"}
              />
            )}
            {edge.label && (
              <text className="edge-label" x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 4} textAnchor="middle">{edge.label}</text>
            )}
          </g>
        );
      })}
      {snapGuides.map((g, i) => (g.axis === "v"
        ? <line key={i} className="snap-guide" x1={g.pos} y1={g.start} x2={g.pos} y2={g.end} />
        : <line key={i} className="snap-guide" x1={g.start} y1={g.pos} x2={g.end} y2={g.pos} />))}
      {linkDraft && (() => {
        const from = edgeEndpoint(linkDraft.fromKind || "node", linkDraft.fromId, nodeById, groupById, cardSize);
        if (!from) return null;
        return <line className="draft" x1={from.x} y1={from.y} x2={linkDraft.x} y2={linkDraft.y} />;
      })()}
      {edgeDraft && (() => {
        const fixed = edgeEndpoint(edgeDraft.fixedKind, edgeDraft.fixedId, nodeById, groupById, cardSize);
        if (!fixed) return null;
        return <line className="draft" x1={fixed.x} y1={fixed.y} x2={edgeDraft.x} y2={edgeDraft.y} />;
      })()}
    </svg>
  );
}

export default memo(EdgeLayer);
