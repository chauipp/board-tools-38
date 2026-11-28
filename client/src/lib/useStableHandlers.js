import { useRef } from "react";

// Một object hàm có định danh CỐ ĐỊNH suốt đời component, mỗi khoá gọi xuyên tới
// bản mới nhất của hàm tương ứng.
//
// Vì sao cần: React.memo trên IdeaCard/FrameBox/EdgeLayer chỉ có tác dụng khi
// prop hàm giữ nguyên định danh giữa các lần render. Các hàm xử lý thật thì
// được định nghĩa lại ở mỗi lần render (chúng đóng gói `board`, `selectedIds`
// …), nên ta cất bản mới nhất vào một ref và đưa component một lớp vỏ bất biến
// gọi xuyên qua ref. Không có lớp vỏ này, kéo MỘT thẻ vẫn dựng lại toàn bộ thẻ,
// khung và dây trên bảng ở từng khung hình. Trước đây IdeaMap tự viết cơ chế này
// bằng tay (actionsRef + hai useMemo).
//
// Tập khoá chốt ở lần render đầu; truyền thêm khoá mới về sau sẽ không có vỏ.
export function stableHandlersFor(latestRef) {
  const shell = {};
  for (const key of Object.keys(latestRef.current)) {
    shell[key] = (...args) => latestRef.current[key](...args);
  }
  return shell;
}

export function useStableHandlers(handlers) {
  const latestRef = useRef(handlers);
  latestRef.current = handlers;
  const shellRef = useRef(null);
  if (!shellRef.current) shellRef.current = stableHandlersFor(latestRef);
  return shellRef.current;
}
