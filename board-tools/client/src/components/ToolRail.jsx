import { useLingui } from "@lingui/react/macro";

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
function IconShape() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="2.5" width="10" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="13" cy="13" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

export default function ToolRail({
  mode, tool, placeTool, canEdit, linkMode,
  onMode, onTool, onPlace, onToggleLink, onCapture
}) {
  const { t } = useLingui();
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
