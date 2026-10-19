import { memo } from "react";
import { colorVar } from "../lib/badges.js";
import { edgeEndpoint } from "../lib/board-geometry.js";
import { seedFrom, sketchyConnector } from "../lib/sketchy.js";
import { relationDefinition, isGameDesignRelation } from "../lib/game-design.js";

function EdgeLayer({
  edges, routes, nodeById, groupById, cardSize, sketch,
  gameDesign, cycleEdgeIds,
  hoveredEdgeId, selectedEdgeIds, edgeDragId, snapGuides, linkDraft, edgeDraft,
  onEdgeEnter, onEdgeLeave, onEdgeClick, onEdgeContextMenu
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
        const route = routes.get(edge.id);
        if (!route) return null;
        const hot = hoveredEdgeId === edge.id;
        const relationClass = gameDesign && isGameDesignRelation(edge.relation) ? ` relation-${edge.relation}` : "";
        const cycleClass = cycleEdgeIds?.has(edge.id) ? " dependency-cycle" : "";
        return (
          <g
            key={edge.id}
            onMouseEnter={() => onEdgeEnter(edge.id)}
            onMouseLeave={() => onEdgeLeave(edge.id)}
          >
            <path
              className="hit"
              data-edge-id={edge.id}
              d={route.d}
              fill="none"
              onClick={(e) => onEdgeClick(e, edge.id)}
              onContextMenu={(e) => onEdgeContextMenu(e, edge.id)}
            />
            <path
              className={"visible" + (hot ? " hot" : "") + (selectedEdgeIds.has(edge.id) ? " selected" : "") + relationClass + cycleClass}
              d={sketch ? sketchyConnector(route.d, seedFrom(edge.id)) : route.d}
              fill="none"
              style={edge.color ? { stroke: colorVar(edge.color) } : undefined}
              strokeDasharray={edge.style === "dashed" ? "6 5" : undefined}
              markerEnd={edge.arrow === "none" ? undefined : "url(#edge-arrow)"}
            />
            {edge.label && (
              <text className="edge-label" x={route.label.x} y={route.label.y - 4} textAnchor="middle">{edge.label}</text>
            )}
            {gameDesign && isGameDesignRelation(edge.relation) && route.length >= 150 && (
              <text className={`edge-label edge-relation-label relation-${edge.relation}`} x={route.label.x} y={route.label.y + 12} textAnchor="middle">
                {relationDefinition(edge.relation).label}
              </text>
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
