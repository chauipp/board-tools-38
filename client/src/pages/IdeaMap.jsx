import { useMemo } from "react";
import { useWorkspaceState } from "../lib/useWorkspaceState.js";
import { useParams } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { useTheme } from "../lib/useTheme.js";
import { useSkin } from "../lib/useSkin.js";
import TreePanel from "../components/TreePanel.jsx";
import MiniMap from "../components/MiniMap.jsx";
import LoadError from "../components/LoadError.jsx";
import InviteModal from "../components/InviteModal.jsx";
import ColorMenu from "../components/ColorMenu.jsx";
import FrameBox from "../components/FrameBox.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import ToolRail from "../components/ToolRail.jsx";
import ToolOptions from "../components/ToolOptions.jsx";
import { treeLockOwners } from "../lib/locked-tree.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence } from "../lib/usePresence.js";
import { useLiveSync } from "../lib/useLiveSync.js";
import { useBoardStore } from "../lib/useBoardStore.js";
import { useWorkspaceInspectors } from "../lib/useWorkspaceInspectors.js";
import { useBoardUiState } from "../lib/useBoardUiState.js";
import { useBoardRefs } from "../lib/useBoardRefs.js";
import { useBoardDerived } from "../lib/useBoardDerived.js";
import { useBoardSync } from "../lib/useBoardSync.js";
import { usePresenceSync } from "../lib/usePresenceSync.js";
import { useViewportGestures } from "../lib/useViewportGestures.js";
import { useEdgeLayerHandlers } from "../lib/useEdgeLayerHandlers.js";
import { useBoardImportExport } from "../lib/useBoardImportExport.js";
import { useBoardItemHandlers } from "../lib/useBoardItemHandlers.js";
import { remapId, remapIdSet } from "../lib/rebase.js";
import { useCardSizes } from "../lib/card-sizes.js";
import { useBoardSelection } from "../lib/useBoardSelection.js";
import { useBoardFilters } from "../lib/useBoardFilters.js";
import { useBadgesAndPalette } from "../lib/useBadgesAndPalette.js";
import { useEdgeInteractions } from "../lib/useEdgeInteractions.js";
import { useGroupInteractions } from "../lib/useGroupInteractions.js";
import { useNodeInteractions } from "../lib/useNodeInteractions.js";
import { useNodeMedia } from "../lib/useNodeMedia.js";
import { useDrawingSelection } from "../lib/useDrawingSelection.js";
import { useTextTool } from "../lib/useTextTool.js";
import { useTreeLayout } from "../lib/useTreeLayout.js";
import { usePresentation } from "../lib/usePresentation.js";
import { useGameDesignBoard } from "../lib/useGameDesignBoard.js";
import { useBoardKeyboard } from "../lib/useBoardKeyboard.js";
import { bindAll } from "../lib/bind-all.js";
import { eraseCursorFor } from "../lib/erase-cursor.js";
import { BoardContext } from "../lib/board-context.js";
import { useSelectionActions } from "../lib/useSelectionActions.js";
import { useViewportInput } from "../lib/useViewportInput.js";
import { useCameraControls } from "../lib/useCameraControls.js";
import InkLayer from "../components/InkLayer.jsx";
import { useInkLive } from "../lib/useInkLive.js";
import { useLaser } from "../lib/useLaser.js";
import { PANEL_KEYS } from "../lib/board-constants.js";
import { useCamera } from "../lib/useCamera.js";
import BoardTopBar from "../components/board/BoardTopBar.jsx";
import BoardHudBottom from "../components/board/BoardHudBottom.jsx";
import PresenceIsland from "../components/board/PresenceIsland.jsx";
import HistoryIsland from "../components/board/HistoryIsland.jsx";
import BoardCanvas from "../components/board/BoardCanvas.jsx";
import ZoomControl from "../components/board/ZoomControl.jsx";
import EditDock from "../components/board/EditDock.jsx";
import IoDrawer from "../components/board/IoDrawer.jsx";
import PresentBar from "../components/board/PresentBar.jsx";
import BoardPopovers from "../components/board/BoardPopovers.jsx";
import CaptureOverlay from "../components/board/CaptureOverlay.jsx";
import TreeDock from "../components/board/TreeDock.jsx";
import OutlinePanel from "../components/board/OutlinePanel.jsx";
import MiniMapIsland from "../components/board/MiniMapIsland.jsx";
import BoardHints from "../components/board/BoardHints.jsx";
import ViewportOverlays from "../components/board/ViewportOverlays.jsx";
import "../styles/board/index.css";

