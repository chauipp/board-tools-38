import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";
import { usePopoverPosition } from "../lib/usePopoverPosition.js";

function LineSolidIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function LineDashedIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" /></svg>;
}
function LineUndirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3" cy="6" r="1.8" fill="currentColor" />
      <circle cx="17" cy="6" r="1.8" fill="currentColor" />
    </svg>
  );
}
function LineDirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2l5 4-5 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReverseIcon() {
  return (
    <svg viewBox="0 0 20 16" width="20" height="16">
      <path d="M2 5h13M11 2l3 3-3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 11H5M9 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaletteEditor({ x, y, hex, onPick, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const inputRef = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);

  // Listener "change" thật, không dùng onChange của React: React map onChange
  // của input màu sang sự kiện "input", tức là mỗi bước kéo trong bộ chọn màu
  // thành một entry undo + một lần lưu. "change" chỉ nổ một lần khi chốt màu.
  useEffect(() => {
    const el = inputRef.current;
    const handler = (e) => onPick(e.target.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, [onPick]);

  return (
    <div className="badge-editor pal-editor" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      <div className="eyebrow">{onDelete ? t`Sửa màu` : t`Màu mới`}</div>
      <input className="pal-input" type="color" defaultValue={hex} ref={inputRef} />
      {onDelete && (
        <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá màu</Trans></button>
      )}
    </div>
  );
}

export function EdgeMenu({ x, y, edge, onStyleToggle, onArrowToggle, onReverse, onLabel, onColorChange, onDelete, onClose }) {
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

export function CommentsPopover({ x, y, comments, onAdd, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);
  const [text, setText] = useState("");

  function timeAgo(iso) {
    const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return t`vừa xong`;
    if (diffSec < 3600) { const m = Math.floor(diffSec / 60); return t`${m} phút trước`; }
    if (diffSec < 86400) { const h = Math.floor(diffSec / 3600); return t`${h} giờ trước`; }
    const d = Math.floor(diffSec / 86400);
    return t`${d} ngày trước`;
  }

  function submit() {
    if (!text.trim()) return;
    if (onAdd(text)) setText("");
  }

  return (
    <div className="badge-editor comments-pop" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      {comments.length > 0 && (
        <div className="cmt-list">
          {comments.map((c, i) => (
            <div className="cmt-item" key={i}>
              <div className="cmt-item-head">
                <span className="cmt-author">{c.author}</span>
                <span className="cmt-time">{timeAgo(c.at)}</span>
                <button className="cmt-delete" onClick={() => onDelete(i)} title={t`Xoá`}>×</button>
              </div>
              <div className="cmt-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t`Viết bình luận…`}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
      />
      <div className="cmt-actions">
        <button className="save-btn" onClick={submit}><Trans>Gửi</Trans></button>
      </div>
    </div>
  );
}
