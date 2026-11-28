import { useEffect } from "react";

// Những gì phát cho người khác trong phòng qua kênh presence: tập thẻ đang chọn,
// dây đang kéo dở (nối mới hoặc dời đầu dây), và camera của mình — chỉ khi có
// người đang ghim màn hình mình. Trước nằm trong IdeaMap.jsx.
export function usePresenceSync({
  board, view, viewportSize, selectedIds, linkDraft, edgeDrag, watcherCount, sendSelection, sendEdgeDraft, sendView
}) {

  useEffect(() => { sendSelection(Array.from(selectedIds)); }, [selectedIds, sendSelection]);

  useEffect(() => {
    const draft = linkDraft
      ? { fromKind: linkDraft.fromKind || "node", fromId: linkDraft.fromId, x: linkDraft.x, y: linkDraft.y }
      : edgeDrag
      ? { fromKind: edgeDrag.fixedKind, fromId: edgeDrag.fixedId, x: edgeDrag.x, y: edgeDrag.y }
      : null;
    sendEdgeDraft(draft);
  }, [linkDraft, edgeDrag, sendEdgeDraft]);

  // Chỉ phát camera khi THỰC SỰ có người đang xem. Ghim là tính năng dùng theo
  // đợt (lúc họp), nên mặc định phải là im lặng tuyệt đối: không ai ghim thì
  // không một gói nào rời máy, dù người dùng có cuộn cả buổi.
  useEffect(() => {
    if (!board || watcherCount === 0) return;
    // Kích thước khung nhìn đi kèm camera, vì người xem cần biết mình đang thấy
    // VÙNG nào chứ không phải pan/zoom bao nhiêu — hai màn hình khác cỡ thì hai
    // con số đó nghĩa khác nhau (lib/follow.js).
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return;
    sendView({
      panX: view.panX, panY: view.panY, scale: view.scale,
      w: viewportSize.w, h: viewportSize.h
    });
  }, [view, viewportSize, watcherCount, sendView]); // eslint-disable-line react-hooks/exhaustive-deps

}
