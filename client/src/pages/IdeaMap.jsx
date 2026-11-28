import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceState } from "../lib/useWorkspaceState.js";
import { cameraToCenter, centerToCamera } from "../lib/workspace-state.js";
import { useParams } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { listBoardSnapshots } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import { useSkin } from "../lib/useSkin.js";
import { drawingBox, shapeHandles } from "../lib/shape.js";
import { textLines, textBox, TEXT_LINE_H } from "../lib/text-el.js";
import { colorVar, statusById } from "../lib/badges.js";
import { paletteCss } from "../lib/palette.js";
import { isBoardBg, isBoardGrid, isColorPack } from "../lib/board-theme.js";
import TreePanel from "../components/TreePanel.jsx";
import MiniMap from "../components/MiniMap.jsx";
import { rectsOf } from "../lib/minimap.js";
import LoadError from "../components/LoadError.jsx";
import InviteModal from "../components/InviteModal.jsx";
import ColorMenu from "../components/ColorMenu.jsx";
import FrameBox from "../components/FrameBox.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import ToolRail from "../components/ToolRail.jsx";
import ToolOptions from "../components/ToolOptions.jsx";
import { buildEdgeRoutes } from "../lib/edge-routing.js";
import { createDragClickGuard, createMultiClick } from "../lib/multi-click.js";
import { buildOutline } from "../lib/outline.js";
import { gridLayout } from "../lib/layout.js";
import { buildTree, edgeKey } from "../lib/tree-layout.js";
import { normalizeTreeLock, treeLockOwners, arrangeLockedTrees } from "../lib/locked-tree.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence } from "../lib/usePresence.js";
import { useFollow } from "../lib/useFollow.js";
import { useLiveSync, applyGeomOverlay } from "../lib/useLiveSync.js";
import { useBoardStore } from "../lib/useBoardStore.js";
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
import { loadPenPrefs, savePenPrefs, penVar } from "../lib/pen.js";
import { ERASE_PART } from "../lib/erase.js";
import { loadCardLevel, saveCardLevel } from "../lib/card-levels.js";
import InkLayer from "../components/InkLayer.jsx";
import { useInk } from "../lib/useInk.js";
import { useInkLive } from "../lib/useInkLive.js";
import { applyInkMoves } from "../lib/ink-live.js";
import { useLaser } from "../lib/useLaser.js";
import { loadLaserPrefs, saveLaserPrefs } from "../lib/laser.js";
import { createWheelReader, loadWheelMode, saveWheelMode } from "../lib/pointer-input.js";
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
import "../styles/idea-map.css";

