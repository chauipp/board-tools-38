import { useLingui } from "@lingui/react/macro";
import { PEN_COLORS, PEN_WIDTHS, penVar } from "../lib/pen.js";

export default function ToolOptions({ tool, prefs, onPrefs }) {
  const { t } = useLingui();
  // Cục gôm không có tuỳ chọn nào, và mode Chuột thì IdeaMap không render
  // component này — nên chỉ còn đúng một trường hợp phải vẽ.
  if (tool !== "pen") return null;

  return (
    <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
      <div className="tool-grid">
        {PEN_COLORS.map((token) => (
          <button
            key={token}
            type="button"
            className={"pen-swatch" + (prefs.color === token ? " on" : "")}
            style={{ background: penVar(token) }}
            title={t`Màu bút`}
            onClick={() => onPrefs({ ...prefs, color: token })}
          />
        ))}
      </div>
      <div className="tool-sep" />
      {PEN_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          className={"tool-btn pen-width" + (prefs.w === w ? " on" : "")}
          title={t`Độ dày nét`}
          onClick={() => onPrefs({ ...prefs, w })}
        >
          <span className="bar" style={{ height: w }} />
        </button>
      ))}
    </div>
  );
}
