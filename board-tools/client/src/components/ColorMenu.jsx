import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function ColorMenu({ x, y, color, count = 1, onPick, onEdit, onGroup, onTidy, onFocus, onDuplicate, onComments, onCopyLink, onDelete, onClose, locked, onToggleLock }) {
  const { t } = useLingui();
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);

  // Một hành động một dòng. Trước đây tám nút chữ nằm ngang trong khung 220px:
  // chữ vỡ dòng, nút cao thấp so le, khung phình quá cỡ của chính nó.
  const items = [
    onEdit && { label: t`Sửa`, run: onEdit },
    onGroup && { label: t`Gom nhóm`, run: onGroup },
    onTidy && { label: t`Xếp gọn`, run: onTidy },
    onFocus && { label: t`Chỉ xem thẻ liên quan`, run: onFocus },
    onToggleLock && { label: locked ? t`Mở khoá` : t`Khoá`, run: onToggleLock },
    onDuplicate && { label: t`Nhân bản`, run: onDuplicate },
    onComments && { label: t`Bình luận`, run: onComments },
    onCopyLink && { label: t`Chép liên kết`, run: onCopyLink }
  ].filter(Boolean);

  return (
    <div className="badge-editor ctx-menu" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      {count > 1 && <div className="cm-head mono">{t`Áp cho ${count} thẻ`}</div>}
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
      <div className="cm-items">
        {items.map((it) => (
          <button key={it.label} className="cm-item" onClick={it.run}>{it.label}</button>
        ))}
        {onDelete && (
          <>
            <div className="cm-sep" />
            <button className="cm-item danger" onClick={onDelete}>
              {count > 1 ? t`Xoá ${count} thẻ` : t`Xoá`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