export default function IdeaMap() {
  const { user, logout } = useAuth();
  const { boardId } = useParams();
  const workspace = useWorkspaceState(user?.email, boardId);
  const workspaceState = workspace.state;
  const workspaceSetters = useMemo(() => {
    const controller = workspace.controller;
    const flag = (key) => (value) => {
      const current = controller.getSnapshot().state[key];
      controller.update({ [key]: typeof value === "function" ? value(current) : value });
    };
    const inspector = (type) => (value) => {
      const current = controller.getSnapshot().state.inspector;
      if (value == null || value === false) {
        if (current?.type === type) controller.update({ inspector: null });
      } else if (current?.type !== type || type === "tree" || type === "design") controller.update({ inspector: { type, ...(type === "tree" ? value : type === "design" ? { id: value } : {}) } });
    };
    return { flag, inspector, panels: (value) => {
      const current = controller.getSnapshot().state;
      const next = typeof value === "function" ? value({ status: current.statusOpen, tag: current.tagOpen, palette: current.paletteOpen }) : value;
      controller.update({ statusOpen: next.status, tagOpen: next.tag, paletteOpen: next.palette });
    } };
  }, [workspace.controller]);
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
  const [editingId, setEditingId] = useState(null);
  // Bộ lọc, tìm kiếm, chế độ tập trung: lib/useBoardFilters.js.
  const filters = useBoardFilters({ board });
  const {
    filterStatus, setFilterStatus, filterTags, setFilterTags, filterFav, setFilterFav,
    search, setSearch, searchOpen, toggleSearch, setSearchOpen, focusId, setFocusId, matchIdx,
    passesFilter, focusSet, matches, activeFilterCount, matchCount, goToMatch, clearFilters
  } = filters;
  filters.bind({ jumpToCard: (id) => jumpToCard(id) });
  const outlineOpen = workspaceState.outlineOpen;
  const setOutlineOpen = useMemo(() => workspaceSetters.flag("outlineOpen"), [workspaceSetters]);
  // Bản đồ thu nhỏ ở góc dưới phải. Mặc định BẬT: nó chỉ có nghĩa khi luôn ở
  // đó — thứ phải bật lên mới xem được thì lúc lạc đường đã không nhớ là có.
  const miniOpen = workspaceState.miniOpen;
  const toolsOpen = workspaceState.toolsOpen;
  const setMiniOpen = useMemo(() => workspaceSetters.flag("miniOpen"), [workspaceSetters]);
  // Bảng Xếp cây bên phải: { kind, id } của thẻ/khung đang làm gốc. Tuỳ chọn
  // sống riêng để đóng bảng rồi mở lại cây khác vẫn giữ nguyên cách xếp vừa dò
  // được. treeBaseRef giữ board TRƯỚC khi mở bảng: mọi lần kéo thanh trượt đều
  // tính lại từ đó chứ không chồng lên kết quả lần trước, nên kéo qua kéo lại
  // không làm cây trôi dần đi.
  const treeUI = workspaceState.inspector?.type === "tree" ? workspaceState.inspector : null;
  const setTreeUI = useMemo(() => workspaceSetters.inspector("tree"), [workspaceSetters]);
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState("export");
  const [ioText, setIoText] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [dropTargetId, setDropTargetId] = useState(null);
  // Mặc định mở Trạng thái + Nhãn để giữ đúng hành vi cũ khi mới vào; Bảng màu
  // đóng. Trạng thái riêng của tài khoản, board và nhóm màn hình.
  const panels = useMemo(() => ({ status: workspaceState.statusOpen, tag: workspaceState.tagOpen, palette: workspaceState.paletteOpen }), [workspaceState.statusOpen, workspaceState.tagOpen, workspaceState.paletteOpen]);
  const setPanels = workspaceSetters.panels;
  // mode: "select" (thao tác thẻ như cũ) | "draw" (vẽ lên bảng) | "place" (đã
  // lên nòng một việc ở khu 3, đang chờ người dùng chỉ chỗ trên bảng) | "laser"
  // (bút laser — vệt sáng chạy theo con trỏ rồi tan, không ghi gì vào board).
  //
  // Laser là MODE chứ không phải một tool nữa của mode Sửa, dù bề ngoài nó
  // giống vẽ: tool của mode Sửa đều ghi vào board nên đều bị khoá với người chỉ
  // xem và đều đi kèm bảng tuỳ chọn ở khu 4, còn laser thì không cái nào cả.
  // KHÔNG nhớ qua lần mở sau: mở board ra mà con trỏ đang là cây bút là điều
  // gây bất ngờ vô cớ. Riêng màu bút, độ dày và bậc thẻ thì nhớ.
  const [mode, setMode] = useState("select");
  const [tool, setTool] = useState("pen");
  // Việc đang lên nòng ở mode "place": "node" (bấm để đặt thẻ) | "group" (tô
  // để vẽ khung). Khác tool vẽ ở một điểm: làm xong MỘT lần là tự về mode Chuột.
  const [placeTool, setPlaceTool] = useState(null);
  const [penPrefs, setPenPrefs] = useState(() => loadPenPrefs(window.localStorage));
  // Khoá localStorage riêng, không nhét chung với penPrefs: `w` của laser là
  // pixel MÀN HÌNH còn `w` của bút là đơn vị canvas — dùng chung một ô là đổi
  // độ đậm laser sẽ đổi luôn độ dày nét bút.
  const [laserPrefs, setLaserPrefs] = useState(() => loadLaserPrefs(window.localStorage));
  // Cuộn hai ngón / lăn chuột nghĩa là gì: "auto" | "pan" | "zoom". Riêng từng
  // máy (localStorage) chứ không theo board — nó là chuyện thiết bị đang cầm,
  // không phải chuyện bảng đang mở.
  const [wheelMode, setWheelMode] = useState(() => loadWheelMode(window.localStorage));
  const [cardLevelPref, setCardLevelPref] = useState(() => loadCardLevel(window.localStorage));
  const [snapGuides, setSnapGuides] = useState([]);
  const [colorMenu, setColorMenu] = useState(null); // { kind: "card"|"group", id, x, y }
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null); // { id, x, y } | null
  const [flashId, setFlashId] = useState(null);
  const [spotlightPeerId, setSpotlightPeerId] = useState(null);
  const inspector = workspaceState.inspector;
  const designEditId = inspector?.type === "design" ? inspector.id : null;
  const setDesignEditId = useMemo(() => workspaceSetters.inspector("design"), [workspaceSetters]);
  const briefOpen = inspector?.type === "brief", flowOpen = inspector?.type === "flow", handoffOpen = inspector?.type === "handoff", balanceOpen = inspector?.type === "balance", decisionTimelineOpen = inspector?.type === "decisions", snapshotsOpen = inspector?.type === "snapshots";
  const setBriefOpen = useMemo(() => workspaceSetters.inspector("brief"), [workspaceSetters]);
  const setFlowOpen = useMemo(() => workspaceSetters.inspector("flow"), [workspaceSetters]);
  const setHandoffOpen = useMemo(() => workspaceSetters.inspector("handoff"), [workspaceSetters]);
  const setBalanceOpen = useMemo(() => workspaceSetters.inspector("balance"), [workspaceSetters]);
  const setDecisionTimelineOpen = useMemo(() => workspaceSetters.inspector("decisions"), [workspaceSetters]);
  const setSnapshotsOpen = useMemo(() => workspaceSetters.inspector("snapshots"), [workspaceSetters]);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const insightsOpen = inspector?.type === "insights", reportsOpen = inspector?.type === "reports", impactOpen = inspector?.type === "impact", playtestsOpen = inspector?.type === "playtests";
  const setInsightsOpen = useMemo(() => workspaceSetters.inspector("insights"), [workspaceSetters]);
  const setReportsOpen = useMemo(() => workspaceSetters.inspector("reports"), [workspaceSetters]);
  const setImpactOpen = useMemo(() => workspaceSetters.inspector("impact"), [workspaceSetters]);
  const impactCardId = inspector?.type === "impact" ? inspector.id ?? null : null;
  const setImpactCardId = useCallback((id) => workspace.update({ inspector: { type: "impact", ...(id != null ? { id } : {}) } }), [workspace.controller]);
  const setPlaytestsOpen = useMemo(() => workspaceSetters.inspector("playtests"), [workspaceSetters]);
  const [initialCardParam] = useState(() => new URLSearchParams(window.location.search).get("card"));

  const [inviteOpen, setInviteOpen] = useState(false);
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
  const treeSizeRef = useRef(frameCardSize);
  treeSizeRef.current = frameCardSize;
  const layoutOwners = useMemo(
    () => board ? treeLockOwners(board, frameCardSize) : new Map(),
    [board?.nodes, board?.groups, board?.edges, frameCardSize]
  );

  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const editDockRef = useRef(null);
  const searchInputRef = useRef(null);
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
  const editingIdRef = useRef(null);
  // socket.id gửi kèm mỗi lần lưu để server loại chính mình khỏi broadcast
  // board:update; updatedAt của lần lưu/nhận gần nhất để so sánh gói đến
  // sau có mới hơn không (useLiveSync.js: isStaleUpdate).
  const socketRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const suppressContextMenuRef = useRef(false);
  const spacePanRef = useRef(false);
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
  // Cử chỉ bấm nhiều lần lên một nét vẽ (2 lần đổi nét liền ↔ nét đứt). Phần
  // việc nằm ở handleViewportClickCapture bên dưới; hai cái ref phải khai ở đây
  // vì component có nhánh `if (!board) return` ở giữa.
  const multiClickRef = useRef(null);
  if (!multiClickRef.current) multiClickRef.current = createMultiClick();
  const cardDragClickGuardRef = useRef(null);
  if (!cardDragClickGuardRef.current) cardDragClickGuardRef.current = createDragClickGuard();
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
  const clickAnchorRef = useRef(null);
  // Đang giữ chuột trái ở mode Laser. Ref chứ không state: nó đổi ở mỗi lần bấm
  // và chỉ được đọc trong handler chuột, không có gì trên màn hình phụ thuộc nó.
  const laserDownRef = useRef(false);
  const pendingJumpRef = useRef(null);
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
  // Ngữ cảnh 2d dùng để đo bề rộng chữ, dựng một lần rồi dùng lại.
  // undefined = chưa dò; null = đã dò và môi trường không có canvas 2d.
  const measureCtxRef = useRef(undefined);
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
  // Bộ đọc sự kiện wheel có NHỚ: điểm tin cậy "đây là touchpad hay nút lăn"
  // sống qua các sự kiện, nên nó không lật qua lật lại giữa một dòng cuộn. Phải
  // là ref, không phải biến trong effect: effect gắn lại khi board tải xong và
  // khi stopFollow đổi, mà mất trí nhớ giữa dòng cuộn là bảng nhảy giữa lia và
  // phóng ngay dưới ngón tay.
  const wheelReaderRef = useRef(null);
  if (!wheelReaderRef.current) wheelReaderRef.current = createWheelReader();

  const ink = useInk({
    tool, penPrefs, boardRef, viewRef, viewportRef,
    // Gọi trễ qua drawUI: hook nét vẽ cần `ink` nên được gọi SAU useInk.
    onStrokeDone: (...a) => drawUI.commitStroke(...a),
    onEraseDone: (...a) => drawUI.commitErase(...a),
    onPick: (...a) => drawUI.pickDrawingWhileDrawing(...a),
    onSwapTool: (...a) => drawUI.swapPenEraser(...a),
    live: inkLive
  });

  // Mở ô tìm là để gõ ngay, không phải để rồi bấm thêm một cú vào nó. Đặt ở
  // effect chứ không ở toggleSearch: Ctrl+F lúc ô đang đóng thì ô nhập chưa nằm
  // trong cây, không có gì để focus tại thời điểm xử lý phím.
  useEffect(() => {
    if (!searchOpen) return;
    const el = searchInputRef.current;
    if (el) { el.focus(); el.select(); }
  }, [searchOpen]);

  useEffect(() => { savePenPrefs(window.localStorage, penPrefs); }, [penPrefs]);
  useEffect(() => { saveLaserPrefs(window.localStorage, laserPrefs); }, [laserPrefs]);
  useEffect(() => { saveWheelMode(window.localStorage, wheelMode); }, [wheelMode]);
  useEffect(() => { saveCardLevel(window.localStorage, cardLevelPref); }, [cardLevelPref]);

  // Kích thước khung nhìn, để minimap biết vẽ ô "đang xem ở đây" to bằng nào.
  // Giữ trong state chứ không đo lúc render: đo DOM giữa lượt render là ép trình
  // duyệt tính lại layout, mà minimap render lại ở MỌI nhịp lia bảng.
  // ResizeObserver có thể vắng mặt (jsdom trong smoke test) — đo một lần rồi
  // thôi, vẫn đúng vì ở đó cửa sổ không đổi kích thước.
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // Lùi về cỡ cửa sổ khi đo ra 0: khung nhìn vốn phủ kín cửa sổ, mà môi
      // trường không có layout thật (jsdom) trả về đúng 0×0 — không có bước lùi
      // này thì minimap không bao giờ dựng được ở đó.
      const w = r.width || window.innerWidth;
      const h = r.height || window.innerHeight;
      setViewportSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board != null]);

  const workspaceCameraRef = useRef(null);
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

  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { sendSelection(Array.from(selectedIds)); }, [selectedIds, sendSelection]);
  useEffect(() => {
    const draft = linkDraft
      ? { fromKind: linkDraft.fromKind || "node", fromId: linkDraft.fromId, x: linkDraft.x, y: linkDraft.y }
      : edgeDrag
      ? { fromKind: edgeDrag.fixedKind, fromId: edgeDrag.fixedId, x: edgeDrag.x, y: edgeDrag.y }
      : null;
    sendEdgeDraft(draft);
  }, [linkDraft, edgeDrag, sendEdgeDraft]);

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

  const { geomOverlay, textOverlay, sendLiveText, publishGeom, finishGeom } =
    useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard);

  // Toạ độ dùng để VẼ: board thật + vị trí tạm của người khác đang kéo. Mọi thứ
  // hiển thị (thẻ, khung, dây, tay cầm dây) phải đọc từ đây, còn handler tương
  // tác vẫn đọc `board` gốc — nếu không, phép tính kéo sẽ lấy vị trí tạm của
  // người khác làm mốc.
  const liveNodes = useMemo(
    () => (board ? applyGeomOverlay(board.nodes, geomOverlay, "node:") : EMPTY_ARRAY),
    [board?.nodes, geomOverlay]
  );
  const liveGroups = useMemo(
    () => (board ? applyGeomOverlay(board.groups, geomOverlay, "group:") : EMPTY_ARRAY),
    [board?.groups, geomOverlay]
  );
  // Chỉ mục tra cứu O(1) cho lớp dây và lớp peer. Trước đây mỗi đầu dây quét
  // lại cả mảng thẻ ở mỗi lần render: bảng 150 cạnh × 100 thẻ là 30.000 phép so
  // sánh cho một khung hình, nhân với 60 khung hình mỗi giây lúc kéo.
  const nodeById = useMemo(() => new Map(liveNodes.map((n) => [n.id, n])), [liveNodes]);
  const groupById = useMemo(() => new Map(liveGroups.map((g) => [g.id, g])), [liveGroups]);
  const edgeRoutes = useMemo(
    () => buildEdgeRoutes(board?.edges || EMPTY_ARRAY, nodeById, groupById, frameCardSize),
    [board?.edges, nodeById, groupById, frameCardSize]
  );
  const edgeRoutesRef = useRef(edgeRoutes);
  selection.bind({ viewportRef, viewRef, boardRef, edgeRoutesRef });
  edgeRoutesRef.current = edgeRoutes;
  const statusDefById = useMemo(
    () => (board ? new Map(board.statuses.map((s) => [s.id, s])) : EMPTY_MAP),
    [board?.statuses]
  );
  const tagDefById = useMemo(
    () => (board ? new Map(board.tags.map((tg) => [tg.id, tg])) : EMPTY_MAP),
    [board?.tags]
  );
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
  const paletteStyle = useMemo(() => paletteCss(board?.palette ?? EMPTY_ARRAY), [board?.palette]);

  const inkDrawings = useMemo(() => {
    const list = board?.drawings ?? EMPTY_ARRAY;
    const dragged = !textDrag
      ? list
      : list.map((d) => (d.id === textDrag.id ? { ...d, pts: [textDrag.x, textDrag.y] } : d));
    // Nét người KHÁC đang dời / co giãn / sửa hình. Đắp ở đây chứ không trong
    // InkLayer, để đối xứng với liveNodes/liveGroups: mọi thứ hiển thị đọc từ
    // bản đã đắp overlay, còn handler tương tác vẫn đọc `board` gốc.
    return applyInkMoves(dragged, inkLive.liveStrokes);
  }, [board?.drawings, textDrag, inkLive.liveStrokes]);

  // Trạng thái HIỆN TẠI của các nét đang bị thao tác, dạng gói live. Chỉ mang
  // phần hình học — kiểu dáng thì người nhận đã có trong board của họ.
  function movingPayload(b, ids) {
    const out = [];
    for (const d of b?.drawings || []) {
      if (!ids.has(d.id)) continue;
      const m = { id: d.id, pts: d.pts };
      // kind chỉ đổi khi kéo tay cầm một góc; gửi luôn cho mọi nét thì gói to ra
      // vô ích, nên chỉ gửi khi nó thật sự khác bản người nhận đang có... mà
      // "bản người nhận đang có" thì mình không biết. Gửi cho hình khối là đủ:
      // nét bút và chữ không bao giờ đổi kind.
      if (d.kind && d.kind !== "pen" && d.kind !== "text") m.kind = d.kind;
      if (d.kind === "text") {
        if (Number.isFinite(d.size)) m.size = d.size;
        if (Number.isFinite(d.w)) m.w = d.w;
        if (Number.isFinite(d.h)) m.h = d.h;
      }
      out.push(m);
    }
    return out;
  }

  // Hình đang được sửa từng góc/cạnh: chọn ĐÚNG MỘT hình khối, không kèm thẻ hay
  // khung nào. Chỉ một hình mới có tay cầm — chọn hai hình thì tay cầm của chúng
  // chen vào nhau và không ai biết cái nào của cái nào; ở đó việc cần làm là kéo
  // cả cụm, mà hộp bao vùng chọn đã lo (xem selBounds).
  const editShape = useMemo(() => {
    if (!board || selectedDrawingIds.size !== 1) return null;
    if (selectedIds.size || selectedGroupIds.size) return null;
    const id = Array.from(selectedDrawingIds)[0];
    const d = (board.drawings || []).find((x) => x.id === id);
    if (!d) return null;
    const handles = shapeHandles(d);
    return handles.length ? { d, handles } : null;
  }, [board?.drawings, selectedDrawingIds, selectedIds, selectedGroupIds]);
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

  // Hình khối cho minimap. Tính lại khi NỘI DUNG đổi, không phải khi camera đổi:
  // lia bảng là chuyện xảy ra liên tục, mà lia thì mấy cái hộp này không hề khác.
  const miniShapes = useMemo(
    () => (board ? rectsOf(board, CARD_W, drawingBox) : null),
    [board?.nodes, board?.groups, board?.drawings]
  );

  // Nền và bộ màu là DỮ LIỆU BOARD, nhưng thuộc tính lại đặt trên <html> — cùng
  // chỗ với data-theme (thiết lập của người dùng). Hai lý do: chip nhãn/trạng
  // thái nằm trong đảo to, ngoài .viewport, mà vẫn phải đổi màu theo bộ màu;
  // và exportPng() đang đọc getComputedStyle của documentElement, để ở đây thì
  // nó không phải đổi cách lấy giá trị.
  useEffect(() => {
    const el = document.documentElement;
    // Lọc trước khi đặt: giá trị này có thể tới từ "Nhập JSON", không phải lúc
    // nào cũng từ cú bấm trong panel.
    const bg = isBoardBg(board?.bg) ? board?.bg : null;
    const grid = isBoardGrid(board?.grid) ? board?.grid : null;
    const pack = isColorPack(board?.pack) ? board?.pack : null;
    if (bg) el.setAttribute("data-bg", bg); else el.removeAttribute("data-bg");
    if (grid) el.setAttribute("data-grid", grid); else el.removeAttribute("data-grid");
    if (pack) el.setAttribute("data-pack", pack); else el.removeAttribute("data-pack");
    // Gỡ khi rời trang: sang danh sách board mà còn nền của board vừa xem thì
    // trông như lỗi hiển thị.
    return () => {
      el.removeAttribute("data-bg");
      el.removeAttribute("data-grid");
      el.removeAttribute("data-pack");
    };
  }, [board?.bg, board?.grid, board?.pack]);

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
    const el = viewportRef.current;
    if (!el) return;
    function wheelHandler(e) {
      // Dock/phần panel có vùng cuộn riêng: nếu canvas bắt wheel ở đây rồi
      // preventDefault thì scrollbar vẫn hiện nhưng người dùng không thể cuộn
      // form. Mọi panel nổi đều cùng luật này — di chuột trên panel chỉ cuộn
      // nội dung của nó, không lia/zoom sa bàn nằm dưới.
      if (e.target.closest(".outline-panel, .io-drawer, .tree-panel, .edit-dock")) return;
      e.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      // Cuộn/zoom là người dùng tự lái camera → thôi bám theo người khác.
      stopFollow();
      // MỘT chỗ duy nhất quyết định "cú này là lia hay là phóng": lib/pointer-input.js.
      // Trước đây chỗ này tự xử, và nó xử cùng một kiểu cho nút lăn với touchpad —
      // nên trên laptop chỉ trượt nhẹ hai ngón là bảng phóng to vọt lên. Xem ghi
      // chú đầu file đó về từng dấu hiệu nhận thiết bị.
      const cmd = wheelReaderRef.current.read(e, wheelMode);
      if (cmd.intent === "pan") {
        camera.panBy(-cmd.dx, -cmd.dy);
        return;
      }
      camera.zoomAt(el.getBoundingClientRect(), e.clientX, e.clientY, cmd.factor);
    }
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
    // stopFollow là useCallback ổn định (chỉ phụ thuộc sendFollow, cũng ổn
    // định), nên thêm vào deps không làm listener gắn lại thêm lần nào.
    // Re-chạy khi board tải xong: lúc mount đầu board còn null nên viewport
    // chưa render (return "Đang tải…"), viewportRef.current == null và listener
    // sẽ không được gắn nếu chỉ phụ thuộc [].
    // wheelMode chỉ đổi khi người dùng bấm trong panel Giao diện — gắn lại
    // listener khi đó thì rẻ, và rẻ hơn hẳn một ref nữa phải đồng bộ tay.
  }, [board != null, stopFollow, wheelMode]);

  // Những thứ store cần mà khai báo sau board (xem lib/useBoardStore.js).
  store.bind({
    inkLive, treeSizeRef, socketRef, editingIdRef,
    onLoaded: (data) => {
      if (initialCardParam && data.nodes.some((n) => n.id === Number(initialCardParam))) {
        pendingJumpRef.current = Number(initialCardParam);
      }
    },
    onHistoryJump: () => setEditingId(null)
  });

  function openSnapshots() {
    setSnapshotsOpen(true);
  }

  async function createSnapshot(label) {
    const snapshot = await store.createSnapshot(label);
    setSnapshots((current) => [snapshot, ...current].slice(0, 30));
  }

  useEffect(() => {
    const current = boardRef.current;
    if (!current || roleRef.current === "viewer") return;
    const next = arrangeLockedTrees(current, frameCardSize);
    if (next === current) return;
    store.preview(next);
    saveNow(next);
  }, [frameCardSize]);
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

  useEffect(() => {
    function down(e) {
      if (e.code !== "Space") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      e.preventDefault();            // chặn page scroll
      spacePanRef.current = true;
    }
    function up(e) { if (e.code === "Space") spacePanRef.current = false; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Chặn thao tác mặc định của trình duyệt trên cả trang bảng ──────────────
  //
  // BÔI ĐEN và KÉO-THẢ GỐC là thao tác dành cho một trang TÀI LIỆU. Đây là một
  // cái bàn vẽ: mỗi cú bấm, cú kéo trên nền đều đã có nghĩa riêng, nên hai thứ
  // đó chỉ chen vào. Cụ thể chúng làm hỏng những việc này:
  //
  //   Bấm 3 lần để làm lại — trình duyệt hiểu là "chọn cả đoạn văn", bôi đen
  //     nguyên vùng rồi bật thanh công cụ chọn-chữ của nó đè lên bảng.
  //   Kéo một cái thẻ, một cái chip — trình duyệt dựng bóng kéo-thả gốc của nó
  //     đi kèm, trong khi cú kéo thật đã được xử lý bằng sự kiện chuột.
  //   Quét chọn một vùng — vệt bôi đen xanh chạy theo dưới khung quét.
  //
  // Nghe ở `document` chứ không rắc user-select: none vào từng khối CSS: chặn ở
  // một chỗ thì không có góc nào sót, và cái cần giữ lại chỉ là MỘT ngoại lệ —
  // ô nhập liệu. Trong ô nhập thì bôi đen là thao tác đúng và cần thiết (chọn
  // một từ để sửa, bấm 3 lần để chọn cả dòng), nên chúng đi qua nguyên vẹn.
  // Cùng ngoại lệ mà handlePageContextMenu đang dùng cho menu chuột phải.
  useEffect(() => {
    function blockNativeDefault(e) {
      const el = e.target;
      const tag = (el?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable === true) return;
      e.preventDefault();
    }
    document.addEventListener("selectstart", blockNativeDefault);
    document.addEventListener("dragstart", blockNativeDefault);
    return () => {
      document.removeEventListener("selectstart", blockNativeDefault);
      document.removeEventListener("dragstart", blockNativeDefault);
    };
  }, []);

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
        <ViewportOverlays {...{ addGameDesignCard, armPlace, board, camera, cardLevelPref, commitText, enterMode, eraseCursor, gameDesign, handleInkCaptureMouseDown, handleLaserMouseDown, handleLaserMouseMove, handleLaserMouseUp, handlePlaceCaptureMouseDown, ink, inkLive, laser, laserPrefs, linkMode, measureTextWidth, mode, penPrefs, placeTool, role, setCaptureOpen, setCardLevelPref, setLaserPrefs, setPenPrefs, setTextEdit, setTool, textEdit, toggleLinkMode, tool, view }} />
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

