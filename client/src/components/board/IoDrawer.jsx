import { Trans } from "@lingui/react/macro";

// Ngăn kéo Xuất/Nhập JSON. Trước là một khối JSX trong IdeaMap.jsx; cây DOM và
// class giữ nguyên.
export default function IoDrawer({ handleImportConfirm, ioMode, ioOpen, ioText, setIoOpen, setIoText }) {
  return (
    <>
      {ioOpen && (
        <div className="io-drawer">
          <div className="note">
            {ioMode === "export"
              ? <Trans>JSON hiện tại — copy để sao lưu hoặc gửi cho người khác xem.</Trans>
              : <Trans>Dán JSON đã xuất trước đó, rồi bấm Nhập vào bản đồ.</Trans>}
          </div>
          <textarea spellCheck={false} value={ioText} onChange={(e) => setIoText(e.target.value)} />
          <div className="io-actions">
            {ioMode === "import" && <button className="btn small" onClick={handleImportConfirm}><Trans>Nhập vào bản đồ</Trans></button>}
            <button className="btn ghost small" onClick={() => setIoOpen(false)}><Trans>Đóng</Trans></button>
          </div>
        </div>
      )}
    </>
  );
}
