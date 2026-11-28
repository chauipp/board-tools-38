import { useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useCloseOnOutside } from "../../lib/useCloseOnOutside.js";
import { usePopoverPosition } from "../../lib/usePopoverPosition.js";
import { BADGE_PALETTE, colorVar } from "../../lib/badges.js";
import { LineSolidIcon, LineDashedIcon, LineUndirectedIcon, LineDirectedIcon, ReverseIcon } from "./icons.jsx";

export default function EdgeMenu({ x, y, edge, onStyleToggle, onArrowToggle, onReverse, onLabel, onColorChange, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);

  // Guard against a redundant second commit: Enter commits immediately, and a
  // later blur (e.g. clicking elsewhere) would otherwise push the same value
  // again. Comparing against the (by-then-updated) `edge.label` prop makes the
  // second call a no-op instead of a duplicate history entry.
  function commitLabel(rawValue) {
    const next = rawValue.trim();
    const prev = (edge.label ?? "").trim();
    if (next === prev) return;
    onLabel(rawValue);
  }

  const isDashed = edge.style === "dashed";
  const isDirected = edge.arrow !== "none";

  return (
    <div className="badge-editor edge-menu" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="be-name"
        type="text"
        autoFocus
        defaultValue={edge.label ?? ""}
        placeholder={t`Nhãn edge…`}
        onKeyDown={(e) => { if (e.key === "Enter") commitLabel(e.currentTarget.value); }}
        onBlur={(e) => commitLabel(e.target.value)}
      />

      <div className="em-section">
        <div className="eyebrow"><Trans>Kiểu nét</Trans></div>
        <div className="em-toggle-group">
          <button className={"em-icon-btn" + (!isDashed ? " on" : "")} onClick={() => isDashed && onStyleToggle()} title={t`Nét liền`}>
            <LineSolidIcon />
          </button>
          <button className={"em-icon-btn" + (isDashed ? " on" : "")} onClick={() => !isDashed && onStyleToggle()} title={t`Nét đứt`}>
            <LineDashedIcon />
          </button>
        </div>
      </div>

      <div className="em-section">
        <div className="eyebrow"><Trans>Hướng</Trans></div>
        <div className="em-toggle-group">
          <button className={"em-icon-btn" + (!isDirected ? " on" : "")} onClick={() => isDirected && onArrowToggle()} title={t`Vô hướng`}>
            <LineUndirectedIcon />
          </button>
          <button className={"em-icon-btn" + (isDirected ? " on" : "")} onClick={() => !isDirected && onArrowToggle()} title={t`Có hướng`}>
            <LineDirectedIcon />
          </button>
          {isDirected && (
            <button className="em-icon-btn" onClick={onReverse} title={t`Đảo chiều`}>
              <ReverseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="em-section">
        <div className="eyebrow"><Trans>Màu dây</Trans></div>
        <div className="be-swatches">
          <button className={"be-swatch dot-empty" + (!edge.color ? " on" : "")} onClick={() => onColorChange(null)} title={t`Mặc định`} />
          {BADGE_PALETTE.map((token) => (
            <button key={token} className={"be-swatch" + (edge.color === token ? " on" : "")} style={{ background: colorVar(token) }} onClick={() => onColorChange(token)} title={token} />
          ))}
        </div>
      </div>

      <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá cạnh</Trans></button>
    </div>
  );
}
