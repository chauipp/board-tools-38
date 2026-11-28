import { Trans, useLingui } from "@lingui/react/macro";
import { MiniMapIcon } from "./icons.jsx";

// Nút phóng/thu, phần trăm zoom và nút bật minimap ở góc dưới phải. Trước là một
// khối JSX trong IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function ZoomControl({ fitToView, miniOpen, setMiniOpen, view, zoomButton }) {
  const { t } = useLingui();
  return (
    <>
      <div className="zoom-ctrl">
        <button onClick={() => zoomButton(1 / 1.2)} title={t`Thu nhỏ`}>−</button>
        <span className="pct mono">{Math.round(view.scale * 100)}%</span>
        <button onClick={() => zoomButton(1.2)} title={t`Phóng to`}>+</button>
        <div className="sep" />
        <button onClick={fitToView} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}><Trans>Vừa khung</Trans></button>
        <div className="sep" />
        <button
          className={miniOpen ? "on" : undefined}
          onClick={() => setMiniOpen((v) => !v)}
          title={miniOpen ? t`Ẩn bản đồ thu nhỏ` : t`Hiện bản đồ thu nhỏ`}
        ><MiniMapIcon /></button>
      </div>
    </>
  );
}
