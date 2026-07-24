import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { colorVar } from "../lib/badges.js";

export default function FrameBox({
  group, editingTitle, onMouseDown, onResizeMouseDown, onContextMenu,
  onTitleDoubleClick, onTitleSave, onTitleCancel, onDelete
}) {
  const { t } = useLingui();
  const [title, setTitle] = useState(group.title);

  useEffect(() => {
    if (editingTitle) setTitle(group.title);
  }, [editingTitle, group.title]);

  return (
    <div
      className="frame-box"
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
          onBlur={() => onTitleSave(title)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onTitleSave(title);
            if (e.key === "Escape") onTitleCancel();
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
    </div>
  );
}
