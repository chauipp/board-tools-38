import { useEffect, useRef, useState } from "react";
import { MIN_SCALE, MAX_SCALE } from "./board-constants.js";

// Trình chiếu: lần lượt nhảy camera tới từng khung, đóng mọi popover lúc bắt
// đầu, đánh dấu body.presenting, và trả camera về chỗ cũ khi thoát. Trước nằm
// trong IdeaMap.jsx. setCamera gắn qua bind() mỗi lượt render.
export function usePresentation({
  board, view, viewportRef, setBadgeUI, setCaptureOpen, setColorMenu, setCommentsFor, setEdgeMenu, setEditingId, setIoOpen
}) {
  const depsRef = useRef({});
  const setCamera = (...a) => depsRef.current.setCamera(...a);

  const [presentIndex, setPresentIndex] = useState(null); // null = không trình chiếu
  const prePresentViewRef = useRef(null);
  // Chip danh tính được render ở AuthGate, ngoài `.shell`, nên selector
  // `.shell.presenting` không với tới được. Đánh dấu trên body để ẩn nó khi
  // trình chiếu, giống mọi thứ chrome khác của board.
  useEffect(() => {
    document.body.classList.toggle("presenting", presentIndex != null);
    return () => document.body.classList.remove("presenting");
  }, [presentIndex]);

  function jumpToGroup(group) {
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = group.w + pad * 2, bboxH = group.h + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(group.x - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(group.y - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function startPresentation() {
    if (board.groups.length === 0) return;
    // Đóng mọi UI tạm thời trước khi trình chiếu — CSS chỉ ẩn được chrome cố
    // định, còn popover/modal đang mở phải đóng bằng state.
    setColorMenu(null);
    setEdgeMenu(null);
    setBadgeUI(null);
    setCommentsFor(null);
    setEditingId(null);
    setIoOpen(false);
    setCaptureOpen(false);
    prePresentViewRef.current = view;
    setPresentIndex(0);
    jumpToGroup(board.groups[0]);
  }

  // Đọc thẳng `presentIndex` từ state (đã nằm trong deps của effect keydown)
  // thay vì dùng setState updater: jumpToGroup tự setState + lưu, không được
  // gọi bên trong updater (side effect trong updater bị cấm).
  function stepPresentation(delta) {
    if (board.groups.length === 0) { exitPresentation(); return; }
    // Khung có thể bị xoá giữa chừng (canvas vẫn tương tác được) → kẹp lại
    // chỉ số hiện tại trước khi bước.
    const current = Math.min(presentIndex, board.groups.length - 1);
    const next = Math.min(board.groups.length - 1, Math.max(0, current + delta));
    if (next !== presentIndex) {
      setPresentIndex(next);
      jumpToGroup(board.groups[next]);
    }
  }

  function exitPresentation() {
    setPresentIndex(null);
    if (prePresentViewRef.current) {
      setCamera(prePresentViewRef.current);
      prePresentViewRef.current = null;
    }
  }

  return {
    presentIndex, jumpToGroup, startPresentation, stepPresentation, exitPresentation,
    bind: (d) => { depsRef.current = d; }
  };
}
