import { useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";
import { TREE_DIRECTIONS } from "../lib/tree-layout.js";

// Mũi tên chỉ hướng cây mọc ra. Cùng hình với hàng nút trong menu chuột phải,
// nhưng ở đây là nút BẬT/TẮT (chọn được nhiều hướng một lúc), không phải nút
// bấm-là-chạy.
function ArrowIcon({ rotate }) {
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M10 2 L10 11 M6 7.5 L10 11.5 L14 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const ROTATE = { down: 0, up: 180, right: -90, left: 90 };

const SLIDERS = [
  { key: "depth", min: 20, max: 400 },
  { key: "breadth", min: 8, max: 320 }
];

export default function TreePanel({ opts, count, rootTitle, shifted, locked, onLock, onOpts, onCommit, onReset, onClose, canEdit = true }) {
  const { t } = useLingui();
  // Bấm ra ngoài (hoặc Esc) là đóng, như menu chuột phải và bảng nhãn: bảng này
  // là chỗ ghé vào chỉnh vài nhát rồi đi, không phải một khung thường trực.
  const ref = useRef(null);
  useCloseOnOutside(ref, onClose);

  const DIR_LABEL = {
    down: t`Mọc xuống dưới`,
    up: t`Mọc lên trên`,
    right: t`Mọc sang phải`,
    left: t`Mọc sang trái`
  };
  const SLIDER_LABEL = {
    depth: t`Giữa các cấp`,
    breadth: t`Giữa các card cùng cấp`
  };

  // Bỏ hướng cuối cùng thì cây không còn chỗ nào để mọc, nên hướng đang bật một
  // mình là nút không tắt được — bấm vào chỉ không có gì xảy ra.
  function toggleDir(dir) {
    const on = opts.directions.includes(dir);
    if (on && opts.directions.length === 1) return;
    const next = on
      ? opts.directions.filter((d) => d !== dir)
      : TREE_DIRECTIONS.filter((d) => d === dir || opts.directions.includes(d));
    onOpts({ ...opts, directions: next });
    onCommit();
  }

  return (
    <div className={"tree-panel" + (shifted ? " shifted" : "")} ref={ref} onMouseDown={(e) => e.stopPropagation()}>
      <div className="tp-head">
        <span className="tp-title"><Trans>Xếp cây</Trans></span>
        <button className="op-close" onClick={onClose} title={t`Đóng`}>×</button>
      </div>
      <div className="tp-body">
        {/* Gốc là thứ quyết định cả hình cây mà nó lại nằm ngoài bảng này, nên
            phải nhắc tên ra đây: mở bảng rồi cuộn đi chỗ khác vẫn biết đang
            xếp cây của thẻ nào. */}
        <div className="tp-root">
          <span className="tp-root-name" title={rootTitle}>{rootTitle}</span>
          <span className="tp-count mono">{count}</span>
        </div>

        <div className="tp-section">
          <label className="tp-auto-lock">
            <input type="checkbox" checked={!!locked} disabled={!canEdit} onChange={(e) => onLock(e.target.checked)} />
            <span><Trans>Khóa bố cục tự động</Trans></span>
          </label>
          <div className="tp-hint">
            <Trans>Tự xếp cả cây khi thêm card. Kéo lên card cùng cấp để đổi chỗ nhánh. Tắt để kéo card tự do.</Trans>
          </div>
        </div>

        <div className="tp-section">
          <div className="tp-label"><Trans>Hướng mọc</Trans></div>
          <div className="tp-dirs">
            {TREE_DIRECTIONS.map((dir) => (
              <button
                key={dir}
                type="button"
                disabled={!canEdit}
                className={"tp-dir" + (opts.directions.includes(dir) ? " on" : "")}
                title={DIR_LABEL[dir]}
                onClick={() => toggleDir(dir)}
              ><ArrowIcon rotate={ROTATE[dir]} /></button>
            ))}
          </div>
          <div className="tp-hint">
            {opts.directions.length > 1
              ? <Trans>Các nhánh của gốc chia đều về {opts.directions.length} phía</Trans>
              : <Trans>Chọn thêm hướng để tách cây ra nhiều phía</Trans>}
          </div>
        </div>

        <div className="tp-section">
          <div className="tp-label"><Trans>Khoảng cách</Trans></div>
          {SLIDERS.map(({ key, min, max }) => (
            <div key={key} className="tp-slider">
              <div className="tp-slider-head">
                <span>{SLIDER_LABEL[key]}</span>
                <span className="mono">{opts[key]}</span>
              </div>
              {/* Kéo tới đâu cây nhảy tới đó (onChange → xem trước, chỉ trên máy
                  mình); nhả tay mới lưu và phát cho người khác. */}
              <input
                type="range"
                disabled={!canEdit}
                aria-label={SLIDER_LABEL[key]}
                min={min}
                max={max}
                value={opts[key]}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onOpts({ ...opts, [key]: value, ...(key === "breadth" ? { leaf: value } : {}) });
                }}
                onPointerUp={onCommit}
                onKeyUp={onCommit}
              />
            </div>
          ))}
        </div>

        <button type="button" className="btn ghost small tp-reset" disabled={!canEdit} onClick={onReset}>
          <Trans>Đặt lại</Trans>
        </button>
      </div>
    </div>
  );
}
