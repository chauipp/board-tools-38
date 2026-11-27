import { useRef, useState } from "react";
import { computeZoom } from "./camera.js";

// Camera mặc định khi vừa mở board, trước khi trạng thái làm việc riêng
// (useWorkspaceState) khôi phục chỗ người dùng đứng nhìn lần trước.
export const DEFAULT_VIEW = { panX: 0, panY: 0, scale: 1 };

// Camera (pan + zoom) của bảng — state RIÊNG, không nằm trong board.
//
// Trước đây nó là `board.view`: mỗi nhịp lia bảng đổi định danh `board`, kéo
// theo mọi useMemo/React.memo theo board tính lại; hoàn tác phải "giữ view" để
// màn hình không nhảy; lưu phải tách view ra trước khi gửi. Tách ra thì cả ba
// chuyện đó biến mất: board chỉ còn nội dung, camera là của riêng từng người.
//
// `viewRef` gán ngay trong lúc render (cùng lý do với boardRef): handler gắn
// vào window đọc nó để biết camera MỚI NHẤT.
export function useCamera() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Phóng/thu quanh một điểm màn hình.
  function zoomAt(rect, screenX, screenY, factor) {
    setView((prev) => computeZoom(prev, rect, screenX, screenY, factor));
  }

  // Lia một đoạn theo pixel màn hình.
  function panBy(dx, dy) {
    setView((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
  }

  return { view, viewRef, setView, zoomAt, panBy };
}
