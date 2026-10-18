import { useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function ColorMenu({ x, y, color, onPick, onEdit, onGroup, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);

  return (
    <div className="badge-editor" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="be-swatches">
        <button
          className={"be-swatch dot-empty" + (color == null ? " on" : "")}
          onClick={() => onPick(null)}
          title={t`Không màu`}
        />
        {BADGE_PALETTE.map((token) => (
          <button
            key={token}
            className={"be-swatch" + (token === color ? " on" : "")}
            style={{ background: colorVar(token) }}
            onClick={() => onPick(token)}
            title={token}
          />
        ))}
      </div>
      <div className="be-actions">
        {onGroup && <button className="save-btn" onClick={onGroup}><Trans>Gom nhóm</Trans></button>}
        {onEdit && <button className="save-btn" onClick={onEdit}><Trans>Sửa</Trans></button>}
        <button className="cancel-btn" onClick={onClose}><Trans>Đóng</Trans></button>
      </div>
    </div>
  );
}
