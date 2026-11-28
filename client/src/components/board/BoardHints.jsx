import { Trans } from "@lingui/react/macro";

// Gợi ý khi board trống và băng báo đang ở chế độ tập trung. Trước là một khối
// JSX trong IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function BoardHints({ board, focusSet, setFocusId }) {
  return (
    <>
      {board.nodes.length === 0 && (
        <div className="empty-hint">
          <Trans>Nhấp đúp vào khoảng trống để tạo ý tưởng đầu tiên.</Trans><br />
          <Trans>Chuột trái kéo để bôi đen chọn thẻ, chuột phải kéo để lia sa bàn, cuộn để lia, giữ Ctrl/⌘ + cuộn để phóng to.</Trans>
        </div>
      )}

      {focusSet != null && (
        <div className="focus-banner">
          <Trans>Đang tập trung — Esc để thoát</Trans>
          <button onClick={() => setFocusId(null)}>×</button>
        </div>
      )}
    </>
  );
}
