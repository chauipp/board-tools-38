import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";
import { CARD_LEVELS } from "../lib/card-levels.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";
import { usePopoverPosition } from "../lib/usePopoverPosition.js";
import CardLevelIcon from "./CardLevelIcon.jsx";

function ShapeRectIcon() {
  return <svg viewBox="0 0 20 14" width="20" height="14"><rect x="2" y="2" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
function ShapeEllipseIcon() {
  return <svg viewBox="0 0 20 14" width="20" height="14"><ellipse cx="10" cy="7" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
function BorderSolidIcon() {
  return <svg viewBox="0 0 20 14" width="20" height="14"><rect x="2" y="2" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
function BorderDashedIcon() {
  return <svg viewBox="0 0 20 14" width="20" height="14"><rect x="2" y="2" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.4" /></svg>;
}
// Mũi tên chỉ hướng cây sẽ mọc ra, không phải nút trạng thái — bấm là chạy luôn.
function ArrowIcon({ rotate }) {
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M10 2 L10 11 M6 7.5 L10 11.5 L14 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function ColorMenu({ x, y, color, count = 1, kind = "card", onPick, onEdit, onGroup, onTidy, onFocus, onDuplicate, onComments, onCopyLink, onDelete, onClose, locked, onToggleLock, shape, onSetShape, dashed, onSetDashed, level, onSetLevel, onArrangeTree, onTreePanel }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);

  // Bản sao của bảng nhãn trong ToolOptions.jsx — xem ghi chú ở đó về lý do
  // không gom chung vào lib.
  const LEVEL_LABEL = {
    1: t`Bậc 1 — thẻ gốc`,
    2: t`Bậc 2 — thẻ chính`,
    3: t`Bậc 3 — thẻ thường`,
    4: t`Bậc 4 — thẻ phụ`,
    5: t`Bậc 5 — ghi chú`
  };

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
    <div className="badge-editor ctx-menu" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      {/* Cùng một menu dùng cho thẻ và cho khung, nên chỗ đếm phải gọi đúng tên
          thứ đang bị tác động — "Áp cho 3 thẻ" trong lúc đang chọn 3 cái khung
          là một câu nói sai. */}
      {count > 1 && (
        <div className="cm-head mono">{kind === "group" ? t`Áp cho ${count} khung` : t`Áp cho ${count} thẻ`}</div>
      )}
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
      {/* Bậc thẻ — thay cho mục "Đặt làm thẻ gốc" cũ, vốn chỉ bật/tắt được một
          bậc. Đứng ngay dưới bảng màu vì cùng là "thẻ này trông thế nào". */}
      {onSetLevel && (
        <div className="em-section">
          <div className="em-toggle-group">
            {CARD_LEVELS.map((lv) => (
              <button
                key={lv}
                className={"em-icon-btn lv-btn" + (level === lv ? " on" : "")}
                onClick={() => onSetLevel(lv)}
                title={LEVEL_LABEL[lv]}
              ><CardLevelIcon level={lv} /></button>
            ))}
          </div>
        </div>
      )}
      {onSetShape && (
        <div className="em-section">
          <div className="em-toggle-group">
            <button className={"em-icon-btn" + (shape !== "ellipse" ? " on" : "")} onClick={() => shape === "ellipse" && onSetShape("rect")} title={t`Vuông`}>
              <ShapeRectIcon />
            </button>
            <button className={"em-icon-btn" + (shape === "ellipse" ? " on" : "")} onClick={() => shape !== "ellipse" && onSetShape("ellipse")} title={t`Elip / tròn`}>
              <ShapeEllipseIcon />
            </button>
          </div>
        </div>
      )}
      {onSetDashed && (
        <div className="em-section">
          <div className="em-toggle-group">
            <button className={"em-icon-btn" + (!dashed ? " on" : "")} onClick={() => dashed && onSetDashed(false)} title={t`Viền liền`}>
              <BorderSolidIcon />
            </button>
            <button className={"em-icon-btn" + (dashed ? " on" : "")} onClick={() => !dashed && onSetDashed(true)} title={t`Viền nét đứt`}>
              <BorderDashedIcon />
            </button>
          </div>
        </div>
      )}
      {onArrangeTree && (
        <div className="em-section">
          <div className="em-toggle-group">
            <button className="em-icon-btn" onClick={() => onArrangeTree("down")} title={t`Xếp cây xuống dưới`}>
              <ArrowIcon rotate={0} />
            </button>
            <button className="em-icon-btn" onClick={() => onArrangeTree("up")} title={t`Xếp cây lên trên`}>
              <ArrowIcon rotate={180} />
            </button>
            <button className="em-icon-btn" onClick={() => onArrangeTree("right")} title={t`Xếp cây sang phải`}>
              <ArrowIcon rotate={-90} />
            </button>
            <button className="em-icon-btn" onClick={() => onArrangeTree("left")} title={t`Xếp cây sang trái`}>
              <ArrowIcon rotate={90} />
            </button>
          </div>
          {/* Bốn nút trên là lối tắt một hướng; ai muốn cây toả hai bên hay muốn
              nới/bó khoảng cách thì mở bảng bên phải. */}
          {onTreePanel && (
            <button className="cm-item tp-open" onClick={onTreePanel}>{t`Tuỳ chỉnh cây…`}</button>
          )}
        </div>
      )}
      <div className="cm-items">
        {items.map((it) => (
          <button key={it.label} className="cm-item" onClick={it.run}>{it.label}</button>
        ))}
        {onDelete && (
          <>
            <div className="cm-sep" />
            <button className="cm-item danger" onClick={onDelete}>
              {count > 1
                ? (kind === "group" ? t`Xoá ${count} khung` : t`Xoá ${count} thẻ`)
                : t`Xoá`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
