import { useLingui } from "@lingui/react/macro";
import { PEN_COLORS, PEN_WIDTHS, penVar } from "../lib/pen.js";
import { SHAPE_KINDS, SHAPE_CLOSED } from "../lib/shape.js";
import { TEXT_SIZES } from "../lib/text-el.js";
import { CARD_LEVELS } from "../lib/card-levels.js";
import CardLevelIcon from "./CardLevelIcon.jsx";

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

// Nhãn của từng bậc thẻ. Cố ý KHÔNG gom vào lib/card-levels.js: macro `t` cần
// binding từ useLingui() ngay trong component, còn lib là code thuần không React.
// Menu chuột phải giữ một bản riêng của bảng này, cùng lý do.
function levelLabels(t) {
  return {
    1: t`Bậc 1 — thẻ gốc`,
    2: t`Bậc 2 — thẻ chính`,
    3: t`Bậc 3 — thẻ thường`,
    4: t`Bậc 4 — thẻ phụ`,
    5: t`Bậc 5 — ghi chú`
  };
}

export default function ToolOptions({ tool, prefs, onPrefs, level, onLevel }) {
  const { t } = useLingui();

  // `tool` ở đây là "việc đang chọn" chứ không riêng tool vẽ: ở mode Đặt thì nó
  // là "node" / "group". Khu 4 là một khối duy nhất cho mọi mode — nếu tách
  // thành hai component thì hai khối .tool-options cùng tồn tại được, và cái
  // sau sẽ nằm đè lên cái trước ở đúng toạ độ left: 66px.
  if (tool === "node") {
    const LEVEL_LABEL = levelLabels(t);
    return (
      <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
        {CARD_LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            className={"tool-btn level-pick" + (level === lv ? " on" : "")}
            title={LEVEL_LABEL[lv]}
            onClick={() => onLevel(lv)}
          ><CardLevelIcon level={lv} /></button>
        ))}
      </div>
    );
  }

  // Text: ba cỡ chữ + bảy màu bút. KHÔNG có độ dày nét (chữ không có nét dày
  // mảnh) và không có bảng sáu hình. Trả sớm, trước nhánh bút/hình khối bên
  // dưới, để khỏi phải rắc `tool === "text"` vào từng khối một.
  if (tool === "text") {
    const SIZE_LABEL = { 14: t`Chữ nhỏ`, 20: t`Chữ vừa`, 30: t`Chữ lớn` };
    return (
      <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tool-grid">
          {TEXT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={"tool-btn text-size" + (prefs.size === size ? " on" : "")}
              title={SIZE_LABEL[size]}
              onClick={() => onPrefs({ ...prefs, size })}
            >
              {/* Cỡ chữ trên nút tỉ lệ với cỡ thật, nhưng thu nhỏ lại cho vừa ô
                  28px — nút phải đọc ra được "cái nào to hơn cái nào". */}
              <span style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }}>A</span>
            </button>
          ))}
        </div>
        <div className="tool-sep" />
        <div className="tool-grid">
          {PEN_COLORS.map((token) => (
            <button
              key={token}
              type="button"
              className={"pen-swatch" + (prefs.color === token ? " on" : "")}
              style={{ background: penVar(token) }}
              title={t`Màu chữ`}
              onClick={() => onPrefs({ ...prefs, color: token })}
            />
          ))}
        </div>
      </div>
    );
  }

  // Cục gôm và nút vẽ khung không có tuỳ chọn nào, và mode Chuột thì IdeaMap
  // không render component này — nên chỉ còn hai trường hợp phải vẽ.
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
