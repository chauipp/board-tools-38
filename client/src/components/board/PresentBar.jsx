

// Thanh điều khiển khi trình chiếu theo khung. Trước là một khối JSX trong
// IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function PresentBar({ board, exitPresentation, presentIndex }) {
  return (
    <>
      {presentIndex != null && (() => {
        // Khung có thể bị xoá trong lúc trình chiếu → kẹp chỉ số khi render;
        // nếu xoá hết khung vẫn giữ thanh (0/0) để nút thoát × còn bấm được
        // (bên cạnh Esc).
        const idx = Math.min(presentIndex, Math.max(0, board.groups.length - 1));
        const group = board.groups[idx];
        return (
          <div className="present-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="pb-step mono">{group ? `${idx + 1}/${board.groups.length}` : "0/0"}</span>
            {group && <span className="pb-title">{group.title}</span>}
            <button className="pb-exit" onClick={exitPresentation}>×</button>
          </div>
        );
      })()}
    </>
  );
}
