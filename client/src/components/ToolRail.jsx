import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { GAME_DESIGN_TYPES } from "../lib/game-design.js";

// Icon là inline SVG, không phải emoji: nó theo được currentColor nên tự đúng ở
// nền sáng và nền tối, cùng cách ColorMenu.jsx đang làm.
function IconCursor() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 3 L4 15 L7.5 11.8 L10 17 L12.2 16 L9.7 11 L14 10.6 Z" fill="currentColor" /></svg>;
}
function IconEdit() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 17 L4 13 L13.5 3.5 L16.5 6.5 L7 16 Z M12.5 4.5 L15.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconPen() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 16 C6 16 6 11 9 11 C12 11 12 15 15 15 C16.5 15 17 14 17 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconEraser() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M7 16 L3.5 12.5 L11 5 L16.5 10.5 L11 16 Z M8 16 L16.5 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconCard() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="5" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M16 6.5 L16 12 M13.3 9.2 L18.7 9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconFrame() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.4" /></svg>;
}
function IconLink() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="5" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="15" cy="15" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6.9 6.9 L13.1 13.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconCapture() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 5.5 L16 5.5 M4 10 L16 10 M4 14.5 L11 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconGameDesign() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 4.5 H17 V15.5 H3 Z M6.5 8 H13.5 M6.5 11 H11" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" /><path d="M15.4 3.1 L16.9 4.6 M16.9 3.1 L15.4 4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
// Chữ "T" vẽ bằng path, KHÔNG dùng ký tự thật: ký tự sẽ đổi hình theo font, và
// ở skin vẽ tay thì nó thành chữ T viết tay — nút công cụ phải đứng yên.
function IconText() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 4.5 L16 4.5 M10 4.5 L10 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconShape() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="2.5" width="10" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="13" cy="13" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
// Chấm sáng toả tia — cùng hình người ta quen thấy trên nút laser của máy chiếu.
function IconLaser() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18">
      <circle cx="10" cy="10" r="2.8" fill="currentColor" />
      <path
        d="M10 1.6 L10 4.2 M10 15.8 L10 18.4 M1.6 10 L4.2 10 M15.8 10 L18.4 10 M4.2 4.2 L6 6 M14 14 L15.8 15.8 M15.8 4.2 L14 6 M6 14 L4.2 15.8"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

