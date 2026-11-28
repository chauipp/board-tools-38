import { Trans, useLingui } from "@lingui/react/macro";
import { colorVar, statusById } from "../../lib/badges.js";
import { buildOutline } from "../../lib/outline.js";

// Mục lục (outline) của board. Trước là một khối JSX trong IdeaMap.jsx; cây DOM
// và class giữ nguyên.
export default function OutlinePanel({ board, exportMarkdown, exportPng, frameCardSize, jumpToCard, jumpToGroup, nodeById, outlineOpen, setOutlineOpen }) {
  const { t } = useLingui();
  return (
    <>
      {outlineOpen && (() => {
        const outline = buildOutline(board, frameCardSize);
        const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
        const row = (id) => {
          const n = nodeById.get(id);
          if (!n) return null;
          const s = statusById(board, n.statusId);
          return (
            <button key={id} className="op-row" onClick={() => jumpToCard(id)}>
              <span className="dot" style={{ background: s ? colorVar(s.color) : "transparent" }}></span>
              <span className="op-title">{n.title}</span>
            </button>
          );
        };
        return (
          <div className="outline-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="op-head">
              <span className="op-count mono">{board.nodes.length}</span>
              <button className="btn ghost small" onClick={exportMarkdown}><Trans>Xuất MD</Trans></button>
              <button className="btn ghost small" onClick={exportPng}><Trans>Xuất PNG</Trans></button>
              <button className="op-close" onClick={() => setOutlineOpen(false)}>×</button>
            </div>
            <div className="op-body">
              {outline.frames.map(({ group, nodeIds }) => (
                <div key={"g" + group.id} className="op-section">
                  <button className="op-section-title" onClick={() => jumpToGroup(group)}>
                    {group.title} <span className="mono op-n">{nodeIds.length}</span>
                  </button>
                  {nodeIds.map(row)}
                </div>
              ))}
              {Array.from(outline.byStatus.entries()).map(([key, ids]) => (
                <div key={"s" + key} className="op-section">
                  <div className="op-section-title static">
                    {key === "none" ? t`Khác` : (statusById(board, key)?.name ?? t`Khác`)}
                    {" "}<span className="mono op-n">{ids.length}</span>
                  </div>
                  {ids.map(row)}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
