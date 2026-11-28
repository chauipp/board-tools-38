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
import { RELATION_OPTIONS, relationDefinition, isGameDesignRelation, createRelatedGameDesignCard, duplicateGameDesignCard, exportPackage, exportVersion, normalizeGameDesignBrief, normalizeGameDesignFlow, normalizeGameDesignBalance, createGameDesignNode, dependencyAnalysis, gameDesignMarkdown } from "../lib/game-design.js";
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
import { buildOutline, outlineToMarkdown } from "../lib/outline.js";
import { gridLayout, layerLayout } from "../lib/layout.js";
import { buildTree, edgeKey } from "../lib/tree-layout.js";
import { normalizeTreeLock, treeLockOwners, arrangeTree, arrangeLockedTrees, lockedTreeSiblings, swapLockedSiblings } from "../lib/locked-tree.js";
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
  const [treeOpts, setTreeOpts] = useState(TREE_OPTS);
  const treeBaseRef = useRef(null);
  const treeControllerRef = useRef(null);
  const treeMembersRef = useRef(null);
  const treeLastRef = useRef(null);
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
  // Ô nhập text đang mở: { id: number|null, x, y, value, size, color }. id null
  // = đang tạo mới. Chỉ có MỘT ô mở tại một thời điểm.
  const [textEdit, setTextEdit] = useState(null);
  // Text đang được kéo: { id, x, y }. Chỉ là bản NHÁP để vẽ lại theo con trỏ;
  // board chỉ được ghi một lần lúc nhả chuột.
  const [textDrag, setTextDrag] = useState(null);
  // Bản sao của textEdit trong một ref, để commitText CHỐT ĐƯỢC MỘT LẦN. Nó là
  // handler của onBlur đồng thời được gọi tường minh khi bấm sang chỗ khác; hai
  // đường cùng đọc `textEdit` từ closure của một lượt vẽ nên gọi hai lần sẽ lưu
  // ra hai phần tử giống hệt nhau. Ref bị xoá ngay trong lời gọi đầu, lời gọi
  // thứ hai thành lệnh rỗng.
  const textEditRef = useRef(null);
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
  const [presentIndex, setPresentIndex] = useState(null); // null = không trình chiếu
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
  const [treeSwap, setTreeSwap] = useState(null);
  const treeSwapCancelRef = useRef(null);
  const treeSwapClickUntilRef = useRef(0);
  useEffect(() => () => treeSwapCancelRef.current?.(), []);

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
  const prePresentViewRef = useRef(null);
  // Ngữ cảnh 2d dùng để đo bề rộng chữ, dựng một lần rồi dùng lại.
  // undefined = chưa dò; null = đã dò và môi trường không có canvas 2d.
  const measureCtxRef = useRef(undefined);
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
    if (!treeUI || !board) return;
    const key = edgeKey(treeUI.kind, treeUI.id);
    if (treeControllerRef.current === workspace.controller && treeMembersRef.current?.rootKey === key && treeBaseRef.current) return;
    const root = (treeUI.kind === "group" ? board.groups : board.nodes).find((item) => item.id === treeUI.id);
    if (!root) return;
    const opts = normalizeTreeLock(root.treeLayoutLock) || TREE_OPTS;
    setTreeOpts({ ...opts, leaf: opts.breadth });
    treeBaseRef.current = board;
    treeControllerRef.current = workspace.controller;
    treeMembersRef.current = { rootKey: edgeKey(treeUI.kind, treeUI.id), members: opts.groupMembers || {} };
    treeLastRef.current = null;
  }, [treeUI?.kind, treeUI?.id, workspace.controller, board != null]);

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
  // Dependency chỉ là một lớp thông tin dẫn đường trên canvas: giữ phân tích
  // thuần theo snapshot board để card, dây và dock luôn nói cùng một sự thật.
  const dependency = useMemo(
    () => (board?.kind === "game-design" ? dependencyAnalysis(board) : null),
    [board]
  );
  const paletteStyle = useMemo(() => paletteCss(board?.palette ?? EMPTY_ARRAY), [board?.palette]);

  // Text đang kéo vẽ ở vị trí NHÁP, board vẫn giữ vị trí cũ cho tới lúc nhả
  // chuột. Cùng cách applyGeomOverlay phủ vị trí thẻ của người khác lên board.
  // Đồng bộ ref với state ở mỗi lượt vẽ. Đặt trong thân component (không phải
  // effect) để nó đúng NGAY trong lượt đó: handler mousedown có thể chạy trước
  // khi effect kịp chạy.
  textEditRef.current = textEdit;

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

  // Điều kiện để React.memo trên IdeaCard/FrameBox/EdgeLayer có tác dụng: prop
  // hàm phải giữ nguyên định danh giữa các lần render. Các hàm xử lý thật thì
  // được định nghĩa lại ở mỗi lần render (chúng đóng gói `board`, `selectedIds`
  // …), nên ta cất bản mới nhất vào một ref và cho component nhận một lớp vỏ
  // bất biến gọi xuyên qua ref. Không có lớp vỏ này, kéo MỘT thẻ vẫn dựng lại
  // toàn bộ thẻ, khung và dây trên bảng ở từng khung hình.
  const actionsRef = useRef({});
  const cardHandlers = useMemo(() => ({
    mouseDown: (e, id) => actionsRef.current.nodeMouseDown(e, id),
    click: (id) => actionsRef.current.cardClick(id),
    isClick: () => actionsRef.current.isCardClick(),
    contextMenu: (e, id) => actionsRef.current.openColorMenu(e, "card", id),
    connectorMouseDown: (e, id, direction) => actionsRef.current.connectorMouseDown(e, id, direction),
    edit: (id) => setEditingId(id),
    cancelEdit: () => setEditingId(null),
    remove: (id) => actionsRef.current.deleteNode(id),
    toggleFavorite: (id) => actionsRef.current.toggleFavorite(id),
    openComments: (e, id) => actionsRef.current.openComments(e, id),
    liveText: (id, field, value) => actionsRef.current.liveText(id, field, value),
    save: (id, fields) => actionsRef.current.saveNodeEdit(id, fields),
    saveAndNext: (id, fields) => actionsRef.current.saveNodeEditAndNext(id, fields),
    dropImage: (e, id) => actionsRef.current.dropImage(e, id),
    removeImage: (id) => actionsRef.current.removeImage(id),
    imageResize: (e, id) => actionsRef.current.imageResize(e, id),
    pdfResize: (e, id) => actionsRef.current.pdfResize(e, id)
  }), []);
  const groupHandlers = useMemo(() => ({
    mouseDown: (e, id) => actionsRef.current.groupMouseDown(e, id),
    contextMenu: (e, id) => actionsRef.current.openColorMenu(e, "group", id),
    remove: (id) => actionsRef.current.deleteGroup(id),
    editTitle: (id) => setEditingGroupTitleId(id),
    cancelTitle: () => setEditingGroupTitleId(null),
    saveTitle: (id, title) => actionsRef.current.saveGroupTitle(id, title),
    resizeMouseDown: (e, id) => actionsRef.current.groupResizeMouseDown(e, id),
    connectorMouseDown: (e, id) => actionsRef.current.groupConnectorMouseDown(e, id)
  }), []);
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

  // Chip danh tính được render ở AuthGate, ngoài `.shell`, nên selector
  // `.shell.presenting` không với tới được. Đánh dấu trên body để ẩn nó khi
  // trình chiếu, giống mọi thứ chrome khác của board.
  useEffect(() => {
    document.body.classList.toggle("presenting", presentIndex != null);
    return () => document.body.classList.remove("presenting");
  }, [presentIndex]);

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

  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      const key = e.key.toLowerCase();
      // Đang trình chiếu: ←/→/Esc được ưu tiên, mọi phím tắt khác tạm tắt.
      if (presentIndex != null) {
        if (key === "arrowright") { e.preventDefault(); stepPresentation(1); }
        else if (key === "arrowleft") { e.preventDefault(); stepPresentation(-1); }
        else if (key === "escape") { exitPresentation(); }
        // `k` là ngoại lệ duy nhất trong danh sách phím tắt bị tắt khi trình
        // chiếu, vì đang trình chiếu MỚI là lúc cần cây laser nhất. Nó cũng
        // không đụng gì tới slide: chỉ đổi mode, không ghi, không lia bảng.
        else if (key === "k") { e.preventDefault(); enterMode(mode === "laser" ? "select" : "laser"); }
        return;
      }
      // Undo/redo/nhân bản đều ghi dữ liệu. Với người chỉ xem chúng không lưu
      // được (saveNow chặn) nhưng vẫn làm thẻ nhảy trên màn hình rồi biến mất
      // khi tải lại — nên chặn thẳng ở đây.
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+F chỉ dời con trỏ vào ô tìm kiếm, không ghi gì — người chỉ xem
        // vẫn phải dùng được, nên xử lý TRƯỚC guard viewer bên dưới.
        if (key === "f") {
          e.preventDefault();
          setSearchOpen(true);
          // Đang mở sẵn thì focus ngay tại đây; đang đóng thì ô nhập chưa có
          // trong cây, useEffect theo `searchOpen` bên dưới lo nốt.
          const el = searchInputRef.current;
          if (el) { el.focus(); el.select(); }
          return;
        }
        if (role === "viewer") return;
        if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
        else if (key === "z") { e.preventDefault(); undo(); }
        else if (key === "y") { e.preventDefault(); redo(); }
        else if (key === "d") { e.preventDefault(); duplicateSelection(); }
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (role === "viewer") return;
        e.preventDefault();
        deleteSelection();
      }
      else if (key === "escape") {
        if (mode === "draw" || mode === "place" || mode === "laser") enterMode("select");
        else if (colorMenu) setColorMenu(null);
        else if (badgeUI) setBadgeUI(null);
        else if (edgeMenu) setEdgeMenu(null);
        else if (commentsFor) setCommentsFor(null);
        else if (linkMode) { setLinkMode(false); setPendingSource(null); }
        else if (focusId != null) setFocusId(null);
        else if (selectedIds.size > 0 || selectedEdgeIds.size > 0 || selectedGroupIds.size > 0 || selectedDrawingIds.size > 0) clearSelection();
      }
      // Enter trên thẻ đang chọn = tạo thẻ con bên phải, Shift+Enter = tạo thẻ
      // cùng cấp bên dưới. Handler đã thoát sớm khi con trỏ nằm trong
      // input/textarea, nên thẻ đang mở ô sửa không rơi vào đây.
      else if (key === "enter") {
        if (role === "viewer") return;
        if (editingId != null || selectedIds.size !== 1) return;
        if (colorMenu || badgeUI || edgeMenu || commentsFor) return;
        e.preventDefault();
        const [id] = selectedIds;
        if (e.shiftKey) createSiblingNode(id);
        else createLinkedNode(id, "right");
      }
      // `n` không còn thả thẳng một thẻ ra giữa màn hình: nó lên nòng nút "thêm
      // ý tưởng" y như bấm nút đó, rồi chờ bấm chỉ chỗ. Shift+N lên nòng luôn ở
      // bậc 1 (thẻ gốc) — thay cho nút "thêm thẻ gốc" đã rời khỏi khu 3.
      else if (key === "n") {
        if (role === "viewer") return;
        e.preventDefault();
        // Shift+N luôn LÊN nòng, không bao giờ hạ: nó mang thêm ý "đổi sang bậc
        // 1", nên bấm nó lúc đang lên nòng sẵn mà lại tắt đi là ngược ý.
        if (e.shiftKey) { setCardLevelPref(1); setPlaceTool("node"); enterMode("place"); }
        else armPlace("node");
      }
      // v chỉ đổi mode, không ghi gì — người chỉ xem vẫn dùng được.
      else if (key === "v") { e.preventDefault(); enterMode("select"); }
      // `p` = Pen. Trước đây là `b` (brush) — đổi vì tool này tên là Bút.
      else if (key === "p") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("pen"); }
      else if (key === "e") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("eraser"); }
      else if (key === "s") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("shape"); }
      else if (key === "t") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("text"); }
      else if (key === "l") { if (role === "viewer") return; e.preventDefault(); toggleLinkMode(); }
      // `k` — chữ cái Excalidraw dùng cho laser. Bấm lần nữa là tắt: laser là
      // thứ bật lên trong dăm câu nói rồi tắt, khác bút (chọn xong vẽ cả buổi),
      // nên nó cần một phím BẬT/TẮT chứ không phải một phím chọn.
      // Không có chốt viewer: laser không ghi gì vào board.
      else if (key === "k") { e.preventDefault(); enterMode(mode === "laser" ? "select" : "laser"); }
      // `f` (vừa khung theo lựa chọn) chỉ đổi view — người chỉ xem vẫn dùng được.
      else if (key === "f") { e.preventDefault(); zoomToSelection(); }
      else if (key === "arrowleft") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(e.shiftKey ? -10 : -1, 0); }
      else if (key === "arrowright") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(e.shiftKey ? 10 : 1, 0); }
      else if (key === "arrowup") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(0, e.shiftKey ? -10 : -1); }
      else if (key === "arrowdown") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(0, e.shiftKey ? 10 : 1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // selectedDrawingIds PHẢI có trong danh sách này: chọn riêng mấy nét vẽ mà
    // không đụng tới thẻ/khung thì effect không chạy lại, và handler còn giữ
    // closure của lượt render cũ — Delete sẽ đọc một vùng chọn rỗng và không
    // xoá gì. Cùng lý do với mọi state khác trong hàm này.
  }, [board, past, future, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, linkMode, colorMenu, badgeUI, edgeMenu, commentsFor, focusId, presentIndex, role, editingId, mode, placeTool]);

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

  function addGameDesignCard(type = "mechanic") {
    if (board.kind !== "game-design" || role === "viewer") return;
    const rect = viewportRef.current.getBoundingClientRect();
    const p = toCanvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const node = createGameDesignNode(board.nextNodeId, p.x - CARD_W / 2, p.y - 55, type);
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: node.id + 1 };
    store.commit(next, { from: board }); setDesignEditId(node.id);
  }

  function saveDesignNode(nextNode) {
    const current = boardRef.current;
    const next = { ...current, nodes: current.nodes.map((n) => n.id === nextNode.id ? nextNode : n) };
    // Panel là inspector của thẻ đang chọn, không phải modal dùng một lần. Giữ
    // nó mở sau khi lưu để người thiết kế nhìn ngay phần vừa điền và chuyển qua
    // thẻ khác bằng một cú bấm trên canvas.
    store.commit(next, { from: current });
  }
  function createRelatedDesignNode(sourceId, type, relation) {
    const current = boardRef.current; const next = createRelatedGameDesignCard(current, sourceId, type, relation);
    if (next === current) return; store.commit(next, { from: current }); setDesignEditId(next.nextNodeId - 1);
  }
  function duplicateDesignNode(sourceId) {
    const current = boardRef.current; const next = duplicateGameDesignCard(current, sourceId);
    if (next === current) return; store.commit(next, { from: current }); setDesignEditId(next.nextNodeId - 1);
  }

  function saveGameDesignBrief(nextBrief) {
    const current = boardRef.current;
    if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignBrief: normalizeGameDesignBrief(nextBrief) };
    store.commit(next, { from: current });
  }

  function saveGameDesignFlow(nextFlow) {
    const current = boardRef.current;
    if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignFlow: normalizeGameDesignFlow(nextFlow, current.nodes) };
    store.commit(next, { from: current });
  }
  function saveGameDesignBalance(nextBalance) {
    const current = boardRef.current; if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignBalance: normalizeGameDesignBalance(nextBalance, current.nodes) };
    store.commit(next, { from: current });
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

  function startLockedTreeSwap(e, sourceKey) {
    if (roleRef.current === "viewer") return;
    treeSwapCancelRef.current?.();
    const candidates = new Set(lockedTreeSiblings(boardRef.current, sourceKey, treeSizeRef.current));
    if (!candidates.size) return;
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    function targetAt(ev) {
      const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
      for (const el of elements) {
        const card = el.closest(".idea-card[data-id]");
        const frame = el.closest(".frame-box[data-group-id]");
        const key = card ? edgeKey("node", card.dataset.id)
          : frame ? edgeKey("group", frame.dataset.groupId) : null;
        if (key && candidates.has(key)) return key;
      }
      return null;
    }
    function onMove(ev) {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      moved = true;
      cardDragClickGuardRef.current.markDragged();
      setTreeSwap({ source: sourceKey, candidates, target: targetAt(ev), x: ev.clientX, y: ev.clientY });
    }
    function cleanup() {
      treeSwapCancelRef.current = null;
      setTreeSwap(null);
      if (moved) treeSwapClickUntilRef.current = Date.now() + 250;
    }
    function onUp(ev) {
      const target = moved ? targetAt(ev) : null;
      cleanup();
      if (!target || roleRef.current === "viewer") return;
      const current = boardRef.current;
      const next = swapLockedSiblings(current, sourceKey, target, treeSizeRef.current);
      if (next !== current) {
        recordHistory(current);
        store.commit(next, { historical: false });
      }
    }
    // Esc hoặc mất focus: huỷ, không đổi chỗ gì. treeSwapCancelRef giữ hàm huỷ
    // để một lượt đổi chỗ mới (hoặc unmount) dọn lượt cũ còn dở.
    treeSwapCancelRef.current = startDrag(e, {
      onMove, onEnd: onUp, onCancel: cleanup, throttle: false, blur: "cancel", cancelOnEscape: true
    });
  }

  function treeSwapState(key) {
    if (!treeSwap) return undefined;
    return treeSwap.source === key ? "source" : treeSwap.target === key ? "target"
      : treeSwap.candidates.has(key) ? "candidate" : undefined;
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

  // Đo bề rộng một dòng chữ bằng đúng font đang hiển thị. Phải đọc --canvas-font
  // qua getComputedStyle chứ không viết cứng: bật skin vẽ tay là font đổi, và
  // hộp đo bằng font cũ sẽ lệch hẳn. Cùng cách png-export.js dựng ngữ cảnh 2d.
  function measureTextWidth(line, size) {
    if (measureCtxRef.current === undefined) {
      // getContext trả null ở môi trường không có canvas thật (jsdom của smoke
      // test). Dò một lần rồi nhớ kết quả: dò lại mỗi lần đo thì một text ba
      // dòng in ra ba dòng cảnh báo.
      measureCtxRef.current = document.createElement("canvas").getContext("2d") || null;
    }
    const ctx = measureCtxRef.current;
    // Không có ngữ cảnh 2d thì ước lượng thô. Hộp chỉ dùng cho vùng chạm của
    // cục gôm và vùng bấm để kéo, nên sai vài phần trăm còn hơn ném lỗi và làm
    // trắng cả trang chỉ vì không đo được một dòng chữ.
    if (!ctx) return line.length * size * 0.55;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--canvas-font").trim();
    ctx.font = `${size}px ${family || "sans-serif"}`;
    return ctx.measureText(line).width;
  }

  // Bấm khi đang cầm tool Text. Trúng một text đã có thì mở nó ra sửa, trúng
  // chỗ trống thì tạo mới tại đúng chỗ bấm.
  function handleTextMouseDown(e) {
    // BẮT BUỘC. Hành vi mặc định của mousedown là dời tiêu điểm: .ink-capture là
    // một div không nhận được tiêu điểm nên trình duyệt đẩy nó về <body>. Mà
    // React 18 xả sự kiện rời rạc NGAY trong lúc dispatch, nên ô nhập đã kịp gắn
    // vào cây và tự lấy tiêu điểm (autoFocus) TRƯỚC khi hành vi mặc định chạy —
    // rồi bị cướp tiêu điểm ngay sau đó, blur bắn ra, commitText thấy chuỗi rỗng
    // và gỡ ô nhập đi. Triệu chứng đúng như đã thấy: bấm mà "không ra cái gì để
    // viết". Không có dòng này thì mọi cách focus lại đều chỉ là vá ngọn.
    e.preventDefault();

    // Đang gõ dở mà bấm sang chỗ khác: chốt cái cũ lại rồi mở ngay ô mới ở chỗ
    // vừa bấm — ô nhập "nhảy" theo con trỏ, không bắt bấm hai lần.
    //
    // Việc này chỉ an toàn nhờ preventDefault ở trên. Không có nó, tiêu điểm bị
    // đẩy về <body> và `blur` bắn ra xen vào giữa hai việc dưới đây, thứ tự
    // khác nhau giữa các trình duyệt — và cái sai sẽ là mất chữ vừa gõ. Có nó
    // rồi thì tiêu điểm không rời textarea, React dùng lại đúng nút DOM đó
    // (cùng kiểu, cùng vị trí trong cây) nên `blur` không bao giờ xảy ra: chỉ
    // còn MỘT đường chốt, là lời gọi tường minh ngay đây.
    if (textEdit) commitText();

    // Đọc board SAU khi chốt: commitText vừa cập nhật boardRef.current, nên
    // phép dò bên dưới nhìn thấy cả đoạn text vừa gõ xong. Bấm đè lên chính nó
    // là mở lại nó ra sửa, đúng như bấm lên một text cũ bất kỳ.
    const current = boardRef.current;
    if (!current) return;
    const p = eventToCanvas(e);
    const hit = drawingsHitBy(current.drawings || [], p, 0)
      .map((id) => current.drawings.find((d) => d.id === id))
      .find((d) => d && d.kind === "text");
    if (hit) { startTextDrag(hit, p); return; }
    const fresh = { id: null, x: Math.round(p.x), y: Math.round(p.y), value: "", size: penPrefs.size, color: penPrefs.color };
    setTextEdit(fresh);
    beginLiveText(fresh);
  }

  // Bấm trúng một text: MỘT cú bấm phục vụ hai việc. Di dưới ngưỡng thì coi như
  // chỉ bấm → mở ra sửa; di quá ngưỡng thì là kéo → dời chỗ. Không cần bấm đúp,
  // và không có cách nào bấm nhầm sang việc kia.
  function startTextDrag(el, start) {
    const offX = start.x - el.pts[0];
    const offY = start.y - el.pts[1];
    let moved = false;
    let last = { x: el.pts[0], y: el.pts[1] };
    inkLive.beginMove();

    function onMove(ev) {
      const p = eventToCanvas(ev);
      if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < TEXT_DRAG_THRESHOLD) return;
      moved = true;
      last = { x: Math.round(p.x - offX), y: Math.round(p.y - offY) };
      // Chỉ đẩy vào state NHÁP, không ghi vào board: một lần kéo phải là một
      // lần lưu, không phải một lần cho mỗi nhịp chuột.
      setTextDrag({ id: el.id, x: last.x, y: last.y });
      // Vì board KHÔNG đổi trong lúc kéo, gói live phải dựng từ vị trí nháp chứ
      // không dựng qua movingPayload — hàm đó đọc board.
      inkLive.pushMove([{ id: el.id, pts: [last.x, last.y] }]);
    }

    function cleanup() {
      setTextDrag(null);
    }

    // Cửa sổ mất focus giữa lượt kéo: mouseup sẽ không bao giờ tới. Cùng cái bẫy
    // useInk.js đã có ghi chú dài — không dọn thì text treo ở vị trí nháp và cú
    // mouseup sau đó (ở một ngữ cảnh khác) vẫn commit.
    function cancel() { cleanup(); inkLive.cancelMove(); }

    function finish() {
      cleanup();
      if (!moved) {
        inkLive.cancelMove();
        const reopen = { id: el.id, x: el.pts[0], y: el.pts[1], value: el.text, size: el.size, color: el.color };
        setTextEdit(reopen);
        beginLiveText(reopen);
        return;
      }
      const current = boardRef.current;
      if (!current) { inkLive.cancelMove(); return; }
      inkLive.endMove([{ id: el.id, pts: [last.x, last.y] }]);
      const next = {
        ...current,
        drawings: current.drawings.map((d) => (d.id === el.id ? { ...d, pts: [last.x, last.y] } : d))
      };
      store.commit(next, { from: current });
    }

    // Không có sự kiện chuột ở đây (start là toạ độ canvas đã tính sẵn), và
    // ngưỡng kéo tính theo đơn vị canvas trong onMove — nên không truyền event.
    startDrag(null, { onMove, onEnd: finish, onCancel: cancel, throttle: false, blur: "cancel" });
  }

  // Cùng kỷ luật refs-only như commitStroke (xem ghi chú dài ở đó): gõ một đoạn
  // chú thích mất vài chục giây, board:update của người khác về giữa chừng mà
  // mình dựng `next` từ `board` đóng gói lúc mở ô nhập thì cú PUT sau đó đè mất
  // thay đổi của họ.
  // Mở kênh live cho một lượt gõ. Tách ra vì có HAI chỗ mở ô nhập — bấm chỗ
  // trống để tạo mới, và bấm lên một đoạn có sẵn để sửa — mà cả hai phải phát
  // gói đầu giống hệt nhau, không thì một trong hai đường lặng lẽ không realtime.
  function beginLiveText(edit) {
    inkLive.beginText(
      [Math.round(edit.x), Math.round(edit.y)],
      edit.value, edit.color, edit.size, edit.id
    );
  }

  function commitText() {
    const edit = textEditRef.current;
    textEditRef.current = null;
    setTextEdit(null);
    if (!edit) return;
    const current = boardRef.current;
    if (!current) { inkLive.cancelText(); return; }
    const value = edit.value.trim();

    // Rỗng: tạo mới thì không đẻ ra phần tử vô hình; sửa thì coi như xoá.
    if (!value) {
      // Cả hai nhánh dưới đây đều KHÔNG để lại đoạn text nào, nên overlay phải
      // bị huỷ chứ không phải chốt: gói done không có drawingId sẽ treo trên
      // màn hình người khác tới hết INK_SETTLE_TTL_MS.
      inkLive.cancelText();
      if (edit.id == null) return;
      const next = { ...current, drawings: current.drawings.filter((d) => d.id !== edit.id) };
      store.commit(next, { from: current });
      return;
    }

    // Mở một text ra xem rồi đóng lại mà không sửa gì: không ghi gì cả. Thiếu
    // chốt này thì mỗi lần bấm nhầm vào một dòng chú thích là một lần lưu lên
    // server VÀ một bước hoàn tác rỗng — Ctrl+Z mấy lần liền không thấy gì đổi.
    if (edit.id != null) {
      const before = current.drawings.find((d) => d.id === edit.id);
      if (before && before.text === value && before.size === edit.size
          && before.color === edit.color
          && before.pts[0] === Math.round(edit.x) && before.pts[1] === Math.round(edit.y)) {
        // Không lưu gì ⇒ sẽ KHÔNG có board:update nào để reconcileInkOverlay
        // dọn overlay theo, nên phải huỷ tay.
        inkLive.cancelText();
        return;
      }
    }

    const lines = textLines(value);
    const box = textBox(lines, edit.size, measureTextWidth);
    const el = {
      kind: "text", pts: [Math.round(edit.x), Math.round(edit.y)],
      text: value, color: edit.color, size: edit.size, w: box.w, h: box.h
    };
    let next;
    let savedId;
    if (edit.id == null) {
      const id = current.nextDrawingId;
      savedId = id;
      next = { ...current, drawings: [...current.drawings, { id, ...el }], nextDrawingId: id + 1 };
    } else {
      savedId = edit.id;
      next = { ...current, drawings: current.drawings.map((d) => (d.id === edit.id ? { ...d, ...el } : d)) };
    }
    // Chốt kèm id vừa lưu: người nhận giữ overlay cho tới đúng lúc board:update
    // mang id đó về, không sớm hơn (chữ biến mất rồi hiện lại) cũng không muộn
    // hơn (hai lớp chữ chồng nhau).
    inkLive.endText(savedId);
    store.commit(next, { from: current });
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

  // Xếp lại thẻ gốc + toàn bộ con cháu nối với nó thành hình cây. Gốc đứng yên
  // làm điểm neo; thẻ khoá giữ chỗ nhưng con cháu nó vẫn xếp quanh đúng chỗ đó.
  // Thuần một phép biến đổi board → board: bảng Xếp cây gọi lại nó mỗi lần kéo
  // thanh trượt để xem trước, nên nó không được tự ý ghi state hay lưu server.
  function treeArranged(base, rootKind, rootId, opts) {
    const bucket = rootKind === "group" ? "groups" : "nodes";
    const root = base[bucket].find((item) => item.id === rootId);
    if (!root) return base;
    const layoutOpts = { directions: opts.directions, depth: opts.depth, breadth: opts.breadth, leaf: opts.leaf };
    const existing = normalizeTreeLock(root.treeLayoutLock);
    const members = treeMembersRef.current?.rootKey === edgeKey(rootKind, rootId)
      ? treeMembersRef.current.members : null;
    const effectiveOpts = { ...existing, ...layoutOpts, ...(members ? { groupMembers: members } : {}) };
    const configured = existing ? {
      ...base,
      [bucket]: base[bucket].map((item) => item.id === rootId ? { ...item, treeLayoutLock: effectiveOpts } : item)
    } : base;
    return arrangeTree(configured, rootKind, rootId, effectiveOpts, frameCardSize);
  }

  function treeOwner(kind, id) {
    const owner = layoutOwners.get(edgeKey(kind, id));
    if (!owner) return { kind, id };
    const [ownerKind, ownerId] = owner.split(":");
    return { kind: ownerKind, id: Number(ownerId) };
  }

  // Bốn nút mũi tên trong menu chuột phải: bấm là xếp luôn một hướng, không mở
  // bảng. Giữ đúng khoảng cách mặc định cũ — lên/xuống dùng chiều cao thẻ (nhỏ)
  // làm khoảng cách tầng nên nhìn chật hơn trái/phải (dùng chiều rộng thẻ), phải
  // nới thêm cho hai hướng dọc.
  function arrangeAsTree(rootKind, rootId, direction) {
    if (role === "viewer") return;
    const owner = treeOwner(rootKind, rootId);
    rootKind = owner.kind; rootId = owner.id;
    const vertical = direction === "down" || direction === "up";
    const next = treeArranged(board, rootKind, rootId, {
      ...TREE_OPTS, directions: [direction], depth: vertical ? 110 : 70
    });
    setColorMenu(null);
    if (next) store.commit(next);
  }

  // Bảng Xếp cây. Cả phiên chỉnh (mở bảng → kéo thanh trượt chán chê → đóng) chỉ
  // ghi MỘT mốc hoàn tác, ghi ngay lúc mở: kéo thanh trượt mà mỗi nấc một mốc
  // thì Ctrl+Z sau đó phải bấm ba chục lần mới về được chỗ cũ.
  function openTreePanel(rootKind, rootId) {
    if (role === "viewer") return;
    const owner = treeOwner(rootKind, rootId);
    rootKind = owner.kind; rootId = owner.id;
    setColorMenu(null);
    const base = board;
    treeBaseRef.current = base;
    treeControllerRef.current = workspace.controller;
    const rootKey = edgeKey(rootKind, rootId);
    const memberKeys = new Set(buildTree(base.edges, rootKey).order);
    const stored = normalizeTreeLock((rootKind === "group" ? base.groups : base.nodes)
      .find((item) => item.id === rootId)?.treeLayoutLock)?.groupMembers;
    const members = Object.fromEntries(base.groups.filter((g) => memberKeys.has(edgeKey("group", g.id)))
      .map((g) => [g.id, stored?.[g.id] || nodesInFrame(base.nodes, g, frameCardSize)]));
    treeMembersRef.current = { rootKey, members };
    setTreeUI({ kind: rootKind, id: rootId });
    const root = (rootKind === "group" ? base.groups : base.nodes).find((item) => item.id === rootId);
    const savedOpts = normalizeTreeLock(root?.treeLayoutLock) || treeOpts;
    const opts = { ...savedOpts, leaf: savedOpts.breadth };
    setTreeOpts(opts);
    const next = treeArranged(base, rootKind, rootId, opts);
    treeLastRef.current = next;
    store.commit(next, { from: base });
  }

  function previewTree(opts) {
    if (role === "viewer") return;
    setTreeOpts(opts);
    const base = boardRef.current;
    if (!base || !treeUI) return;
    if (!treeLastRef.current) recordHistory(base);
    const next = treeArranged(base, treeUI.kind, treeUI.id, opts);
    if (!next) return;
    treeLastRef.current = next;
    store.preview(next);                      // chỉ trên máy mình, chưa lưu
  }

  function toggleTreeLock(enabled) {
    if (!treeUI || role === "viewer") return;
    const base = boardRef.current;
    const rootKey = edgeKey(treeUI.kind, treeUI.id);
    const descendants = new Set(buildTree(base.edges, rootKey).order);
    const update = (kind, item) => {
      const key = edgeKey(kind, item.id);
      if (key === rootKey) return { ...item, treeLayoutLock: enabled ? {
        ...normalizeTreeLock(item.treeLayoutLock),
        directions: [...treeOpts.directions], depth: treeOpts.depth, breadth: treeOpts.breadth, leaf: treeOpts.leaf,
        groupMembers: treeMembersRef.current?.members || {}
      } : null };
      if (enabled && descendants.has(key) && item.treeLayoutLock) return { ...item, treeLayoutLock: null };
      return item;
    };
    const next = arrangeLockedTrees({
      ...base,
      nodes: base.nodes.map((item) => update("node", item)),
      groups: base.groups.map((item) => update("group", item))
    }, frameCardSize);
    treeLastRef.current = next;
    store.commit(next);
  }

  // Nhả tay khỏi thanh trượt (hoặc bấm một hướng) mới lưu server + phát cho
  // người khác — kéo là gửi thì một cú kéo thành mấy chục lượt ghi.
  function commitTree() {
    const next = treeLastRef.current ? boardRef.current : null;
    if (next) saveNow(next);
  }

  function closeTreePanel() {
    commitTree();
    setTreeUI(null);
    treeBaseRef.current = null;
    treeMembersRef.current = null;
    treeLastRef.current = null;
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

  function exportMarkdown() {
    const md = board.kind === "game-design"
      ? gameDesignMarkdown(board)
      : outlineToMarkdown(board, frameCardSize, { other: t`Khác`, links: t`Liên kết` });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${board.kind === "game-design" ? "game-design" : "idea-map"}-${exportVersion(board).replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportVersionedJson() {
    const payload = board.kind === "game-design" ? exportPackage({ ...board, view, name: boardName }) : { ...board, view };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${board.kind === "game-design" ? "game-design" : "idea-map"}-${exportVersion(board).replace(/[^a-zA-Z0-9]/g, "-")}.json`; a.click(); URL.revokeObjectURL(url);
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

  function nudgeSelection(dx, dy) {
    if (selectedIds.size === 0 && selectedGroupIds.size === 0 && selectedDrawingIds.size === 0) return;
    if (store.beginNudge(board)) {   // history recorded once per burst, at burst end
      // Mỗi loạt nhích là MỘT lượt live riêng. Thiếu dòng này thì gói dùng lại
      // strokeId của lượt kéo trước và đè lên entry của nó.
      inkLive.beginMove();
    }
    // Cùng tập với cú kéo bằng chuột: khung đang chọn đi kèm ruột của nó.
    const { groupIds, nodeIds } = selectionDragSet(board, selectedGroupIds, selectedIds);
    const moveNodes = new Set(nodeIds);
    const moveGroups = new Set(groupIds);
    const next = {
      ...board,
      nodes: board.nodes.map((n) => (moveNodes.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      groups: board.groups.map((g) => (moveGroups.has(g.id) ? { ...g, x: g.x + dx, y: g.y + dy } : g)),
      // Nét vẽ / hình / chữ nhích cùng cả cụm. Chúng KHÔNG vào publishGeom bên
      // dưới: gói geom chỉ mang thẻ và khung, người khác thấy nét vẽ nhảy tới
      // chỗ mới ở lần lưu — cùng cách cú kéo nét bằng chuột đang làm.
      drawings: (board.drawings || []).map((d) => (selectedDrawingIds.has(d.id) ? moveDrawing(d, dx, dy) : d))
    };
    setBoard(next);
    // Nhích bằng phím mũi tên cũng là một cú "kéo": người khác phải thấy thẻ
    // chạy ngay, chứ không đợi bản lưu 500ms sau mới nhảy một phát.
    publishGeom({
      nodes: next.nodes.filter((n) => moveNodes.has(n.id)),
      groups: next.groups.filter((g) => moveGroups.has(g.id))
    });
    // Nét vẽ / hình / chữ trong cụm cũng nhích, và chúng đi kênh riêng.
    if (selectedDrawingIds.size) inkLive.pushMove(movingPayload(next, selectedDrawingIds));
    saveDebounced(next);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      finishGeom({
        nodes: boardRef.current.nodes.filter((n) => moveNodes.has(n.id)),
        groups: boardRef.current.groups.filter((g) => moveGroups.has(g.id))
      });
      if (selectedDrawingIds.size) inkLive.endMove(movingPayload(boardRef.current, selectedDrawingIds));
      flushNudgeBurst();
    }, 600);
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

  // Nối lớp vỏ ổn định ở trên với bản mới nhất của từng hàm xử lý. Gán thường,
  // không phải hook — nên đặt được sau các nhánh return sớm.
  actionsRef.current = {
    nodeMouseDown: handleNodeMouseDown,
    cardClick: handleCardClick,
    isCardClick: () => cardDragClickGuardRef.current.consume(),
    openColorMenu,
    connectorMouseDown: handleConnectorMouseDown,
    deleteNode,
    toggleFavorite,
    openComments: (e, id) => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id, x: e.clientX, y: e.clientY }); },
    liveText: (id, field, value) => sendLiveText({ nodeId: id, field, value }),
    saveNodeEdit,
    saveNodeEditAndNext,
    dropImage: handleImageDrop,
    removeImage: removeNodeImage,
    imageResize: handleImageResizeMouseDown,
    pdfResize: handlePdfResizeMouseDown,
    groupMouseDown: handleGroupMouseDown,
    deleteGroup,
    saveGroupTitle,
    groupResizeMouseDown: handleGroupResizeMouseDown,
    groupConnectorMouseDown: handleGroupConnectorMouseDown
  };

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
        <div
          className="canvas"
          ref={canvasRef}
          style={{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})` }}
        >
          {marquee && (
            <div className="marquee-box" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}
          {placeDraft && (
            <div className="place-draft" style={{ left: placeDraft.x, top: placeDraft.y, width: placeDraft.w, height: placeDraft.h }} />
          )}
          {/* TAY CẦM SỬA HÌNH — hiện khi chọn đúng MỘT hình khối. Kéo tay cầm
              góc để đặt từng đỉnh, kéo tay cầm cạnh (ô tròn ở giữa cạnh) để dời
              trọn một cạnh. Với hình định nghĩa bằng hộp bao (chữ nhật, ê-líp,
              hình thoi, tam giác cân) thì góc là góc hộp và cạnh là mép hộp —
              xem ghi chú dài ở lib/shape.js về lý do hai ý nghĩa khác nhau.
              Hiện ở mode Chuột, VÀ ở mode Sửa khi đang cầm BÚT. Ở mode Sửa thì
              `.ink-capture` phủ kín khung nhìn nên chúng không tự nhận được
              chuột — handleInkCaptureMouseDown dò tay để bắt hộ (xem
              shapeHandleAt). Cố ý chỉ ở tool Bút: cục gôm quét trúng tay cầm là
              xoá mất hình, còn tool Hình khối thì việc đang làm là ĐẶT hình mới,
              mấy ô vuông nhỏ nằm giữa vùng kéo chỉ tổ vướng. */}
          {editShape && canGrabShapeHandles && role !== "viewer" && editShape.handles.map((h) => (
            <div
              key={h.t + h.i}
              className={"shape-handle" + (h.t === HANDLE_EDGE ? " edge" : "")}
              // Bù trừ zoom, cùng lý do với tay cầm của hộp bao vùng chọn: cỡ cố
              // định thì ở zoom 40% không bấm nổi, ở 240% thì to hơn cả cái hình.
              style={{
                left: h.x, top: h.y,
                transform: `translate(-50%, -50%) scale(${1 / view.scale})`
              }}
              title={h.t === HANDLE_EDGE ? t`Kéo để dời cả cạnh này` : t`Kéo để đặt góc này vào chỗ khác`}
              onMouseDown={(e) => handleShapeHandleMouseDown(e, h)}
            />
          ))}
          {/* HỘP BAO VÙNG CHỌN. Bản thân hộp KHÔNG nhận chuột (pointer-events:
              none trong CSS) — nó chỉ nói cho mắt biết "cả vùng này là một cụm".
              Cú kéo trong lòng hộp do handleViewportMouseDown bắt, nên bấm trúng
              một cái thẻ ở giữa vùng vẫn là bấm vào cái thẻ đó: bấm đúp để sửa,
              kéo góc ảnh, bấm chip… tất cả còn nguyên.
              Bốn tay cầm ở góc thì NGƯỢC LẠI, chúng bật lại pointer-events —
              chúng là thứ duy nhất trong hộp cướp chuột, và chỉ ở đúng 4 ô nhỏ.
              Chỉ hiện ở mode Chuột: ở mode Sửa cả khung nhìn đã bị .ink-capture
              phủ kín, tay cầm sẽ không bao giờ bấm được, mà vẫn che mất chỗ vẽ. */}
          {selBounds && mode === "select" && (
            <div
              className={"selection-box" + (dropTargetId?.kind === "selection" ? " drop" : "")}
              style={{ left: selBounds.x, top: selBounds.y, width: selBounds.w, height: selBounds.h }}
            >
              {role !== "viewer" && SELECTION_CORNERS.map((corner) => {
                const p = cornerPoint(selBounds, corner);
                return (
                  <div
                    key={corner}
                    className={"selection-handle " + corner}
                    // Bù trừ zoom: tay cầm nằm trong .canvas (đã scale) nên nếu
                    // để cỡ cố định thì ở zoom 40% nó bé tới mức không bấm nổi,
                    // còn ở zoom 240% thì nó to hơn cả cái thẻ.
                    style={{
                      left: p.x - selBounds.x,
                      top: p.y - selBounds.y,
                      transform: `translate(-50%, -50%) scale(${1 / view.scale})`
                    }}
                    title={t`Kéo để phóng to / thu nhỏ cả cụm`}
                    onMouseDown={(e) => handleSelectionResizeMouseDown(e, corner)}
                  />
                );
              })}
            </div>
          )}
          {liveGroups.map((group) => (
            <FrameBox
              key={group.id}
              group={group}
              treeSwapState={treeSwapState(edgeKey("group", group.id))}
              editingTitle={editingGroupTitleId === group.id}
              dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
              selected={selectedGroupIds.has(group.id)}
              h={groupHandlers}
            />
          ))}

          <EdgeLayer
            edges={board.edges}
            routes={edgeRoutes}
            nodeById={nodeById}
            groupById={groupById}
            cardSize={frameCardSize}
            sketch={skin === "sketch"}
            gameDesign={board.kind === "game-design"}
            cycleEdgeIds={dependency?.cycleEdgeIds}
            hoveredEdgeId={hoveredEdgeId}
            selectedEdgeIds={selectedEdgeIds}
            edgeDragId={edgeDrag ? edgeDrag.edgeId : null}
            snapGuides={snapGuides}
            linkDraft={linkDraft}
            edgeDraft={edgeDrag}
            onEdgeEnter={onEdgeEnter}
            onEdgeLeave={onEdgeLeave}
            onEdgeClick={onEdgeClick}
            onEdgeContextMenu={onEdgeContextMenu}
          />

          {liveNodes.map((liveNode) => {
            const liveText = editingId === liveNode.id ? null : textOverlay.get(String(liveNode.id));
            const renderNode = liveText
              ? { ...liveNode, title: liveText.title ?? liveNode.title, desc: liveText.desc ?? liveNode.desc }
              : liveNode;
            return (
              <IdeaCard
                key={liveNode.id}
                node={renderNode}
                layoutLocked={layoutOwners.has(edgeKey("node", liveNode.id))}
                layoutSwappable={!liveNode.locked && layoutOwners.has(edgeKey("node", liveNode.id)) && layoutOwners.get(edgeKey("node", liveNode.id)) !== edgeKey("node", liveNode.id)}
                treeSwapState={treeSwapState(edgeKey("node", liveNode.id))}
                boardId={boardId}
                statusDef={statusDefById.get(liveNode.statusId) ?? null}
                tagDef={tagDefById.get(liveNode.tagId) ?? null}
                statuses={board.statuses}
                tags={board.tags}
                currentUser={currentUser}
                observeCard={observeCard}
                editing={editingId === liveNode.id}
                dimmed={(!passesFilter(liveNode) || (focusSet != null && !focusSet.has(liveNode.id))) && editingId !== liveNode.id}
                linkPending={linkMode && pendingSource === liveNode.id}
                dropTarget={isNodeDropTarget(liveNode.id)}
                selected={selectedIds.has(liveNode.id)}
                flash={flashId === liveNode.id}
                gameDesign={board.kind === "game-design"}
                balance={board.gameDesignBalance}
                blocked={dependency?.blockedNodeIds.has(String(liveNode.id))}
                dependencyCycle={dependency?.cycleNodeIds.has(String(liveNode.id))}
                onDesign={() => setDesignEditId(liveNode.id)}
                h={cardHandlers}
              />
            );
          })}

          <PeerLayer socket={socket} nodeById={nodeById} groupById={groupById} cardSize={frameCardSize} spotlightPeerId={spotlightPeerId} />

          <InkLayer
            drawings={inkDrawings}
            draft={ink.draft}
            eraseIds={ink.eraseIds}
            cut={ink.cut}
            liveStrokes={inkLive.liveStrokes}
            sketch={skin === "sketch"}
            editingTextId={textEdit ? textEdit.id : null}
            selectedIds={selectedDrawingIds}
          />

          {/* Nằm trong .canvas nên vệt bám theo bảng khi lia/phóng — chỉ vào
              một cái thẻ thì vệt ở lại đúng cái thẻ đó, không trôi ra chỗ khác
              khi người xem lia bảng. */}
          <LaserLayer socket={socket} store={laser.store} scale={view.scale} />

          {/* Tay cầm nổi trên cùng, tách khỏi .edge-layer: đầu dây thường trùng
              đúng chỗ connector-zone của thẻ (cả hai đều ở tâm cạnh), và thẻ
              luôn vẽ sau .edge-layer nên connector-zone sẽ che tay cầm nếu để
              chung lớp — chuột sẽ trúng connector-zone thay vì tay cầm. */}
          {hoveredEdgeId != null && !edgeDrag && (() => {
            const edge = board.edges.find((e) => e.id === hoveredEdgeId);
            if (!edge) return null;
            const route = edgeRoutes.get(edge.id);
            if (!route) return null;
            const p1 = route.start, p2 = route.end;
            return (
              <svg
                className="edge-handle-layer"
                onMouseLeave={() => setHoveredEdgeId((id) => (id === edge.id ? null : id))}
              >
                <circle
                  className="edge-handle" cx={p1.x} cy={p1.y} r={6}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "from")}
                />
                <circle
                  className="edge-handle" cx={p2.x} cy={p2.y} r={6}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "to")}
                />
              </svg>
            );
          })()}
        </div>

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

        <div className="zoom-ctrl">
          <button onClick={() => zoomButton(1 / 1.2)} title={t`Thu nhỏ`}>−</button>
          <span className="pct mono">{Math.round(view.scale * 100)}%</span>
          <button onClick={() => zoomButton(1.2)} title={t`Phóng to`}>+</button>
          <div className="sep" />
          <button onClick={fitToView} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}><Trans>Vừa khung</Trans></button>
          <div className="sep" />
          <button
            className={miniOpen ? "on" : undefined}
            onClick={() => setMiniOpen((v) => !v)}
            title={miniOpen ? t`Ẩn bản đồ thu nhỏ` : t`Hiện bản đồ thu nhỏ`}
          ><MiniMapIcon /></button>
        </div>

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

        {/* Dock bên phải là chỗ DUY NHẤT cho mọi thao tác làm đổi dữ liệu: spec
            của thẻ GD và batch edit của mọi loại board cùng sống ở đây. */}
        {!treeUI && (briefOpen || flowOpen || balanceOpen || handoffOpen || decisionTimelineOpen || snapshotsOpen || insightsOpen || reportsOpen || impactOpen || playtestsOpen || designEditId != null || selectedEdgeIds.size >= 1 || selectedIds.size + selectedGroupIds.size >= 2 || selectedGroupIds.size >= 1 || selectedDrawingIds.size >= 1) && (
          <aside className="edit-dock" ref={editDockRef}>
            {briefOpen && board.kind === "game-design" && <GameDesignBriefPanel brief={board.gameDesignBrief} canEdit={role !== "viewer"} onSave={saveGameDesignBrief} onClose={() => setBriefOpen(false)} outsideRef={editDockRef} />}
            {flowOpen && board.kind === "game-design" && <GameDesignFlowPanel flow={board.gameDesignFlow} nodes={board.nodes} canEdit={role !== "viewer"} onSave={saveGameDesignFlow} onClose={() => setFlowOpen(false)} outsideRef={editDockRef} />}
            {balanceOpen && board.kind === "game-design" && <GameDesignBalancePanel balance={board.gameDesignBalance} nodes={board.nodes} canEdit={role !== "viewer"} onSave={saveGameDesignBalance} onClose={() => setBalanceOpen(false)} outsideRef={editDockRef} />}
            {handoffOpen && board.kind === "game-design" && <DevHandoffPanel board={board} boardName={boardName} selectedIds={selectedIds} onClose={() => setHandoffOpen(false)} outsideRef={editDockRef} />}
            {decisionTimelineOpen && board.kind === "game-design" && <DecisionTimelinePanel nodes={board.nodes} onOpenCard={(id) => { setDecisionTimelineOpen(false); setDesignEditId(id); }} onClose={() => setDecisionTimelineOpen(false)} outsideRef={editDockRef} />}
            {snapshotsOpen && <BoardSnapshotsPanel snapshots={snapshots} loading={snapshotsLoading} canEdit={role !== "viewer"} onCreate={createSnapshot} onRestore={restoreSnapshot} onClose={() => setSnapshotsOpen(false)} outsideRef={editDockRef} />}
            {insightsOpen && board.kind === "game-design" && <GameDesignInsightsPanel nodes={board.nodes} onOpenCard={(id) => { setInsightsOpen(false); setDesignEditId(id); }} onClose={() => setInsightsOpen(false)} outsideRef={editDockRef} />}
            {impactOpen && board.kind === "game-design" && <GameDesignImpactPanel board={board} initialCardId={impactCardId} onOpenCard={(id) => { setImpactOpen(false); setDesignEditId(id); }} onClose={() => setImpactOpen(false)} outsideRef={editDockRef} />}
            {playtestsOpen && board.kind === "game-design" && <PlaytestComparisonPanel nodes={board.nodes} onOpenCard={(id) => { setPlaytestsOpen(false); setDesignEditId(id); }} onClose={() => setPlaytestsOpen(false)} outsideRef={editDockRef} />}
            {reportsOpen && board.kind === "game-design" && <GameDesignReportsPanel board={board} boardName={boardName} onClose={() => setReportsOpen(false)} outsideRef={editDockRef} />}
            {designEditId != null && board.kind === "game-design" && (() => {
              const node = board.nodes.find((n) => n.id === designEditId);
              return node ? <GameDesignPanel node={node} nodes={board.nodes} balance={board.gameDesignBalance} canEdit={role !== "viewer"} onSave={saveDesignNode} onDuplicate={() => duplicateDesignNode(node.id)} onCreateRelated={(type, relation) => createRelatedDesignNode(node.id, type, relation)} onClose={() => setDesignEditId(null)} onOpenBalance={() => { setDesignEditId(null); setBalanceOpen(true); }} onOpenImpact={() => { setDesignEditId(null); setImpactCardId(node.id); setImpactOpen(true); }} outsideRef={editDockRef} /> : null;
            })()}
            {board.kind === "game-design" && selectedEdgeIds.size === 1 && (() => {
              const edge = board.edges.find((item) => item.id === [...selectedEdgeIds][0]);
              if (!edge) return null;
              const relation = relationDefinition(edge.relation);
              const isDependency = edge.relation === "depends-on";
              const chain = isDependency ? dependency?.chainFrom(edge.from) || [] : [];
              const chainLabels = chain.map((id) => board.nodes.find((node) => String(node.id) === id)?.title || `#${id}`);
              const hasCycle = dependency?.cycleEdgeIds.has(edge.id);
              const isBlocked = dependency?.blockedNodeIds.has(String(edge.from));
              return (
                <div className="edge-inspector" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="gd-kicker">Quan hệ edge</div>
                  <h2>Liên kết thẻ</h2>
                  <label>Loại quan hệ
                    <select value={isGameDesignRelation(edge.relation) ? edge.relation : "depends-on"} disabled={role === "viewer"} onChange={(e) => updateEdge(edge.id, { relation: e.target.value })}>
                      {RELATION_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <p className="edge-relation-help">{relation.description}</p>
                  {isDependency && (
                    <div className="dependency-inspector">
                      <div className="dependency-chain"><strong>Chuỗi phụ thuộc</strong><span>{chainLabels.join(" → ")}</span></div>
                      {isBlocked && <p className="dependency-warning">Thẻ nguồn đang bị chặn: có prerequisite chưa ở trạng thái Done.</p>}
                      {hasCycle && <p className="dependency-warning">Vòng lặp phụ thuộc: chuỗi này không thể được hoàn tất theo thứ tự hiện tại.</p>}
                    </div>
                  )}
                  {role !== "viewer" && <button className="btn danger edge-delete" onClick={() => deleteEdge(edge.id)}>Xóa dây</button>}
                </div>
              );
            })()}
            {/* Quét trúng cả khung/nét vẽ cũng cần edit dock; nút chỉ có nghĩa
                với thẻ thì tự ẩn khi không có thẻ nào trong vùng chọn. */}
            {(selectedIds.size + selectedGroupIds.size >= 2 || selectedGroupIds.size >= 1 || selectedDrawingIds.size >= 1) && (
              <div className="bulk-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="bb-count mono">
              {selectedIds.size > 0 && <Trans>{selectedIds.size} thẻ</Trans>}
              {selectedIds.size > 0 && selectedGroupIds.size > 0 && " · "}
              {selectedGroupIds.size > 0 && <Trans>{selectedGroupIds.size} khung</Trans>}
              {(selectedIds.size > 0 || selectedGroupIds.size > 0) && selectedDrawingIds.size > 0 && " · "}
              {selectedDrawingIds.size > 0 && <Trans>{selectedDrawingIds.size} nét vẽ</Trans>}
            </span>
            {selectedIds.size >= 2 && (
              <>
                <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ statusId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
                  <option value="">{t`Trạng thái…`}</option>
                  <option value="none">{t`Không trạng thái`}</option>
                  {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ tagId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
                  <option value="">{t`Nhãn…`}</option>
                  <option value="none">{t`Không nhãn`}</option>
                  {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
                </select>
              </>
            )}
            {/* Ô màu áp cho CẢ thẻ lẫn khung đang chọn — cả hai đều nhận cùng
                một `color` token, nên một hàng màu là đủ cho mọi thứ đang chọn. */}
            <div className="bb-swatches">
              <button className="be-swatch dot-empty" onClick={() => applyColorToSelection(null)} title={t`Không màu`} />
              {BADGE_PALETTE.map((token) => (
                <button key={token} className="be-swatch" style={{ background: colorVar(token) }} onClick={() => applyColorToSelection(token)} title={token} />
              ))}
            </div>
            {/* NÉT LIỀN / NÉT ĐỨT cho cả vùng chọn. Cử chỉ bấm hai lần đã làm
                được việc này, nhưng nó đòi nhắm TRÚNG một cái nét — với một nét
                mảnh giữa một đám vừa quét thì đó là việc khó chịu. Ở đây thì
                không phải nhắm gì cả.
                Hai nút đặt giá trị TƯỜNG MINH chứ không phải một nút lật: vùng
                chọn có thể đang nửa liền nửa đứt, mà "lật" một tập lẫn lộn thì
                không có nghĩa gì rõ ràng. */}
            {hasDashableSelected && (
              <>
                <button className="bb-clear" onClick={() => setDrawingsDashed(selectedDrawingIds, false)}><Trans>Nét liền</Trans></button>
                <button className="bb-clear" onClick={() => setDrawingsDashed(selectedDrawingIds, true)}><Trans>Nét đứt</Trans></button>
              </>
            )}
            {selectedIds.size >= 2 && (
              <>
                <button className="bb-clear" onClick={groupSelectedCards}><Trans>Gom nhóm</Trans></button>
                <button className="bb-clear" onClick={tidySelection}><Trans>Xếp gọn</Trans></button>
                <button className="bb-clear" onClick={duplicateSelection}><Trans>Nhân bản</Trans></button>
              </>
            )}
            <button className="bb-clear danger" onClick={deleteSelection}><Trans>Xoá</Trans></button>
            <span className="bb-sep" />
            <button className="bb-clear" onClick={clearSelection}><Trans>Bỏ chọn</Trans></button>
              </div>
            )}
          </aside>
        )}

        {ioOpen && (
          <div className="io-drawer">
            <div className="note">
              {ioMode === "export"
                ? <Trans>JSON hiện tại — copy để sao lưu hoặc gửi cho người khác xem.</Trans>
                : <Trans>Dán JSON đã xuất trước đó, rồi bấm Nhập vào bản đồ.</Trans>}
            </div>
            <textarea spellCheck={false} value={ioText} onChange={(e) => setIoText(e.target.value)} />
            <div className="io-actions">
              {ioMode === "import" && <button className="btn small" onClick={handleImportConfirm}><Trans>Nhập vào bản đồ</Trans></button>}
              <button className="btn ghost small" onClick={() => setIoOpen(false)}><Trans>Đóng</Trans></button>
            </div>
          </div>
        )}

      </div>

      {presentIndex != null && (() => {
        // Khung có thể bị xoá trong lúc trình chiếu → kẹp chỉ số khi render;
        // nếu xoá hết khung vẫn giữ thanh (0/0) để nút thoát × còn bấm được
        // (bên cạnh Esc).
        const idx = Math.min(presentIndex, Math.max(0, board.groups.length - 1));
        const group = board.groups[idx];
        return (
          <div className="present-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="pb-step mono">{group ? `${idx + 1}/${board.groups.length}` : "0/0"}</span>
            {group && <span className="pb-title">{group.title}</span>}
            <button className="pb-exit" onClick={exitPresentation}>×</button>
          </div>
        );
      })()}

      {chipDrag && (
        <div className="chip-ghost" style={{ left: chipDrag.x, top: chipDrag.y }}>
          {(() => {
            const def = chipDrag.value === "none"
              ? null
              : (chipDrag.kind === "status" ? statusById(board, Number(chipDrag.value)) : tagById(board, Number(chipDrag.value)));
            return (
              <>
                <span className="dot" style={{ background: def ? colorVar(def.color) : "transparent" }}></span>
                {def ? def.name : (chipDrag.kind === "status" ? t`Không trạng thái` : t`Không nhãn`)}
                <DropCount targetId={dropTargetId} idsFor={dropIdsFor} />
              </>
            );
          })()}
        </div>
      )}

      {colorDrag && (
        <div className="chip-ghost" style={{ left: colorDrag.x, top: colorDrag.y }}>
          <span className="dot" style={{ background: colorVar(colorDrag.token) }}></span>
          <DropCount targetId={dropTargetId} idsFor={dropIdsFor} />
        </div>
      )}

      {colorMenu && colorMenu.kind === "card" && (() => {
        const node = board.nodes.find((n) => n.id === colorMenu.id);
        if (!node) return null;
        // Chuột phải vào thẻ đang nằm trong vùng chọn thì tác động lên cả vùng chọn.
        // Trước đây nó chỉ đổi đúng một thẻ, im lặng — chọn 5 thẻ rồi bấm màu là ra
        // một thẻ đổi màu. Lúc đó chỉ hiện những việc có nghĩa với nhiều thẻ.
        const multi = selectedIds.size > 1 && selectedIds.has(node.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            count={multi ? selectedIds.size : 1}
            color={multi ? null : node.color ?? null}
            onPick={(color) => (multi ? applyToSelection({ color }) : applyNodeColor(node.id, color))}
            onEdit={one(() => { setColorMenu(null); setEditingId(node.id); })}
            onGroup={multi ? groupSelectedCards : undefined}
            onTidy={multi ? () => { setColorMenu(null); tidySelection(); } : undefined}
            onFocus={one(() => { setColorMenu(null); setFocusId(node.id); })}
            onDuplicate={() => {
              setColorMenu(null);
              if (multi) return duplicateSelection();
              const { next, cloneIds } = duplicateNodes([node.id]);
              store.commit(next);
              setSelectedIds(new Set(cloneIds));
            }}
            onComments={one(() => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id: node.id, x: colorMenu.x, y: colorMenu.y }); })}
            onCopyLink={one(() => {
              const url = new URL(window.location.href);
              url.searchParams.set("card", String(node.id));
              navigator.clipboard.writeText(url.toString());
              setColorMenu(null);
            })}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteNode(node.id); }}
            onClose={() => setColorMenu(null)}
            locked={node.locked ?? false}
            onToggleLock={one(() => toggleNodeLock(node.id))}
            shape={multi ? "rect" : node.shape ?? "rect"}
            onSetShape={one((shape) => applyNodeShape(node.id, shape))}
            dashed={multi ? false : !!node.dashed}
            onSetDashed={one((dashed) => applyNodeDashed(node.id, dashed))}
            // Đổi bậc dùng được cho cả một tập thẻ đang chọn: hạ cả một nhánh
            // xuống bậc phụ là việc hay làm, bắt sửa từng thẻ thì rất mỏi.
            level={multi ? null : cardLevel(node)}
            onSetLevel={(level) => (multi ? applyToSelection(levelPatch(level)) : applyNodeLevel(node.id, level))}
            onArrangeTree={one((direction) => arrangeAsTree("node", node.id, direction))}
            onTreePanel={one(() => openTreePanel("node", node.id))}
          />
        );
      })()}

      {colorMenu && colorMenu.kind === "group" && (() => {
        const group = board.groups.find((g) => g.id === colorMenu.id);
        if (!group) return null;
        // Cùng luật với menu của thẻ: chuột phải vào một khung đang nằm trong
        // vùng chọn thì tác động lên cả vùng chọn, và chỉ hiện những việc có
        // nghĩa với nhiều khung.
        const multi = selectedGroupIds.size > 1 && selectedGroupIds.has(group.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            kind="group"
            count={multi ? selectedGroupIds.size : 1}
            color={multi ? null : group.color ?? null}
            onPick={(color) => (multi ? applyColorToSelection(color) : applyGroupColor(group.id, color))}
            onClose={() => setColorMenu(null)}
            locked={group.locked ?? false}
            onToggleLock={one(() => toggleGroupLock(group.id))}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteGroup(group.id); }}
            onArrangeTree={one((direction) => arrangeAsTree("group", group.id, direction))}
            onTreePanel={one(() => openTreePanel("group", group.id))}
          />
        );
      })()}

      {badgeUI && badgeUI.mode === "create" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName=""
          initialColor={BADGE_PALETTE[0]}
          submitLabel={t`Tạo`}
          onSubmit={(name, color) => createBadge(badgeUI.kind, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
      {badgeUI && badgeUI.mode === "edit" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName={badgeUI.def.name}
          initialColor={badgeUI.def.color}
          submitLabel={t`Lưu`}
          onDelete={() => deleteBadge(badgeUI.kind, badgeUI.def.id)}
          onSubmit={(name, color) => updateBadge(badgeUI.kind, badgeUI.def.id, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}

      {paletteUI && (
        <PaletteEditor
          key={paletteUI.mode + "-" + (paletteUI.id ?? "new")}
          x={paletteUI.x}
          y={paletteUI.y}
          hex={paletteUI.hex}
          onPick={(hex) => (paletteUI.mode === "create" ? createPaletteColor(hex) : updatePaletteColor(paletteUI.id, hex))}
          onDelete={paletteUI.mode === "edit" ? () => deletePaletteColor(paletteUI.id) : undefined}
          onClose={() => setPaletteUI(null)}
        />
      )}

      {edgeMenu && (() => {
        const edge = board.edges.find((e) => e.id === edgeMenu.id);
        if (!edge) return null;
        return (
          <EdgeMenu
            key={edge.id}
            x={edgeMenu.x} y={edgeMenu.y}
            edge={edge}
            onStyleToggle={() => updateEdge(edge.id, { style: (edge.style === "dashed" ? "solid" : "dashed") })}
            onArrowToggle={() => updateEdge(edge.id, { arrow: edge.arrow === "none" ? undefined : "none" })}
            onReverse={() => updateEdge(edge.id, { from: edge.to, fromKind: edge.toKind, to: edge.from, toKind: edge.fromKind })}
            onLabel={(label) => updateEdge(edge.id, { label: label.trim() || undefined })}
            onColorChange={(color) => updateEdge(edge.id, { color: color || undefined })}
            onDelete={() => deleteEdge(edge.id)}
            onClose={() => setEdgeMenu(null)}
          />
        );
      })()}

      {commentsFor && (() => {
        const node = board.nodes.find((n) => n.id === commentsFor.id);
        if (!node) return null;
        return (
          <CommentsPopover
            key={node.id}
            x={commentsFor.x} y={commentsFor.y}
            comments={node.comments ?? []}
            onAdd={(text) => addComment(node.id, text)}
            onDelete={(index) => deleteComment(node.id, index)}
            onClose={() => setCommentsFor(null)}
          />
        );
      })()}
      {captureOpen && (
        <div className="capture-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCaptureOpen(false); }}>
          <div
            className="capture-modal"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.stopPropagation(); setCaptureOpen(false); }
            }}
          >
            <div className="cm-note"><Trans>Mỗi dòng một ý tưởng — xác nhận để tạo hàng loạt thẻ.</Trans></div>
            <textarea
              autoFocus
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); confirmCapture(); }
              }}
              placeholder={t`Ý tưởng 1\nÝ tưởng 2\n…`}
            />
            <div className="cm-actions">
              <button className="btn small" onClick={confirmCapture}><Trans>Tạo thẻ</Trans></button>
              <button className="btn ghost small" onClick={() => setCaptureOpen(false)}><Trans>Hủy</Trans></button>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && role === "owner" && (
        <InviteModal boardId={boardId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

