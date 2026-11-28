import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceState } from "../lib/useWorkspaceState.js";
import { useParams } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { useTheme } from "../lib/useTheme.js";
import { useSkin } from "../lib/useSkin.js";
import { textLines, textBox, TEXT_LINE_H } from "../lib/text-el.js";
import TreePanel from "../components/TreePanel.jsx";
import MiniMap from "../components/MiniMap.jsx";
import LoadError from "../components/LoadError.jsx";
import InviteModal from "../components/InviteModal.jsx";
import ColorMenu from "../components/ColorMenu.jsx";
import FrameBox from "../components/FrameBox.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import ToolRail from "../components/ToolRail.jsx";
import ToolOptions from "../components/ToolOptions.jsx";
import { buildOutline } from "../lib/outline.js";
import { gridLayout } from "../lib/layout.js";
import { buildTree, edgeKey } from "../lib/tree-layout.js";
import { treeLockOwners } from "../lib/locked-tree.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence } from "../lib/usePresence.js";
import { useFollow } from "../lib/useFollow.js";
import { useLiveSync } from "../lib/useLiveSync.js";
import { useBoardStore } from "../lib/useBoardStore.js";
import { useWorkspaceInspectors } from "../lib/useWorkspaceInspectors.js";
import { useBoardUiState } from "../lib/useBoardUiState.js";
import { useBoardRefs } from "../lib/useBoardRefs.js";
import { useBoardDerived } from "../lib/useBoardDerived.js";
import { useBoardSync } from "../lib/useBoardSync.js";
import { usePresenceSync } from "../lib/usePresenceSync.js";
import { useViewportGestures } from "../lib/useViewportGestures.js";
import { remapId, remapIdSet } from "../lib/rebase.js";
import { useCardSizes } from "../lib/card-sizes.js";
import { startDrag } from "../lib/drag-session.js";
import { toggleId } from "../lib/selection.js";
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
import { useStableHandlers } from "../lib/useStableHandlers.js";
import { BoardContext } from "../lib/board-context.js";
import { useSelectionActions } from "../lib/useSelectionActions.js";
import { useViewportInput } from "../lib/useViewportInput.js";
import { useCameraControls } from "../lib/useCameraControls.js";
import { drawBoardToCanvas } from "../lib/png-export.js";
import { ERASE_PART } from "../lib/erase.js";
import InkLayer from "../components/InkLayer.jsx";
import { useInk } from "../lib/useInk.js";
import { useInkLive } from "../lib/useInkLive.js";
import { useLaser } from "../lib/useLaser.js";
import { CARD_W, SEL_GRAB_PAD, PICK_RADIUS, MIN_SCALE, PANEL_KEYS, TREE_OPTS, EMPTY_ARRAY, EMPTY_MAP, EMPTY_SET, MAX_SCALE } from "../lib/board-constants.js";
import { useCamera } from "../lib/useCamera.js";
import { normalizeGameDesignBoard } from "../lib/normalize-board.js";
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
  const inspectors = useWorkspaceInspectors({
    workspace, workspaceState
  });
  const {
    balanceOpen, briefOpen, decisionTimelineOpen, designEditId, flowOpen, handoffOpen, impactCardId, impactOpen, insightsOpen, inspector, miniOpen, outlineOpen, panels, playtestsOpen, reportsOpen, setBalanceOpen, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setMiniOpen, setOutlineOpen, setPanels, setPlaytestsOpen, setReportsOpen, setSnapshotsOpen, setTreeUI, snapshotsOpen, toolsOpen, treeUI, workspaceSetters
  } = inspectors;
  // State giao diện của board (mode, tool, menu, popover, tuỳ chọn bút/laser/cuộn) — lib/useBoardUiState.js.
  const ui = useBoardUiState({
    
  });
  const {
    editingId, setEditingId, ioOpen, setIoOpen, ioMode, setIoMode, ioText, setIoText, captureOpen, setCaptureOpen, captureText, setCaptureText, isPanning, setIsPanning, dropTargetId, setDropTargetId, mode, setMode, tool, setTool, placeTool, setPlaceTool, penPrefs, setPenPrefs, laserPrefs, setLaserPrefs, wheelMode, setWheelMode, cardLevelPref, setCardLevelPref, snapGuides, setSnapGuides, colorMenu, setColorMenu, hoveredEdgeId, setHoveredEdgeId, commentsFor, setCommentsFor, flashId, setFlashId, spotlightPeerId, setSpotlightPeerId, snapshots, setSnapshots, snapshotsLoading, setSnapshotsLoading, inviteOpen, setInviteOpen, initialCardParam, viewportSize, setViewportSize
  } = ui;
  const { theme, setTheme } = useTheme();
  const { skin, toggle: toggleSkin } = useSkin();
  const { t } = useLingui();
  // Tên preset nằm ở đây chứ không ở lib/board-theme.js: module đó là dữ liệu
  // thuần, test bằng node:test, không kéo được `t` của lingui vào.
  const BG_LABEL = {
    paper: t`Giấy kraft`, white: t`Trắng`, slate: t`Xám đá`,
    mint: t`Bạc hà`, blush: t`Hồng phấn`, sky: t`Xanh trời`,
    sand: t`Cát`, lavender: t`Oải hương`, blueprint: t`Bản vẽ`
  };
  const GRID_LABEL = {
    dots: t`Lưới chấm`, lines: t`Lưới ô`, plain: t`Không lưới`
  };
  const PACK_LABEL = {
    pastel: t`Pastel`, vivid: t`Rực`, mono: t`Đơn sắc`,
    earth: t`Đất`, neon: t`Neon`
  };
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
  filters.bind({ jumpToCard: (id) => jumpToCard(id) });

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
  badges.bind({
    dropIdsFor: (...a) => dropIdsFor(...a),
    clientToCanvas: (...a) => clientToCanvas(...a),
    applyColorToSelection: (...a) => applyColorToSelection(...a)
  });
  // Ref dùng chung giữa các hook và component của board — lib/useBoardRefs.js.
  const refs = useBoardRefs({
    frameCardSize, selectedIds, editingId, socket
  });
  const {
    treeSizeRef, viewportRef, canvasRef, editDockRef, searchInputRef, editingIdRef, socketRef, selectedIdsRef, suppressContextMenuRef, spacePanRef, multiClickRef, cardDragClickGuardRef, clickAnchorRef, laserDownRef, pendingJumpRef, measureCtxRef, wheelReaderRef, workspaceCameraRef
  } = refs;
  const layoutOwners = useMemo(
    () => board ? treeLockOwners(board, frameCardSize) : new Map(),
    [board?.nodes, board?.groups, board?.edges, frameCardSize]
  );

  // Dây nối: chế độ nối, kéo từ connector/đầu dây, menu dây — lib/useEdgeInteractions.js.
  const edgeUI = useEdgeInteractions({
    store, board, setSelectedEdgeIds, setDropTargetId, viewRef, viewportRef
  });
  const {
    linkMode, setLinkMode, pendingSource, setPendingSource, linkDraft, setLinkDraft, edgeMenu, setEdgeMenu, edgeDrag, setEdgeDrag, toggleLinkMode, handleConnectorMouseDown, handleGroupConnectorMouseDown, handleEdgeEndpointMouseDown, toggleEdge, updateEdge, deleteEdge
  } = edgeUI;
  edgeUI.bind({
    createLinkedNode: (...a) => createLinkedNode(...a),
    enterMode: (...a) => enterMode(...a),
    entityAtPoint: (...a) => entityAtPoint(...a)
  });
  // Khung (nhóm): tạo, kéo, co giãn, tiêu đề, màu, khoá — lib/useGroupInteractions.js.
  const groupUI = useGroupInteractions({
    store, board, boardRef, view, frameCardSize, layoutOwners, selectedIds, selectedGroupIds, selectionDragSet, setBoard, recordHistory, saveNow, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSnapGuides, setColorMenu, spacePanRef
  });
  const {
    placeDraft, editingGroupTitleId, setEditingGroupTitleId, createGroupAt, startPlaceGroup, groupSelectedCards, handleGroupMouseDown, handleGroupResizeMouseDown, saveGroupTitle, deleteGroup, applyGroupColor, toggleGroupLock
  } = groupUI;
  groupUI.bind({
    commitStroke: (...a) => commitStroke(...a),
    enterMode: (...a) => enterMode(...a),
    finishGeom: (...a) => finishGeom(...a),
    publishGeom: (...a) => publishGeom(...a),
    handleNodeMouseDown: (...a) => handleNodeMouseDown(...a),
    startLockedTreeSwap: (...a) => startLockedTreeSwap(...a),
    startPan: (...a) => startPan(...a),
    toCanvasPoint: (...a) => toCanvasPoint(...a)
  });
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
  nodeUI.bind({
    enterMode: (...a) => enterMode(...a),
    finishGeom: (...a) => finishGeom(...a),
    publishGeom: (...a) => publishGeom(...a),
    startLockedTreeSwap: (...a) => startLockedTreeSwap(...a),
    startPan: (...a) => startPan(...a),
    toCanvasPoint: (...a) => toCanvasPoint(...a)
  });
  // Ảnh và PDF trên thẻ: dán, thả, tải lên, co giãn — lib/useNodeMedia.js.
  const media = useNodeMedia({
    store, board, boardId, boardRef, role, roleRef, view, viewRef, viewportRef, selectedIdsRef, setBoard, setSelectedIds, recordHistory, saveNow, handleGroupResizeMouseDown
  });
  const {
    imageFitsBoard, applyImageToNode, createImageNode, handleImageDrop, handleViewportImageDrop, uploadPdfFile, handleImageResizeMouseDown, handlePdfResizeMouseDown, removeNodeImage
  } = media;
  media.bind({
    finishGeom: (...a) => finishGeom(...a),
    publishGeom: (...a) => publishGeom(...a)
  });
  // Trình chiếu theo khung — lib/usePresentation.js.
  const presentation = usePresentation({
    board, view, viewportRef, setBadgeUI, setCaptureOpen, setColorMenu, setCommentsFor, setEdgeMenu, setEditingId, setIoOpen
  });
  const {
    presentIndex, jumpToGroup, startPresentation, stepPresentation, exitPresentation
  } = presentation;
  presentation.bind({
    setCamera: (...a) => setCamera(...a)
  });
  // Tool chữ: ô nhập, kéo chữ, chốt chữ — lib/useTextTool.js.
  const textUI = useTextTool({
    store, board, boardRef, inkLive, penPrefs, skin, tool, measureCtxRef
  });
  const {
    textEdit, setTextEdit, textDrag, measureTextWidth, handleTextMouseDown, startTextDrag, beginLiveText, commitText
  } = textUI;
  textUI.bind({
    commitStroke: (...a) => commitStroke(...a),
    eventToCanvas: (...a) => eventToCanvas(...a),
    movingPayload: (...a) => movingPayload(...a)
  });

  const ink = useInk({
    tool, penPrefs, boardRef, viewRef, viewportRef,
    // Gọi trễ qua drawUI: hook nét vẽ cần `ink` nên được gọi SAU useInk.
    onStrokeDone: (...a) => drawUI.commitStroke(...a),
    onEraseDone: (...a) => drawUI.commitErase(...a),
    onPick: (...a) => drawUI.pickDrawingWhileDrawing(...a),
    onSwapTool: (...a) => drawUI.swapPenEraser(...a),
    live: inkLive
  });

  // Đường ghi camera dành RIÊNG cho vòng bám khi ghim màn hình. Cố ý không đi
  // qua setCamera: setCamera là "người dùng chủ động đổi camera" nên nó huỷ
  // ghim, mà vòng bám cũng đổi camera — dùng chung một cửa thì vòng bám tự huỷ
  // mình ngay khung hình đầu tiên.
  const applyFollowCamera = useCallback((view) => {
    if (!boardRef.current) return;
    setView((prev) => ({ ...prev, ...view }));
  }, []);

  const { followingId, pendingId, followError, watcherCount, follow, stopFollow } = useFollow({
    socket, sendFollow, viewportSize,
    applyCamera: applyFollowCamera,
    minScale: MIN_SCALE, maxScale: MAX_SCALE
  });
  // Điều khiển camera: zoom, vừa khung, nhảy tới thẻ/người, lia, đổi toạ độ — lib/useCameraControls.js.
  const cameraUI = useCameraControls({
    store, board, boardRef, camera, view, setView, viewRef, viewportRef, frameCardSize, saveNow, selectedIds, setSelectedIds, setBoard, setFlashId, setIsPanning, setSpotlightPeerId, stopFollow, suppressContextMenuRef, undo, applyFollowCamera
  });
  const {
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

  selection.bind({ viewportRef, viewRef, boardRef, edgeRoutesRef });
  // Board game-design: thẻ GD, brief/flow/balance, dependency, xuất Markdown/JSON — lib/useGameDesignBoard.js.
  const gameDesign = useGameDesignBoard({
    store, board, boardRef, role, view, boardName, frameCardSize, viewportRef, setDesignEditId
  });
  const {
    dependency, addGameDesignCard, saveDesignNode, createRelatedDesignNode, duplicateDesignNode, saveGameDesignBrief, saveGameDesignFlow, saveGameDesignBalance, exportMarkdown, exportVersionedJson
  } = gameDesign;
  gameDesign.bind({
    toCanvasPoint: (...a) => toCanvasPoint(...a)
  });

  // Nét vẽ / hình / chữ: chốt nét, tẩy, chọn, kéo, tay cầm hình, co giãn vùng chọn, nét đứt — lib/useDrawingSelection.js.
  const drawUI = useDrawingSelection({
    store, board, boardRef, role, mode, tool, setTool, ink, inkLive, editShape, layoutOwners, selBounds, selectionSet, selectedIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, clearSelection, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds, setBoard, recordHistory, saveNow, spacePanRef, view, applyImageToNode
  });
  const {
    canGrabShapeHandles, commitStroke, commitErase, swapPenEraser, pickDrawingWhileDrawing, setDrawingsDashed, toggleDrawingDash, dashTargetAt, handleDrawingMouseDown, startDrawingDrag, startSelectionDrag, handleShapeHandleMouseDown, handleSelectionResizeMouseDown, shapeHandleAt, handleInkCaptureMouseDown
  } = drawUI;
  drawUI.bind({
    clientToCanvas: (...a) => clientToCanvas(...a),
    eventToCanvas: (...a) => eventToCanvas(...a),
    handleViewportMouseDown: (...a) => handleViewportMouseDown(...a),
    finishGeom: (...a) => finishGeom(...a),
    publishGeom: (...a) => publishGeom(...a),
    handleTextMouseDown: (...a) => handleTextMouseDown(...a),
    movingPayload: (...a) => movingPayload(...a),
    startPan: (...a) => startPan(...a),
    startTextDrag: (...a) => startTextDrag(...a)
  });
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

  // Lớp vỏ định danh cố định cho React.memo trên IdeaCard/FrameBox (xem
  // lib/useStableHandlers.js): mỗi khoá gọi xuyên tới bản mới nhất của hàm.
  const cardHandlers = useStableHandlers({
    mouseDown: (e, id) => handleNodeMouseDown(e, id),
    click: (id) => handleCardClick(id),
    isClick: () => cardDragClickGuardRef.current.consume(),
    contextMenu: (e, id) => openColorMenu(e, "card", id),
    connectorMouseDown: (e, id, direction) => handleConnectorMouseDown(e, id, direction),
    edit: (id) => setEditingId(id),
    cancelEdit: () => setEditingId(null),
    remove: (id) => deleteNode(id),
    toggleFavorite: (id) => toggleFavorite(id),
    openComments: (e, id) => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id, x: e.clientX, y: e.clientY }); },
    liveText: (id, field, value) => sendLiveText({ nodeId: id, field, value }),
    save: (id, fields) => saveNodeEdit(id, fields),
    saveAndNext: (id, fields) => saveNodeEditAndNext(id, fields),
    dropImage: (e, id) => handleImageDrop(e, id),
    removeImage: (id) => removeNodeImage(id),
    imageResize: (e, id) => handleImageResizeMouseDown(e, id),
    pdfResize: (e, id) => handlePdfResizeMouseDown(e, id)
  });
  const groupHandlers = useStableHandlers({
    mouseDown: (e, id) => handleGroupMouseDown(e, id),
    contextMenu: (e, id) => openColorMenu(e, "group", id),
    remove: (id) => deleteGroup(id),
    editTitle: (id) => setEditingGroupTitleId(id),
    cancelTitle: () => setEditingGroupTitleId(null),
    saveTitle: (id, title) => saveGroupTitle(id, title),
    resizeMouseDown: (e, id) => handleGroupResizeMouseDown(e, id),
    connectorMouseDown: (e, id) => handleGroupConnectorMouseDown(e, id)
  });
  const onEdgeEnter = useMemo(() => (id) => setHoveredEdgeId(id), []);
  const onEdgeLeave = useMemo(() => (id) => setHoveredEdgeId((cur) => (cur === id ? null : cur)), []);
  // Chuột TRÁI trên dây = chọn, y như bấm vào thẻ: một mình nó, hoặc Ctrl để
  // cộng dồn. Chuột PHẢI mới mở menu sửa dây — cùng luật với thẻ và khung, nên
  // không phải nhớ riêng cho dây một kiểu bấm khác.
  const onEdgeClick = useMemo(() => (e, id) => {
    setColorMenu(null);
    setCommentsFor(null);
    setEdgeMenu(null);
    setDesignEditId(null);
    if (e.ctrlKey || e.metaKey) {
      setSelectedEdgeIds((prev) => toggleId(prev, id));
      return;
    }
    setSelectedEdgeIds(new Set([id]));
    setSelectedIds(EMPTY_SET);
    setSelectedGroupIds(EMPTY_SET);
    setSelectedDrawingIds(EMPTY_SET);
  }, [board?.kind]);

  const onEdgeContextMenu = useMemo(() => (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setColorMenu(null);
    setCommentsFor(null);
    if (board?.kind === "game-design") {
      setDesignEditId(null);
      setSelectedEdgeIds(new Set([id]));
      setSelectedIds(EMPTY_SET);
      setSelectedGroupIds(EMPTY_SET);
      setSelectedDrawingIds(EMPTY_SET);
      setEdgeMenu(null);
      return;
    }
    setEdgeMenu({ id, x: e.clientX, y: e.clientY });
  }, [board?.kind]);

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

  function openSnapshots() {
    setSnapshotsOpen(true);
  }

  async function createSnapshot(label) {
    const snapshot = await store.createSnapshot(label);
    setSnapshots((current) => [snapshot, ...current].slice(0, 30));
  }

  // Phím tắt toàn cục và nhích bằng phím mũi tên — lib/useBoardKeyboard.js.
  const keyboard = useBoardKeyboard({
    store, board, boardRef, role, view, mode, tool, setTool, placeTool, setPlaceTool, past, future, undo, redo, saveNow, saveDebounced, flushNudgeBurst, nudgeTimerRef, setBoard, inkLive, laser, editingId, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, clearSelection, linkMode, setLinkMode, setPendingSource, toggleLinkMode, colorMenu, setColorMenu, badgeUI, setBadgeUI, edgeMenu, setEdgeMenu, commentsFor, setCommentsFor, focusId, setFocusId, searchOpen, setSearchOpen, searchInputRef, setCardLevelPref, presentIndex, stepPresentation, exitPresentation, createLinkedNode, createSiblingNode, duplicateSelection, publishGeom, finishGeom
  });
  const {
    nudgeSelection
  } = keyboard;
  keyboard.bind({
    armPlace: (...a) => armPlace(...a),
    deleteSelection: (...a) => deleteSelection(...a),
    enterMode: (...a) => enterMode(...a),
    movingPayload: (...a) => movingPayload(...a),
    zoomToSelection: (...a) => zoomToSelection(...a)
  });

  if (loadError) {
    return <LoadError code={loadError} />;
  }
  if (!board) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></div>;
  }

  const currentUser = user.name;

  // Giữ tay ở CHỖ TRỐNG: đổi qua lại giữa bút và cục gôm. useInk lo toàn bộ
  // phần cử chỉ (đo thời gian, vòng báo, bỏ lượt vẽ dở); ở đây chỉ còn đúng
  // việc lật một ô state.
  //
  // Vẽ rồi xoá rồi vẽ tiếp là nhịp làm việc thường xuyên nhất trên một cái bảng,
  // mà cho tới giờ mỗi lần đổi đều phải với tay lên thanh công cụ bên trái hoặc
  // nhớ phím tắt — cả hai đều bắt rời mắt khỏi chỗ đang vẽ.
  // Con trỏ của CỤC TẨY THEO ĐỘ RỘNG: một vòng tròn đúng bằng cục tẩy thật, vẽ
  // thẳng vào con trỏ bằng data-URI. Không có nó thì bề rộng là một con số vô
  // hình — người dùng chọn cỡ "to" rồi phải quét thử vài lần mới đoán ra nó với
  // tới đâu, mà mỗi lần thử là một lần cắt nhầm phải hoàn tác.
  //
  // Chỉ ở kiểu "theo độ rộng". Kiểu "cả nét" giữ crosshair vì ở đó cục tẩy là
  // một cái que chỉ, vẽ một vòng tròn to quanh nó là nói dối về tầm với.
  const eraseCursor = (() => {
    if (mode !== "draw" || tool !== "eraser" || penPrefs.erase !== ERASE_PART) return undefined;
    // Trình duyệt bỏ qua HẲN con trỏ tuỳ biến quá lớn (Chrome: 128px) — không
    // phải thu nhỏ mà là mất luôn cả con trỏ. Kẹp lại: ở mức phóng cao thì vòng
    // tròn nhỏ hơn cục tẩy thật, vẫn hơn là không có con trỏ nào.
    const d = Math.max(6, Math.min(120, Math.round(penPrefs.ew * view.scale)));
    const box = d + 4;
    const c = box / 2;
    const r = d / 2;
    // Hai vòng chồng nhau, trắng dày dưới đen mảnh trên: con trỏ phải đọc được
    // trên cả nền sáng lẫn nền tối, mà con trỏ thì không nghe được prefers-color.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}">`
      + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="white" stroke-width="3" opacity="0.9"/>`
      + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="black" stroke-width="1.2"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(c)} ${Math.round(c)}, crosshair`;
  })();

  // Vùng chọn có ít nhất một thứ ĐỔI ĐƯỢC nét hay không. Không phải cứ
  // `selectedDrawingIds.size >= 1` là đủ: quét trúng đúng một đoạn chữ thì hai
  // nút nét liền/nét đứt hiện ra nhưng bấm vào không có gì xảy ra.
  const hasDashableSelected = (board.drawings || [])
    .some((d) => selectedDrawingIds.has(d.id) && d.kind !== "text");

  // ── Bấm nhiều lần lên một nét vẽ: 2 lần đổi nét liền ↔ nét đứt ─────────────
  //
  // Luật đếm và các hằng số nằm ở lib/multi-click.js; ở đây chỉ là phần nối
  // chuột: lọc ra đúng những cú bấm TRÊN NỀN, và tách bấm khỏi kéo. Hai cái ref
  // của cử chỉ này khai ở đầu component cùng mọi hook khác — dưới đây đã qua
  // nhánh `if (!board) return`, gọi hook ở đây là gọi có điều kiện.

  function exportPng() {
    const styles = getComputedStyle(document.documentElement);
    const v = (name) => styles.getPropertyValue(name).trim();
    const theme = {
      bg: v("--bg"), surface: v("--surface-2"), line: v("--line"),
      ink: v("--ink"), inkDim: v("--ink-dim"), accent: v("--accent"),
      colorOf: (token) => v(`--${token}`)
    };
    const canvas = drawBoardToCanvas(board, frameCardSize, theme);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "idea-map.png"; a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function handleImportConfirm() {
    try {
      const payload = JSON.parse(ioText);
      const parsed = payload?.format === "game-design-board-export/v1" && payload.board ? payload.board : payload;
      if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
      if (!Array.isArray(parsed.groups)) parsed.groups = [];
      if (typeof parsed.nextGroupId !== "number") parsed.nextGroupId = 1;
      // `view` của bản nhập là camera, không phải nội dung: tách ra đặt riêng.
      const { view: importedView, ...content } = parsed;
      store.commit(normalizeGameDesignBoard(content));
      setView(importedView);
      setIoOpen(false);
    } catch (e) {
      alert(t`JSON không hợp lệ — kiểm tra lại nội dung đã dán.`);
    }
  }

  function confirmCapture() {
    const titles = captureText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (titles.length === 0) { setCaptureOpen(false); return; }
    setFocusId(null);
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - view.panX) / view.scale;
    const cy = (rect.height / 2 - view.panY) / view.scale;
    const estH = 90;
    const cols = Math.ceil(Math.sqrt(titles.length));
    const items = titles.map((_, i) => ({ id: i, w: CARD_W, h: estH }));
    const gridW = cols * (CARD_W + 24) - 24;
    const rows = Math.ceil(titles.length / cols);
    const gridH = rows * (estH + 24) - 24;
    const pos = gridLayout(items, { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) }, cols);
    let nextId = board.nextNodeId;
    const newNodes = titles.map((title, i) => ({
      id: nextId + i,
      title,
      desc: "",
      tagId: null,
      statusId: null,
      x: pos.get(i).x,
      y: pos.get(i).y
    }));
    store.commit({ ...board, nodes: [...board.nodes, ...newNodes], nextNodeId: nextId + titles.length });
    setCaptureOpen(false);
    setCaptureText("");
  }

  const hasNoStatus = board.nodes.some((n) => n.statusId == null);
  const hasNoTag = board.nodes.some((n) => n.tagId == null);

  function togglePanel(key) {
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
      <BoardTopBar {...{ BG_LABEL, GRID_LABEL, PACK_LABEL, activeFilterCount, balanceOpen, briefOpen, clearFilters, decisionTimelineOpen, dependency, exportVersionedJson, flowOpen, goToMatch, handoffOpen, impactOpen, insightsOpen, matchCount, matchIdx, matches, openSnapshots, outlineOpen, playtestsOpen, reportsOpen, search, searchInputRef, searchOpen, setBalanceOpen, setBoardBg, setBoardGrid, setBoardPack, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setIoMode, setIoOpen, setIoText, setOutlineOpen, setPlaytestsOpen, setReportsOpen, setSearch, setTheme, setWheelMode, skin, startPresentation, theme, toggleSearch, toggleSkin, toolsOpen, viewportSize, wheelMode, workspace, workspaceCameraRef }} />

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

