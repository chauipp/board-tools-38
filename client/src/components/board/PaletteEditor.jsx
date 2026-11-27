import { useRef, useEffect } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useCloseOnOutside } from "../../lib/useCloseOnOutside.js";
import { usePopoverPosition } from "../../lib/usePopoverPosition.js";

export default function PaletteEditor({ x, y, hex, onPick, onDelete, onClose }) {
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
