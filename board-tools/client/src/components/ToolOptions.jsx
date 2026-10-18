import { useLingui } from "@lingui/react/macro";
import { PEN_COLORS, PEN_WIDTHS, penVar } from "../lib/pen.js";
import { SHAPE_KINDS, SHAPE_CLOSED } from "../lib/shape.js";

// Icon của bảng chọn hình: vẽ ĐÚNG hình mà nút đó tạo ra, không dùng chữ hay
// emoji — theo currentColor nên tự đúng ở nền sáng và nền tối.
const SHAPE_ICON = {
  rect: <rect x="3" y="5" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  ellipse: <ellipse cx="10" cy="10" rx="7" ry="5" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  line: <path d="M 3 16 L 17 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  arrow: <path d="M 3 16 L 17 4 M 11 4 L 17 4 L 17 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  triangle: <path d="M 10 4 L 17 16 L 3 16 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  diamond: <path d="M 10 3 L 17 10 L 10 17 L 3 10 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
};

export default function ToolOptions({ tool, prefs, onPrefs }) {
  const { t } = useLingui();
  // Cục gôm không có tuỳ chọn nào, và mode Chuột thì IdeaMap không render
  // component này — nên chỉ còn hai trường hợp phải vẽ.
  if (tool !== "pen" && tool !== "shape") return null;
  const isShape = tool === "shape";
  const canFill = isShape && SHAPE_CLOSED.has(prefs.kind);

  const SHAPE_LABEL = {
    rect: t`Chữ nhật`,
    ellipse: t`Ê-líp`,
    line: t`Đường thẳng`,
    arrow: t`Mũi tên`,
    triangle: t`Tam giác`,
    diamond: t`Hình thoi`
  };

  return (
    <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
      {isShape && (
        <>
          <div className="tool-grid">
            {SHAPE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={"tool-btn shape-pick" + (prefs.kind === kind ? " on" : "")}
                title={SHAPE_LABEL[kind]}
                // Chọn hình mở thì tắt luôn chế độ tô: để `fill` bật ngầm rồi
                // đổi lại sang chữ nhật sẽ tô đặc bất ngờ.
                onClick={() => onPrefs({ ...prefs, kind, fill: SHAPE_CLOSED.has(kind) ? prefs.fill : false })}
              ><svg viewBox="0 0 20 20" width="18" height="18">{SHAPE_ICON[kind]}</svg></button>
            ))}
          </div>
          <div className="tool-sep" />
        </>
      )}

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

      {isShape && (
        <>
          <div className="tool-sep" />
          <div className="tool-grid">
            <button
              type="button"
              className={"tool-btn fill-pick" + (!prefs.fill ? " on" : "")}
              title={t`Chỉ viền`}
              onClick={() => onPrefs({ ...prefs, fill: false })}
            ><svg viewBox="0 0 20 20" width="18" height="18"><rect x="3" y="4" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></button>
            <button
              type="button"
              className={"tool-btn fill-pick" + (prefs.fill ? " on" : "")}
              title={t`Tô cả hình`}
              disabled={!canFill}
              onClick={() => onPrefs({ ...prefs, fill: true })}
            ><svg viewBox="0 0 20 20" width="18" height="18"><rect x="3" y="4" width="14" height="12" rx="1.5" fill="currentColor" /></svg></button>
          </div>
        </>
      )}
    </div>
  );
}
