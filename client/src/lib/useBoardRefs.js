import { useEffect, useRef } from "react";
import { createDragClickGuard, createMultiClick } from "./multi-click.js";
import { createWheelReader } from "./pointer-input.js";

// Các ref dùng chung của bảng: nút DOM (khung nhìn, canvas, dock, ô tìm), bản
// sao mới nhất của vài state để handler gắn một lần đọc được (thẻ đang sửa,
// socket, lựa chọn, kích thước thẻ), và trạng thái cử chỉ không cần render (bấm
// nhiều lần, giữ Space, laser, nhảy tới thẻ, đo chữ, đọc bánh xe). Trước nằm
// trong IdeaMap.jsx.
export function useBoardRefs({
  frameCardSize, selectedIds, editingId, socket
}) {
  const depsRef = useRef({});

  const treeSizeRef = useRef(frameCardSize);
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const editDockRef = useRef(null);
  const searchInputRef = useRef(null);
  const editingIdRef = useRef(null);
  // socket.id gửi kèm mỗi lần lưu để server loại chính mình khỏi broadcast
  // board:update; updatedAt của lần lưu/nhận gần nhất để so sánh gói đến
  // sau có mới hơn không (useLiveSync.js: isStaleUpdate).
  const socketRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const suppressContextMenuRef = useRef(false);
  const spacePanRef = useRef(false);
  // Cử chỉ bấm nhiều lần lên một nét vẽ (2 lần đổi nét liền ↔ nét đứt). Phần
  // việc nằm ở handleViewportClickCapture bên dưới; hai cái ref phải khai ở đây
  // vì component có nhánh `if (!board) return` ở giữa.
  const multiClickRef = useRef(null);
  const cardDragClickGuardRef = useRef(null);
  const clickAnchorRef = useRef(null);
  // Đang giữ chuột trái ở mode Laser. Ref chứ không state: nó đổi ở mỗi lần bấm
  // và chỉ được đọc trong handler chuột, không có gì trên màn hình phụ thuộc nó.
  const laserDownRef = useRef(false);
  const pendingJumpRef = useRef(null);
  // Ngữ cảnh 2d dùng để đo bề rộng chữ, dựng một lần rồi dùng lại.
  // undefined = chưa dò; null = đã dò và môi trường không có canvas 2d.
  const measureCtxRef = useRef(undefined);
  // Bộ đọc sự kiện wheel có NHỚ: điểm tin cậy "đây là touchpad hay nút lăn"
  // sống qua các sự kiện, nên nó không lật qua lật lại giữa một dòng cuộn. Phải
  // là ref, không phải biến trong effect: effect gắn lại khi board tải xong và
  // khi stopFollow đổi, mà mất trí nhớ giữa dòng cuộn là bảng nhảy giữa lia và
  // phóng ngay dưới ngón tay.
  const wheelReaderRef = useRef(null);
  const workspaceCameraRef = useRef(null);
  treeSizeRef.current = frameCardSize;
  if (!multiClickRef.current) multiClickRef.current = createMultiClick();
  if (!cardDragClickGuardRef.current) cardDragClickGuardRef.current = createDragClickGuard();
  if (!wheelReaderRef.current) wheelReaderRef.current = createWheelReader();
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  return {
    treeSizeRef, viewportRef, canvasRef, editDockRef, searchInputRef, editingIdRef, socketRef, selectedIdsRef, suppressContextMenuRef, spacePanRef, multiClickRef, cardDragClickGuardRef, clickAnchorRef, laserDownRef, pendingJumpRef, measureCtxRef, wheelReaderRef, workspaceCameraRef,
    bind: (d) => { depsRef.current = d; }
  };
}
