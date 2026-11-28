import { useEffect, useLayoutEffect } from "react";
import { cameraToCenter, centerToCamera } from "./workspace-state.js";
import { listBoardSnapshots } from "./api.js";
import { arrangeLockedTrees } from "./locked-tree.js";

// Các effect giữ board khớp với những thứ bên ngoài nó: khôi phục và ghi camera
// vào trạng thái làm việc riêng (useWorkspaceState), đóng inspector đang trỏ vào
// thứ không còn tồn tại, tải danh sách snapshot khi mở bảng snapshot, nhảy tới
// thẻ trong ?card= sau khi tải xong, và xếp lại các cây khoá khi kích thước thẻ
// đổi. Trước nằm trong IdeaMap.jsx.
export function useBoardSync({
  store, board, boardId, boardRef, roleRef, workspace, inspector, view, viewRef, setView, viewportSize, frameCardSize, saveNow, setSaveError, setSelectedIds, setFlashId, setSnapshots, setSnapshotsLoading, snapshotsOpen, pendingJumpRef, workspaceCameraRef, zoomToNodes
}) {

  useLayoutEffect(() => {
    if (!workspace.ready || !board || !viewportSize.w || !viewportSize.h) return;
    const previous = workspaceCameraRef.current;
    if (previous?.controller === workspace.controller && previous.hydration === workspace.hydration && previous.w === viewportSize.w && previous.h === viewportSize.h) return;
    const camera = previous?.controller === workspace.controller && previous.hydration === workspace.hydration
      ? cameraToCenter(viewRef.current, previous)
      : workspace.state.camera;
    const view = camera ? centerToCamera(camera, viewportSize) : { panX: 0, panY: 0, scale: 1 };
    workspaceCameraRef.current = { controller: workspace.controller, hydration: workspace.hydration, ...viewportSize, applying: view };
    setView(view);
  }, [workspace.ready, workspace.hydration, workspace.controller, viewportSize, board != null]);

  useEffect(() => {
    const applied = workspaceCameraRef.current;
    if (!workspace.ready || !board || applied?.controller !== workspace.controller) return;
    if (applied.applying) {
      if (applied.applying === view) applied.applying = null;
      return;
    }
    workspace.update({ camera: cameraToCenter(view, viewportSize) });
  }, [view, board != null, workspace.ready, workspace.controller, viewportSize]);

  useEffect(() => {
    if (!workspace.ready || !board || !inspector) return;
    const valid = inspector.type === "tree"
      ? (inspector.kind === "group" ? board.groups : board.nodes).some((item) => item.id === inspector.id)
      : inspector.type === "design" ? board.kind === "game-design" && board.nodes.some((item) => item.id === inspector.id)
      : inspector.type === "snapshots" || board.kind === "game-design";
    if (!valid) workspace.update({ inspector: null });
  }, [workspace.ready, workspace.controller, inspector, board?.nodes, board?.groups, board?.kind]);

  useEffect(() => {
    if (!snapshotsOpen) return;
    let cancelled = false;
    setSnapshotsLoading(true);
    listBoardSnapshots(boardId).then((result) => { if (!cancelled) setSnapshots(result.snapshots || []); })
      .catch(() => { if (!cancelled) setSaveError(true); }).finally(() => { if (!cancelled) setSnapshotsLoading(false); });
    return () => { cancelled = true; };
  }, [snapshotsOpen, boardId]);

  useEffect(() => {
    if (!workspace.ready || !board || pendingJumpRef.current == null) return;
    const id = pendingJumpRef.current;
    pendingJumpRef.current = null;
    setSelectedIds(new Set([id]));
    setFlashId(id);
    zoomToNodes([id]);
    setTimeout(() => setFlashId(null), 1600);
  }, [board != null, workspace.ready]);

  useEffect(() => {
    const current = boardRef.current;
    if (!current || roleRef.current === "viewer") return;
    const next = arrangeLockedTrees(current, frameCardSize);
    if (next === current) return;
    store.preview(next);
    saveNow(next);
  }, [frameCardSize]);

}
