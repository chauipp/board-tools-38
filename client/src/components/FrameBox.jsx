import { memo, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { colorVar } from "../lib/badges.js";

// Cùng lý do như IdeaCard: `h` là object hành động có định danh ổn định, nhờ
// vậy memo() mới chặn được việc mọi khung vẽ lại theo mỗi nhịp kéo/con trỏ.
function FrameBox({ group, editingTitle, dropTarget, selected, treeSwapState, h }) {
  const { t } = useLingui();
  const [title, setTitle] = useState(group.title);
  const doneRef = useRef(false);

  useEffect(() => {
    if (editingTitle) { setTitle(group.title); doneRef.current = false; }
  }, [editingTitle, group.title]);

  return (
    <div
      className={"frame-box" + (dropTarget ? " drop-target" : "") + (selected ? " selected" : "") + (group.color ? " tinted" : "")}
      data-group-id={group.id}
      data-tree-swap={treeSwapState}
      data-wob={group.id % 4}
      style={{
        left: group.x, top: group.y, width: group.w, height: group.h,
        // Như IdeaCard: màu chỉ là một token, việc trộn ra nền và viền là của CSS.
        ...(group.color ? { "--tint": colorVar(group.color) } : {})
      }}
      onMouseDown={(e) => h.mouseDown(e, group.id)}
      onContextMenu={(e) => h.contextMenu(e, group.id)}
    >
      <button
        className="icon-btn frame-delete"
        title={t`Xoá khung`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); h.remove(group.id); }}
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
          onBlur={() => { if (!doneRef.current) h.saveTitle(group.id, title); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { doneRef.current = true; h.saveTitle(group.id, title); }
            if (e.key === "Escape") { doneRef.current = true; h.cancelTitle(); }
          }}
        />
      ) : (
        <span className="frame-title" onDoubleClick={() => h.editTitle(group.id)}>
          {group.title || t`Khung`}
        </span>
      )}
      {group.locked && <span className="lock-badge frame-lock">🔒</span>}
      <div
        className="frame-resize-handle"
        onMouseDown={(e) => { e.stopPropagation(); h.resizeMouseDown(e, group.id); }}
      />
      {/* Handler nằm trên CHÍNH cái chấm, không phải trên cả vùng bao. Trước đây
          nó ở trên .connector-zone — một ô 32px trong suốt — nên mọi cú bấm rơi
          vào ô đó đều thành "nối dây", kể cả khi con trỏ đang ở trên nút × của
          khung. Thẻ (IdeaCard) vốn đã làm đúng cách này; khung thì chưa. */}
      <span className="connector-zone top"><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, group.id)} onClick={(e) => e.stopPropagation()}>+</span></span>
      <span className="connector-zone right"><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, group.id)} onClick={(e) => e.stopPropagation()}>+</span></span>
      <span className="connector-zone bottom"><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, group.id)} onClick={(e) => e.stopPropagation()}>+</span></span>
      <span className="connector-zone left"><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, group.id)} onClick={(e) => e.stopPropagation()}>+</span></span>
    </div>
  );
}

export default memo(FrameBox);
