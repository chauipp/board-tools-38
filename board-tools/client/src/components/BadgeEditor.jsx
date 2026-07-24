import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../lib/badges.js";

export default function BadgeEditor({ x, y, initialName, initialColor, submitLabel, onSubmit, onClose }) {
  const { t } = useLingui();
  const [name, setName] = useState(initialName || "");
  const [color, setColor] = useState(initialColor || BADGE_PALETTE[0]);
  const ref = useRef(null);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  }

  return (
    <div className="badge-editor" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="be-name"
        type="text"
        autoFocus
        value={name}
        placeholder={t`Tên badge`}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      />
      <div className="be-swatches">
        {BADGE_PALETTE.map((token) => (
          <button
            key={token}
            className={"be-swatch" + (token === color ? " on" : "")}
            style={{ background: colorVar(token) }}
            onClick={() => setColor(token)}
            title={token}
          />
        ))}
      </div>
      <div className="be-actions">
        <button className="save-btn" onClick={submit}>{submitLabel}</button>
        <button className="cancel-btn" onClick={onClose}><Trans>Hủy</Trans></button>
      </div>
    </div>
  );
}