export default function ToolRail({
  mode, tool, placeTool, canEdit, linkMode,
  gameDesign, onGameTemplate, onMode, onTool, onPlace, onToggleLink, onCapture
}) {
  const { t } = useLingui();
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  return (
    // Bấm vào thanh không được lọt xuống canvas thành một cú quét chọn. Handler
    // đặt ở đây chứ không ở từng khung: sự kiện từ nút vẫn nổi bọt qua bao ngoài
    // dù bao ngoài trong suốt và không nhận chuột (xem .tool-rail trong CSS).
    <div className="tool-rail" onMouseDown={(e) => e.stopPropagation()}>
      {/* Ba khung rời, không phải một dải dài có kẻ ngăn: chọn mode, tool vẽ, và
          các nút thêm là ba việc khác nhau, nhìn ra ngay đâu là đâu. */}
      {/* Khu 1 — mode */}
      <div className="tool-group">
        <button
          type="button"
          className={"tool-btn" + (mode === "select" ? " on" : "")}
          title={t`Chuột — chọn và di chuyển (V)`}
          onClick={() => onMode("select")}
        ><IconCursor /></button>
        <button
          type="button"
          className={"tool-btn" + (mode === "draw" ? " on" : "")}
          title={t`Sửa — vẽ lên bảng (P)`}
          disabled={!canEdit}
          onClick={() => onMode("draw")}
        ><IconEdit /></button>
        {/* KHÔNG có `disabled={!canEdit}`, khác hai nút vẽ ở khu 2 và mọi nút ở
            khu 3: laser không ghi một chữ nào vào board, nó chỉ là cái que chỉ.
            Người được mời vào chỉ để xem vẫn phải chỉ trỏ được khi họp. */}
        <button
          type="button"
          className={"tool-btn" + (mode === "laser" ? " on" : "")}
          title={t`Laser — chỉ trỏ khi thuyết trình (K)`}
          onClick={() => onMode(mode === "laser" ? "select" : "laser")}
        ><IconLaser /></button>
      </div>

      {/* Khu 2 — tool của mode Sửa. Mode Chuột thì ẩn hẳn, không phải làm mờ:
          mọi thao tác trên bảng khi đó giữ nguyên như trước khi có thanh này. */}
      {mode === "draw" && (
        <div className="tool-group">
          <button
            type="button"
            className={"tool-btn" + (tool === "pen" ? " on" : "")}
            title={t`Bút (P)`}
            disabled={!canEdit}
            onClick={() => onTool("pen")}
          ><IconPen /></button>
          <button
            type="button"
            className={"tool-btn" + (tool === "eraser" ? " on" : "")}
            title={t`Cục gôm (E)`}
            disabled={!canEdit}
            onClick={() => onTool("eraser")}
          ><IconEraser /></button>
          <button
            type="button"
            className={"tool-btn" + (tool === "shape" ? " on" : "")}
            title={t`Hình khối (S)`}
            disabled={!canEdit}
            onClick={() => onTool("shape")}
          ><IconShape /></button>
          <button
            type="button"
            className={"tool-btn" + (tool === "text" ? " on" : "")}
            title={t`Text (T)`}
            disabled={!canEdit}
            onClick={() => onTool("text")}
          ><IconText /></button>
        </div>
      )}

      {/* Khu 3 — thêm. Luôn hiện, kể cả ở mode Sửa.
          Hai nút đầu KHÔNG tạo gì ngay lúc bấm: chúng lên nòng một việc rồi
          chờ người dùng chỉ chỗ trên bảng (bấm để đặt thẻ, tô để vẽ khung). Nên
          chúng có trạng thái sáng như nút tool ở khu 2 — khác ở chỗ làm xong
          MỘT lần là tự hạ nòng về mode Chuột, do IdeaMap lo. */}
      <div className="tool-group">
        <button
          type="button"
          className={"tool-btn" + (placeTool === "node" ? " on" : "")}
          title={t`Thêm ý tưởng — bấm lên bảng để chọn chỗ (N)`}
          disabled={!canEdit}
          onClick={() => onPlace("node")}
        ><IconCard /></button>
        {gameDesign && (
          <div className="tool-gd-wrap">
            <button
              type="button"
              className={"tool-btn" + (gameMenuOpen ? " on" : "")}
              title={t`Thêm thẻ Game Design`}
              disabled={!canEdit}
              onClick={() => setGameMenuOpen((open) => !open)}
            ><IconGameDesign /></button>
            {gameMenuOpen && (
              <div className="tool-gd-menu">
                <div className="tool-gd-title"><Trans>Thêm thẻ Game Design</Trans></div>
                {GAME_DESIGN_TYPES.map((item) => (
                  <button key={item.id} type="button" onClick={() => { onGameTemplate(item.id); setGameMenuOpen(false); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={"tool-btn" + (placeTool === "group" ? " on" : "")}
          title={t`Thêm khung — tô một vùng trên bảng`}
          disabled={!canEdit}
          onClick={() => onPlace("group")}
        ><IconFrame /></button>
        <button
          type="button"
          className={"tool-btn" + (linkMode ? " on" : "")}
          title={t`Nối ý tưởng (L)`}
          disabled={!canEdit}
          onClick={onToggleLink}
        ><IconLink /></button>
        <button type="button" className="tool-btn" title={t`Nhập nhanh`} disabled={!canEdit} onClick={onCapture}><IconCapture /></button>
      </div>
    </div>
  );
}
