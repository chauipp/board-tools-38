import MiniMap from "../MiniMap.jsx";

// Minimap — đảo riêng ngay trên nút zoom. Trước là một khối JSX trong
// IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function MiniMapIsland({ camera, goToPoint, miniOpen, miniShapes, setMiniOpen, view, viewportSize }) {
  return (
    <>
      {/* Minimap là một đảo riêng NGAY TRÊN nút zoom, không nhét vào trong nó:
          hai thứ cùng là "chuyện camera" nên đứng cạnh nhau, nhưng một cái là
          hàng nút cao 30px còn cái kia là một mảng 120px. */}
      {miniOpen && miniShapes && viewportSize.w > 0 && (
        <MiniMap
          shapes={miniShapes}
          view={view}
          viewportSize={viewportSize}
          onGoTo={goToPoint}
          onClose={() => setMiniOpen(false)}
        />
      )}
    </>
  );
}
