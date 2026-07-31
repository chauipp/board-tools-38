import { useLingui } from "@lingui/react/macro";
import { PEN_COLORS, PEN_WIDTHS, penVar } from "../lib/pen.js";
import { LASER_WIDTHS, LASER_FADE_MIN, LASER_FADE_MAX, LASER_FADE_STEP, LASER_FADE_DEFAULT } from "../lib/laser.js";
import { SHAPE_TOOL_KINDS, SHAPE_CLOSED, shapeKindOf } from "../lib/shape.js";
import { TEXT_SIZES } from "../lib/text-el.js";
import { ERASE_STROKE, ERASE_PART, ERASE_WIDTHS } from "../lib/erase.js";
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
  diamond: <path d="M 10 3 L 17 10 L 10 17 L 3 10 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  parallelogram: <path d="M 7 5 L 18 5 L 13 15 L 2 15 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  trapezoid: <path d="M 6 5 L 14 5 L 18 15 L 2 15 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
};

// Nút "giữ tay để bắt hình": một nét tay lượn đi vào một hình chuẩn. Nói đúng
// việc nó làm bằng một hình, không cần chữ — cùng luật với mọi icon khác ở đây.
function IconSnap() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18">
      <path d="M2 13 C4 13 3.5 8 6 8 C8 8 7.5 12 9 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="11.5" y="6" width="7" height="7" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// Nút "gạch xoá": một nét ngoằn ngoèo đè lên một đường. Chính là cử chỉ, vẽ ra.
function IconScratch() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18">
      <path d="M2 15 L18 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M5 15 L8 7 L10 14 L13 6 L15 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Nút "đọc chữ viết tay": một chữ A viết tay và một chữ A in, có mũi tên giữa.
// Hai dáng của cùng một chữ nói ngay việc nó làm, không cần chữ nghĩa gì thêm.
function IconHandwrite() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18">
      <path d="M1.5 14 C2.5 9 4 5.5 5 5.5 C6 5.5 6.2 10 6.5 14 M2.6 11 L6 11"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <path d="M9 11 L11.5 11 M10.25 10 L11.5 11 L10.25 12"
        fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 14 L16 5.5 L18.5 14 M14.4 11.4 L17.6 11.4"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Số giây, một chữ số thập phân, bỏ phần ",0" cho số tròn: "0,9s" và "2s" chứ