export default function IdeaMap() {
  const { user, logout } = useAuth();
  const { boardId } = useParams();
  const workspace = useWorkspaceState(user?.email, boardId);
  const workspaceState = workspace.state;
  // Panel/inspector đang mở, lưu theo trạng thái làm việc riêng từng người — lib/useWorkspaceInspectors.js.
  const inspectors = useWorkspaceInspectors({ workspace, workspaceState });
  const {
    balanceOpen, briefOpen, decisionTimelineOpen, designEditId, flowOpen, handoffOpen, impactCardId, impactOpen, insightsOpen, inspector, miniOpen, outlineOpen, panels, playtestsOpen, reportsOpen, setBalanceOpen, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setMiniOpen, setOutlineOpen, setPanels, setPlaytestsOpen, setReportsOpen, setSnapshotsOpen, setTreeUI, snapshotsOpen, toolsOpen, treeUI, workspaceSetters
  } = inspectors;
  // State giao diện của board (mode, tool, menu, popover, tuỳ chọn bút/laser/cuộn) — lib/useBoardUiState.js.
  const ui = useBoardUiState();
  const {
    editingId, setEditingId, ioOpen, setIoOpen, ioMode, setIoMode, ioText, setIoText, captureOpen, setCaptureOpen, captureText, setCaptureText, isPanning, setIsPanning, dropTargetId, setDropTargetId, mode, setMode, tool, setTool, placeTool, setPlaceTool, penPrefs, setPenPrefs, laserPrefs, setLaserPrefs, wheelMode, setWheelMode, cardLevelPref, setCardLevelPref, snapGuides, setSnapGuides, colorMenu, setColorMenu, hoveredEdgeId, setHoveredEdgeId, commentsFor, setCommentsFor, flashId, setFlashId, spotlightPeerId, setSpotlightPeerId, snapshots, setSnapshots, snapshotsLoading, setSnapshotsLoading, inviteOpen, setInviteOpen, initialCardParam, viewportSize, setViewportSize
  } = ui;
  const { theme, setTheme } = useTheme();
  const { skin, toggle: toggleSkin } = useSkin();
  // Board, role, hàng đợi lưu, lịch sử hoàn tác: lib/useBoardStore.js.
  const store = useBoardStore(boardId);
  const {
    board, setBoard, boardRef, role, roleRef, boardName, setBoardName,
    loadError, saveError, setSaveError, past, future, nudgeTimerRef,
    saveNow, saveDebounced, recordHistory, flushNudgeBurst, undo, redo,
    applyRemoteBoard, restoreSnapshot, lastUpdatedAtRef
  } = store;
  // Camera (pan + zoom): state riêng, KHÔNG nằm trong board — lib/useCamera.js.
  const camera = useCamera();
  const { view, viewRef, setView } = camera;
  // Bộ lọc, tìm kiếm, chế độ tập trung: lib/useBoardFilters.js.
  const filters = useBoardFilters({ board });
  const {
    filterStatus, setFilterStatus, filterTags, setFilterTags, filterFav, setFilterFav,
    search, setSearch, searchOpen, toggleSearch, setSearchOpen, focusId, setFocusId, matchIdx,
    passesFilter, focusSet, matches, activeFilterCount, matchCount, goToMatch, clearFilters
  } = filters;

  const { sendCursor, sendSelection, sendEdgeDraft, sendView, sendFollow, socket } = usePresence(user, boardId);
  const inkLive = useInkLive(socket);
  const laser = useLaser(socket);
  // Kích thước thẻ đo bằng ResizeObserver thay cho querySelector + offsetWidth
  // tại chỗ (xem lib/card-sizes.js). `frameCardSize` giữ nguyên tên cũ vì nó là
  // tham số `sizeOf` của rất nhiều hàm hình học.
  const { cardSize: frameCardSize, observeCard } = useCardSizes();
  // Lựa chọn trên bảng (thẻ, dây, khung, nét vẽ), quét chọn, ?card= trên URL:
  // lib/useBoardSelection.js.
  const selection = useBoardSelection({ board, frameCardSize });
  const {
    selectedIds, setSelectedIds, selectedEdgeIds, setSelectedEdgeIds,
    selectedGroupIds, setSelectedGroupIds, selectedDrawingIds, setSelectedDrawingIds,
    marquee, selectionSet, selBounds, clearSelection, selectionDragSet, handleMarqueeMouseDown
  } = selection;
  // Badge (trạng thái/nhãn), bảng màu, nền bảng; kéo chip/màu thả vào thẻ:
  // lib/useBadgesAndPalette.js.
  const badges = useBadgesAndPalette({
    store, board, role, boardRef, selBounds, setDropTargetId, setFilterStatus, setFilterTags
  });
  const {
    chipDrag, colorDrag, badgeUI, setBadgeUI, paletteUI, setPaletteUI,
    applyChipToNodes, handleChipMouseDown, openBadgeMenu, openBadgeCreate, createBadge, updateBadge, deleteBadge,
    openPaletteEditor, setBoardBg, setBoardGrid, setBoardPack,
    createPaletteColor, updatePaletteColor, deletePaletteColor, handleColorMouseDown
  } = badges;
  // Ref dùng chung giữa các hook và component của board — lib/useBoardRefs.js.
  const refs = useBoardRefs({ frameCardSize, selectedIds, editingId, socket });
  const {
    treeSizeRef, viewportRef, canvasRef, editDockRef, searchInputRef, editingIdRef, socketRef, selectedIdsRef, suppressContextMenuRef, spacePanRef, multiClickRef, cardDragClickGuardRef, clickAnchorRef, laserDownRef, pendingJumpRef, measureCtxRef, wheelReaderRef, workspaceCameraRef
  } = refs;
  const layoutOwners = useMemo(
    () => board ? treeLockOwners(board, frameCardSize) : new Map(),
    [board?.nodes, board?.groups, board?.edges, frameCardSize]
  );

  // Dây nối: chế độ nối, kéo từ connector/đầu dây, menu dây — lib/useEdgeInteractions.js.
  const edgeUI = useEdgeInteractions({ store, board, setSelectedEdgeIds, setDropTargetId, viewRef, viewportRef });
  const {
    linkMode, setLinkMode, pendingSource, setPendingSource, linkDraft, setLinkDraft, edgeMenu, setEdgeMenu, edgeDrag, setEdgeDrag, toggleLinkMode, handleConnectorMouseDown, handleGroupConnectorMouseDown, handleEdgeEndpointMouseDown, toggleEdge, updateEdge, deleteEdge
  } = edgeUI;
  // Khung (nhóm): tạo, kéo, co giãn, tiêu đề, màu, khoá — lib/useGroupInteractions.js.
  const groupUI = useGroupInteractions({
    store, board, boardRef, view, frameCardSize, layoutOwners, selectedIds, selectedGroupIds, selectionDragSet, setBoard, recordHistory, saveNow, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSnapGuides, setColorMenu, spacePanRef
  });
  const {
    placeDraft, editingGroupTitleId, setEditingGroupTitleId, createGroupAt, startPlaceGroup, groupSelectedCards, handleGroupMouseDown, handleGroupResizeMouseDown, saveGroupTitle, deleteGroup, applyGroupColor, toggleGroupLock
  } = groupUI;
  // Bảng Xếp cây, khoá cây, đổi chỗ nhánh trong cây khoá — lib/useTreeLayout.js.
  const treeLayout = useTreeLayout({
    store, board, boardRef, role, roleRef, workspace, treeUI, setTreeUI, frameCardSize, treeSizeRef, layoutOwners, cardDragClickGuardRef, recordHistory, saveNow, setColorMenu
  });
  const {
    treeOpts, treeSwap, treeSwapClickUntilRef, startLockedTreeSwap, treeSwapState, treeArranged, treeOwner, arrangeAsTree, openTreePanel, previewTree, toggleTreeLock, commitTree, closeTreePanel
  } = treeLayout;
  // Thẻ: tạo, nhân bản, kéo, sửa, xoá, màu/hình/bậc, yêu thích, bình luận — lib/useNodeInteractions.js.
  const nodeUI = useNodeInteractions({
    store, board, user, camera, view, setView, viewRef, viewportRef, cardDragClickGuardRef, cardLevelPref, editingId, setEditingId, frameCardSize, layoutOwners, linkMode, pendingSource, setPendingSource, toggleEdge, recordHistory, saveNow, selectedIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, setBoard, setColorMenu, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds, setSnapGuides, spacePanRef
  });
  const {
    createNode, placeNodeAt, duplicateNodes, createLinkedNode, createSiblingNode, deleteNode, saveNodeEdit, saveNodeEditAndNext, handleCardClick, handleNodeMouseDown, duplicateSelection, applyNodeColor, toggleNodeLock, applyNodeShape, applyNodeDashed, applyNodeLevel, toggleFavorite, addComment, deleteComment
  } = nodeUI;
  // Ảnh và PDF trên thẻ: dán, thả, tải lên, co giãn — lib/useNodeMedia.js.
  const media = useNodeMedia({
    store, board, boardId, boardRef, role, roleRef, view, viewRef, viewportRef, selectedIdsRef, setBoard, setSelectedIds, recordHistory, saveNow, handleGroupResizeMouseDown
  });
  const {
    imageFitsBoard, applyImageToNode, createImageNode, handleImageDrop, handleViewportImageDrop, uploadPdfFile, handleImageResizeMouseDown, handlePdfResizeMouseDown, removeNodeImage
  } = media;
  // Trình chiếu theo khung — lib/usePresentation.js.
  const presentation = usePresentation({
    board, view, viewportRef, setBadgeUI, setCaptureOpen, setColorMenu, setCommentsFor, setEdgeMenu, setEditingId, setIoOpen
  });
  const {
    presentIndex, jumpToGroup, startPresentation, stepPresentation, exitPresentation
  } = presentation;
  // Tool chữ: ô nhập, kéo chữ, chốt chữ — lib/useTextTool.js.
  const textUI = useTextTool({ store, board, boardRef, inkLive, penPrefs, skin, tool, measureCtxRef });
  const {
    textEdit, setTextEdit, textDrag, measureTextWidth, handleTextMouseDown, startTextDrag, beginLiveText, commitText
  } = textUI;

  // Điều khiển camera: zoom, vừa khung, nhảy tới thẻ/người, lia, đổi toạ độ — lib/useCameraControls.js.
  const cameraUI = useCameraControls({
    store, board, boardRef, camera, view, setView, viewRef, viewportRef, frameCardSize, saveNow, selectedIds, setSelectedIds, setBoard, setFlashId, setIsPanning, setSpotlightPeerId, suppressContextMenuRef, undo, socket, sendFollow, viewportSize
  });
  const {
    followingId, pendingId, followError, watcherCount, follow, stopFollow,
    setCamera, zoomButton, goToPoint, fitToView, zoomToNodes, zoomToSelection, jumpToCard, jumpToPeer, startPan, clientToCanvas, toCanvasPoint, eventToCanvas
  } = cameraUI;
  // Đo khung nhìn, bánh xe/touchpad, giữ Space để lia, chặn bôi đen, thuộc tính nền/bộ màu trên <html> — lib/useViewportGestures.js.
  useViewportGestures({
    board, boardRef, camera, viewportRef, wheelReaderRef, spacePanRef, searchInputRef, searchOpen, setViewportSize, stopFollow, wheelMode
  });
  // Phát lựa chọn, dây đang kéo và camera (khi có người ghim) cho người khác — lib/usePresenceSync.js.
  usePresenceSync({
    board, view, viewportSize, selectedIds, linkDraft, edgeDrag, watcherCount, sendSelection, sendEdgeDraft, sendView
  });
  // Đồng bộ board ↔ trạng thái làm việc riêng (camera, inspector), tải snapshot, nhảy tới ?card=, xếp lại cây khoá — lib/useBoardSync.js.
  useBoardSync({
    store, board, boardId, boardRef, roleRef, workspace, inspector, view, viewRef, setView, viewportSize, frameCardSize, saveNow, setSaveError, setSelectedIds, setFlashId, setSnapshots, setSnapshotsLoading, snapshotsOpen, pendingJumpRef, workspaceCameraRef, zoomToNodes
  });

  const { geomOverlay, textOverlay, sendLiveText, publishGeom, finishGeom } =
    useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard);
  // Giá trị dẫn xuất từ board để vẽ (vị trí tạm của người khác, tra cứu theo id, đường dây, nét vẽ, minimap) — lib/useBoardDerived.js.
  const derived = useBoardDerived({
    board, frameCardSize, geomOverlay, inkLive, textDrag, selectedIds, selectedGroupIds, selectedDrawingIds
  });
  const {
    liveNodes, liveGroups, nodeById, groupById, edgeRoutes, edgeRoutesRef, statusDefById, tagDefById, paletteStyle, inkDrawings, editShape, miniShapes, movingPayload
  } = derived;

  // Board game-design: thẻ GD, brief/flow/balance, dependency, xuất Markdown/JSON — lib/useGameDesignBoard.js.
  const gameDesign = useGameDesignBoard({
    store, board, boardRef, role, view, boardName, frameCardSize, viewportRef, setDesignEditId
  });
  const {
    dependency, addGameDesignCard, saveDesignNode, createRelatedDesignNode, duplicateDesignNode, saveGameDesignBrief, saveGameDesignFlow, saveGameDesignBalance, exportMarkdown, exportVersionedJson
  } = gameDesign;

  // Nét vẽ / hình / chữ: chốt nét, tẩy, chọn, kéo, tay cầm hình, co giãn vùng chọn, nét đứt — lib/useDrawingSelection.js.
  const drawUI = useDrawingSelection({
    store, board, boardRef, role, mode, tool, setTool, penPrefs, viewRef, viewportRef, inkLive, editShape, layoutOwners, selBounds, selectionSet, selectedIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, clearSelection, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds, setBoard, recordHistory, saveNow, spacePanRef, view, applyImageToNode
  });
  const {
    ink, canGrabShapeHandles, commitStroke, commitErase, swapPenEraser, pickDrawingWhileDrawing, setDrawingsDashed, toggleDrawingDash, dashTargetAt, handleDrawingMouseDown, startDrawingDrag, startSelectionDrag, handleShapeHandleMouseDown, handleSelectionResizeMouseDown, shapeHandleAt, handleInkCaptureMouseDown
  } = drawUI;
  // Thao tác trên cả vùng chọn và menu màu — lib/useSelectionActions.js.
  const selectionUI = useSelectionActions({
    store, board, frameCardSize, layoutOwners, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, clearSelection, chipDrag, colorDrag, dropTargetId, setColorMenu, setCommentsFor, setEdgeMenu, suppressContextMenuRef
  });
  const {
    dropIdsFor, isNodeDropTarget, deleteSelection, applyToSelection, applyColorToSelection, tidySelection, openColorMenu
  } = selectionUI;
  // Chuột trên khung nhìn: mode, Đặt, laser, con trỏ, bấm nhiều lần — lib/useViewportInput.js.
  const viewportInput = useViewportInput({
    board, boardRef, role, mode, setMode, placeTool, setPlaceTool, linkMode, setLinkMode, setPendingSource, view, viewRef, viewportRef, canvasRef, clickAnchorRef, multiClickRef, laserDownRef, spacePanRef, treeSwapClickUntilRef, ink, laser, laserPrefs, selBounds, clearSelection, sendCursor, dashTargetAt, eventToCanvas, handleDrawingMouseDown, handleInkCaptureMouseDown, handleMarqueeMouseDown, placeNodeAt, startPan, startPlaceGroup, startSelectionDrag, toggleDrawingDash
  });
  const {
    handlePresenceMouseMove, entityAtPoint, armPlace, handlePlaceCaptureMouseDown, enterMode, isBoardBackground, handleViewportMouseDownCapture, handleViewportClickCapture, handlePageContextMenu, handleViewportMouseDown, handleLaserMouseDown, handleLaserMouseMove, handleLaserMouseUp
  } = viewportInput;
  // Vỏ handler định danh cố định cho thẻ và khung (React.memo) — lib/useBoardItemHandlers.js.
  const itemHandlers = useBoardItemHandlers({
    cardDragClickGuardRef, deleteGroup, deleteNode, handleCardClick, handleConnectorMouseDown, handleGroupConnectorMouseDown, handleGroupMouseDown, handleGroupResizeMouseDown, handleImageDrop, handleImageResizeMouseDown, handleNodeMouseDown, handlePdfResizeMouseDown, openColorMenu, removeNodeImage, saveGroupTitle, saveNodeEdit, saveNodeEditAndNext, sendLiveText, setColorMenu, setCommentsFor, setEdgeMenu, setEditingGroupTitleId, setEditingId, toggleFavorite
  });
  const {
    cardHandlers, groupHandlers
  } = itemHandlers;

  // Handler định danh ổn định cho lớp dây (hover, bấm chọn, chuột phải mở menu) — lib/useEdgeLayerHandlers.js.
  const edgeLayer = useEdgeLayerHandlers({
    board, setHoveredEdgeId, setColorMenu, setCommentsFor, setEdgeMenu, setDesignEditId, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds
  });
  const {
    onEdgeEnter, onEdgeLeave, onEdgeClick, onEdgeContextMenu
  } = edgeLayer;

  // Những thứ store cần mà khai báo sau board (xem lib/useBoardStore.js).
  store.bind({
    inkLive, treeSizeRef, socketRef, editingIdRef,
    onLoaded: (data) => {
      if (initialCardParam && data.nodes.some((n) => n.id === Number(initialCardParam))) {
        pendingJumpRef.current = Number(initialCardParam);
      }
    },
    onHistoryJump: () => setEditingId(null),
    // Ghép sau 409 đã đổi id của thứ mình vừa tạo (trùng id với người kia):
    // dời thẻ đang sửa và vùng chọn theo id mới.
    onIdsRemapped: (plan) => {
      setEditingId((id) => (id == null ? id : remapId(plan, "nodes", id)));
      setSelectedIds((prev) => remapIdSet(prev, plan, "nodes"));
      setSelectedGroupIds((prev) => remapIdSet(prev, plan, "groups"));
      setSelectedEdgeIds((prev) => remapIdSet(prev, plan, "edges"));
      setSelectedDrawingIds((prev) => remapIdSet(prev, plan, "drawings"));
    }
  });
  // Xuất PNG, nhập JSON, nhập nhanh nhiều ý tưởng, tạo snapshot — lib/useBoardImportExport.js.
  const io = useBoardImportExport({
    store, board, view, setView, viewportRef, frameCardSize, theme, ioText, setIoOpen, captureText, setCaptureText, setCaptureOpen, setFocusId, setPanels, setSnapshots, setSnapshotsOpen
  });
  const {
    openSnapshots, createSnapshot, exportPng, handleImportConfirm, confirmCapture, togglePanel
  } = io;

  // Phím tắt toàn cục và nhích bằng phím mũi tên — lib/useBoardKeyboard.js.
  const keyboard = useBoardKeyboard({
    store, board, boardRef, role, view, mode, tool, setTool, placeTool, setPlaceTool, past, future, undo, redo, saveNow, saveDebounced, flushNudgeBurst, nudgeTimerRef, setBoard, inkLive, laser, editingId, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, clearSelection, linkMode, setLinkMode, setPendingSource, toggleLinkMode, colorMenu, setColorMenu, badgeUI, setBadgeUI, edgeMenu, setEdgeMenu, commentsFor, setCommentsFor, focusId, setFocusId, searchOpen, setSearchOpen, searchInputRef, setCardLevelPref, presentIndex, stepPresentation, exitPresentation, createLinkedNode, createSiblingNode, duplicateSelection, publishGeom, finishGeom
  });
  const {
    nudgeSelection
  } = keyboard;
  // Hàm/ref mà các hook theo miền cần nhưng chỉ có sau khi gọi chúng (lib/bind-all.js).
  bindAll([filters, badges, edgeUI, groupUI, nodeUI, media, presentation, textUI, selection, gameDesign, drawUI, keyboard], {
    jumpToCard, dropIdsFor, clientToCanvas, applyColorToSelection, createLinkedNode, enterMode, entityAtPoint, commitStroke,
    finishGeom, publishGeom, handleNodeMouseDown, startLockedTreeSwap, startPan, toCanvasPoint, setCamera, eventToCanvas,
    movingPayload, viewportRef, viewRef, boardRef, edgeRoutesRef, handleViewportMouseDown, handleTextMouseDown, startTextDrag,
    armPlace, deleteSelection, zoomToSelection
  });

  if (loadError) {
    return <LoadError code={loadError} />;
  }
  if (!board) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></div>;
  }

  const currentUser = user.name;

  // Con trỏ của cục tẩy theo độ rộng — xem lib/erase-cursor.js.
  const eraseCursor = eraseCursorFor({ mode, tool, penPrefs, scale: view.scale });

  // Vùng chọn có ít nhất một thứ ĐỔI ĐƯỢC nét hay không. Không phải cứ
  // `selectedDrawingIds.size >= 1` là đủ: quét trúng đúng một đoạn chữ thì hai
  // nút nét liền/nét đứt hiện ra nhưng bấm vào không có gì xảy ra.
  const hasDashableSelected = (board.drawings || [])
    .some((d) => selectedDrawingIds.has(d.id) && d.kind !== "text");

  const hasNoStatus = board.nodes.some((n) => n.statusId == null);
  const hasNoTag = board.nodes.some((n) => n.tagId == null);

  const anyPanelOn = PANEL_KEYS.some((k) => panels[k]);

  return (
    <BoardContext.Provider value={{ store, selection, camera }}>
    <div className={"shell" + (presentIndex != null ? " presenting" : "") + (role === "viewer" ? " readonly" : "")} style={{ visibility: workspace.ready ? "visible" : "hidden" }} onContextMenu={handlePageContextMenu}>
      {treeSwap && <div className="tree-swap-hint" role="status" style={{ left: Math.max(8, Math.min(treeSwap.x + 16, viewportSize.w - 240)), top: Math.max(8, Math.min(treeSwap.y + 18, viewportSize.h - 64)) }}>
        {treeSwap.target ? <Trans>Thả để đổi chỗ hai nhánh</Trans> : <Trans>Kéo lên card cùng cấp để đổi chỗ · Esc hủy</Trans>}
      </div>}
      {role === "viewer" && (
        <div className="readonly-banner"><Trans>Chỉ xem — bạn không có quyền chỉnh sửa board này.</Trans></div>
      )}
      {/* Khai báo màu tự tạo trong cây React: sửa hex là mọi card/dây/badge dùng
          var(--pal-N) repaint ngay, không cần đi ghi lại từng chỗ tham chiếu. */}
      <style>{paletteStyle}</style>
      <BoardTopBar {...{ activeFilterCount, balanceOpen, briefOpen, clearFilters, decisionTimelineOpen, dependency, exportVersionedJson, flowOpen, goToMatch, handoffOpen, impactOpen, insightsOpen, matchCount, matchIdx, matches, openSnapshots, outlineOpen, playtestsOpen, reportsOpen, search, searchInputRef, searchOpen, setBalanceOpen, setBoardBg, setBoardGrid, setBoardPack, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setIoMode, setIoOpen, setIoText, setOutlineOpen, setPlaytestsOpen, setReportsOpen, setSearch, setTheme, setWheelMode, skin, startPresentation, theme, toggleSearch, toggleSkin, toolsOpen, viewportSize, wheelMode, workspace, workspaceCameraRef }} />

      <BoardHudBottom {...{ anyPanelOn, filterFav, filterStatus, filterTags, handleChipMouseDown, handleColorMouseDown, hasNoStatus, hasNoTag, openBadgeCreate, openBadgeMenu, openPaletteEditor, panels, setFilterFav, setFilterStatus, setFilterTags, togglePanel }} />

      <PresenceIsland {...{ board, follow, followError, followingId, jumpToPeer, logout, pendingId, role, setInviteOpen, socket, stopFollow, user, watcherCount }} />

      <HistoryIsland {...{ future, past, redo, saveError, undo }} />

      <div
        className={"viewport" + (isPanning ? " panning" : "")}
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onMouseDownCapture={handleViewportMouseDownCapture}
        onClickCapture={handleViewportClickCapture}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleViewportImageDrop}
        onMouseMove={handlePresenceMouseMove}
      >
        <ViewportOverlays {...{ addGameDesignCard, armPlace, cardLevelPref, commitText, enterMode, eraseCursor, gameDesign, handleInkCaptureMouseDown, handleLaserMouseDown, handleLaserMouseMove, handleLaserMouseUp, handlePlaceCaptureMouseDown, ink, inkLive, laser, laserPrefs, linkMode, measureTextWidth, mode, penPrefs, placeTool, setCaptureOpen, setCardLevelPref, setLaserPrefs, setPenPrefs, setTextEdit, setTool, textEdit, toggleLinkMode, tool }} />
        <BoardCanvas {...{ boardId, canGrabShapeHandles, canvasRef, cardHandlers, currentUser, dependency, dropTargetId, edgeDrag, edgeRoutes, editShape, editingGroupTitleId, editingId, flashId, focusSet, frameCardSize, gameDesign, groupById, groupHandlers, handleEdgeEndpointMouseDown, handleInkCaptureMouseDown, handleSelectionResizeMouseDown, handleShapeHandleMouseDown, handleViewportMouseDown, hoveredEdgeId, ink, inkDrawings, inkLive, isNodeDropTarget, laser, layoutOwners, linkDraft, linkMode, liveGroups, liveNodes, mode, nodeById, observeCard, onEdgeClick, onEdgeContextMenu, onEdgeEnter, onEdgeLeave, passesFilter, pendingSource, placeDraft, setDesignEditId, setHoveredEdgeId, shapeHandleAt, skin, snapGuides, socket, spotlightPeerId, statusDefById, tagDefById, textEdit, textOverlay, tool, treeSwapState }} />

        <BoardHints {...{ board, focusSet, setFocusId }} />

        <MiniMapIsland {...{ camera, goToPoint, miniOpen, miniShapes, setMiniOpen, view, viewportSize }} />

        <ZoomControl {...{ fitToView, miniOpen, setMiniOpen, view, zoomButton }} />

        <OutlinePanel {...{ board, exportMarkdown, exportPng, frameCardSize, jumpToCard, jumpToGroup, nodeById, outlineOpen, setOutlineOpen }} />

        <TreeDock {...{ board, closeTreePanel, commitTree, outlineOpen, previewTree, role, toggleTreeLock, treeOpts, treeUI }} />

        <EditDock {...{ applyColorToSelection, applyToSelection, balanceOpen, briefOpen, createRelatedDesignNode, createSnapshot, decisionTimelineOpen, deleteEdge, deleteSelection, dependency, designEditId, duplicateDesignNode, duplicateSelection, editDockRef, flowOpen, groupSelectedCards, handoffOpen, hasDashableSelected, impactCardId, impactOpen, insightsOpen, inspector, playtestsOpen, reportsOpen, saveDesignNode, saveGameDesignBalance, saveGameDesignBrief, saveGameDesignFlow, setBalanceOpen, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setDrawingsDashed, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setPlaytestsOpen, setReportsOpen, setSnapshotsOpen, snapshots, snapshotsLoading, snapshotsOpen, tidySelection, treeUI, updateEdge }} />

        <IoDrawer {...{ handleImportConfirm, ioMode, ioOpen, ioText, setIoOpen, setIoText }} />

      </div>

      <PresentBar {...{ board, exitPresentation, presentIndex }} />

      <BoardPopovers {...{ addComment, applyColorToSelection, applyGroupColor, applyNodeColor, applyNodeDashed, applyNodeLevel, applyNodeShape, applyToSelection, arrangeAsTree, badgeUI, chipDrag, colorDrag, colorMenu, commentsFor, createBadge, createPaletteColor, deleteBadge, deleteComment, deleteEdge, deleteGroup, deleteNode, deletePaletteColor, deleteSelection, dropIdsFor, dropTargetId, duplicateNodes, duplicateSelection, edgeMenu, groupSelectedCards, openTreePanel, paletteUI, setBadgeUI, setColorMenu, setCommentsFor, setEdgeMenu, setEditingId, setFocusId, setPaletteUI, tidySelection, toggleGroupLock, toggleNodeLock, updateBadge, updateEdge, updatePaletteColor }} />
      <CaptureOverlay {...{ captureOpen, captureText, confirmCapture, setCaptureOpen, setCaptureText }} />

      {inviteOpen && role === "owner" && (
        <InviteModal boardId={boardId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
    </BoardContext.Provider>
  );
}

