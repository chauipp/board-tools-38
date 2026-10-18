import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { colorVar } from "../lib/badges.js";

export default function FrameBox({
  group, editingTitle, dropTarget, onMouseDown, onResizeMouseDown, onContextMenu,
  onTitleDoubleClick, onTitleSave, onTitleCancel, onDelete, onConnectorMouseDown
}) {
  const { t } = useLingui();
  const [title, setTitle] = useState(group.title);
  const doneRef = useRef(false);

  useEffect(() => {
    if (editingTitle) { setTitle(group.title); doneRef.current = false; }
  }, [editingTitle, group.title]);

  return (
    <div
      className={"frame-box" + (dropTarget ? " drop-target" : "")}
      data-group-id={group.id}
      style={{
        left: group.x, top: group.y, width: group.w, height: group.h,
        borderColor: group.color ? colorVar(group.color) : undefined
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      <button
        className="icon-btn frame-delete"
        title={t`Xoá khung`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        ×
      </button>
      {editingTitle ? (
        <input
          className="frame-title-input"
          autoFocus
          value={title}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (!doneRef.current) onTitleSave(title); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { doneRef.current = true; onTitleSave(title); }
            if (e.key === "Escape") { doneRef.current = true; onTitleCancel(); }
          }}
        />
      ) : (
        <span className="frame-title" onDoubleClick={() => onTitleDoubleClick()}>
          {group.title || t`Khung`}
        </span>
      )}
      <div
        className="frame-resize-handle"
        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e); }}
      />
      <span className="connector-zone top" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
      <span className="connector-zone right" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
      <span className="connector-zone bottom" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
      <span className="connector-zone left" onMouseDown={onConnectorMouseDown} onClick={(e) => e.stopPropagation()}><span className="connector-dot">+</span></span>
    </div>
  );
}
