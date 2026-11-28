import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceState } from "../lib/useWorkspaceState.js";
import { cameraToCenter, centerToCamera, normalizeWorkspace } from "../lib/workspace-state.js";
import { Link, useParams } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { listBoardSnapshots } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import { useSkin } from "../lib/useSkin.js";
import { drawingsHitBy, moveDrawing, drawingBox, shapeHandles, HANDLE_EDGE } from "../lib/shape.js";
import { textLines, textBox, TEXT_LINE_H } from "../lib/text-el.js";
import { BADGE_PALETTE, colorVar, statusById, tagById } from "../lib/badges.js";
import { RELATION_OPTIONS, relationDefinition, isGameDesignRelation, exportPackage } from "../lib/game-design.js";
import { paletteCss } from "../lib/palette.js";
import { BOARD_BGS, BOARD_GRIDS, COLOR_PACKS, isBoardBg, isBoardGrid, isColorPack } from "../lib/board-theme.js";
import FilterPanel from "../components/FilterPanel.jsx";
import TreePanel from "../components/TreePanel.jsx";
import MiniMap from "../components/MiniMap.jsx";
import { rectsOf, panForCenter } from "../lib/minimap.js";
import LoadError from "../components/LoadError.jsx";
import LocaleToggle from "../components/LocaleToggle.jsx";
import InviteModal from "../components/InviteModal.jsx";
import PresenceBar from "../components/PresenceBar.jsx";
import FollowBanner from "../components/FollowBanner.jsx";
import BadgeEditor from "../components/BadgeEditor.jsx";
import ColorMenu from "../components/ColorMenu.jsx";
import FrameBox from "../components/FrameBox.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import GameDesignPanel from "../components/GameDesignPanel.jsx";
import GameDesignBriefPanel from "../components/GameDesignBriefPanel.jsx";
import GameDesignFlowPanel from "../components/GameDesignFlowPanel.jsx";
import DevHandoffPanel from "../components/DevHandoffPanel.jsx";
import GameDesignBalancePanel from "../components/GameDesignBalancePanel.jsx";
import DecisionTimelinePanel from "../components/DecisionTimelinePanel.jsx";
import BoardSnapshotsPanel from "../components/BoardSnapshotsPanel.jsx";
import GameDesignInsightsPanel from "../components/GameDesignInsightsPanel.jsx";
import GameDesignReportsPanel from "../components/GameDesignReportsPanel.jsx";
import GameDesignImpactPanel from "../components/GameDesignImpactPanel.jsx";
import PlaytestComparisonPanel from "../components/PlaytestComparisonPanel.jsx";
import EdgeLayer from "../components/EdgeLayer.jsx";
import PeerLayer from "../components/PeerLayer.jsx";
import ToolRail from "../components/ToolRail.jsx";
import PdfUsage from "../components/PdfUsage.jsx";
import ToolOptions from "../components/ToolOptions.jsx";
import { nodesInFrame } from "../lib/board-geometry.js";
import { buildEdgeRoutes, routeIntersectsRect } from "../lib/edge-routing.js";
import { createDragClickGuard, createMultiClick, isDragGesture } from "../lib/multi-click.js";
import { buildOutline } from "../lib/outline.js";
import { gridLayout, layerLayout } from "../lib/layout.js";
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
import { rectsOverlap } from "../lib/board-geometry.js";
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
import { drawBoardToCanvas } from "../lib/png-export.js";
import { loadPenPrefs, savePenPrefs, penVar } from "../lib/pen.js";
import { ERASE_PART } from "../lib/erase.js";
import { cardLevel, levelPatch, loadCardLevel, saveCardLevel } from "../lib/card-levels.js";
import InkLayer from "../components/InkLayer.jsx";
import { useInk } from "../lib/useInk.js";
import { useInkLive } from "../lib/useInkLive.js";
import { applyInkMoves } from "../lib/ink-live.js";
import LaserLayer from "../components/LaserLayer.jsx";
import { useLaser } from "../lib/useLaser.js";
import { loadLaserPrefs, saveLaserPrefs } from "../lib/laser.js";
import { createWheelReader, loadWheelMode, saveWheelMode } from "../lib/pointer-input.js";
import { pointInBounds, cornerPoint, SELECTION_CORNERS } from "../lib/selection-box.js";
import { CARD_W, TEXT_DRAG_THRESHOLD, SEL_GRAB_PAD, SELECTION_DROP, PICK_RADIUS, MIN_GROUP_W, MIN_SCALE, PANEL_KEYS, TREE_OPTS, EMPTY_ARRAY, EMPTY_MAP, EMPTY_SET, MIN_GROUP_H, MAX_SCALE } from "../lib/board-constants.js";
import { computeZoom } from "../lib/camera.js";
import { useCamera } from "../lib/useCamera.js";
import { normalizeGameDesignBoard } from "../lib/normalize-board.js";
import { IconSketch, IconMenu, MiniMapIcon, IconSearch, IconStatus, IconTag, IconPalette, IconBoardStyle, IconStar, IconUndo, IconRedo } from "../components/board/icons.jsx";
import DropCount from "../components/board/DropCount.jsx";
import TopMenu from "../components/board/TopMenu.jsx";
import PaletteEditor from "../components/board/PaletteEditor.jsx";
import EdgeMenu from "../components/board/EdgeMenu.jsx";
import CommentsPopover from "../components/board/CommentsPopover.jsx";
import BoardCanvas from "../components/board/BoardCanvas.jsx";
import ZoomControl from "../components/board/ZoomControl.jsx";
import EditDock from "../components/board/EditDock.jsx";
import IoDrawer from "../components/board/IoDrawer.jsx";
import PresentBar from "../components/board/PresentBar.jsx";
import BoardPopovers from "../components/board/BoardPopovers.jsx";
import CaptureOverlay from "../components/board/CaptureOverlay.jsx";
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

  function handlePresenceMouseMove(e) {
    sendCursor(() => {
      const rect = viewportRef.current.getBoundingClientRect();
      const view = viewRef.current;
      return {
        x: (e.clientX - rect.left - view.panX) / view.scale,
        y: (e.clientY - rect.top - view.panY) / view.scale
      };
    });
  }

  function entityAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el && el.closest(".idea-card");
    if (card) return { id: Number(card.getAttribute("data-id")), kind: "node" };
    const frame = el && el.closest(".frame-box");
    if (frame) return { id: Number(frame.getAttribute("data-group-id")), kind: "group" };
    return null;
  }

  // Điểm trên bảng (toạ độ canvas) ứng với một điểm trên màn hình. Đọc qua
  // boardRef chứ không phải `board`: hàm này được gọi từ trong listener của một
  // cú kéo dài vài giây, mà closure của listener giữ `board` của lượt render lúc
  // mousedown — camera có thể đã đổi từ lúc đó.
  function toCanvasPoint(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.panX) / view.scale,
      y: (clientY - rect.top - view.panY) / view.scale
    };
  }

  // Khu 3 lên nòng một việc rồi chờ người dùng chỉ chỗ. Bấm lại đúng nút đang
  // sáng thì hạ nòng — không có nút nào để "thoát" ngoài Esc thì nút đang sáng
  // phải tự làm được việc đó.
  function armPlace(next) {
    if (mode === "place" && placeTool === next) { enterMode("select"); return; }
    setPlaceTool(next);
    enterMode("place");
  }

  // Nhường đường cho lia bảng TRƯỚC khi nghĩ tới việc đặt — cùng thứ tự mà
  // handleInkCaptureMouseDown dùng, nên chuột phải và Space+trái vẫn lia bảng
  // bình thường trong lúc đang lên nòng.
  function handlePlaceCaptureMouseDown(e) {
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (placeTool === "node") placeNodeAt(e.clientX, e.clientY);
    else if (placeTool === "group") startPlaceGroup(e);
  }

  // Rời mode Chuột thì bỏ lựa chọn và tắt nối dây: để lại một thẻ đang chọn
  // trong lúc vẽ nghĩa là bấm Delete sẽ xoá thẻ đó, trong khi người dùng đang
  // nghĩ mình xoá nét vẽ. Mode "place" cũng vậy — lớp bắt chuột của nó phủ kín
  // viewport nên thẻ đang chọn không còn bấm tới được.
  function enterMode(next) {
    setMode(next);
    // Hạ nòng khu 3 khi đi sang mode khác. KHÔNG đụng tới placeTool khi vào
    // chính mode "place": armPlace() đặt nó ngay trước lời gọi này.
    if (next !== "place") setPlaceTool(null);
    if (next !== "select") {
      clearSelection();
      setLinkMode(false);
      setPendingSource(null);
    }
  }

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

  // Nền trống của bảng, kể cả những lớp phủ kín khung nhìn của từng mode. KHÔNG
  // gồm lớp của mode Đặt: ở đó mỗi cú bấm là một cái thẻ mới, đếm chồng lên
  // thành ra vừa tạo thẻ vừa hoàn tác nó.
  function isBoardBackground(el) {
    if (el === viewportRef.current || el === canvasRef.current) return true;
    return el instanceof Element
      && (el.classList.contains("ink-capture") || el.classList.contains("laser-capture"));
  }

  // Ghi mốc ở pha BẮT (capture): nó chạy trước mọi handler con, nên một lớp phủ
  // gọi stopPropagation cũng không giấu được cú bấm khỏi bộ đếm.
  function handleViewportMouseDownCapture(e) {
    clickAnchorRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleViewportClickCapture(e) {
    if (Date.now() < treeSwapClickUntilRef.current) {
      e.preventDefault(); e.stopPropagation();
      multiClickRef.current.cancel();
      return;
    }
    const mc = multiClickRef.current;
    const anchor = clickAnchorRef.current;
    const dragged = !anchor || isDragGesture(anchor, { x: e.clientX, y: e.clientY });
    // Kéo, bấm trúng một vật thể, hoặc không có quyền sửa: chuỗi đứt tại đây.
    if (role === "viewer" || dragged || !isBoardBackground(e.target)) { mc.cancel(); return; }

    // Đích của cú bấm đi vào bộ đếm: một nét vẽ, hay nền trống (null). Đổi đích
    // là chuỗi bắt đầu lại, nên bấm một cái lên nét rồi một cái lên nền không
    // cộng thành cú đổi nét nào.
    const hitId = dashTargetAt(e);
    const count = mc.click(Date.now(), hitId);
    if (hitId == null) return;

    // Làm NGAY ở lần thứ hai. Đóng chuỗi ngay sau khi làm: bấm thêm hai lần
    // nữa là đổi ngược lại, chứ không phải lần thứ ba lại lật thêm một phát.
    if (count >= 2) { mc.cancel(); toggleDrawingDash(hitId); }
  }

  // Suppress the browser's native context menu across the whole page, so
  // right-click is free for our own gestures (chip → badge editor, drag to
  // pan). Text inputs keep the native menu so Copy/Paste still works there.
  function handlePageContextMenu(e) {
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    e.preventDefault();
  }

  // Thả badge/màu vào một thẻ ĐANG nằm trong vùng chọn nhiều thì cả vùng chọn
  // nhận — cùng quy tắc với menu màu chuột phải (xem chỗ dựng ColorMenu bên
  // dưới). Thả vào thẻ NGOÀI vùng chọn thì chỉ thẻ đó, và vùng chọn để nguyên:
  // ở đó ý người dùng rõ ràng là gán cho đúng cái thẻ mình vừa nhắm.
  function dropIdsFor(kind, id) {
    const sel = kind === "edge" ? selectedEdgeIds : (kind === "drawing" ? selectedDrawingIds : selectedIds);
    return sel.size > 1 && sel.has(id) ? Array.from(sel) : [id];
  }

  // Viền "sắp thả vào đây" phải sáng ở MỌI thẻ sắp nhận, không chỉ thẻ dưới con
  // trỏ: thả badge vào một thẻ trong vùng chọn nhiều thì cả vùng đổi, mà chỉ tô
  // một thẻ thì hình ảnh nói sai việc sắp xảy ra.
  // Chỉ nới cho cú kéo badge/màu. `dropTargetId` còn được cú kéo dây dùng, và ở
  // đó đích thật sự chỉ có một thẻ.
  function isNodeDropTarget(nodeId) {
    if (!dropTargetId || dropTargetId.kind !== "node") return false;
    if (dropTargetId.id === nodeId) return true;
    if (!chipDrag && !colorDrag) return false;
    return selectedIds.size > 1 && selectedIds.has(dropTargetId.id) && selectedIds.has(nodeId);
  }

  function startPan(e) {
    e.preventDefault();
    // Tự lia nền → thôi bám theo người khác. Đặt ở đây (mousedown) chứ không
    // trong onMove: người dùng vừa chạm vào là dừng ngay, không phải đợi camera
    // giằng co với vòng bám qua vài khung hình.
    stopFollow();
    const startX = e.clientX, startY = e.clientY;
    const startPanX = view.panX, startPanY = view.panY;
    let dragging = false;
    const THRESHOLD = 4;

    const onMove = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) {
        dragging = true;
        setIsPanning(true);
      }
      if (!dragging) return;
      const nx = startPanX + (ev.clientX - startX);
      const ny = startPanY + (ev.clientY - startY);
      setView((prev) => ({ ...prev, panX: nx, panY: ny }));
    };
    function onUp() {
      if (dragging) {
        setIsPanning(false);
        // KHÔNG lưu: lia sa bàn chỉ đổi camera, mà camera là riêng từng người
        // (api.js đã bỏ `view` khỏi payload). Lần PUT ở đây không ghi được gì,
        // nhưng vẫn đẩy cả board — kể cả ảnh base64 — lên server rồi bắt server
        // phát board:update cho MỌI người khác. Mỗi cú lia nền của một người là
        // một cú giật trên màn hình tất cả những người còn lại.
        suppressContextMenuRef.current = true;
        setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
      }
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  function handleViewportMouseDown(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    if (linkMode) { setPendingSource(null); return; }
    if (e.button === 2) { startPan(e); return; }
    if (e.button !== 0) return;
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    // Nét vẽ phải xét TRƯỚC vùng quét: cú bấm nào cũng rơi xuống nền canvas
    // (lớp vẽ không nhận chuột), nên nếu quét trước thì không bao giờ chạm được
    // vào một nét. Nét vẽ sau cùng nằm trên, nên trúng nhiều thì lấy cái trên.
    const p = eventToCanvas(e);
    const hits = drawingsHitBy(board.drawings || [], p, PICK_RADIUS);
    if (hits.length) { handleDrawingMouseDown(e, hits[hits.length - 1]); return; }
    // Khoảng TRỐNG bên trong vùng chọn: kéo cả cụm. Trước đây chỗ này quét vùng,
    // nghĩa là muốn dời một cụm đã gom xong thì phải nhắm cho trúng đúng một cái
    // thẻ hay đúng một cái nét — càng nhiều thứ mảnh trong cụm thì càng khó nhắm,
    // mà trượt một cái là mất luôn cả vùng chọn vừa gom.
    //
    // Ctrl vẫn đi đường quét: ở đó Ctrl nghĩa là "đang cộng dồn lựa chọn", và
    // vùng quét mới hoàn toàn có thể bắt đầu từ bên trong vùng chọn cũ.
    if (selBounds && !e.ctrlKey && !e.metaKey && pointInBounds(selBounds, p, SEL_GRAB_PAD / view.scale)) {
      startSelectionDrag(e);
      return;
    }
    handleMarqueeMouseDown(e);
  }

  // Mode Laser. Vệt CHỈ chạy khi đang giữ chuột trái — thả ra là không vẽ gì
  // nữa, đúng như cầm một cây laser thật phải bấm mới sáng. Nhờ vậy di chuột
  // qua bảng để đọc nội dung không để lại vệt nào.
  function handleLaserMouseDown(e) {
    // Nhường đường cho lia bảng y như .ink-capture: chuột phải và Space+trái
    // vẫn lia được.
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (!viewportRef.current || !boardRef.current) return;
    const p = eventToCanvas(e);
    laserDownRef.current = true;
    laser.begin(p.x, p.y, laserPrefs);
  }

  // Cố ý KHÔNG gắn listener vào window như useInk.js làm. Ở đó bắt buộc phải
  // gắn window vì thả chuột ngoài khung nhìn mà không nhận được `mouseup` là
  // nét vẽ treo lại vĩnh viễn và không bao giờ được lưu. Ở đây lượt chỉ chẳng
  // có gì để commit, mà .laser-capture lại phủ kín khung nhìn — rời khỏi nó là
  // rời khỏi bảng, nên `onMouseLeave` đủ để đóng lượt. Đổi lại: không có
  // listener nào sống sót ra ngoài lượt, nên không có đường nào rò như bẫy
  // "blur giữa nét" mà useInk.js phải dựng cả một cleanupRef để chặn.
  function handleLaserMouseMove(e) {
    if (!laserDownRef.current) return;
    if (!viewportRef.current || !boardRef.current) return;
    const p = eventToCanvas(e);
    laser.track(p.x, p.y, laserPrefs);
  }

  function handleLaserMouseUp() {
    if (!laserDownRef.current) return;
    laserDownRef.current = false;
    laser.end();
  }

  // Chuột → toạ độ canvas. Bản sao của toCanvas trong useInk.js; không gom
  // chung được vì ở đó nó nhận `view` qua ref của hook, còn ở đây board đã có
  // sẵn trong tầm tay.
  function clientToCanvas(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.panX) / view.scale,
      y: (clientY - rect.top - view.panY) / view.scale
    };
  }

  function eventToCanvas(e) {
    return clientToCanvas(e.clientX, e.clientY);
  }

  // Mọi thao tác CHỈ đổi camera đều đi qua đây. Camera là riêng từng người: nó
  // được lưu vào localStorage bằng effect theo view, còn api.js thì đã cắt
  // `view` khỏi payload PUT từ lâu. Vì vậy gọi saveNow/store.commit ở nhóm hàm
  // này (bản cũ có ở zoom, vừa khung, nhảy tới thẻ/khung, thoát trình chiếu)
  // KHÔNG ghi được gì lên server, nhưng vẫn đẩy cả board kèm ảnh base64 đi và
  // bắt server phát board:update cho mọi người — nghĩa là chỉ cần một người
  // cuộn chuột là màn hình của tất cả những người còn lại bị dựng lại.
  //
  // Đây cũng là chỗ huỷ ghim màn hình: người dùng tự lái camera thì thôi bám
  // theo người khác. Không có chốt này thì họ zoom xong màn hình bị kéo ngược
  // lại ngay lập tức — trông y như app treo. Vòng bám đi cửa riêng
  // (applyFollowCamera) nên không tự huỷ mình ở đây.
  function setCamera(nextView) {
    stopFollow();
    setView(nextView);
  }

  function zoomButton(factor) {
    const rect = viewportRef.current.getBoundingClientRect();
    setCamera(computeZoom(view, rect, rect.left + rect.width / 2, rect.top + rect.height / 2, factor));
  }

  // Bấm/kéo trên minimap: chỉ dời camera, giữ nguyên mức phóng. Camera là của
  // riêng từng người (api.js không gửi `view` lên server) nên đây không phải một
  // sửa đổi board — không ghi lịch sử, không lưu, không phát cho ai.
  function goToPoint(pt) {
    const el = viewportRef.current;
    if (!el) return;
    // Bấm/kéo trên minimap cũng là tự lái camera → thôi bám theo người khác.
    stopFollow();
    const rect = el.getBoundingClientRect();
    const view = viewRef.current;
    setView((prev) => ({ ...prev, ...panForCenter(pt, view, { w: rect.width, h: rect.height }) }));
  }

  function fitToView() {
    if (board.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    board.nodes.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function deleteSelection() {
    const ids = selectedIds;
    const edgeIds = selectedEdgeIds;
    const groupIds = selectedGroupIds;
    const drawIds = selectedDrawingIds;
    if (ids.size === 0 && edgeIds.size === 0 && groupIds.size === 0 && drawIds.size === 0) return;
    // Xoá khung chỉ bỏ CÁI KHUNG, thẻ bên trong ở nguyên — đúng như nút × trên
    // khung vẫn làm. Khung là một cái vòng vẽ quanh, không phải cái hộp sở hữu
    // thẻ; xoá nhầm mà mất luôn cả cụm ý tưởng thì quá đắt.
    store.commit({
      ...board,
      nodes: board.nodes.filter((n) => !ids.has(n.id)),
      groups: board.groups.filter((g) => !groupIds.has(g.id)),
      drawings: (board.drawings || []).filter((d) => !drawIds.has(d.id)),
      edges: board.edges.filter((e) => !(
        edgeIds.has(e.id) ||
        (ids.has(e.from) && (e.fromKind || "node") === "node") ||
        (ids.has(e.to) && (e.toKind || "node") === "node") ||
        (groupIds.has(e.from) && (e.fromKind || "node") === "group") ||
        (groupIds.has(e.to) && (e.toKind || "node") === "group")
      ))
    });
    clearSelection();
  }

  function applyToSelection(patch) {
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, ...patch } : n))
    });
  }

  // Màu là thuộc tính duy nhất mà thẻ và khung dùng chung một bộ token, nên nó
  // là thứ duy nhất áp được cho cả hai trong một cú bấm.
  function applyColorToSelection(color) {
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, color } : n)),
      groups: board.groups.map((g) => (selectedGroupIds.has(g.id) ? { ...g, color } : g)),
      // Nét vẽ không có khái niệm "không màu" (một nét không màu là nét vô
      // hình), nên ô "Không màu" bỏ qua chúng thay vì làm chúng biến mất.
      drawings: color == null
        ? (board.drawings || [])
        : (board.drawings || []).map((d) => (selectedDrawingIds.has(d.id) ? { ...d, color } : d))
    });
  }

  function tidySelection() {
    if (selectedIds.size < 2) return;
    const selected = board.nodes
      .filter((n) => selectedIds.has(n.id) && !n.locked && !layoutOwners.has(edgeKey("node", n.id)))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));       // thứ tự đọc
    if (selected.length < 2) return;
    const items = selected.map((n) => ({ id: n.id, ...frameCardSize(n.id) }));
    const origin = {
      x: Math.min(...selected.map((n) => n.x)),
      y: Math.min(...selected.map((n) => n.y))
    };
    // Chỉ cạnh thẻ–thẻ mới định tầng; cạnh dính khung không nói gì về thứ tự thẻ.
    const links = board.edges.filter(
      (e) => (e.fromKind || "node") === "node" && (e.toKind || "node") === "node"
    );
    const pos = layerLayout(items, links, origin);
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => (pos.has(n.id) ? { ...n, ...pos.get(n.id) } : n))
    });
  }

  function zoomToNodes(ids) {
    if (!ids || ids.length === 0) return;
    const targets = board.nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function zoomToSelection() {
    zoomToNodes(selectedIds.size > 0 ? Array.from(selectedIds) : board.nodes.map((n) => n.id));
  }

  function jumpToCard(id) {
    setSelectedIds(new Set([id]));
    zoomToNodes([id]);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

  // Đưa con trỏ của một người khác vào giữa màn hình. Camera là dữ liệu riêng
  // từng máy (lib/camera.js) nên chỉ setBoard, không commit vào lịch sử undo —
  // nhìn sang chỗ đồng đội không phải là một thao tác sửa board.
  //
  // Đi qua setCamera (không setBoard thẳng) để nó huỷ ghim: đang bám màn hình A
  // mà bấm nhảy tới con trỏ B thì vòng bám sẽ kéo ngược về A ngay khung hình
  // sau, và cú bấm trông như không có tác dụng gì.
  function jumpToPeer(peer) {
    const rect = viewportRef.current.getBoundingClientRect();
    const { scale } = view;
    setCamera({ scale, panX: rect.width / 2 - peer.x * scale, panY: rect.height / 2 - peer.y * scale });
    // Con trỏ peer nhỏ và có thể đang đứng yên giữa một rừng thẻ — nháy sáng
    // một nhịp để mắt bắt được sau khi màn hình vừa nhảy.
    setSpotlightPeerId(peer.socketId);
    setTimeout(() => setSpotlightPeerId((cur) => (cur === peer.socketId ? null : cur)), 1600);
  }

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

  function openColorMenu(e, kind, id) {
    e.preventDefault();
    e.stopPropagation();
    if (suppressContextMenuRef.current) { suppressContextMenuRef.current = false; return; }
    setEdgeMenu(null);
    setCommentsFor(null);
    setColorMenu({ kind, id, x: e.clientX, y: e.clientY });
  }


  return (
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
      {/* ĐẢO TO — góc trên trái. Vừa là bảng điều khiển (☰, tên board, tìm kiếm,
          bật/tắt panel) vừa là CHỖ NEO của các đảo nhỏ. Nó co lại còn bằng đúng
          hàng nút của mình khi không panel nào neo vào, nên bảng trống thì không
          còn một pixel nào bị chiếm — khác hẳn .topbar + .filterbar cũ ăn ~140px
          vĩnh viễn. */}
      <div className="island tl">
        <div className="island-row">
          {/* Một ☰ duy nhất thay cho ba menu Board/Dữ liệu/Xem + cụm thiết lập:
              tất cả đều là việc thỉnh thoảng mới làm, không đáng chiếm mặt tiền.
              data-mutating = móc CSS đánh dấu control ghi dữ liệu board; ở chế độ
              chỉ xem chúng bị vô hiệu hoá, phần còn lại vẫn dùng được.
              "Mời thành viên" nằm ở PresenceBar (đảo người), cạnh danh sách người
              đang mở board — mời ai đó là việc của cùng một mạch suy nghĩ. */}
          <TopMenu label={<IconMenu />} title={t`Menu`}>
            <Link to="/idea-map" className="btn ghost"><Trans>← Danh sách board</Trans></Link>
            <div className="menubar-sep" />
            <button className="btn ghost" onClick={() => { setIoMode("export"); setIoText(JSON.stringify(board.kind === "game-design" ? exportPackage({ ...board, view, name: boardName }) : { ...board, view }, null, 2)); setIoOpen(true); }}><Trans>Xuất JSON</Trans></button>
            <button className="btn ghost" onClick={exportVersionedJson}><Trans>Tải JSON</Trans></button>
            <button className="btn ghost" data-mutating onClick={() => { setIoMode("import"); setIoText(""); setIoOpen(true); }}><Trans>Nhập JSON</Trans></button>
            <button className="btn ghost" onClick={openSnapshots}>Snapshots</button>
            {/* Dung lượng PDF đứng cùng nhóm "dữ liệu" với Xuất/Nhập JSON, không
                đứng cùng nhóm "cách xem" — nó nói về thứ đang chiếm chỗ trên
                kho, chứ không đổi gì trên màn hình. */}
            <PdfUsage />
            <div className="menubar-sep" />
            <button className="btn ghost" disabled={board.groups.length === 0} onClick={startPresentation}><Trans>Trình chiếu</Trans></button>
            <button className={"btn ghost toggle" + (outlineOpen ? " active" : "")} onClick={() => setOutlineOpen((v) => !v)}><Trans>Mục lục</Trans></button>
            {/* Ngôn ngữ, sáng/tối và skin đã rời menu này sang panel Giao diện ở
                thanh đáy — chúng cùng một họ với nền bảng và bộ màu, để rải hai
                chỗ thì muốn chỉnh giao diện phải nhớ mở hai nơi. Còn lại ở đây
                đúng ba nhóm: đi đâu, dữ liệu, và cách xem. */}
          </TopMenu>

          <span className="island-name" title={boardName}>{boardName}</span>

          <button
            type="button"
            className={"island-btn" + (searchOpen ? " on" : "")}
            title={t`Tìm kiếm (Ctrl+F)`}
            onClick={toggleSearch}
          ><IconSearch /></button>
          {searchOpen && (
            <div className="search-box">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t`Tìm theo tên/mô tả…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); goToMatch(e.shiftKey ? -1 : 1); }
                  // Escape đóng ô tìm — cùng phản xạ với mọi ô nhập khác trong app.
                  if (e.key === "Escape") { e.preventDefault(); toggleSearch(); }
                }}
              />
              {search.trim() && (
                <>
                  <span className="search-count mono">{matches.length ? matchIdx + 1 : 0}/{matches.length}</span>
                  <button type="button" className="island-btn" title={t`Kết quả trước (Shift+Enter)`} onClick={() => goToMatch(-1)}>↑</button>
                  <button type="button" className="island-btn" title={t`Kết quả sau (Enter)`} onClick={() => goToMatch(1)}>↓</button>
                </>
              )}
            </div>
          )}

          <div className="island-sep" />

          {/* Giao diện đứng ở ĐÂY chứ không ở thanh đáy: ba nút dưới đó mở ra bộ
              LỌC (bấm chip là thẻ bị làm mờ), còn cái này là THIẾT LẬP, không lọc
              gì cả. Cùng một dải chỉ cách nhau một vạch ngăn thì vẫn đọc ra là
              cùng loại — phải tách hẳn sang chỗ khác.
              Nội dung bung ra ngay dưới nút, không hiện tuốt dưới đáy: bấm ở đây
              mà kết quả nhảy ra chỗ khác thì mắt phải đi tìm. */}
          <TopMenu label={<IconBoardStyle />} title={t`Giao diện`} wide closeOnClick={false}>
            {/* Ranh giới quan trọng nhất của bảng này: ba hàng trên chỉ đổi cho
                MÌNH (localStorage), hai hàng dưới ghi vào dữ liệu board nên MỌI
                NGƯỜI cùng thấy. Không nói rõ thì người ta đổi nền bảng mà tưởng
                chỉ mình thấy. Hai hàng dưới đã mang data-mutating nên tài khoản
                chỉ xem thấy chúng mờ đi — thêm một tín hiệu nữa cùng hướng. */}
            <div className="theme-section"><Trans>Chỉ mình bạn thấy</Trans></div>
            <div className="theme-row workspace-settings">
              <span role="status" aria-live="polite">{workspace.status === "account-changed" ? t`Tài khoản đã thay đổi — tải lại trang để đồng bộ` : workspace.status === "local" ? t`Giao diện lưu trên máy — chờ đồng bộ` : workspace.status === "saved" ? t`Giao diện đã đồng bộ` : t`Đang lưu giao diện…`}</span>
              <button type="button" className="btn ghost small" onClick={() => {
                const defaults = normalizeWorkspace();
                workspace.update({ ...defaults, camera: { x: viewportSize.w / 2, y: viewportSize.h / 2, scale: 1 } });
                const view = { panX: 0, panY: 0, scale: 1 };
                workspaceCameraRef.current = { controller: workspace.controller, hydration: workspace.hydration, ...viewportSize, applying: view };
                setView(view);
                void workspace.flush();
              }}><Trans>Đặt lại giao diện</Trans></button>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Ngôn ngữ</Trans></span>
              <div className="fb-chips"><LocaleToggle /></div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Sáng/tối</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (theme === "light" ? " active" : "")}
                  onClick={() => setTheme("light")}
                ><Trans>Sáng</Trans></button>
                <button
                  className={"btn ghost toggle" + (theme === "dark" ? " active" : "")}
                  onClick={() => setTheme("dark")}
                ><Trans>Tối</Trans></button>
              </div>
            </div>
            {/* Cuộn hai ngón nghĩa là gì. Đứng ở nhóm "chỉ mình bạn thấy" vì nó
                là chuyện CÁI MÁY đang cầm, không phải chuyện cái bảng: cùng một
                board mở trên laptop và trên máy có chuột rời thì hai người muốn
                hai hành vi khác nhau.
                "Tự động" nhận thiết bị theo dấu hiệu của từng sự kiện wheel và
                đúng gần hết các trường hợp — nhưng trên macOS thì nút lăn chuột
                cho ra đúng những con số mà touchpad cho, không có cách nào tách.
                Đó là lý do hai nút chọn tay tồn tại, không phải để cho đủ bộ. */}
            <div className="theme-row">
              <span className="fb-count"><Trans>Cuộn hai ngón</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (wheelMode === "auto" ? " active" : "")}
                  title={t`Nhận thiết bị theo cách cuộn: touchpad thì lia bảng, nút lăn thì thu phóng`}
                  onClick={() => setWheelMode("auto")}
                ><Trans>Tự động</Trans></button>
                <button
                  className={"btn ghost toggle" + (wheelMode === "pan" ? " active" : "")}
                  title={t`Cuộn luôn là lia bảng. Chụm hai ngón (hoặc Ctrl+cuộn) để thu phóng`}
                  onClick={() => setWheelMode("pan")}
                ><Trans>Lia bảng</Trans></button>
                <button
                  className={"btn ghost toggle" + (wheelMode === "zoom" ? " active" : "")}
                  title={t`Cuộn luôn là thu phóng. Giữ Shift để lia bảng`}
                  onClick={() => setWheelMode("zoom")}
                ><Trans>Thu phóng</Trans></button>
              </div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Kiểu vẽ</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (skin !== "sketch" ? " active" : "")}
                  onClick={() => { if (skin === "sketch") toggleSkin(); }}
                ><Trans>Sạch</Trans></button>
                <button
                  className={"btn ghost toggle" + (skin === "sketch" ? " active" : "")}
                  onClick={() => { if (skin !== "sketch") toggleSkin(); }}
                ><IconSketch /> <Trans>Vẽ tay</Trans></button>
              </div>
            </div>

            <div className="theme-section"><Trans>Mọi người cùng thấy</Trans></div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Nền bảng</Trans></span>
              <div className="fb-chips">
                {/* Nút đầu là "theo giao diện" (bg = null): nền chạy theo sáng/tối
                    như trước khi có preset. Nó KHÔNG nằm trong BOARD_BGS vì đó là
                    danh sách preset, còn đây là "không preset nào". */}
                <button
                  className={"bg-swatch bg-none" + (board.bg == null ? " on" : "")}
                  data-mutating
                  disabled={role === "viewer"}
                  onClick={() => setBoardBg(null)}
                  title={t`Theo giao diện sáng/tối`}
                />
                {BOARD_BGS.map((id) => (
                  <button
                    key={id}
                    className={"bg-swatch" + (board.bg === id ? " on" : "")}
                    data-bg={id}
                    data-mutating
                    disabled={role === "viewer"}
                    onClick={() => setBoardBg(id)}
                    title={BG_LABEL[id]}
                  />
                ))}
              </div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Lưới</Trans></span>
              <div className="fb-chips">
                {/* Lưới chấm là kiểu duy nhất có từ đầu nên nó là grid = null,
                    y hệt "theo giao diện" ở hàng nền: board cũ trong DB không có
                    field này và phải vẽ ra đúng như trước. */}
                <button
                  className={"grid-swatch" + (board.grid == null ? " on" : "")}
                  data-grid="dots"
                  data-mutating
                  disabled={role === "viewer"}
                  onClick={() => setBoardGrid(null)}
                  title={GRID_LABEL.dots}
                />
                {BOARD_GRIDS.map((id) => (
                  <button
                    key={id}
                    className={"grid-swatch" + (board.grid === id ? " on" : "")}
                    data-grid={id}
                    data-mutating
                    disabled={role === "viewer"}
                    onClick={() => setBoardGrid(id)}
                    title={GRID_LABEL[id]}
                  />
                ))}
              </div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Bộ màu</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (board.pack == null ? " active" : "")}
                  data-mutating
                  disabled={role === "viewer"}
                  onClick={() => setBoardPack(null)}
                ><Trans>Cổ điển</Trans></button>
                {COLOR_PACKS.map((id) => (
                  <button
                    key={id}
                    className={"btn ghost toggle" + (board.pack === id ? " active" : "")}
                    data-mutating
                    disabled={role === "viewer"}
                    onClick={() => setBoardPack(id)}
                  >{PACK_LABEL[id]}</button>
                ))}
              </div>
            </div>
          </TopMenu>
        </div>

        {board.kind === "game-design" && <div className="island-row gd-tools-row">
          {board.kind === "game-design" && <button
            type="button"
            className="btn ghost gd-tools-toggle"
            aria-expanded={toolsOpen}
            aria-controls="game-design-toolbar"
            title={toolsOpen ? t`Thu gọn công cụ thiết kế` : t`Mở công cụ thiết kế`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => workspace.update({ toolsOpen: !toolsOpen })}
          ><Trans>Thiết kế</Trans> <span aria-hidden="true">{toolsOpen ? "▾" : "▸"}</span></button>}

          {board.kind === "game-design" && <div id="game-design-toolbar" className="gd-toolbar-actions" hidden={!toolsOpen}>

          {board.kind === "game-design" && <button
            type="button"
            className={"btn ghost gd-brief-trigger" + (briefOpen ? " active" : "")}
            title="Mở Game brief"
            onClick={() => {
              setDesignEditId(null);
              setSelectedEdgeIds(EMPTY_SET);
              setFlowOpen(false);
              setHandoffOpen(false);
              setDecisionTimelineOpen(false);
              setBriefOpen(true);
            }}
          >Game brief</button>}

          {board.kind === "game-design" && <button
            type="button"
            className={"btn ghost gd-brief-trigger" + (flowOpen ? " active" : "")}
            title="Mở Game flow"
            onClick={() => {
              setDesignEditId(null);
              setSelectedEdgeIds(EMPTY_SET);
              setBriefOpen(false);
              setHandoffOpen(false);
              setDecisionTimelineOpen(false);
              setFlowOpen(true);
            }}
          >Game flow</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (balanceOpen ? " active" : "")} title="Mở Balance sheet" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setBalanceOpen(true); }}>Balance</button>}

          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (handoffOpen ? " active" : "")} title="Mở Team handoff" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setDecisionTimelineOpen(false); setHandoffOpen(true); }}>Handoff</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (decisionTimelineOpen ? " active" : "")} title="Mở Decision timeline" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(true); }}>Decisions</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (insightsOpen ? " active" : "")} title="Mở Game Design insights" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setInsightsOpen(true); }}>Insights</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (impactOpen ? " active" : "")} title="Mở dependency impact map" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setInsightsOpen(false); setReportsOpen(false); setImpactCardId(null); setImpactOpen(true); }}>Impact</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (playtestsOpen ? " active" : "")} onClick={() => { setDesignEditId(null); setPlaytestsOpen(true); }}>Playtests</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (reportsOpen ? " active" : "")} title="Mở Report Center" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setReportsOpen(true); }}>Reports</button>}
          </div>}
        </div>}

        {activeFilterCount > 0 && (
          <div className="fb-tail">
            <span className="fb-count mono" title={t`Số ý tưởng khớp bộ lọc`}>
              <Trans>Khớp {matchCount}/{board.nodes.length}</Trans>
            </span>
            <button className="fb-clear" onClick={clearFilters}><Trans>Xoá lọc</Trans></button>
          </div>
        )}

      </div>

      {/* THANH ĐÁY — đảo nút bật panel, và ngay cạnh nó là đảo nội dung của panel
          đang bật. Panel chỉ sống ở đúng chỗ này: không neo, không nổi, không kéo
          đi đâu được. Đổi lại thì cũng không còn cách nào làm mất nó. */}
      <div className="hud-bottom">
        <div className="island">
          <div className="island-row">
            <button type="button" className={"island-btn" + (panels.status ? " on" : "")} title={t`Trạng thái`} onClick={() => togglePanel("status")}><IconStatus /></button>
            <button type="button" className={"island-btn" + (panels.tag ? " on" : "")} title={t`Nhãn`} onClick={() => togglePanel("tag")}><IconTag /></button>
            <button type="button" className={"island-btn" + (panels.palette ? " on" : "")} title={t`Bảng màu`} onClick={() => togglePanel("palette")}><IconPalette /></button>
            {/* ★ xuống đây theo ba nút kia: nó cũng là BỘ LỌC. Ở lại đảo trên trái
                thì nó đứng lẫn giữa menu, tên board và tìm kiếm — đúng kiểu trộn
                mà cả nhóm này vừa được dọn cho hết. Khác ba nút bên trái ở chỗ nó
                không mở ra khối nội dung nào, bật là ăn ngay. */}
            <button type="button" className={"island-btn" + (filterFav ? " on" : "")} title={t`Chỉ hiện thẻ yêu thích`} onClick={() => setFilterFav((v) => !v)}><IconStar /></button>
          </div>
        </div>

        {anyPanelOn && (
        <div className="island">
        <div className="filter-dock">
        {panels.status && (
          <FilterPanel title={t`Trạng thái`}>
            <div className="fb-chips">
              {board.statuses.map((s) => {
                const key = String(s.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle status" + (filterStatus[key] ? " on" : "")}
                    data-badge-kind="status"
                    data-badge-id={s.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "status", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "status", s)}
                    onClick={() => setFilterStatus((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán trạng thái — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(s.color) }}></span>
                    {s.name}
                  </span>
                );
              })}
              {hasNoStatus && (
                <span
                  className={"chip-toggle status" + (filterStatus["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "status", "none")}
                  onClick={() => setFilterStatus((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa có trạng thái`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không trạng thái</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "status")} title={t`Thêm trạng thái`}>+</button>
            </div>
          </FilterPanel>
        )}

        {panels.tag && (
          <FilterPanel title={t`Nhãn`}>
            <div className="fb-chips">
              {board.tags.map((tg) => {
                const key = String(tg.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle tag" + (filterTags[key] ? " on" : "")}
                    data-badge-kind="tag"
                    data-badge-id={tg.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "tag", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "tag", tg)}
                    onClick={() => setFilterTags((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán nhãn — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(tg.color) }}></span>
                    {tg.name}
                  </span>
                );
              })}
              {hasNoTag && (
                <span
                  className={"chip-toggle tag" + (filterTags["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "tag", "none")}
                  onClick={() => setFilterTags((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa gắn nhãn`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không nhãn</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "tag")} title={t`Thêm nhãn`}>+</button>
            </div>
          </FilterPanel>
        )}

        {panels.palette && (
          <FilterPanel title={t`Bảng màu`}>
            <div className="fb-chips">
              {board.palette.map((c) => (
                <button
                  key={c.id}
                  className="pal-swatch"
                  style={{ background: colorVar(`pal-${c.id}`) }}
                  onMouseDown={(e) => handleColorMouseDown(e, `pal-${c.id}`)}
                  onClick={(e) => openPaletteEditor(e, c)}
                  title={t`Bấm để sửa màu — kéo thả vào thẻ / dây / badge để tô màu`}
                />
              ))}
              <button className="fb-add" onClick={(e) => openPaletteEditor(e, null)} title={t`Thêm màu`}>+</button>
            </div>
            {board.palette.length === 0 && (
              <span className="fb-count"><Trans>Chưa có màu nào — bấm + để tạo.</Trans></span>
            )}
          </FilterPanel>
        )}
        </div>
        </div>
        )}
      </div>

      {/* ĐẢO NGƯỜI — góc trên phải. Ai đang mở board + nút mời. */}
      <div className="island tr">
        <div className="island-row">
          <PresenceBar
            user={user}
            socket={socket}
            canInvite={role === "owner"}
            onInvite={() => setInviteOpen(true)}
            onJumpToPeer={jumpToPeer}
            onLogout={logout}
            followingId={followingId}
            watcherCount={watcherCount}
            onFollowPeer={follow}
            onStopFollow={stopFollow}
          />
        </div>
      </div>

      <FollowBanner
        socket={socket}
        followingId={followingId}
        pendingId={pendingId}
        followError={followError}
        onStop={stopFollow}
      />

      {/* ĐẢO HOÀN TÁC — góc dưới trái, đối xứng với nút zoom ở góc dưới phải:
          cả hai đều là thao tác lên TRẠNG THÁI khung nhìn/bảng chứ không tạo ra
          nội dung, nên chúng thuộc về đáy màn hình, không phải mặt tiền.
          Chỗ này trước đây trống hoàn toàn. */}
      <div className="island bl">
        <div className="island-row">
          <button type="button" className="island-btn" data-mutating onClick={undo} disabled={past.length === 0} title={t`Hoàn tác (Ctrl+Z)`}><IconUndo /></button>
          <button type="button" className="island-btn" data-mutating onClick={redo} disabled={future.length === 0} title={t`Làm lại (Ctrl+Shift+Z)`}><IconRedo /></button>
          {saveError && (
            <span style={{ fontSize: 11, color: "var(--danger)", paddingRight: 4 }}>
              <Trans>Không lưu được lên server.</Trans>
            </span>
          )}
        </div>
      </div>

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
        <ToolRail
          mode={mode}
          tool={tool}
          placeTool={mode === "place" ? placeTool : null}
          canEdit={role !== "viewer"}
          linkMode={linkMode}
          gameDesign={board.kind === "game-design"}
          onGameTemplate={addGameDesignCard}
          onMode={enterMode}
          onTool={(next) => { enterMode("draw"); setTool(next); }}
          onPlace={armPlace}
          onToggleLink={toggleLinkMode}
          onCapture={() => setCaptureOpen(true)}
        />
        {(mode === "draw" || mode === "place" || mode === "laser") && (
          <ToolOptions
            tool={mode === "place" ? placeTool : (mode === "laser" ? "laser" : tool)}
            // Laser có bộ nhớ riêng: màu thì cùng bảng với bút nhưng độ đậm là
            // đơn vị khác hẳn, nên hai thứ không được dùng chung một object.
            prefs={mode === "laser" ? laserPrefs : penPrefs}
            onPrefs={mode === "laser" ? setLaserPrefs : setPenPrefs}
            level={cardLevelPref}
            onLevel={setCardLevelPref}
          />
        )}
        {mode === "draw" && (
          <div className="ink-capture" style={{ cursor: eraseCursor }} onMouseDown={handleInkCaptureMouseDown} />
        )}
        {/* Vòng báo "đang giữ tay" — hiện ngay dưới con trỏ khi tay đứng lại.
            BA việc dùng chung một vòng: sắp BẮT HÌNH (nét vừa vẽ về hình chuẩn),
            sắp TẨY nét đang nằm dưới tay, và sắp ĐỔI bút ↔ cục gôm. `kind` thành
            luôn tên class nên mỗi việc một màu, và nét sắp bị tẩy thì mờ đi song
            song (useInk gọi setEraseIds).
            Không có vòng này thì cả hai cử chỉ đều vô hình: người dùng chỉ tình
            cờ gặp một lần rồi không hiểu vừa xảy ra chuyện gì.
            position: fixed nên toạ độ là toạ độ MÀN HÌNH, không phải toạ độ
            canvas — nó bám ngón tay, không bám bảng.
            Thời gian chạy do useInk tính sẵn và gửi kèm: hai chỗ giữ hai con số
            rồi lệch nhau thì vòng đầy xong mà chưa có gì xảy ra (hoặc ngược
            lại), và đó là kiểu lỗi không ai đọc code ra được. */}
        {ink.snapHint && (
          <div
            className={"snap-hint " + ink.snapHint.kind}
            style={{
              left: ink.snapHint.x,
              top: ink.snapHint.y,
              "--snap-hold": `${ink.snapHint.ms}ms`
            }}
          />
        )}
        {/* Cùng vai trò .ink-capture: phủ kín khung nhìn để di chuột ngang qua
            một cái thẻ vẫn ra vệt laser chứ không bị thẻ ăn mất chuột. */}
        {mode === "laser" && (
          <div
            className="laser-capture"
            onMouseDown={handleLaserMouseDown}
            onMouseMove={handleLaserMouseMove}
            onMouseUp={handleLaserMouseUp}
            // Rời khỏi lớp phủ (ra mép màn hình, hay đi lên thanh công cụ) thì
            // đóng lượt luôn: `mouseup` sau đó sẽ không rơi vào đây nữa, và bỏ
            // sót nó là lượt chỉ treo lại — quay vào bảng là vẽ tiếp dù đã thả
            // chuột từ lâu.
            onMouseLeave={handleLaserMouseUp}
          />
        )}
        {/* Ô nhập text. Nằm NGOÀI .canvas nên phải tự nhân camera vào: .canvas
            khai will-change: transform → nó là một stacking context, con của nó
            không thể nổi lên trên .ink-capture (z-index 8) để nhận được chuột.
            Cái giá là toạ độ và cỡ chữ phải tự quy đổi ở đây — bù lại ô nhập
            vẫn trùng khít với chữ sẽ vẽ ra vì dùng chung một phép biến đổi. */}
        {textEdit && (
          <textarea
            className="text-input"
            // Lưới an toàn cho tiêu điểm, thay cho autoFocus (chỉ chạy lúc gắn
            // vào cây). Nếu có thứ gì cướp mất tiêu điểm giữa chừng thì lần vẽ
            // lại kế tiếp đòi lại. Điều kiện activeElement giữ cho nó là lệnh
            // rỗng ở mọi phím gõ, không phải một lệnh focus mỗi ký tự.
            ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
            value={textEdit.value}
            style={{
              left: view.panX + textEdit.x * view.scale,
              top: view.panY + textEdit.y * view.scale,
              fontSize: textEdit.size * view.scale,
              lineHeight: TEXT_LINE_H,
              color: penVar(textEdit.color),
              // Tự nới theo nội dung. Cộng thêm một khoảng cho con trỏ nháy ở
              // cuối dòng dài nhất, không thì gõ tới đâu chữ trượt sang trái tới đó.
              width: (textBox(textLines(textEdit.value), textEdit.size, measureTextWidth).w + 12) * view.scale,
              height: textLines(textEdit.value).length * textEdit.size * TEXT_LINE_H * view.scale
            }}
            onChange={(e) => {
              setTextEdit((prev) => ({ ...prev, value: e.target.value }));
              inkLive.pushText(e.target.value);
            }}
            onBlur={commitText}
            // Escape kết thúc — blur() rồi để onBlur lo phần lưu, nên chỉ có MỘT
            // đường commit. Enter thì XUỐNG DÒNG chứ không kết thúc: chú thích
            // nhiều dòng là chuyện thường, và đó chính là lý do phím kết thúc
            // phải là Escape.
            // Các phím tắt khác (p, e, s, t, Delete…) không cần chặn ở đây:
            // handler keydown chung đã bỏ qua mọi sự kiện phát từ textarea.
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); }
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
        {/* Lớp bắt chuột của mode Đặt: cùng vai trò với .ink-capture, để bấm
            trúng một cái thẻ có sẵn vẫn ra thẻ mới chứ không phải chọn thẻ đó. */}
        {mode === "place" && (
          <div
            className={"place-capture" + (placeTool === "group" ? " draw-frame" : "")}
            onMouseDown={handlePlaceCaptureMouseDown}
          />
        )}
        <BoardCanvas {...{ board, boardId, canGrabShapeHandles, canvasRef, cardHandlers, currentUser, dependency, dropTargetId, edgeDrag, edgeRoutes, editShape, editingGroupTitleId, editingId, flashId, focusSet, frameCardSize, gameDesign, groupById, groupHandlers, handleEdgeEndpointMouseDown, handleInkCaptureMouseDown, handleSelectionResizeMouseDown, handleShapeHandleMouseDown, handleViewportMouseDown, hoveredEdgeId, ink, inkDrawings, inkLive, isNodeDropTarget, laser, layoutOwners, linkDraft, linkMode, liveGroups, liveNodes, marquee, mode, nodeById, observeCard, onEdgeClick, onEdgeContextMenu, onEdgeEnter, onEdgeLeave, passesFilter, pendingSource, placeDraft, role, selBounds, selectedDrawingIds, selectedEdgeIds, selectedGroupIds, selectedIds, selection, setDesignEditId, setHoveredEdgeId, shapeHandleAt, skin, snapGuides, socket, spotlightPeerId, statusDefById, store, tagDefById, textEdit, textOverlay, tool, treeSwapState, view }} />

        {board.nodes.length === 0 && (
          <div className="empty-hint">
            <Trans>Nhấp đúp vào khoảng trống để tạo ý tưởng đầu tiên.</Trans><br />
            <Trans>Chuột trái kéo để bôi đen chọn thẻ, chuột phải kéo để lia sa bàn, cuộn để lia, giữ Ctrl/⌘ + cuộn để phóng to.</Trans>
          </div>
        )}

        {focusSet != null && (
          <div className="focus-banner">
            <Trans>Đang tập trung — Esc để thoát</Trans>
            <button onClick={() => setFocusId(null)}>×</button>
          </div>
        )}

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

        <ZoomControl {...{ fitToView, miniOpen, setMiniOpen, view, zoomButton }} />

        {outlineOpen && (() => {
          const outline = buildOutline(board, frameCardSize);
          const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
          const row = (id) => {
            const n = nodeById.get(id);
            if (!n) return null;
            const s = statusById(board, n.statusId);
            return (
              <button key={id} className="op-row" onClick={() => jumpToCard(id)}>
                <span className="dot" style={{ background: s ? colorVar(s.color) : "transparent" }}></span>
                <span className="op-title">{n.title}</span>
              </button>
            );
          };
          return (
            <div className="outline-panel" onMouseDown={(e) => e.stopPropagation()}>
              <div className="op-head">
                <span className="op-count mono">{board.nodes.length}</span>
                <button className="btn ghost small" onClick={exportMarkdown}><Trans>Xuất MD</Trans></button>
                <button className="btn ghost small" onClick={exportPng}><Trans>Xuất PNG</Trans></button>
                <button className="op-close" onClick={() => setOutlineOpen(false)}>×</button>
              </div>
              <div className="op-body">
                {outline.frames.map(({ group, nodeIds }) => (
                  <div key={"g" + group.id} className="op-section">
                    <button className="op-section-title" onClick={() => jumpToGroup(group)}>
                      {group.title} <span className="mono op-n">{nodeIds.length}</span>
                    </button>
                    {nodeIds.map(row)}
                  </div>
                ))}
                {Array.from(outline.byStatus.entries()).map(([key, ids]) => (
                  <div key={"s" + key} className="op-section">
                    <div className="op-section-title static">
                      {key === "none" ? t`Khác` : (statusById(board, key)?.name ?? t`Khác`)}
                      {" "}<span className="mono op-n">{ids.length}</span>
                    </div>
                    {ids.map(row)}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Bảng Xếp cây — dock bên phải như bảng thuộc tính của Figma. Né sang
            trái khi Mục lục đang mở, hai bảng cùng neo mép phải. */}
        {treeUI && (() => {
          const root = treeUI.kind === "group"
            ? board.groups.find((g) => g.id === treeUI.id)
            : board.nodes.find((n) => n.id === treeUI.id);
          if (!root) return null;             // gốc vừa bị xoá: bảng tự biến mất
          const { order } = buildTree(board.edges, edgeKey(treeUI.kind, treeUI.id));
          return (
            <TreePanel
              canEdit={role !== "viewer"}
              opts={treeOpts}
              locked={!!normalizeTreeLock(root.treeLayoutLock)}
              onLock={toggleTreeLock}
              count={order.length}
              rootTitle={root.title || t`Không tên`}
              shifted={outlineOpen}
              onOpts={previewTree}
              onCommit={commitTree}
              onReset={() => { previewTree(TREE_OPTS); commitTree(); }}
              onClose={closeTreePanel}
            />
          );
        })()}

        <EditDock {...{ applyColorToSelection, applyToSelection, board, boardName, briefOpen, clearSelection, createRelatedDesignNode, createSnapshot, deleteEdge, deleteSelection, dependency, designEditId, duplicateDesignNode, duplicateSelection, editDockRef, groupSelectedCards, hasDashableSelected, impactCardId, insightsOpen, inspector, restoreSnapshot, role, saveDesignNode, saveGameDesignBalance, saveGameDesignBrief, saveGameDesignFlow, selectedDrawingIds, selectedEdgeIds, selectedGroupIds, selectedIds, setBalanceOpen, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setDrawingsDashed, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setPlaytestsOpen, setReportsOpen, setSnapshotsOpen, snapshots, snapshotsLoading, tidySelection, treeUI, updateEdge }} />

        <IoDrawer {...{ handleImportConfirm, ioMode, ioOpen, ioText, setIoOpen, setIoText }} />

      </div>

      <PresentBar {...{ board, exitPresentation, presentIndex }} />

      <BoardPopovers {...{ addComment, applyColorToSelection, applyGroupColor, applyNodeColor, applyNodeDashed, applyNodeLevel, applyNodeShape, applyToSelection, arrangeAsTree, badgeUI, board, chipDrag, colorDrag, colorMenu, commentsFor, createBadge, createPaletteColor, deleteBadge, deleteComment, deleteEdge, deleteGroup, deleteNode, deletePaletteColor, deleteSelection, dropIdsFor, dropTargetId, duplicateNodes, duplicateSelection, edgeMenu, groupSelectedCards, openTreePanel, paletteUI, selectedGroupIds, selectedIds, setBadgeUI, setColorMenu, setCommentsFor, setEdgeMenu, setEditingId, setFocusId, setPaletteUI, setSelectedIds, store, tidySelection, toggleGroupLock, toggleNodeLock, updateBadge, updateEdge, updatePaletteColor }} />
      <CaptureOverlay {...{ captureOpen, captureText, confirmCapture, setCaptureOpen, setCaptureText }} />

      {inviteOpen && role === "owner" && (
        <InviteModal boardId={boardId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