// không phải "0.9s" và "2.0s". Dấu phẩy vì đây là nhãn tiếng Việt.
function secondsLabel(ms) {
  const s = Math.round(ms / 100) / 10;
  return (Number.isInteger(s) ? String(s) : s.toFixed(1).replace(".", ",")) + "s";
}

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
        {/* Ba nút cỡ chữ xếp MỘT CỘT, không dùng .tool-grid: lưới đó 2 cột, ba
            nút sẽ thành hàng 2 + hàng 1 lệch hẳn sang trái. Đây cũng là lý do
            ba nút độ dày nét của bút không nằm trong lưới. */}
        {TEXT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={"tool-btn text-size" + (prefs.size === size ? " on" : "")}
            title={SIZE_LABEL[size]}
            onClick={() => onPrefs({ ...prefs, size })}
          >
            {/* Cỡ chữ trên nút tỉ lệ với cỡ thật, nhưng thu nhỏ lại cho vừa ô
                34px — nút phải đọc ra được "cái nào to hơn cái nào". */}
            <span style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }}>A</span>
          </button>
        ))}
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

  // Laser: bảy màu + ba độ đậm. Dùng lại đúng bảng màu của bút (người dùng đã
  // quen nó) nhưng độ đậm là bảng RIÊNG — đơn vị khác hẳn: pixel màn hình chứ
  // không phải đơn vị canvas, vì vệt laser không được dày lên khi phóng to.
  // KHÔNG có bảng hình và không có chế độ tô: laser không tạo ra hình nào.
  if (tool === "laser") {
    return (
      <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tool-grid">
          {PEN_COLORS.map((token) => (
            <button
              key={token}
              type="button"
              className={"pen-swatch" + (prefs.color === token ? " on" : "")}
              style={{ background: penVar(token) }}
              title={t`Màu laser`}
              onClick={() => onPrefs({ ...prefs, color: token })}
            />
          ))}
        </div>
        <div className="tool-sep" />
        {LASER_WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            className={"tool-btn pen-width" + (prefs.w === w ? " on" : "")}
            title={t`Độ đậm vệt`}
            onClick={() => onPrefs({ ...prefs, w })}
          >
            <span className="bar" style={{ height: w }} />
          </button>
        ))}
        <div className="tool-sep" />
        {/* THỜI GIAN TAN. Là một thanh trượt chứ không phải ba nút như độ đậm:
            đây là một dải liên tục, và "vừa" là bao nhiêu thì tuỳ việc — chỉ vào
            một chữ thì vệt ngắn cho gọn, còn khoanh một vùng lớn rồi nói về nó
            thì vệt phải sống đủ lâu để cả đường khoanh cùng hiện một lúc.
            Có nhãn số giây ngay dưới: một thanh trượt trần trong ô 48px thì
            không cách nào biết mình đang đặt 1 giây hay 3 giây. */}
        <div className="tool-range-wrap">
          <input
            type="range"
            className="tool-range"
            min={LASER_FADE_MIN}
            max={LASER_FADE_MAX}
            step={LASER_FADE_STEP}
            value={prefs.fade ?? LASER_FADE_DEFAULT}
            title={t`Vệt laser tan sau bao lâu`}
            onChange={(e) => onPrefs({ ...prefs, fade: Number(e.target.value) })}
          />
          <span className="tool-range-val mono">{secondsLabel(prefs.fade ?? LASER_FADE_DEFAULT)}</span>
        </div>
      </div>
    );
  }

  // CỤC GÔM: hai kiểu tẩy, cộng ba cỡ khi đang ở kiểu cắt theo độ rộng.
  //
  // Ba nút cỡ chỉ hiện ở kiểu "theo độ rộng", không phải hiện rồi làm mờ: ở kiểu
  // "cả nét" thì bề rộng KHÔNG có tác dụng gì cả (cục tẩy ở đó là một cái que
  // chỉ, xem ERASE_RADIUS trong useInk.js), nên để chúng nằm đó là mời người
  // dùng chỉnh một thứ không đổi được gì.
  if (tool === "eraser") {
    const partMode = prefs.erase === ERASE_PART;
    return (
      <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tool-grid">
          <button
            type="button"
            className={"tool-btn erase-pick" + (!partMode ? " on" : "")}
            title={t`Tẩy cả nét — chạm vào đâu thì mất nguyên nét đó`}
            onClick={() => onPrefs({ ...prefs, erase: ERASE_STROKE })}
          >
            {/* Nguyên đường lượn nhưng MỜ đi: chạm một chỗ thì cả đường biến mất. */}
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M 2 14 C 5 7 8 15 11 9 C 13 5 16 10 18 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.38" />
              <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            className={"tool-btn erase-pick" + (partMode ? " on" : "")}
            title={t`Tẩy theo độ rộng — chỉ mất đúng phần quét qua, nét bị cắt thành nhiều mảnh (hình khối và chữ vẫn mất cả)`}
            onClick={() => onPrefs({ ...prefs, erase: ERASE_PART })}
          >
            {/* Cùng đường lượn đó nhưng KHUYẾT đúng một khúc ở chỗ cục tẩy đi
                qua — khác biệt giữa hai icon chính là khác biệt giữa hai kiểu. */}
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M 2 14 C 4 10 5 12 6.4 10.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M 13.6 8.4 C 15 6 16.6 9.4 18 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
        {partMode && (
          <>
            <div className="tool-sep" />
            {ERASE_WIDTHS.map((ew) => (
              <button
                key={ew}
                type="button"
                className={"tool-btn erase-width" + (prefs.ew === ew ? " on" : "")}
                title={t`Bề rộng cục tẩy`}
                onClick={() => onPrefs({ ...prefs, ew })}
              >
                {/* Cỡ thật là đơn vị canvas (10/24/56), không nhét vừa ô 34px —
                    thu lại theo tỉ lệ, nhưng vẫn phải đọc ra "cái nào to hơn". */}
                <span className="dot" style={{ width: Math.round(ew * 0.42), height: Math.round(ew * 0.42) }} />
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  // Nút vẽ khung không có tuỳ chọn nào, và mode Chuột thì IdeaMap không render
  // component này — nên chỉ còn hai trường hợp phải vẽ.
  if (tool !== "pen" && tool !== "shape") return null;
  const isShape = tool === "shape";
  // prefs.kind là ID của nút ở khu 4, không phải kind lưu vào board: hình bình
  // hành và hình thang đều lưu ra "quad". Hỏi SHAPE_CLOSED bằng id thì hai hình
  // đó rơi ra ngoài và nút "tô cả hình" bị vô hiệu oan.
  const canFill = isShape && SHAPE_CLOSED.has(shapeKindOf(prefs.kind));

  const SHAPE_LABEL = {
    rect: t`Chữ nhật`,
    ellipse: t`Ê-líp`,
    line: t`Đường thẳng`,
    arrow: t`Mũi tên`,
    triangle: t`Tam giác`,
    diamond: t`Hình thoi`,
    parallelogram: t`Hình bình hành`,
    trapezoid: t`Hình thang`
  };

  return (
    <div className="tool-options" onMouseDown={(e) => e.stopPropagation()}>
      {isShape && (
        <>
          <div className="tool-grid">
            {SHAPE_TOOL_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={"tool-btn shape-pick" + (prefs.kind === kind ? " on" : "")}
                title={SHAPE_LABEL[kind]}
                // Chọn hình mở thì tắt luôn chế độ tô: để `fill` bật ngầm rồi
                // đổi lại sang chữ nhật sẽ tô đặc bất ngờ.
                onClick={() => onPrefs({ ...prefs, kind, fill: SHAPE_CLOSED.has(shapeKindOf(kind)) ? prefs.fill : false })}
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

      {/* NÉT LIỀN / NÉT ĐỨT — có ở CẢ bút lẫn hình khối, không riêng hình khối:
          nó là một thuộc tính của cái nét, và cùng một field `dashed` chạy cho
          cả hai. Tách ra chỉ cho hình khối thì vẽ tay một đường bao "tạm thời"
          bằng nét đứt — việc hay làm nhất với nét đứt — lại không làm được.
          Icon vẽ đúng thứ nút đó tạo ra, cùng luật với bảng hình ở trên. */}
      <div className="tool-sep" />
      <div className="tool-grid">
        <button
          type="button"
          className={"tool-btn dash-pick" + (!prefs.dashed ? " on" : "")}
          title={t`Nét liền`}
          onClick={() => onPrefs({ ...prefs, dashed: false })}
        ><svg viewBox="0 0 20 20" width="18" height="18"><path d="M 3 10 L 17 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></button>
        <button
          type="button"
          className={"tool-btn dash-pick" + (prefs.dashed ? " on" : "")}
          title={t`Nét đứt — bấm hai lần lên một nét đã vẽ cũng đổi qua lại được`}
          onClick={() => onPrefs({ ...prefs, dashed: true })}
        ><svg viewBox="0 0 20 20" width="18" height="18"><path d="M 3 10 L 17 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1.6 3.4" /></svg></button>
      </div>

      {/* GIỮ TAY ĐỂ BẮT HÌNH — chỉ của bút, không có ở tool Hình khối: ở đó
          người ta đã chọn sẵn hình muốn vẽ, không có gì phải đoán.
          Là một nút bật/tắt chứ không phải thanh chọn thời gian: 1,2s đã cân
          giữa "không bắt oan lúc ngập ngừng" và "không phải đợi lâu", còn thứ
          người ta thật sự cần điều khiển là CÓ dùng nó hay không. */}
      {!isShape && (
        <>
          <div className="tool-sep" />
          <button
            type="button"
            className={"tool-btn" + (prefs.snap !== false ? " on" : "")}
            title={t`Giữ tay tại chỗ khi vẽ xong để nét tự về hình chuẩn (thẳng, tròn, vuông, tam giác cân…)`}
            onClick={() => onPrefs({ ...prefs, snap: prefs.snap === false })}
          ><IconSnap /></button>
          <button
            type="button"
            className={"tool-btn" + (prefs.scratch !== false ? " on" : "")}
            title={t`Gạch ngoằn ngoèo đè lên một nét (qua lại vài lần) là xoá nét đó`}
            onClick={() => onPrefs({ ...prefs, scratch: prefs.scratch === false })}
          ><IconScratch /></button>
          {/* Nút này TẮT sẵn, khác hai nút trên — xem ghi chú ở PEN_DEFAULT bên
              pen.js. Tóm tắt: với máy thì tam giác giống chữ A, nên bật sẵn sẽ
              biến hình của người đang vẽ sơ đồ thành chữ cái. */}
          <button
            type="button"
            className={"tool-btn" + (prefs.hw === true ? " on" : "")}
            title={t`Viết chữ số hoặc chữ không dấu, ngừng tay một chút là tự đổi thành chữ máy (tắt sẵn: đang bật thì hình vẽ cũng có thể bị đọc thành chữ)`}
            onClick={() => onPrefs({ ...prefs, hw: prefs.hw !== true })}
          ><IconHandwrite /></button>
        </>
      )}

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
